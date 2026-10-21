import { SmtpService } from '~~/server/services/smtpService'
import { canManageSmtp } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：smtp.manage（ADMIN 及以上）；未登录 401 / 账号异常 403 / 缺权限 403
  await canManageSmtp(event)

  try {
    const smtpService = SmtpService.getInstance()
    // 手动重载必须强制刷新，否则 transporter 已存在时直接早退
    const initialized = await smtpService.initializeSmtpConfig(true)

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
