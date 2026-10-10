import { defineEventHandler, getHeader, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken
} from '~~/server/utils/astrbot-notification'
import { getClientIP } from '~~/server/utils/ip-utils'
import {
  adapterToAstrbotPlatform,
  isAstrbotPlatformEnabled,
  isAstrbotPrivateUmoShape
} from '~~/server/utils/astrbot-platforms'
import type { AstrbotPlatform } from '~~/server/utils/astrbot-platforms'
import { enqueueAstrbotNotifications } from '~~/server/services/astrbotOutboxService'
import { updateUserPassword } from '~~/server/services/userService'
import { getPasswordPolicyViolation } from '~/utils/password-policy'
import {
  PASSWORD_AUDIT_ACTIONS,
  consumePasswordRateLimit,
  getPasswordAuditContext,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'
import {
  createPendingPasswordReset,
  consumePendingPasswordReset
} from '~~/server/utils/astrbot-password-reset'

/**
 * 机器人重置密码（两步确认，仅私聊绑定会话）：
 *
 * 第一步 POST { umo, step: 'init', password }：
 *   校验绑定与密码策略后创建 5 分钟 pending，返回 { pendingToken }。
 *   不改密码、不发通知。
 *
 * 第二步 POST { umo, step: 'confirm', pendingToken, password }：
 *   必须携带同一密码（两次输入一致）与未过期的 pendingToken（一次性消费，
 *   由服务端缓存而非插件持有，防伪造）。执行 updateUserPassword（踢旧会话、
 *   bump tokenVersion）、记录 bot 渠道审计，并把成功通知入队到发起 umo
 *   所在渠道（enqueueAstrbotNotifications 按 binding.platform 过滤）。
 *
 * 频控：两步共享 consumePasswordRateLimit（10 分钟窗口）。
 * 错误文案永不回显密码。
 */

function readPassword(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled,
      platforms: systemSettings.astrbotPlatforms
    })
    .from(systemSettings)
    .limit(1)

  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const umo: unknown = body?.umo

  if (!isAstrbotPrivateUmoShape(umo)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '私聊会话无效')
  }

  const step = body?.step === 'confirm' ? 'confirm' : 'init'

  const pendingToken = readPassword(body?.pendingToken)
  const password = readPassword(body?.password)
  if (!password || password.length > 128) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请提供 128 字符以内的新密码')
  }

  // 校验绑定状态：总开关 + 平台开关 + 适配器归类（与其余 bot 端点同口径）
  const [binding] = await db
    .select({ userId: astrbotBindings.userId, platform: astrbotBindings.platform, adapter: astrbotBindings.adapter })
    .from(astrbotBindings)
    .where(eq(astrbotBindings.umo, umo))
    .limit(1)
  if (!binding || !isAstrbotPlatformEnabled(settings.platforms, binding.platform) ||
    adapterToAstrbotPlatform(binding.adapter) !== binding.platform) {
    throw createApiError(403, SERVER_ERROR_CODES.ASTRBOT_UMO_UNBOUND, '该会话未绑定 VoiceHub 账号')
  }

  const auditAction = PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD
  const rateLimit = await consumePasswordRateLimit(binding.userId, getClientIP(event), auditAction, 10)
  if (!rateLimit.allowed) {
    await recordPasswordAudit(event, binding.userId, auditAction, false, '操作频率超过限制')
    const retryAfterMinutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60))
    throw createApiError(
      429,
      SERVER_ERROR_CODES.AUTH_RATE_LIMITED_MINUTES,
      `重置密码尝试过于频繁，请 ${retryAfterMinutes} 分钟后再试`,
      { params: [retryAfterMinutes] }
    )
  }

  // 密码策略：与站点注册/改密同源
  const policyViolation = getPasswordPolicyViolation(password)
  if (policyViolation) {
    await recordPasswordAudit(event, binding.userId, auditAction, false, policyViolation.message)
    throw createApiError(400, policyViolation.code, policyViolation.message)
  }

  if (step === 'init') {
    const pending = createPendingPasswordReset({ umo, userId: binding.userId, password })
    return {
      success: true,
      step: 'init',
      pendingToken: pending.jti,
      expiresInSeconds: pending.expiresInSeconds,
      message: '请回复「/广播 重置密码 确认 <新密码>」完成重置（5 分钟内有效）。'
    }
  }

  // confirm：pendingToken 必须存在且未被消费（一次性），密码须与第一步一致
  const consumed = consumePendingPasswordReset(pendingToken)
  if (!consumed || consumed.userId !== binding.userId || consumed.umo !== umo) {
    await recordPasswordAudit(event, binding.userId, auditAction, false, '确认令牌无效或已过期')
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '确认已过期或不正确，请重新发起：/广播 重置密码 <新密码>')
  }
  if (consumed.password !== password) {
    await recordPasswordAudit(event, binding.userId, auditAction, false, '两次输入的新密码不一致')
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '两次输入的新密码不一致，请重新发起：/广播 重置密码 <新密码>')
  }

  const { passwordChangedAt } = await updateUserPassword(binding.userId, password, {
    auditContext: { action: auditAction, ...getPasswordAuditContext(event) }
  })

  // 成功通知只投递发起渠道（按绑定 platform 过滤的私聊）
  await enqueueAstrbotNotifications(
    [binding.userId],
    '密码重置成功',
    '你的 VoiceHub 账号密码已通过机器人重置。如非本人操作，请立即联系管理员。',
    binding.platform as AstrbotPlatform
  )

  return {
    success: true,
    step: 'confirm',
    message: '密码重置成功',
    passwordChangedAt
  }
})
