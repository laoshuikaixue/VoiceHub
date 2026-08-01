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
import { desc, eq, lt, sql } from 'drizzle-orm'

/** 外部服务调用超时（毫秒） */
const UPLOAD_TIMEOUT = 120_000

/** 并发互斥锁，防止同时触发多次备份 */
let backupRunning = false

/** 获取备份锁，若已在执行则抛出 409 */
export function acquireBackupLock(): void {
  if (backupRunning) {
    throw createApiError(409, SERVER_ERROR_CODES.BACKUP_FAILED, '备份任务正在执行中，请稍后再试')
  }
  backupRunning = true
}

/** 释放备份锁 */
export function releaseBackupLock(): void {
  backupRunning = false
}

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
    systemSettings: {
      query: async () => {
        const rows = await db.select().from(systemSettings)
        // 脱敏：移除敏感凭据字段，避免备份文件泄露密钥
        const SENSITIVE_FIELDS = [
          'smtpPassword', 'oauthStateSecret', 'githubClientSecret',
          'casdoorClientSecret', 'googleClientSecret', 'customOAuthClientSecret',
          'turnstileSecretKey', 'aggregateOAuthAppKey', 'autoBackupConfig'
        ]
        return rows.map(row => {
          const entries = Object.entries(row).filter(([k]) => !SENSITIVE_FIELDS.includes(k))
          return Object.fromEntries(entries)
        })
      },
      description: '系统设置（已脱敏）'
    }
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
  const prefix = (config.pathPrefix || '').replace(/\/+$/, '')
  const key = prefix ? `${prefix}/${filename}` : filename
  await uploadToS3(config.endpoint, config.bucket, config.region, config.accessKey, config.secretKey, key, data)
  console.log(`S3 上传完成: ${filename}`)
}

/** 规范化路径，去除首尾空格和多余斜杠 */
function normalizePath(p: string): string {
  return (p || '').trim().replace(/^\/+|\/+$/g, '')
}

/** 递归创建 WebDAV 目录 */
async function ensureWebDAVDir(baseUrl: string, auth: string, dirPath: string): Promise<void> {
  const normalized = normalizePath(dirPath)
  if (!normalized) return

  const segments = normalized.split('/')
  let currentPath = baseUrl.replace(/\/$/, '')

  for (const segment of segments) {
    currentPath += `/${segment}`
    const response = await fetch(currentPath, {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT)
    })
    // 201 Created = 成功，405 = 目录已存在
    if (response.status === 409) {
      throw new Error(`WebDAV 父目录不存在，无法创建: ${currentPath}`)
    }
    if (!response.ok && response.status !== 405) {
      throw new Error(`创建 WebDAV 目录失败: ${currentPath} (${response.status})`)
    }
  }
}

/** 上传到 WebDAV */
async function doWebDAVUpload(config: AutoBackupConfig['methods']['webdav'], data: string, filename: string): Promise<void> {
  const baseUrl = config.url.replace(/\/$/, '')
  const dirPath = normalizePath(config.path)
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  // 确保目录存在
  await ensureWebDAVDir(baseUrl, auth, dirPath)

  const filePath = dirPath ? `${baseUrl}/${dirPath}/${filename}` : `${baseUrl}/${filename}`
  const response = await fetch(filePath, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: data,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT)
  })

  if (!response.ok) {
    throw new Error(`WebDAV 上传失败: ${response.status} ${response.statusText}`)
  }

  console.log(`WebDAV 上传完成: ${filename}`)
}

/** 导出 ensureWebDAVDir 供测试端点使用 */
export { ensureWebDAVDir }

/** 通过 Telegram Bot 发送 */
async function doTelegramSend(config: AutoBackupConfig['methods']['telegram'], data: string, filename: string): Promise<void> {
  const formData = new FormData()
  const blob = new Blob([data], { type: 'application/json' })
  formData.append('chat_id', config.chatId)
  formData.append('document', blob, filename)
  formData.append('caption', `VoiceHub Auto Backup - ${new Date().toISOString()}`)

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT)
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

/** 准备备份：校验、导出数据、写入初始记录，返回上下文供后续上传使用 */
export async function prepareBackup(triggeredBy: string = 'api'): Promise<{
  historyId: number
  json: string
  filename: string
  metadata: { totalRecords: number }
  backupSize: number
  config: AutoBackupConfig
  enabledMethods: Array<{ key: string; name: string; fn: () => Promise<void> }>
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

  const methods = [
    { key: 's3' as const, name: 'S3', fn: () => doS3Upload(config.methods.s3, json, filename) },
    { key: 'webdav' as const, name: 'WebDAV', fn: () => doWebDAVUpload(config.methods.webdav, json, filename) },
    { key: 'telegram' as const, name: 'Telegram', fn: () => doTelegramSend(config.methods.telegram, json, filename) },
    { key: 'email' as const, name: 'Email', fn: () => doEmailSend(config.methods.email, json, filename) }
  ]

  const enabledMethods = methods.filter(({ key }) => config.methods[key].enabled)

  if (enabledMethods.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.NO_BACKUP_METHOD_ENABLED, '没有启用任何备份方式')
  }

  // 写入初始记录（error 为 null 表示未完成），确保超时中断也有历史
  const backupSize = Buffer.byteLength(json)
  const initialResults = enabledMethods.map(({ name }) => ({
    method: name,
    success: false,
    error: null
  }))
  const [inserted] = await db.insert(backupHistory).values({
    filename,
    totalRecords: metadata.totalRecords,
    backupSize,
    success: false,
    methods: JSON.stringify(initialResults),
    triggeredBy
  }).returning({ id: backupHistory.id })

  if (!inserted) {
    throw createApiError(500, SERVER_ERROR_CODES.BACKUP_FAILED, '写入备份记录失败')
  }

  console.log(`备份初始记录已写入: ${filename} (id=${inserted.id})`)

  return {
    historyId: inserted.id,
    json,
    filename,
    metadata,
    backupSize,
    config,
    enabledMethods
  }
}

/** 执行上传并更新历史记录 */
export async function executeUploads(prepared: {
  historyId: number
  json: string
  filename: string
  config: AutoBackupConfig
  enabledMethods: Array<{ key: string; name: string; fn: () => Promise<void> }>
}): Promise<{
  success: boolean
  results: Array<{ method: string; success: boolean; error?: string }>
}> {
  const { historyId, filename, enabledMethods } = prepared

  // 串行化 DB 更新，避免并行写入时的竞态条件
  let updateChain: Promise<void> = Promise.resolve()

  function updateMethodResult(index: number, result: { method: string; success: boolean; error?: string }) {
    const prev = updateChain
    updateChain = prev.then(async () => {
      const [record] = await db
        .select({ methods: backupHistory.methods })
        .from(backupHistory)
        .where(eq(backupHistory.id, historyId))
      if (!record) return
      const methods = JSON.parse(record.methods)
      methods[index] = result
      await db.update(backupHistory)
        .set({ methods: JSON.stringify(methods) })
        .where(eq(backupHistory.id, historyId))
    }).catch(err => {
      console.error(`更新备份方法结果失败 (index=${index}):`, err)
    })
    return updateChain
  }

  // 并行上传，每个完成后立即更新对应方法的结果
  const tasks = enabledMethods.map(async ({ name, fn }, index) => {
    try {
      await fn()
      await updateMethodResult(index, { method: name, success: true })
      return { method: name, success: true }
    } catch (error: any) {
      console.error(`${name} 备份失败:`, error)
      const errMsg = error.message || String(error) || 'Unknown error'
      await updateMethodResult(index, { method: name, success: false, error: errMsg })
      return { method: name, success: false, error: errMsg }
    }
  })

  const results: Array<{ method: string; success: boolean; error?: string }> = await Promise.all(tasks)

  const overallSuccess = results.some(r => r.success)

  // 更新整体成功状态
  await db.update(backupHistory)
    .set({ success: overallSuccess })
    .where(eq(backupHistory.id, historyId))

  // 自动清理 30 天前的历史记录
  cleanupOldHistory(30).catch(err => console.error('自动清理备份历史失败:', err))

  console.log(`备份历史已更新: ${filename}`)

  return {
    success: overallSuccess,
    results
  }
}

/** 执行一次完整的自动备份（prepareBackup + executeUploads） */
export async function executeAutoBackup(triggeredBy: string = 'api'): Promise<{
  success: boolean
  results: Array<{ method: string; success: boolean; error?: string }>
}> {
  acquireBackupLock()
  try {
    const prepared = await prepareBackup(triggeredBy)
    return await executeUploads(prepared)
  } finally {
    releaseBackupLock()
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

/** 清理备份历史记录 */
export async function cleanupOldHistory(retentionDays: number = 30): Promise<number> {
  if (retentionDays <= 0) {
    const result = await db.select({ cnt: sql<number>`count(*)::int` }).from(backupHistory)
    const count = result[0]?.cnt ?? 0
    if (count > 0) {
      await db.delete(backupHistory)
      console.log(`清理了全部 ${count} 条备份历史记录`)
    }
    return count
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(backupHistory)
    .where(lt(backupHistory.createdAt, cutoff))
  const count = result[0]?.cnt ?? 0
  if (count > 0) {
    await db.delete(backupHistory).where(lt(backupHistory.createdAt, cutoff))
    console.log(`清理了 ${count} 条过期备份历史记录`)
  }
  return count
}