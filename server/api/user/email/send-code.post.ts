import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SmtpService } from '~~/server/services/smtpService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { delStoreIfValue, hashStateCode, setStore } from '~~/server/utils/captchaStore'
import { randomInt } from 'node:crypto'
import { createApiError } from '~~/server/utils/apiError'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  storeEmailCode,
  isEmailCodeCooldownActive,
  isEmailCodeDailyLimitReached
} from '~~/server/utils/email-verification'

// 与公开发码端点（auth/email-code）同口径；账号维度上限用于防止轮换目标邮箱绕过按邮箱限制
const EMAIL_CODE_IP_LIMIT = 10
const EMAIL_CODE_IP_WINDOW_MS = 60 * 1000
const EMAIL_CODE_USER_LIMIT = 5
const EMAIL_CODE_USER_WINDOW_MS = 10 * 60 * 1000

function generateCode(): string {
  return randomInt(100000, 1000000).toString()
}

export async function sendEmailVerificationCode(
  userId: number,
  email: string,
  name?: string,
  ipAddress?: string
) {
  // IP 维度上限（与公开端点共用同一计数键）
  if (ipAddress && ipAddress !== 'unknown') {
    const ipLimit = await checkDistributedRateLimit(
      `email-code:${ipAddress}`,
      EMAIL_CODE_IP_LIMIT,
      EMAIL_CODE_IP_WINDOW_MS
    )
    if (!ipLimit.isAllowed) {
      const waitSeconds = Math.ceil((ipLimit.resetTime - getServerTimestamp()) / 1000)
      throw createApiError(429, SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS, `操作过于频繁，请 ${waitSeconds} 秒后再试`, { params: [waitSeconds] })
    }
  }

  // 账号维度上限：封住轮换目标邮箱、逐个地址吃满日限的绕过路径
  const userLimit = await checkDistributedRateLimit(
    `email-code:user:${userId}`,
    EMAIL_CODE_USER_LIMIT,
    EMAIL_CODE_USER_WINDOW_MS
  )
  if (!userLimit.isAllowed) {
    const waitSeconds = Math.ceil((userLimit.resetTime - getServerTimestamp()) / 1000)
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS, `操作过于频繁，请 ${waitSeconds} 秒后再试`, { params: [waitSeconds] })
  }

  // 同邮箱 60 秒冷却
  if (await isEmailCodeCooldownActive(email)) {
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_EMAIL_CODE_COOLDOWN, '验证码发送过于频繁，请 1 分钟后再试')
  }

  // 同一邮箱每日发送上限
  if (await isEmailCodeDailyLimitReached(email)) {
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_EMAIL_CODE_DAILY_LIMIT, '今日验证码发送次数已达上限，请明天再试')
  }

  const code = generateCode()
  const expiresAt = getServerTimestamp() + 5 * 60 * 1000
  const stateKey = `email-verify:${userId}`
  const storedValue = JSON.stringify({
    email,
    codeHash: hashStateCode(stateKey, code),
    expiresAt
  })
  await setStore(stateKey, storedValue, 5 * 60)

  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()
  let sent = false
  try {
    sent = await smtp.renderAndSend(
      email,
      'verification.code',
      {
        name: name || '用户',
        email,
        code,
        expiresInMinutes: 5
      },
      ipAddress
    )
  } catch (error) {
    await delStoreIfValue(stateKey, storedValue)
    throw error
  }
  if (!sent) {
    await delStoreIfValue(stateKey, storedValue)
    throw createApiError(500, 'USER_CODE_SEND_FAILED', '验证码发送失败，请稍后重试')
  }

  // 发送成功后才推进同邮箱冷却与每日计数
  await storeEmailCode(email, code)
}

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createApiError(405, 'HTTP_METHOD_NOT_ALLOWED', '方法不被允许')
  }

  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const body = await readBody(event)
  const emailRaw = (body?.email || '').toString().trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRaw || !emailRegex.test(emailRaw)) {
    throw createApiError(400, 'USER_INVALID_EMAIL', '请输入有效的邮箱地址')
  }

  // 确认邮箱未被其他用户占用
  const existing = await db.select().from(users).where(eq(users.email, emailRaw)).limit(1)
  const existingUser = existing[0]
  if (existingUser && existingUser.id !== user.id) {
    throw createApiError(400, 'USER_EMAIL_TAKEN', '该邮箱已被其他用户绑定')
  }

  // 写入/更新邮箱，标记未验证
  await db.update(users).set({ email: emailRaw, emailVerified: false }).where(eq(users.id, user.id))

  // 获取客户端IP地址
  const clientIP = getClientIP(event)

  // 发送邮件验证码
  await sendEmailVerificationCode(user.id, emailRaw, user.name, clientIP)

  return { success: true, message: '验证码已发送，请查收邮箱' }
})
