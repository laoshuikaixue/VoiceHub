import { defineEventHandler, createError, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs, semesters, songBlacklists } from '~/drizzle/schema'
import { eq, inArray, and, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录'
    })
  }

  const body = await readBody(event)
  const { songIds } = body

  if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: '请选择要导入的歌曲'
    })
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
    throw createError({
      statusCode: 400,
      message: '系统未设置当前活跃学期，无法导入歌曲。请联系管理员先设置活跃学期。'
    })
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
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 将即将插入的歌曲也加入判重集合，防止同一次请求中有重复歌曲
    existingSet.add(songKey)
  }

  // 批量插入
  if (songsToInsert.length > 0) {
    await db.insert(songs).values(songsToInsert)
    results.success = songsToInsert.length
  }

  return {
    success: true,
    count: results.success,
    results
  }
})
