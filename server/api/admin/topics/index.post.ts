import { db } from '~/drizzle/db'
import { submissionTopicDays, submissionTopicPlayTimes, submissionTopics } from '~/drizzle/schema'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  assertPlayTimesExist,
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
  const body = await readBody(event)

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
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

  const description =
    typeof body?.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null
  if (description && description.length > TOPIC_DESCRIPTION_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `专题说明不能超过 ${TOPIC_DESCRIPTION_MAX_LENGTH} 个字符`
    )
  }

  const startTime = parseTopicDateTimeInput(body?.startTime)
  const endTime = parseTopicDateTimeInput(body?.endTime)
  if (!startTime || !endTime) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      '专题时段格式无效，请使用北京时间 YYYY-MM-DDTHH:mm'
    )
  }
  if (startTime.getTime() >= endTime.getTime()) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '专题开始时间必须早于结束时间')
  }

  const maxSubmissions = parseMaxSubmissions(body?.maxSubmissions)
  const dateResult = normalizeTopicDateList(body?.topicDays)
  if (dateResult.error) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, dateResult.error)
  }

  const playTimeResult = normalizeTopicPlayTimeList(body?.playTimeIds)
  if (playTimeResult.error) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, playTimeResult.error)
  }

  try {
    const topic = await db.transaction(async (tx) => {
      await assertPlayTimesExist(tx, playTimeResult.ids)

      const inserted = await tx
        .insert(submissionTopics)
        .values({
          name,
          description,
          startTime,
          endTime,
          maxSubmissions,
          enabled: body?.enabled !== false
        })
        .returning()

      const created = inserted[0]
      if (!created) {
        throw createApiError(500, SERVER_ERROR_CODES.SONG_OPERATION_FAILED, '创建专题失败')
      }

      if (dateResult.dates.length > 0) {
        await tx.insert(submissionTopicDays).values(
          dateResult.dates.map((date) => ({
            topicId: created.id,
            date
          }))
        )
      }

      if (playTimeResult.ids.length > 0) {
        await tx.insert(submissionTopicPlayTimes).values(
          playTimeResult.ids.map((playTimeId) => ({
            topicId: created.id,
            playTimeId
          }))
        )
      }

      return created
    })

    return {
      success: true,
      topic: {
        ...topic,
        topicDays: dateResult.dates,
        playTimeIds: playTimeResult.ids
      }
    }
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '该专题名称已存在')
    }
    if (error.statusCode) throw error
    console.error('创建专题失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SONG_OPERATION_FAILED, '创建专题失败')
  }
})
