import { and, eq, gt, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { requestTimes } from '~/drizzle/schema'
import { getBeijingTimeISOString } from '~/utils/timeUtils'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import {
  buildSongQuotaAccountResponse,
  getSongQuotaAccount
} from '~~/server/services/songQuotaService'
import { createApiError } from '~~/server/utils/apiError'
import { getServerDate } from '~~/server/utils/serverTime'
import { isSongAdministrator } from '~~/server/utils/song-request-policy'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

const SONG_QUOTA_PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

const resolveSongQuotaPeriodType = (value: unknown) =>
  SONG_QUOTA_PERIOD_TYPES.includes(value as (typeof SONG_QUOTA_PERIOD_TYPES)[number])
    ? value as (typeof SONG_QUOTA_PERIOD_TYPES)[number]
    : 'DAILY'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'SONG_LOGIN_REQUIRED_VIEW_STATUS', '需要登录才能查看投稿状态')
  }

  try {
    const settings = await getSystemSettingsCached()
    const isAdministrator = isSongAdministrator(user.role)
    const status: Record<string, unknown> = {
      submissionClosed: !!(settings?.forceBlockAllRequests && !isAdministrator),
      timeLimitationEnabled: settings?.enableRequestTimeLimitation || false,
      currentTimePeriod: null
    }

    if (status.timeLimitationEnabled) {
      const currentTime = getBeijingTimeISOString()
      const [activeTimePeriod] = await db
        .select()
        .from(requestTimes)
        .where(and(
          lte(requestTimes.startTime, currentTime),
          gt(requestTimes.endTime, currentTime),
          eq(requestTimes.enabled, true)
        ))
        .limit(1)
      status.currentTimePeriod = activeTimePeriod || null
      if (!activeTimePeriod && !isAdministrator) status.submissionClosed = true
    }

    const quotaSettings = {
      songQuotaEnabled: settings?.songQuotaEnabled === true,
      songQuotaPeriodType: resolveSongQuotaPeriodType(settings?.songQuotaPeriodType),
      songQuotaPeriodAmount: settings?.songQuotaPeriodAmount || 1,
      adminSongQuotaExempt: settings?.adminSongQuotaExempt !== false,
      blockOnSongQuotaInsufficient: settings?.blockOnSongQuotaInsufficient !== false
    }
    const now = getServerDate()
    const account = await db.transaction(async (tx) =>
      getSongQuotaAccount(createSongQuotaDrizzleAdapter(tx), user.id, quotaSettings, now)
    )

    return {
      ...status,
      quota: buildSongQuotaAccountResponse(account, quotaSettings, now, isAdministrator)
    }
  } catch (error) {
    console.error('获取投稿状态失败:', error)
    throw createApiError(500, 'SONG_FETCH_STATUS_FAILED', '获取投稿状态失败')
  }
})
