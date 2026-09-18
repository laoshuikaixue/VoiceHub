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

export function publicAddress(address: string): boolean {
  try {
    let ip: ipaddr.IPv4 | ipaddr.IPv6 = ipaddr.parse(address)
    if (ip.kind() === 'ipv6') {
      const embedded = ip.isIPv4MappedAddress() ? ip.toIPv4Address() : ipv4CompatibleAddress(ip.toByteArray())
      if (embedded && embedded.kind() === 'ipv4') ip = embedded
    }
    return ip.range() === 'unicast'
  } catch { return false }
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
    if (![301, 302, 303, 307, 308].includes(response.statusCode || 0) || !response.headers.location) return response
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
