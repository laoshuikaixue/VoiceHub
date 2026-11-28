import { createHash } from 'node:crypto'
import { defineEventHandler, getHeader, readBody, setResponseHeader } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, users } from '~/drizzle/schema'
import { getPasswordPolicyViolation } from '~/utils/password-policy'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { enqueueAstrbotNotifications } from '~~/server/services/astrbotOutboxService'
import { consumePasswordRateLimit, getPasswordAuditContext, PASSWORD_AUDIT_ACTIONS, recordPasswordAudit } from '~~/server/services/passwordSecurityService'
import { updateUserPassword } from '~~/server/services/userService'
import { createApiError } from '~~/server/utils/apiError'
import { loadAstrbotBindSettings } from '~~/server/utils/astrbot-bind-ticket'
import { ASTRBOT_TOKEN_HEADER, equalAstrbotToken } from '~~/server/utils/astrbot-notification'
import {
  ASTRBOT_PASSWORD_RESET_TTL_SECONDS,
  astrbotPasswordResetDenied,
  canUseAstrbotPasswordReset,
  createAstrbotResetChallenge,
  readAstrbotResetChallenge
} from '~~/server/utils/astrbot-password-reset'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled, isAstrbotPrivateUmoShape, parseAstrbotPlatform } from '~~/server/utils/astrbot-platforms'
import { getClientIP } from '~~/server/utils/ip-utils'
import { lockPermissionChanges } from '~~/server/utils/permission-admin'
import { getRolePermissionTemplatesCached } from '~~/server/utils/system-settings-helper'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const invalidConfirmation = () => createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
  '确认无效或已过期，请重新发起密码重置')
const invalidBotToken = () => createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const botToken = getHeader(event, ASTRBOT_TOKEN_HEADER) ?? ''
  if (!botToken) throw invalidBotToken()
  const [settings] = await loadAstrbotBindSettings(db)
  if (!settings?.enabled || !equalAstrbotToken(botToken, settings.token ?? '')) throw invalidBotToken()

  const { umo, step, password, pendingToken } = (await readBody(event)) ?? {}
  if (!isAstrbotPrivateUmoShape(umo)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '私聊会话无效')
  }
  const [binding] = await db.select().from(astrbotBindings).where(eq(astrbotBindings.umo, umo)).limit(1)
  const platform = parseAstrbotPlatform(binding?.platform)
  if (!binding?.passwordResetGrantId || !platform || adapterToAstrbotPlatform(binding.adapter) !== platform ||
    !isAstrbotPlatformEnabled(settings.platforms, platform)) throw astrbotPasswordResetDenied()
  const [account] = await db.select().from(users).where(eq(users.id, binding.userId)).limit(1)
  if (!account || !canUseAstrbotPasswordReset(account, await getRolePermissionTemplatesCached())) {
    throw astrbotPasswordResetDenied()
  }

  const action = PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD
  const limit = await consumePasswordRateLimit(binding.userId, getClientIP(event), action, 10)
  if (!limit.allowed) {
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS, '重置密码尝试次数过多',
      { params: [limit.retryAfterSeconds] })
  }
  if (typeof password !== 'string' || !password || password.length > 128) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请提供 128 字符以内的新密码')
  }
  const violation = getPasswordPolicyViolation(password)
  if (violation) throw createApiError(400, violation.code, violation.message)

  const challenge = { userId: binding.userId, umo, grantId: binding.passwordResetGrantId,
    tokenVersion: account.tokenVersion, botTokenHash: digest(botToken), passwordHash: digest(password) }
  if (step === undefined || step === 'init') {
    return {
      success: true, step: 'init', pendingToken: createAstrbotResetChallenge(challenge),
      expiresInSeconds: ASTRBOT_PASSWORD_RESET_TTL_SECONDS,
      message: '请在 5 分钟内回复「/广播 重置密码 确认 <新密码>」。'
    }
  }

  const pending = step === 'confirm' ? readAstrbotResetChallenge(pendingToken) : null
  if (!pending || pending.userId !== challenge.userId || pending.umo !== challenge.umo ||
    pending.grantId !== challenge.grantId || pending.tokenVersion !== challenge.tokenVersion ||
    pending.botTokenHash !== challenge.botTokenHash || !equalAstrbotToken(pending.passwordHash, challenge.passwordHash)) {
    await recordPasswordAudit(event, binding.userId, action, false, '机器人改密确认无效')
    throw invalidConfirmation()
  }

  const { passwordChangedAt } = await db.transaction(async (tx) => {
    // 权限变更、解绑和会话授权检查必须先于密码写入。
    await lockPermissionChanges(tx)
    const [freshSettings] = await loadAstrbotBindSettings(tx, true)
    if (!freshSettings?.enabled || !equalAstrbotToken(botToken, freshSettings.token ?? '')) throw invalidBotToken()
    if (!isAstrbotPlatformEnabled(freshSettings.platforms, platform)) throw astrbotPasswordResetDenied()
    const [fresh] = await tx.select().from(users).where(eq(users.id, binding.userId)).for('update')
    const [current] = await tx.select().from(astrbotBindings).where(and(
      eq(astrbotBindings.userId, binding.userId), eq(astrbotBindings.platform, platform)
    )).for('update')
    if (!fresh || !current || current.umo !== umo || current.adapter !== binding.adapter ||
      current.passwordResetGrantId !== pending.grantId ||
      !canUseAstrbotPasswordReset(fresh, await getRolePermissionTemplatesCached(tx))) {
      throw astrbotPasswordResetDenied()
    }
    if (fresh.tokenVersion !== pending.tokenVersion || !readAstrbotResetChallenge(pendingToken)) throw invalidConfirmation()
    return updateUserPassword(binding.userId, password, {
      executor: tx, expectedTokenVersion: pending.tokenVersion,
      auditContext: { action, ...getPasswordAuditContext(event) }
    })
  })

  try {
    await enqueueAstrbotNotifications([binding.userId], '密码重置成功', '你的 VoiceHub 密码已通过机器人重置。', platform)
  } catch (error) {
    console.error('[AstrBot] 密码重置通知入队失败', error)
  }
  return { success: true, step: 'confirm', message: '密码重置成功', passwordChangedAt }
})
