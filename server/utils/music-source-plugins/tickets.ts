import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { getServerTimestamp } from '../serverTime.ts'
import { pluginError } from './errors.ts'

function key(purpose: string) {
  if (!process.env.JWT_SECRET) throw pluginError('PLUGIN_INVALID_CONFIG', 500)
  return Buffer.from(hkdfSync('sha256', process.env.JWT_SECRET, 'voicehub-plugin-v1', purpose, 32))
}

export function seal(value: unknown, purpose: string, ttl?: number): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(purpose), iv)
  const text = JSON.stringify({ value, expires: ttl ? getServerTimestamp() + ttl : null })
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
}

export function unseal<T = any>(token: string, purpose: string): T {
  try {
    if (typeof token !== 'string' || token.length > 200000) throw new Error('凭证长度无效')
    const bytes = Buffer.from(token, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(purpose), bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'))
    if (data.expires && data.expires <= getServerTimestamp()) throw new Error('凭证过期')
    return data.value
  } catch { throw pluginError('PLUGIN_INVALID_TICKET', 400) }
}
