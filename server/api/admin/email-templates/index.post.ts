import { db } from '~/drizzle/db'
import { emailTemplates } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { policies } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }
  const user = await policies.canManageEmailTemplates(event)

  const body = await readBody(event)
  const { key, name, subject, html } = body || {}
  if (!key || !name || !subject || !html) {
    throw createError({ statusCode: 400, message: '缺少必要字段：key/name/subject/html' })
  }

  // 根据 key 进行更新或插入
  const exist = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1)
  if (exist.length) {
    const res = await db
      .update(emailTemplates)
      .set({ name, subject, html, updatedAt: new Date(), updatedByUserId: user.id })
      .where(eq(emailTemplates.key, key))
      .returning()
    return { success: true, template: res[0] }
  } else {
    const res = await db
      .insert(emailTemplates)
      .values({ key, name, subject, html, updatedByUserId: user.id })
      .returning()
    return { success: true, template: res[0] }
  }
})
