import crypto from 'crypto'
import { promisify } from 'util'

const API_KEY_PREFIX = 'vhub_'
const API_KEY_BYTES = 16
const HASH_SALT_BYTES = 16
const HASH_DERIVED_LENGTH = 64
const scryptAsync = promisify(crypto.scrypt)

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
