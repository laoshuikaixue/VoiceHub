import { isIP } from 'node:net'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { publicAddress } from '~~/server/utils/music-source-plugins/network'

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

/**
 * 校验备份目标地址（WebDAV url / S3 endpoint）：
 * 仅 http/https、拒绝内嵌凭据、硬性拦截云元数据端点与内部管理域名。
 * 私网地址默认放行（校园网内 NAS / 私有化 S3 是常见部署形态）；
 * 设 BACKUP_BLOCK_PRIVATE_NETWORK=true 时收紧为非公网即拒。
 * 不合法直接抛 createApiError。
 */
export function assertSafeOutboundUrl(rawUrl: unknown, field = 'url'): void {
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

  if (
    process.env.BACKUP_BLOCK_PRIVATE_NETWORK === 'true' &&
    isIP(host) &&
    !publicAddress(host)
  ) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 指向被禁止的私网地址`)
  }
}
