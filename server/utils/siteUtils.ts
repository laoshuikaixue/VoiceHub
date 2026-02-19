import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'

/**
 * 获取站点标题
 */
export async function getSiteTitle(): Promise<string> {
  try {
    const settingsResult = await db.select().from(systemSettings).limit(1)
    const settings = settingsResult[0]
    return settings?.siteTitle || process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub'
  } catch (error) {
    console.error('获取站点标题失败:', error)
    return 'VoiceHub'
  }
}
