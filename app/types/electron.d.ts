export interface ElectronAPI {
  // 存储相关
  getApiUrl: () => Promise<string>
  setApiUrl: (url: string) => Promise<{ success: boolean }>
  getPreferences: () => Promise<{
    autoStart: boolean
    minimizeToTray: boolean
    closeToTray: boolean
    showDesktopLyric: boolean
    lyricFontSize: number
    lyricOpacity: number
    enableScheduledPlay: boolean
    autoSyncSchedule: boolean
  }>
  setPreferences: (preferences: any) => Promise<{ success: boolean }>
  getSchedules: () => Promise<any[]>
  setSchedules: (schedules: any[]) => Promise<{ success: boolean }>
  getConfigPath: () => Promise<string>
  getLastSyncTime: () => Promise<number | undefined>

  // 桌面歌词
  toggleDesktopLyric: (show: boolean) => Promise<{ success: boolean }>
  updateLyric: (lyric: string, progress?: number) => Promise<{ success: boolean }>

  // 定时播放
  syncSchedule: () => Promise<{ success: boolean; error?: string }>
  reloadSchedules: () => Promise<{ success: boolean }>

  // 窗口控制
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void

  // 事件监听
  onTrayPlayPause: (callback: () => void) => void
  onTrayPrevious: (callback: () => void) => void
  onTrayNext: (callback: () => void) => void
  onToggleDesktopLyric: (callback: (checked: boolean) => void) => void
  onLyricUpdate: (callback: (data: { lyric: string; progress?: number }) => void) => void
  onLyricStyleUpdate: (callback: (data: { fontSize: number; opacity: number }) => void) => void

  // 平台信息
  platform: string
  isElectron: boolean
}

declare global {
  interface Window {
    electron?: ElectronAPI
  }
}

export {}
