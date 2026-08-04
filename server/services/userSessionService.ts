import type { H3Event } from 'h3'
import { getClientIP, getRequestHeader, getRequestURL } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { userSessions } from '~/drizzle/schema'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'

export const USER_SESSION_ACTIVE_WINDOW_MS = 5 * 60 * 1000
const SESSION_CHECK_INTERVAL_MS = 30 * 1000
const SESSION_CACHE_LIMIT = 5000

interface SessionTokenPayload {
  userId: number
  jti: string
  tokenVersion?: number
  exp?: number
}

interface SessionUser {
  id: number
  tokenVersion?: number
}

interface SessionCacheEntry {
  checkedAt: number
  revoked: boolean
}

const sessionStateCache = new Map<string, SessionCacheEntry>()

function trimSessionCache() {
  if (sessionStateCache.size <= SESSION_CACHE_LIMIT) return
  const entries = [...sessionStateCache.entries()].sort((left, right) => left[1].checkedAt - right[1].checkedAt)
  for (const [sessionId] of entries.slice(0, Math.ceil(entries.length / 4))) sessionStateCache.delete(sessionId)
}

export function parseSessionUserAgent(userAgent = '') {
  const value = userAgent.slice(0, 500)
  let browser = 'Unknown'
  if (/Edg\//i.test(value)) browser = 'Edge'
  else if (/OPR\//i.test(value)) browser = 'Opera'
  else if (/Firefox\//i.test(value) || /FxiOS\//i.test(value)) browser = 'Firefox'
  else if (/Chrome\//i.test(value) || /CriOS\//i.test(value)) browser = 'Chrome'
  else if (/Safari\//i.test(value) && /Version\//i.test(value)) browser = 'Safari'

  let deviceType = 'desktop'
  if (/bot|crawler|spider|slurp/i.test(value)) deviceType = 'bot'
  else if (/iPad|Tablet|PlayBook|Silk/i.test(value)) deviceType = 'tablet'
  else if (/Mobile|Android|iPhone|iPod/i.test(value)) deviceType = 'mobile'
  else if (!value) deviceType = 'unknown'

  return { browser, deviceType }
}

function sessionExpiry(payload: SessionTokenPayload) {
  if (Number.isFinite(Number(payload.exp))) return new Date(Number(payload.exp) * 1000)
  const fallback = getServerDate()
  fallback.setDate(fallback.getDate() + 7)
  return fallback
}

/**
 * 同步已认证 JWT 对应的真实会话。会话表不可用时按放行策略降级，不影响原有认证。
 */
export async function syncAuthenticatedUserSession(
  event: H3Event,
  payload: SessionTokenPayload,
  user: SessionUser,
  pathOverride?: string
): Promise<boolean> {
  const sessionId = typeof payload.jti === 'string' ? payload.jti : ''
  if (!sessionId || !Number.isInteger(user.id)) return true

  event.context.userSessionId = sessionId
  const nowMs = getServerTimestamp()
  const cached = sessionStateCache.get(sessionId)
  if (cached && nowMs - cached.checkedAt < SESSION_CHECK_INTERVAL_MS) return !cached.revoked

  const now = getServerDate()
  const userAgent = String(getRequestHeader(event, 'user-agent') || '').slice(0, 500)
  const { browser, deviceType } = parseSessionUserAgent(userAgent)
  const requestPath = String(pathOverride || getRequestURL(event).pathname || '/').slice(0, 500)
  const ipAddress = String(getClientIP(event) || 'unknown').slice(0, 255)

  try {
    const existing = await db
      .select({ id: userSessions.id, revokedAt: userSessions.revokedAt })
      .from(userSessions)
      .where(eq(userSessions.id, sessionId))
      .limit(1)

    if (existing[0]?.revokedAt) {
      sessionStateCache.set(sessionId, { checkedAt: nowMs, revoked: true })
      return false
    }

    if (existing[0]) {
      await db
        .update(userSessions)
        .set({
          tokenVersion: payload.tokenVersion ?? user.tokenVersion ?? 0,
          ipAddress,
          userAgent,
          browser,
          deviceType,
          lastPath: requestPath,
          lastActiveAt: now,
          expiresAt: sessionExpiry(payload)
        })
        .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
    } else {
      await db.insert(userSessions).values({
        id: sessionId,
        userId: user.id,
        tokenVersion: payload.tokenVersion ?? user.tokenVersion ?? 0,
        ipAddress,
        userAgent,
        browser,
        deviceType,
        lastPath: requestPath,
        startedAt: now,
        lastActiveAt: now,
        expiresAt: sessionExpiry(payload)
      })
    }

    sessionStateCache.set(sessionId, { checkedAt: nowMs, revoked: false })
    trimSessionCache()
    return true
  } catch (error) {
    // 迁移尚未应用或数据库短暂故障时不能使所有用户掉线。
    console.error('[UserSession] 同步会话失败，按放行策略降级:', error)
    return true
  }
}

export function markUserSessionRevoked(sessionId: string) {
  sessionStateCache.set(sessionId, { checkedAt: getServerTimestamp(), revoked: true })
}

export async function updateCurrentUserSessionActivity(event: H3Event, lastPath?: string) {
  const sessionId = String(event.context.userSessionId || '')
  if (!sessionId) return
  try {
    await db
      .update(userSessions)
      .set({
        lastActiveAt: getServerDate(),
        lastPath: String(lastPath || getRequestURL(event).pathname || '/').slice(0, 500)
      })
      .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
  } catch (error) {
    console.error('[UserSession] 更新活动时间失败:', error)
  }
}

export async function revokeCurrentUserSession(event: H3Event, reason = '用户主动退出') {
  const sessionId = String(event.context.userSessionId || '')
  if (!sessionId) return
  try {
    await db
      .update(userSessions)
      .set({ revokedAt: getServerDate(), revocationReason: reason.slice(0, 255) })
      .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
    markUserSessionRevoked(sessionId)
  } catch (error) {
    console.error('[UserSession] 注销当前会话失败:', error)
  }
}
