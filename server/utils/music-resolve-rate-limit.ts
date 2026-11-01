import type { H3Event } from 'h3'
import { createApiError } from './apiError'
import { SERVER_ERROR_CODES } from '../config/constants'
import { checkDistributedRateLimit } from './rateLimiter'
import { getServerTimestamp } from './serverTime'
import { getClientIP } from './ip-utils'

const ANONYMOUS_RESOLVE_LIMIT = 10
const ANONYMOUS_RESOLVE_WINDOW_MS = 60 * 1000

/** 匿名取链入口共用同一 IP 计数。 */
export async function enforceAnonymousMusicResolveRateLimit(event: H3Event): Promise<void> {
  if (event.context.user) return
  const result = await checkDistributedRateLimit(
    `music_resolve_url_ip:${getClientIP(event)}`,
    ANONYMOUS_RESOLVE_LIMIT,
    ANONYMOUS_RESOLVE_WINDOW_MS
  )
  if (result.isAllowed) return
  const waitSeconds = Math.max(1, Math.ceil((result.resetTime - getServerTimestamp()) / 1000))
  throw createApiError(
    429,
    SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS,
    `播放链接解析过于频繁，请等待 ${waitSeconds} 秒后再试`,
    { params: [waitSeconds] }
  )
}
