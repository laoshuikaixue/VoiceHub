import { db } from '~/drizzle/db'
import { emailTemplates } from '~/drizzle/schema'
import { SmtpService } from '~~/server/services/smtpService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, message: '未授权访问' })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '需要管理员权限' })
  }

  // 自定义模板
  const custom = await db.select().from(emailTemplates)

  // 内置模板来自 smtpService
  const smtp = SmtpService.getInstance()
  const builtin = Object.entries(smtp.getBuiltinTemplates()).map(([key, t]: any) => ({
    key,
    name: t.name,
    subject: t.subject,
    html: t.html,
    isBuiltin: true
  }))

  // 自定义模板覆盖标记
  const merged = builtin.map((b) => {
    const override = custom.find((c) => c.key === b.key)
    return {
      ...b,
      isOverridden: !!override,
      overriddenAt: override?.updatedAt,
      overriddenByUserId: override?.updatedByUserId
    }
  })

  // 也返回额外的自定义模板（非内置键）
  const extra = custom
    .filter((c) => !builtin.find((b) => b.key === c.key))
    .map((c) => ({
      key: c.key,
      name: c.name,
      subject: c.subject,
      html: c.html,
      isBuiltin: false,
      isOverridden: true,
      overriddenAt: c.updatedAt,
      overriddenByUserId: c.updatedByUserId
    }))

  return { templates: [...merged, ...extra] }
})
