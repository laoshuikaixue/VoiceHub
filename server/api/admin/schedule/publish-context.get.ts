import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/drizzle/db'
import { schedules } from '~/drizzle/schema'
import { getBeijingDateString } from '~/utils/timeUtils'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { readScheduleBroadcastContext } from '~~/server/services/broadcastPlayback'
import { createApiError } from '~~/server/utils/apiError'
import { parseScheduleDateQuery } from '~~/server/utils/schedule-date-query'

const positiveId = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(z.number().max(2147483647))
const querySchema = z.union([
  z.strictObject({ scheduleId: positiveId }),
  z.strictObject({ playDate: z.string(), playTimeId: positiveId.optional() })
])

export default defineEventHandler(async event => {
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '发布范围无效')
  if ('scheduleId' in query.data) {
    const [draft] = await db.select({ date: schedules.playDate, slotId: schedules.playTimeId })
      .from(schedules).where(and(eq(schedules.id, query.data.scheduleId), eq(schedules.isDraft, true))).limit(1)
    if (!draft) throw createApiError(404, SERVER_ERROR_CODES.SCHEDULE_DRAFT_NOT_FOUND, '找不到指定的排期草稿')
    return readScheduleBroadcastContext(db, getBeijingDateString(draft.date), draft.slotId, false)
  }
  const { playDate, playTimeId } = query.data
  parseScheduleDateQuery(playDate)
  return readScheduleBroadcastContext(db, playDate, playTimeId ?? null, playTimeId === undefined)
})
