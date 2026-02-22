import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function initTray(mainWindow: BrowserWindow | null) {
  // 创建托盘图标 - 使用简单的方式
  try {
    tray = new Tray(nativeImage.createEmpty())
  } catch (error) {
    console.error('[Tray] Failed to create tray:', error)
    return
  }
  
  // 设置托盘提示
  tray.setToolTip('VoiceHub 桌面客户端')
  
  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: '播放控制',
      submenu: [
        {
          label: '播放/暂停',
          click: () => {
            mainWindow?.webContents.send('tray-play-pause')
          }
        },
        {
          label: '上一首',
          click: () => {
            mainWindow?.webContents.send('tray-previous')
          }
        },
        {
          label: '下一首',
          click: () => {
            mainWindow?.webContents.send('tray-next')
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '桌面歌词',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        mainWindow?.webContents.send('toggle-desktop-lyric', menuItem.checked)
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
  
  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  
  console.log('[Tray] System tray initialized')
}

export function updateTrayMenu(updates: { desktopLyric?: boolean }) {
  if (!tray) return
  
  const menu = tray.getContextMenu()
  if (!menu) return
  
  if (updates.desktopLyric !== undefined) {
    const lyricItem = menu.items.find(item => item.label === '桌面歌词')
    if (lyricItem) {
      lyricItem.checked = updates.desktopLyric
    }
  }
}
