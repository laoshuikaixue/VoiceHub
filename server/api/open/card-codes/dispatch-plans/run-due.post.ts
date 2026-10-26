import { runDueDispatchPlans } from '~~/server/services/dispatchPlanService'

/**
 * 外部调度触发「扫描到点计划」。
 *
 * 无服务器部署（Vercel / Netlify / EdgeOne Pages）没有常驻进程，进程内 nitro 插件不会启动，
 * 自动派发只能靠外部定时器按分钟/小时回调本端点。路径落在 /api/open/card-codes/ 下，
 * 由 api-auth 中间件按 API Key 鉴权，需要 `card-codes:write` 权限。
 *
 * 与进程内定时器共用同一套抢占逻辑（一条计划的一次执行只会被一个实例领走），
 * 因此外部调度调密、多个实例并存都不会重复发券。
 */
export default defineEventHandler(async (event) => {
  if (!event.context.apiKey) {
    throw createError({ statusCode: 401, message: 'API认证失败' })
  }

  const results = await runDueDispatchPlans({ triggerSource: 'CRON' })
  if (results.length) {
    console.log(`[点歌券自动派发] 外部调度触发执行 ${results.length} 条计划`)
  }

  return {
    success: true,
    executed: results.length,
    data: results
  }
})
