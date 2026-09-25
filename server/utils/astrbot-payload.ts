import { isSupportedAstrbotPlatform } from './astrbot-notification.ts'

/**
 * AstrBot 推送的请求体预算。
 *
 * 插件侧 aiohttp 的 client_max_size 为 64 KiB，这里留出余量后取 60 KiB；
 * 偏小只会导致多切一块，偏大则会被插件以 413 拒绝。
 */
export const ASTRBOT_PAYLOAD_MAX_BYTES = 60 * 1024
export const ASTRBOT_MAX_TARGETS_PER_REQUEST = 200

/** 按真实 UTF-8 字节数计算请求体大小；正文里的非 ASCII 字符会占多个字节。 */
export function astrbotPayloadBytes(umos: string[], title: string, content: string, group = false) {
  return Buffer.byteLength(JSON.stringify({ title, content, targets: { umo: umos, group } }))
}

export function fitsAstrbotPayload(umos: string[], title: string, content: string, group = false) {
  return astrbotPayloadBytes(umos, title, content, group) <= ASTRBOT_PAYLOAD_MAX_BYTES
}

/**
 * 把目标切分为多个请求：单请求不超过 200 个目标，且请求体不超过
 * ASTRBOT_PAYLOAD_MAX_BYTES。单目标本身就超限时计入 skipped，由调用方上报失败。
 */
export function chunkAstrbotTargets(umos: string[], title: string, content: string) {
  const chunks: string[][] = []
  let skipped = 0
  for (const umo of umos) {
    if (!fitsAstrbotPayload([umo], title, content)) {
      skipped++
      continue
    }
    const chunk = chunks[chunks.length - 1]
    if (!chunk || chunk.length >= ASTRBOT_MAX_TARGETS_PER_REQUEST ||
      !fitsAstrbotPayload([...chunk, umo], title, content)) {
      chunks.push([umo])
    } else {
      chunk.push(umo)
    }
  }
  return { chunks, skipped }
}

/**
 * 确认私聊目标：只有同时满足「UMO 命中绑定行」与「该行记录的平台仍在白名单内」
 * 的目标才算通过。UMO 前缀是 AstrBot 的平台实例 ID（可被改名），因此不能拿
 * 前缀比对适配器名。
 */
export function selectConfirmedAstrbotTargets(
  rows: Array<{ umo?: string | null; platform?: string | null }>,
  umos: string[]
) {
  const confirmed = new Set(
    rows.filter((row) => isSupportedAstrbotPlatform(row.platform)).map((row) => row.umo)
  )
  return confirmed.size === umos.length && umos.every((umo) => confirmed.has(umo))
}
