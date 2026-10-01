/**
 * 本周歌单显示配置的唯一权威模块。
 *
 * 后台「本周歌单显示项」同时包含排版参数（layoutStyle / listColumns）与布尔显示项，
 * 出图接口（/api/bot/voicehub/weekly-schedule）与旧的纯布尔判定必须共用这里的归一化，
 * 否则排版与列数会被布尔判定吞掉，管理员改了设置也不生效。
 */

export const ASTRBOT_WEEKLY_BOOLEAN_KEYS = [
  'showLogo',
  'showSchoolLogo',
  'showCover',
  'showTitle',
  'showArtist',
  'showRequester',
  'showVotes',
  'showSequence',
  'showPlayTime',
  'showDate'
] as const

export type AstrbotWeeklyBooleanKey = typeof ASTRBOT_WEEKLY_BOOLEAN_KEYS[number]

export const ASTRBOT_WEEKLY_LAYOUTS = ['classic', 'table'] as const

export type AstrbotWeeklyLayout = typeof ASTRBOT_WEEKLY_LAYOUTS[number]

export type AstrbotWeeklyConfig = Record<AstrbotWeeklyBooleanKey, boolean> & {
  layoutStyle: AstrbotWeeklyLayout
  listColumns: 1 | 2
}

export const DEFAULT_ASTRBOT_WEEKLY_CONFIG: AstrbotWeeklyConfig = {
  layoutStyle: 'classic',
  listColumns: 1,
  showLogo: true,
  showSchoolLogo: false,
  showCover: true,
  showTitle: true,
  showArtist: true,
  showRequester: true,
  showVotes: false,
  showSequence: true,
  showPlayTime: true,
  showDate: true
}

export function isAstrbotWeeklyLayout(value: unknown): value is AstrbotWeeklyLayout {
  return typeof value === 'string' && (ASTRBOT_WEEKLY_LAYOUTS as readonly string[]).includes(value)
}

export function isAstrbotWeeklyColumns(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2
}

/**
 * 把持久化（或请求体）中的本周歌单配置归一化为完整配置。
 *
 * 逐项回退默认值，非法取值一律丢弃，保证调用方拿到的结构始终完整可用。
 *
 * @param raw 数据库 jsonb 字段或请求体中的 astrbotWeeklyConfig。
 * @returns 含全部排版参数与布尔显示项的配置。
 */
export function normalizeAstrbotWeeklyConfig(raw: unknown): AstrbotWeeklyConfig {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}

  const config = {
    layoutStyle: isAstrbotWeeklyLayout(source.layoutStyle)
      ? source.layoutStyle
      : DEFAULT_ASTRBOT_WEEKLY_CONFIG.layoutStyle,
    listColumns: isAstrbotWeeklyColumns(source.listColumns)
      ? source.listColumns
      : DEFAULT_ASTRBOT_WEEKLY_CONFIG.listColumns
  } as AstrbotWeeklyConfig

  for (const key of ASTRBOT_WEEKLY_BOOLEAN_KEYS) {
    config[key] = typeof source[key] === 'boolean'
      ? source[key] as boolean
      : DEFAULT_ASTRBOT_WEEKLY_CONFIG[key]
  }
  return config
}

/**
 * 校验后台提交的本周歌单配置是否为完整合法结构。
 *
 * @param raw 请求体中的 astrbotWeeklyConfig。
 * @returns 合法时返回 true，缺项、多项或类型不符返回 false。
 */
export function isValidAstrbotWeeklyConfigInput(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const source = raw as Record<string, unknown>
  if (Object.keys(source).length !== ASTRBOT_WEEKLY_BOOLEAN_KEYS.length + 2) return false
  if (!isAstrbotWeeklyLayout(source.layoutStyle)) return false
  if (!isAstrbotWeeklyColumns(source.listColumns)) return false
  return ASTRBOT_WEEKLY_BOOLEAN_KEYS.every(key => typeof source[key] === 'boolean')
}
