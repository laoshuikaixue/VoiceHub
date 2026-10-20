import { createError, defineEventHandler } from 'h3'
import { generateProgressId } from './events'
import { ADMIN_ACCESS_ROLES } from '~~/server/utils/adminPermissions'

export default defineEventHandler((event) => {
  // 检查认证
  const user = event.context.user
  if (!user || !ADMIN_ACCESS_ROLES.includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const id = generateProgressId()
  return { id }
})
