import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const getKey = () => {
  const secret = process.env.PAYMENT_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) throw new Error('PAYMENT_ENCRYPTION_KEY 或 JWT_SECRET 未配置')
  return createHash('sha256').update(secret).digest()
}

export const encryptPaymentConfig = (config: Record<string, unknown>) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export const decryptPaymentConfig = (value: string): Record<string, any> => {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) throw new Error('支付配置密文格式无效')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ])
  return JSON.parse(plain.toString('utf8'))
}

const SECRET_KEY_PATTERN = /key|secret|private|password|token|pkey/i

export const maskPaymentConfig = (config: Record<string, unknown>) => Object.fromEntries(
  Object.entries(config).map(([key, value]) => [
    key,
    SECRET_KEY_PATTERN.test(key) && value ? '********' : value
  ])
)
