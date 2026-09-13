import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async () => {
  try {
    const settings = await db.select({ documents: systemSettings.legalConsentDocuments, updatedDate: systemSettings.legalConsentUpdatedDate }).from(systemSettings).limit(1)
    let documents = []
    try { const value = JSON.parse(settings[0]?.documents || '[]'); documents = Array.isArray(value) ? value : [] } catch {}
    return { updatedDate: settings[0]?.updatedDate || '', documents: documents.map(({ name, slug, content }) => ({ name, slug, content })) }
  } catch (error) {
    console.error('获取条款文档失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '获取条款文档失败')
  }
})
