import bcrypt from 'bcryptjs'
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

// 启用当前浏览器的指纹登录：需密码认证，同一浏览器全局只能绑定一个账号
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要登录才能绑定浏览器指纹')
  }

  const settings = await getSystemSettingsCached()
  if (!settings?.fingerprintLoginEnabled) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_DISABLED,
      '管理员未开启浏览器指纹登录功能'
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

  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请输入当前密码以完成验证')
  }

  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, password: true }
  })
  if (!userRecord) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '账号不存在')
  }

  const isPasswordValid = await bcrypt.compare(password, userRecord.password)
  if (!isPasswordValid) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_CURRENT_PASSWORD_INCORRECT,
      '当前密码错误，无法绑定浏览器指纹'
    )
  }

  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 50) : ''
  const fingerprintHash = hashFingerprint(fingerprint)
  const metadata = parseUserAgent(getHeader(event, 'user-agent') || '')

  // 同一浏览器已被其他账号绑定：全局唯一，避免指纹登录时出现账号歧义
  const existing = await db.query.browserFingerprints.findFirst({
    where: eq(browserFingerprints.fingerprintHash, fingerprintHash)
  })
  if (existing && existing.userId !== user.id) {
    throw createApiError(
      409,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_BOUND_TO_OTHER,
      '该浏览器已绑定其他账号，请先在对应账号中解绑'
    )
  }

  if (existing) {
    // 同一账号重复启用：仅刷新备注与设备信息
    await db
      .update(browserFingerprints)
      .set({
        label: label || existing.label,
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
      `每个账号最多绑定 ${MAX_FINGERPRINT_BINDINGS} 个浏览器，请先解绑不再使用的设备`
    )
  }

  const inserted = await db
    .insert(browserFingerprints)
    .values({
      userId: user.id,
      fingerprintHash,
      label: label || null,
      ...metadata
    })
    .returning({ id: browserFingerprints.id })

  return { success: true, id: inserted[0].id }
})
