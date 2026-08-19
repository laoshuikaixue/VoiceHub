import { db } from '~/drizzle/db'
import { createSongQuotaDrizzleAdapter } from '#server/services/songQuotaDrizzleAdapter'
import {
  buildSongQuotaAccountResponse,
  getSongQuotaAccount
} from '#server/services/songQuotaService'
import { createApiError } from '#server/utils/apiError'
import { getServerDate } from '#server/utils/serverTime'
import { isSongAdministrator } from '#server/utils/song-request-policy'
import { getSystemSettingsCached } from '#server/utils/system-settings-helper'

const PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

const resolvePeriodType = (value: unknown) =>
  PERIOD_TYPES.includes(value as (typeof PERIOD_TYPES)[number])
    ? value as (typeof PERIOD_TYPES)[number]
    : 'DAILY'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED', '需要登录才能查看点歌额度')
  }

  const settings = await getSystemSettingsCached()
  const quotaSettings = {
    songQuotaEnabled: settings?.songQuotaEnabled === true,
    songQuotaPeriodType: resolvePeriodType(settings?.songQuotaPeriodType),
    songQuotaPeriodAmount: Number.isSafeInteger(settings?.songQuotaPeriodAmount) && settings.songQuotaPeriodAmount > 0
      ? settings.songQuotaPeriodAmount
      : 1,
    adminSongQuotaExempt: settings?.adminSongQuotaExempt !== false,
    blockOnSongQuotaInsufficient: settings?.blockOnSongQuotaInsufficient !== false
  }
  const now = getServerDate()
  const account = await db.transaction(async (tx) =>
    getSongQuotaAccount(createSongQuotaDrizzleAdapter(tx), user.id, quotaSettings, now)
  )

  return buildSongQuotaAccountResponse(
    account,
    quotaSettings,
    now,
    isSongAdministrator(user.role)
  )
})
