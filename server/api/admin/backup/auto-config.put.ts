import { defineEventHandler, readBody } from 'h3'
import { createError } from 'h3'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '只有超级管理员可以修改自动备份配置' })
  }

  const body = await readBody(event)
  const { enabled, config } = body

  if (typeof enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'enabled 字段必填' })
  }

  const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)

  if (!existing) {
    await db.insert(systemSettings).values({
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