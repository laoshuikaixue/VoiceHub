import { createError, defineEventHandler } from 'h3'
import { generateProgressId } from './events'
import { isSongAdminRole } from '~~/server/utils/rbac/guards'

export default defineEventHandler((event) => {
  // 检查认证
  const user = event.context.user
  if (!user || !isSongAdminRole(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const id = generateProgressId()
  return { id }
})
