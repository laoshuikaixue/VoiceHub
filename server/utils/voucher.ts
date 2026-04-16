import crypto from 'node:crypto'

function getSalt(envKey: 'VOUCHER_TOKEN_SALT' | 'VOUCHER_CODE_SALT') {
  const configured = process.env[envKey]
  if (configured && configured.trim().length > 0) {
    return configured.trim()
  }

  const jwtSecret = process.env.JWT_SECRET
  if (jwtSecret && jwtSecret.trim().length > 0) {
    return `${jwtSecret.trim()}:${envKey}`
  }

  throw new Error(`${envKey} is required (or JWT_SECRET must be configured as fallback)`)
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function buildVoucherRedeemToken(taskId: string) {
  const tokenSalt = getSalt('VOUCHER_TOKEN_SALT')
  const signature = sha256(`${taskId}:${tokenSalt}`).slice(0, 48)
  return `${taskId}.${signature}`
}

export function hashVoucherRedeemToken(token: string) {
  const tokenSalt = getSalt('VOUCHER_TOKEN_SALT')
  return sha256(`${token}:${tokenSalt}`)
}

export function normalizeVoucherCode(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase()
}

export function hashVoucherCode(rawCode: string) {
  const code = normalizeVoucherCode(rawCode)
  const codeSalt = getSalt('VOUCHER_CODE_SALT')
  return sha256(`${code}:${codeSalt}`)
}

export function getVoucherCodeTail(rawCode: string, tailLength = 6) {
  const code = normalizeVoucherCode(rawCode)
  return code.slice(-Math.max(4, Math.min(8, tailLength)))
}

export function buildVoucherRedeemPath(token: string) {
  return `/voucher/redeem?token=${encodeURIComponent(token)}`
}

function normalizeOrigin(origin: string) {
  const value = origin.trim().replace(/\/+$/, '')
  if (!value) {
    return ''
  }

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  return `https://${value}`
}

export function getPublicSiteOrigin() {
  const configuredOrigin =
    process.env.NUXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    process.env.NUXT_PUBLIC_HOST ||
    ''

  return configuredOrigin ? normalizeOrigin(configuredOrigin) : ''
}

export function buildVoucherRedeemUrl(token: string, requireAbsolute = false) {
  const path = buildVoucherRedeemPath(token)
  const origin = getPublicSiteOrigin()

  if (!origin && requireAbsolute) {
    throw new Error(
      'Public site origin is required for email links. Please configure NUXT_PUBLIC_SITE_URL/SITE_URL/APP_URL/NUXT_PUBLIC_HOST.'
    )
  }

  return origin ? `${origin}${path}` : path
}

export function formatShanghaiDateTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date)
}
