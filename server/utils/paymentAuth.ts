import { createApiError } from './apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export const requirePaymentUser = (event: any) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.PAYMENT_AUTH_REQUIRED, '请先登录')
  return user
}

export const requirePaymentAdmin = (event: any) => {
  const user = requirePaymentUser(event)
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.PAYMENT_ADMIN_REQUIRED, '需要管理员权限')
  }
  return user
}
