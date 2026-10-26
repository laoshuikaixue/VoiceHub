import { db } from '~/drizzle/db'
import { cardCodeDispatchPlans } from '~/drizzle/schema'
import { desc } from 'drizzle-orm'
import { assertCardCodeAdmin } from '~~/server/utils/dispatch-plan-input'
import { isServerlessRuntime } from '~~/server/utils/serverless-runtime'

/** 自动派发计划列表（按创建时间倒序） */
export default defineEventHandler(async (event) => {
  assertCardCodeAdmin(event.context.user)

  const rows = await db
    .select()
    .from(cardCodeDispatchPlans)
    .orderBy(desc(cardCodeDispatchPlans.createdAt))
    .limit(200)

  return {
    success: true,
    // internal：进程内定时器会自动扫描；external：无服务器部署，必须靠外部调度触发
    scheduler: isServerlessRuntime() ? 'external' : 'internal',
    data: rows.map((row) => ({
      ...row,
      recipientCount: Array.isArray(row.recipientIds) ? row.recipientIds.length : 0
    }))
  }
})
