import { SmtpService } from '~~/server/services/smtpService'

export default defineEventHandler(async (event) => {
  // 检查请求方法
  if (getMethod(event) !== 'POST') {
    throw createError({
      statusCode: 405,
      message: '方法不被允许'
    })
  }

  // 检查用户认证和权限
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
      message: '只有管理员才能测试SMTP连接'
    })
  }

  try {
    const body = await readBody(event)

    // 验证配置
    if (!body.smtpEnabled) {
      return {
        success: false,
        message: 'SMTP服务未启用'
      }
    }

    if (!body.smtpHost || !body.smtpUsername || !body.smtpPassword) {
      return {
        success: false,
        message: '请填写完整的SMTP配置信息'
      }
    }

    // 创建临时的SMTP服务实例进行测试
    const smtpService = SmtpService.getInstance()

    // 临时设置配置进行测试
    const originalConfig = smtpService.smtpConfig
    const originalTransporter = smtpService.transporter

    try {
      // 设置测试配置
      smtpService.smtpConfig = {
        host: body.smtpHost,
        port: body.smtpPort || 587,
        secure: body.smtpSecure || false,
        auth: {
          user: body.smtpUsername,
          pass: body.smtpPassword
        },
        fromEmail: body.smtpFromEmail || body.smtpUsername,
        fromName: body.smtpFromName || '校园广播站'
      }

      // 创建测试transporter
      const nodemailer = await import('nodemailer')
      smtpService.transporter = nodemailer.default.createTransport({
        host: smtpService.smtpConfig.host,
        port: smtpService.smtpConfig.port,
        secure: smtpService.smtpConfig.secure,
        auth: smtpService.smtpConfig.auth
      })

      // 测试连接
      const result = await smtpService.testConnection()

      return result
    } finally {
      // 恢复原始配置
      smtpService.smtpConfig = originalConfig
      smtpService.transporter = originalTransporter
    }
  } catch (error) {
    console.error('测试SMTP连接失败:', error)
    return {
      success: false,
      message: '测试连接失败',
      detail: error instanceof Error ? error.message : String(error)
    }
  }
})
