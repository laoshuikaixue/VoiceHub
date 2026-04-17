import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { userSongRestrictions } from '~/drizzle/schema'
import { AUTO_VOUCHER_RESTRICTION_REASON } from '~~/server/constants/voucher'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '只有管理员可执行该操作' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '用户ID不合法' })
  }

  const existing = await db
    .select({ id: userSongRestrictions.id, reason: userSongRestrictions.reason })
    .from(userSongRestrictions)
    .where(eq(userSongRestrictions.userId, id))
    .limit(1)

  if (existing.length === 0) {
    return {
      success: true,
      removed: false,
      message: '该用户当前没有点歌限制'
    }
  }

  if (existing[0].reason !== AUTO_VOUCHER_RESTRICTION_REASON) {
    return {
      success: true,
      removed: false,
      message: `无法通过此接口解除限制（原因：${existing[0].reason}）`
    }
  }

  await db
    .delete(userSongRestrictions)
    .where(eq(userSongRestrictions.id, existing[0].id))

  return {
    success: true,
    removed: true,
    message: '已解除点歌限制'
  }
})
