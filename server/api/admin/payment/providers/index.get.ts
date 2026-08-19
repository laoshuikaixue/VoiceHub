import { asc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { decryptPaymentConfig, maskPaymentConfig } from '~~/server/utils/paymentCrypto'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event)
  const rows = await db.select().from(paymentProviderInstances).orderBy(asc(paymentProviderInstances.sortOrder))
  return rows.map(({ configEncrypted, ...row }) => {
    try {
      return { ...row, config: maskPaymentConfig(decryptPaymentConfig(configEncrypted)) }
    } catch (error) {
      console.error('[payment provider] 解密服务商配置失败', { providerKey: row.providerKey, instanceId: row.id, error: String(error) })
      return { ...row, config: {}, configError: true }
    }
  })
})
