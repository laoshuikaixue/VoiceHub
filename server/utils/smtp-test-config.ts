import { SMTP_PASSWORD_MASK } from '../api/admin/system-settings/secretMask.ts'
import { createApiError } from './apiError.ts'
import { SERVER_ERROR_CODES } from '../config/constants.ts'

export function resolveSmtpTestConfig(body: Record<string, any>, stored: Record<string, any>, canEdit: boolean) {
  const input = canEdit ? body : stored
  let password = input.smtpPassword
  if (canEdit && password === SMTP_PASSWORD_MASK) {
    const sameTarget = ['smtpHost', 'smtpUsername'].every((field) => input[field] === stored[field]) &&
      Number(input.smtpPort || 587) === Number(stored.smtpPort || 587) &&
      Boolean(input.smtpSecure) === Boolean(stored.smtpSecure)
    if (!sameTarget) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '更换 SMTP 服务器时须重新输入密码')
    }
    password = stored.smtpPassword
  }
  return {
    smtpEnabled: input.smtpEnabled,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort || 587,
    smtpSecure: Boolean(input.smtpSecure),
    smtpUsername: input.smtpUsername,
    smtpPassword: password,
    smtpFromEmail: input.smtpFromEmail || input.smtpUsername,
    smtpFromName: input.smtpFromName || '校园广播站'
  }
}
