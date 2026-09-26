/**
 * 拉取模式的纯逻辑：模式判定、取件条目序列化与回执校验。
 *
 * 抽到无 Nuxt 别名的模块里，便于 node:test 直接执行；服务层与端点复用同一份实现，
 * 避免「插件能投什么」与「VoiceHub 发什么」两处规则漂移。
 */

/** 仅显式配置为 pull 才走拉取；其余值（含历史数据的 undefined）按 push 处理。 */
export function isAstrbotPullMode(value: unknown) {
  return value === 'pull'
}

export type AstrbotOutboxRow = {
  id: number
  title: string | null
  message: string
  url: string | null
  umos: string[] | null
  broadcast: boolean
  claimToken: string | null
}

export type AstrbotPullItem = {
  id: number
  title: string
  content: string
  url?: string
  umos: string[]
  broadcast: boolean
  claimToken: string
}

/** 把队列行转成插件可消费的取件条目。 */
export function toAstrbotPullItem(row: AstrbotOutboxRow): AstrbotPullItem {
  return {
    id: row.id,
    title: row.title ?? '',
    content: row.message,
    ...(row.url ? { url: row.url } : {}),
    umos: Array.isArray(row.umos) ? row.umos : [],
    broadcast: row.broadcast === true,
    claimToken: row.claimToken ?? ''
  }
}

export type AstrbotAckResult = { id: number; claimToken: string; success: boolean; reason: string; failedUmos: string[] | null }

/**
 * 校验回执请求体。
 *
 * 回执直接决定条目的终态（标记已投递或安排重试），因此形状不合法的整体拒绝，
 * 不做部分接受，避免半截回执把未投递的条目误标为成功。
 */
export function parseAstrbotAckResults(body: unknown): AstrbotAckResult[] | null {
  if (!body || typeof body !== 'object') return null
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results) || !results.length || results.length > 100) return null

  const parsed: AstrbotAckResult[] = []
  for (const raw of results) {
    if (!raw || typeof raw !== 'object') return null
    const record = raw as Record<string, unknown>
    if (!Number.isInteger(record.id) || (record.id as number) <= 0) return null
    if (typeof record.success !== 'boolean') return null
    if (typeof record.claimToken !== 'string' || !/^[a-f0-9]{64}$/.test(record.claimToken)) return null
    const failedUmos = record.failedUmos
    if (failedUmos !== undefined && (!Array.isArray(failedUmos) || !failedUmos.length || failedUmos.length > 200 ||
      failedUmos.some((umo) => typeof umo !== 'string' || !umo || umo.length > 512) ||
      new Set(failedUmos).size !== failedUmos.length || record.success)) return null
    parsed.push({
      id: record.id as number,
      claimToken: record.claimToken,
      success: record.success,
      reason: typeof record.reason === 'string' ? record.reason : '',
      failedUmos: Array.isArray(failedUmos) ? failedUmos : null
    })
  }
  return parsed
}

/** VoiceHub 侧对单条通知的尝试上限；超过后停止重试。 */
export const ASTRBOT_OUTBOX_MAX_ATTEMPTS = 3

/** 达到上限即标记失败，否则释放租约等待下次轮询重试。 */
export function isAstrbotOutboxExhausted(attempts: number) {
  return attempts >= ASTRBOT_OUTBOX_MAX_ATTEMPTS
}
