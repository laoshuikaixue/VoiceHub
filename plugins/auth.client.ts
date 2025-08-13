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
  
  // 为所有API请求确保包含cookie
  nuxtApp.hook('app:mounted', () => {
    const originalFetch = window.fetch
    
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
          const auth = useAuth()
          const currentPath = window.location.pathname
          
          // 如果当前在需要认证的页面，执行登出并重定向
          if (currentPath.includes('/dashboard') || currentPath.includes('/change-password')) {
            await auth.logout()
            window.location.href = '/login?message=您的登录信息已失效，请重新登录'
          }
        }
        
        return response
      } catch (error) {
        throw error
      }
    }
  })
  
  // 认证状态检查已集成到fetch拦截器中，无需额外的定时检查
})