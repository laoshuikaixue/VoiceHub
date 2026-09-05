import { defineEventHandler } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getBackupHistory } from '~~/server/services/autoBackupService'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const history = await getBackupHistory()
  return { success: true, data: history }
})