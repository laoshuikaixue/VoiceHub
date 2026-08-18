import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { decryptPaymentConfig } from '~~/server/utils/paymentCrypto'
import { createPaymentProvider } from '~~/server/services/paymentProviders'
import { fulfillPaymentOrder } from '~~/server/services/paymentService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async event => {
  const providerKey = getRouterParam(event, 'provider') || ''
  const query = Object.fromEntries(Object.entries(getQuery(event)).map(([key, value]) => [key, String(value ?? '')]))
  const requestBody = await readRawBody(event, 'utf8') || ''
  const rawBody = requestBody || new URLSearchParams(query).toString()
  const headers = Object.fromEntries(Object.entries(getHeaders(event)).map(([key, value]) => [key.toLowerCase(), String(value)]))
  const instances = await db.select().from(paymentProviderInstances).where(eq(paymentProviderInstances.providerKey, providerKey))
  for (const instance of instances) {
    try {
      const provider = createPaymentProvider(providerKey, { ...decryptPaymentConfig(instance.configEncrypted), paymentMode: instance.paymentMode })
      const notification = await provider.verify(rawBody, headers, query)
      if (!notification) {
        if (providerKey === 'wxpay') return { code: 'SUCCESS', message: '成功' }
        return { success: true }
      }
      const order = await fulfillPaymentOrder(notification, `webhook:${providerKey}`, instance.id)
      if (providerKey === 'easypay' || providerKey === 'alipay') {
        setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
        return 'success'
      }
      if (providerKey === 'wxpay') return { code: 'SUCCESS', message: '成功' }
      return { success: true, orderId: order.id }
    } catch (error) {
      console.error('[payment webhook] 处理服务商实例失败', {
        providerKey,
        instanceId: instance.id,
        error: error instanceof Error ? error.message : String(error)
      })
      continue
    }
  }
  throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_WEBHOOK_INVALID, '支付回调验签失败')
})
