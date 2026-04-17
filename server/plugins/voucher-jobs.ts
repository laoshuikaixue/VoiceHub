import {
  processVoucherExpiryJob,
  processVoucherReminderJob
} from '~~/server/services/voucherService'

export default defineNitroPlugin((nitroApp) => {
  const enableFlag = process.env.ENABLE_VOUCHER_JOBS?.trim().toLowerCase()
  const isProduction = process.env.NODE_ENV === 'production'
  const explicitlyEnabled = enableFlag === 'true'
  const explicitlyDisabled = enableFlag === 'false'
  const jobsEnabled = explicitlyEnabled || (!enableFlag && isProduction)

  const isServerless = Boolean(
    process.env.VERCEL
    || process.env.NETLIFY
    || process.env.AWS_LAMBDA_FUNCTION_NAME
    || process.env.K_SERVICE
  )

  if (!jobsEnabled || explicitlyDisabled) {
    console.log(
      '[VoucherJobs] 自动任务未启用（ENABLE_VOUCHER_JOBS=true 强制开启，留空仅生产环境启用）'
    )
    return
  }

  if (isServerless) {
    console.warn(
      '[VoucherJobs] 检测到 Serverless 运行环境，setInterval 任务可能不会持续执行；请使用外部 Cron 定时调用 /api/admin/voucher/process-jobs'
    )
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
