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
