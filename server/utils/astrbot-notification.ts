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

/** 平台标识是否在受支持的适配器白名单内。 */
export function isSupportedAstrbotPlatform(value: unknown): value is string {
  return typeof value === 'string' &&
    (ASTRBOT_PLATFORM_NAMES as readonly string[]).includes(value)
}

/**
 * 仅校验私聊 UMO 的形态，不限定平台标识。
 *
 * AstrBot 的 UMO 前缀取自平台实例 ID（platform_meta.id），它可以被管理员
 * 改成任意合法字符串，因此不能要求它等于适配器名；适配器是否受支持改由
 * 绑定阶段记录的 platform 字段判定。
 */
export function isAstrbotPrivateUmoShape(umo: unknown): umo is string {
  if (typeof umo !== 'string' || umo.length > 512) return false
  const parts = umo.split(':')
  return parts.length === 3 && parts[1] === 'FriendMessage' && !!parts[0] && !!parts[2] &&
    /^[A-Za-z0-9_-]+$/.test(parts[0]) && !/[\r\n]/.test(umo)
}

/** 仅允许带正确适配器 ID 的私聊 UMO；不接受群聊/OtherMessage。 */
export function parseAstrbotPrivateUmo(umo: unknown, platform: unknown) {
  if (!isSupportedAstrbotPlatform(platform)) return null
  return isAstrbotPrivateUmoShape(umo) ? { umo, platform } : null
}

/**
 * 校验 UMO 形态，并要求其前缀本身是一个受支持的适配器名。
 *
 * 注意：AstrBot 的 UMO 前缀取自平台实例 ID（可被管理员改名），并不保证等于
 * 适配器名，因此**不要**用本函数校验推送目标；目标确认请用绑定表的
 * `astrbotPlatform` 列（见 selectConfirmedAstrbotTargets）。
 */
export function isSupportedAstrbotPrivateUmo(umo: unknown): umo is string {
  return isAstrbotPrivateUmoShape(umo) &&
    parseAstrbotPrivateUmo(umo, umo.split(':')[0]) !== null
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
