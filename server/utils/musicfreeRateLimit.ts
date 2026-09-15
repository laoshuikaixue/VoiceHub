import type { H3Event } from 'h3'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerTimestamp } from '~~/server/utils/serverTime'

const WINDOW_MS = 60 * 1000

/**
 * 未鉴权的 MusicFree 端点统一按 IP 限流。
 * 这些端点会把请求扇出到全部插件并发起出站调用，不限流会被当作出站请求放大器刷接口。
 */
export const enforceMusicFreeRateLimit = async (
  event: H3Event,
  scope: string,
  limit: number,
  message: string
): Promise<void> => {
  const result = await checkDistributedRateLimit(`musicfree-${scope}:${getClientIP(event)}`, limit, WINDOW_MS)
  if (result.isAllowed) return
  const waitSeconds = Math.max(1, Math.ceil((result.resetTime - getServerTimestamp()) / 1000))
  throw createApiError(429, SERVER_ERROR_CODES.COMMON_RATE_LIMITED_SECONDS, message, { params: [waitSeconds] })
}
