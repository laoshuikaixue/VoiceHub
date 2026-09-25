import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token'
export const ASTRBOT_BIND_TTL_SECONDS = 600
export const ASTRBOT_PLATFORM_NAMES = [
  'aiocqhttp', 'qq_official', 'qq_official_webhook', 'wecom_ai_bot', 'lark', 'dingtalk'
] as const

/** 绑定码只存摘要；原文仅在创建响应中返回一次。 */
export function createAstrbotBindCode() {
  return randomBytes(12).toString('hex')
}

export function hashAstrbotBindCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export function equalAstrbotToken(actual: string, expected: string) {
  if (!actual || !expected) return false
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** 仅允许带正确适配器 ID 的私聊 UMO；不接受群聊/OtherMessage。 */
export function parseAstrbotPrivateUmo(umo: unknown, platform: unknown) {
  if (typeof umo !== 'string' || typeof platform !== 'string' ||
    umo.length > 512 || !ASTRBOT_PLATFORM_NAMES.includes(platform as typeof ASTRBOT_PLATFORM_NAMES[number])) return null
  const parts = umo.split(':')
  if (parts.length !== 3 || parts[1] !== 'FriendMessage' || !parts[0] || !parts[2] ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    /[\r\n]/.test(umo)) return null
  return { umo, platform }
}

export function normalizeAstrbotBaseUrl(raw: unknown) {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  try {
    const url = new URL(raw.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') return null
    return url.origin
  } catch {
    return null
  }
}
