/** 插件平台键统一使用 plugin:<插件ID>，旧数据里的 musicfree:<插件ID> 继续识别。 */
export const PLUGIN_PLATFORM_PREFIX = 'plugin:'
export const LEGACY_PLUGIN_PLATFORM_PREFIX = 'musicfree:'

/**
 * 判断是否为音源插件平台（LX Music 与 MusicFree 共用）。
 * 只接受带前缀的标识（如 plugin:<id>），不接受裸 'plugin'，
 * 避免空插件名导致服务端全插件遍历（出站请求放大）。
 */
export const isPluginPlatform = (platform?: string | null): boolean => {
  if (!platform) return false
  return platform.startsWith(PLUGIN_PLATFORM_PREFIX) || platform.startsWith(LEGACY_PLUGIN_PLATFORM_PREFIX)
}

/** 提取插件 ID，非插件平台返回空字符串。 */
export const getPluginId = (platform?: string | null): string => {
  if (!platform) return ''
  if (platform.startsWith(PLUGIN_PLATFORM_PREFIX)) return platform.slice(PLUGIN_PLATFORM_PREFIX.length)
  if (platform.startsWith(LEGACY_PLUGIN_PLATFORM_PREFIX)) return platform.slice(LEGACY_PLUGIN_PLATFORM_PREFIX.length)
  return ''
}

// 音质档位（useAudioQuality 中 plugin 档位的数值）→ 插件 quality 取值；唯一权威映射
// 插件音质：2=标准、4=高品质、5=超高
export const PLUGIN_QUALITY_MAP: Record<string, string> = {
  '2': 'standard',
  '4': 'high',
  '5': 'super'
}

const PLUGIN_QUALITY_LEVELS = ['standard', 'high', 'super', 'lossless']

export const getPluginQuality = (quality?: number | string): string => {
  const value = String(quality ?? '')
  // 调用方已给出档位名时直接采用，服务端回退链会用到 lossless
  if (PLUGIN_QUALITY_LEVELS.includes(value)) return value
  return PLUGIN_QUALITY_MAP[value] || 'standard'
}

/**
 * 已入库歌曲才能按 songId 让服务端回查插件曲目；搜索结果携带 selectionToken，不走该路径。
 * 服务端会按 songId 校验可见性，因此这里只负责识别“这是数据库里的歌曲行”。
 */
export const getPersistedSongId = (item?: any): number | undefined => {
  if (!item || item.selectionToken) return undefined
  return Number.isInteger(item.id) && (item.requesterId !== undefined || item.createdAt !== undefined) ? item.id : undefined
}
