import { navigateTo } from '#app'

export const useErrorHandler = () => {
  /**
   * 处理401认证失效错误
   * 清除所有认证信息并重定向到首页
   */
  const handle401Error = async (message?: string) => {
    console.log('检测到401错误，清除认证信息并重定向')
    
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
    
    // 调用服务器端logout API清除cookie
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
    const auth = useAuth()
    auth.user.value = null
    auth.isAuthenticated.value = false
    auth.isAdmin.value = false
    
    // 重定向到首页并显示提示信息
    const redirectMessage = message || '您的登录信息已失效，请重新登录'
    
    if (process.client) {
      // 客户端重定向
      const timestamp = new Date().getTime()
      window.location.href = `/?message=${encodeURIComponent(redirectMessage)}&t=${timestamp}`
    } else {
      // 服务端重定向
      await navigateTo(`/?message=${encodeURIComponent(redirectMessage)}`)
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