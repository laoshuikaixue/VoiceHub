import { db } from '~/drizzle/db'
import { cardCodeDispatchPlans } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { assertCardCodeAdmin } from '~~/server/utils/dispatch-plan-input'

/** 删除自动派发计划。已派发出去的点歌券与派发记录不受影响。 */
export default defineEventHandler(async (event) => {
  assertCardCodeAdmin(event.context.user)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '计划 ID 不合法' })
  }

  const [deleted] = await db
    .delete(cardCodeDispatchPlans)
    .where(eq(cardCodeDispatchPlans.id, id))
    .returning({ id: cardCodeDispatchPlans.id })

  if (!deleted) {
    throw createError({ statusCode: 404, message: '自动派发计划不存在' })
  }

  return { success: true, id: deleted.id }
})
