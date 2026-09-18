import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { MUSIC_SOURCE_PLATFORMS } from '~~/server/config/constants'

const PLATFORM_LIST = MUSIC_SOURCE_PLATFORMS as readonly string[]

// allowBackfill=false 用于 enabledPlatforms：只做白名单过滤，禁止补齐缺失平台，否则用户禁用操作会被覆盖
// allowBackfill=true 用于 platformOrder：补齐白名单中缺失平台到末尾，保证排序列表完整
const parsePlatforms = (value: string | null | undefined, allowBackfill = false): string[] => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value || '[]')
  } catch {
    parsed = null
  }

  const valid = (Array.isArray(parsed) ? parsed : []).filter((p) => PLATFORM_LIST.includes(p as string)) as string[]
  if (valid.length === 0) return [...MUSIC_SOURCE_PLATFORMS]
  if (!allowBackfill) return valid
  const merged = [...valid]
  for (const p of PLATFORM_LIST) {
    if (!merged.includes(p)) merged.push(p)
  }
  return merged
}

const fallbackConfig = () => ({
  enabledPlatforms: [...MUSIC_SOURCE_PLATFORMS],
  platformOrder: [...MUSIC_SOURCE_PLATFORMS]
})

/**
 * 公开接口：获取平台管理配置（供前端 RequestForm 使用）
 */
export default defineEventHandler(async () => {
  try {
    const [settings] = await db.select().from(systemSettings).limit(1)
    if (!settings) return fallbackConfig()

    return {
      enabledPlatforms: parsePlatforms(settings.enabledPlatforms, false),
      platformOrder: parsePlatforms(settings.platformOrder, true)
    }
  } catch (error) {
    console.error('获取平台配置失败:', error)
    return fallbackConfig()
  }
})
