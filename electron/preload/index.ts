import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的API
const electronAPI = {
  // 存储相关
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  setApiUrl: (url: string) => ipcRenderer.invoke('set-api-url', url),
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  setPreferences: (preferences: any) => ipcRenderer.invoke('set-preferences', preferences),
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  setSchedules: (schedules: any[]) => ipcRenderer.invoke('set-schedules', schedules),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  getLastSyncTime: () => ipcRenderer.invoke('get-last-sync-time'),
  
  // 定时播放
  syncSchedule: () => ipcRenderer.invoke('sync-schedule'),
  reloadSchedules: () => ipcRenderer.invoke('reload-schedules'),
  
  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  
  // 监听来自主进程的消息
  onTrayPlayPause: (callback: () => void) => {
    ipcRenderer.on('tray-play-pause', callback)
  },
  onTrayPrevious: (callback: () => void) => {
    ipcRenderer.on('tray-previous', callback)
  },
  onTrayNext: (callback: () => void) => {
    ipcRenderer.on('tray-next', callback)
  },
  
  // 平台信息
  platform: process.platform,
  isElectron: true
}

// 在渲染进程中暴露API
contextBridge.exposeInMainWorld('electron', electronAPI)

// TypeScript类型定义
export type ElectronAPI = typeof electronAPI
