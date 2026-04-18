import { defineEventHandler } from 'h3'

let timeOffset = 0
let hasSynced = false
let syncPromise: Promise<void> | null = null

/**
 * 尝试从公共 API 获取标准时间并计算服务器的时间偏移量
 * 优先使用淘宝/美团的 HTTP 接口，因为不需要 UDP (NTP 协议) 的支持
 */
async function doSyncServerTime() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500)
    
    const startTime = Date.now()
    // 尝试淘宝时间接口
    const response = await fetch('https://acs.m.taobao.com/gw/mtop.common.getTimestamp/', {
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    const data = await response.json()
    
    if (data?.data?.t) {
      const endTime = Date.now()
      const latency = Math.round((endTime - startTime) / 2)
      const realTime = parseInt(data.data.t) + latency
      timeOffset = realTime - endTime
      hasSynced = true
      console.log(`[Server TimeSync] 服务器时间同步成功，偏移量: ${timeOffset}ms`)
      return
    }
  } catch (error) {
    console.warn('[Server TimeSync] 淘宝时间同步失败，尝试备用接口', error)
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)
      
      const startTime = Date.now()
      // 尝试美团时间接口
      const response = await fetch('https://cube.meituan.com/ipromotion/cube/toc/component/base/getServerCurrentTime', {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await response.json()
      
      if (data?.data) {
        const endTime = Date.now()
        const latency = Math.round((endTime - startTime) / 2)
        const realTime = parseInt(data.data) + latency
        timeOffset = realTime - endTime
        hasSynced = true
        console.log(`[Server TimeSync] 服务器时间同步成功 (备用)，偏移量: ${timeOffset}ms`)
        return
      }
    } catch (error2) {
      console.error('[Server TimeSync] 服务器时间同步完全失败，将使用系统本地时间:', error2)
      hasSynced = true // 标记为已同步以防止重复请求，使用默认偏移 0
    }
  }
}

async function syncServerTime() {
  if (hasSynced) return
  
  if (!syncPromise) {
    syncPromise = doSyncServerTime().finally(() => {
      syncPromise = null
    })
  }
  
  return syncPromise
}

export default defineEventHandler(async () => {
  // 如果服务器自身还没同步过时间，则先进行同步
  if (!hasSynced) {
    // 设置 2 秒超时，防止因为同步时间导致接口阻塞太久
    await Promise.race([
      syncServerTime(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ])
  }

  // 返回修正后的标准时间戳
  return {
    timestamp: Date.now() + timeOffset
  }
})
