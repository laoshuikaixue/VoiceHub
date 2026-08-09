/**
 * 平台管理 Composable
 * 提供当前站点启用的音乐平台和排序顺序
 */

import { ref } from 'vue'

const DEFAULT_PLATFORMS = ['netease', 'tencent', 'bilibili', 'migu'] as const

export { DEFAULT_PLATFORMS }

const cache = {
  enabledPlatforms: ref<string[]>([...DEFAULT_PLATFORMS]),
  platformOrder: ref<string[]>([...DEFAULT_PLATFORMS]),
  loaded: ref(false)
}

export const usePlatformConfig = () => {
  const enabledPlatforms = cache.enabledPlatforms
  const platformOrder = cache.platformOrder
  const loaded = cache.loaded

  /**
   * 加载平台配置
   */
  const doLoadPlatformConfig = async () => {
    try {
      const res = await $fetch('/api/platform-config')
      enabledPlatforms.value = Array.isArray(res.enabledPlatforms) ? res.enabledPlatforms : [...DEFAULT_PLATFORMS]
      platformOrder.value = Array.isArray(res.platformOrder) ? res.platformOrder : [...DEFAULT_PLATFORMS]
      loaded.value = true
    } catch {
      // SSR 阶段 $fetch 不可用，保持 loaded=false 让客户端重试
      if (import.meta.server) return
      enabledPlatforms.value = [...DEFAULT_PLATFORMS]
      platformOrder.value = [...DEFAULT_PLATFORMS]
      loaded.value = true
    }
  }

  const loadPlatformConfig = async () => {
    if (import.meta.server) return
    if (loaded.value) return
    await doLoadPlatformConfig()
  }

  /** 重置加载状态并重新获取配置，供管理员保存后刷新使用 */
  const refreshPlatformConfig = async () => {
    loaded.value = false
    await doLoadPlatformConfig()
  }

  /**
   * 获取启用的平台列表（按配置的排序顺序）
   */
  const getAvailablePlatforms = (): string[] => {
    return platformOrder.value.filter((p) => enabledPlatforms.value.includes(p))
  }

  /**
   * 判断平台是否可用
   */
  const isPlatformEnabled = (platform: string): boolean => {
    return enabledPlatforms.value.includes(platform)
  }

  return {
    enabledPlatforms,
    platformOrder,
    loaded,
    loadPlatformConfig,
    refreshPlatformConfig,
    getAvailablePlatforms,
    isPlatformEnabled
  }
}