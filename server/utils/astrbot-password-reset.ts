import { randomBytes } from 'node:crypto'
import { seal, unseal } from './music-source-plugins/tickets'
import { getServerTimestamp } from './serverTime'

/**
 * 机器人重置密码的两步确认凭据（无状态密封令牌）。
 *
 * 第一步 `/广播 重置密码 <新密码>` 签发 pendingToken；第二步
 * `/广播 重置密码 确认 <新密码>` 原样回传令牌消费。令牌用 JWT_SECRET 密封并内嵌
 * 过期时间，可跨请求、跨实例、Serverless 验证，明文密码只在服务端内存短暂驻留。
 * 消费按 jti 记录为一次性，防「确认」步骤被重放；多副本部署下 TTL 内的重放至多
 * 再次写入同一新密码，无额外效果。最终写入仍走 updateUserPassword 的完整审计链。
 */

export const PASSWORD_RESET_PENDING_TTL_SECONDS = 5 * 60
const PASSWORD_RESET_TICKET_PURPOSE = 'astrbot-password-reset-v1'

export interface PendingPasswordReset {
  jti: string
  umo: string
  userId: number
  password: string
  createdAt: number
}

export interface CreatedPendingPasswordReset extends PendingPasswordReset {
  pendingToken: string
  expiresInSeconds: number
}

interface PendingPasswordResetOptions {
  ttlSeconds?: number
}

// 已消费 jti 集合：创建新令牌时惰性清扫过期项，避免长期运行无界增长
const consumedJtis = new Map<string, number>()

function sweepConsumed(now: number): void {
  for (const [jti, expiresAt] of consumedJtis) {
    if (expiresAt <= now) consumedJtis.delete(jti)
  }
}

export function createPendingPasswordReset(
  value: Omit<PendingPasswordReset, 'jti' | 'createdAt'>,
  options: PendingPasswordResetOptions = {}
): CreatedPendingPasswordReset {
  const ttl = options.ttlSeconds ?? PASSWORD_RESET_PENDING_TTL_SECONDS
  const now = getServerTimestamp()
  sweepConsumed(now)

  const jti = randomBytes(24).toString('base64url')
  const pendingToken = seal({ ...value, jti, createdAt: now }, PASSWORD_RESET_TICKET_PURPOSE, ttl * 1000)
  return { ...value, jti, createdAt: now, pendingToken, expiresInSeconds: ttl }
}

/**
 * 消费 pending 令牌：签名或过期校验失败、字段形状不符、或 jti 已被消费时返回 null。
 * 每次请求只消费一次；改密抛异常时该 jti 已被标记消费，攻击者无法重放，
 * 合法用户重试需重新走第一步。
 */
export function consumePendingPasswordReset(
  pendingToken: unknown,
  options: PendingPasswordResetOptions = {}
): PendingPasswordReset | null {
  if (typeof pendingToken !== 'string' || !pendingToken) return null

  let payload: PendingPasswordReset
  try {
    payload = unseal<PendingPasswordReset>(pendingToken, PASSWORD_RESET_TICKET_PURPOSE)
  } catch {
    // unseal 对伪造/篡改/过期令牌抛 pluginError，消费侧统一以 null 表达拒绝
    return null
  }

  if (
    typeof payload?.jti !== 'string' || !payload.jti ||
    typeof payload.umo !== 'string' || !payload.umo ||
    typeof payload.userId !== 'number' || !Number.isInteger(payload.userId) ||
    typeof payload.password !== 'string' || !payload.password ||
    typeof payload.createdAt !== 'number'
  ) return null

  const now = getServerTimestamp()
  sweepConsumed(now)
  if (consumedJtis.has(payload.jti)) return null
  const ttl = options.ttlSeconds ?? PASSWORD_RESET_PENDING_TTL_SECONDS
  consumedJtis.set(payload.jti, now + ttl * 1000)
  return payload
}

/** 当前已消费记录数（供测试观察惰性清扫行为）。 */
export function consumedPasswordResetCount(): number {
  return consumedJtis.size
}
