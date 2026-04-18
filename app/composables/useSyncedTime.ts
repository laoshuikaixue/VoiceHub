// 全局状态，保存本地时间与服务器时间的差值
// offset = serverTime - localTime
// 仅在客户端有效，服务端默认为0且不进行同步
let timeOffset = 0
let hasSynced = false

/**
 * 获取当前修正后的时间戳 (毫秒)
 * 可以在任何地方（包括非 Vue 组件环境）安全调用
 */
export const getSyncedTimestamp = (): number => {
  return Date.now() + timeOffset
}

/**
 * 获取当前修正后的 Date 对象
 */
export const getSyncedDate = (): Date => {
  return new Date(getSyncedTimestamp())
}

export function useSyncedTime() {
  /**
   * 同步服务器时间
   * 直接调用本站后端提供的 API（/api/sys/time），以彻底解决任何第三方 API 的 CORS 拦截问题。
   * 此方法最可靠，并且能够直接对齐后端服务器时间。
   */
  const syncTime = async () => {
    // 服务端本身的时间就是服务器时间，不需要同步
    if (import.meta.server) {
      hasSynced = true
      return
    }

    if (hasSynced) return
    
    try {
      const startTime = Date.now()
      // 请求我们自己的后端以获取标准时间戳，避免 CORS
      const data = await $fetch<{ timestamp: number }>('/api/sys/time')
      
      if (data?.timestamp) {
        const endTime = Date.now()
        // 估算单向传输延迟
        const latency = (endTime - startTime) / 2
        const serverTime = data.timestamp + latency
        
        timeOffset = serverTime - endTime
        hasSynced = true
        
        console.log(`[TimeSync] 时间同步完成，与服务器时间相差 ${timeOffset}ms`)
      }
    } catch (error) {
      console.error('[TimeSync] 时间同步失败，将使用本地时间:', error)
      hasSynced = true // 避免反复重试
    }
  }

  return {
    get offset() { return timeOffset },
    get hasSynced() { return hasSynced },
    syncTime,
    now: getSyncedTimestamp,
    nowDate: getSyncedDate
  }
}
