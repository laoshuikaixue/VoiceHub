import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songCollaborators, collaborationLogs, songs } from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { createCollaborationResponseNotification } from '~~/server/services/notificationService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '未登录'
    })
  }

  const body = await readBody(event)
  const { songId, accept } = body

  if (!songId || typeof accept !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: '参数错误'
    })
  }

  try {
    // 查找联合投稿记录
    const collabRecord = await db
      .select()
      .from(songCollaborators)
      .where(
        and(
          eq(songCollaborators.songId, songId),
          eq(songCollaborators.userId, user.id),
          eq(songCollaborators.status, 'PENDING')
        )
      )
      .limit(1)
      .then((res) => res[0])

    if (!collabRecord) {
      throw createError({
        statusCode: 404,
        statusMessage: '未找到待处理的邀请'
      })
    }

    // 更新状态
    const status = accept ? 'ACCEPTED' : 'REJECTED'
    await db
      .update(songCollaborators)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(songCollaborators.id, collabRecord.id))

    // 记录日志
    await db.insert(collaborationLogs).values({
      collaboratorId: collabRecord.id,
      action: accept ? 'ACCEPT' : 'REJECT',
      operatorId: user.id,
      ipAddress:
        (event.node.req.headers['x-forwarded-for'] as string) || event.node.req.socket.remoteAddress
    })

    // 获取歌曲信息以发送通知
    const song = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1)
      .then((res) => res[0])

    if (song) {
      await createCollaborationResponseNotification(user.id, song.requesterId, song.title, accept)
    }

    return { success: true }
  } catch (error) {
    console.error('处理联合投稿邀请失败:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: '处理邀请失败'
    })
  }
})
