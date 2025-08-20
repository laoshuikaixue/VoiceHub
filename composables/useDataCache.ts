import { ref, computed } from 'vue'

interface CacheItem<T> {
  data: T
  timestamp: number
  expiry: number
}

interface PendingRequest {
  promise: Promise<any>
  timestamp: number
}

// 缓存配置 - 禁用数据库缓存，确保每次都请求数据库
const CACHE_CONFIG = {
  songs: 0, // 禁用缓存，每次都请求数据库
  publicSchedules: 0, // 禁用缓存，每次都请求数据库
  songCount: 0, // 禁用缓存，每次都请求数据库
  notifications: 0, // 禁用缓存，每次都请求数据库
  notificationSettings: 0, // 禁用缓存，每次都请求数据库
  siteConfig: 0, // 禁用缓存，每次都请求数据库
}

// 请求去重超时时间
const REQUEST_DEDUP_TIMEOUT = 5000 // 5秒

export const useDataCache = () => {
  // 缓存存储
  const cache = ref<Map<string, CacheItem<any>>>(new Map())
  
  // 正在进行的请求（用于去重）
  const pendingRequests = ref<Map<string, PendingRequest>>(new Map())
  
  // 生成缓存键
  const generateCacheKey = (type: string, params?: Record<string, any>): string => {
    if (!params || Object.keys(params).length === 0) {
      return type
    }
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    return `${type}?${sortedParams}`
  }
  
  // 检查缓存是否有效
  const isCacheValid = (cacheKey: string): boolean => {
    const item = cache.value.get(cacheKey)
    if (!item) return false
    
    const now = Date.now()
    return now < item.timestamp + item.expiry
  }
  
  // 获取缓存数据
  const getCachedData = <T>(cacheKey: string): T | null => {
    if (!isCacheValid(cacheKey)) {
      cache.value.delete(cacheKey)
      return null
    }
    
    const item = cache.value.get(cacheKey)
    return item ? item.data : null
  }
  
  // 设置缓存数据
  const setCachedData = <T>(cacheKey: string, data: T, expiry: number): void => {
    cache.value.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiry
    })
  }
  
  // 清除特定类型的缓存
  const clearCacheByType = (type: string): void => {
    const keysToDelete: string[] = []
    cache.value.forEach((_, key) => {
      if (key.startsWith(type)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => cache.value.delete(key))
  }
  
  // 清除所有缓存
  const clearAllCache = (): void => {
    cache.value.clear()
  }
  
  // 清理过期的请求
  const cleanupPendingRequests = (): void => {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    pendingRequests.value.forEach((request, key) => {
      if (now - request.timestamp > REQUEST_DEDUP_TIMEOUT) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => pendingRequests.value.delete(key))
  }
  
  // 带缓存和去重的请求函数
  const cachedRequest = async <T>(
    type: keyof typeof CACHE_CONFIG,
    requestFn: () => Promise<T>,
    params?: Record<string, any>,
    forceRefresh = false
  ): Promise<T> => {
    const cacheKey = generateCacheKey(type, params)
    
    // 如果不强制刷新，先检查缓存
    if (!forceRefresh) {
      const cachedData = getCachedData<T>(cacheKey)
      if (cachedData !== null) {
        return cachedData
      }
    }
    
    // 清理过期的请求
    cleanupPendingRequests()
    
    // 检查是否有相同的请求正在进行
    const pendingRequest = pendingRequests.value.get(cacheKey)
    if (pendingRequest) {
      try {
        return await pendingRequest.promise
      } catch (error) {
        // 如果请求失败，移除pending状态
        pendingRequests.value.delete(cacheKey)
        throw error
      }
    }
    
    // 创建新的请求
    const promise = requestFn()
    pendingRequests.value.set(cacheKey, {
      promise,
      timestamp: Date.now()
    })
    
    try {
      const data = await promise
      
      // 缓存结果
      const expiry = CACHE_CONFIG[type]
      setCachedData(cacheKey, data, expiry)
      
      // 移除pending状态
      pendingRequests.value.delete(cacheKey)
      
      return data
    } catch (error) {
      // 请求失败时移除pending状态
      pendingRequests.value.delete(cacheKey)
      throw error
    }
  }
  
  // 预加载数据
  const preloadData = async <T>(
    type: keyof typeof CACHE_CONFIG,
    requestFn: () => Promise<T>,
    params?: Record<string, any>
  ): Promise<void> => {
    try {
      await cachedRequest(type, requestFn, params)
    } catch (error) {
      // 预加载失败不抛出错误，只记录日志
      console.warn(`预加载 ${type} 失败:`, error)
    }
  }
  
  // 批量预加载
  const batchPreload = async (preloadTasks: Array<{
    type: keyof typeof CACHE_CONFIG
    requestFn: () => Promise<any>
    params?: Record<string, any>
  }>): Promise<void> => {
    const promises = preloadTasks.map(task => 
      preloadData(task.type, task.requestFn, task.params)
    )
    
    await Promise.allSettled(promises)
  }
  
  // 获取缓存统计信息
  const getCacheStats = () => {
    const stats = {
      totalItems: cache.value.size,
      pendingRequests: pendingRequests.value.size,
      cacheByType: {} as Record<string, number>
    }
    
    cache.value.forEach((_, key) => {
      const type = key.split('?')[0]
      stats.cacheByType[type] = (stats.cacheByType[type] || 0) + 1
    })
    
    return stats
  }
  
  // 智能刷新：只刷新过期或即将过期的数据
  const smartRefresh = async (refreshTasks: Array<{
    type: keyof typeof CACHE_CONFIG
    requestFn: () => Promise<any>
    params?: Record<string, any>
    threshold?: number // 提前刷新阈值（毫秒）
  }>): Promise<void> => {
    const now = Date.now()
    const tasksToRefresh: typeof refreshTasks = []
    
    refreshTasks.forEach(task => {
      const cacheKey = generateCacheKey(task.type, task.params)
      const item = cache.value.get(cacheKey)
      const threshold = task.threshold || CACHE_CONFIG[task.type] * 0.2 // 默认20%阈值
      
      if (!item || (now + threshold) >= (item.timestamp + item.expiry)) {
        tasksToRefresh.push(task)
      }
    })
    
    if (tasksToRefresh.length > 0) {
      const promises = tasksToRefresh.map(task => 
        cachedRequest(task.type, task.requestFn, task.params, true)
      )
      
      await Promise.allSettled(promises)
    }
  }
  
  return {
    // 核心缓存方法
    cachedRequest,
    
    // 缓存管理
    getCachedData,
    setCachedData,
    clearCacheByType,
    clearAllCache,
    isCacheValid,
    
    // 预加载和批量操作
    preloadData,
    batchPreload,
    smartRefresh,
    
    // 工具方法
    generateCacheKey,
    getCacheStats,
    
    // 响应式数据
    cache: computed(() => cache.value),
    pendingRequests: computed(() => pendingRequests.value)
  }
}

// 全局缓存实例
let globalCacheInstance: ReturnType<typeof useDataCache> | null = null

export const getGlobalCache = () => {
  if (!globalCacheInstance) {
    globalCacheInstance = useDataCache()
  }
  return globalCacheInstance
}