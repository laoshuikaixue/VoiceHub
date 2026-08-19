import { db, schedules, songs } from '~/drizzle/db'
import { and, eq, gte, gt, lte, or } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getServerDate } from '~~/server/utils/serverTime'
import { normalizeForMatch } from '~~/server/utils/song-name-normalize'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.SONG_LOGIN_REQUIRED_VIEW_STATUS, '需要登录才能检查投稿限制')
  }

  const body = await readBody(event)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim() : ''

  if (!title || !artist) {
    return { blocked: false, reason: null }
  }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'

  const settings = await getSystemSettingsCached()
  if (!settings?.enableSubmissionRestriction || isAdmin) {
    return { blocked: false, reason: null }
  }

  const sameSongHours = settings.sameSongRestrictionHours ?? null
  const sameArtistHours = settings.sameArtistRestrictionHours ?? null
  const scope = settings.submissionRestrictionScope ?? 'all'

  if (!sameSongHours && !sameArtistHours) {
    return { blocked: false, reason: null }
  }

  const normalizedTitle = normalizeForMatch(title)
  const normalizedArtist = normalizeForMatch(artist)

  const now = getServerDate()
  const maxHours = Math.max(sameSongHours || 0, sameArtistHours || 0)
  const cutoff = new Date(now.getTime() - maxHours * 3600000)

  // 按 scope 构建 where 子句（显式短路，避免依赖 and(undefined) 的版本行为）
  const scopeFilter = scope === 'self' ? eq(songs.requesterId, user.id) : undefined
  const whereClause = and(
    eq(schedules.isDraft, false),
    or(
      and(lte(schedules.playDate, now), gte(schedules.playDate, cutoff)),
      and(
        gt(schedules.playDate, now),
        or(gte(schedules.publishedAt, cutoff), gte(schedules.createdAt, cutoff))
      )
    ),
    ...(scopeFilter ? [scopeFilter] : [])
  )

  const scheduledSongs = await db
    .select({
      sPlayDate: schedules.playDate,
      sCreatedAt: schedules.createdAt,
      sPublishedAt: schedules.publishedAt,
      songTitle: songs.title,
      songArtist: songs.artist,
      songRequesterId: songs.requesterId
    })
    .from(schedules)
    .innerJoin(songs, eq(schedules.songId, songs.id))
    .where(whereClause)

  for (const scheduled of scheduledSongs) {
    const playDate = scheduled.sPlayDate instanceof Date ? scheduled.sPlayDate : new Date(scheduled.sPlayDate)
    const createdAt = scheduled.sCreatedAt instanceof Date ? scheduled.sCreatedAt : new Date(scheduled.sCreatedAt)
    const publishedAt = scheduled.sPublishedAt
      ? (scheduled.sPublishedAt instanceof Date ? scheduled.sPublishedAt : new Date(scheduled.sPublishedAt))
      : null
    const windowStart = playDate.getTime() <= now.getTime()
      ? playDate.getTime()
      : (publishedAt || createdAt).getTime()
    const songWindowMs = (windowStart + (sameSongHours || 0) * 3600000) - now.getTime()
    const artistWindowMs = (windowStart + (sameArtistHours || 0) * 3600000) - now.getTime()
    const songWindowActive = (sameSongHours || 0) > 0 && songWindowMs > 0
    const artistWindowActive = (sameArtistHours || 0) > 0 && artistWindowMs > 0

    if (!songWindowActive && !artistWindowActive) continue

    const scheduledTitleNorm = normalizeForMatch(scheduled.songTitle || '')
    const scheduledArtistNorm = normalizeForMatch(scheduled.songArtist || '')

    if (songWindowActive && scheduledTitleNorm === normalizedTitle && scheduledArtistNorm === normalizedArtist) {
      return {
        blocked: true,
        reason: 'sameSong'
      }
    }

    if (artistWindowActive && scheduledArtistNorm === normalizedArtist) {
      return {
        blocked: true,
        reason: 'sameArtist'
      }
    }
  }

  return { blocked: false, reason: null }
})
