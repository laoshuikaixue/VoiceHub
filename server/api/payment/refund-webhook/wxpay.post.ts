import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { decryptPaymentConfig } from '~~/server/utils/paymentCrypto'
import { createPaymentProvider } from '~~/server/services/paymentProviders'
import { fulfillPaymentRefund } from '~~/server/services/paymentService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async event => {
  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) throw createApiError(413, SERVER_ERROR_CODES.PAYMENT_WEBHOOK_INVALID, '退款回调请求体过大')
  const rawBody = await readRawBody(event, 'utf8') || ''
  if (!rawBody || rawBody.length > 1024 * 1024) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_WEBHOOK_INVALID, '退款回调数据无效')
  const headers = Object.fromEntries(Object.entries(getHeaders(event)).map(([key, value]) => [key.toLowerCase(), String(value)]))
  const instances = await db.select().from(paymentProviderInstances).where(eq(paymentProviderInstances.providerKey, 'wxpay'))
  for (const instance of instances) {
    try {
      const provider = createPaymentProvider('wxpay', { ...decryptPaymentConfig(instance.configEncrypted), paymentMode: instance.paymentMode })
      if (!('verifyRefund' in provider) || typeof provider.verifyRefund !== 'function') continue
      const notification = await provider.verifyRefund(rawBody, headers)
      if (!notification) return { code: 'SUCCESS', message: '成功' }
      await fulfillPaymentRefund(notification, instance.id)
      return { code: 'SUCCESS', message: '成功' }
    } catch (error) {
      console.error('[payment refund webhook] 处理服务商实例失败', { instanceId: instance.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_WEBHOOK_INVALID, '退款回调验签失败')
})
