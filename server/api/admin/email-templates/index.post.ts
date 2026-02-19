import { db } from '~/drizzle/db'
import { emailTemplates } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, message: '未授权访问' })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '需要管理员权限' })
  }

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
