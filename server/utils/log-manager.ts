import fs from 'fs/promises'
import path from 'path'
import type { WriteStream } from 'fs'
import { createWriteStream } from 'fs'
import { LOG_CONSTANTS } from '../config/constants'
import { db } from '~/drizzle/db'
import { apiLogs } from '~/drizzle/schema'
import { lt, sql } from 'drizzle-orm'

/**
 * 日志管理器
 * 负责API日志的轮转、归档和清理
 */
export class LogManager {
  private static instance: LogManager
  private logStream: WriteStream | null = null
  private currentLogFile: string = ''
  private rotationTimer: NodeJS.Timeout | null = null
  private archiveTimer: NodeJS.Timeout | null = null

  private constructor() {
    this.initializeLogRotation()
  }

  static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager()
    }
    return LogManager.instance
  }

  /**
   * 写入日志
   */
  async writeLog(logEntry: {
    timestamp: Date
    method: string
    path: string
    statusCode: number
    responseTime: number
    apiKeyId?: number
    ipAddress?: string
    userAgent?: string
    requestBody?: string
    responseBody?: string
    errorMessage?: string
  }): Promise<void> {
    try {
      const logLine =
        JSON.stringify({
          ...logEntry,
          timestamp: logEntry.timestamp.toISOString()
        }) + '\n'

      if (this.logStream) {
        this.logStream.write(logLine)
      }
    } catch (error) {
      console.error('[Log Manager] 写入日志失败:', error)
    }
  }

  /**
   * 执行日志轮转
   */
  async rotateLog(): Promise<void> {
    try {
      console.log('[Log Manager] 开始执行日志轮转')

      // 关闭当前日志流
      if (this.logStream) {
        this.logStream.end()
        this.logStream = null
      }

      // 创建新的日志文件
      await this.createCurrentLogFile()

      // 清理过期的日志文件
      await this.cleanupOldLogs()

      console.log('[Log Manager] 日志轮转完成')
    } catch (error) {
      console.error('[Log Manager] 日志轮转失败:', error)
    }
  }

  /**
   * 执行日志归档
   */
  async archiveLogs(): Promise<void> {
    try {
      console.log('[Log Manager] 开始执行日志归档')

      const logDir = LOG_CONSTANTS.LOG_DIR
      const archiveDir = LOG_CONSTANTS.ARCHIVE_DIR
      const files = await fs.readdir(logDir)
      const archiveDate = new Date()
      archiveDate.setDate(archiveDate.getDate() - LOG_CONSTANTS.ARCHIVE_AFTER_DAYS)

      for (const file of files) {
        if (file.startsWith('api-') && file.endsWith('.log')) {
          const filePath = path.join(logDir, file)
          const stats = await fs.stat(filePath)

          // 如果文件超过归档天数，移动到归档目录
          if (stats.mtime < archiveDate) {
            const archivePath = path.join(archiveDir, file)
            await fs.rename(filePath, archivePath)
            console.log(`[Log Manager] 归档日志文件: ${file}`)
          }
        }
      }

      // 清理数据库中的过期日志
      await this.cleanupDatabaseLogs()

      console.log('[Log Manager] 日志归档完成')
    } catch (error) {
      console.error('[Log Manager] 日志归档失败:', error)
    }
  }

  /**
   * 获取日志统计信息
   */
  async getLogStats(): Promise<{
    currentLogFile: string
    logFileSize: number
    totalLogFiles: number
    archivedFiles: number
    oldestLog: Date | null
    newestLog: Date | null
  }> {
    try {
      const logDir = LOG_CONSTANTS.LOG_DIR
      const archiveDir = LOG_CONSTANTS.ARCHIVE_DIR

      // 获取当前日志文件大小
      let logFileSize = 0
      try {
        const stats = await fs.stat(this.currentLogFile)
        logFileSize = stats.size
      } catch {
        // 文件不存在
      }

      // 统计日志文件数量
      const logFiles = await fs.readdir(logDir)
      const totalLogFiles = logFiles.filter(
        (f) => f.startsWith('api-') && f.endsWith('.log')
      ).length

      // 统计归档文件数量
      let archivedFiles = 0
      try {
        const archiveFiles = await fs.readdir(archiveDir)
        archivedFiles = archiveFiles.filter(
          (f) => f.startsWith('api-') && f.endsWith('.log')
        ).length
      } catch {
        // 归档目录不存在
      }

      // 获取最新和最旧的日志时间（从数据库）
      const [oldestResult, newestResult] = await Promise.all([
        db
          .select({ createdAt: apiLogs.createdAt })
          .from(apiLogs)
          .orderBy(apiLogs.createdAt)
          .limit(1),
        db
          .select({ createdAt: apiLogs.createdAt })
          .from(apiLogs)
          .orderBy(sql`${apiLogs.createdAt} DESC`)
          .limit(1)
      ])

      return {
        currentLogFile: this.currentLogFile,
        logFileSize,
        totalLogFiles,
        archivedFiles,
        oldestLog: oldestResult[0]?.createdAt || null,
        newestLog: newestResult[0]?.createdAt || null
      }
    } catch (error) {
      console.error('[Log Manager] 获取日志统计失败:', error)
      return {
        currentLogFile: this.currentLogFile,
        logFileSize: 0,
        totalLogFiles: 0,
        archivedFiles: 0,
        oldestLog: null,
        newestLog: null
      }
    }
  }

  /**
   * 手动触发日志轮转
   */
  async manualRotate(): Promise<void> {
    await this.rotateLog()
  }

  /**
   * 手动触发日志归档
   */
  async manualArchive(): Promise<void> {
    await this.archiveLogs()
  }

  /**
   * 销毁日志管理器
   */
  destroy(): void {
    if (this.logStream) {
      this.logStream.end()
      this.logStream = null
    }

    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
      this.rotationTimer = null
    }

    if (this.archiveTimer) {
      clearTimeout(this.archiveTimer)
      this.archiveTimer = null
    }

    console.log('[Log Manager] 日志管理器已销毁')
  }

  /**
   * 初始化日志轮转
   */
  private async initializeLogRotation(): Promise<void> {
    try {
      // 确保日志目录存在
      await this.ensureLogDirectory()

      // 创建当前日志文件
      await this.createCurrentLogFile()

      // 设置定时轮转（每天凌晨执行）
      this.scheduleLogRotation()

      // 设置定时归档（每周执行）
      this.scheduleLogArchive()

      console.log('[Log Manager] 日志管理器初始化完成')
    } catch (error) {
      console.error('[Log Manager] 初始化失败:', error)
    }
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    const logDir = LOG_CONSTANTS.LOG_DIR
    const archiveDir = LOG_CONSTANTS.ARCHIVE_DIR

    try {
      await fs.access(logDir)
    } catch {
      await fs.mkdir(logDir, { recursive: true })
      console.log(`[Log Manager] 创建日志目录: ${logDir}`)
    }

    try {
      await fs.access(archiveDir)
    } catch {
      await fs.mkdir(archiveDir, { recursive: true })
      console.log(`[Log Manager] 创建归档目录: ${archiveDir}`)
    }
  }

  /**
   * 创建当前日志文件
   */
  private async createCurrentLogFile(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    this.currentLogFile = path.join(LOG_CONSTANTS.LOG_DIR, `api-${today}.log`)

    // 关闭现有流
    if (this.logStream) {
      this.logStream.end()
    }

    // 创建新的写入流
    this.logStream = createWriteStream(this.currentLogFile, { flags: 'a' })

    console.log(`[Log Manager] 当前日志文件: ${this.currentLogFile}`)
  }

  /**
   * 清理过期的日志文件
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const logDir = LOG_CONSTANTS.LOG_DIR
      const files = await fs.readdir(logDir)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - LOG_CONSTANTS.RETENTION_DAYS)

      for (const file of files) {
        if (file.startsWith('api-') && file.endsWith('.log')) {
          const filePath = path.join(logDir, file)
          const stats = await fs.stat(filePath)

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath)
            console.log(`[Log Manager] 删除过期日志文件: ${file}`)
          }
        }
      }
    } catch (error) {
      console.error('[Log Manager] 清理过期日志失败:', error)
    }
  }

  /**
   * 清理数据库中的过期日志
   */
  private async cleanupDatabaseLogs(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - LOG_CONSTANTS.DB_RETENTION_DAYS)

      const result = await db.delete(apiLogs).where(lt(apiLogs.createdAt, cutoffDate))

      console.log(`[Log Manager] 清理数据库日志记录: ${result.rowCount || 0} 条`)
    } catch (error) {
      console.error('[Log Manager] 清理数据库日志失败:', error)
    }
  }

  /**
   * 设置定时日志轮转
   */
  private scheduleLogRotation(): void {
    // 计算到下一个凌晨的毫秒数
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const msUntilMidnight = tomorrow.getTime() - now.getTime()

    // 设置首次执行
    setTimeout(() => {
      this.rotateLog()

      // 设置每日定时执行
      this.rotationTimer = setInterval(
        () => {
          this.rotateLog()
        },
        24 * 60 * 60 * 1000
      ) // 24小时
    }, msUntilMidnight)

    console.log(`[Log Manager] 日志轮转定时器设置完成，首次执行时间: ${tomorrow.toISOString()}`)
  }

  /**
   * 设置定时日志归档
   */
  private scheduleLogArchive(): void {
    // 每周日凌晨2点执行归档
    const scheduleArchive = () => {
      const now = new Date()
      const nextSunday = new Date(now)
      const daysUntilSunday = (7 - now.getDay()) % 7
      nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday))
      nextSunday.setHours(2, 0, 0, 0)

      const msUntilArchive = nextSunday.getTime() - now.getTime()

      setTimeout(() => {
        this.archiveLogs()
        scheduleArchive() // 递归设置下次执行
      }, msUntilArchive)

      console.log(`[Log Manager] 日志归档定时器设置完成，下次执行时间: ${nextSunday.toISOString()}`)
    }

    scheduleArchive()
  }
}

// 导出单例实例
export const logManager = LogManager.getInstance()
