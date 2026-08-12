import { getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import { getSongQuotaAccountDetails } from '~~/server/services/songQuotaService'
import { createApiError } from '~~/server/utils/apiError'
import { requireSongQuotaAdministrator, throwInvalidSongQuotaInput } from './_shared'

export default defineEventHandler(async (event) => {
  requireSongQuotaAdministrator(event)
  const userId = Number(getRouterParam(event, 'userId'))
  if (!Number.isSafeInteger(userId) || userId <= 0) throwInvalidSongQuotaInput()
  const account = await getSongQuotaAccountDetails(createSongQuotaDrizzleAdapter(db), userId)
  if (!account) throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
  return account
})
