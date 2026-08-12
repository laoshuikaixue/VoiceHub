import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { runSongQuotaDrizzleTransaction } from '~~/server/services/songQuotaDrizzleAdapter'
import { convertLegacyCardToQuota } from '~~/server/services/songQuotaService'
import { createApiError } from '~~/server/utils/apiError'
import { enforceCardCodeValidationRateLimit } from '~~/server/utils/card-code-validation-rate-limit'
import { getServerDate } from '~~/server/utils/serverTime'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED', '需要登录才能兑换旧点歌券')
  }

  await enforceCardCodeValidationRateLimit(event, user.id)

  const settings = await getSystemSettingsCached()
  if (settings?.legacyCardConversionEnabled !== true) {
    throw createApiError(400, 'SONG_QUOTA_DISABLED', '旧点歌券兑换未启用')
  }

  const body = await readBody(event)
  const cardCode = typeof body?.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
  if (!cardCode) {
    throw createApiError(400, 'CARD_CODE_REQUIRED', '请输入旧点歌券')
  }
  if (cardCode.length > 128) {
    throw createApiError(400, 'CARD_CODE_TOO_LONG', '旧点歌券长度不能超过 128 个字符')
  }

  const now = getServerDate()
  const result = await runSongQuotaDrizzleTransaction(db, (tx) =>
    convertLegacyCardToQuota(tx, {
      userId: user.id,
      cardCode,
      now
    })
  )

  return {
    permanentBalance: result.account.permanentBalance,
    totalBalance: result.account.periodicBalance + result.account.permanentBalance,
    transactionId: result.transaction.id
  }
})
