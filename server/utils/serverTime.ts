/**
 * 服务器时间工具
 */

/** 获取服务端时间戳 (毫秒) */
export function getServerTimestamp(): number {
  return Date.now()
}

/** 获取服务端 Date 对象 */
export function getServerDate(): Date {
  return new Date()
}

// 绑定到 globalThis，供 isomorphic 代码（如 app/utils/timeUtils.ts）安全调用
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).getServerTimestamp = getServerTimestamp
}
