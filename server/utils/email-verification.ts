import { getServerTimestamp } from '~~/server/utils/serverTime'

// 注册邮箱验证码（内存存储，单实例；5 分钟有效，60 秒重发冷却）
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000

type EmailCodeEntry = { code: string; expiresAt: number; createdAt: number }

const emailCodes = new Map<string, EmailCodeEntry>()

export function generateEmailCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 发送成功后才落码；覆盖同邮箱旧码（重发即换新）
export function storeEmailCode(email: string, code: string): void {
  const normalized = email.trim().toLowerCase()
  const now = getServerTimestamp()
  emailCodes.set(normalized, { code, expiresAt: now + EMAIL_CODE_TTL_MS, createdAt: now })
}

export function isEmailCodeCooldownActive(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const entry = emailCodes.get(normalized)
  return Boolean(entry && getServerTimestamp() - entry.createdAt < EMAIL_CODE_COOLDOWN_MS)
}

// 校验并消费验证码（一次性；输错不销毁，防误输烧毁）
export function verifyEmailCode(email: string, code: string): boolean {
  const normalized = email.trim().toLowerCase()
  const entry = emailCodes.get(normalized)
  if (!entry) return false
  if (getServerTimestamp() > entry.expiresAt) {
    emailCodes.delete(normalized)
    return false
  }
  const ok = entry.code === code.trim()
  if (ok) emailCodes.delete(normalized)
  return ok
}

// 惰性清理过期条目（发码/校验时顺带执行，防公开接口慢性增长）
export function cleanupExpiredEmailCodes(): void {
  const now = getServerTimestamp()
  for (const [email, entry] of emailCodes) {
    if (now > entry.expiresAt) emailCodes.delete(email)
  }
}