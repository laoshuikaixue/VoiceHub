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

export const getPaymentProviderConfigError = (providerKey: string, config: Record<string, unknown>) => {
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
