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
        console.error('请求错误:', error)
        throw error
      }
    }
  })
  
  // 检查当前认证状态是否有效（现在主要依赖cookie）
  const checkAuth = async () => {
    try {
      // 使用专门的验证端点（现在依赖cookie认证）
      const response = await fetch('/api/auth/verify', {
        credentials: 'include' // 确保包含cookie
      })
      
      if (!response.ok) {
        const auth = useAuth()
        
        // 如果当前在需要认证的页面，执行登出并重定向
        const currentPath = window.location.pathname
        if (currentPath.includes('/dashboard') || currentPath.includes('/change-password')) {
          await auth.logout()
          window.location.href = '/login?message=登录信息已失效，请重新登录'
        }
        
        throw new Error('Auth validation failed')
      }
      
      const data = await response.json()
      if (data && data.verified) {
        // 认证有效，可以进行其他操作
        console.log('认证验证成功')
      }
    } catch (error) {
      console.error('认证验证出错:', error)
    }
  }
  
  // 在应用挂载后检查认证状态
  nuxtApp.hook('app:mounted', () => {
    setTimeout(() => {
      checkAuth()
    }, 500) // 延迟检查，确保应用完全加载
  })
})