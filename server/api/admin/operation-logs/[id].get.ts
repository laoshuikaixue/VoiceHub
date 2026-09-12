import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { adminOperationLogs, users } from '~/drizzle/schema'
import { sanitizeAdminOperationChanges } from '~~/server/services/adminOperationLogService'
import { verifyUserAuth } from '~~/server/utils/auth'

async function requireSuperAdmin(event: any) {
  const authResult = await verifyUserAuth(event)
  if (!authResult.success || !authResult.user) {
    throw createError({ statusCode: 401, message: '未登录或登录已失效' })
  }
  if (authResult.user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '仅超级管理员可查看操作记录' })
  }
}

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '操作记录 ID 不能为空' })

  const [row] = await db.select({
    id: adminOperationLogs.id,
    createdAt: adminOperationLogs.createdAt,
    actorId: adminOperationLogs.actorId,
    actorRole: adminOperationLogs.actorRole,
    actorName: users.name,
    actorUsername: users.username,
    action: adminOperationLogs.action,
    targetType: adminOperationLogs.targetType,
    targetId: adminOperationLogs.targetId,
    targetLabel: adminOperationLogs.targetLabel,
    result: adminOperationLogs.result,
    summary: adminOperationLogs.summary,
    failureCode: adminOperationLogs.failureCode,
    changes: adminOperationLogs.changes,
    ipAddress: adminOperationLogs.ipAddress,
    requestId: adminOperationLogs.requestId
  })
    .from(adminOperationLogs)
    .leftJoin(users, eq(adminOperationLogs.actorId, users.id))
    .where(eq(adminOperationLogs.id, id))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: '操作记录不存在' })

  return {
    success: true,
    log: {
      id: row.id,
      createdAt: row.createdAt,
      actorId: row.actorId,
      actorRole: row.actorRole,
      actorName: row.actorName || row.actorUsername || '已删除用户',
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
      result: row.result,
      summary: row.summary,
      failureCode: row.failureCode,
      changes: sanitizeAdminOperationChanges(row.changes),
      ipAddress: row.ipAddress,
      requestId: row.requestId
    }
  }
})
