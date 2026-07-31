import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以测试邮件发送')
  }

  const body = await readBody(event)
  const { recipient } = body

  if (!recipient) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少必要参数：recipient')
  }

  const settings = await getSystemSettingsCached()
  if (!settings?.smtpHost || !settings?.smtpUsername || !settings?.smtpPassword) {
    return { success: false, message: '邮件服务未配置，请先在站点配置中设置 SMTP' }
  }

  try {
    const nodemailer = await import('nodemailer').then((m) => m.default || m)

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword
      }
    })

    try {
      await transporter.sendMail({
        from: `"${settings.smtpFromName || 'VoiceHub'}" <${settings.smtpFromEmail || settings.smtpUsername}>`,
        to: recipient,
        subject: 'VoiceHub 邮件发送测试',
        text: '如果您收到此邮件，说明 VoiceHub 的邮件服务配置正确。'
      })

      return { success: true, message: '测试邮件发送成功' }
    } finally {
      transporter.close()
    }
  } catch (err: any) {
    return { success: false, message: err.message || '邮件发送失败' }
  }
})