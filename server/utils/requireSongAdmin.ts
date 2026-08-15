import type { H3Event } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export function requireSongAdmin(event: H3Event): void {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有歌曲管理员及以上权限才能执行此操作')
  }
  if (user.status !== 'active') {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE, '账号状态异常，无法执行此操作')
  }
}
