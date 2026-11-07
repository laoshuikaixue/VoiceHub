import bcrypt from 'bcryptjs'
import otplib from 'otplib'
import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users, userIdentities } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getClientIP } from '~~/server/utils/ip-utils'
import { delStore, incrStore } from '~~/server/utils/captchaStore'
import { hasPermission, PRIV_ADMIN_CONSOLE } from '~~/app/utils/admin-permissions'
import {
  PASSWORD_AUDIT_ACTIONS,
  consumePasswordRateLimit,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'
import {
  STEP_UP_TOTP_FAILURE_LIMIT,
  STEP_UP_TOTP_FAILURE_WINDOW_SECONDS,
  isStepUpReason,
  issueStepUpWindow
} from '~~/server/utils/step-up'

const { authenticator } = otplib

const STEP_UP_VERIFY_LIMIT = 5

// 敏感操作二次验证：校验当前账号凭据后签发短期特权窗口，窗口只认服务端状态、不返回令牌
export default defineEventHandler(async (event) => {
  const operator = event.context.user
  if (!operator) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '未授权访问')
  }
  if (!hasPermission(operator.perms ?? [], PRIV_ADMIN_CONSOLE)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '权限不足')
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const reason = typeof body?.reason === 'string' ? body.reason : ''
  if (!isStepUpReason(reason)) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.PERMISSION_STEP_UP_REASON_INVALID,
      '不支持的验证场景'
    )
  }

  const password = typeof body?.password === 'string' ? body.password : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!password) {
    throw createApiError(400, SERVER_ERROR_CODES.USER_PASSWORD_REQUIRED, '请输入当前密码')
  }

  const clientIp = getClientIP(event)
  const auditAction = PASSWORD_AUDIT_ACTIONS.STEP_UP
  const rateLimit = await consumePasswordRateLimit(operator.id, clientIp, auditAction, STEP_UP_VERIFY_LIMIT)
  if (!rateLimit.allowed) {
    await recordPasswordAudit(event, operator.id, auditAction, false, '操作频率超过限制')
    setResponseHeader(event, 'Retry-After', String(rateLimit.retryAfterSeconds))
    throw createApiError(
      429,
      SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS,
      `验证次数过多，请在 ${Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60))} 分钟后重试`,
      { params: [String(rateLimit.retryAfterSeconds)] }
    )
  }

  const [target] = await db
    .select({ id: users.id, password: users.password, status: users.status })
    .from(users)
    .where(eq(users.id, operator.id))
    .limit(1)
  if (!target || target.status !== 'active') {
    await recordPasswordAudit(event, operator.id, auditAction, false, '账号不可用')
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_ACCOUNT_DISABLED_OR_RESTRICTED, '账号不可用')
  }

  if (!(await bcrypt.compare(password, target.password))) {
    await recordPasswordAudit(event, operator.id, auditAction, false, '密码错误')
    // 凭据错误返回 403 而非 401，避免触发前端全局登出
    throw createApiError(403, SERVER_ERROR_CODES.PERMISSION_STEP_UP_FAILED, '密码错误')
  }

  const totpIdentity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, operator.id), eq(userIdentities.provider, 'totp'))
  })

  if (totpIdentity) {
    if (!code) {
      await recordPasswordAudit(event, operator.id, auditAction, false, '缺少动态验证码')
      throw createApiError(400, SERVER_ERROR_CODES.AUTH_MISSING_REQUIRED_PARAMS, '请输入动态验证码')
    }

    // 先占用验证额度，防止并发请求同时绕过失败次数限制
    const userFailureKey = `step-up_totp_user:${operator.id}`
    const ipFailureKey = `step-up_totp_ip:${clientIp}`
    const [userFailureCount, ipFailureCount] = await Promise.all([
      incrStore(userFailureKey, STEP_UP_TOTP_FAILURE_WINDOW_SECONDS),
      incrStore(ipFailureKey, STEP_UP_TOTP_FAILURE_WINDOW_SECONDS)
    ])
    if (
      userFailureCount > STEP_UP_TOTP_FAILURE_LIMIT ||
      ipFailureCount > STEP_UP_TOTP_FAILURE_LIMIT
    ) {
      await recordPasswordAudit(event, operator.id, auditAction, false, '动态验证码尝试次数超限')
      throw createApiError(
        429,
        SERVER_ERROR_CODES.AUTH_TOTP_TOO_MANY_ATTEMPTS,
        '动态验证码错误次数过多，请在 5 分钟后重试'
      )
    }

    if (!authenticator.check(code, totpIdentity.providerUserId)) {
      await recordPasswordAudit(event, operator.id, auditAction, false, '动态验证码错误')
      throw createApiError(400, SERVER_ERROR_CODES.AUTH_TOTP_CODE_INVALID, '动态验证码错误')
    }

    await Promise.all([delStore(userFailureKey), delStore(ipFailureKey)])
  }

  const expiresIn = await issueStepUpWindow(event, reason)
  await recordPasswordAudit(event, operator.id, auditAction, true)

  return { success: true, reason, expiresIn }
})
