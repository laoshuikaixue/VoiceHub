import type { H3Event } from 'h3'
import { SERVER_ERROR_CODES } from '#server/config/constants'
import { createApiError } from '#server/utils/apiError'

const CARD_ADMIN_ROLES = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']

export function requireCardCodeAdministrator(event: H3Event) {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '需要登录')
  if (!CARD_ADMIN_ROLES.includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要卡密管理权限')
  }
  return user
}