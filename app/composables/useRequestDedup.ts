import { ref } from 'vue'

interface PendingRequest {
  promise: Promise<any>
  timestamp: number
}

// 请求去重超时时间
const REQUEST_DEDUP_TIMEOUT = 5000 // 5秒

export const useRequestDedup = () => {
  // 正在进行的请求（用于去重）
  const pendingRequests = ref<Map<string, PendingRequest>>(new Map())

  // 生成请求键
  const generateRequestKey = (type: string, params?: Record<string, any>): string => {
    if (!params || Object.keys(params).length === 0) {
      return type
    }
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&')
    return `${type}?${sortedParams}`
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

    keysToDelete.forEach((key) => pendingRequests.value.delete(key))
  }

  // 带去重的请求函数
  const dedupedRequest = async <T>(
    type: string,
    requestFn: () => Promise<T>,
    params?: Record<string, any>
  ): Promise<T> => {
    const requestKey = generateRequestKey(type, params)

    // 清理过期的请求
    cleanupPendingRequests()

    // 检查是否有相同的请求正在进行
    const pendingRequest = pendingRequests.value.get(requestKey)
    if (pendingRequest) {
      try {
        return await pendingRequest.promise
      } catch (error) {
        // 如果请求失败，移除pending状态
        pendingRequests.value.delete(requestKey)
        throw error
      }
    }

    // 创建新的请求
    const promise = requestFn()
    pendingRequests.value.set(requestKey, {
      promise,
      timestamp: Date.now()
    })

    try {
      const data = await promise

      // 移除pending状态
      pendingRequests.value.delete(requestKey)

      return data
    } catch (error) {
      // 请求失败时移除pending状态
      pendingRequests.value.delete(requestKey)
      throw error
    }
  }

  // 清除所有pending请求
  const clearAllPendingRequests = (): void => {
    pendingRequests.value.clear()
  }

  // 获取pending请求统计
  const getPendingStats = () => {
    return {
      totalPendingRequests: pendingRequests.value.size,
      pendingByType: {} as Record<string, number>
    }
  }

  return {
    // 核心去重方法
    dedupedRequest,

    // 管理方法
    clearAllPendingRequests,
    cleanupPendingRequests,

    // 工具方法
    generateRequestKey,
    getPendingStats
  }
}

// 全局去重实例
let globalDedupInstance: ReturnType<typeof useRequestDedup> | null = null

export const getGlobalDedup = () => {
  if (!globalDedupInstance) {
    globalDedupInstance = useRequestDedup()
  }
  return globalDedupInstance
}
