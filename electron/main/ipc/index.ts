import { ipcMain, BrowserWindow } from 'electron'
import { getStore } from '../store/index.js'
import { createLyricWindow, closeLyricWindow, updateLyric, updateLyricStyle } from '../windows/lyric-window.js'

export function initIPC() {
  const store = getStore()
  
  // 获取主窗口的辅助函数
  const getMainWindow = () => BrowserWindow.getAllWindows()[0]

  // 获取API地址
  ipcMain.handle('get-api-url', () => {
    return store.get('apiBaseUrl')
  })

  // 设置API地址
  ipcMain.handle('set-api-url', (_, url: string) => {
    store.set('apiBaseUrl', url)
    return { success: true }
  })

  // 获取用户偏好
  ipcMain.handle('get-preferences', () => {
    return store.get('preferences')
  })

  // 设置用户偏好
  ipcMain.handle('set-preferences', (_, preferences: any) => {
    const current = store.get('preferences')
    const updated = { ...current, ...preferences }
    store.set('preferences', updated)
    
    // 如果歌词样式改变，更新歌词窗口
    if (preferences.lyricFontSize || preferences.lyricOpacity) {
      updateLyricStyle(
        updated.lyricFontSize || 48,
        updated.lyricOpacity || 0.9
      )
    }
    
    return { success: true }
  })

  // 获取配置文件路径
  ipcMain.handle('get-config-path', () => {
    return store.path
  })

  // 桌面歌词控制
  ipcMain.handle('toggle-desktop-lyric', (_, show: boolean) => {
    if (show) {
      createLyricWindow()
    } else {
      closeLyricWindow()
    }
    return { success: true }
  })

  // 更新歌词
  ipcMain.handle('update-lyric', (_, lyric: string, progress?: number) => {
    updateLyric(lyric, progress)
    return { success: true }
  })

  // 定时播放控制
  ipcMain.handle('sync-schedule', async () => {
    const { syncSchedulesFromServer } = await import('../scheduler/index.js')
    return await syncSchedulesFromServer()
  })

  ipcMain.handle('reload-schedules', async () => {
    const { loadAndStartTasks } = await import('../scheduler/index.js')
    loadAndStartTasks()
    return { success: true }
  })

  // 获取播放计划
  ipcMain.handle('get-schedules', () => {
    return store.get('schedules')
  })

  // 设置播放计划
  ipcMain.handle('set-schedules', (_, schedules: any[]) => {
    store.set('schedules', schedules)
    store.set('lastSyncTime', Date.now())
    return { success: true }
  })

  // 获取上次同步时间
  ipcMain.handle('get-last-sync-time', () => {
    return store.get('lastSyncTime')
  })

  // 窗口控制
  ipcMain.handle('window-minimize', () => {
    const win = getMainWindow()
    win?.minimize()
  })

  ipcMain.handle('window-maximize', () => {
    const win = getMainWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle('window-close', () => {
    const win = getMainWindow()
    const preferences = store.get('preferences')
    if (preferences.closeToTray) {
      win?.hide()
    } else {
      win?.close()
    }
  })

  console.log('[IPC] Handlers registered')
}
