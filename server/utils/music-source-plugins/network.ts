import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import ipaddr from 'ipaddr.js'
import { MUSIC_PLUGIN_LIMITS } from '../../config/constants.ts'
import { pluginError } from './errors.ts'

// ::a.b.c.d 形式的 IPv4 兼容地址：ipaddr 会判成 unicast，需自行还原（该库只识别 ::ffff/a.b.c.d）
const ipv4CompatibleAddress = (bytes: number[]) => {
  if (bytes.slice(0, 12).some((byte) => byte !== 0)) return null
  if (bytes.slice(12).every((byte) => byte === 0)) return null
  return ipaddr.fromByteArray(bytes.slice(12), 'ipv4')
}

/** IPv4 映射与 IPv4 兼容的 IPv6 写法统一还原成 IPv4 后再判段 */
const comparableAddress = (address: string): ipaddr.IPv4 | ipaddr.IPv6 => {
  const ip = ipaddr.parse(address)
  if (ip.kind() !== 'ipv6') return ip
  const ipv6 = ip as ipaddr.IPv6
  const embedded = ipv6.isIPv4MappedAddress() ? ipv6.toIPv4Address() : ipv4CompatibleAddress(ipv6.toByteArray())
  return embedded && embedded.kind() === 'ipv4' ? (embedded as ipaddr.IPv4) : ipv6
}

export function publicAddress(address: string): boolean {
  try { return comparableAddress(address).range() === 'unicast' } catch { return false }
}

// 任何场景都禁止服务端访问的地址段：云元数据端点落在链路本地段，其余段要么不可达要么为保留用途。
// 与 publicAddress 的区别：私网/回环等地址在备份目标等场景允许，此处只拦绝对不可接受的段。
const UNACCEPTABLE_RANGES: ReadonlySet<string> = new Set([
  'linkLocal',
  'multicast',
  'broadcast',
  'limitedBroadcast',
  'unspecified',
  'reserved',
  'deprecated',
  'benchmarking',
  'as112'
])

export function unacceptableAddress(address: string): boolean {
  try { return UNACCEPTABLE_RANGES.has(comparableAddress(address).range()) } catch { return true }
}

export function networkUrl(input: string): URL {
  let url: URL
  try { url = new URL(input) } catch { throw pluginError('PLUGIN_NETWORK_BLOCKED', 400) }
  if (!(['https:', 'http:'].includes(url.protocol)) ||
      url.username || url.password || input.length > 8192 ||
      url.hostname.toLowerCase().replace(/\.$/, '').endsWith('localhost')) {
    throw pluginError('PLUGIN_NETWORK_BLOCKED', 400)
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && !publicAddress(host)) throw pluginError('PLUGIN_NETWORK_BLOCKED', 400)
  return url
}

function cleanHeaders(headers: Record<string, unknown> = {}) {
  const result: Record<string, string> = { 'accept-encoding': 'identity' }
  if (Object.keys(headers).length > 64) throw pluginError('PLUGIN_NETWORK_BLOCKED', 400)
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase()
    if (['host', 'connection', 'content-length', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'proxy-connection'].includes(name)) continue
    if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) throw pluginError('PLUGIN_NETWORK_BLOCKED', 400)
    const text = String(value)
    if (text.length > 8192 || /[\r\n]/.test(text)) throw pluginError('PLUGIN_NETWORK_BLOCKED', 400)
    result[name] = text
  }
  return result
}

export interface NetworkOptions {
  method?: string
  headers?: Record<string, unknown>
  body?: string | Uint8Array
  signal: AbortSignal
}

declare module 'node:http' {
  interface IncomingMessage {
    /** openNetwork 走完重定向链后的终点 URL，供 serverless 302 直跳使用 */
    finalUrl?: string
  }
}

/** 连接固定到已校验的 DNS 结果，重定向每跳重新校验。 */
export async function openNetwork(input: string, options: NetworkOptions): Promise<IncomingMessage> {
  let url = networkUrl(input)
  let headers = cleanHeaders(options.headers)
  let method = (options.method || 'GET').toUpperCase()
  let body = options.body
  if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'PROPFIND', 'MKCOL', 'MOVE', 'COPY'].includes(method)) throw pluginError('PLUGIN_NETWORK_BLOCKED')
  if (body && Buffer.byteLength(body) > MUSIC_PLUGIN_LIMITS.responseBytes) throw pluginError('PLUGIN_NETWORK_BLOCKED')
  for (let hop = 0; hop <= MUSIC_PLUGIN_LIMITS.redirects; hop++) {
    options.signal.throwIfAborted()
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true })
    options.signal.throwIfAborted()
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address))) throw pluginError('PLUGIN_NETWORK_BLOCKED')
    const address = addresses[0]!
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? https : http).request(url, {
        method, headers, signal: options.signal, agent: false,
        lookup: ((_host: string, opts: any, callback: any) => {
          if (opts?.all) callback(null, [address])
          else callback(null, address.address, address.family)
        }) as any
      }, resolve)
      request.on('error', reject)
      request.end(body)
    })
    if (![301, 302, 303, 307, 308].includes(response.statusCode || 0) || !response.headers.location) {
      response.finalUrl = url.href
      return response
    }
    response.destroy()
    if (hop === MUSIC_PLUGIN_LIMITS.redirects) throw pluginError('PLUGIN_NETWORK_BLOCKED')
    const next = networkUrl(new URL(response.headers.location, url).href)
    if (next.origin !== url.origin) {
      headers = Object.fromEntries(Object.entries(headers).filter(([key]) => !['authorization', 'cookie', 'referer', 'x-api-key'].includes(key)))
    }
    if (response.statusCode === 303 || ([301, 302].includes(response.statusCode!) && method === 'POST')) { method = 'GET'; body = undefined }
    url = next
  }
  throw pluginError('PLUGIN_NETWORK_BLOCKED')
}

/**
 * 走完重定向链解析终点 URL 后即断开，不读取响应体。
 * HEAD 结果仅在 2xx/416 时可直接采信，其余（含 403/405 等拒绝码）回退 GET 探测；拿不到终点返回 null
 */
export async function probeFinalUrl(input: string, options: NetworkOptions): Promise<{ url: string; status: number } | null> {
  const attempt = async (method: string) => {
    const response = await openNetwork(input, { ...options, method })
    const final = response.finalUrl || input
    const status = response.statusCode || 0
    response.destroy()
    return { url: final, status }
  }
  try {
    const head = await attempt('HEAD')
    if ((head.status >= 200 && head.status < 300) || head.status === 416) return head
    return await attempt('GET')
  } catch {
    try { return await attempt('GET') } catch { return null }
  }
}

export async function requestNetwork(input: string, options: NetworkOptions, limit: number = MUSIC_PLUGIN_LIMITS.responseBytes) {
  const response = await openNetwork(input, options)
  const encoding = response.headers['content-encoding']
  const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null
  const stream = decoder ? response.pipe(decoder) : response
  const abort = () => { response.destroy(); stream.destroy() }
  options.signal.addEventListener('abort', abort, { once: true })
  response.on('error', (error) => { if (decoder) decoder.destroy(error) })
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of stream) {
      size += chunk.length
      if (size > limit) throw pluginError('PLUGIN_NETWORK_BLOCKED')
      chunks.push(Buffer.from(chunk))
    }
    options.signal.throwIfAborted()
    return { status: response.statusCode || 0, headers: response.headers, bytes: Buffer.concat(chunks) }
  } finally {
    options.signal.removeEventListener('abort', abort)
    response.destroy()
    decoder?.destroy()
  }
}
