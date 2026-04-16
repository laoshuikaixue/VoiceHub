import {
  processVoucherExpiryJob,
  processVoucherReminderJob
} from '~~/server/services/voucherService'

export default defineNitroPlugin((nitroApp) => {
  const shouldEnable =
    process.env.ENABLE_VOUCHER_JOBS === 'true'
    || (process.env.ENABLE_VOUCHER_JOBS !== 'false' && process.env.NODE_ENV === 'production')

  if (!shouldEnable) {
    console.log('[VoucherJobs] 自动任务未启用（可通过 ENABLE_VOUCHER_JOBS=true 开启）')
    return
  }

  const intervalMs = Math.max(
    10_000,
    Number.parseInt(process.env.VOUCHER_JOBS_INTERVAL_MS || '60000', 10) || 60000
  )

  let running = false

  const run = async () => {
    if (running) {
      return
    }

    running = true

    try {
      const [reminderResult, expiryResult] = await Promise.all([
        processVoucherReminderJob(),
        processVoucherExpiryJob()
      ])

      if (reminderResult.remindedCount > 0 || expiryResult.expiredCount > 0) {
        console.log(
          `[VoucherJobs] reminded=${reminderResult.remindedCount}, expired=${expiryResult.expiredCount}`
        )
      }
    } catch (error) {
      console.error('[VoucherJobs] 任务执行失败:', error)
    } finally {
      running = false
    }
  }

  // 启动后先跑一次，避免首次执行延迟
  run()

  const timer = setInterval(run, intervalMs)

  nitroApp.hooks.hook('close', () => {
    clearInterval(timer)
  })

  console.log(`[VoucherJobs] 自动任务已启用，间隔 ${intervalMs}ms`)
})
