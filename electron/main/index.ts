import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initStore } from './store/index.js'
import { initTray } from './tray/index.js'
import { initIPC } from './ipc/index.js'
import { initScheduler } from './scheduler/index.js'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // 允许跨域请求
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#111111'
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 加载应用
  if (is.dev) {
    // 开发模式：直接加载 Nuxt 开发服务器
    // 尝试 3001，如果被占用会自动使用 3000
    mainWindow.loadURL('http://localhost:3000')
    // 开发模式可以按 F12 手动打开 DevTools
  } else {
    // 生产环境：加载静态文件
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 应用准备就绪
app.whenReady().then(() => {
  // 设置应用用户模型ID (Windows)
  electronApp.setAppUserModelId('com.voicehub.app')

  // 开发环境下监听F12打开开发者工具
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化存储
  initStore()

  // 初始化IPC通信
  initIPC()

  // 创建主窗口
  createWindow()

  // 初始化系统托盘
  initTray(mainWindow)

  // 初始化定时任务调度器
  initScheduler()

  app.on('activate', function () {
    // macOS 上点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 导出主窗口引用供其他模块使用
export function getMainWindow() {
  return mainWindow
}
