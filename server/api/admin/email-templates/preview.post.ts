import { SmtpService } from '~~/server/services/smtpService'
import { canManageEmailTemplates } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }
  // 权限：email_templates.manage（ADMIN 及以上）；未登录 401 / 账号异常 403 / 缺权限 403
  await canManageEmailTemplates(event)

  const body = await readBody(event)
  const { key, data } = body || {}
  if (!key) throw createError({ statusCode: 400, message: '缺少模板 key' })

  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()
  const rendered = await smtp.renderTemplate(key, data || {})

  return { success: true, ...rendered }
})
