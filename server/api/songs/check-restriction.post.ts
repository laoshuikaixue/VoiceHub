import { db, schedules, semesters, songs } from '~/drizzle/db'
import { and, eq, gte, gt, lte, or } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getServerDate } from '~~/server/utils/serverTime'
import { normalizeForMatch } from '~~/server/utils/song-name-normalize'
import { resolveSubmissionRestrictionPolicy } from '~~/server/utils/submission-restriction-policy'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

type RestrictionCheck = {
  blocked: boolean
  reason: string | null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.SONG_LOGIN_REQUIRED_VIEW_STATUS, '需要登录才能检查投稿限制')
  }

  const body = await readBody(event)
  const isBatch = Array.isArray(body?.songs)
  const candidates = (isBatch ? body.songs : [body]).slice(0, 20).map((song) => ({
    title: typeof song?.title === 'string' ? song.title.trim() : '',
    artist: typeof song?.artist === 'string' ? song.artist.trim() : '',
    musicPlatform: typeof song?.musicPlatform === 'string' ? song.musicPlatform : '',
    musicId:
      typeof song?.musicId === 'string' || typeof song?.musicId === 'number'
        ? String(song.musicId)
        : ''
  }))
  const respond = (checks: RestrictionCheck[]) =>
    isBatch ? { checks } : checks[0] || { blocked: false, reason: null }
  const allowedChecks = candidates.map(() => ({ blocked: false, reason: null }))

  if (candidates.length === 0) {
    return respond(allowedChecks)
  }

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SONG_ADMIN'].includes(user.role)

  const settings = await getSystemSettingsCached()
  const restrictionPolicy = resolveSubmissionRestrictionPolicy(settings)
  if (restrictionPolicy.mode === 'none' || isAdmin) {
    return respond(allowedChecks)
  }

  const { sameSongHours, sameArtistHours, scope } = restrictionPolicy

  const normalizedCandidates = candidates.map((song) => ({
    ...song,
    title: normalizeForMatch(song.title),
    artist: normalizeForMatch(song.artist)
  }))

  // 开关开启但未配置冷却时长时，沿用旧规则：本学期已有的同一首歌不可再次投稿。
  if (restrictionPolicy.mode === 'semester') {
    const currentSemesterResult = await db
      .select({ name: semesters.name })
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1)
    const currentSemester = currentSemesterResult[0]

    if (!currentSemester) {
      return respond(allowedChecks)
    }

    const semesterSongs = await db
      .select({ title: songs.title, artist: songs.artist })
      .from(songs)
      .where(eq(songs.semester, currentSemester.name))

    const normalizedSemesterSongs = semesterSongs.map((song) => ({
      title: normalizeForMatch(song.title || ''),
      artist: normalizeForMatch(song.artist || '')
    }))

    const checks = normalizedCandidates.map((song) => {
      if (!song.title || !song.artist) return { blocked: false, reason: null }

      // Bilibili 的旧规则按视频分集 ID 判断，批量预检不以标题误判不同分集。
      const hasBilibiliMusicId =
        !!song.musicId &&
        (song.musicPlatform === 'bilibili' ||
          song.musicId.startsWith('BV') ||
          song.musicId.startsWith('av'))
      if (hasBilibiliMusicId) return { blocked: false, reason: null }

      const alreadySubmitted = normalizedSemesterSongs.some((existingSong) =>
        existingSong.title === song.title && existingSong.artist === song.artist
      )
      return { blocked: alreadySubmitted, reason: alreadySubmitted ? 'duplicateSong' : null }
    })

    return respond(checks)
  }

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

  const normalizedScheduledSongs = scheduledSongs.map((scheduled) => {
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

    return {
      title: normalizeForMatch(scheduled.songTitle || ''),
      artist: normalizeForMatch(scheduled.songArtist || ''),
      songWindowActive,
      artistWindowActive
    }
  })

  const checks = normalizedCandidates.map((song) => {
    if (!song.title || !song.artist) return { blocked: false, reason: null }

    const sameSong = normalizedScheduledSongs.some((scheduled) =>
      scheduled.songWindowActive && scheduled.title === song.title && scheduled.artist === song.artist
    )
    if (sameSong) return { blocked: true, reason: 'sameSong' }

    const sameArtist = normalizedScheduledSongs.some((scheduled) =>
      scheduled.artistWindowActive && scheduled.artist === song.artist
    )
    return sameArtist ? { blocked: true, reason: 'sameArtist' } : { blocked: false, reason: null }
  })

  return respond(checks)
})
