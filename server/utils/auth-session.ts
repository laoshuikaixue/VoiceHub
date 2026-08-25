import { getHeader } from 'h3'
import { randomUUID } from 'node:crypto'
import { authSessions, db, eq } from '~/drizzle/db'
import { and, isNull, ne } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerDate } from '~~/server/utils/serverTime'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getSessionExpiry() {
  const expiresAt = getServerDate()
  expiresAt.setTime(expiresAt.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000)
  return expiresAt
}

function getDateFromTimestamp(timestamp: number) {
  const date = getServerDate()
  date.setTime(timestamp)
  return date
}

type SessionUser = { id: number; role: string; tokenVersion?: number }

/**
 * 判断登录会话存储是否因迁移缺失而不可用。
 * 会话表不可用时禁止签发或接受无法撤销的登录令牌。
 */
export function isAuthSessionStorageError(error: unknown) {
  const value = error as { code?: string; message?: string; cause?: { code?: string; message?: string } } | null
  const code = String(value?.code || value?.cause?.code || '')
  const message = String(value?.message || value?.cause?.message || error || '')
  return ['42P01', '42703'].includes(code) && /auth_sessions/i.test(message)
}

function readUserAgent(event: H3Event) {
  return (getHeader(event, 'user-agent') || '').slice(0, 500)
}

export function parseUserAgent(userAgent: string) {
  const browser = /Edg\/?([\d.]+)/i.test(userAgent)
    ? 'Edge'
    : /OPR\/?([\d.]+)/i.test(userAgent)
      ? 'Opera'
      : /Chrome\/?([\d.]+)/i.test(userAgent)
        ? 'Chrome'
        : /Firefox\/?([\d.]+)/i.test(userAgent)
          ? 'Firefox'
          : /Safari\/?([\d.]+)/i.test(userAgent)
            ? 'Safari'
            : 'Unknown browser'
  const operatingSystem = /Windows NT/i.test(userAgent)
    ? 'Windows'
    : /Mac OS X/i.test(userAgent)
      ? 'macOS'
      : /Android/i.test(userAgent)
        ? 'Android'
        : /iPhone|iPad|iPod/i.test(userAgent)
          ? 'iOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Unknown OS'
  const device = /iPad|Tablet/i.test(userAgent)
    ? 'Tablet'
    : /Mobile|iPhone|Android/i.test(userAgent)
      ? 'Mobile'
      : 'Desktop'

  return { browser, operatingSystem, device }
}

export async function createAuthSession(event: H3Event, user: SessionUser, loginMethod = 'password') {
  const id = randomUUID()
  const now = getServerDate()
  const userAgent = readUserAgent(event)
  const metadata = parseUserAgent(userAgent)

  try {
    await db.insert(authSessions).values({
      id,
      userId: user.id,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: getSessionExpiry(),
      ipAddress: getClientIP(event),
      userAgent,
      ...metadata,
      loginMethod
    })
  } catch (error) {
    if (!isAuthSessionStorageError(error)) throw error
    console.error('[Auth] auth_sessions 表不可用，拒绝签发无法撤销的登录令牌:', error)
    throw createApiError(
      503,
      SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE,
      '登录会话存储暂时不可用，请先完成数据库迁移'
    )
  }

  return {
    id,
    token: JWTEnhanced.generateToken(user.id, user.role, user.tokenVersion ?? 0, id)
  }
}

export async function ensureAuthSession(event: H3Event, payload: { userId: number; jti: string; exp?: number }) {
  const existing = await db.query.authSessions.findFirst({ where: eq(authSessions.id, payload.jti) })
  if (existing) return existing

  const now = getServerDate()
  const userAgent = readUserAgent(event)
  const metadata = parseUserAgent(userAgent)
  const expiresAt = payload.exp ? getDateFromTimestamp(payload.exp * 1000) : getSessionExpiry()
  await db.insert(authSessions).values({
    id: payload.jti,
    userId: payload.userId,
    createdAt: now,
    lastActiveAt: now,
    expiresAt,
    ipAddress: getClientIP(event),
    userAgent,
    ...metadata,
    loginMethod: 'legacy'
  }).onConflictDoNothing()
  return db.query.authSessions.findFirst({ where: eq(authSessions.id, payload.jti) })
}

export async function touchAuthSession(sessionId: string, extendExpiry = false) {
  const update = {
    lastActiveAt: getServerDate(),
    ...(extendExpiry ? { expiresAt: getSessionExpiry() } : {})
  }
  await db.update(authSessions)
    .set(update)
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)))
}

export async function revokeAuthSession(userId: number, sessionId: string, reason = 'user') {
  const result = await db.update(authSessions)
    .set({ revokedAt: getServerDate(), revokedReason: reason })
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
    .returning({ id: authSessions.id })
  return result.length > 0
}

export async function revokeOtherAuthSessions(userId: number, currentSessionId: string | null, reason = 'logout_others') {
  const conditions = [eq(authSessions.userId, userId), isNull(authSessions.revokedAt)]
  if (currentSessionId) conditions.push(ne(authSessions.id, currentSessionId))
  const result = await db.update(authSessions)
    .set({ revokedAt: getServerDate(), revokedReason: reason })
    .where(and(...conditions))
    .returning({ id: authSessions.id })
  return result.length
}

export function sessionExpiryIsActive(expiresAt: Date) {
  return expiresAt.getTime() > getServerDate().getTime()
}
