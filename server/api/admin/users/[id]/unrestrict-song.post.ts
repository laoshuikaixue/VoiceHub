import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { userSongRestrictions } from '~/drizzle/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '只有管理员可执行该操作' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '用户ID不合法' })
  }

  const deleted = await db
    .delete(userSongRestrictions)
    .where(
      and(
        eq(userSongRestrictions.userId, id),
        eq(userSongRestrictions.reason, '超时未兑换点歌券')
      )
    )
    .returning({ id: userSongRestrictions.id })

  return {
    success: true,
    removed: deleted.length > 0,
    message: deleted.length > 0 ? '已解除点歌限制' : '该用户当前没有点歌限制'
  }
})
