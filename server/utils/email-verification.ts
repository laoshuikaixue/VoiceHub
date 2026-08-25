// 注册邮箱验证码（内存存储，单实例；5 分钟有效，60 秒重发冷却）
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000

type EmailCodeEntry = { code: string; expiresAt: number; createdAt: number }

const emailCodes = new Map<string, EmailCodeEntry>()

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function issueEmailCode(email: string): string {
  const normalized = email.trim().toLowerCase()
  const code = generateCode()
  const now = Date.now()
  emailCodes.set(normalized, { code, expiresAt: now + EMAIL_CODE_TTL_MS, createdAt: now })
  return code
}

export function isEmailCodeCooldownActive(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const entry = emailCodes.get(normalized)
  return Boolean(entry && Date.now() - entry.createdAt < EMAIL_CODE_COOLDOWN_MS)
}

// 校验并消费验证码（一次性）
export function verifyEmailCode(email: string, code: string): boolean {
  const normalized = email.trim().toLowerCase()
  const entry = emailCodes.get(normalized)
  if (!entry) return false
  emailCodes.delete(normalized)
  if (Date.now() > entry.expiresAt) return false
  return entry.code === code.trim()
}
