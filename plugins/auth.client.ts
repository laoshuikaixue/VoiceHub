// 客户端插件 - 处理认证
import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'

export default defineNuxtPlugin((nuxtApp) => {
  // 确保只在客户端(浏览器)环境中执行
  if (!process.client) {
    return
  }

  // 拦截请求，添加认证头
  nuxtApp.hook('app:created', () => {
    const { vueApp } = nuxtApp

    // 监听路由变化
    const router = nuxtApp.$router as Router
    router.beforeEach((
      to: RouteLocationNormalized, 
      from: RouteLocationNormalized, 
      next: NavigationGuardNext
    ) => {
      // 检查是否需要认证的路由
      if (to.path.includes('/dashboard') || to.path.includes('/change-password')) {
        const token = localStorage.getItem('token')
        if (!token) {
          return next('/login')
        }
        
        // 检查是否是首次登录，并且不是前往修改密码页面
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (user.firstLogin && to.path !== '/change-password') {
          return next('/change-password')
        }
      }
      
      next()
    })
  })
  
  // 为所有API请求添加认证头
  nuxtApp.hook('app:mounted', () => {
    const originalFetch = window.fetch
    
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      // 只处理本站API请求
      if (typeof input === 'string' && input.startsWith('/api')) {
        const token = localStorage.getItem('token')
        
        if (token) {
          init = init || {}
          init.headers = init.headers || {}
          
          // 确保headers是Headers对象或普通对象
          if (init.headers instanceof Headers) {
            init.headers.set('Authorization', `Bearer ${token}`)
          } else {
            // 使用展开运算符创建新对象，避免修改原始对象
            init.headers = {
              ...init.headers,
              'Authorization': `Bearer ${token}`
            }
          }
        } else {
          // 如果是需要认证的API端点，并且当前路径是需要认证的页面，重定向到登录页面
          if (
            (input.includes('/api/admin') || 
             input.includes('/api/songs') && !input.includes('/public')) && 
            (window.location.pathname.includes('/dashboard') || 
             window.location.pathname.includes('/change-password'))
          ) {
            setTimeout(() => {
              window.location.href = '/login?message=请先登录'
            }, 100)
          }
        }
      }
      
      try {
        const response = await originalFetch(input, init)
        
        // 检查是否为401错误，特别检查是否是无效令牌
        if (response.status === 401) {
          try {
            const errorData = await response.clone().json()
            
            // 如果是无效令牌错误，清除本地存储
            if (errorData && errorData.data && errorData.data.invalidToken) {
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              
              // 如果当前在需要认证的页面，重定向到登录页面
              const currentPath = window.location.pathname
              if (currentPath.includes('/dashboard') || currentPath.includes('/change-password')) {
                window.location.href = '/login?message=您的登录信息已失效，请重新登录'
              }
            } else {
              // 即使没有明确的invalidToken标志，如果是管理员页面收到401，也应该重定向
              const currentPath = window.location.pathname
              if (currentPath.includes('/dashboard') && typeof input === 'string' && input.includes('/api/admin')) {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                window.location.href = '/login?message=请重新登录'
              }
            }
          } catch (e) {
            // 保守处理：如果是管理员页面收到401，重定向到登录页面
            const currentPath = window.location.pathname
            if (currentPath.includes('/dashboard')) {
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              window.location.href = '/login?message=请重新登录'
            }
          }
        }
        
        return response
      } catch (error) {
        console.error('请求错误:', error)
        throw error
      }
    }
  })
  
  // 检查当前令牌是否有效
  const checkToken = () => {
    const token = localStorage.getItem('token')
    
    if (token) {
      // 使用专门的验证端点
      fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          
          // 如果当前在需要认证的页面，重定向到登录页面
          const currentPath = window.location.pathname
          if (currentPath.includes('/dashboard') || currentPath.includes('/change-password')) {
            window.location.href = '/login?message=登录信息已失效，请重新登录'
          }
          
          throw new Error('Token validation failed')
        }
        return response.json()
      })
      .then(data => {
        if (data && data.verified) {
          // 更新本地存储的用户信息
          const storedUser = localStorage.getItem('user')
          if (storedUser) {
            const user = JSON.parse(storedUser)
            // 合并最新的用户信息
            const updatedUser = { ...user, ...data }
            localStorage.setItem('user', JSON.stringify(updatedUser))
          }
        }
      })
      .catch(error => {
        console.error('令牌验证出错:', error)
      })
    } else if (window.location.pathname.includes('/dashboard')) {
      // 如果没有令牌但在管理员页面，重定向到登录页面
      window.location.href = '/login?message=请先登录'
    }
  }
  
  // 在应用挂载后检查令牌
  nuxtApp.hook('app:mounted', () => {
    setTimeout(() => {
      checkToken()
    }, 500) // 延迟检查，确保应用完全加载
  })
}) 