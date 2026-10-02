import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { isAstrbotPrivateUmoShape } from './astrbot-platforms.ts'

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

/** 平台标识是否在受支持的适配器白名单内。 */
export function isSupportedAstrbotPlatform(value: unknown): value is string {
  return typeof value === 'string' &&
    (ASTRBOT_PLATFORM_NAMES as readonly string[]).includes(value)
}

/** 仅允许带正确适配器 ID 的私聊 UMO；不接受群聊/OtherMessage。 */
export function parseAstrbotPrivateUmo(umo: unknown, platform: unknown) {
  if (!isSupportedAstrbotPlatform(platform)) return null
  return isAstrbotPrivateUmoShape(umo) ? { umo, platform } : null
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
