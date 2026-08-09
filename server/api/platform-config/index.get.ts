import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'

const DEFAULT_PLATFORMS = ['netease', 'tencent', 'bilibili', 'migu']

/**
 * 安全解析 platform JSON 字段，解析失败时返回默认值
 */
const parsePlatformJson = (value: string | null | undefined) => {
  try {
    return JSON.parse(value || '[]')
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