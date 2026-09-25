// 条款同意状态查询：返回当前内容版本指纹及用户是否已同意该版本
import { db } from '~/drizzle/db'
import { computeLegalConsentVersion } from '~~/server/utils/legal-consent'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const settings = await db.query.systemSettings.findFirst({
    columns: { legalConsentEnabled: true, legalConsentUpdatedDate: true, legalConsentDocuments: true }
  })
  const enabled = Boolean(settings?.legalConsentEnabled)
  const consentVersion = computeLegalConsentVersion(settings ?? null) || ''
  return {
    enabled,
    consentVersion,
    accepted: enabled && Boolean(user?.legalConsentVersion) && user.legalConsentVersion === consentVersion
  }
})
