import schedule from 'node-schedule'
import { BrowserWindow } from 'electron'
import { getStore } from '../store/index.js'
import { logger } from '../utils/logger.js'

interface ScheduleTask {
  id: string
  time: string // HH:mm 格式
  playlistId?: string
  songId?: string
  action: 'play' | 'pause' | 'stop'
  enabled: boolean
}

const jobs: Map<string, schedule.Job> = new Map()

export function initScheduler() {
  logger.info('Scheduler', 'Initializing scheduler')
  
  // 加载并启动所有任务
  loadAndStartTasks()
  
  // 每小时自动同步一次（如果启用）
  schedule.scheduleJob('0 * * * *', () => {
    const store = getStore()
    const preferences = store.get('preferences')
    
    if (preferences.autoSyncSchedule) {
      logger.info('Scheduler', 'Auto-syncing schedules')
      syncSchedulesFromServer()
    }
  })
}

export function loadAndStartTasks() {
  const store = getStore()
  const schedules = store.get('schedules') || []
  const preferences = store.get('preferences')
  
  if (!preferences.enableScheduledPlay) {
    logger.info('Scheduler', 'Scheduled play is disabled')
    return
  }
  
  // 清除现有任务
  clearAllJobs()
  
  // 创建新任务
  schedules.forEach((task: ScheduleTask) => {
    if (task.enabled !== false) {
      createScheduleJob(task)
    }
  })
  
  logger.info('Scheduler', `Loaded ${jobs.size} scheduled tasks`)
}

function createScheduleJob(task: ScheduleTask) {
  try {
    // 解析时间 (HH:mm)
    const [hour, minute] = task.time.split(':').map(Number)
    
    // 创建定时任务（每天执行）
    const rule = new schedule.RecurrenceRule()
    rule.hour = hour
    rule.minute = minute
    rule.second = 0
    
    const job = schedule.scheduleJob(rule, () => {
      logger.info('Scheduler', `Executing task ${task.id} at ${task.time}`)
      executeTask(task)
    })
    
    if (job) {
      jobs.set(task.id, job)
      logger.info('Scheduler', `Scheduled task ${task.id} for ${task.time}`)
    }
  } catch (error) {
    logger.error('Scheduler', `Failed to create job for task ${task.id}:`, error)
  }
}

function executeTask(task: ScheduleTask) {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  
  if (!mainWindow) {
    logger.error('Scheduler', 'Main window not found')
    return
  }
  
  // 发送任务到渲染进程
  mainWindow.webContents.send('execute-scheduled-task', task)
  
  logger.info('Scheduler', `Task ${task.id} sent to renderer process`)
}

export function clearAllJobs() {
  jobs.forEach((job, id) => {
    job.cancel()
    logger.info('Scheduler', `Cancelled job ${id}`)
  })
  jobs.clear()
}

export async function syncSchedulesFromServer() {
  try {
    const store = getStore()
    const apiBaseUrl = store.get('apiBaseUrl')
    
    // 这里应该从服务器获取排期表
    // 暂时使用示例数据
    logger.info('Scheduler', `Syncing from ${apiBaseUrl}`)
    
    // TODO: 实现实际的 API 调用
    // const response = await fetch(`${apiBaseUrl}/api/schedules/today`)
    // const schedules = await response.json()
    
    // 暂时返回成功
    return { success: true }
  } catch (error) {
    logger.error('Scheduler', 'Failed to sync schedules:', error)
    return { success: false, error: String(error) }
  }
}

export function getSchedulerStatus() {
  return {
    enabled: jobs.size > 0,
    taskCount: jobs.size,
    tasks: Array.from(jobs.keys())
  }
}
