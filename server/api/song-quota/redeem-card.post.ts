import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { runSongQuotaDrizzleTransaction } from '~~/server/services/songQuotaDrizzleAdapter'
import { convertLegacyCardToQuota } from '~~/server/services/songQuotaService'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { enforceCardCodeRedemptionRateLimit } from '~~/server/utils/card-code-redemption-rate-limit'
import { getServerDate } from '~~/server/utils/serverTime'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '需要登录才能兑换旧点歌券')
  }

  await enforceCardCodeRedemptionRateLimit(event, user.id)

  const body = await readBody(event)
  const cardCode = typeof body?.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
  if (!cardCode) {
    throw createApiError(400, SERVER_ERROR_CODES.CARD_CODE_NOT_FOUND, '请输入旧点歌券')
  }
  if (cardCode.length > 128) {
    throw createApiError(400, SERVER_ERROR_CODES.CARD_CODE_NOT_FOUND, '旧点歌券长度不能超过 128 个字符')
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