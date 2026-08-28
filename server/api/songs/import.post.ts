import { defineEventHandler, createError, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs, semesters, songBlacklists } from '~/drizzle/schema'
import { eq, inArray, and, asc } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { getServerDate } from '~~/server/utils/serverTime'
import { backfillMissingSongDurations } from '~~/server/services/durationValidationService'
import { normalizeStoredDuration } from '~~/server/utils/song-duration-policy'
import { matchBlacklistGenre, matchBlacklistLanguage, resolveSongTypes } from '~~/server/utils/song-type-resolver'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_LOGIN_REQUIRED', '需要登录')
  }

  const body = await readBody(event)
  const { songIds } = body

  if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
    throw createApiError(400, 'SONG_SELECT_TO_IMPORT', '请选择要导入的歌曲')
  }

  // 获取当前活跃学期
  const activeSemester = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1)
    .then((res) => res[0])

  const currentSemesterName = activeSemester?.name

  if (!currentSemesterName) {
    throw createApiError(400, 'SONG_NO_ACTIVE_SEMESTER_IMPORT', '系统未设置当前活跃学期，无法导入歌曲。请联系管理员先设置活跃学期。')
  }

  // 获取原始歌曲数据，确保只能获取自己投稿的歌曲，并按创建时间排序
  const originalSongs = await db
    .select()
    .from(songs)
    .where(
      and(
        inArray(songs.id, songIds),
        eq(songs.requesterId, user.id) // 强制检查所有权
      )
    )
    .orderBy(asc(songs.createdAt)) // 按创建时间正序排列，保持原有顺序

  if (originalSongs.length === 0) {
    return { success: true, count: 0, results: { total: 0, success: 0, failed: 0, details: [] } }
  }

  // 获取黑名单
  const blacklistItems = await db
    .select()
    .from(songBlacklists)
    .where(eq(songBlacklists.isActive, true))

  // 获取当前学期已存在的歌曲，用于排重
  const existingSongs = await db
    .select({
      title: songs.title,
      artist: songs.artist
    })
    .from(songs)
    .where(eq(songs.semester, currentSemesterName))

  const existingSet = new Set(
    existingSongs.map((s) => `${s.title.toLowerCase().trim()}|${s.artist.toLowerCase().trim()}`)
  )

  const results = {
    total: originalSongs.length,
    success: 0,
    failed: 0,
    details: [] as string[]
  }

  const songsToInsert: (typeof songs.$inferInsert)[] = []
  const now = getServerDate()

  for (const song of originalSongs) {
    const songKey = `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`

    // 1. 检查是否重复
    if (existingSet.has(songKey)) {
      results.failed++
      results.details.push(`《${song.title}》: 当前学期已存在，跳过`)
      continue
    }

    // 2. 检查黑名单
    const songFullName = `${song.title} - ${song.artist || ''}`.toLowerCase()
    let isBlocked = false
    let blockReason = ''

    // 语种/曲风懒解析：首次遇到类型项才请求音源，已被歌名/关键词拦截的歌曲不触发外部请求
    let songTypes: Awaited<ReturnType<typeof resolveSongTypes>> = null
    let typesResolved = false

    for (const item of blacklistItems) {
      if (item.type === 'SONG') {
        if (songFullName.includes(item.value.toLowerCase())) {
          isBlocked = true
          blockReason = item.reason || '黑名单歌曲'
          break
        }
      } else if (item.type === 'KEYWORD') {
        if (songFullName.includes(item.value.toLowerCase())) {
          isBlocked = true
          blockReason = item.reason || '包含违规关键词'
          break
        }
      } else if (item.type === 'LANGUAGE') {
        // 解析失败或平台不支持时返回 null，类型黑名单放行
        if (!typesResolved) {
          songTypes = await resolveSongTypes(song.musicPlatform, song.musicId)
          typesResolved = true
        }
        if (songTypes && matchBlacklistLanguage(item.value, songTypes.languages)) {
          isBlocked = true
          blockReason = item.reason || `语种「${item.value}」已被加入黑名单`
          break
        }
      } else if (item.type === 'GENRE') {
        if (!typesResolved) {
          songTypes = await resolveSongTypes(song.musicPlatform, song.musicId)
          typesResolved = true
        }
        if (songTypes && matchBlacklistGenre(item.value, songTypes.genres)) {
          isBlocked = true
          blockReason = item.reason || `曲风「${item.value}」已被加入黑名单`
          break
        }
      }
    }

    if (isBlocked) {
      results.failed++
      results.details.push(`《${song.title}》: ${blockReason}，跳过`)
      continue
    }

    // 3. 准备插入数据
    songsToInsert.push({
      title: song.title,
      artist: song.artist,
      requesterId: user.id, // 强制使用当前登录用户的ID
      played: false,
      playedAt: null,
      semester: currentSemesterName,
      preferredPlayTimeId: null, // 重置偏好时间
      cover: song.cover,
      playUrl: song.playUrl,
      musicPlatform: song.musicPlatform,
      musicId: song.musicId,
      durationSeconds: normalizeStoredDuration(song.durationSeconds),
      createdAt: now,
      updatedAt: now
    })

    // 将即将插入的歌曲也加入判重集合，防止同一次请求中有重复歌曲
    existingSet.add(songKey)
  }

  // 批量插入
  if (songsToInsert.length > 0) {
    const insertedSongs = await db
      .insert(songs)
      .values(songsToInsert)
      .returning({
        id: songs.id,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        durationSeconds: songs.durationSeconds
      })

    results.success = insertedSongs.length

    // 往期投稿多数早于时长字段上线，缺失的时长放到响应后的后台任务补齐
    const missingDurationSongs = insertedSongs.filter((song) => song.durationSeconds == null)
    if (missingDurationSongs.length > 0) {
      const durationTask = backfillMissingSongDurations(missingDurationSongs, '往期导入')
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(durationTask)
      } else {
        durationTask.catch((error) => console.error('[往期导入] 后台补齐时长失败:', error))
      }
    }
  }

  return {
    success: true,
    count: results.success,
    results
  }
})
