import { defineEventHandler } from 'h3'
import { getBackupHistory } from '~~/server/services/autoBackupService'

export default defineEventHandler(async () => {
  const history = await getBackupHistory()
  return { success: true, data: history }
})