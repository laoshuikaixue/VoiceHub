import { defineEventHandler, createError } from 'h3'
import { generateProgressId } from './events'

export default defineEventHandler((event) => {
  // 检查认证
  const user = event.context.user
  if (!user || user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const id = generateProgressId()
  return { id }
})