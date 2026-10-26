import { db } from '~/drizzle/db'
import { cardCodeDispatchPlans } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { computeNextRunAt } from '~~/server/services/dispatchPlanService'
import { assertCardCodeAdmin, normalizeDispatchPlanInput } from '~~/server/utils/dispatch-plan-input'

/** 新建自动派发计划 */
export default defineEventHandler(async (event) => {
  const user = assertCardCodeAdmin(event.context.user)
  const input = normalizeDispatchPlanInput(await readBody(event))

  const nextRunAt = computeNextRunAt(
    {
      scheduleType: input.scheduleType,
      startAt: input.startAt,
      endAt: input.endAt,
      weekdays: input.weekdays,
      dayOfMonth: input.dayOfMonth
    },
    new Date()
  )

  const [created] = await db
    .insert(cardCodeDispatchPlans)
    .values({
      name: input.name,
      enabled: true,
      countPerUser: input.countPerUser,
      recipientIds: input.recipientIds,
      note: input.note,
      notify: input.notify,
      prefix: input.prefix,
      scheduleType: input.scheduleType,
      startAt: input.startAt,
      endAt: input.endAt,
      weekdays: input.weekdays,
      dayOfMonth: input.dayOfMonth,
      nextRunAt,
      createdBy: user.id,
      createdByName: user.name || user.username || null
    })
    .returning()

  return {
    success: true,
    data: created,
    // 执行时间已经过（例如单次计划选了过去的时刻）时明确告知，避免管理员以为会立刻发券
    message: nextRunAt ? undefined : '按当前时间规则已无可执行时间，计划不会自动执行'
  }
})
