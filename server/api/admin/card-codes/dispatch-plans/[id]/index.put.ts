import { db } from '~/drizzle/db'
import { cardCodeDispatchPlans } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { computeNextRunAt } from '~~/server/services/dispatchPlanService'
import { assertCardCodeAdmin, normalizeDispatchPlanInput } from '~~/server/utils/dispatch-plan-input'

/**
 * 更新自动派发计划。
 *
 * 两种用法：
 * - 只传 enabled：开关切换（列表里的启停按钮），不动其它配置
 * - 传完整配置：编辑后重新保存，并按新规则重算下次执行时间
 */
export default defineEventHandler(async (event) => {
  assertCardCodeAdmin(event.context.user)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '计划 ID 不合法' })
  }

  const [existing] = await db
    .select()
    .from(cardCodeDispatchPlans)
    .where(eq(cardCodeDispatchPlans.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, message: '自动派发计划不存在' })
  }

  const body = (await readBody(event)) || {}
  const keys = Object.keys(body)
  const onlyToggle = keys.length > 0 && keys.every((key) => key === 'enabled')

  const now = new Date()

  if (onlyToggle) {
    const enabled = body.enabled !== false
    // 重新启用时如果下次执行时间已过期（停用期间错过），按规则从当前时间重新推算
    const current = existing.nextRunAt ? new Date(existing.nextRunAt) : null
    const nextRunAt = enabled
      ? current && current.getTime() > now.getTime()
        ? current
        : computeNextRunAt(
            {
              scheduleType: existing.scheduleType,
              startAt: existing.startAt,
              endAt: existing.endAt,
              weekdays: existing.weekdays || [],
              dayOfMonth: existing.dayOfMonth
            },
            now
          )
      : existing.nextRunAt

    const [updated] = await db
      .update(cardCodeDispatchPlans)
      .set({ enabled, nextRunAt, updatedAt: now })
      .where(eq(cardCodeDispatchPlans.id, id))
      .returning()

    return {
      success: true,
      data: updated,
      message:
        enabled && !nextRunAt
          ? '按当前时间规则已无可执行时间，计划不会自动执行'
          : undefined
    }
  }

  const input = normalizeDispatchPlanInput(body)
  const nextRunAt = computeNextRunAt(
    {
      scheduleType: input.scheduleType,
      startAt: input.startAt,
      endAt: input.endAt,
      weekdays: input.weekdays,
      dayOfMonth: input.dayOfMonth
    },
    now
  )

  const [updated] = await db
    .update(cardCodeDispatchPlans)
    .set({
      name: input.name,
      enabled: body.enabled !== false,
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
      updatedAt: now
    })
    .where(eq(cardCodeDispatchPlans.id, id))
    .returning()

  return {
    success: true,
    data: updated,
    message: nextRunAt ? undefined : '按当前时间规则已无可执行时间，计划不会自动执行'
  }
})
