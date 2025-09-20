import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { db } from '~/drizzle/db'
import { systemSettings, users, emailTemplates } from '~/drizzle/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { getSiteTitle } from '~/server/utils/cache-helpers'
import { formatIPForEmail } from '~/server/utils/ip-utils'

/**
 * 获取站点标题
 */
async function getSiteTitle(): Promise<string> {
  try {
    const settingsResult = await db.select().from(systemSettings).limit(1)
    const settings = settingsResult[0]
    return settings?.siteTitle || process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub'
  } catch (error) {
    console.error('获取站点标题失败:', error)
    return 'VoiceHub'
  }
}

/**
 * SMTP邮件服务
 */
export class SmtpService {
  private static instance: SmtpService
  public transporter: nodemailer.Transporter | null = null
  public smtpConfig: any = null
  private builtinTemplates: Record<string, { name: string; subject: string; html: string; exampleData?: Record<string, any> }> = {
    'verification.code': {
      name: '邮箱验证码',
      subject: '邮箱验证码 | {{siteTitle}}',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0;">{{fromName}}</h1>
              <p style="color: #666; margin: 5px 0 0 0;">邮箱验证</p>
            </div>
            
            <h2 style="color: #333; margin-bottom: 20px;">邮箱验证码</h2>
            
            <div style="color: #555; line-height: 1.6; margin-bottom: 30px;">
              <p>您好，{{name}}！</p>
              <p>您正在验证邮箱：<strong>{{email}}</strong></p>
              <p>请在{{expiresInMinutes}}分钟内输入以下验证码完成验证：</p>
              <div style="text-align: center; margin: 20px 0;">
                <h2 style="letter-spacing: 4px; color: #007bff; background: #f8f9fa; padding: 15px; border-radius: 4px; display: inline-block;">{{code}}</h2>
              </div>
              <p style="color:#888">若非本人操作，请忽略本邮件。</p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #666; font-size: 12px; text-align: center;">
                此邮件由系统自动发送，请勿回复。<br>
                如有疑问，请联系管理员。{{#if ipAddress}}<br><br>This email was requested from: <span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; color: #333; text-decoration: none; pointer-events: none;">{{ipAddress}}</span>{{/if}}
              </p>
          </div>
        </div>
      `,
      exampleData: { name: '张三', email: 'example@school.edu', code: '123456', expiresInMinutes: 5 }
    },
    'notification.generic': {
      name: '通用通知',
      subject: '{{title}} | {{siteTitle}}通知推送',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0;">{{fromName}}</h1>
              <p style="color: #666; margin: 5px 0 0 0;">通知推送</p>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">{{title}}</h2>
            <div style="color: #555; line-height: 1.6; margin-bottom: 30px; white-space: pre-wrap;">{{message}}</div>
            {{#if actionUrl}}
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{actionUrl}}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">查看详情</a>
            </div>
            {{/if}}
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px; text-align: center;">
              此邮件由系统自动发送，请勿回复。<br>
              如有疑问，请联系管理员。
            </p>
          </div>
        </div>
      `,
      exampleData: { title: '系统通知', message: '您的歌曲已被选中~', actionUrl: 'https://example.com' }
    }
    ,
    'notification.songSelected': {
      name: '歌曲被选中',
      subject: '歌曲被选中：{{songTitle}} | {{siteTitle}}通知推送',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0;">{{fromName}}</h1>
              <p style="color: #666; margin: 5px 0 0 0;">通知推送</p>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">歌曲被选中</h2>
            <div style="color: #555; line-height: 1.6; margin-bottom: 30px;">
              <p>您投稿的歌曲《{{songTitle}}》已被安排播放。</p>
              <p>播放日期：<strong>{{playDate}}</strong></p>
              {{#if playTimeName}}
              <p>播出时段：<strong>{{playTimeName}}</strong>{{#if playTimeRange}}（{{playTimeRange}}）{{/if}}</p>
              {{/if}}
              {{#if message}}
              <p style="color: #555; white-space: pre-wrap;">{{message}}</p>
              {{/if}}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px; text-align: center;">
              此邮件由系统自动发送，请勿回复。<br>
              如有疑问，请联系管理员。{{#if ipAddress}}<br><br>This email was requested from: <span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; color: #333; text-decoration: none; pointer-events: none;">{{ipAddress}}</span>{{/if}}
            </p>
          </div>
        </div>
      `,
      exampleData: { songTitle: '夜空中最亮的星', playDate: '2025-09-14', playTimeName: '午间时段', playTimeRange: '12:30-13:00' }
    },
    'notification.songPlayed': {
      name: '歌曲已播放',
      subject: '歌曲已播放：{{songTitle}} | {{siteTitle}}通知推送',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0;">{{fromName}}</h1>
              <p style="color: #666; margin: 5px 0 0 0;">通知推送</p>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">歌曲已播放</h2>
            <div style="color: #555; line-height: 1.6; margin-bottom: 30px;">
              <p>您投稿的歌曲《{{songTitle}}》已播放。</p>
              {{#if message}}
              <p style="color: #555; white-space: pre-wrap;">{{message}}</p>
              {{/if}}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px; text-align: center;">
              此邮件由系统自动发送，请勿回复。<br>
              如有疑问，请联系管理员。{{#if ipAddress}}<br><br>This email was requested from: <span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; color: #333; text-decoration: none; pointer-events: none;">{{ipAddress}}</span>{{/if}}
            </p>
          </div>
        </div>
      `,
      exampleData: { songTitle: '夜空中最亮的星' }
    },
    'notification.songVoted': {
      name: '收到新投票',
      subject: '收到新投票：{{songTitle}}（共{{votesCount}}票） | {{siteTitle}}通知推送',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0;">{{fromName}}</h1>
              <p style="color: #666; margin: 5px 0 0 0;">通知推送</p>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">收到新投票</h2>
            <div style="color: #555; line-height: 1.6; margin-bottom: 30px;">
              <p>您投稿的歌曲《{{songTitle}}》获得了新的投票。</p>
              <p>当前共有 <strong>{{votesCount}}</strong> 个投票。</p>
              {{#if message}}
              <p style="color: #555; white-space: pre-wrap;">{{message}}</p>
              {{/if}}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px; text-align: center;">
              此邮件由系统自动发送，请勿回复。<br>
              如有疑问，请联系管理员。{{#if ipAddress}}<br><br>This email was requested from: <span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; color: #333; text-decoration: none; pointer-events: none;">{{ipAddress}}</span>{{/if}}
            </p>
          </div>
        </div>
      `,
      exampleData: { songTitle: '夜空中最亮的星', votesCount: 5 }
    }
  }

  private constructor() {}

  static getInstance(): SmtpService {
    if (!SmtpService.instance) {
      SmtpService.instance = new SmtpService()
      // 首次创建实例时，尝试初始化SMTP配置（异步执行，不阻塞）
      SmtpService.instance.initializeSmtpConfig().catch(error => {
        console.log('SmtpService实例创建时初始化配置失败:', error.message)
      })
    }
    return SmtpService.instance
  }

  // 暴露内置模板（只读）
  getBuiltinTemplates(): Record<string, { name: string; subject: string; html: string; exampleData?: Record<string, any> }> {
    return this.builtinTemplates
  }

  /**
   * 初始化SMTP配置
   */
  async initializeSmtpConfig(): Promise<boolean> {
    try {
      const settingsResult = await db.select().from(systemSettings).limit(1)
      const settings = settingsResult[0]

      if (!settings) {
        return false
      }

      if (!settings.smtpEnabled) {
        return false
      }

      if (!settings.smtpHost) {
        return false
      }

      const port = settings.smtpPort || 587
      const secure = settings.smtpSecure || false
      
      this.smtpConfig = {
        host: settings.smtpHost,
        port: port,
        secure: secure,
        auth: settings.smtpUsername && settings.smtpPassword ? {
          user: settings.smtpUsername,
          pass: settings.smtpPassword
        } : undefined,
        fromEmail: settings.smtpFromEmail || settings.smtpUsername,
        fromName: settings.smtpFromName || '校园广播站'
      }

      // 创建transporter配置
      const transporterConfig: any = {
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: this.smtpConfig.auth
      }

      // 根据端口和安全设置调整配置
      if (port === 587 && !secure) {
        // STARTTLS - 端口587通常使用STARTTLS
        transporterConfig.requireTLS = true
        transporterConfig.tls = {
          // 不验证服务器证书（用于测试环境）
          rejectUnauthorized: false
        }
      } else if (port === 465) {
        // SSL/TLS - 端口465必须使用SSL
        transporterConfig.secure = true
      } else if (port === 25) {
        // 通常不加密
        transporterConfig.secure = false
        transporterConfig.tls = {
          rejectUnauthorized: false
        }
      }

      // 创建transporter
      this.transporter = nodemailer.createTransport(transporterConfig)

      // 验证SMTP连接
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('初始化SMTP配置失败:', error instanceof Error ? error.message : '未知错误')
      this.transporter = null
      return false
    }
  }

  /**
   * 确保SMTP配置已初始化
   */
  private async ensureInitialized(): Promise<boolean> {
    if (!this.transporter) {
      return await this.initializeSmtpConfig()
    }
    return true
  }

  /**
   * 发送邮件
   */
  async sendMail(to: string, subject: string, htmlContent: string, textContent?: string, ipAddress?: string): Promise<boolean> {
    // 确保配置已初始化
    if (!(await this.ensureInitialized())) {
      return false
    }

    try {
      // 如果提供了IP地址，在邮件内容中添加IP信息
      let finalHtml = htmlContent
      if (ipAddress) {
        const formattedIP = formatIPForEmail(ipAddress)
        // 在邮件末尾添加IP信息
        finalHtml = htmlContent.replace(
          /(<p[^>]*style="[^"]*text-align: center[^"]*"[^>]*>.*?此邮件由系统自动发送，请勿回复。.*?<\/p>)/s,
          `$1`.replace('此邮件由系统自动发送，请勿回复。', `此邮件由系统自动发送，请勿回复。<br><br>This email was requested from: ${formattedIP}`)
        )
      }

      const mailOptions = {
        from: {
          name: this.smtpConfig.fromName,
          address: this.smtpConfig.fromEmail
        },
        to,
        subject,
        html: finalHtml,
        text: textContent || finalHtml.replace(/<[^>]*>/g, '') // 简单的HTML转文本
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log(`邮件发送成功: ${result.messageId}`)
      return true
    } catch (error) {
      console.error('发送邮件失败:', error)
      return false
    }
  }

  /**
   * 基本占位符渲染：用 {{var}} 替换，支持 {{#if var}}...{{/if}} 简单条件
   */
  private renderString(tpl: string, data: Record<string, any>): string {
    // 处理 if 块
    tpl = tpl.replace(/\{\{#if\s+([a-zA-Z0-9_\.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
      const v = key.split('.').reduce((acc: any, k: string) => (acc ? acc[k] : undefined), data)
      return v ? inner : ''
    })
    // 处理变量
    tpl = tpl.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key) => {
      const v = key.split('.').reduce((acc: any, k: string) => (acc ? acc[k] : undefined), data)
      return v == null ? '' : String(v)
    })
    return tpl
  }

  /**
   * 渲染模板：优先使用自定义模板，否则回退到内置模板
   */
  async renderTemplate(key: string, data: Record<string, any>): Promise<{ subject: string; html: string }> {
    const builtin = this.builtinTemplates[key]
    let subject = builtin?.subject || ''
    let html = builtin?.html || ''

    try {
      const rows = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1)
      const custom = rows[0]
      if (custom) {
        subject = custom.subject
        html = custom.html
      }
    } catch (e) {
      // 忽略读取失败，走内置
    }

    const siteTitle = await getSiteTitle()
    const mergedData = { fromName: this.smtpConfig?.fromName || '校园广播站', siteTitle, ...data }
    return {
      subject: this.renderString(subject, mergedData),
      html: this.renderString(html, mergedData)
    }
  }

  /**
   * 渲染并发送模板
   */
  async renderAndSend(to: string, key: string, data: Record<string, any>, ipAddress?: string): Promise<boolean> {
    // 确保配置已初始化
    if (!(await this.ensureInitialized())) {
      return false
    }

    // 格式化IP地址用于模板渲染
    const formattedIP = ipAddress ? formatIPForEmail(ipAddress) : undefined
    const templateData = { ...data, ipAddress: formattedIP }

    const { subject, html } = await this.renderTemplate(key, templateData)
    if (!subject || !html) {
      // 若模板缺失，退回到简单包装
      const siteTitle = await getSiteTitle()
      const fallbackHtml = this.generateEmailTemplate(data.title || '通知', data.message || '', data.actionUrl, ipAddress)
      const fallbackSubject = `${data.title || '通知'} | ${siteTitle}通知推送`
      return this.sendMail(to, fallbackSubject, fallbackHtml, undefined, ipAddress)
    }
    return this.sendMail(to, subject, html, undefined, ipAddress)
  }

  /**
   * 测试SMTP连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      const initialized = await this.initializeSmtpConfig()
      if (!initialized) {
        return { success: false, message: 'SMTP配置无效或未启用' }
      }
    }

    try {
      await this.transporter!.verify()
      return { success: true, message: 'SMTP连接测试成功' }
    } catch (error) {
      return { success: false, message: `SMTP连接测试失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }
  }

  /**
   * 发送测试邮件
   */
  async sendTestEmail(to: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
    const siteTitle = await getSiteTitle()
    const subject = `测试邮件 | ${siteTitle}通知推送`
    const htmlContent = this.generateEmailTemplate(
      '测试邮件',
      '这是一封来自校园广播站系统的测试邮件。<br>如果您收到这封邮件，说明SMTP配置已经正确设置。',
      undefined,
      ipAddress
    )

    const success = await this.sendMail(to, subject, htmlContent, undefined, ipAddress)
    return {
      success,
      message: success ? '测试邮件发送成功' : '测试邮件发送失败'
    }
  }

  /**
   * 生成邮件HTML模板
   */
  generateEmailTemplate(title: string, content: string, actionUrl?: string, ipAddress?: string): string {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">${this.smtpConfig?.fromName || '校园广播站'}</h1>
            <p style="color: #666; margin: 5px 0 0 0;">通知推送</p>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">${title}</h2>
          
          <div style="color: #555; line-height: 1.6; margin-bottom: 30px;">
            ${content}
          </div>
          
          ${actionUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">查看详情</a>
            </div>
          ` : ''}
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            此邮件由系统自动发送，请勿回复。<br>
            如有疑问，请联系管理员。${ipAddress ? `<br><br>This email was requested from: <span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; color: #333; text-decoration: none; pointer-events: none;">${formatIPForEmail(ipAddress)}</span>` : ''}
          </p>
        </div>
      </div>
    `
  }
}

/**
 * 发送邮件通知给用户
 */
export async function sendEmailNotificationToUser(
  userId: number,
  notificationTitle: string,
  notificationMessage: string,
  url?: string,
  templateKey?: string,
  templateData?: Record<string, any>,
  ipAddress?: string
): Promise<boolean> {
  try {
    const smtpService = SmtpService.getInstance()
    
    // 获取用户信息
    const userResult = await db.select({
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified
    }).from(users).where(eq(users.id, userId)).limit(1)
    
    const user = userResult[0]
    
    // 仅检查用户是否有邮箱且已验证
    if (!user?.email || !user.emailVerified) {
      return false
    }
    
    // 使用指定模板，否则回退通用模板
    if (templateKey) {
      return await smtpService.renderAndSend(user.email, templateKey, templateData || {}, ipAddress)
    }
    return await smtpService.renderAndSend(user.email, 'notification.generic', {
      title: notificationTitle,
      message: notificationMessage,
      actionUrl: url
    }, ipAddress)
  } catch (error) {
    console.error('发送邮件通知失败:', error)
    return false
  }
}

/**
 * 批量发送邮件通知
 */
export async function sendBatchEmailNotifications(
  userIds: number[],
  notificationTitle: string,
  notificationMessage: string,
  url?: string,
  ipAddress?: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  
  const smtpService = SmtpService.getInstance()
  
  // 获取有邮箱且已验证的用户
  const usersWithEmail = await db.select({
    id: users.id,
    name: users.name,
    email: users.email
  }).from(users)
  .where(
    and(
      eq(users.emailVerified, true),
      isNotNull(users.email)
    )
  )
  
  // 并发发送邮件（限制并发数）
  const batchSize = 5
  const targetUsers = usersWithEmail.filter(user => userIds.includes(user.id))
  
  for (let i = 0; i < targetUsers.length; i += batchSize) {
    const batch = targetUsers.slice(i, i + batchSize)
    const promises = batch.map(async (user) => {
      // 确保 email 不为 null
      if (!user.email) {
        return false
      }
      const emailSuccess = await smtpService.renderAndSend(user.email, 'notification.generic', {
        title: notificationTitle,
        message: notificationMessage,
        actionUrl: url
      }, ipAddress)
      return emailSuccess
    })
    
    const results = await Promise.allSettled(promises)
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        success++
      } else {
        failed++
      }
    })
  }
  
  return { success, failed }
}
