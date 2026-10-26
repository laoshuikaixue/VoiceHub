import { runDueDispatchPlans } from '~~/server/services/dispatchPlanService'
import { assertCardCodeAdmin } from '~~/server/utils/dispatch-plan-input'

/**
 * 管理员手动触发「扫描到点计划」。
 *
 * 不设后台自动任务，派发计划只在本端点被调用时执行（常驻与无服务器部署行为一致）：
 * - 后台「扫描到期计划」按钮点击后立即执行到点的计划
 * 到点但未执行的计划会一直保留到下一次点击本按钮，不会自行触发。
 */
export default defineEventHandler(async (event) => {
  assertCardCodeAdmin(event.context.user)

  const results = await runDueDispatchPlans({ triggerSource: 'MANUAL' })
  return {
    success: true,
    executed: results.length,
    data: results
  }
})
