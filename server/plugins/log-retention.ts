import { runLogRetentionCleanup } from '~~/server/utils/log-retention'
import { isServerlessRuntime } from '~~/server/utils/serverless-runtime'

/**
 * 数据库日志保留清理：启动后延迟执行一次，之后每日执行。
 * 清理失败只记录日志，不影响服务运行。
 *
 * serverless 实例无常驻生命周期，定时器不可依赖；该场景由请求触发的
 * 惰性清理（runLazyLogRetentionCleanup）兜底，此处直接跳过。
 */
const INITIAL_DELAY_MS = 10 * 60 * 1000
const INTERVAL_MS = 24 * 60 * 60 * 1000

export default defineNitroPlugin((nitroApp) => {
  if (isServerlessRuntime()) return

  const run = async () => {
    try {
      const result = await runLogRetentionCleanup()
      if (result.apiDeleted || result.auditDeleted) {
        console.log(
          `[LogRetention] 清理过期日志: API ${result.apiDeleted} 条，审计 ${result.auditDeleted} 条`
        )
      }
    } catch (error) {
      console.error('[LogRetention] 清理过期日志失败:', error)
    }
  }

  const initialTimer = setTimeout(run, INITIAL_DELAY_MS)
  const intervalTimer = setInterval(run, INTERVAL_MS)
  if (typeof initialTimer.unref === 'function') initialTimer.unref()
  if (typeof intervalTimer.unref === 'function') intervalTimer.unref()

  nitroApp.hooks.hook('close', () => {
    clearTimeout(initialTimer)
    clearInterval(intervalTimer)
  })
})
