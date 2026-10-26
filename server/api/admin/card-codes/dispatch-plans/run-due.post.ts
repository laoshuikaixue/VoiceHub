import { runDueDispatchPlans } from '~~/server/services/dispatchPlanService'
import { assertCardCodeAdmin } from '~~/server/utils/dispatch-plan-input'

/**
 * 手动触发「扫描到点计划」。
 *
 * 进程内的 nitro 插件已经每 30 秒自动扫描，这个端点主要给两类场景用：
 * - 无服务器部署（插件不启动）时由外部定时器调用
 * - 运维排查：想立刻确认有没有该发而没发的计划
 */
export default defineEventHandler(async (event) => {
  assertCardCodeAdmin(event.context.user)

  const results = await runDueDispatchPlans()
  return { success: true, executed: results.length, data: results }
})
