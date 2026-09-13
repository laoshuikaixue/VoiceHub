import { SmtpService } from '~~/server/services/smtpService'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

export default defineEventHandler(async (event) => {
  const _user = await requirePermission(event, PERMISSIONS.SMTP_MANAGE)

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
