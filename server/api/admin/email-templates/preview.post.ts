import { SmtpService } from '~~/server/services/smtpService'

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
  const { key, data } = body || {}
  if (!key) throw createError({ statusCode: 400, message: '缺少模板 key' })

  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()
  const rendered = await smtp.renderTemplate(key, data || {})

  return { success: true, ...rendered }
})
