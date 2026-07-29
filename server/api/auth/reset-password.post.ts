import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { updateUserPassword } from '~~/server/services/userService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { getPasswordPolicyViolation } from '~/utils/password-policy'
import {
  PASSWORD_AUDIT_ACTIONS,
  getPasswordAuditContext,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'

export default defineEventHandler(async (event) => {
  const clientIP = getClientIP(event)

  // IP 级别限流：每小时最多 10 次密码重置尝试
  const rateLimitKey = `reset_password_ip:${clientIP}`
  const limitResult = await checkDistributedRateLimit(rateLimitKey, 10, 60 * 60 * 1000)

  if (!limitResult.isAllowed) {
    const waitMinutes = Math.ceil((limitResult.resetTime - getServerTimestamp()) / 60000)
    throw createApiError(
      429,
      'AUTH_RESET_PASSWORD_TOO_MANY',
      `重置密码尝试次数过多，请等待 ${waitMinutes} 分钟后再试`,
      { params: [waitMinutes] }
    )
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const token = typeof body?.token === 'string' ? body.token : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!token || !newPassword) {
    throw createApiError(400, 'AUTH_INCOMPLETE_PARAMS', '参数不完整')
  }

  const policyViolation = getPasswordPolicyViolation(newPassword)
  if (policyViolation) {
    throw createApiError(400, policyViolation.code, policyViolation.message)
  }

  let auditUserId: number | null = null
  let passwordUpdated = false
  try {
    // 验证并解码token
    const decoded = JWTEnhanced.verify(token) as any

    if (decoded.type !== 'password_reset' || !decoded.userId || !decoded.hash) {
      throw createApiError(400, 'AUTH_INVALID_RESET_LINK', '无效的重置链接')
    }

    // 获取最新用户信息
    const userResult = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)
    const user = userResult[0]

    if (!user) {
      throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
    }
    auditUserId = user.id

    // 验证 hash 是否匹配当前密码的前10位
    // 如果用户已经修改过密码，则 user.password 发生变化，旧 token 失效
    if (user.password.substring(0, 10) !== decoded.hash) {
      throw createApiError(400, 'AUTH_RESET_LINK_INVALIDATED', '该重置链接已失效（密码已被修改）')
    }

    // 更新密码
    await updateUserPassword(user.id, newPassword, {
      expectedTokenVersion: user.tokenVersion,
      auditContext: {
        action: PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD,
        ...getPasswordAuditContext(event)
      }
    })
    passwordUpdated = true

    return { success: true, message: '密码重置成功，请使用新密码登录' }
  } catch (error: any) {
    if (auditUserId && !passwordUpdated) {
      await recordPasswordAudit(
        event,
        auditUserId,
        PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD,
        false,
        error.message || '重置密码失败'
      )
    }
    if (error.name === 'TokenExpiredError') {
      throw createApiError(400, 'AUTH_RESET_LINK_EXPIRED', '重置链接已过期，请重新申请')
    }
    if (error.statusCode) throw error
    throw createApiError(400, 'AUTH_INVALID_RESET_LINK', '无效的重置链接')
  }
})
