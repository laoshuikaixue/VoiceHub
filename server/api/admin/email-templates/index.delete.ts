import { db } from '~/drizzle/db'
import { emailTemplates } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'DELETE') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, message: '未授权访问' })

  const query = getQuery(event)
  const key = (query.key || '').toString()
  if (!key) throw createError({ statusCode: 400, message: '缺少模板 key' })

  await db.delete(emailTemplates).where(eq(emailTemplates.key, key))

  await recordAdminAudit(event, 'email-template.delete', {
    targetType: 'email-template',
    targetId: key,
    summary: { key }
  })

  return { success: true }
})
