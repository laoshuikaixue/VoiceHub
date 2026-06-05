// 服务端时间同步状态
// 通过模块级变量在 Nitro 服务端共享时间偏移量
let timeOffset = 0
let hasSynced = false

/**
 * 设置服务器时间偏移量
 * timeOffset = 标准时间 - Date.now()
 */
export function setTimeOffset(offset: number): void {
  timeOffset = offset
  hasSynced = true
}

/**
 * 标记时间已同步（即使同步失败，也要标记以防止重复尝试）
 */
export function markSynced(): void {
  hasSynced = true
}

/** 获取当前偏移量 */
export function getTimeOffset(): number {
  return timeOffset
}

/** 是否已完成同步 */
export function isTimeSynced(): boolean {
  return hasSynced
}

/** 获取同步后的服务端时间戳 (毫秒) */
export function getServerTimestamp(): number {
  return Date.now() + timeOffset
}

/** 获取同步后的服务端 Date 对象 */
export function getServerDate(): Date {
  return new Date(getServerTimestamp())
}

// 绑定到 globalThis，供 isomorphic 代码（如 app/utils/timeUtils.ts）安全调用
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).getServerTimestamp = getServerTimestamp
}

/**
 * 尝试从公共 API 获取标准时间并计算服务器的时间偏移量
 */
async function doSyncServerTime() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500)

    const startTime = Date.now()
    const response = await fetch('https://acs.m.taobao.com/gw/mtop.common.getTimestamp/', {
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    const data = await response.json()

    if (data?.data?.t) {
      const endTime = Date.now()
      const latency = Math.round((endTime - startTime) / 2)
      const realTime = parseInt(data.data.t) + latency
      setTimeOffset(realTime - endTime)
      console.log(`[Server TimeSync] 服务器时间同步成功，偏移量: ${getTimeOffset()}ms`)
      return
    }
  } catch (error) {
    console.warn('[Server TimeSync] 淘宝时间同步失败，尝试备用接口', error)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)

      const startTime = Date.now()
      const response = await fetch('https://cube.meituan.com/ipromotion/cube/toc/component/base/getServerCurrentTime', {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await response.json()

      if (data?.data) {
        const endTime = Date.now()
        const latency = Math.round((endTime - startTime) / 2)
        const realTime = parseInt(data.data) + latency
        setTimeOffset(realTime - endTime)
        console.log(`[Server TimeSync] 服务器时间同步成功 (备用)，偏移量: ${getTimeOffset()}ms`)
        return
      }
    } catch (error2) {
      console.error('[Server TimeSync] 服务器时间同步完全失败，将使用系统本地时间:', error2)
      markSynced()
    }
  }
}

let _syncPromise: Promise<void> | null = null

/**
 * 主动触发一次服务端时间同步（单例，防止并发）
 * 不等待同步完成（非阻塞）
 */
export function syncNow(): Promise<void> {
  if (isTimeSynced()) return Promise.resolve()

  if (!_syncPromise) {
    _syncPromise = doSyncServerTime().finally(() => {
      _syncPromise = null
    })
  }

  return _syncPromise
}
