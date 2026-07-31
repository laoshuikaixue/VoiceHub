import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以修改自动备份配置')
  }

  const body = await readBody(event)
  const { enabled, config } = body

  if (typeof enabled !== 'boolean') {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'enabled 字段必填')
  }

  const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)

  if (!existing) {
    // 表为空时，用系统默认值创建完整行，避免部分字段缺失
    await db.insert(systemSettings).values({
      ...SYSTEM_SETTINGS_DEFAULTS,
      autoBackupEnabled: enabled,
      autoBackupConfig: config ? JSON.stringify(config) : null
    })
  } else {
    await db.update(systemSettings)
      .set({
        autoBackupEnabled: enabled,
        autoBackupConfig: config ? JSON.stringify(config) : null,
        updatedAt: new Date()
      })
      .where(eq(systemSettings.id, existing.id))
  }

  return { success: true, message: '自动备份配置已保存' }
})