import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SYSTEM_SETTINGS_DEFAULTS } from '../../../utils/system-settings-defaults'
import { maskSystemSettingsSecrets } from './secretMask'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能导入环境配置'
    })
  }

  const body = await readBody(event)
  const provider = typeof body.provider === 'string' ? body.provider : ''

  const updateData: Record<string, any> = {}

  if (provider === 'base') {
    if (!process.env.OAUTH_REDIRECT_URI && !process.env.OAUTH_STATE_SECRET) {
      throw createError({ statusCode: 400, message: '未检测到可导入的基础 OAuth 环境配置' })
    }
    if (process.env.OAUTH_REDIRECT_URI) {
      updateData.oauthRedirectUri = process.env.OAUTH_REDIRECT_URI
    }
    if (process.env.OAUTH_STATE_SECRET) {
      updateData.oauthStateSecret = process.env.OAUTH_STATE_SECRET
    }
  } else if (provider === 'github') {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw createError({ statusCode: 400, message: '未检测到完整的 GitHub 环境配置' })
    }
    updateData.githubOAuthEnabled = true
    updateData.githubClientId = process.env.GITHUB_CLIENT_ID
    updateData.githubClientSecret = process.env.GITHUB_CLIENT_SECRET
  } else if (provider === 'casdoor') {
    if (!process.env.CASDOOR_ENDPOINT || !process.env.CASDOOR_CLIENT_ID || !process.env.CASDOOR_CLIENT_SECRET) {
      throw createError({ statusCode: 400, message: '未检测到完整的 Casdoor 环境配置' })
    }
    updateData.casdoorOAuthEnabled = true
    updateData.casdoorServerUrl = process.env.CASDOOR_ENDPOINT
    updateData.casdoorClientId = process.env.CASDOOR_CLIENT_ID
    updateData.casdoorClientSecret = process.env.CASDOOR_CLIENT_SECRET
    updateData.casdoorOrganizationName = process.env.CASDOOR_ORGANIZATION_NAME || 'built-in'
  } else if (provider === 'google') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw createError({ statusCode: 400, message: '未检测到完整的 Google 环境配置' })
    }
    updateData.googleOAuthEnabled = true
    updateData.googleClientId = process.env.GOOGLE_CLIENT_ID
    updateData.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  } else {
    throw createError({ statusCode: 400, message: '不支持的导入类型' })
  }

  const settingsResult = await db.select().from(systemSettings).limit(1)
  let settings = settingsResult[0]

  if (!settings) {
    const inserted = await db
      .insert(systemSettings)
      .values({ ...SYSTEM_SETTINGS_DEFAULTS, ...updateData })
      .returning()
    settings = inserted[0]
  } else {
    const updated = await db
      .update(systemSettings)
      .set(updateData)
      .where(eq(systemSettings.id, settings.id))
      .returning()
    settings = updated[0]
  }

  try {
    const { CacheService } = await import('~~/server/services/cacheService')
    await CacheService.getInstance().clearSystemSettingsCache()
  } catch (e) {
    console.warn('清除系统设置缓存失败:', e)
  }

  return maskSystemSettingsSecrets(settings)
})
