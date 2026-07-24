import { getSystemSettingsCached } from './system-settings-helper'

/**
 * 获取站点标题
 */
export async function getSiteTitle(): Promise<string> {
  try {
    const settings = await getSystemSettingsCached()
    return settings?.siteTitle || process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub'
  } catch (error) {
    console.error('获取站点标题失败:', error)
    return 'VoiceHub'
  }
}

/**
 * 姓名脱敏函数，统一返回三个星号
 * @param name 原始姓名
 * @returns 脱敏后的姓名
 */
export function maskStudentName(name: string): string {
  if (!name) return name
  return '***'
}
