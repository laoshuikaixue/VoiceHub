export const MUSICFREE_PLATFORM_PREFIX = 'musicfree:'

export const isMusicFreePlatform = (platform?: string | null): boolean => {
  if (!platform) return false
  return platform === 'musicfree' || platform.startsWith(MUSICFREE_PLATFORM_PREFIX)
}

// 站内音质档位（useAudioQuality 的数值）→ MusicFree 插件 quality 取值；唯一权威映射
export const MUSICFREE_QUALITY_MAP: Record<string, string> = {
  '1': 'low',
  '2': 'standard',
  '3': 'high',
  '4': 'high',
  '5': 'super',
  '6': 'super',
  '9': 'super'
}

export const getMusicFreeQuality = (quality?: number | string): string =>
  MUSICFREE_QUALITY_MAP[String(quality)] || 'standard'
