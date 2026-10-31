import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { publicAddress, unacceptableAddress } from '~~/server/utils/music-source-plugins/network'

// 云元数据服务地址：请求可直接读出实例临时云凭证，任何情况都禁止服务端访问
const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
  'fd00:ec2::254',
  '192.0.0.192',
  'metadata',
  'metadata.google.internal'
])

// 内部管理域名后缀
const BLOCKED_DOMAIN_SUFFIXES = ['.internal', '.local', '.localhost', '.cluster.local']

// 私网是否额外禁止：默认放行，由环境变量收紧
const blockPrivateNetwork = () => process.env.BACKUP_BLOCK_PRIVATE_NETWORK === 'true'

/**
 * 复核已解析出的目标地址：
 * 链路本地/组播/保留等段任何情况都拒（云元数据落在链路本地段）；
 * BACKUP_BLOCK_PRIVATE_NETWORK=true 时进一步收紧为非公网即拒。
 */
export function assertResolvedOutboundAddresses(
  addresses: readonly string[],
  field = 'url'
): void {
  for (const address of addresses) {
    const normalized = address.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
    if (BLOCKED_METADATA_HOSTS.has(normalized) || unacceptableAddress(normalized)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 指向被禁止的元数据或内部地址`)
    }
    if (blockPrivateNetwork() && !publicAddress(normalized)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 指向被禁止的私网地址`)
    }
  }
}

/**
 * 校验备份目标地址（WebDAV url / S3 endpoint）：
 * 仅 http/https、拒内嵌凭据、硬性拦截云元数据端点与内部管理域名，
 * 并对域名做 DNS 解析后复核（阻止用域名指向元数据地址绕过字面黑名单）。
 * 私网地址默认放行（校园网内 NAS / 私有化 S3 是常见部署形态）；
 * 设 BACKUP_BLOCK_PRIVATE_NETWORK=true 时收紧为非公网即拒。
 * 解析失败维持放行（目标主机可先存配置后上线）。不合法直接抛 createApiError。
 */
export async function assertSafeOutboundUrl(rawUrl: unknown, field = 'url'): Promise<void> {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!value) return // 空值交由各端点的必填校验处理

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 不是合法的 URL`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 仅允许 http/https`)
  }

  // 拒绝 URL 内嵌用户名密码，避免凭据泄漏到日志/异常信息
  if (url.username || url.password) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 不得包含内嵌的用户名或密码`)
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (BLOCKED_METADATA_HOSTS.has(host)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 指向被禁止的元数据或内部地址`)
  }
  if (BLOCKED_DOMAIN_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 指向被禁止的内部管理域名`)
  }

  // 字面 IP 直接判定；域名必须解析后再判，否则一条 A 记录即可绕过上面的黑名单
  if (isIP(host)) {
    assertResolvedOutboundAddresses([host], field)
    return
  }

  let resolved: Array<{ address: string }>
  try {
    resolved = await lookup(host, { all: true, verbatim: true })
  } catch (error: any) {
    // 目标主机可能尚未上线（先存配置后接 NAS），解析失败维持放行
    console.warn(`[OutboundUrl] ${host} DNS 解析失败，跳过地址复核:`, error?.message || error)
    return
  }
  assertResolvedOutboundAddresses(
    resolved.map((item) => item.address),
    field
  )
}

/** 备份请求在实际建连时复核 DNS，并拒绝重定向。 */
export async function fetchSafeOutbound(
  input: string,
  options: {
    method: string
    headers?: Record<string, string>
    body?: string | Uint8Array
    signal?: AbortSignal
  }
): Promise<Response> {
  await assertSafeOutboundUrl(input)
  const url = new URL(input)
  const signal = options.signal ?? AbortSignal.timeout(120_000)
  signal.throwIfAborted()
  const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: options.method,
      headers: { 'accept-encoding': 'identity', ...options.headers },
      signal,
      agent: false,
      lookup: ((host: string, settings: { all?: boolean }, callback: (...args: any[]) => void) => {
        lookup(host, { all: true, verbatim: true }).then((addresses) => {
          signal.throwIfAborted()
          if (!addresses.length) throw new Error('备份目标 DNS 未返回地址')
          assertResolvedOutboundAddresses(addresses.map((item) => item.address))
          if (settings?.all) callback(null, addresses)
          else callback(null, addresses[0].address, addresses[0].family)
        }).catch(callback)
      }) as NonNullable<http.RequestOptions['lookup']>
    }, resolve)
    request.on('error', reject)
    request.end(options.body)
  })

  try {
    const status = response.statusCode || 502
    if (status >= 300 && status < 400 && status !== 304) {
      throw new Error('备份目标发生重定向，请配置最终地址')
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of response) {
      size += chunk.length
      if (size > 1024 * 1024) throw new Error('备份目标响应超过大小限制')
      chunks.push(Buffer.from(chunk))
    }
    signal.throwIfAborted()
    const headers = new Headers()
    for (const [name, value] of Object.entries(response.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
      else if (value !== undefined) headers.set(name, value)
    }
    return new Response([204, 205, 304].includes(status) ? null : new Uint8Array(Buffer.concat(chunks)), {
      status,
      statusText: response.statusMessage,
      headers
    })
  } finally {
    response.destroy()
  }
}
