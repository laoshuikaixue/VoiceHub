import { randomBytes } from 'node:crypto'

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

export function createPendingPasswordReset(
  value: { umo: string; userId: number; password: string },
  options: { ttlSeconds?: number } = {}
): CreatedPendingPasswordReset {
  const jti = randomBytes(24).toString('base64url')
  pending.set(jti, { ...value, createdAt: Date.now() })
  return {
    jti,
    expiresInSeconds: options.ttlSeconds ?? PASSWORD_RESET_PENDING_TTL_SECONDS
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
  if (isExpired(entry, Date.now(), ttl)) return null
  return entry
}
