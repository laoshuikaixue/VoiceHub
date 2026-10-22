import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export function parseScheduleDateQuery(value: unknown) {
  if (value === undefined) return null

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '日期必须为有效的 YYYY-MM-DD 格式')
  }

  // 排期日期存为 UTC 零点，不按服务器本地时区解释。
  const startOfDay = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(startOfDay.getTime()) || startOfDay.toISOString().slice(0, 10) !== value) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '日期必须为有效的 YYYY-MM-DD 格式')
  }

  const endOfDay = new Date(startOfDay)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)
  return { startOfDay, endOfDay }
}
