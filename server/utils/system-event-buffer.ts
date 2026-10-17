import { getServerTimestamp } from './serverTime'
import { SYSTEM_BOARD_CONSTANTS, type SystemBoardEventLevel } from '~~/server/config/constants'
import { sanitizeAstrbotErrorDetail } from './astrbot-error-telemetry'

export type SystemEventLevel = SystemBoardEventLevel

export interface SystemRuntimeEvent {
  id: number
  level: SystemEventLevel
  /** 事件来源标识，如 unhandledRejection、request、healthcheck */
  source: string
  message: string
  /** 附加上下文，仅存排错所需的非敏感摘要 */
  detail?: string
  /** UTC 毫秒时间戳 */
  timestamp: number
}

let seq = 0
let events: SystemRuntimeEvent[] = []

/**
 * 记录一条进程内运行事件。
 * 只保留最近 BUFFER_SIZE 条，不写库、不落盘；进程重启即清空。
 * 消息可能夹带连接串/令牌，入缓冲前统一脱敏。
 */
export function recordRuntimeEvent(
  level: SystemEventLevel,
  source: string,
  message: unknown,
  detail?: string
): void {
  try {
    const text = sanitizeAstrbotErrorDetail(message)
    if (!text) return

    events.push({
      id: ++seq,
      level,
      source,
      message: text,
      detail: detail ? sanitizeAstrbotErrorDetail(detail) : undefined,
      timestamp: getServerTimestamp()
    })

    if (events.length > SYSTEM_BOARD_CONSTANTS.BUFFER_SIZE) {
      events = events.slice(-SYSTEM_BOARD_CONSTANTS.BUFFER_SIZE)
    }
  } catch {
    // 事件采集本身不得成为新的异常源
  }
}

/**
 * 按新→旧读取缓冲。
 * @param options.level 只取指定级别（此处按精确级别过滤）
 * @returns items 为截断后的事件，hasMore 表示缓冲中还有更早的同级别事件未返回
 */
export function listRuntimeEvents(options: {
  level?: SystemEventLevel
  limit?: number
} = {}): { items: SystemRuntimeEvent[]; hasMore: boolean } {
  const limit = Math.min(
    Math.max(options.limit ?? SYSTEM_BOARD_CONSTANTS.DEFAULT_EVENT_LIMIT, 1),
    SYSTEM_BOARD_CONSTANTS.MAX_EVENT_LIMIT
  )

  const list = options.level ? events.filter((item) => item.level === options.level) : events
  const items = list.slice(-limit)

  return { items: items.reverse(), hasMore: list.length > items.length }
}

/** 清空缓冲，返回清除条数 */
export function clearRuntimeEvents(): number {
  const removed = events.length
  events = []
  return removed
}

/** 缓冲占用情况，供看板展示 */
export function getRuntimeEventsMeta() {
  return {
    size: events.length,
    bufferSize: SYSTEM_BOARD_CONSTANTS.BUFFER_SIZE
  }
}
