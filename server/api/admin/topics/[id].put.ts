import { and, eq, ne } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { submissionTopicDays, submissionTopicPlayTimes, submissionTopics } from '~/drizzle/schema'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  assertPlayTimesExist,
  assertTopicDaysCompatibleWithSchedules,
  normalizeTopicDateList,
  normalizeTopicPlayTimeList,
  parseTopicDateTimeInput,
  TOPIC_DESCRIPTION_MAX_LENGTH,
  TOPIC_MAX_SUBMISSIONS_LIMIT,
  TOPIC_NAME_MAX_LENGTH
} from '~~/server/utils/submission-topic'

const parseMaxSubmissions = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > TOPIC_MAX_SUBMISSIONS_LIMIT) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `收集数量必须是 1-${TOPIC_MAX_SUBMISSIONS_LIMIT} 的整数，留空表示不限量`
    )
  }
  return parsed
}

const isUniqueViolation = (error: any) =>
  error?.code === '23505' || error?.cause?.code === '23505'

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const topicId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(topicId) || topicId <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的专题 ID')
  }

  const body = await readBody(event)
  const existingRows = await db
    .select()
    .from(submissionTopics)
    .where(eq(submissionTopics.id, topicId))
    .limit(1)
  const existing = existingRows[0]
  if (!existing) {
    throw createApiError(404, SERVER_ERROR_CODES.SONG_TOPIC_NOT_FOUND, '专题不存在')
  }

  const name = body?.name === undefined ? existing.name : String(body.name || '').trim()
  if (!name) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '专题名称不能为空')
  }
  if (name.length > TOPIC_NAME_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `专题名称不能超过 ${TOPIC_NAME_MAX_LENGTH} 个字符`
    )
  }

  let description = existing.description
  if (body?.description !== undefined) {
    description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null
    if (description && description.length > TOPIC_DESCRIPTION_MAX_LENGTH) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        `专题说明不能超过 ${TOPIC_DESCRIPTION_MAX_LENGTH} 个字符`
      )
    }
  }

  const startTime =
    body?.startTime === undefined ? existing.startTime : parseTopicDateTimeInput(body.startTime)
  const endTime =
    body?.endTime === undefined ? existing.endTime : parseTopicDateTimeInput(body.endTime)
  if (!startTime || !endTime) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      '专题时段格式无效，请使用北京时间 YYYY-MM-DDTHH:mm'
    )
  }
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '专题开始时间必须早于结束时间')
  }

  const maxSubmissions =
    body?.maxSubmissions === undefined
      ? existing.maxSubmissions
      : parseMaxSubmissions(body.maxSubmissions)
  const enabled = body?.enabled === undefined ? existing.enabled : body.enabled !== false

  const hasDateUpdate = body?.topicDays !== undefined
  const dateResult: { dates: string[]; error?: string } = hasDateUpdate
    ? normalizeTopicDateList(body.topicDays)
    : { dates: [] }
  if (dateResult.error) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, dateResult.error)
  }

  const hasPlayTimeUpdate = body?.playTimeIds !== undefined
  const playTimeResult: { ids: number[]; error?: string } = hasPlayTimeUpdate
    ? normalizeTopicPlayTimeList(body.playTimeIds)
    : { ids: [] }
  if (playTimeResult.error) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, playTimeResult.error)
  }

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .select({ id: submissionTopics.id })
        .from(submissionTopics)
        .where(eq(submissionTopics.id, topicId))
        .for('update')

      const duplicate = await tx
        .select({ id: submissionTopics.id })
        .from(submissionTopics)
        .where(and(eq(submissionTopics.name, name), ne(submissionTopics.id, topicId)))
        .limit(1)
      if (duplicate.length > 0) {
        throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '该专题名称已存在')
      }

      if (hasDateUpdate) {
        await assertTopicDaysCompatibleWithSchedules(tx, topicId, dateResult.dates)
      }

      const updated = await tx
        .update(submissionTopics)
        .set({
          name,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          maxSubmissions,
          enabled,
          updatedAt: new Date()
        })
        .where(eq(submissionTopics.id, topicId))
        .returning()

      const topic = updated[0]
      if (!topic) {
        throw createApiError(404, SERVER_ERROR_CODES.SONG_TOPIC_NOT_FOUND, '专题不存在')
      }

      if (hasDateUpdate) {
        await tx.delete(submissionTopicDays).where(eq(submissionTopicDays.topicId, topicId))
        if (dateResult.dates.length > 0) {
          await tx.insert(submissionTopicDays).values(
            dateResult.dates.map((date) => ({
              topicId,
              date
            }))
          )
        }
      }

      if (hasPlayTimeUpdate) {
        await assertPlayTimesExist(tx, playTimeResult.ids)
        await tx
          .delete(submissionTopicPlayTimes)
          .where(eq(submissionTopicPlayTimes.topicId, topicId))
        if (playTimeResult.ids.length > 0) {
          await tx.insert(submissionTopicPlayTimes).values(
            playTimeResult.ids.map((playTimeId) => ({
              topicId,
              playTimeId
            }))
          )
        }
      }

      return topic
    })

    return { success: true, topic: result }
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '该专题名称已存在')
    }
    if (error.statusCode) throw error
    console.error('更新专题失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SONG_OPERATION_FAILED, '更新专题失败')
  }
})
