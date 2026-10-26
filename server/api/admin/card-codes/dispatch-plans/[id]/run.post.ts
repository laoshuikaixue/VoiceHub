import { executeDispatchPlan } from '~~/server/services/dispatchPlanService'
import { assertCardCodeAdmin } from '~~/server/utils/dispatch-plan-input'

/**
 * 立即执行一次（不影响原有排期）。
 *
 * 常用于「先试跑一遍确认名单和券码正确」。与定时器共用 runningAt 抢占，
 * 因此在到点瞬间点立即执行不会重复发券。
 */
export default defineEventHandler(async (event) => {
  assertCardCodeAdmin(event.context.user)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '计划 ID 不合法' })
  }

  const result = await executeDispatchPlan(id, { force: true })
  return { success: result.status !== 'FAILED', data: result }
})
