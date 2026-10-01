/**
 * 群聊异常通知的脱敏与限长。
 *
 * 上报到群聊的异常摘要会离开服务端边界，而异常消息里经常夹带连接串、令牌、
 * SQL 参数或第三方响应体。这里做两道处理：按模式屏蔽凭据样式的内容，再截断到
 * 固定长度，保证群成员只看到可判断问题的摘要，而不是内部细节。
 */

/** 群聊异常摘要的最大字符数；超出即截断，避免刷屏与整条消息不可读。 */
export const ASTRBOT_ERROR_DETAIL_MAX_CHARS = 300

/** 截断标记。 */
export const ASTRBOT_ERROR_TRUNCATED = '…（已截断）'

/** 命中即整体替换的凭据模式（顺序重要：连接串 → 方案前缀令牌 → 键值对）。 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  // scheme://user:password@host —— 保留 scheme 与 host，抹掉口令
  /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/g,
  // Authorization: Bearer xxx / Basic xxx —— 必须先于键值对匹配，
  // 否则 `authorization: Bearer` 会把方案词当作已脱敏值、留下真正的令牌。
  /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // PostgreSQL 连接参数形式 password=xxx
  /\bpassword\s*=\s*[^\s;]+/gi,
  // 常见键名后跟的值（token / secret / password / api key 等）
  /\b(?:token|secret|password|passwd|pwd|api[_-]?key|access[_-]?key|authorization|auth|signature)\b\s*[=:]\s*["']?[^\s"',;)]+/gi
]

/**
 * 把任意异常值规范化为可安全发到群聊的摘要。
 *
 * Args:
 *     detail: 异常消息、拒绝值或任意可字符串化的对象。
 *
 * Returns:
 *     已脱敏并截断的摘要；空值时返回「未知错误」。
 */
export function sanitizeAstrbotErrorDetail(detail: unknown): string {
  const text = typeof detail === 'string'
    ? detail
    : detail instanceof Error
      ? detail.message
      : detail === null || detail === undefined
        ? ''
        : String(detail)

  let safe = text.trim()
  for (const pattern of CREDENTIAL_PATTERNS) {
    safe = safe.replace(pattern, (match, prefix?: string) => {
      // 连接串保留 scheme:// 与 @，只抹掉用户名口令，便于定位主机又不见凭据
      if (typeof prefix === 'string' && match.startsWith(prefix) && match.endsWith('@')) {
        return `${prefix}[已脱敏]@`
      }
      return '[已脱敏]'
    })
  }
  safe = safe.replace(/\s+/g, ' ').trim()

  if (!safe) return '未知错误'
  return safe.length > ASTRBOT_ERROR_DETAIL_MAX_CHARS
    ? `${safe.slice(0, ASTRBOT_ERROR_DETAIL_MAX_CHARS - ASTRBOT_ERROR_TRUNCATED.length)}${ASTRBOT_ERROR_TRUNCATED}`
    : safe
}
