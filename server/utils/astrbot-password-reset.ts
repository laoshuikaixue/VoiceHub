import { randomBytes } from 'node:crypto'
import { getServerTimestamp } from './serverTime'

/**
 * 机器人重置密码的两步确认缓存（模块级内存态）。
 *
 * 第一步 `/广播 重置密码 <新密码>` 创建 pending 条目；第二步
 * `/广播 重置密码 确认 <新密码>` 凭 jti 消费。消费是一次性的，
 * 防「确认」步骤被跳过或重放；缓存里保存密码原文（TTL 仅 5 分钟）
 * 保证插件无法伪造——最终写入仍走 updateUserPassword 的完整审计链。
 */

export const PASSWORD_RESET_PENDING_TTL_SECONDS = 5 * 60

export interface PendingPasswordReset {
  umo: string
  userId: number
  password: string
  createdAt: number
}

export interface CreatedPendingPasswordReset {
  jti: string
  expiresInSeconds: number
}

const pending = new Map<string, PendingPasswordReset>()

function isExpired(entry: PendingPasswordReset, now: number, ttlSeconds: number): boolean {
  return now - entry.createdAt > ttlSeconds * 1000
}

/** 惰性清扫过期条目，避免 init 后未 confirm 的条目（含密码原文）长期驻留内存。 */
function sweepExpired(now: number, ttlSeconds: number): void {
  for (const [key, entry] of pending) {
    if (isExpired(entry, now, ttlSeconds)) pending.delete(key)
  }
}

export function createPendingPasswordReset(
  value: { umo: string; userId: number; password: string },
  options: { ttlSeconds?: number } = {}
): CreatedPendingPasswordReset {
  const ttl = options.ttlSeconds ?? PASSWORD_RESET_PENDING_TTL_SECONDS
  const now = getServerTimestamp()
  sweepExpired(now, ttl)
  const jti = randomBytes(24).toString('base64url')
  pending.set(jti, { ...value, createdAt: now })
  return {
    jti,
    expiresInSeconds: ttl
  }
}

export function consumePendingPasswordReset(
  jti: unknown,
  options: { ttlSeconds?: number } = {}
): PendingPasswordReset | null {
  if (typeof jti !== 'string' || !jti) return null
  const entry = pending.get(jti)
  if (!entry) return null
  pending.delete(jti)
  const ttl = options.ttlSeconds ?? PASSWORD_RESET_PENDING_TTL_SECONDS
  if (isExpired(entry, getServerTimestamp(), ttl)) return null
  return entry
}

/** 当前 pending 条目数（供测试观察惰性清扫行为）。 */
export function pendingPasswordResetCount(): number {
  return pending.size
}
