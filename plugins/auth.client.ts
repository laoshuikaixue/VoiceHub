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
      if (to.path.includes('/dashboard')) {
        const token = localStorage.getItem('token')
        if (!token) {
          return next('/login')
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
          Object.assign(init.headers, {
            'Authorization': `Bearer ${token}`
          })
        }
      }
      
      return originalFetch(input, init)
    }
  })
}) 