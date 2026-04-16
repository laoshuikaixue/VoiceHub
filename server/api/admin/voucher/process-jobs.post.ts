import { createError, defineEventHandler, getRequestHeader } from 'h3'
import {
  processVoucherExpiryJob,
  processVoucherReminderJob
} from '~~/server/services/voucherService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const cronSecret = process.env.VOUCHER_CRON_SECRET
  const requestSecret = getRequestHeader(event, 'x-voucher-cron-secret')

  const isAdmin = !!user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role)
  const isValidCron = !!cronSecret && requestSecret === cronSecret

  if (!isAdmin && !isValidCron) {
    throw createError({ statusCode: 403, message: '没有权限执行卡密任务' })
  }

  const [reminderResult, expiryResult] = await Promise.all([
    processVoucherReminderJob(),
    processVoucherExpiryJob()
  ])

  return {
    success: true,
    reminderResult,
    expiryResult
  }
})
