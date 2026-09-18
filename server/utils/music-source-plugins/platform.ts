/**
 * 插件平台键统一使用 plugin:<插件ID>，同时兼容旧数据遗留的 musicfree:<插件ID>。
 * LX Music 与 MusicFree 插件共用同一套平台键，协议差异由 capability.protocol 描述。
 */
export const PLUGIN_PLATFORM_PREFIX = 'plugin:'
export const LEGACY_PLUGIN_PLATFORM_PREFIX = 'musicfree:'

export const pluginPlatformKey = (id: string) => `${PLUGIN_PLATFORM_PREFIX}${id}`
export const legacyPluginPlatformKey = (id: string) => `${LEGACY_PLUGIN_PLATFORM_PREFIX}${id}`

/** 解析插件平台键，非插件平台返回 null。 */
export function pluginIdFromPlatform(platform: string): string | null {
  for (const prefix of [PLUGIN_PLATFORM_PREFIX, LEGACY_PLUGIN_PLATFORM_PREFIX]) {
    if (platform.startsWith(prefix)) return platform.slice(prefix.length)
  }
  return null
}
