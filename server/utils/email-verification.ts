import { randomInt, timingSafeEqual } from 'node:crypto'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { getRedisClient, buildRedisKey } from '~~/server/utils/redis'

// 注册邮箱验证码：5 分钟有效，60 秒重发冷却，同一邮箱每日最多 5 次；
// 优先存 Redis，Redis 不可用时回退进程内存。
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000
const EMAIL_CODE_MAX_ATTEMPTS = 5
const EMAIL_CODE_DAILY_LIMIT = 5
const EMAIL_CODE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

type EmailCodeEntry = {
  code: string
  expiresAt: number
  createdAt: number
  attempts: number
}

const emailCodes = new Map<string, EmailCodeEntry>()
const dailySendCounts = new Map<string, { count: number; dayKey: string }>()

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const getDayKey = () => {
  const now = new Date(getServerTimestamp())
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`
}

const codeRedisKey = (email: string) => buildRedisKey('email-code', 'code', normalizeEmail(email))
const attemptsRedisKey = (email: string) => buildRedisKey('email-code', 'attempts', normalizeEmail(email))
const cooldownRedisKey = (email: string) => buildRedisKey('email-code', 'cooldown', normalizeEmail(email))
const dailyRedisKey = (email: string) => buildRedisKey('email-code', 'daily', normalizeEmail(email), getDayKey())

// 校验并消费验证码（Redis Lua 原子：比较 + 失败计数 + 超限作废）
const VERIFY_EMAIL_CODE_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if not stored then
  return { 0, 0 }
end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  redis.call('EXPIRE', KEYS[2], 300)
end
if ARGV[1] == stored then
  redis.call('DEL', KEYS[1], KEYS[2])
  return { 1, attempts }
end
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1], KEYS[2])
  return { 2, attempts }
end
return { 0, attempts }
`

const safeCodeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function generateEmailCode(): string {
  // 密码学安全随机 6 位数字
  return String(randomInt(100000, 1000000))
}

// 发送成功后才落码；覆盖同邮箱旧码（重发即换新）；同时推进每日发送计数与重发冷却
export async function storeEmailCode(email: string, code: string): Promise<void> {
  const normalized = normalizeEmail(email)
  const now = getServerTimestamp()
  emailCodes.set(normalized, {
    code,
    expiresAt: now + EMAIL_CODE_TTL_MS,
    createdAt: now,
    attempts: 0
  })

  // 内存回退：以日键计数，跨天重置
  const dayKey = getDayKey()
  const record = dailySendCounts.get(normalized)
  if (!record || record.dayKey !== dayKey) {
    dailySendCounts.set(normalized, { count: 1, dayKey })
  } else {
    record.count++
  }

  let client: Awaited<ReturnType<typeof getRedisClient>> | null = null
  try {
    client = await getRedisClient()
    if (!client) return
    const ttlSeconds = Math.ceil(EMAIL_CODE_TTL_MS / 1000)
    await client.set(codeRedisKey(email), code, { EX: ttlSeconds })
    await client.set(cooldownRedisKey(email), '1', {
      EX: Math.ceil(EMAIL_CODE_COOLDOWN_MS / 1000)
    })
    const dailyKey = dailyRedisKey(email)
    const dailyCount = await client.incr(dailyKey)
    if (dailyCount === 1) {
      await client.expire(dailyKey, Math.ceil(EMAIL_CODE_DAILY_WINDOW_MS / 1000))
    }
  } catch (error) {
    console.error('[EmailCode] Redis 写入失败，已回退内存存储:', error)
  }
}

export async function isEmailCodeCooldownActive(email: string): Promise<boolean> {
  let client: Awaited<ReturnType<typeof getRedisClient>> | null = null
  try {
    client = await getRedisClient()
    if (client) {
      return Boolean(await client.exists(cooldownRedisKey(email)))
    }
  } catch (error) {
    console.error('[EmailCode] Redis 读取失败，已回退内存判断:', error)
  }
  const entry = emailCodes.get(normalizeEmail(email))
  return Boolean(entry && getServerTimestamp() - entry.createdAt < EMAIL_CODE_COOLDOWN_MS)
}

// 同一邮箱每日发送上限（发码前检查；计数在 storeEmailCode 成功时推进）
export async function isEmailCodeDailyLimitReached(email: string): Promise<boolean> {
  let client: Awaited<ReturnType<typeof getRedisClient>> | null = null
  try {
    client = await getRedisClient()
    if (client) {
      const count = await client.get(dailyRedisKey(email))
      return Number(count || 0) >= EMAIL_CODE_DAILY_LIMIT
    }
  } catch (error) {
    console.error('[EmailCode] Redis 读取失败，已回退内存判断:', error)
  }
  const normalized = normalizeEmail(email)
  const dayKey = getDayKey()
  const record = dailySendCounts.get(normalized)
  return Boolean(record && record.dayKey === dayKey && record.count >= EMAIL_CODE_DAILY_LIMIT)
}

// 校验并消费验证码（一次性；输错计数，超过上限作废防暴力枚举）
export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const trimmedCode = code.trim()
  let client
  try {
    client = await getRedisClient()
    if (client) {
      const result = await client.eval(VERIFY_EMAIL_CODE_SCRIPT, {
        keys: [codeRedisKey(email), attemptsRedisKey(email)],
        arguments: [trimmedCode, String(EMAIL_CODE_MAX_ATTEMPTS)]
      })
      if (Array.isArray(result)) {
        // 1=成功并已消费；2=失败次数超限已作废；0=验证码不存在或未匹配
        return Number(result[0]) === 1
      }
    }
  } catch (error) {
    console.error('[EmailCode] Redis 校验失败，已回退内存校验:', error)
  }

  const normalized = normalizeEmail(email)
  const entry = emailCodes.get(normalized)
  if (!entry) return false
  if (getServerTimestamp() > entry.expiresAt) {
    emailCodes.delete(normalized)
    return false
  }
  if (safeCodeEqual(entry.code, trimmedCode)) {
    emailCodes.delete(normalized)
    return true
  }
  entry.attempts++
  if (entry.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    emailCodes.delete(normalized)
  }
  return false
}

// 惰性清理过期条目（发码时顺带执行，防公开接口慢性增长；Redis 路径由 EXPIRE 自动清理）
export function cleanupExpiredEmailCodes(): void {
  const now = getServerTimestamp()
  for (const [email, entry] of emailCodes) {
    if (now > entry.expiresAt) emailCodes.delete(email)
  }
}
