import { createHash } from 'node:crypto'

// 单个账号最多绑定的浏览器指纹数量，超出需先解绑
export const MAX_FINGERPRINT_BINDINGS = 10

// 客户端指纹格式：cyrb53 四轮拼接的 64 位十六进制字符串
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/

export function isValidFingerprint(value: unknown): value is string {
  return typeof value === 'string' && FINGERPRINT_PATTERN.test(value)
}

/**
 * 指纹加盐哈希：不明文存储客户端原始指纹，数据库泄漏也无法直接重放。
 * 优先使用专用 FINGERPRINT_PEPPER，未设置时复用 JWT_SECRET（登录已强制要求该变量）。
 */
function getFingerprintPepper(): string {
  const pepper = process.env.FINGERPRINT_PEPPER || process.env.JWT_SECRET
  if (!pepper) {
    throw new Error('FINGERPRINT_PEPPER / JWT_SECRET environment variable is not set')
  }
  return pepper
}

export function hashFingerprint(fingerprint: string): string {
  return createHash('sha256').update(`${fingerprint}:${getFingerprintPepper()}`).digest('hex')
}
