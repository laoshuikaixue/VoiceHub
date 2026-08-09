import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { MUSIC_SOURCE_PLATFORMS } from '~~/server/config/constants'

const DEFAULT_PLATFORMS = [...MUSIC_SOURCE_PLATFORMS]

/**
 * 安全解析 platform JSON 字段，解析失败或为空时返回默认值
 */
const parsePlatformJson = (value: string | null | undefined) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_PLATFORMS]
  } catch {
    return [...DEFAULT_PLATFORMS]
  }
}

/**
 * 公开接口：获取平台管理配置（供前端 RequestForm 使用）
 */
export default defineEventHandler(async () => {
  try {
    const settingsResult = await db.select().from(systemSettings).limit(1)
    const settings = settingsResult[0]

    if (!settings) {
      return {
        enabledPlatforms: [...DEFAULT_PLATFORMS],
        platformOrder: [...DEFAULT_PLATFORMS]
      }
    }

    return {
      enabledPlatforms: parsePlatformJson(settings.enabledPlatforms),
      platformOrder: parsePlatformJson(settings.platformOrder)
    }
  } catch (error) {
    console.error('获取平台配置失败:', error)
    return {
      enabledPlatforms: [...DEFAULT_PLATFORMS],
      platformOrder: [...DEFAULT_PLATFORMS]
    }
  }
})