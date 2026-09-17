import { db } from '~/drizzle/db'
import { emailTemplates } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { policies } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'DELETE') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }
  await policies.canManageEmailTemplates(event)

  const query = getQuery(event)
  const key = (query.key || '').toString()
  if (!key) throw createError({ statusCode: 400, message: '缺少模板 key' })

  await db.delete(emailTemplates).where(eq(emailTemplates.key, key))
  return { success: true }
})
