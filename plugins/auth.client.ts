// 客户端插件 - 处理认证
import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'

export default defineNuxtPlugin((nuxtApp) => {
  // 确保只在客户端(浏览器)环境中执行
  if (!process.client) {
    return
  }

  // 初始化认证状态
  nuxtApp.hook('app:created', () => {
    const auth = useAuth()
    auth.initAuth()
  })
  
  // 为所有API请求确保包含cookie并处理401错误
  nuxtApp.hook('app:mounted', () => {
    const originalFetch = window.fetch
    const errorHandler = useErrorHandler()
    
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      // 只处理本站API请求
      if (typeof input === 'string' && input.startsWith('/api')) {
        init = init || {}
        // 确保请求包含cookie
        init.credentials = 'include'
      }
      
      try {
        const response = await originalFetch(input, init)
        
        // 检查是否为401错误
        if (response.status === 401) {
          console.log('检测到401错误，URL:', input)
          await errorHandler.handle401Error('您的登录信息已失效，请重新登录')
          // 返回一个rejected promise以阻止后续处理
          return Promise.reject(new Error('Authentication expired'))
        }
        
        return response
      } catch (error) {
        throw error
      }
    }
    
    // 拦截$fetch和useFetch的错误
    const originalUseFetch = nuxtApp.$fetch
    if (originalUseFetch) {
      nuxtApp.$fetch = async function(request: any, options: any = {}) {
        try {
          return await originalUseFetch(request, options)
        } catch (error: any) {
          // 检查是否为401错误
          if (error?.status === 401 || error?.statusCode === 401) {
            console.log('$fetch检测到401错误，URL:', request)
            await errorHandler.handle401Error('您的登录信息已失效，请重新登录')
            throw error
          }
          throw error
        }
      }
    }
  })
  
  // 全局错误处理
  nuxtApp.hook('vue:error', async (error: any) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      const errorHandler = useErrorHandler()
      await errorHandler.handle401Error('您的登录信息已失效，请重新登录')
    }
  })
})