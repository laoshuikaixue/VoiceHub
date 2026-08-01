import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'

/** 备份配置结构校验 */
const backupConfigSchema = z.object({
  methods: z.object({
    s3: z.object({
      enabled: z.boolean(),
      endpoint: z.string(),
      bucket: z.string(),
      region: z.string(),
      pathPrefix: z.string(),
      accessKey: z.string(),
      secretKey: z.string().optional()
    }),
    webdav: z.object({
      enabled: z.boolean(),
      url: z.string(),
      username: z.string(),
      password: z.string().optional(),
      path: z.string()
    }),
    telegram: z.object({
      enabled: z.boolean(),
      botToken: z.string().optional(),
      chatId: z.string()
    }),
    email: z.object({
      enabled: z.boolean(),
      recipient: z.string()
    })
  })
})

/** 密钥字段映射：前端留空时保留数据库中的现有值 */
const SECRET_FIELDS: Record<string, string[]> = {
  s3: ['secretKey'],
  webdav: ['password'],
  telegram: ['botToken']
}

function mergeSecrets(incoming: any, existing: any): any {
  if (!incoming || !existing) return incoming
  const merged = JSON.parse(JSON.stringify(incoming))
  for (const [method, fields] of Object.entries(SECRET_FIELDS)) {
    if (!merged.methods?.[method] || !existing.methods?.[method]) continue
    for (const field of fields) {
      if (!merged.methods[method][field] && existing.methods[method][field]) {
        merged.methods[method][field] = existing.methods[method][field]
      }
    }
  }
  return merged
}

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

  // 校验 config 结构，防止畸形配置导致备份执行时崩溃
  if (config) {
    const parsed = backupConfigSchema.safeParse(config)
    if (!parsed.success) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `备份配置结构无效: ${parsed.error.issues[0]?.message || '未知错误'}`)
    }
  }

  const [existing] = await db.select({
    id: systemSettings.id,
    autoBackupConfig: systemSettings.autoBackupConfig
  }).from(systemSettings).limit(1)

  // 合并密钥：前端留空时保留数据库中已有的值
  let finalConfig = config
  if (config && existing?.autoBackupConfig) {
    try {
      const existingConfig = JSON.parse(existing.autoBackupConfig)
      finalConfig = mergeSecrets(config, existingConfig)
    } catch { /* 解析失败则使用传入的 config */ }
  }

  if (!existing) {
    await db.insert(systemSettings).values({
      ...SYSTEM_SETTINGS_DEFAULTS,
      autoBackupEnabled: enabled,
      autoBackupConfig: finalConfig ? JSON.stringify(finalConfig) : null
    })
  } else {
    await db.update(systemSettings)
      .set({
        autoBackupEnabled: enabled,
        autoBackupConfig: finalConfig ? JSON.stringify(finalConfig) : null,
        updatedAt: new Date()
      })
      .where(eq(systemSettings.id, existing.id))
  }

  return { success: true, message: '自动备份配置已保存' }
})