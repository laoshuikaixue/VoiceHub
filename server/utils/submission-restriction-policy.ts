export type SubmissionRestrictionMode = 'none' | 'semester' | 'window'

export type SubmissionRestrictionScope = 'self' | 'all'

export interface SubmissionRestrictionPolicy {
  mode: SubmissionRestrictionMode
  sameSongHours: number | null
  sameArtistHours: number | null
  scope: SubmissionRestrictionScope
}

export interface SubmissionRestrictionSettings {
  enableSubmissionRestriction?: boolean | null
  sameSongRestrictionHours?: number | string | null
  sameArtistRestrictionHours?: number | string | null
  submissionRestrictionScope?: string | null
}

/** 归一化限制时长：非正整数一律视为未配置 */
export function normalizeRestrictionHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const hours = Math.floor(parsed)
  return hours >= 1 ? hours : null
}

/**
 * 重复投稿限制口径（投稿与预检共用，两处的判定必须完全一致）：
 * - 开关关闭：不做任何重复投稿限制，普通用户可重复投稿已排期或已播放的歌曲
 * - 开关开启且未配置时长：沿用本学期同一首歌不可重复投稿的规则
 * - 开关开启且配置时长：按排期后的冷却窗口判定同一首歌 / 同一歌手
 */
export function resolveSubmissionRestrictionPolicy(
  settings: SubmissionRestrictionSettings | null | undefined
): SubmissionRestrictionPolicy {
  const sameSongHours = normalizeRestrictionHours(settings?.sameSongRestrictionHours)
  const sameArtistHours = normalizeRestrictionHours(settings?.sameArtistRestrictionHours)
  const scope: SubmissionRestrictionScope =
    settings?.submissionRestrictionScope === 'self' ? 'self' : 'all'

  if (!settings?.enableSubmissionRestriction) {
    return { mode: 'none', sameSongHours, sameArtistHours, scope }
  }

  const mode: SubmissionRestrictionMode = sameSongHours || sameArtistHours ? 'window' : 'semester'
  return { mode, sameSongHours, sameArtistHours, scope }
}
