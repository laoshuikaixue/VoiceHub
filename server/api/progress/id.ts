import { createError, defineEventHandler } from 'h3'
import { isSongAdminRole } from '~~/server/utils/rbac'
import { generateProgressId } from './events'

export default defineEventHandler((event) => {
  // 检查认证（SSE 自持令牌校验，不用 event 级 guard：query token 场景 context.user 为空）
  const user = event.context.user
  if (!user || !isSongAdminRole(user)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const id = generateProgressId()
  return { id }
})
