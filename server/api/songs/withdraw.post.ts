import { db } from '~/drizzle/db'
import { cacheService } from '~~/server/services/cacheService'
import {
  schedules,
  songs,
  systemSettings,
  votes,
  songCollaborators,
  collaborationLogs
} from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能撤回歌曲'
    })
  }

  const body = await readBody(event)

  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID不能为空'
    })
  }

  // 查找歌曲
  const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)
  const song = songResult[0]

  if (!song) {
    throw createError({
      statusCode: 404,
      message: '歌曲不存在'
    })
  }

  // 检查是否是用户自己的投稿或联合投稿
  const isRequester = song.requesterId === user.id
  let isCollaborator = false
  let collaboratorRecord = null

  if (!isRequester) {
    const collabResult = await db
      .select()
      .from(songCollaborators)
      .where(and(eq(songCollaborators.songId, song.id), eq(songCollaborators.userId, user.id)))
      .limit(1)

    if (collabResult.length > 0) {
      isCollaborator = true
      collaboratorRecord = collabResult[0]
    }
  }

  if (!isRequester && !isCollaborator && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只能撤回自己的投稿或退出联合投稿'
    })
  }

  // 检查歌曲是否已经播放
  if (song.played) {
    throw createError({
      statusCode: 400,
      message: '已播放的歌曲不能撤回'
    })
  }

  // 检查歌曲是否已排期（只检查已发布的排期，草稿不算）
  const scheduleResult = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.songId, body.songId), eq(schedules.isDraft, false)))
    .limit(1)
  const schedule = scheduleResult[0]

  if (schedule) {
    throw createError({
      statusCode: 400,
      message: '已排期的歌曲不能撤回'
    })
  }

  // 如果是联合投稿人撤回（退出）
  if (isCollaborator && !isRequester && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    await db.delete(songCollaborators).where(eq(songCollaborators.id, collaboratorRecord.id))

    // 记录日志
    await db.insert(collaborationLogs).values({
      collaboratorId: collaboratorRecord.id,
      action: 'LEAVE',
      operatorId: user.id,
      ipAddress:
        (event.node.req.headers['x-forwarded-for'] as string) || event.node.req.socket.remoteAddress
    })

    // 清除歌曲列表缓存
    await cacheService.clearSongsCache()

    return {
      message: '已成功退出联合投稿',
      songId: body.songId,
      action: 'leave'
    }
  }

  // 如果是主投稿人撤回（删除歌曲）

  // 获取系统设置以检查限制类型
  const settingsResult = await db.select().from(systemSettings).limit(1)
  const settings = settingsResult[0]
  const dailyLimit = settings?.dailySubmissionLimit || 0
  const weeklyLimit = settings?.weeklySubmissionLimit || 0

  // 检查撤销的歌曲是否在当前限制期间内（用于返还配额）
  let canReturnQuota = false
  const now = new Date()

  if (dailyLimit > 0) {
    // 检查是否在同一天
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    if (song.createdAt >= startOfDay && song.createdAt < endOfDay) {
      canReturnQuota = true
    }
  } else if (weeklyLimit > 0) {
    // 检查是否在同一周（周一开始）
    const startOfWeek = new Date(now)
    const dayOfWeek = now.getDay()
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
    startOfWeek.setDate(now.getDate() - daysToSubtract)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

    if (song.createdAt >= startOfWeek && song.createdAt < endOfWeek) {
      canReturnQuota = true
    }
  }

  // 删除关联的联合投稿记录
  await db.delete(songCollaborators).where(eq(songCollaborators.songId, body.songId))

  // 删除歌曲的所有投票
  await db.delete(votes).where(eq(votes.songId, body.songId))

  // 如果有 hitRequestId，减少对应时段的已接纳数量
  if (song.hitRequestId) {
    try {
      // 需要引入 requestTimes 和 sql
      const { requestTimes } = await import('~/drizzle/schema')
      const { sql } = await import('drizzle-orm')

      await db
        .update(requestTimes)
        .set({
          accepted: sql`GREATEST(0, accepted - 1)`
        })
        .where(eq(requestTimes.id, song.hitRequestId))
      console.log(`已减少投稿时段 ${song.hitRequestId} 的接纳数量`)
    } catch (error) {
      console.error(`减少投稿时段接纳数量失败: ${error.message}`)
    }
  }

  // 删除歌曲
  await db.delete(songs).where(eq(songs.id, body.songId))

  // 清除歌曲列表缓存
  await cacheService.clearSongsCache()
  console.log('[Cache] 歌曲缓存已清除（撤回歌曲）')

  return {
    message: canReturnQuota ? '歌曲已成功撤回，投稿配额已返还' : '歌曲已成功撤回',
    songId: body.songId,
    quotaReturned: canReturnQuota
  }
})
