import { isServerlessRuntime } from '~~/server/utils/serverless-runtime'

/**
 * 点歌券自动派发执行器（仅常驻进程）。
 *
 * 只用 setInterval 轮询，不引入 cron 依赖：
 * - 计划本身把「下一次该在什么时候执行」算好存在 nextRunAt 上，扫描只做一次范围查询，
 *   30 秒的轮询精度对「每天/每周/每月某时刻发券」这种场景完全够用
 * - 一次执行的抢占与游标推进在同一条条件 UPDATE 里完成（dispatchPlanService.claimPlanOccurrence），
 *   所以多个实例同时扫描、或扫描与手动执行并发，都不会重复发券
 */
const SCAN_INTERVAL_MS = 30_000
const FIRST_SCAN_DELAY_MS = 10_000

export default defineNitroPlugin((nitroApp) => {
  // 无服务器实例没有常驻生命周期，由外部调度带 API Key 调
  // POST /api/open/card-codes/dispatch-plans/run-due
  if (isServerlessRuntime()) return

  let scanning = false

  const scan = async () => {
    if (scanning) return
    scanning = true
    try {
      const { runDueDispatchPlans } = await import('~~/server/services/dispatchPlanService')
      const results = await runDueDispatchPlans({ triggerSource: 'SCHEDULED' })
      if (results.length) {
        console.log(`[点歌券自动派发] 本轮执行 ${results.length} 条计划`)
      }
    } catch (error) {
      console.error('[点歌券自动派发] 扫描失败:', error)
    } finally {
      scanning = false
    }
  }

  const timer = setInterval(scan, SCAN_INTERVAL_MS)
  // 定时器不应拖住进程退出
  if (typeof timer.unref === 'function') timer.unref()

  const initialTimer = setTimeout(scan, FIRST_SCAN_DELAY_MS)
  if (typeof initialTimer.unref === 'function') initialTimer.unref()

  nitroApp.hooks.hook('close', () => {
    clearInterval(timer)
    clearTimeout(initialTimer)
  })
})
