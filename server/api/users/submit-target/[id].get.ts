import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

/** 管理员代他人投稿时展示被代投稿用户的基本资料（不含登录与密码信息） */
export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '需要登录')
  }
  if (!['SUPER_ADMIN', 'ADMIN', 'SONG_ADMIN'].includes(currentUser.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有权限访问')
  }

  const userId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的用户 ID')
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      username: true,
      role: true,
      grade: true,
      class: true,
      status: true,
      email: true,
      emailVerified: true
    }
  })

  if (!target) {
    throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '用户不存在')
  }

  return { user: target }
})
