// 登录条款同意凭证：签发与校验（注册与 OAuth 注册共用）
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 未配置更新日期时的兜底版本号
export const UNVERSIONED_LEGAL_CONSENT = 'unversioned'

const LEGAL_CONSENT_TOKEN_TTL = '30m'

export const getLegalConsentRequiredVersion = (config: { legalConsentUpdatedDate?: string | null } | null) =>
  config?.legalConsentUpdatedDate || UNVERSIONED_LEGAL_CONSENT

// 签发匿名同意凭证（短期有效，绑定当前条款版本）
export const signLegalConsentToken = (version: string) =>
  JWTEnhanced.sign({ type: 'legal-consent', version }, { expiresIn: LEGAL_CONSENT_TOKEN_TTL })

// 校验注册请求携带的同意凭证：通过返回同意版本号（供落库），未开启条款返回 null
export const verifyLegalConsentToken = (
  config: { legalConsentEnabled?: boolean | null } | null,
  body: { legalConsentToken?: unknown }
) => {
  if (!config?.legalConsentEnabled) return null
  const requiredVersion = getLegalConsentRequiredVersion(config)
  let version = ''
  try {
    const payload = JWTEnhanced.verify(String(body?.legalConsentToken || ''))
    if (payload?.type === 'legal-consent' && typeof payload.version === 'string') version = payload.version
  } catch {
    version = ''
  }
  if (!version || version !== requiredVersion) {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_LEGAL_CONSENT_REQUIRED, '请先阅读并同意最新条款后再注册')
  }
  return version
}
