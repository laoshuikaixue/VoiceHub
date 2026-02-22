import schedule from 'node-schedule'
import { BrowserWindow } from 'electron'
import axios from 'axios'
import { pathToFileURL } from 'url'
import { getStore } from '../store/index.js'
import { logger } from '../utils/logger.js'
import { Downloader } from '../utils/downloader.js'

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
  
  // 创建新任务 (手动排期)
  schedules.forEach((task: ScheduleTask) => {
    if (task.enabled !== false) {
      createScheduleJob(task)
    }
  })

  // 创建每日排期任务
  const dailySchedule = store.get('dailySchedule')
  const today = new Date().toISOString().split('T')[0]
  
  if (dailySchedule && dailySchedule.date === today) {
    dailySchedule.items.forEach((item: any) => {
      if (item.status !== 'error') {
        createDailyScheduleJob(item)
      }
    })
    logger.info('Scheduler', `Loaded ${dailySchedule.items.length} daily tasks`)
  }
  
  logger.info('Scheduler', `Total jobs scheduled: ${jobs.size}`)
}

function createDailyScheduleJob(item: any) {
  try {
    const [hour, minute] = item.startTime.split(':').map(Number)
    const now = new Date()
    const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0)
    
    // 如果时间已过，不再调度
    if (scheduledTime < now) {
      return
    }

    const job = schedule.scheduleJob(scheduledTime, () => {
      logger.info('Scheduler', `Executing daily task ${item.id} at ${item.startTime}`)
      executeDailyTask(item)
    })
    
    if (job) {
      jobs.set(`daily-${item.id}`, job)
    }
  } catch (error) {
    logger.error('Scheduler', `Failed to create daily job for ${item.id}:`, error)
  }
}

function executeDailyTask(item: any) {
  const store = getStore()
  const dailySchedule = store.get('dailySchedule')
  const apiBaseUrl = store.get('apiBaseUrl') || ''
  const freshItem = dailySchedule?.items.find((i: any) => i.id === item.id) || item

  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (!mainWindow) return

  let playUrl = freshItem.playUrl
  if (playUrl && !playUrl.startsWith('http')) {
    try {
      playUrl = new URL(playUrl, apiBaseUrl).href
    } catch (e) {
      // Fallback
      playUrl = `${apiBaseUrl}/${playUrl}`.replace(/([^:]\/)\/+/g, "$1")
    }
  }

  mainWindow.webContents.send('execute-daily-task', {
    ...freshItem,
    // 优先使用本地路径，否则使用完整的远程URL
    url: freshItem.localPath ? pathToFileURL(freshItem.localPath).href : playUrl
  })
  
  logger.info('Scheduler', `Daily task ${item.id} sent to renderer`)
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
    
    logger.info('Scheduler', `Syncing from ${apiBaseUrl}`)
    
    // Fetch today's schedule
    const today = new Date().toISOString().split('T')[0]
    const response = await axios.get(`${apiBaseUrl}/api/open/schedules`, {
      params: {
        date: today,
        limit: 100
      }
    })

    if (!response.data.success) {
      throw new Error('API returned error')
    }

    const schedules = response.data.data.schedules
    const dailyItems: any[] = []
    
    for (const item of schedules) {
      if (!item.playTime) continue 

      const scheduleItem = {
        id: item.id,
        songId: item.song.id,
        title: item.song.title,
        artist: item.song.artist,
        cover: item.song.cover,
        playUrl: item.song.playUrl,
        startTime: item.playTime.startTime,
        status: 'pending',
        localPath: undefined
      }
      
      dailyItems.push(scheduleItem)
    }

    // Save to store immediately
    store.set('dailySchedule', {
      date: today,
      items: dailyItems
    })
    store.set('lastSyncTime', Date.now())
    
    // Reload scheduler
    loadAndStartTasks()
    
    // Start downloading assets in background
    downloadDailyAssets(dailyItems, apiBaseUrl)

    return { success: true, count: dailyItems.length }
  } catch (error) {
    logger.error('Scheduler', 'Failed to sync schedules:', error)
    return { success: false, error: String(error) }
  }
}

async function downloadDailyAssets(items: any[], apiBaseUrl: string) {
  const downloader = Downloader.getInstance()
  
  for (const item of items) {
    if (!item.playUrl) continue
    
    try {
      updateItemStatus(item.id, 'downloading')
      
      let downloadUrl = item.playUrl
      if (!downloadUrl.startsWith('http')) {
        try {
          downloadUrl = new URL(downloadUrl, apiBaseUrl).href
        } catch (e) {
          // Fallback manual join
          const base = apiBaseUrl.replace(/\/+$/, '')
          const path = downloadUrl.replace(/^\/+/, '')
          downloadUrl = `${base}/${path}`
        }
      }
      
      const ext = downloadUrl.split('.').pop()?.split('?')[0] || 'mp3'
      const safeTitle = item.title.replace(/[\\/:*?"<>|]/g, '_')
      const filename = `${item.songId}-${safeTitle}.${ext}`
      
      const localPath = await downloader.downloadFile(downloadUrl, filename)
      
      updateItemStatus(item.id, 'ready', localPath)
    } catch (error) {
      logger.error('Scheduler', `Failed to download asset for ${item.id}:`, error)
      updateItemStatus(item.id, 'error')
    }
  }
}

function updateItemStatus(id: string, status: string, localPath?: string) {
  const store = getStore()
  const dailySchedule = store.get('dailySchedule')
  if (!dailySchedule) return
  
  const target = dailySchedule.items.find((i: any) => i.id === id)
  if (target) {
    target.status = status
    if (localPath) target.localPath = localPath
    store.set('dailySchedule', dailySchedule)
    
    // Notify renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('schedule-status-update', { id, status })
    }
  }
}

export function getSchedulerStatus() {
  return {
    enabled: jobs.size > 0,
    taskCount: jobs.size,
    tasks: Array.from(jobs.keys())
  }
}
