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
