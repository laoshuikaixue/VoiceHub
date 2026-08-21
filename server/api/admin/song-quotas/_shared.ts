import type { H3Event } from 'h3'
import { z } from 'zod'
import { SERVER_ERROR_CODES } from '#server/config/constants'
import { createApiError } from '#server/utils/apiError'

const ADMINISTRATOR_ROLES = ['ADMIN', 'SUPER_ADMIN']
const QUOTA_TYPES = ['PERIODIC', 'PERMANENT'] as const
const QUOTA_SOURCES = [
  'PERIOD_EXPIRED',
  'PERIOD_GRANT',
  'ADMIN_ADJUST',
  'ADMIN_BULK_ADJUST',
  'OPEN_API_ADJUST',
  'SONG_REQUEST',
  'SONG_WITHDRAW_RETURN',
  'SONG_WITHDRAW_EXPIRED',
  'LEGACY_CARD_CONVERT'
] as const

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional()
const positiveIntegerQuery = (fallback: number, maximum: number) =>
  z.preprocess(
    (value) => value === undefined ? fallback : value,
    z.coerce.number().int().min(1).max(maximum)
  )
const optionalDate = z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional()

export const adminSongQuotaAccountQuerySchema = z.object({
  page: positiveIntegerQuery(1, 1_000_000),
  limit: positiveIntegerQuery(20, 100),
  search: optionalText(100)
}).strict()

export const adminSongQuotaAdjustmentSchema = z.object({
  userId: z.number().int().positive().max(2_147_483_647),
  operation: z.enum(['INCREMENT', 'DECREMENT', 'SET']),
  amount: z.number().int().min(0).max(1_000_000),
  requestId: z.string().trim().min(8).max(128),
  publicDescription: optionalText(500),
  internalNote: optionalText(2000)
}).strict().superRefine((value, context) => {
  if (value.operation !== 'SET' && value.amount === 0) {
    context.addIssue({ code: 'custom', path: ['amount'], message: '增减额度必须大于零' })
  }
})

export const adminSongQuotaTransactionQuerySchema = z.object({
  page: positiveIntegerQuery(1, 1_000_000),
  limit: positiveIntegerQuery(20, 100),
  userId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
  administratorId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
  quotaType: z.enum(QUOTA_TYPES).optional(),
  source: z.enum(QUOTA_SOURCES).optional(),
  from: optionalDate,
  to: optionalDate
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: 'custom', path: ['to'], message: '结束时间不能早于开始时间' })
  }
})

export function requireSongQuotaAdministrator(event: H3Event) {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '需要登录')
  if (!ADMINISTRATOR_ROLES.includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要系统管理员权限')
  }
  return user
}

export function throwInvalidSongQuotaInput(): never {
  throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '额度请求参数错误')
}
