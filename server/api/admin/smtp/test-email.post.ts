import { SmtpService } from '~~/server/services/smtpService'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { hasAdminPermission } from '~/utils/admin-permissions'
import { resolveSmtpTestConfig } from '~~/server/utils/smtp-test-config'
import { getClientIP } from '~~/server/utils/ip-utils'
import { ADMIN_AUDIT_RESULT, recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  let smtpService: SmtpService | undefined
  try {
    const body = await readBody(event) || {}
    const stored = await getSystemSettingsCached() || {}
    const config = resolveSmtpTestConfig(body, stored, hasAdminPermission(event.context.user, 'smtp:write'))
    if (!config.smtpEnabled) return { success: false, message: 'SMTP服务未启用' }
    if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
      return { success: false, message: '请填写完整的SMTP配置信息' }
    }
    if (!body.testEmail) return { success: false, message: '请输入测试邮箱地址' }
    smtpService = SmtpService.createTestInstance(config)
    const result = await smtpService.sendTestEmail(body.testEmail, getClientIP(event))
    await recordAdminAudit(event, 'smtp.test', {
      targetType: 'smtp',
      summary: { testEmail: body.testEmail, detail: result.detail },
      result: result.success ? ADMIN_AUDIT_RESULT.SUCCESS : ADMIN_AUDIT_RESULT.FAILURE
    })
    return result
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('发送测试邮件失败:', error)
    return {
      success: false,
      message: '发送失败',
      detail: error instanceof Error ? error.message : String(error)
    }
  } finally {
    smtpService?.transporter?.close()
  }
})
