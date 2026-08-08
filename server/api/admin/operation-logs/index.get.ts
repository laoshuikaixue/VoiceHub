import { createError, defineEventHandler, getQuery } from 'h3'
import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { adminOperationLogs, users } from '~/drizzle/schema'
import { verifyUserAuth } from '~~/server/utils/auth'

function maskIpAddress(ipAddress: string | null): string {
  if (!ipAddress || ipAddress === 'unknown') return '未知'
  if (ipAddress.includes('.')) {
    const parts = ipAddress.split('.')
    return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.*` : '已掩码'
  }

  const parts = ipAddress.split(':').filter(Boolean)
  return parts.length > 0 ? `${parts.slice(0, 3).join(':')}:*` : '已掩码'
}

function parseDate(value: unknown, name: string): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, message: `${name} 格式无效` })
  }
  return date
}

async function requireSuperAdmin(event: any) {
  const authResult = await verifyUserAuth(event)
  if (!authResult.success || !authResult.user) {
    throw createError({ statusCode: 401, message: '未登录或登录已失效' })
  }
  if (authResult.user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '仅超级管理员可查看操作记录' })
  }
  return authResult.user
}

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '20'), 10) || 20))
  const actorId = query.actorId ? Number.parseInt(String(query.actorId), 10) : undefined
  if (query.actorId && (!Number.isInteger(actorId) || actorId <= 0)) {
    throw createError({ statusCode: 400, message: 'actorId 必须为正整数' })
  }

  const conditions: SQL[] = []
  if (actorId) conditions.push(eq(adminOperationLogs.actorId, actorId))
  if (typeof query.action === 'string' && query.action.trim()) conditions.push(eq(adminOperationLogs.action, query.action.trim()))
  if (typeof query.targetType === 'string' && query.targetType.trim()) conditions.push(eq(adminOperationLogs.targetType, query.targetType.trim()))
  if (typeof query.targetId === 'string' && query.targetId.trim()) conditions.push(eq(adminOperationLogs.targetId, query.targetId.trim()))
  if (typeof query.result === 'string' && query.result.trim()) conditions.push(eq(adminOperationLogs.result, query.result.trim()))
  if (typeof query.requestId === 'string' && query.requestId.trim()) conditions.push(eq(adminOperationLogs.requestId, query.requestId.trim()))

  const startAt = parseDate(query.startAt, 'startAt')
  const endAt = parseDate(query.endAt, 'endAt')
  if (startAt) conditions.push(gte(adminOperationLogs.createdAt, startAt))
  if (endAt) conditions.push(lte(adminOperationLogs.createdAt, endAt))

  if (typeof query.keyword === 'string' && query.keyword.trim()) {
    const keyword = query.keyword.trim().slice(0, 200)
    conditions.push(or(
      ilike(adminOperationLogs.summary, `%${keyword}%`),
      ilike(adminOperationLogs.targetLabel, `%${keyword}%`),
      ilike(adminOperationLogs.action, `%${keyword}%`)
    ))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const offset = (page - 1) * limit
  const [rows, totalResult] = await Promise.all([
    db.select({
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
      requestId: adminOperationLogs.requestId,
      ipAddress: adminOperationLogs.ipAddress
    })
      .from(adminOperationLogs)
      .leftJoin(users, eq(adminOperationLogs.actorId, users.id))
      .where(whereClause)
      .orderBy(desc(adminOperationLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(adminOperationLogs).where(whereClause)
  ])

  const total = Number(totalResult[0]?.total || 0)
  return {
    success: true,
    logs: rows.map((row) => ({
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
      requestId: row.requestId,
      ipAddress: maskIpAddress(row.ipAddress)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
})
