import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '~/drizzle/db'
import {
  backupHistory,
  backupSchedules
} from '~/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import { getS3UploadService } from './s3UploadService'
import { getWebDAVUploadService } from './webdavUploadService'

export interface BackupResult {
  success: boolean
  filename?: string
  fileSize?: number
  checksum?: string
  localPath?: string
  errorMessage?: string
  scheduleId?: number
}

export interface CleanupResult {
  deletedCount: number
  deletedFiles: string[]
  errors: string[]
}

/**
 * 备份服务
 * 负责创建数据库备份、管理备份历史、执行保留策略
 */
export class BackupService {
  private backupDir: string

  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups')
  }

  /**
   * 初始化备份目录
   */
  async initBackupDir(): Promise<void> {
    try {
      await fs.access(this.backupDir)
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true })
    }
  }

  /**
   * 创建数据库备份
   */
  async createBackup(
    options: {
      scheduleId?: number
      includeSongs?: boolean
      includeUsers?: boolean
      includeSystemData?: boolean
    } = {}
  ): Promise<BackupResult> {
    const { scheduleId, includeSongs = true, includeUsers = true, includeSystemData = true } = options

    let fileSize = 0
    let checksum = ''

    try {
      await this.initBackupDir()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      let backupType: string
      if (includeSongs && includeUsers && includeSystemData) {
        backupType = 'full'
      } else if (includeSongs && !includeUsers && !includeSystemData) {
        backupType = 'songs'
      } else if (!includeSongs && includeUsers && !includeSystemData) {
        backupType = 'users'
      } else if (!includeSongs && !includeUsers && includeSystemData) {
        backupType = 'config'
      } else {
        const parts: string[] = []
        if (includeSongs) parts.push('songs')
        if (includeUsers) parts.push('users')
        if (includeSystemData) parts.push('config')
        backupType = parts.join('+')
      }
      const filename = `backup-${backupType}-${timestamp}.json`
      const filepath = path.join(this.backupDir, filename)

      const metadata = this.getBackupMetadata({ includeSongs, includeUsers, includeSystemData })
      const dataStream = this.gatherBackupData({ includeSongs, includeUsers, includeSystemData })

      await this.writeJsonStream(filepath, metadata.metadata, dataStream)

      const fileSizeCalc = await fs.stat(filepath)
      fileSize = fileSizeCalc.size
      checksum = await this.calculateChecksum(filepath)

      let historyId: number | undefined
      await db.insert(backupHistory).values({
        scheduleId: scheduleId || null,
        filename,
        fileSize,
        status: 'success',
        checksum,
        localPath: filepath,
        includeSongs,
        includeUsers,
        includeSystemData,
        executedAt: new Date()
      }).returning({ id: backupHistory.id }).then(([result]) => {
        historyId = result?.id
      })

      console.log(`[BackupService] Backup created: ${filename} (${fileSize} bytes)`)

      if (scheduleId) {
        await this.applyRetentionPolicy(scheduleId)
      }

      return {
        success: true,
        filename,
        fileSize,
        checksum,
        localPath: filepath,
        scheduleId
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[BackupService] Backup failed:`, error)

      await db.insert(backupHistory).values({
        scheduleId: scheduleId || null,
        filename: '',
        status: 'failed',
        errorMessage,
        executedAt: new Date()
      }).catch((err) => {
        console.error('[BackupService] Failed to record backup history:', err)
      })

      return {
        success: false,
        errorMessage,
        scheduleId
      }
    }
  }

  /**
   * 计算文件 SHA256 校验和
   */
  private async calculateChecksum(filepath: string): Promise<string> {
    const content = await fs.readFile(filepath, 'utf8')
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * 流式写入 JSON 数据到文件
   */
  private async writeJsonStream(
    filepath: string,
    metadata: Record<string, unknown>,
    dataStream: AsyncGenerator<{ tableName: string; data: unknown[] }>
  ): Promise<void> {
    const writeStream = createWriteStream(filepath, { encoding: 'utf8' })

    const header = JSON.stringify({ metadata }) + '\n'
    writeStream.write(header)

    for await (const chunk of dataStream) {
      const line = JSON.stringify({ [chunk.tableName]: chunk.data }) + '\n'
      writeStream.write(line)
    }

    writeStream.end()
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })
  }

  /**
   * 收集备份数据（生成器模式，分批次返回数据以减少内存占用）
   */
  private async *gatherBackupData(options: { includeSongs: boolean; includeUsers: boolean; includeSystemData: boolean }): AsyncGenerator<{ tableName: string; data: unknown[] }> {
    const { includeSongs, includeUsers, includeSystemData } = options
    const {
      apiKeys,
      apiKeyPermissions,
      apiLogs,
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
      systemSettings,
      users,
      userIdentities,
      userStatusLogs,
      votes
    } = await import('~/drizzle/schema')

    if (includeUsers) {
      const usersData = await db.select().from(users)
      const settingsData = await db.select().from(notificationSettings)

      const processedUsers = usersData.map((user) => ({
        ...user,
        notificationSettings: settingsData.filter((setting) => setting.userId === user.id)
      }))

      yield { tableName: 'users', data: processedUsers }
    }

    if (includeSongs) {
      const songsData = await db.select().from(songs)
      const votesData = await db.select().from(votes)
      const schedulesData = await db.select().from(schedules)
      const playTimesData = await db.select().from(playTimes)
      const semestersData = await db.select().from(semesters)
      const notificationsData = await db.select().from(notifications)
      const songBlacklistsData = await db.select().from(songBlacklists)
      const songCollaboratorsData = await db.select().from(songCollaborators)
      const collaborationLogsData = await db.select().from(collaborationLogs)
      const songReplayRequestsData = await db.select().from(songReplayRequests)
      const userIdentitiesData = await db.select().from(userIdentities)
      const userStatusLogsData = await db.select().from(userStatusLogs)
      const requestTimesData = await db.select().from(requestTimes)

      const processedSongs = songsData.map((song) => ({
        ...song,
        votes: votesData.filter((vote) => vote.songId === song.id),
        schedules: schedulesData.filter((schedule) => schedule.songId === song.id),
        collaborators: songCollaboratorsData.filter((collab) => collab.songId === song.id),
        replayRequests: songReplayRequestsData.filter((req) => req.songId === song.id)
      }))

      yield { tableName: 'songs', data: processedSongs }
      yield { tableName: 'playTimes', data: playTimesData }
      yield { tableName: 'schedules', data: schedulesData }
      yield { tableName: 'semesters', data: semestersData }
      yield { tableName: 'notifications', data: notificationsData }
      yield { tableName: 'songBlacklists', data: songBlacklistsData }
      yield { tableName: 'userIdentities', data: userIdentitiesData }
      yield { tableName: 'userStatusLogs', data: userStatusLogsData }
      yield { tableName: 'requestTimes', data: requestTimesData }
      yield { tableName: 'songCollaborators', data: songCollaboratorsData }
      yield { tableName: 'collaborationLogs', data: collaborationLogsData }
      yield { tableName: 'songReplayRequests', data: songReplayRequestsData }
    }

    if (includeSystemData) {
      const systemSettingsData = await db.select().from(systemSettings)
      const emailTemplatesData = await db.select().from(emailTemplates)

      yield { tableName: 'systemSettings', data: systemSettingsData }
      yield { tableName: 'emailTemplates', data: emailTemplatesData }
    }

    if (includeSongs) {
      const apiKeysData = await db.select().from(apiKeys)
      const apiKeyPermissionsData = await db.select().from(apiKeyPermissions)
      const apiLogsData = await db.select().from(apiLogs)

      yield { tableName: 'apiKeys', data: apiKeysData }
      yield { tableName: 'apiKeyPermissions', data: apiKeyPermissionsData }
      yield { tableName: 'apiLogs', data: apiLogsData }
    }
  }

  /**
   * 获取备份元数据（用于流式写入前的初始化）
   */
  private getBackupMetadata(options: { includeSongs: boolean; includeUsers: boolean; includeSystemData: boolean }): { metadata: Record<string, unknown>; tables: string[] } {
    const { includeSongs, includeUsers, includeSystemData } = options

    const tables: string[] = []
    if (includeUsers) tables.push('users')
    if (includeSongs) {
      tables.push('songs', 'playTimes', 'schedules', 'semesters', 'notifications', 'songBlacklists', 'userIdentities', 'userStatusLogs', 'requestTimes', 'songCollaborators', 'collaborationLogs', 'songReplayRequests')
    }
    if (includeSystemData) {
      tables.push('systemSettings', 'emailTemplates')
    }
    if (includeSongs) {
      tables.push('apiKeys', 'apiKeyPermissions', 'apiLogs')
    }

    return {
      metadata: {
        version: '1.1',
        timestamp: new Date().toISOString(),
        includeSongs,
        includeUsers,
        includeSystemData,
        tables
      },
      tables
    }
  }

  /**
   * 执行保留策略
   */
  async applyRetentionPolicy(scheduleId?: number): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      deletedFiles: [],
      errors: []
    }

    try {
      const schedulesList = scheduleId
        ? await db.select().from(backupSchedules).where(eq(backupSchedules.id, scheduleId))
        : await db.select().from(backupSchedules)

      for (const schedule of schedulesList) {
        console.log(`[BackupService] Checking retention for schedule ${schedule.id}: type=${schedule.retentionType}, value=${schedule.retentionValue}, enabled=${schedule.enabled}`)

        if (!schedule.retentionType || schedule.retentionValue === null || schedule.retentionValue === undefined) {
          console.log(`[BackupService] Schedule ${schedule.id}: No retention policy configured, skipping`)
          continue
        }

        const retentionValue = typeof schedule.retentionValue === 'string' ? parseInt(schedule.retentionValue, 10) : schedule.retentionValue

        if (schedule.retentionType === 'days') {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - retentionValue)
          console.log(`[BackupService] Schedule ${schedule.id}: Checking days retention, cutoff=${cutoffDate.toISOString()}`)
        } else if (schedule.retentionType === 'count') {
          console.log(`[BackupService] Schedule ${schedule.id}: Checking count retention, keep=${retentionValue}`)
        } else {
          console.log(`[BackupService] Schedule ${schedule.id}: Unknown retention type: ${schedule.retentionType}`)
          continue
        }

        const historyRecords = await db
          .select()
          .from(backupHistory)
          .where(eq(backupHistory.scheduleId, schedule.id))
          .orderBy(desc(backupHistory.executedAt))

        console.log(`[BackupService] Schedule ${schedule.id}: Found ${historyRecords.length} history records`)

        const matchingRecords = historyRecords.filter((record) => {
          if (record.includeSongs !== (schedule.includeSongs ?? true)) return false
          if (record.includeUsers !== (schedule.includeUsers ?? true)) return false
          if (record.includeSystemData !== (schedule.includeSystemData ?? true)) return false
          return true
        })

        console.log(`[BackupService] Schedule ${schedule.id}: ${matchingRecords.length} records match current backup content settings`)

        let recordsToDelete: typeof historyRecords = []

        if (schedule.retentionType === 'days') {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - retentionValue)
          recordsToDelete = matchingRecords.filter((record) => new Date(record.executedAt) < cutoffDate)
        } else if (schedule.retentionType === 'count') {
          recordsToDelete = matchingRecords.slice(retentionValue)
        }

        console.log(`[BackupService] Schedule ${schedule.id}: Will delete ${recordsToDelete.length} records`)

        let s3Service: ReturnType<typeof getS3UploadService> | null = null
        let webdavService: ReturnType<typeof getWebDAVUploadService> | null = null

        if (schedule.uploadType === 's3' && schedule.s3Endpoint) {
          s3Service = getS3UploadService()
          s3Service.initialize({
            endpoint: schedule.s3Endpoint,
            bucket: schedule.s3Bucket || '',
            accessKey: schedule.s3AccessKey || '',
            secretKey: schedule.s3SecretKey || '',
            region: schedule.s3Region || 'us-east-1'
          })
        }

        if (schedule.uploadType === 'webdav' && schedule.webdavUrl) {
          webdavService = getWebDAVUploadService()
          webdavService.initialize({
            url: schedule.webdavUrl,
            username: schedule.webdavUsername || '',
            password: schedule.webdavPassword || ''
          })
        }

        for (const record of recordsToDelete) {
          try {
            if (record.localPath) {
              await fs.unlink(record.localPath)
            }

            if (s3Service) {
              const s3Path = schedule.s3Path || '/backups'
              const remotePath = `${s3Path.replace(/^\//, '')}/${record.filename}`
              try {
                await s3Service.deleteFile(remotePath)
              } catch (err) {
                console.log(`[BackupService] S3 file may not exist: ${remotePath}`)
              }
            }

            if (webdavService) {
              const webdavPath = schedule.webdavPath || '/backups'
              const remotePath = `${webdavPath.replace(/\/$/, '')}/${record.filename}`
              try {
                await webdavService.deleteFile(remotePath)
              } catch (err) {
                console.log(`[BackupService] WebDAV file may not exist: ${remotePath}`)
              }
            }

            await db.delete(backupHistory).where(eq(backupHistory.id, record.id))
            result.deletedCount++
            result.deletedFiles.push(record.filename)
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            result.errors.push(`Failed to delete ${record.filename}: ${errorMsg}`)
          }
        }
      }

      console.log(`[BackupService] Retention policy applied: ${result.deletedCount} backups deleted`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[BackupService] Failed to apply retention policy:', error)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * 获取备份历史
   */
  async getBackupHistory(options: {
    scheduleId?: number
    limit?: number
    offset?: number
  } = {}): Promise<{ records: typeof backupHistory.$inferSelect[]; total: number }> {
    const { scheduleId, limit = 50, offset = 0 } = options

    const conditions = scheduleId ? eq(backupHistory.scheduleId, scheduleId) : undefined

    const records = await db
      .select()
      .from(backupHistory)
      .where(conditions)
      .orderBy(desc(backupHistory.executedAt))
      .limit(limit)
      .offset(offset)

    const totalResult = await db
      .select({ count: backupHistory.id })
      .from(backupHistory)
      .where(conditions)

    const total = totalResult.length

    return { records, total }
  }

  /**
   * 获取备份配置列表
   */
  async getSchedules(): Promise<typeof backupSchedules.$inferSelect[]> {
    return db.select().from(backupSchedules).orderBy(desc(backupSchedules.createdAt))
  }

  /**
   * 获取单个备份配置
   */
  async getSchedule(id: number): Promise<typeof backupSchedules.$inferSelect | null> {
    const results = await db.select().from(backupSchedules).where(eq(backupSchedules.id, id))
    return results[0] || null
  }

  /**
   * 创建备份配置
   */
  async createSchedule(data: Omit<typeof backupSchedules.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>): Promise<typeof backupSchedules.$inferSelect> {
    const [schedule] = await db.insert(backupSchedules).values(data).returning()
    if (!schedule) {
      throw new Error('Failed to create backup schedule')
    }
    return schedule
  }

  /**
   * 更新备份配置
   */
  async updateSchedule(id: number, data: Partial<Omit<typeof backupSchedules.$inferInsert, 'id' | 'createdAt'>>): Promise<typeof backupSchedules.$inferSelect | null> {
    const [schedule] = await db
      .update(backupSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(backupSchedules.id, id))
      .returning()
    return schedule || null
  }

  /**
   * 删除备份配置
   */
  async deleteSchedule(id: number): Promise<boolean> {
    const result = await db.delete(backupSchedules).where(eq(backupSchedules.id, id))
    return result.length > 0
  }

  /**
   * 启用/禁用备份配置
   */
  async setScheduleEnabled(id: number, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(backupSchedules)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(backupSchedules.id, id))
    return result.length > 0
  }

  /**
   * 删除备份历史记录
   */
  async deleteBackupHistory(id: number): Promise<boolean> {
    const record = await db.select().from(backupHistory).where(eq(backupHistory.id, id)).then((r) => r[0])
    
    if (record?.localPath) {
      try {
        await fs.unlink(record.localPath)
      } catch {
        console.warn(`[BackupService] Failed to delete backup file: ${record.localPath}`)
      }
    }

    const result = await db.delete(backupHistory).where(eq(backupHistory.id, id))
    return result.length > 0
  }

  /**
   * 获取所有启用的备份配置
   */
  async getEnabledSchedules(): Promise<typeof backupSchedules.$inferSelect[]> {
    return db.select().from(backupSchedules).where(eq(backupSchedules.enabled, true))
  }
}

let backupServiceInstance: BackupService | null = null

export function getBackupService(): BackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService()
  }
  return backupServiceInstance
}
