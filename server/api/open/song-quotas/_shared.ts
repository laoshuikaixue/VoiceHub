import { setResponseHeader, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, users } from '~/drizzle/db'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getServerTimestamp } from '~~/server/utils/serverTime'

const positiveUserId = z.coerce.number().int().positive().max(2_147_483_647)
const positiveIntegerQuery = (fallback: number, maximum: number) =>
  z.preprocess(
    (value) => value === undefined ? fallback : value,
    z.coerce.number().int().min(1).max(maximum)
  )
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional()

export const openSongQuotaAccountQuerySchema = z.object({
  userId: positiveUserId
}).strict()

export const openSongQuotaTransactionQuerySchema = z.object({
  userId: positiveUserId,
  page: positiveIntegerQuery(1, 1_000_000),
  limit: positiveIntegerQuery(20, 100)
}).strict()

export const openSongQuotaAdjustmentSchema = z.object({
  userId: z.number().int().positive().max(2_147_483_647),
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  externalReference: optionalText(200),
  publicDescription: optionalText(500),
  internalNote: optionalText(2000)
}).strict()

export function requireOpenSongQuotaApiKey(event: H3Event) {
  const apiKey = event.context.apiKey
  if (!apiKey) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, 'API 认证失败')
  return apiKey
}

export async function requireOpenSongQuotaUser(userId: number) {
  const rows = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const user = rows[0]
  if (!user) throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
  if (user.status !== 'active') {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '目标用户不可用')
  }
  return user
}

export async function enforceOpenSongQuotaRateLimit(event: H3Event, apiKeyId: string, userId: number) {
  const limits: Array<[string, number, number]> = [
    [`open_song_quota_key:${apiKeyId}`, 120, 60 * 1000],
    [`open_song_quota_user:${userId}`, 60, 60 * 1000]
  ]
  const clientIP = getClientIP(event)
  if (clientIP !== 'unknown') limits.push([`open_song_quota_ip:${clientIP}`, 300, 60 * 1000])

  for (const [key, limit, windowMs] of limits) {
    const result = await checkDistributedRateLimit(key, limit, windowMs)
    if (!result.isAllowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetTime - getServerTimestamp()) / 1000))
      setResponseHeader(event, 'Retry-After', retryAfter)
      throw createApiError(429, SERVER_ERROR_CODES.SONG_QUOTA_RATE_LIMITED, '额度 API 请求过于频繁')
    }
  }
}

export function throwInvalidOpenSongQuotaInput(): never {
  throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '额度请求参数错误')
}
