import bcrypt from 'bcryptjs'
import otplib from 'otplib'
import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { userIdentities, users } from '~/drizzle/schema'
import { hasPermission, PRIV_ADMIN_CONSOLE, resolveEffectivePermissions } from '~/utils/admin-permissions'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  consumePasswordRateLimit,
  PASSWORD_AUDIT_ACTIONS,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'
import { createApiError } from './apiError'
import { getClientIP } from './ip-utils'
import { seal, unseal } from './music-source-plugins/tickets'
import { getRolePermissionTemplatesCached } from './system-settings-helper'

const { authenticator } = otplib
const PURPOSE = 'astrbot-granted-password-reset'
export const ASTRBOT_PASSWORD_RESET_TTL_SECONDS = 300

type RecoveryAccount = Pick<typeof users.$inferSelect, 'role' | 'permissions' | 'status' | 'forcePasswordChange'>
type IdentityReader = Pick<typeof db, 'select'>

export function loadAstrbotRecoveryTotp(executor: IdentityReader, userId: number, lock = false) {
  const query = executor.select({ secret: userIdentities.providerUserId }).from(userIdentities)
    .where(and(eq(userIdentities.userId, userId), eq(userIdentities.provider, 'totp'))).limit(1)
  return lock ? query.for('share') : query
}

export function canUseAstrbotPasswordReset(account: RecoveryAccount, templates: Record<string, unknown>) {
  return account.status === 'active' && !account.forcePasswordChange &&
    !hasPermission(resolveEffectivePermissions(account, templates), PRIV_ADMIN_CONSOLE)
}

export function astrbotPasswordResetDenied() {
  return createApiError(403, SERVER_ERROR_CODES.ASTRBOT_PASSWORD_RESET_NOT_ALLOWED,
    '未授予机器人重置密码权限，请使用 VoiceHub 网页的忘记密码')
}

export async function verifyAstrbotPasswordResetConsent(event: H3Event, password: unknown, code: unknown) {
  const user = event.context.user
  if (hasPermission(user.perms ?? [], PRIV_ADMIN_CONSOLE)) throw astrbotPasswordResetDenied()
  const action = PASSWORD_AUDIT_ACTIONS.STEP_UP
  const result = await consumePasswordRateLimit(user.id, getClientIP(event), action, 5)
  if (!result.allowed) {
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS, '验证尝试次数过多',
      { params: [result.retryAfterSeconds] })
  }

  const [account] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  if (!account || account.tokenVersion !== user.tokenVersion ||
    !canUseAstrbotPasswordReset(account, await getRolePermissionTemplatesCached())) {
    throw astrbotPasswordResetDenied()
  }
  const [totp] = await loadAstrbotRecoveryTotp(db, user.id)
  const validPassword = typeof password === 'string' && password.length > 0 && password.length <= 128 &&
    !!account.password && await bcrypt.compare(password, account.password)
  const valid = validPassword && (!totp ||
    (typeof code === 'string' && /^[0-9]{6}$/.test(code) && authenticator.check(code, totp.secret)))
  await recordPasswordAudit(event, user.id, action, !!valid, valid ? undefined : '机器人恢复授权凭据无效')
  if (!valid) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_INVALID_CREDENTIALS, '当前账号验证失败')
  }
  return { passwordHash: account.password, totpSecret: totp?.secret }
}

type ResetChallenge = { userId: number; umo: string; grantId: string; tokenVersion: number; botTokenHash: string; passwordHash: string }

export function createAstrbotResetChallenge(value: ResetChallenge) {
  return seal(value, PURPOSE, ASTRBOT_PASSWORD_RESET_TTL_SECONDS * 1000)
}

export function readAstrbotResetChallenge(token: unknown): ResetChallenge | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  try {
    return unseal<ResetChallenge>(token, PURPOSE)
  } catch {
    return null
  }
}
