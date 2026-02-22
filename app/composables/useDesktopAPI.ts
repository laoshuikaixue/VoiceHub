/**
 * Desktop API Composable
 * 提供桌面端特有的API功能
 */

export const useDesktopAPI = () => {
  const isDesktop = ref(false)
  const apiBaseUrl = ref('')

  // 检测是否在Electron环境
  onMounted(() => {
    if (typeof window !== 'undefined' && window.electron) {
      isDesktop.value = true
      loadApiUrl()
    }
  })

  // 加载API地址
  const loadApiUrl = async () => {
    if (!window.electron) return
    try {
      const url = await window.electron.getApiUrl()
      apiBaseUrl.value = url
    } catch (error) {
      console.error('[Desktop] Failed to load API URL:', error)
    }
  }

  // 设置API地址
  const setApiUrl = async (url: string) => {
    if (!window.electron) return
    try {
      await window.electron.setApiUrl(url)
      apiBaseUrl.value = url
      return { success: true }
    } catch (error) {
      console.error('[Desktop] Failed to set API URL:', error)
      return { success: false, error }
    }
  }

  // 获取用户偏好
  const getPreferences = async () => {
    if (!window.electron) return null
    try {
      return await window.electron.getPreferences()
    } catch (error) {
      console.error('[Desktop] Failed to get preferences:', error)
      return null
    }
  }

  // 设置用户偏好
  const setPreferences = async (preferences: any) => {
    if (!window.electron) return
    try {
      await window.electron.setPreferences(preferences)
      return { success: true }
    } catch (error) {
      console.error('[Desktop] Failed to set preferences:', error)
      return { success: false, error }
    }
  }

  // 窗口控制
  const windowMinimize = () => {
    if (window.electron) {
      window.electron.windowMinimize()
    }
  }

  const windowMaximize = () => {
    if (window.electron) {
      window.electron.windowMaximize()
    }
  }

  const windowClose = () => {
    if (window.electron) {
      window.electron.windowClose()
    }
  }

  return {
    isDesktop,
    apiBaseUrl,
    loadApiUrl,
    setApiUrl,
    getPreferences,
    setPreferences,
    windowMinimize,
    windowMaximize,
    windowClose
  }
}
