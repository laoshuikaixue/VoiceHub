import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '~/drizzle/db'
import {
  backupHistory,
  backupSchedules,
  type BackupSchedule
} from '~/drizzle/schema'
import { eq, desc, and, lte, or } from 'drizzle-orm'

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
      tables?: 'all' | 'users'
      includeSystemData?: boolean
    } = {}
  ): Promise<BackupResult> {
    const { scheduleId, tables = 'all', includeSystemData = true } = options

    try {
      await this.initBackupDir()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `backup-${tables}-${timestamp}.json`
      const filepath = path.join(this.backupDir, filename)

      const backupData = await this.gatherBackupData(tables, includeSystemData)
      const content = JSON.stringify(backupData, null, 2)

      await fs.writeFile(filepath, content, 'utf8')

      const fileSize = Buffer.byteLength(content, 'utf8')
      const checksum = createHash('sha256').update(content).digest('hex')

      let historyId: number | undefined
      await db.insert(backupHistory).values({
        scheduleId: scheduleId || null,
        filename,
        fileSize,
        status: 'success',
        checksum,
        localPath: filepath,
        executedAt: new Date()
      }).returning({ id: backupHistory.id }).then(([result]) => {
        historyId = result?.id
      })

      console.log(`[BackupService] Backup created: ${filename} (${fileSize} bytes)`)

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
   * 收集备份数据
   */
  private async gatherBackupData(tables: 'all' | 'users', includeSystemData: boolean): Promise<Record<string, unknown>> {
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

    const metadata = {
      version: '1.1',
      timestamp: new Date().toISOString(),
      backupType: tables,
      includeSystemData,
      tables: [] as string[]
    }

    const data: Record<string, unknown[]> = {}

    if (tables === 'all' || tables === 'users') {
      const usersData = await db.select().from(users)
      const settingsData = await db.select().from(notificationSettings)
      
      data.users = usersData.map((user) => ({
        ...user,
        notificationSettings: settingsData.filter((setting) => setting.userId === user.id)
      }))
      metadata.tables.push('users')
    }

    if (tables === 'all') {
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

      data.songs = songsData.map((song) => ({
        ...song,
        votes: votesData.filter((vote) => vote.songId === song.id),
        schedules: schedulesData.filter((schedule) => schedule.songId === song.id),
        collaborators: songCollaboratorsData.filter((collab) => collab.songId === song.id),
        replayRequests: songReplayRequestsData.filter((req) => req.songId === song.id)
      }))
      metadata.tables.push('songs')

      data.playTimes = playTimesData
      metadata.tables.push('playTimes')

      data.schedules = schedulesData
      metadata.tables.push('schedules')

      data.semesters = semestersData
      metadata.tables.push('semesters')

      data.notifications = notificationsData
      metadata.tables.push('notifications')

      data.songBlacklists = songBlacklistsData
      metadata.tables.push('songBlacklists')

      data.userIdentities = userIdentitiesData
      metadata.tables.push('userIdentities')

      data.userStatusLogs = userStatusLogsData
      metadata.tables.push('userStatusLogs')

      data.requestTimes = requestTimesData
      metadata.tables.push('requestTimes')

      data.songCollaborators = songCollaboratorsData
      metadata.tables.push('songCollaborators')

      data.collaborationLogs = collaborationLogsData
      metadata.tables.push('collaborationLogs')

      data.songReplayRequests = songReplayRequestsData
      metadata.tables.push('songReplayRequests')
    }

    if (includeSystemData) {
      const systemSettingsData = await db.select().from(systemSettings)
      const emailTemplatesData = await db.select().from(emailTemplates)
      
      data.systemSettings = systemSettingsData
      metadata.tables.push('systemSettings')

      data.emailTemplates = emailTemplatesData
      metadata.tables.push('emailTemplates')
    }

    if (tables === 'all') {
      const apiKeysData = await db.select().from(apiKeys)
      const apiKeyPermissionsData = await db.select().from(apiKeyPermissions)
      const apiLogsData = await db.select().from(apiLogs)

      data.apiKeys = apiKeysData
      data.apiKeyPermissions = apiKeyPermissionsData
      data.apiLogs = apiLogsData
      metadata.tables.push('apiKeys', 'apiKeyPermissions', 'apiLogs')
    }

    return {
      metadata,
      data
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
      const conditions = scheduleId ? eq(backupHistory.scheduleId, scheduleId) : undefined
      const schedulesList = scheduleId
        ? await db.select().from(backupSchedules).where(eq(backupSchedules.id, scheduleId))
        : await db.select().from(backupSchedules)

      for (const schedule of schedulesList) {
        if (!schedule.retentionType || !schedule.retentionValue) continue

        const historyRecords = await db
          .select()
          .from(backupHistory)
          .where(eq(backupHistory.scheduleId, schedule.id))
          .orderBy(desc(backupHistory.executedAt))

        let recordsToDelete: typeof historyRecords = []

        if (schedule.retentionType === 'days') {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - schedule.retentionValue)
          recordsToDelete = historyRecords.filter((record) => new Date(record.executedAt) < cutoffDate)
        } else if (schedule.retentionType === 'count') {
          recordsToDelete = historyRecords.slice(schedule.retentionValue)
        }

        for (const record of recordsToDelete) {
          try {
            if (record.localPath) {
              await fs.unlink(record.localPath)
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
   * 获取备份调度列表
   */
  async getSchedules(): Promise<typeof backupSchedules.$inferSelect[]> {
    return db.select().from(backupSchedules).orderBy(desc(backupSchedules.createdAt))
  }

  /**
   * 获取单个调度
   */
  async getSchedule(id: number): Promise<typeof backupSchedules.$inferSelect | null> {
    const results = await db.select().from(backupSchedules).where(eq(backupSchedules.id, id))
    return results[0] || null
  }

  /**
   * 创建调度
   */
  async createSchedule(data: Omit<typeof backupSchedules.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>): Promise<typeof backupSchedules.$inferSelect> {
    const [schedule] = await db.insert(backupSchedules).values(data).returning()
    return schedule
  }

  /**
   * 更新调度
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
   * 删除调度
   */
  async deleteSchedule(id: number): Promise<boolean> {
    const result = await db.delete(backupSchedules).where(eq(backupSchedules.id, id))
    return result.rowCount > 0
  }

  /**
   * 启用/禁用调度
   */
  async setScheduleEnabled(id: number, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(backupSchedules)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(backupSchedules.id, id))
    return result.rowCount > 0
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
    return result.rowCount > 0
  }

  /**
   * 获取所有启用的调度
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
