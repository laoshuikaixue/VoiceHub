import { SmtpService } from '~~/server/services/smtpService'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { hasAdminPermission } from '~/utils/admin-permissions'
import { resolveSmtpTestConfig } from '~~/server/utils/smtp-test-config'

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
    smtpService = SmtpService.createTestInstance(config)
    return await smtpService.testConnection()
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('测试SMTP连接失败:', error)
    return {
      success: false,
      message: '测试连接失败',
      detail: error instanceof Error ? error.message : String(error)
    }
  } finally {
    smtpService?.transporter?.close()
  }
})
