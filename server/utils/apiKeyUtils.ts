import crypto from 'crypto'

const API_KEY_PREFIX = 'vhub_'
const API_KEY_BYTES = 16
const HASH_SALT_BYTES = 16
const HASH_DERIVED_LENGTH = 64

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_BYTES).toString('hex')
  return API_KEY_PREFIX + randomBytes
}

export function hashApiKey(apiKey: string): string {
  const salt = crypto.randomBytes(HASH_SALT_BYTES).toString('hex')
  const derivedKey = crypto.scryptSync(apiKey, salt, HASH_DERIVED_LENGTH).toString('hex')
  return `${salt}:${derivedKey}`
}

export function verifyApiKey(apiKey: string, storedHash: string): boolean {
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

  const derivedKey = crypto.scryptSync(apiKey, salt, HASH_DERIVED_LENGTH).toString('hex')
  return safeEqualHex(derivedKey, expectedDerivedKey)
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
