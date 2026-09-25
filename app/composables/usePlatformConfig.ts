/**
 * 平台管理 Composable
 * 提供当前站点启用的音乐平台和排序顺序
 */

import { ref } from 'vue'
import { useSiteConfig } from './useSiteConfig'
import { BUILTIN_PLATFORMS } from '~/utils/platforms'

/** 插件音源信息（platform 为带前缀的插件标识 plugin:<id>，也是搜索/播放时的路由键） */
export type PluginPlatformInfo = {
  platform: string
  displayName: string
  // 稳定唯一 id（与 platform 后缀一致），供客户端直接取用
  id?: string
}

const cache = {
  enabledPlatforms: ref<string[]>([...BUILTIN_PLATFORMS]),
  platformOrder: ref<string[]>([...BUILTIN_PLATFORMS]),
  loaded: ref(false),
  // 插件音源列表：每个插件作为独立平台
  pluginPlatforms: ref<PluginPlatformInfo[]>([]),
  // 加载中的 promise，避免并发重复请求
  inflight: null as Promise<void> | null
}

/** 安全解析平台数组，解析失败时回退默认值 */
// allowBackfill=false 用于 enabledPlatforms：只做白名单过滤，禁止补齐缺失平台，否则用户禁用操作会被覆盖
// allowBackfill=true 用于 platformOrder：补齐白名单中缺失平台到末尾，保证排序列表完整
const parsePlatformArray = (value: unknown, allowBackfill = false): string[] => {
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    parsed = null
  }

  const valid = (Array.isArray(parsed) ? parsed : []).filter(
    (p) => (BUILTIN_PLATFORMS as readonly string[]).includes(p as string)
  ) as string[]
  if (valid.length === 0) return [...BUILTIN_PLATFORMS]
  if (!allowBackfill) return valid
  // 已存在的按原顺序保留，白名单中缺失的补到末尾（BUILTIN_PLATFORMS 非空，结果必然非空）
  const merged = [...valid]
  for (const p of BUILTIN_PLATFORMS) {
    if (!merged.includes(p)) merged.push(p)
  }
  return merged
}

/** 加载可搜索的插件音源列表：只有声明了搜索能力的插件才作为独立平台 */
const loadPluginPlatforms = async () => {
  try {
    const res = await $fetch<{ data?: PluginPlatformInfo[] }>('/api/music-source-plugins/capabilities')
    // LX Music 音源插件只作为内置平台的解析器，没有搜索 Tab
    cache.pluginPlatforms.value = Array.isArray(res?.data) ? res.data.filter((plugin: any) => plugin?.search === true) : []
  } catch {
    // 拉取失败时清空而非保留旧列表：否则被删除/禁用的插件会一直挂着可用的搜索 Tab
    cache.pluginPlatforms.value = []
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
          enabledPlatforms.value = parsePlatformArray(siteConfig.value.enabledPlatforms, false)
          platformOrder.value = parsePlatformArray(siteConfig.value.platformOrder, true)
          // 插件列表与内置平台一起就绪，避免搜索 Tab 在首屏之后突然插入
          await loadPluginPlatforms()
          loaded.value = true
          return
        }
      } catch {
        // useSiteConfig 数据未就绪，回退到独立 API 请求
      }
    }

    try {
      const res = await $fetch('/api/platform-config')
      enabledPlatforms.value = parsePlatformArray(res.enabledPlatforms, false)
      platformOrder.value = parsePlatformArray(res.platformOrder, true)
      await loadPluginPlatforms()
      loaded.value = true
    } catch {
      // SSR 阶段 $fetch 不可用，保持 loaded=false 让客户端重试
      if (import.meta.server) return
      enabledPlatforms.value = [...BUILTIN_PLATFORMS]
      platformOrder.value = [...BUILTIN_PLATFORMS]
      await loadPluginPlatforms()
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
   * 获取启用的平台列表：内置音源按排序+启用过滤，插件平台始终启用并固定排在内置音源之后
   */
  const getAvailablePlatforms = (): string[] => {
    const builtin = platformOrder.value.filter(
      (p) => (BUILTIN_PLATFORMS as readonly string[]).includes(p) && enabledPlatforms.value.includes(p)
    )
    // 每个插件音源作为独立平台，固定排在内置音源之后
    const pluginPlatforms = cache.pluginPlatforms.value.map((p) => p.platform)
    return [...builtin, ...pluginPlatforms]
  }

  return {
    enabledPlatforms,
    platformOrder,
    loaded,
    pluginPlatforms: cache.pluginPlatforms,
    loadPlatformConfig,
    refreshPlatformConfig,
    getAvailablePlatforms
  }
}
