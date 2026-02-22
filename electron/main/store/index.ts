import Store from 'electron-store'

interface StoreSchema {
  // API配置
  apiBaseUrl: string
  // 用户偏好
  preferences: {
    autoStart: boolean
    minimizeToTray: boolean
    closeToTray: boolean
    showDesktopLyric: boolean
    lyricFontSize: number
    lyricOpacity: number
    enableScheduledPlay: boolean
    autoSyncSchedule: boolean
  }
  // 播放计划缓存
  schedules: Array<{
    id: string
    time: string
    playlistId?: string
    songId?: string
    action: 'play' | 'pause' | 'stop'
  }>
  dailySchedule: {
    date: string
    items: Array<{
      id: string
      songId: string
      title: string
      artist: string
      cover?: string
      playUrl?: string
      localPath?: string
      startTime: string
      status: 'pending' | 'downloading' | 'ready' | 'error'
    }>
  }
  // 上次同步时间
  lastSyncTime?: number
  // 窗口状态
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

const store = new Store<StoreSchema>({
  defaults: {
    apiBaseUrl: 'http://localhost:3000',
    preferences: {
      autoStart: false,
      minimizeToTray: true,
      closeToTray: true,
      showDesktopLyric: false,
      lyricFontSize: 48,
      lyricOpacity: 0.9,
      enableScheduledPlay: false,
      autoSyncSchedule: true
    },
    schedules: [],
    dailySchedule: {
      date: '',
      items: []
    },
    windowBounds: {
      width: 1280,
      height: 800
    }
  }
})

export function initStore() {
  console.log('[Store] Initialized with path:', store.path)
}

export function getStore() {
  return store
}

export default store
