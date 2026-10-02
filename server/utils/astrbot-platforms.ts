import { classifyAstrbotAdapter as adapterToAstrbotPlatform } from './astrbot-adapters.js'

export { classifyAstrbotAdapter as adapterToAstrbotPlatform } from './astrbot-adapters.js'

export const ASTRBOT_PLATFORMS = ['qq', 'wecom', 'dingtalk', 'lark'] as const
export type AstrbotPlatform = typeof ASTRBOT_PLATFORMS[number]
export type AstrbotPlatformSettings = Record<AstrbotPlatform, boolean>
export const DEFAULT_ASTRBOT_PLATFORMS: AstrbotPlatformSettings = { qq: false, wecom: false, dingtalk: false, lark: false }

/** 仅校验私聊 UMO 的形态，不依赖服务端加密模块，前端配置页也可安全复用。 */
export function isAstrbotPrivateUmoShape(umo: unknown): umo is string {
  if (typeof umo !== 'string' || umo.length > 512) return false
  const parts = umo.split(':')
  return parts.length === 3 && parts[1] === 'FriendMessage' && !!parts[0] && !!parts[2] &&
    !/[\s\p{Cc}]/u.test(parts[0]) && !/[\r\n]/.test(umo)
}

export function parseAstrbotPlatform(value: unknown): AstrbotPlatform | null {
  return typeof value === 'string' && (ASTRBOT_PLATFORMS as readonly string[]).includes(value)
    ? value as AstrbotPlatform : null
}

export function isAstrbotPlatformEnabled(settings: unknown, platform: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  const key = parseAstrbotPlatform(platform)
  return key !== null && (settings as Record<string, unknown>)[key] === true
}

export function selectAstrbotTargets(rows: Array<{
  umo?: string | null; adapter?: string | null; platform?: string | null; enabled?: boolean | null
}>, settings: unknown): string[] {
  return [...new Set(rows.filter((row) => row.enabled !== false &&
    isAstrbotPlatformEnabled(settings, row.platform) &&
    adapterToAstrbotPlatform(row.adapter) === row.platform &&
    isAstrbotPrivateUmoShape(row.umo)).map((row) => row.umo!))]
}
