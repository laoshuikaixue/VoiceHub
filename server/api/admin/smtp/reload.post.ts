import { SmtpService } from '~~/server/services/smtpService'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能重载SMTP配置'
    })
  }

  try {
    const smtpService = SmtpService.getInstance()
    const initialized = await smtpService.initializeSmtpConfig()

    return {
      success: true,
      initialized,
      message: initialized ? 'SMTP配置已重载' : 'SMTP未启用或配置不完整，已清空当前SMTP实例'
    }
  } catch (error) {
    return {
      success: false,
      message: 'SMTP配置重载失败',
      detail: error instanceof Error ? error.message : String(error)
    }
  }
})
