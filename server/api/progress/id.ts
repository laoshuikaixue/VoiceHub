import { createError, defineEventHandler } from 'h3'
import { generateProgressId } from './events'

export default defineEventHandler((event) => {
  // 检查认证
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const id = generateProgressId()
  return { id }
})
