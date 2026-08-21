import { setResponseHeader, type H3Event } from 'h3'
import { SERVER_ERROR_CODES } from '#server/config/constants'
import { createApiError } from '#server/utils/apiError'
import { getClientIP } from '#server/utils/ip-utils'
import { checkDistributedRateLimit } from '#server/utils/rateLimiter'
import { getServerTimestamp } from '#server/utils/serverTime'

const USER_BURST_LIMIT = 5
const USER_BURST_WINDOW_MS = 60 * 1000
const USER_HOURLY_LIMIT = 20
const USER_HOURLY_WINDOW_MS = 60 * 60 * 1000
const IP_HOURLY_LIMIT = 100
const IP_HOURLY_WINDOW_MS = 60 * 60 * 1000

const throwRateLimitError = (event: H3Event, resetTime: number): never => {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - getServerTimestamp()) / 1000))
  const waitText =
    retryAfterSeconds >= 60
      ? `${Math.ceil(retryAfterSeconds / 60)} 分钟`
      : `${retryAfterSeconds} 秒`

  setResponseHeader(event, 'Retry-After', String(retryAfterSeconds))
  throw createApiError(
    429,
    SERVER_ERROR_CODES.CARD_CODE_RATE_LIMITED,
    `卡密兑换请求过于频繁，请等待 ${waitText} 后再试`,
    { params: [waitText] }
  )
}

export const enforceCardCodeRedemptionRateLimit = async (event: H3Event, userId: number) => {
  const clientIP = getClientIP(event)

  const burstResult = await checkDistributedRateLimit(
    `card_code_redeem_user_burst:${userId}`,
    USER_BURST_LIMIT,
    USER_BURST_WINDOW_MS
  )
  if (!burstResult.isAllowed) {
    throwRateLimitError(event, burstResult.resetTime)
  }

  const hourlyResult = await checkDistributedRateLimit(
    `card_code_redeem_user_hourly:${userId}`,
    USER_HOURLY_LIMIT,
    USER_HOURLY_WINDOW_MS
  )
  if (!hourlyResult.isAllowed) {
    throwRateLimitError(event, hourlyResult.resetTime)
  }

  if (clientIP !== 'unknown') {
    const ipResult = await checkDistributedRateLimit(
      `card_code_redeem_ip_hourly:${clientIP}`,
      IP_HOURLY_LIMIT,
      IP_HOURLY_WINDOW_MS
    )
    if (!ipResult.isAllowed) {
      throwRateLimitError(event, ipResult.resetTime)
    }
  }
}