import { desc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { submissionTopics } from '~/drizzle/schema'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { getServerDate } from '~~/server/utils/serverTime'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { formatDateTime } from '~/utils/timeUtils'
import {
  formatTopicDateTimeInput,
  getTopicAcceptedCounts,
  getTopicDayMap,
  getTopicPlayTimeMap,
  isTopicOpen
} from '~~/server/utils/submission-topic'

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const settings = await getSystemSettingsCached()
  const rows = await db.select().from(submissionTopics).orderBy(desc(submissionTopics.createdAt))
  const topicIds = rows.map((row) => row.id)
  const [acceptedMap, dayMap, playTimeMap] = await Promise.all([
    getTopicAcceptedCounts(db, topicIds),
    getTopicDayMap(db, topicIds),
    getTopicPlayTimeMap(db, topicIds)
  ])
  const now = getServerDate()

  return {
    // 全局开关：只有管理员能改，歌曲管理员只读展示
    enabled: settings?.enableSubmissionTopics === true,
    required: settings?.submissionTopicRequired === true,
    topics: rows.map((topic) => {
      const accepted = acceptedMap.get(topic.id) || 0
      const max = topic.maxSubmissions === null ? null : Number(topic.maxSubmissions)
      return {
        id: topic.id,
        name: topic.name,
        description: topic.description || null,
        startTime: formatTopicDateTimeInput(topic.startTime),
        endTime: formatTopicDateTimeInput(topic.endTime),
        startTimeText: formatDateTime(topic.startTime, 'YYYY/M/D H:mm'),
        endTimeText: formatDateTime(topic.endTime, 'YYYY/M/D H:mm'),
        maxSubmissions: max,
        accepted,
        remaining: max === null ? null : Math.max(0, max - accepted),
        enabled: topic.enabled,
        isOpen: isTopicOpen(topic, now),
        topicDays: dayMap.get(topic.id) || [],
        playTimeIds: playTimeMap.get(topic.id) || [],
        createdAt: formatDateTime(topic.createdAt),
        updatedAt: formatDateTime(topic.updatedAt)
      }
    })
  }
})
