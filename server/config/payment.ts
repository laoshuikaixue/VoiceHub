export const PAYMENT_PROVIDER_KEYS = ['easypay', 'alipay', 'wxpay', 'stripe', 'airwallex'] as const
export const PAYMENT_METHODS = ['alipay', 'wxpay', 'stripe', 'airwallex'] as const

export const PAYMENT_PROVIDER_METHODS: Record<string, string[]> = {
  easypay: ['alipay', 'wxpay'],
  alipay: ['alipay'],
  wxpay: ['wxpay'],
  stripe: ['stripe'],
  airwallex: ['airwallex']
}

export const PAYMENT_PROVIDER_CONFIG_FIELDS: Record<string, string[]> = {
  easypay: ['pid', 'pkey', 'apiBase'],
  alipay: ['appId', 'privateKey', 'publicKey'],
  wxpay: ['appId', 'mchId', 'privateKey', 'apiV3Key', 'publicKey', 'publicKeyId', 'serialNo'],
  stripe: ['secretKey', 'publishableKey', 'webhookSecret'],
  airwallex: ['clientId', 'apiKey', 'webhookSecret']
}

export const isPaymentProviderKey = (value: unknown): value is typeof PAYMENT_PROVIDER_KEYS[number] =>
  typeof value === 'string' && PAYMENT_PROVIDER_KEYS.includes(value as any)

export const isPaymentMethod = (value: unknown): value is typeof PAYMENT_METHODS[number] =>
  typeof value === 'string' && PAYMENT_METHODS.includes(value as any)

export const isPaymentMethodIdentifier = (value: unknown) =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{1,28}$/i.test(value)

export interface EasyPayCustomMethod {
  type: string
  label: string
  cid?: string
}

export const normalizeEasyPayCustomMethods = (value: unknown): EasyPayCustomMethod[] | null => {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 20) return null
  const seen = new Set<string>()
  const result: EasyPayCustomMethod[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const type = String((item as any).type || '').trim().toLowerCase()
    const label = String((item as any).label || '').trim()
    const cid = String((item as any).cid || '').trim()
    if (!/^[a-z][a-z0-9_-]{1,28}$/.test(type) || PAYMENT_METHODS.includes(type as any) || !label || label.length > 30 || cid.length > 64 || seen.has(type)) return null
    seen.add(type)
    result.push({ type, label, ...(cid ? { cid } : {}) })
  }
  return result
}

export const getPaymentProviderAllowedMethods = (providerKey: string, config: Record<string, unknown> = {}) => {
  const standardMethods = PAYMENT_PROVIDER_METHODS[providerKey] || []
  if (providerKey !== 'easypay') return standardMethods
  const customMethods = normalizeEasyPayCustomMethods(config.customMethods)
  return customMethods ? [...standardMethods, ...customMethods.map(item => item.type)] : standardMethods
}

export const getPaymentProviderConfigError = (providerKey: string, config: Record<string, unknown>) => {
  if (providerKey === 'easypay' && normalizeEasyPayCustomMethods(config.customMethods) === null) return '易支付自定义支付方式无效'
  if (providerKey === 'alipay' && config.gateway) {
    try {
      const gateway = new URL(String(config.gateway))
      if (gateway.protocol !== 'https:' || !['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'].includes(gateway.hostname) || gateway.pathname !== '/gateway.do') return '支付宝网关地址无效'
    } catch { return '支付宝网关地址无效' }
  }
  if (providerKey === 'wxpay') {
    if (Buffer.byteLength(String(config.apiV3Key || ''), 'utf8') !== 32) return '微信支付 API v3 密钥必须为 32 个字符'
    if (String(config.h5AppName || '').trim().length > 64) return '微信支付 H5 应用名称不能超过 64 个字符'
    if (config.h5AppUrl) {
      try {
        if (new URL(String(config.h5AppUrl)).protocol !== 'https:') return '微信支付 H5 网站地址必须使用 HTTPS'
      } catch { return '微信支付 H5 网站地址无效' }
    }
    if (config.refundNotifyUrl) {
      try {
        if (new URL(String(config.refundNotifyUrl)).protocol !== 'https:') return '微信支付退款通知地址必须使用 HTTPS'
      } catch { return '微信支付退款通知地址无效' }
    }
  }
  return null
}
