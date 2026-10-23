import { defineEventHandler, readBody, setCookie, getRequestURL, getHeader } from 'h3'
import { eq } from 'drizzle-orm'
import { db, users, browserFingerprints } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { hashFingerprint, isValidFingerprint } from '~~/server/utils/fingerprint'
import { createAuthSession } from '~~/server/utils/auth-session'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getBeijingTime } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerDate } from '~~/server/utils/serverTime'
import {
  getIPBlockRemainingTime,
  isIPBlocked,
  recordLoginFailure,
  recordLoginSuccess
} from '~~/server/services/securityService'

// 浏览器指纹一键登录：与 WebAuthn 同为设备凭证，不再叠加 2FA
export default defineEventHandler(async (event) => {
  const settings = await getSystemSettingsCached()
  if (!settings?.fingerprintLoginEnabled) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_DISABLED,
      '浏览器指纹登录未开启，请使用账号密码登录'
    )
  }

  const body = await readBody(event)
  const fingerprint = body?.fingerprint
  if (!isValidFingerprint(fingerprint)) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_INVALID,
      '浏览器指纹无效，请刷新页面后重试'
    )
  }

  const clientIp = getClientIP(event)
  if (await isIPBlocked(clientIp)) {
    const remainingTime = await getIPBlockRemainingTime(clientIp)
    throw createApiError(
      423,
      SERVER_ERROR_CODES.AUTH_IP_BLOCKED_RETRY_MINUTES,
      `您的IP地址已被限制访问，请在 ${remainingTime} 分钟后重试`,
      { params: [remainingTime] }
    )
  }

  const fingerprintHash = hashFingerprint(fingerprint)
  const binding = await db.query.browserFingerprints.findFirst({
    where: eq(browserFingerprints.fingerprintHash, fingerprintHash),
    with: { user: true }
  })

  if (!binding) {
    // 以指纹前缀作为统计键，避免把完整哈希写入风控日志
    await recordLoginFailure(`fingerprint:${fingerprintHash.slice(0, 16)}`, clientIp)
    throw createApiError(
      401,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_NOT_BOUND,
      '当前浏览器未绑定账号，或绑定已被移除'
    )
  }

  const user = binding.user
  if (!user || user.status !== 'active') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE,
      '该账号当前不可用'
    )
  }

  await db
    .update(browserFingerprints)
    .set({ lastUsedAt: getServerDate(), lastLoginIp: clientIp })
    .where(eq(browserFingerprints.id, binding.id))

  await recordLoginSuccess(user.username, clientIp)

  await db
    .update(users)
    .set({ lastLogin: getBeijingTime(), lastLoginIp: clientIp })
    .where(eq(users.id, user.id))
    .catch((err) => console.error('更新指纹登录信息失败:', err))

  const { token } = await createAuthSession(
    event,
    { id: user.id, role: user.role, tokenVersion: user.tokenVersion },
    'fingerprint'
  )

  const isSecure =
    getRequestURL(event).protocol === 'https:' ||
    getHeader(event, 'x-forwarded-proto') === 'https'

  setCookie(event, 'auth-token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  }
})
