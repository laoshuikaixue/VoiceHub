import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { songs, submissionTopics } from '~/drizzle/schema'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const topicId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(topicId) || topicId <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的专题 ID')
  }

  try {
    const detachedSongs = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: submissionTopics.id })
        .from(submissionTopics)
        .where(eq(submissionTopics.id, topicId))
        .limit(1)
        .for('update')

      if (existing.length === 0) {
        throw createApiError(404, SERVER_ERROR_CODES.SONG_TOPIC_NOT_FOUND, '专题不存在')
      }

      // 歌曲本身保留，仅解除专题标签；统计受影响数量便于后台给出明确反馈
      const detached = await tx
        .update(songs)
        .set({ topicId: null })
        .where(eq(songs.topicId, topicId))
        .returning({ id: songs.id })

      await tx.delete(submissionTopics).where(eq(submissionTopics.id, topicId))
      return detached.length
    })

    return { success: true, detachedSongs }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('删除专题失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '删除专题失败')
  }
})
