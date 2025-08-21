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
  const handle401Error = async (error: any) => {
    // 防抖机制：避免短时间内多次处理401错误
    if (isHandling401) {
      return
    }
    
    isHandling401 = true
    
    try {
      const currentPath = process.client ? window.location.pathname : ''
      
      // 检查是否在登录页面
      const isLoginPage = currentPath === '/login'
      
      if (isLoginPage) {
        // 在登录页面，解析具体错误信息
        let errorMessage = '登录失败'
        
        if (error?.data?.message) {
          errorMessage = error.data.message
        } else if (error?.message) {
          errorMessage = error.message
        }
        
        console.log('登录失败:', errorMessage)
        
        throw error // 重新抛出错误，让调用方处理
      } else {
        // 不在登录页面，仅显示错误提示，不强制登出
        console.log('检测到401错误，显示认证错误提示')
        
        let errorMessage = '认证失败，请检查您的登录状态'
        
        if (error?.data?.message) {
          errorMessage = error.data.message
        } else if (error?.message) {
          errorMessage = error.message
        }
        
        console.log('认证错误:', errorMessage)
        
        // 不执行强制登出，让用户自行决定是否重新登录
        console.log('401错误已处理，用户可继续使用或手动重新登录')
      }
    } finally {
      // 延迟重置防抖标志
      setTimeout(() => {
        isHandling401 = false
      }, 1000)
    }
  }
  
  /**
   * 检查响应是否为401错误并处理
   */
  const checkAndHandle401 = async (response: Response, error?: any) => {
    if (response.status === 401) {
      await handle401Error(error)
      return true
    }
    return false
  }
  
  /**
   * 检查useFetch错误是否为401并处理
   */
  const checkAndHandleFetchError = async (error: any) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      await handle401Error(error)
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