import { and, asc, eq, gt, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { submissionTopics } from '~/drizzle/schema'
import { formatDateTime, getBeijingDateString } from '~/utils/timeUtils'
import { getServerDate } from '~~/server/utils/serverTime'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getTopicAcceptedCounts, getTopicDayMap, getTopicPlayTimeMap } from '~~/server/utils/submission-topic'

export default defineEventHandler(async () => {
  try {
    // 专题投稿为可选功能：总开关关闭时学生端拿不到任何专题
    const settings = await getSystemSettingsCached()
    const enabled = settings?.enableSubmissionTopics === true
    const required = enabled && settings?.submissionTopicRequired === true
    if (!enabled) return { enabled: false, required: false, topics: [] }

    const now = getServerDate()
    const rows = await db
      .select()
      .from(submissionTopics)
      .where(
        and(
          eq(submissionTopics.enabled, true),
          lte(submissionTopics.startTime, now),
          gt(submissionTopics.endTime, now)
        )
      )
      .orderBy(asc(submissionTopics.endTime))

    if (rows.length === 0) return { enabled, required, topics: [] }

    const topicIds = rows.map((row) => row.id)
    const [acceptedMap, dayMap, playTimeMap] = await Promise.all([
      getTopicAcceptedCounts(db, topicIds),
      getTopicDayMap(db, topicIds),
      getTopicPlayTimeMap(db, topicIds)
    ])
    const today = getBeijingDateString()

    return {
      enabled,
      required,
      topics: rows.map((topic) => {
        const accepted = acceptedMap.get(topic.id) || 0
        const max = topic.maxSubmissions === null ? null : Number(topic.maxSubmissions)
        return {
          id: topic.id,
          name: topic.name,
          description: topic.description || null,
          startTime: formatDateTime(topic.startTime, 'YYYY/M/D H:mm'),
          endTime: formatDateTime(topic.endTime, 'YYYY/M/D H:mm'),
          maxSubmissions: max,
          accepted,
          remaining: max === null ? null : Math.max(0, max - accepted),
          isFull: max !== null && accepted >= max,
          // 学生只能选择今天及以后的专题日
          topicDays: (dayMap.get(topic.id) || []).filter((date) => date >= today),
          // 为空表示该专题不限时段
          playTimeIds: playTimeMap.get(topic.id) || []
        }
      })
    }
  } catch (error) {
    console.error('获取投稿专题失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取投稿专题失败'
    })
  }
})
