import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { enforceCardCodeValidationRateLimit } from '~~/server/utils/card-code-validation-rate-limit'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'CARD_CODE_AUTH_REQUIRED', 'Sign in to validate request card')
  }

  await enforceCardCodeValidationRateLimit(event, user.id)

  const body = (await readBody(event)) || {}
  const code = typeof body.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
  if (!code) {
    throw createApiError(400, 'CARD_CODE_REQUIRED', 'Request card is required')
  }
  if (code.length > 128) {
    throw createApiError(400, 'CARD_CODE_TOO_LONG', 'Request card must not exceed 128 characters')
  }

  const settings = await getSystemSettingsCached()
  if (settings?.legacyCardConversionEnabled !== true) {
    throw createApiError(400, 'SONG_QUOTA_DISABLED', 'Legacy request card conversion is not enabled')
  }

  const rows = await db
    .select({
      status: cardCodes.status
    })
    .from(cardCodes)
    .where(eq(cardCodes.code, code))
    .limit(1)

  const found = rows[0]
  if (!found || found.status !== 'AVAILABLE') {
    throw createApiError(400, 'CARD_CODE_INVALID_OR_USED', 'Request card is invalid or already used')
  }

  return {
    eligible: true
  }
})
