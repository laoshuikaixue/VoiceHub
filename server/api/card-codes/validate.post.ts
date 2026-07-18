import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

const createCardCodeError = (statusCode: number, code: string, message: string) =>
  createError({
    statusCode,
    statusMessage: code,
    message,
    data: { code }
  })

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createCardCodeError(401, 'CARD_CODE_AUTH_REQUIRED', 'Sign in to validate request card')
  }

  const body = (await readBody(event)) || {}
  const code = typeof body.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
  if (!code) {
    throw createCardCodeError(400, 'CARD_CODE_REQUIRED', 'Request card is required')
  }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const settings = await getSystemSettingsCached()
  const enabled = !!(settings?.enableCardCodeRequests || settings?.requireCardCodeForRequests)
  if (!enabled && !isAdmin) {
    throw createCardCodeError(400, 'CARD_CODE_DISABLED', 'Request card submissions are not enabled')
  }

  const rows = await db
    .select({
      id: cardCodes.id,
      status: cardCodes.status
    })
    .from(cardCodes)
    .where(eq(cardCodes.code, code))
    .limit(1)

  const found = rows[0]
  if (!found || found.status !== 'AVAILABLE') {
    throw createCardCodeError(400, 'CARD_CODE_INVALID_OR_USED', 'Request card is invalid or already used')
  }

  return {
    valid: true,
    code: 'CARD_CODE_AVAILABLE',
    message: 'Request card available'
  }
})
