import { navigateTo } from '#app'

// 防抖机制：避免短时间内多次处理401错误
let isHandling401 = false
let lastHandle401Time = 0
const HANDLE_401_DEBOUNCE_TIME = 2000 // 2秒内只处理一次401错误

export const useErrorHandler = () => {
  /**
   * 处理401认证失效错误
   * 区分登录失败和认证失效，只有在已登录状态下才执行完整的logout流程
   */
  const handle401Error = async (message?: string, skipLogout = false) => {
    const now = Date.now()
    
    // 防抖：如果正在处理401错误或距离上次处理时间太短，则跳过
    if (isHandling401 || (now - lastHandle401Time < HANDLE_401_DEBOUNCE_TIME)) {
      console.log('401错误处理被防抖机制跳过')
      return
    }
    
    isHandling401 = true
    lastHandle401Time = now
    
    try {
      // 检查当前页面和用户状态
      const currentPath = process.client ? window.location.pathname : ''
      const auth = useAuth()
      const isCurrentlyLoggedIn = auth.isAuthenticated.value
      
      // 如果在登录页面或明确指定跳过logout，只清除本地状态，不调用logout API
      if (currentPath === '/login' || skipLogout || !isCurrentlyLoggedIn) {
        console.log('在登录页面或未登录状态，跳过logout API调用')
        
        // 只清除本地认证状态，不调用服务器logout
        if (process.client) {
          localStorage.removeItem('user')
        }
        
        // 重置认证状态
        auth.user.value = null
        auth.isAuthenticated.value = false
        auth.isAdmin.value = false
        
        return
      }
      
      console.log('检测到已登录用户的401错误，执行完整logout流程')
      
      // 清除localStorage中的用户信息
      if (process.client) {
        localStorage.removeItem('user')
        
        // 清除所有相关的缓存
        if ('caches' in window) {
          try {
            const cacheNames = await caches.keys()
            await Promise.all(cacheNames.map(name => caches.delete(name)))
          } catch (error) {
            console.warn('清除缓存失败:', error)
          }
        }
      }
      
      // 调用服务器端logout API（仅在已登录状态下）
      try {
        await $fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
      } catch (error) {
        console.warn('服务器端登出失败:', error)
      }
      
      // 重置认证状态
      auth.user.value = null
      auth.isAuthenticated.value = false
      auth.isAdmin.value = false
      
      // 智能重定向：只有在非首页时才重定向
      const redirectMessage = message || '您的登录信息已失效，请重新登录'
      
      if (process.client) {
        // 如果当前已经在首页，只显示消息，不重定向
        if (currentPath === '/') {
          console.log('已在首页，显示登录失效消息:', redirectMessage)
          return
        }
        
        // 使用客户端路由跳转，避免强制刷新
        await navigateTo(`/?message=${encodeURIComponent(redirectMessage)}`)
      } else {
        // 服务端重定向
        await navigateTo(`/?message=${encodeURIComponent(redirectMessage)}`)
      }
    } finally {
      // 重置防抖标志
      setTimeout(() => {
        isHandling401 = false
      }, 1000)
    }
  }
  
  /**
   * 检查响应是否为401错误并处理
   */
  const checkAndHandle401 = async (response: Response, customMessage?: string) => {
    if (response.status === 401) {
      await handle401Error(customMessage)
      return true
    }
    return false
  }
  
  /**
   * 检查useFetch错误是否为401并处理
   */
  const checkAndHandleFetchError = async (error: any, customMessage?: string) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      await handle401Error(customMessage)
      return true
    }
    return false
  }
  
  return {
    handle401Error,
    checkAndHandle401,
    checkAndHandleFetchError
  }
}