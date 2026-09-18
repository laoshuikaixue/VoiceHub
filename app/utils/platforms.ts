/**
 * 前端平台元数据共享模块（单一来源）
 * 平台白名单、显示名国际化键、显示名回退值
 * 新增内置音源需同步：本文件 + server/config/constants.ts 的 MUSIC_SOURCE_PLATFORMS + app/drizzle/schema.ts 默认值与迁移文件
 */

import { LEGACY_PLUGIN_PLATFORM_PREFIX, PLUGIN_PLATFORM_PREFIX, getPluginId } from '~/utils/pluginPlatform'

// 受管理员控制的“内置”音源：可被启用/禁用、排序（音源管理后台），也是入库配置的白名单
export const BUILTIN_PLATFORMS = ['netease', 'tencent', 'bilibili', 'migu'] as const

// 平台显示名键 → 国际化文案键（按 siteConfig 段）
export const PLATFORM_NAME_KEYS = {
  netease: 'platformNetease',
  tencent: 'platformTencent',
  bilibili: 'platformBilibili',
  migu: 'platformMigu',
  plugin: 'platformPlugin'
} as const

// 平台显示名回退值（词典缺失时使用）
export const PLATFORM_NAME_FALLBACK = {
  netease: '网易云音乐',
  tencent: 'QQ音乐',
  bilibili: '哔哩哔哩',
  migu: '咪咕音乐',
  plugin: '插件音源'
} as const

export const PLATFORM_NAME_FALLBACK_EN = {
  netease: 'NetEase Cloud Music',
  tencent: 'QQ Music',
  bilibili: 'Bilibili',
  migu: 'Migu Music',
  plugin: 'Source Plugin'
} as const

/**
 * 获取平台本地化显示名（优先 siteConfig 词典，回退到硬编码值）
 */
export const getPlatformDisplayName = (key: string, siteConfig: any, currentLocale: string): string => {
  const nameKey = PLATFORM_NAME_KEYS[key as keyof typeof PLATFORM_NAME_KEYS]
  if (nameKey && siteConfig?.[nameKey]) {
    return siteConfig[nameKey]
  }
  const isEn = currentLocale === 'en-US'
  if (key.startsWith(PLUGIN_PLATFORM_PREFIX) || key.startsWith(LEGACY_PLUGIN_PLATFORM_PREFIX)) {
    const suffix = getPluginId(key)
    return suffix
      ? (isEn ? `${PLATFORM_NAME_FALLBACK_EN.plugin}: ${suffix}` : `${PLATFORM_NAME_FALLBACK.plugin}: ${suffix}`)
      : (isEn ? PLATFORM_NAME_FALLBACK_EN.plugin : PLATFORM_NAME_FALLBACK.plugin)
  }
  return isEn
    ? (PLATFORM_NAME_FALLBACK_EN[key as keyof typeof PLATFORM_NAME_FALLBACK_EN] ?? key)
    : (PLATFORM_NAME_FALLBACK[key as keyof typeof PLATFORM_NAME_FALLBACK] ?? key)
}
