import { and, count, desc, eq, gt, gte, ilike, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { verifyUserAuth } from '~~/server/utils/auth'
import { db } from '~/drizzle/db'
import { userSessions, users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { USER_SESSION_ACTIVE_WINDOW_MS } from '~~/server/services/userSessionService'

const requireSuperAdmin = async (event: any) => {
  const auth = await verifyUserAuth(event)
  if (!auth.success || !auth.user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未登录或登录已失效')
  if (auth.user.role !== 'SUPER_ADMIN') throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '仅超级管理员可查看用户活动记录')
  return auth.user
}

const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '时间范围格式无效')
  return date
}

const sessionState = (lastActiveAt: Date, now: Date) =>
  now.getTime() - new Date(lastActiveAt).getTime() <= USER_SESSION_ACTIVE_WINDOW_MS ? 'active' : 'idle'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '20'), 10) || 20))
  const offset = (page - 1) * limit
  const status = ['active', 'idle'].includes(String(query.status)) ? String(query.status) : ''
  const deviceType = typeof query.deviceType === 'string' ? query.deviceType.trim().slice(0, 32) : ''
  const browser = typeof query.browser === 'string' ? query.browser.trim().slice(0, 64) : ''
  const keyword = typeof query.keyword === 'string' ? query.keyword.trim().slice(0, 120) : ''
  const startAt = parseDate(query.startAt)
  const endAt = parseDate(query.endAt)
  const now = getServerDate()
  const activeSince = new Date(now.getTime() - USER_SESSION_ACTIVE_WINDOW_MS)
  const baseConditions: SQL[] = [
    isNull(userSessions.revokedAt),
    gt(userSessions.expiresAt, now),
    sql`${userSessions.tokenVersion} = ${users.tokenVersion}`
  ]

  if (deviceType) baseConditions.push(eq(userSessions.deviceType, deviceType))
  if (browser) baseConditions.push(eq(userSessions.browser, browser))
  if (startAt) baseConditions.push(gte(userSessions.lastActiveAt, startAt))
  if (endAt) baseConditions.push(sql`${userSessions.lastActiveAt} <= ${endAt}`)
  if (keyword) {
    baseConditions.push(or(
      ilike(users.username, `%${keyword}%`),
      ilike(users.name, `%${keyword}%`),
      ilike(userSessions.ipAddress, `%${keyword}%`)
    ) as SQL)
  }
  const listConditions = [...baseConditions]
  if (status === 'active') listConditions.push(gte(userSessions.lastActiveAt, activeSince))
  if (status === 'idle') listConditions.push(lt(userSessions.lastActiveAt, activeSince))

  try {
    const where = and(...listConditions)
    const [rows, totalRows, activeRows, idleRows, usersRows, browserRows, deviceRows] = await Promise.all([
      db.select({
        id: userSessions.id,
        userId: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        ipAddress: userSessions.ipAddress,
        browser: userSessions.browser,
        deviceType: userSessions.deviceType,
        lastPath: userSessions.lastPath,
        startedAt: userSessions.startedAt,
        lastActiveAt: userSessions.lastActiveAt,
        expiresAt: userSessions.expiresAt
      }).from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(where).orderBy(desc(userSessions.lastActiveAt)).limit(limit).offset(offset),
      db.select({ value: count() }).from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(where),
      db.select({ value: count() }).from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(and(...baseConditions, gte(userSessions.lastActiveAt, activeSince))),
      db.select({ value: count() }).from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(and(...baseConditions, lt(userSessions.lastActiveAt, activeSince))),
      db.execute(sql`SELECT count(DISTINCT s.user_id)::int AS value FROM user_sessions s INNER JOIN "User" u ON u.id = s.user_id WHERE s.revoked_at IS NULL AND s.expires_at > now() AND s.token_version = u."tokenVersion"`),
      db.select({ label: userSessions.browser, value: count() }).from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(and(isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now), sql`${userSessions.tokenVersion} = ${users.tokenVersion}`)).groupBy(userSessions.browser).orderBy(desc(count())),
      db.select({ label: userSessions.deviceType, value: count() }).from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(and(isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now), sql`${userSessions.tokenVersion} = ${users.tokenVersion}`)).groupBy(userSessions.deviceType).orderBy(desc(count()))
    ])

    const maskedIp = (ip: string) => ip.includes('.')
      ? `${ip.split('.').slice(0, 3).join('.')}.*`
      : ip.includes(':') ? `${ip.split(':').filter(Boolean).slice(0, 3).join(':')}:*` : '已掩码'
    const sessions = rows.map((row) => ({
      ...row,
      displayName: row.name || row.username,
      ipAddress: maskedIp(row.ipAddress),
      status: sessionState(row.lastActiveAt, now)
    }))

    return {
      collectedAt: now.toISOString(),
      sessions,
      pagination: { page, limit, total: Number(totalRows[0]?.value || 0), totalPages: Math.ceil(Number(totalRows[0]?.value || 0) / limit) },
      stats: {
        totalSessions: Number(activeRows[0]?.value || 0) + Number(idleRows[0]?.value || 0),
        activeSessions: Number(activeRows[0]?.value || 0),
        idleSessions: Number(idleRows[0]?.value || 0),
        onlineUsers: Number((usersRows as any[])[0]?.value || 0),
        browsers: browserRows.map((row) => ({ label: row.label, value: Number(row.value) })),
        devices: deviceRows.map((row) => ({ label: row.label, value: Number(row.value) }))
      }
    }
  } catch (error) {
    console.error('[UserActivity] 查询用户活动失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.USER_SESSION_FETCH_FAILED, '用户活动记录暂时无法读取')
  }
})
