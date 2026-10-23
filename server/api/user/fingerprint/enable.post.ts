import { defineEventHandler, readBody, getHeader } from 'h3'
import { count, eq } from 'drizzle-orm'
import { db, users, browserFingerprints } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  hashFingerprint,
  isValidFingerprint,
  MAX_FINGERPRINT_BINDINGS
} from '~~/server/utils/fingerprint'
import { parseUserAgent } from '~~/server/utils/auth-session'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerDate } from '~~/server/utils/serverTime'

// 采集当前浏览器的浏览器指纹，作为用户数据项保存。
// 仅在用户显式开启「浏览器指纹数据」后可用；指纹仅作数据记录，不参与任何鉴权。
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(
      401,
      SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS,
      '需要登录才能采集浏览器指纹'
    )
  }

  const settings = await getSystemSettingsCached()
  if (!settings?.fingerprintDataEnabled) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_DISABLED,
      '管理员未开启浏览器指纹数据采集功能'
    )
  }

  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, fingerprintDataEnabled: true }
  })
  if (!userRecord) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '账号不存在')
  }
  if (!userRecord.fingerprintDataEnabled) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_DISABLED,
      '尚未开启浏览器指纹数据采集，请先在账号设置中开启'
    )
  }

  const body = await readBody(event)
  const fingerprint = body?.fingerprint
  if (!isValidFingerprint(fingerprint)) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_INVALID,
      '浏览器指纹采集失败或格式无效，请刷新页面后重试'
    )
  }

  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 50) : ''
  const fingerprintHash = hashFingerprint(fingerprint)
  const metadata = parseUserAgent(getHeader(event, 'user-agent') || '')
  const clientIp = getClientIP(event)

  // 同一浏览器已被其他账号采集：全局唯一，避免同一浏览器出现在多个账号的数据中
  const existing = await db.query.browserFingerprints.findFirst({
    where: eq(browserFingerprints.fingerprintHash, fingerprintHash)
  })
  if (existing && existing.userId !== user.id) {
    throw createApiError(
      409,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_BOUND_TO_OTHER,
      '该浏览器已被其他账号采集，请先在对应账号中删除'
    )
  }

  if (existing) {
    // 同一账号重复采集：仅刷新备注与设备信息
    await db
      .update(browserFingerprints)
      .set({
        label: label || existing.label,
        lastUsedAt: getServerDate(),
        lastUsedIp: clientIp,
        ...metadata
      })
      .where(eq(browserFingerprints.id, existing.id))
    return { success: true, id: existing.id }
  }

  const [totalResult] = await db
    .select({ value: count() })
    .from(browserFingerprints)
    .where(eq(browserFingerprints.userId, user.id))
  if (totalResult.value >= MAX_FINGERPRINT_BINDINGS) {
    throw createApiError(
      409,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_LIMIT_EXCEEDED,
      `每个账号最多可保存 ${MAX_FINGERPRINT_BINDINGS} 个浏览器指纹，请先删除不再使用的设备`
    )
  }

  const inserted = await db
    .insert(browserFingerprints)
    .values({
      userId: user.id,
      fingerprintHash,
      label: label || null,
      lastUsedAt: getServerDate(),
      lastUsedIp: clientIp,
      ...metadata
    })
    .returning({ id: browserFingerprints.id })

  return { success: true, id: inserted[0].id }
})
