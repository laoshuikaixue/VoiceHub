import { queueWebUpdate } from '~~/server/utils/web-update'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async event => {
  const result = await queueWebUpdate(event)
  await recordAdminAudit(event, `system-update.${result.action}`, {
    targetType: 'system-update',
    targetId: result.version,
    summary: { requestId: result.requestId }
  })
  setResponseStatus(event, 202)
  return { requestId: result.requestId }
})
