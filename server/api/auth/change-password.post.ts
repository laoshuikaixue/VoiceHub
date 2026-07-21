import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { recordLoginFailure, recordLoginSuccess } from '../../services/securityService'
import { updateUserPassword } from '../../services/userService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { isSecureRequest } from '~~/server/utils/request-utils'
import { validatePasswordPolicy } from '~/utils/password-policy'
import {
  PASSWORD_AUDIT_ACTIONS,
  consumePasswordRateLimit,
  getPasswordAuditContext,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'

export default defineEventHandler(async (event) => {
  // 验证用户身份
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权'
    })
  }

  const auditAction = PASSWORD_AUDIT_ACTIONS.CHANGE_PASSWORD
  const clientIp = getClientIP(event)

  const body = await readBody<Record<string, unknown> | null>(event)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || !newPassword) {
    await recordPasswordAudit(event, user.id, auditAction, false, '缺少当前密码或新密码')
    throw createError({
      statusCode: 400,
      message: '当前密码和新密码都是必需的'
    })
  }

  const rateLimit = await consumePasswordRateLimit(user.id, clientIp, auditAction, 10)
  if (!rateLimit.allowed) {
    await recordPasswordAudit(event, user.id, auditAction, false, '操作频率超过限制')
    setResponseHeader(event, 'Retry-After', String(rateLimit.retryAfterSeconds))
    const retryAfterMinutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60))
    throw createError({
      statusCode: 429,
      message: `密码修改尝试过于频繁，请 ${retryAfterMinutes} 分钟后再试`
    })
  }

  const policyError = validatePasswordPolicy(newPassword)
  if (policyError) {
    await recordPasswordAudit(event, user.id, auditAction, false, policyError)
    throw createError({ statusCode: 400, message: policyError })
  }

  let passwordUpdated = false
  try {
    // 查询用户详细信息
    const userDetailsResult = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        tokenVersion: users.tokenVersion
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    const userDetails = userDetailsResult[0]

    if (!userDetails) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 验证当前密码
    if (!userDetails.password) {
      throw createError({
        statusCode: 400,
        message: '当前账号尚未设置密码，请使用初始密码设置功能'
      })
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, userDetails.password)

    if (!isPasswordValid) {
      // 记录安全事件
      await recordLoginFailure(userDetails.username, clientIp)

      throw createError({
        statusCode: 400,
        message: '当前密码不正确'
      })
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, userDetails.password)
    if (isSamePassword) {
      throw createError({
        statusCode: 400,
        message: '新密码不能与当前密码相同'
      })
    }

    // 更新密码
    const { passwordChangedAt, tokenVersion } = await updateUserPassword(user.id, newPassword, {
      expectedTokenVersion: userDetails.tokenVersion,
      auditContext: { action: auditAction, ...getPasswordAuditContext(event) }
    })
    passwordUpdated = true

    // 密码变更会让旧令牌失效，因此为当前已验证会话立即换发令牌。
    const newToken = JWTEnhanced.generateToken(user.id, user.role, tokenVersion)
    setCookie(event, 'auth-token', newToken, {
      httpOnly: true,
      secure: isSecureRequest(event),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    // 记录成功的密码修改
    await recordLoginSuccess(userDetails.username, clientIp)

    return {
      success: true,
      message: '密码修改成功',
      passwordChangedAt
    }
  } catch (error: any) {
    if (!passwordUpdated) {
      await recordPasswordAudit(event, user.id, auditAction, false, error.message || '密码修改失败')
    }

    // 已格式化的错误直接抛出
    if (error.statusCode) {
      throw error
    }

    // 记录错误信息
    console.error('修改密码过程中发生未处理的错误:', error)

    // 创建错误响应
    throw createError({
      statusCode: 500,
      message: '修改密码失败: ' + (error.message || '未知错误')
    })
  }
})
