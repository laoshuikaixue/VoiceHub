import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { SmtpService } from '~~/server/services/smtpService'
import { issueEmailCode, isEmailCodeCooldownActive } from '~~/server/utils/email-verification'

const EMAIL_CODE_IP_LIMIT = 10
const EMAIL_CODE_IP_WINDOW_MS = 60 * 1000

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const clientIp = getClientIP(event)

  if (!email || !EMAIL_REGEX.test(email)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请输入有效的邮箱地址')
  }

  // IP 限流：每分钟最多 10 次
  const limitResult = await checkDistributedRateLimit(`email-code:${clientIp}`, EMAIL_CODE_IP_LIMIT, EMAIL_CODE_IP_WINDOW_MS)
  if (!limitResult.isAllowed) {
    const waitSeconds = Math.ceil((limitResult.resetTime - getServerTimestamp()) / 1000)
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS, `操作过于频繁，请 ${waitSeconds} 秒后再试`, { params: [waitSeconds] })
  }

  // 同邮箱 60 秒冷却
  if (isEmailCodeCooldownActive(email)) {
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_EMAIL_CODE_COOLDOWN, '验证码发送过于频繁，请 1 分钟后再试')
  }

  // 邮件服务可用性检查
  const smtpService = SmtpService.getInstance()
  if (!(await smtpService.ensureInitialized())) {
    throw createApiError(503, SERVER_ERROR_CODES.AUTH_EMAIL_SERVICE_UNAVAILABLE, '邮件服务未配置或不可用，请联系管理员')
  }

  const code = issueEmailCode(email)
  const sent = await smtpService.renderAndSend(email, 'verification', {
    title: 'VoiceHub 注册邮箱验证',
    message: `您的注册邮箱验证码是：${code}，5 分钟内有效。`
  })

  if (!sent) {
    throw createApiError(503, SERVER_ERROR_CODES.AUTH_EMAIL_SERVICE_UNAVAILABLE, '验证码邮件发送失败，请稍后重试')
  }

  return { success: true }
})
