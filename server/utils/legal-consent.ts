// 登录条款同意：内容版本指纹与注册同意校验
import { createHash } from 'node:crypto'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 解析协议文档 JSON，非法或非数组时回退空数组
export const parseLegalConsentDocuments = (raw: unknown): Array<{ slug?: string; name?: string; content?: string }> => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 内容版本指纹：更新日期与每份文档（slug/name/content）任一变化即产生新版本；未开启时返回 null
export const computeLegalConsentVersion = (
  config: {
    legalConsentEnabled?: boolean | null
    legalConsentUpdatedDate?: string | null
    legalConsentDocuments?: string | null
  } | null
): string | null => {
  if (!config?.legalConsentEnabled) return null
  const date = typeof config.legalConsentUpdatedDate === 'string' ? config.legalConsentUpdatedDate.trim() : ''
  const docs = parseLegalConsentDocuments(config.legalConsentDocuments)
  const canonical = `${date}\n${docs.map((d) => `${d?.slug ?? ''}\u0001${d?.name ?? ''}\u0001${d?.content ?? ''}`).join('\u0002')}`
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

// 注册同意校验：需用户显式提交所同意的版本号且与当前内容指纹一致；未开启条款返回 null
export const resolveRegisteredLegalConsentVersion = (
  config: {
    legalConsentEnabled?: boolean | null
    legalConsentUpdatedDate?: string | null
    legalConsentDocuments?: string | null
  } | null,
  body: { legalConsentAccepted?: unknown; legalConsentVersion?: unknown }
): string | null => {
  if (!config?.legalConsentEnabled) return null
  const required = computeLegalConsentVersion(config)
  const submitted = typeof body?.legalConsentVersion === 'string' ? body.legalConsentVersion : ''
  if (body?.legalConsentAccepted !== true || !required || submitted !== required) {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_LEGAL_CONSENT_REQUIRED, '请先阅读并同意最新条款后再注册')
  }
  return required
}
