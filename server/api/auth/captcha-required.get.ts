import { defineEventHandler, getQuery } from 'h3'
import { isPasswordLoginCaptchaRequired } from '~~/server/services/securityService'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getClientIP } from '~~/server/utils/ip-utils'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'

// 单 IP 预检频率限制，防止利用本接口探测失败计数
const PRECHECK_LIMIT = 120
const PRECHECK_WINDOW_MS = 10 * 60 * 1000

/**
 * 登录验证码预检：返回当前用户名/IP 组合是否会被要求图形验证码。
 * 仅返回布尔值，不暴露失败计数；前端用于刷新后提前恢复验证码显示。
 */
export default defineEventHandler(async (event) => {
  const clientIp = getClientIP(event)
  const limitResult = await checkDistributedRateLimit(
    `captcha_precheck:${clientIp}`,
    PRECHECK_LIMIT,
    PRECHECK_WINDOW_MS
  )
  if (!limitResult.isAllowed) {
    const waitMinutes = Math.ceil((limitResult.resetTime - getServerTimestamp()) / 60000)
    throw createApiError(
      429,
      SERVER_ERROR_CODES.AUTH_RATE_LIMITED_MINUTES,
      `操作过于频繁，请等待 ${waitMinutes} 分钟后再试`,
      { params: [waitMinutes] }
    )
  }

  const query = getQuery(event)
  const username = typeof query.username === 'string' ? query.username.trim() : ''
  if (!username || username.length > 64) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '用户名不能为空')
  }

  const captchaRequired = await isPasswordLoginCaptchaRequired(username, clientIp)
  return { captchaRequired }
})
