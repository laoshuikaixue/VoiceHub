import { getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import { getSongQuotaAccountDetails } from '~~/server/services/songQuotaService'
import {
  enforceOpenSongQuotaRateLimit,
  openSongQuotaAccountQuerySchema,
  requireOpenSongQuotaApiKey,
  requireOpenSongQuotaUser,
  throwInvalidOpenSongQuotaInput
} from './_shared'

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey
  requireOpenSongQuotaApiKey(event)
  const parsed = openSongQuotaAccountQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throwInvalidOpenSongQuotaInput()
  const user = await requireOpenSongQuotaUser(parsed.data.userId)
  await enforceOpenSongQuotaRateLimit(event, apiKey.id, user.id)
  const account = await getSongQuotaAccountDetails(createSongQuotaDrizzleAdapter(db), user.id)
  const periodicBalance = typeof account?.periodicBalance === 'number' ? account.periodicBalance : 0
  const permanentBalance = typeof account?.permanentBalance === 'number' ? account.permanentBalance : 0
  return {
    userId: user.id,
    periodicBalance,
    permanentBalance,
    totalBalance: periodicBalance + permanentBalance,
    periodKey: account?.periodKey ?? null,
    updatedAt: account?.updatedAt ?? null
  }
})
