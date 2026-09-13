// 条款同意状态查询；开启条款时附签匿名同意凭证（注册请求需携带以证明已同意当前版本）
import { db } from '~/drizzle/db'
import { getLegalConsentRequiredVersion, signLegalConsentToken } from '~~/server/utils/legal-consent'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const settings = await db.query.systemSettings.findFirst({
    columns: { legalConsentEnabled: true, legalConsentUpdatedDate: true }
  })
  const response = {
    accepted: Boolean(user?.legalConsentVersion),
    version: user?.legalConsentVersion || null,
    token: '',
    consentVersion: ''
  }
  if (settings?.legalConsentEnabled) {
    response.consentVersion = getLegalConsentRequiredVersion(settings)
    response.token = signLegalConsentToken(response.consentVersion)
  }
  return response
})
