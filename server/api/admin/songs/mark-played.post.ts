import { db } from '~/drizzle/db'
import { z } from 'zod'
import { updateSongPlayed, notifySongsPlayed } from '~~/server/services/songPlayedService'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

const markPlayedSchema = z.object({
  songId: z.number().optional(),
  songIds: z.array(z.number()).max(100, '批量操作单次最多支持 100 首歌曲').optional(),
  unmark: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const validatedDataResult = markPlayedSchema.safeParse(body)

  if (!validatedDataResult.success) {
    throw createError({
      statusCode: 400,
      message: validatedDataResult.error.issues[0]?.message || '请求参数无效'
    })
  }

  const validatedData = validatedDataResult.data

  const songIds = Array.from(
    new Set([
      ...(validatedData.songId !== undefined ? [validatedData.songId] : []),
      ...(validatedData.songIds || [])
    ])
  )

  if (songIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID列表不能为空'
    })
  }

  // 撤回已播放
  const isUnmark = validatedData.unmark === true

  const operatorId = Number(event.context.user?.id || event.context.apiKey?.createdByUserId)
  const updatedSongIds = await db.transaction(tx => updateSongPlayed(tx, songIds, operatorId, isUnmark))
  if (!isUnmark) notifySongsPlayed(event, updatedSongIds)

  await recordAdminAudit(event, isUnmark ? 'song.unmark-played' : 'song.mark-played', {
    targetType: 'song',
    targetId: `batch:${updatedSongIds.length}`,
    summary: { count: updatedSongIds.length, songIds: updatedSongIds }
  })

  return {
    message: isUnmark ? '歌曲已成功撤回已播放状态' : '歌曲已成功标记为已播放',
    count: updatedSongIds.length,
    updatedSongIds: updatedSongIds
  }
})
