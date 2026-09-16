export const MUSICFREE_PLATFORM_PREFIX = 'musicfree:'

/**
 * 判断是否为 MusicFree 插件平台。
 * 只接受带 musicfree: 前缀的标识（如 musicfree:netease），不接受裸 'musicfree'，
 * 避免空插件名导致服务端全插件遍历（出站请求放大）。
 */
export const isMusicFreePlatform = (platform?: string | null): boolean => {
  if (!platform) return false
  return platform.startsWith(MUSICFREE_PLATFORM_PREFIX)
}

// 音质档位（useAudioQuality QUALITY_OPTIONS.musicfree 的数值）→ MusicFree 插件 quality 取值；唯一权威映射
// MusicFree 音质：2=标准、4=高品质、5=超高；旧版值（1/3/6/9）保留兼容
export const MUSICFREE_QUALITY_MAP: Record<string, string> = {
  '2': 'standard',
  '4': 'high',
  '5': 'super',
  // 旧版兼容（来自早期 netease 风格映射）
  '1': 'low',
  '3': 'high',
  '6': 'super',
  '9': 'super'
}

export const getMusicFreeQuality = (quality?: number | string): string =>
  MUSICFREE_QUALITY_MAP[String(quality)] || 'standard'
