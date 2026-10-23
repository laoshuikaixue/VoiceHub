import bcrypt from 'bcryptjs'
import { defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db, users, browserFingerprints } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

/**
 * 开启/关闭「浏览器指纹数据」采集开关。
 *
 * 开启属于敏感操作：会采集浏览器的 canvas / WebGL / 字体 / 屏幕 / 时区 等环境特征，
 * 因此必须携带 consent=true 显式确认，并校验当前密码以证明操作者是账号本人。
 * 关闭时一并清除该账号已采集的指纹数据，避免关闭后仍保留历史数据。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(
      401,
      SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS,
      '需要登录才能修改浏览器指纹数据设置'
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

  const body = await readBody(event)
  const enabled = body?.enabled === true

  // 开启时必须显式确认「会收集浏览器指纹」
  if (enabled && body?.consent !== true) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      '开启浏览器指纹数据采集前需确认已了解将收集浏览器指纹'
    )
  }

  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, password: true }
  })
  if (!userRecord) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '账号不存在')
  }

  if (enabled) {
    // 校验当前密码，确认操作者是账号本人（防止会话被劫持后擅自开启采集）
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!password) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        '请输入当前密码以确认身份'
      )
    }
    const isPasswordValid = await bcrypt.compare(password, userRecord.password)
    if (!isPasswordValid) {
      throw createApiError(
        403,
        SERVER_ERROR_CODES.AUTH_CURRENT_PASSWORD_INCORRECT,
        '当前密码错误，无法开启浏览器指纹数据采集'
      )
    }
  }

  await db
    .update(users)
    .set({ fingerprintDataEnabled: enabled })
    .where(eq(users.id, user.id))

  // 关闭时清除已采集的指纹数据
  if (!enabled) {
    await db
      .delete(browserFingerprints)
      .where(eq(browserFingerprints.userId, user.id))
  }

  return { success: true, enabled }
})
