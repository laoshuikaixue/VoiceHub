import { isAstrbotPrivateUmoShape } from './astrbot-notification.ts'

export const ASTRBOT_PLATFORMS = ['qq', 'wecom', 'dingtalk', 'lark'] as const
export type AstrbotPlatform = typeof ASTRBOT_PLATFORMS[number]
export type AstrbotPlatformSettings = Record<AstrbotPlatform, boolean>
export const DEFAULT_ASTRBOT_PLATFORMS: AstrbotPlatformSettings = { qq: false, wecom: false, dingtalk: false, lark: false }

export function parseAstrbotPlatform(value: unknown): AstrbotPlatform | null {
  return typeof value === 'string' && (ASTRBOT_PLATFORMS as readonly string[]).includes(value)
    ? value as AstrbotPlatform : null
}

export function adapterToAstrbotPlatform(adapter: unknown): AstrbotPlatform | null {
  switch (adapter) {
    case 'aiocqhttp': case 'qq_official': case 'qq_official_webhook': return 'qq'
    case 'wecom_ai_bot': return 'wecom'
    case 'dingtalk': return 'dingtalk'
    case 'lark': return 'lark'
    default: return null
  }
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
