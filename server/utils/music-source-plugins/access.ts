import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { pluginError } from './errors'
import { createApiError } from '../apiError'
import { SERVER_ERROR_CODES } from '../../config/constants'
import { checkDistributedRateLimit } from '../rateLimiter'
import { getClientIP } from '../ip-utils'

export async function pluginAccess(event: H3Event, admin = false) {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '请先登录')
  if (admin && user.role !== 'SUPER_ADMIN') throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '需要超级管理员权限')
  if (admin && !['GET', 'HEAD'].includes(event.method)) {
    const origin = getRequestHeader(event, 'origin')
    // 与 api-cors 中间件保持一致：反代可能改写 Host，此时以 x-forwarded-host 为准
    const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host')
    try { if (origin && new URL(origin).host !== (host?.split(',')[0] || '').trim()) throw new Error('来源不匹配') }
    catch { throw pluginError('PLUGIN_INVALID_CONFIG', 403) }
  }
  for (const key of [`user:${user.id}`, `ip:${getClientIP(event)}`]) {
    const limit = await checkDistributedRateLimit(`music-plugins:${admin ? 'admin' : 'call'}:${key}`, admin ? 60 : 90, 60000)
    if (!limit.isAllowed) throw createApiError(429, SERVER_ERROR_CODES.COMMON_RATE_LIMITED_SECONDS, '请求过于频繁', { params: [60] })
  }
  return user
}
