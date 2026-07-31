import { db } from '~/drizzle/db'
import {
  backupHistory,
  systemSettings,
  apiKeys,
  apiKeyPermissions,
  apiLogs,
  cardCodeRedeemLogs,
  cardCodes,
  collaborationLogs,
  emailTemplates,
  notifications,
  notificationSettings,
  playTimes,
  requestTimes,
  schedules,
  semesters,
  songBlacklists,
  songCollaborators,
  songReplayRequests,
  songs,
  users,
  userIdentities,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { uploadToS3 } from '~~/server/utils/s3Client'
import { desc, lt } from 'drizzle-orm'

/** 自动备份配置结构 */
export interface AutoBackupConfig {
  methods: {
    s3: {
      enabled: boolean
      endpoint: string
      bucket: string
      region: string
      pathPrefix: string
      accessKey: string
      secretKey: string
    }
    webdav: {
      enabled: boolean
      url: string
      username: string
      password: string
      path: string
    }
    telegram: {
      enabled: boolean
      botToken: string
      chatId: string
    }
    email: {
      enabled: boolean
      recipient: string
    }
  }
}

/** 获取自动备份配置 */
export async function getAutoBackupConfig(): Promise<AutoBackupConfig | null> {
  const [row] = await db
    .select({ autoBackupConfig: systemSettings.autoBackupConfig })
    .from(systemSettings)
    .limit(1)

  if (!row?.autoBackupConfig) return null

  try {
    return JSON.parse(row.autoBackupConfig)
  } catch {
    return null
  }
}

/** 检查自动备份是否启用 */
export async function isAutoBackupEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ autoBackupEnabled: systemSettings.autoBackupEnabled })
    .from(systemSettings)
    .limit(1)

  return row?.autoBackupEnabled === true
}

/** 导出数据库备份数据 */
export async function exportBackupData(): Promise<{ json: string; filename: string; metadata: { totalRecords: number } }> {
  const backupData = {
    metadata: {
      version: '1.0',
      timestamp: new Date().toISOString(),
      backupType: 'auto',
      description: `自动备份 - ${new Date().toISOString()}`,
      tables: [] as Array<{ name: string; description: string; recordCount: number }>,
      totalRecords: 0
    },
    data: {} as Record<string, any>
  }

  const tablesToBackup: Record<string, { query: () => Promise<any[]>; description: string }> = {
    users: { query: () => db.select().from(users), description: '用户数据' },
    songs: { query: () => db.select().from(songs), description: '歌曲数据' },
    schedules: { query: () => db.select().from(schedules), description: '排期数据' },
    playTimes: { query: () => db.select().from(playTimes), description: '播出时段' },
    requestTimes: { query: () => db.select().from(requestTimes), description: '请求时段' },
    semesters: { query: () => db.select().from(semesters), description: '学期数据' },
    notifications: { query: () => db.select().from(notifications), description: '通知数据' },
    notificationSettings: { query: () => db.select().from(notificationSettings), description: '通知设置' },
    songBlacklists: { query: () => db.select().from(songBlacklists), description: '歌曲黑名单' },
    votes: { query: () => db.select().from(votes), description: '投票数据' },
    cardCodes: { query: () => db.select().from(cardCodes), description: '点歌券数据' },
    cardCodeRedeemLogs: { query: () => db.select().from(cardCodeRedeemLogs), description: '点歌券日志' },
    songCollaborators: { query: () => db.select().from(songCollaborators), description: '联合投稿人' },
    collaborationLogs: { query: () => db.select().from(collaborationLogs), description: '联合投稿审计日志' },
    songReplayRequests: { query: () => db.select().from(songReplayRequests), description: '歌曲重播申请' },
    userStatusLogs: { query: () => db.select().from(userStatusLogs), description: '用户状态变更日志' },
    userIdentities: { query: () => db.select().from(userIdentities), description: '第三方身份关联' },
    apiKeys: { query: () => db.select().from(apiKeys), description: 'API密钥' },
    apiKeyPermissions: { query: () => db.select().from(apiKeyPermissions), description: 'API密钥权限' },
    apiLogs: { query: () => db.select().from(apiLogs), description: 'API访问日志' },
    emailTemplates: { query: () => db.select().from(emailTemplates), description: '邮件模板' },
    systemSettings: { query: () => db.select().from(systemSettings), description: '系统设置' }
  }

  let totalRecords = 0

  for (const [tableName, { query, description }] of Object.entries(tablesToBackup)) {
    try {
      const data = await query()
      backupData.data[tableName] = data
      backupData.metadata.tables.push({ name: tableName, description, recordCount: data.length })
      totalRecords += data.length
    } catch (error) {
      console.warn(`备份表 ${tableName} 失败，已跳过:`, error)
      backupData.metadata.tables.push({ name: tableName, description: `${description} (跳过)`, recordCount: 0 })
    }
  }

  backupData.metadata.totalRecords = totalRecords

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `auto-backup-${timestamp}.json`

  return { json: JSON.stringify(backupData, null, 2), filename, metadata: backupData.metadata }
}

/** 上传到 S3 */
async function doS3Upload(config: AutoBackupConfig['methods']['s3'], data: string, filename: string): Promise<void> {
  const key = `${config.pathPrefix.replace(/\/$/, '')}/${filename}`
  await uploadToS3(config.endpoint, config.bucket, config.region, config.accessKey, config.secretKey, key, data)
  console.log(`S3 上传完成: ${filename}`)
}

/** 上传到 WebDAV */
async function doWebDAVUpload(config: AutoBackupConfig['methods']['webdav'], data: string, filename: string): Promise<void> {
  const fullPath = `${config.url.replace(/\/$/, '')}/${config.path.replace(/\/$/, '')}/${filename}`
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  const response = await fetch(fullPath, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: data
  })

  if (!response.ok) {
    throw new Error(`WebDAV 上传失败: ${response.status} ${response.statusText}`)
  }

  console.log(`WebDAV 上传完成: ${filename}`)
}

/** 通过 Telegram Bot 发送 */
async function doTelegramSend(config: AutoBackupConfig['methods']['telegram'], data: string, filename: string): Promise<void> {
  const formData = new FormData()
  const blob = new Blob([data], { type: 'application/json' })
  formData.append('chat_id', config.chatId)
  formData.append('document', blob, filename)
  formData.append('caption', `VoiceHub Auto Backup - ${new Date().toISOString()}`)

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
    method: 'POST',
    body: formData
  })

  const result = await response.json() as any
  if (!result.ok) {
    throw new Error(`Telegram 发送失败: ${result.description}`)
  }

  console.log(`Telegram 发送完成: ${filename}`)
}

/** 通过邮件发送 */
async function doEmailSend(config: AutoBackupConfig['methods']['email'], data: string, filename: string): Promise<void> {
  const { getSystemSettingsCached } = await import('~~/server/utils/system-settings-helper')
  const settings = await getSystemSettingsCached()
  const nodemailer = await import('nodemailer').then(m => m.default || m)

  if (!settings || !settings.smtpHost || !settings.smtpUsername || !settings.smtpPassword) {
    throw createApiError(500, SERVER_ERROR_CODES.SMTP_NOT_CONFIGURED, '邮件服务未配置，无法发送邮件备份')
  }

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
      to: config.recipient,
      subject: `VoiceHub 自动备份 - ${new Date().toISOString()}`,
      text: '数据库自动备份文件见附件。',
      attachments: [{
        filename,
        content: data,
        contentType: 'application/json'
      }]
    })

    console.log(`邮件发送完成: ${filename} -> ${config.recipient}`)
  } finally {
    transporter.close()
  }
}

/** 执行一次完整的自动备份 */
export async function executeAutoBackup(triggeredBy: string = 'api'): Promise<{
  success: boolean
  results: Array<{ method: string; success: boolean; error?: string }>
}> {
  const enabled = await isAutoBackupEnabled()
  if (!enabled) {
    throw createApiError(400, SERVER_ERROR_CODES.BACKUP_DISABLED, '自动备份未启用')
  }

  const config = await getAutoBackupConfig()
  if (!config) {
    throw createApiError(400, SERVER_ERROR_CODES.BACKUP_NOT_CONFIGURED, '自动备份未配置')
  }

  const { json, filename, metadata } = await exportBackupData()
  const results: Array<{ method: string; success: boolean; error?: string }> = []

  const methods = [
    { key: 's3' as const, name: 'S3', fn: () => doS3Upload(config.methods.s3, json, filename) },
    { key: 'webdav' as const, name: 'WebDAV', fn: () => doWebDAVUpload(config.methods.webdav, json, filename) },
    { key: 'telegram' as const, name: 'Telegram', fn: () => doTelegramSend(config.methods.telegram, json, filename) },
    { key: 'email' as const, name: 'Email', fn: () => doEmailSend(config.methods.email, json, filename) }
  ]

  for (const { key, name, fn } of methods) {
    if (!config.methods[key].enabled) continue

    try {
      await fn()
      results.push({ method: name, success: true })
    } catch (error: any) {
      console.error(`${name} 备份失败:`, error)
      results.push({ method: name, success: false, error: error.message })
    }
  }

  if (results.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.NO_BACKUP_METHOD_ENABLED, '没有启用任何备份方式')
  }

  const overallSuccess = results.some(r => r.success)

  // 记录备份历史
  await recordBackupHistory({
    filename,
    totalRecords: metadata.totalRecords,
    backupSize: Buffer.byteLength(json),
    success: overallSuccess,
    methods: results,
    triggeredBy
  })

  return {
    success: overallSuccess,
    results
  }
}

/** 记录备份历史 */
async function recordBackupHistory(record: {
  filename: string
  totalRecords: number
  backupSize: number
  success: boolean
  methods: Array<{ method: string; success: boolean; error?: string }>
  triggeredBy: string
}): Promise<void> {
  try {
    await db.insert(backupHistory).values({
      filename: record.filename,
      totalRecords: record.totalRecords,
      backupSize: record.backupSize,
      success: record.success,
      methods: JSON.stringify(record.methods),
      triggeredBy: record.triggeredBy
    })
    console.log(`备份历史已记录: ${record.filename}`)
  } catch (error) {
    console.error('记录备份历史失败:', error)
  }
}

/** 获取备份历史列表 */
export async function getBackupHistory(limit: number = 50): Promise<Array<{
  id: number
  createdAt: Date
  filename: string
  totalRecords: number
  backupSize: number
  methods: Array<{ method: string; success: boolean; error?: string }>
  success: boolean
  triggeredBy: string | null
}>> {
  const rows = await db
    .select()
    .from(backupHistory)
    .orderBy(desc(backupHistory.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    ...row,
    methods: JSON.parse(row.methods)
  }))
}

/** 清理 30 天前的备份历史记录 */
export async function cleanupOldHistory(retentionDays: number = 30): Promise<number> {
  if (retentionDays <= 0) {
    const result = await db.delete(backupHistory)
    const count = result.rowCount ?? 0
    if (count > 0) console.log(`清理了全部 ${count} 条备份历史记录`)
    return count
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await db.delete(backupHistory).where(lt(backupHistory.createdAt, cutoff))
  if (result.rowCount && result.rowCount > 0) {
    console.log(`清理了 ${result.rowCount} 条过期备份历史记录`)
  }
  return result.rowCount ?? 0
}