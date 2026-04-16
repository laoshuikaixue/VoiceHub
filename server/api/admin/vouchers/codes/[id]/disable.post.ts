import { and, eq } from 'drizzle-orm'
import { db, voucherCodes } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '仅管理员可禁用点歌券'
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '点歌券ID不能为空'
    })
  }

  const now = new Date()
  const updated = await db
    .update(voucherCodes)
    .set({
      status: 'DISABLED',
      updatedAt: now
    })
    .where(and(eq(voucherCodes.id, id), eq(voucherCodes.status, 'ACTIVE')))
    .returning({ id: voucherCodes.id })

  if (updated.length === 0) {
    const existing = await db
      .select({ id: voucherCodes.id, status: voucherCodes.status })
      .from(voucherCodes)
      .where(eq(voucherCodes.id, id))
      .limit(1)

    if (existing.length === 0) {
      throw createError({
        statusCode: 404,
        message: '点歌券不存在'
      })
    }

    const currentStatus = existing[0]?.status || 'UNKNOWN'

    throw createError({
      statusCode: 400,
      message: `当前状态为 ${currentStatus}，无法禁用`
    })
  }

  return {
    success: true,
    message: '点歌券已禁用'
  }
})
