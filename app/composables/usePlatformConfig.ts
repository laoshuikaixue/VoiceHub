/**
 * 平台管理 Composable
 * 提供当前站点启用的音乐平台和排序顺序
 */

import { ref } from 'vue'
import { useSiteConfig } from './useSiteConfig'
import { DEFAULT_PLATFORMS } from '~/utils/platforms'

const cache = {
  enabledPlatforms: ref<string[]>([...DEFAULT_PLATFORMS]),
  platformOrder: ref<string[]>([...DEFAULT_PLATFORMS]),
  loaded: ref(false),
  // 加载中的 promise，避免并发重复请求
  inflight: null as Promise<void> | null
}

/** 安全解析平台数组，解析失败时回退默认值 */
const parsePlatformArray = (value: unknown): string[] => {
  try {
    const arr = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(arr)) return [...DEFAULT_PLATFORMS]
    const valid = arr.filter((p: unknown) => (DEFAULT_PLATFORMS as readonly string[]).includes(p as string))
    return valid.length > 0 ? (valid as string[]) : [...DEFAULT_PLATFORMS]
  } catch {
    return [...DEFAULT_PLATFORMS]
  }
}

export const usePlatformConfig = () => {
  const enabledPlatforms = cache.enabledPlatforms
  const platformOrder = cache.platformOrder
  const loaded = cache.loaded

  /**
   * 加载平台配置
   * @param forceApi 强制走 API 请求（跳过 useSiteConfig 优化），供管理页保存后刷新使用
   */
  const doLoadPlatformConfig = async (forceApi = false) => {
    // 优先复用 useSiteConfig 已加载的数据（/api/site-config 已含平台字段），避免重复请求
    if (!forceApi) {
      try {
        const { siteConfig, isLoaded } = useSiteConfig()
        if (isLoaded.value && siteConfig.value?.enabledPlatforms) {
          enabledPlatforms.value = parsePlatformArray(siteConfig.value.enabledPlatforms)
          platformOrder.value = parsePlatformArray(siteConfig.value.platformOrder)
          loaded.value = true
          return
        }
      } catch {
        // useSiteConfig 数据未就绪，回退到独立 API 请求
      }
    }

    try {
      const res = await $fetch('/api/platform-config')
      enabledPlatforms.value = parsePlatformArray(res.enabledPlatforms)
      platformOrder.value = parsePlatformArray(res.platformOrder)
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
    // 已有加载请求进行中则直接复用，避免并发重复请求
    if (cache.inflight) return cache.inflight
    cache.inflight = doLoadPlatformConfig().finally(() => {
      cache.inflight = null
    })
    await cache.inflight
  }

  /** 重置加载状态并重新获取配置（跳过 useSiteConfig 优化，确保读到最新数据），供管理员保存后刷新使用 */
  const refreshPlatformConfig = async () => {
    if (import.meta.server) return
    loaded.value = false
    await doLoadPlatformConfig(true)
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