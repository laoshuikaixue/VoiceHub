import type { BackupSchedule } from '~/drizzle/schema'

/**
 * 备份调度器工具类
 * 用于手动备份模式（定时触发已禁用）
 */

export interface ScheduledTask {
  id: number
  name: string
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'cron'
  scheduleTime?: string
  scheduleDay?: number
  cronExpression?: string
  enabled: boolean
  callback: () => Promise<void>
  nextRun?: Date
}

export class BackupScheduler {
  private tasks: Map<number, ScheduledTask> = new Map()
  private timers: Map<number, NodeJS.Timeout> = new Map()
  private checkInterval: NodeJS.Timeout | null = null

  /**
   * 解析 cron 表达式，支持标准 5 位格式
   * 格式: 分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-6)
   */
  parseCronExpression(cron: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } | null {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) {
      return null
    }

    const [minuteStr, hourStr, dayOfMonthStr, monthStr, dayOfWeekStr] = parts

    const minute = this.parseCronField(minuteStr, 0, 59)
    const hour = this.parseCronField(hourStr, 0, 23)
    const dayOfMonth = this.parseCronField(dayOfMonthStr, 1, 31)
    const month = this.parseCronField(monthStr, 1, 12)
    const dayOfWeek = this.parseCronField(dayOfWeekStr, 0, 6)

    if (minute === null || hour === null || dayOfMonth === null || month === null || dayOfWeek === null) {
      return null
    }

    return { minute, hour, dayOfMonth, month, dayOfWeek }
  }

  /**
   * 解析 cron 字段，支持 * 和范围
   */
  private parseCronField(field: string, min: number, max: number): number | null {
    if (field === '*') {
      return min
    }

    if (field.includes('/')) {
      const [base, step] = field.split('/')
      if (base !== '*') {
        return null
      }
      return parseInt(step, 10) || min
    }

    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number)
      if (isNaN(start) || isNaN(end)) {
        return null
      }
      return start
    }

    const value = parseInt(field, 10)
    if (isNaN(value) || value < min || value > max) {
      return null
    }

    return value
  }

  /**
   * 根据调度配置计算下次执行时间
   */
  calculateNextRun(schedule: Pick<BackupSchedule, 'scheduleType' | 'scheduleTime' | 'scheduleDay' | 'cronExpression'>): Date | null {
    const now = new Date()
    const next = new Date(now)

    switch (schedule.scheduleType) {
      case 'daily':
        if (!schedule.scheduleTime) return null
        return this.calculateDailyNextRun(schedule.scheduleTime, next)

      case 'weekly':
        if (!schedule.scheduleTime || schedule.scheduleDay === undefined) return null
        return this.calculateWeeklyNextRun(schedule.scheduleTime, schedule.scheduleDay, next)

      case 'monthly':
        if (!schedule.scheduleTime || schedule.scheduleDay === undefined) return null
        return this.calculateMonthlyNextRun(schedule.scheduleTime, schedule.scheduleDay, next)

      case 'cron':
        if (!schedule.cronExpression) return null
        return this.calculateCronNextRun(schedule.cronExpression, next)

      default:
        return null
    }
  }

  /**
   * 计算每日调度的下次执行时间
   */
  private calculateDailyNextRun(timeStr: string, baseDate: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const next = new Date(baseDate)
    next.setHours(hours, minutes, 0, 0)

    if (next <= baseDate) {
      next.setDate(next.getDate() + 1)
    }

    return next
  }

  /**
   * 计算每周调度的下次执行时间
   * scheduleDay: 0=周日, 1=周一, ..., 6=周六
   */
  private calculateWeeklyNextRun(timeStr: string, dayOfWeek: number, baseDate: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const next = new Date(baseDate)
    next.setHours(hours, minutes, 0, 0)

    const currentDay = next.getDay()
    let daysUntilTarget = dayOfWeek - currentDay

    if (daysUntilTarget < 0) {
      daysUntilTarget += 7
    } else if (daysUntilTarget === 0 && next <= baseDate) {
      daysUntilTarget = 7
    }

    next.setDate(next.getDate() + daysUntilTarget)
    return next
  }

  /**
   * 计算每月调度的下次执行时间
   * scheduleDay: 1-31
   */
  private calculateMonthlyNextRun(timeStr: string, dayOfMonth: number, baseDate: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const next = new Date(baseDate)
    next.setHours(hours, minutes, 0, 0)
    next.setDate(dayOfMonth)

    if (next <= baseDate) {
      next.setMonth(next.getMonth() + 1)
      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
      if (dayOfMonth > lastDayOfMonth) {
        next.setDate(lastDayOfMonth)
      }
    }

    return next
  }

  /**
   * 计算 cron 表达式的下次执行时间
   */
  private calculateCronNextRun(cronExpr: string, baseDate: Date): Date {
    const parsed = this.parseCronExpression(cronExpr)
    if (!parsed) {
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
    }

    const next = new Date(baseDate)
    next.setSeconds(0, 0)

    next.setMinutes(parsed.minute)
    next.setHours(parsed.hour)

    const currentMonth = next.getMonth()
    const targetMonth = parsed.month - 1
    const targetDayOfMonth = parsed.dayOfMonth
    const targetDayOfWeek = parsed.dayOfWeek

    if (next <= baseDate) {
      next.setDate(targetDayOfMonth)
      next.setMonth(targetMonth)

      if (next <= baseDate) {
        next.setMonth(next.getMonth() + 1)
        if (parsed.dayOfMonth === 0) {
          while (next.getDay() !== targetDayOfWeek) {
            next.setDate(next.getDate() + 1)
          }
        }
      }
    }

    return next
  }

  /**
   * 添加任务到调度器
   */
  addTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task)
    if (task.enabled) {
      this.scheduleTask(task)
    }
  }

  /**
   * 从调度器移除任务
   */
  removeTask(id: number): void {
    this.clearTaskTimer(id)
    this.tasks.delete(id)
  }

  /**
   * 更新任务
   */
  updateTask(task: ScheduledTask): void {
    this.removeTask(task.id)
    this.addTask(task)
  }

  /**
   * 启用/禁用任务
   */
  setTaskEnabled(id: number, enabled: boolean): void {
    const task = this.tasks.get(id)
    if (!task) return

    task.enabled = enabled
    if (enabled) {
      this.scheduleTask(task)
    } else {
      this.clearTaskTimer(id)
    }
  }

  /**
   * 调度单个任务
   */
  private scheduleTask(task: ScheduledTask): void {
    this.clearTaskTimer(task.id)

    const nextRun = this.calculateNextRun(task)
    if (!nextRun) return

    task.nextRun = nextRun
    const delay = nextRun.getTime() - Date.now()

    const MAX_TIMEOUT_DELAY = 2147483647

    if (delay > MAX_TIMEOUT_DELAY) {
      console.log(`[BackupScheduler] Task ${task.id} (${task.name}) delay exceeds maximum timeout, relying on polling`)
      return
    }

    const timer = setTimeout(async () => {
      try {
        await task.callback()
      } catch (error) {
        console.error(`[BackupScheduler] Task ${task.id} (${task.name}) failed:`, error)
      }

      if (this.tasks.has(task.id) && this.tasks.get(task.id)?.enabled) {
        this.scheduleTask(this.tasks.get(task.id)!)
      }
    }, delay)

    this.timers.set(task.id, timer)
  }

  /**
   * 清除任务定时器
   */
  private clearTaskTimer(id: number): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.checkInterval) return

    console.log('[BackupScheduler] Starting scheduler...')

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    }

    this.checkInterval = setInterval(() => {
      this.checkPendingTasks()
    }, 60000)
  }

  /**
   * 停止调度器
   */
  stop(): void {
    console.log('[BackupScheduler] Stopping scheduler...')

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }

  /**
   * 检查待执行的任务
   */
  private checkPendingTasks(): void {
    const now = Date.now()

    for (const task of this.tasks.values()) {
      if (!task.enabled || !task.nextRun) continue

      if (task.nextRun.getTime() <= now) {
        console.log(`[BackupScheduler] Executing task ${task.id} (${task.name})...`)
        this.scheduleTask(task)

        task.callback().catch((error) => {
          console.error(`[BackupScheduler] Task ${task.id} (${task.name}) failed:`, error)
        })
      }
    }
  }

  /**
   * 获取所有任务状态
   */
  getTasks(): Array<ScheduledTask & { nextRun: Date | undefined }> {
    return Array.from(this.tasks.values()).map((task) => ({
      ...task,
      nextRun: task.nextRun
    }))
  }

  /**
   * 获取单个任务状态
   */
  getTask(id: number): ScheduledTask | undefined {
    return this.tasks.get(id)
  }
}

let schedulerInstance: BackupScheduler | null = null

export function getBackupScheduler(): BackupScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new BackupScheduler()
  }
  return schedulerInstance
}

export function initBackupScheduler(): BackupScheduler {
  const scheduler = getBackupScheduler()
  scheduler.start()
  return scheduler
}
