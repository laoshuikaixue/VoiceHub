import crypto from 'crypto'
import { promisify } from 'util'
import bcrypt from 'bcryptjs'

const API_KEY_PREFIX = 'vhub_'
const API_KEY_BYTES = 16
const HASH_SALT_BYTES = 16
const HASH_DERIVED_LENGTH = 64
const scryptAsync = promisify(crypto.scrypt)

const WEBHOOK_SECRET_BYTES = 32
const BCRYPT_COST = 10

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_BYTES).toString('hex')
  return API_KEY_PREFIX + randomBytes
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const salt = crypto.randomBytes(HASH_SALT_BYTES).toString('hex')
  const derivedKey = toHex(await scryptAsync(apiKey, salt, HASH_DERIVED_LENGTH))
  return `${salt}:${derivedKey}`
}

export async function verifyApiKey(apiKey: string, storedHash: string): Promise<boolean> {
  if (!apiKey || !storedHash) {
    return false
  }

  const parts = storedHash.split(':')
  if (parts.length !== 2) {
    return false
  }

  const [salt, expectedDerivedKey] = parts
  if (!salt || !expectedDerivedKey) {
    return false
  }

  const derivedKey = toHex(await scryptAsync(apiKey, salt, HASH_DERIVED_LENGTH))
  return safeEqualHex(derivedKey, expectedDerivedKey)
}

/**
 * 生成 webhook_secret 明文（用于 HMAC 签名）
 * 接收方需要保存明文以重算 HMAC
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(WEBHOOK_SECRET_BYTES).toString('hex')
}

/**
 * 哈希 webhook_secret 后落库
 * 创建响应一次性返回明文，接收方需自存
 */
export async function hashWebhookSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_COST)
}

function toHex(value: unknown): string {
  if (Buffer.isBuffer(value)) {
    return value.toString('hex')
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex')
  }

  return Buffer.from(String(value)).toString('hex')
}

function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
  } catch {
    return false
  }
}
