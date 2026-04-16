import { and, eq, inArray, ne } from 'drizzle-orm'
import { db, userSongRestrictions, voucherRedeemTasks } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '仅管理员可取消点歌券任务'
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '任务ID不能为空'
    })
  }

  const taskResult = await db
    .select({
      id: voucherRedeemTasks.id,
      userId: voucherRedeemTasks.userId,
      status: voucherRedeemTasks.status
    })
    .from(voucherRedeemTasks)
    .where(eq(voucherRedeemTasks.id, id))
    .limit(1)

  const task = taskResult[0]

  if (!task) {
    throw createError({
      statusCode: 404,
      message: '兑换任务不存在'
    })
  }

  if (task.status === 'REDEEMED') {
    throw createError({
      statusCode: 400,
      message: '已兑换任务不能取消'
    })
  }

  if (task.status === 'CANCELLED') {
    return {
      success: true,
      message: '任务已是取消状态'
    }
  }

  const now = new Date()

  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(voucherRedeemTasks)
      .set({
        status: 'CANCELLED',
        updatedAt: now
      })
      .where(
        and(
          eq(voucherRedeemTasks.id, id),
          inArray(voucherRedeemTasks.status, ['PENDING', 'EXPIRED'])
        )
      )
      .returning({ id: voucherRedeemTasks.id })

    if (updated.length === 0) {
      throw createError({
        statusCode: 409,
        message: '任务状态已变化，请刷新后重试'
      })
    }

    let restrictionReleased = false

    if (task.status === 'EXPIRED') {
      const remainingExpired = await tx
        .select({ id: voucherRedeemTasks.id })
        .from(voucherRedeemTasks)
        .where(
          and(
            eq(voucherRedeemTasks.userId, task.userId),
            eq(voucherRedeemTasks.status, 'EXPIRED'),
            ne(voucherRedeemTasks.id, id)
          )
        )
        .limit(1)

      if (remainingExpired.length === 0) {
        await tx
          .delete(userSongRestrictions)
          .where(
            and(
              eq(userSongRestrictions.userId, task.userId),
              eq(userSongRestrictions.reason, '超时未兑换点歌券')
            )
          )
        restrictionReleased = true
      }
    }

    return { restrictionReleased }
  })

  return {
    success: true,
    message: result.restrictionReleased
      ? '任务已取消，并已解除该用户的点歌限制'
      : '任务已取消'
  }
})
