import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { setResponseHeader, type H3Event } from 'h3'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getServerTimestamp } from '~~/server/utils/serverTime'

const createCardCodeError = (statusCode: number, code: string, message: string) =>
  createError({
    statusCode,
    statusMessage: code,
    message,
    data: { code }
  })
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
  throw createError({
    statusCode: 429,
    message: `点歌券验证请求过于频繁，请等待 ${waitText} 后再试`
  })
}

const enforceValidationRateLimit = async (event: H3Event, userId: number) => {
  const clientIP = getClientIP(event)

  const burstResult = await checkDistributedRateLimit(
    `card_code_validate_user_burst:${userId}`,
    USER_BURST_LIMIT,
    USER_BURST_WINDOW_MS
  )
  if (!burstResult.isAllowed) {
    throwRateLimitError(event, burstResult.resetTime)
  }

  const hourlyResult = await checkDistributedRateLimit(
    `card_code_validate_user_hourly:${userId}`,
    USER_HOURLY_LIMIT,
    USER_HOURLY_WINDOW_MS
  )
  if (!hourlyResult.isAllowed) {
    throwRateLimitError(event, hourlyResult.resetTime)
  }

  if (clientIP !== 'unknown') {
    const ipResult = await checkDistributedRateLimit(
      `card_code_validate_ip_hourly:${clientIP}`,
      IP_HOURLY_LIMIT,
      IP_HOURLY_WINDOW_MS
    )
    if (!ipResult.isAllowed) {
      throwRateLimitError(event, ipResult.resetTime)
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createCardCodeError(401, 'CARD_CODE_AUTH_REQUIRED', 'Sign in to validate request card')
  }

  await enforceValidationRateLimit(event, user.id)

  const body = (await readBody(event)) || {}
  const code = typeof body.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
  if (!code) {
    throw createCardCodeError(400, 'CARD_CODE_REQUIRED', 'Request card is required')
  }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const settings = await getSystemSettingsCached()
  const enabled = !!(settings?.enableCardCodeRequests || settings?.requireCardCodeForRequests)
  if (!enabled && !isAdmin) {
    throw createCardCodeError(400, 'CARD_CODE_DISABLED', 'Request card submissions are not enabled')
  }

  const rows = await db
    .select({
      id: cardCodes.id,
      status: cardCodes.status
    })
    .from(cardCodes)
    .where(eq(cardCodes.code, code))
    .limit(1)

  const found = rows[0]
  if (!found || found.status !== 'AVAILABLE') {
    throw createCardCodeError(400, 'CARD_CODE_INVALID_OR_USED', 'Request card is invalid or already used')
  }

  return {
    valid: true,
    code: 'CARD_CODE_AVAILABLE',
    message: 'Request card available'
  }
})
