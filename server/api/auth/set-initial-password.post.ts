import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { updateUserPassword } from '~~/server/services/userService'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { isSecureRequest } from '~~/server/utils/request-utils'
import { validatePasswordPolicy } from '~/utils/password-policy'
import { getClientIP } from '~~/server/utils/ip-utils'
import { canSetInitialPassword } from '~~/server/utils/initial-password-policy'
import {
  PASSWORD_AUDIT_ACTIONS,
  consumePasswordRateLimit,
  getPasswordAuditContext,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权' })
  }

  const auditAction = PASSWORD_AUDIT_ACTIONS.INITIAL_PASSWORD
  const body = await readBody<Record<string, unknown> | null>(event)
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!newPassword) {
    await recordPasswordAudit(event, user.id, auditAction, false, '新密码为空')
    throw createError({ statusCode: 400, message: '新密码不能为空' })
  }

  const clientIp = getClientIP(event)
  const rateLimit = await consumePasswordRateLimit(user.id, clientIp, auditAction, 5)
  if (!rateLimit.allowed) {
    await recordPasswordAudit(event, user.id, auditAction, false, '操作频率超过限制')
    setResponseHeader(event, 'Retry-After', String(rateLimit.retryAfterSeconds))
    const retryAfterMinutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60))
    throw createError({
      statusCode: 429,
      message: `初始密码设置尝试过于频繁，请 ${retryAfterMinutes} 分钟后再试`
    })
  }

  const policyError = validatePasswordPolicy(newPassword)
  if (policyError) {
    await recordPasswordAudit(event, user.id, auditAction, false, policyError)
    throw createError({ statusCode: 400, message: policyError })
  }

  let passwordUpdated = false
  try {
    const currentUserResult = await db
      .select({
        password: users.password,
        passwordChangedAt: users.passwordChangedAt
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    const currentUser = currentUserResult[0]
    if (!currentUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 已完成初始设置的账号必须通过需要旧密码的修改流程。
    if (currentUser.passwordChangedAt) {
      throw createError({
        statusCode: 400,
        message: '您已经设置过密码，请使用修改密码功能'
      })
    }

    if (!canSetInitialPassword(user, currentUser)) {
      throw createError({
        statusCode: 403,
        message: '当前账号不需要设置初始密码，请使用修改密码功能'
      })
    }

    // OAuth 账号可能没有可用于比对的旧密码，不能把 null 传给 bcrypt。
    if (currentUser.password && await bcrypt.compare(newPassword, currentUser.password)) {
      throw createError({ statusCode: 400, message: '新密码不能与当前密码相同' })
    }

    const { passwordChangedAt, tokenVersion } = await updateUserPassword(
      user.id,
      newPassword,
      false,
      { action: auditAction, ...getPasswordAuditContext(event) }
    )
    passwordUpdated = true

    const newToken = JWTEnhanced.generateToken(user.id, user.role, tokenVersion)
    setCookie(event, 'auth-token', newToken, {
      httpOnly: true,
      secure: isSecureRequest(event),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return {
      success: true,
      message: '初始密码设置成功',
      passwordChangedAt
    }
  } catch (error: any) {
    if (!passwordUpdated) {
      await recordPasswordAudit(
        event,
        user.id,
        auditAction,
        false,
        error.message || '初始密码设置失败'
      )
    }

    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: error.message || '初始密码设置失败' })
  }
})
