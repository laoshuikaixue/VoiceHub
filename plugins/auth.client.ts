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
          console.log('需要认证，但未找到令牌，重定向到登录页面')
          return next('/login')
        }
      }
      
      next()
    })
  })
  
  // 为所有API请求添加认证头
  nuxtApp.hook('app:mounted', () => {
    console.log('设置全局fetch拦截器，添加认证头')
    
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
            Object.assign(init.headers, {
              'Authorization': `Bearer ${token}`
            })
          }
          
          console.log(`API请求: ${input}，已添加认证头`)
        } else {
          console.log(`API请求: ${input}，无令牌可用`)
        }
      }
      
      return originalFetch(input, init)
    }
    
    // 添加全局请求拦截器
    const addAuthToRequest = (config: any) => {
      const token = localStorage.getItem('token')
      if (token && config && config.url && config.url.startsWith('/api')) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
        console.log(`请求: ${config.url}，已添加认证头`)
      }
      return config
    }
    
    // 尝试增强Nuxt的$fetch，但这需要在Nuxt 3中谨慎处理
    try {
      console.log('尝试增强Nuxt请求方法')
      
      // 这里不直接修改$fetch，因为这可能会导致类型错误
      // 而是在应用中建议使用useAuth中的getAuthHeader方法
    } catch (error) {
      console.error('增强Nuxt请求方法失败:', error)
    }
  })
  
  // 检查当前令牌是否有效
  const checkToken = () => {
    const token = localStorage.getItem('token')
    
    if (token) {
      console.log('发现存储的令牌，验证其有效性')
      
      // 使用专门的验证端点
      fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          console.warn('令牌验证失败，清除本地存储')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          
          // 如果当前在需要认证的页面，重定向到登录页面
          const currentPath = window.location.pathname
          if (currentPath.includes('/dashboard') || currentPath.includes('/change-password')) {
            window.location.href = '/login'
          }
        } else {
          console.log('令牌验证成功')
          return response.json()
        }
      })
      .then(data => {
        if (data && data.verified) {
          console.log('用户信息已验证:', data.name)
          
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
    }
  }
  
  // 在应用挂载后检查令牌
  nuxtApp.hook('app:mounted', () => {
    setTimeout(() => {
      checkToken()
    }, 1000) // 延迟检查，确保应用完全加载
  })
}) 