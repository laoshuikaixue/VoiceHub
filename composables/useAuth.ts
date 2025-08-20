import { ref, computed } from 'vue'
import { navigateTo } from '#app'
import type { User } from '~/types'

const user = ref<User | null>(null)
const isAuthenticated = ref(false)
const isAdmin = ref(false)
const loading = ref(false)
let silentRefreshTimer: NodeJS.Timeout | null = null

export const useAuth = () => {
  // 验证服务器端认证状态
  const validateServerAuth = async (): Promise<boolean> => {
    if (!process.client) return false

    try {
      // 使用 useFetch 确保与 Nuxt 上下文和钩子正确集成
      const { data, error } = await useFetch<User>('/api/auth/me', {
        method: 'GET',
        // useFetch 默认会发送 cookie
      })

      if (error.value || !data.value) {
        return false
      }

      user.value = data.value
      isAuthenticated.value = true
      isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(data.value.role)
      localStorage.setItem('user', JSON.stringify(data.value))
      return true
    } catch (error) {
      console.error('Server auth validation failed:', error)
      return false
    }
  }

  // 从SSR payload或localStorage初始化用户状态
  const initAuth = async () => {
    const nuxtApp = useNuxtApp()

    // 1. 优先从SSR payload获取 (在服务器端渲染时)
    if (nuxtApp.payload.user) {
      user.value = nuxtApp.payload.user as User
      isAuthenticated.value = true
      isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.value.role)
      if (process.client) {
        startSilentRefresh()
      }
      return
    }

    // 2. 客户端从localStorage恢复状态并验证
    if (process.client) {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        if (await validateServerAuth()) {
          startSilentRefresh()
        } else {
          // 如果验证失败，则执行登出
          await logout(false) // 传递false避免重定向循环
        }
      }
    }
  }

  // 登录
  const login = async (username: string, password: string) => {
    loading.value = true
    try {
      const { data, error } = await useFetch('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })

      if (error.value) {
        const errorMessage = error.value.data?.message || error.value.statusMessage || '登录失败'
        throw new Error(errorMessage)
      }

      if (data.value) {
        const userData = data.value as any
        user.value = userData.user
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.user.role)

        // 强制更新 nuxtApp.payload 状态
        const nuxtApp = useNuxtApp()
        if (nuxtApp.payload) {
          nuxtApp.payload.user = userData.user
          nuxtApp.payload.isAuthenticated = true
          nuxtApp.payload.isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.user.role)
        }

        if (process.client) {
          localStorage.setItem('user', JSON.stringify(userData.user))
          startSilentRefresh()
          
          const route = useRoute()
          const redirectPath = route.query.redirect?.toString() || '/'
          await navigateTo(redirectPath, { replace: true })
        }
        return userData
      }
    } catch (e: any) {
      // 重新抛出错误，以便UI层可以捕获并显示
      throw e
    } finally {
      loading.value = false
    }
  }

  // 修改密码
  const changePassword = async (currentPassword: string, newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      })
      // 密码修改成功后，可以考虑重新验证用户或显示成功消息
    } catch (error: any) {
      const errorMessage = error.data?.message || '密码修改失败'
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  // 注销
  const logout = async (redirect = true) => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Server-side logout failed:', error)
    }

    user.value = null
    isAuthenticated.value = false
    isAdmin.value = false

    // 清理 nuxtApp.payload 中的用户信息
    const nuxtApp = useNuxtApp()
    if (nuxtApp.payload) {
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
    }

    if (process.client) {
      localStorage.removeItem('user')
      stopSilentRefresh()
      
      // 清理缓存
      clearNuxtData()
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }

      if (redirect) {
        await navigateTo('/login')
      }
    }
  }

  // 静默刷新令牌
  const silentRefresh = async () => {
    try {
      // 调用一个轻量级的端点来验证和刷新cookie
      await $fetch('/api/auth/verify', { method: 'GET' })
    } catch (error) {
      // 如果刷新失败，则登出用户
      await logout()
    }
  }

  // 启动静默刷新定时器
  const startSilentRefresh = () => {
    if (silentRefreshTimer) {
      clearInterval(silentRefreshTimer)
    }
    // 每15分钟刷新一次
    silentRefreshTimer = setInterval(silentRefresh, 15 * 60 * 1000)
  }

  // 停止静默刷新
  const stopSilentRefresh = () => {
    if (silentRefreshTimer) {
      clearInterval(silentRefreshTimer)
      silentRefreshTimer = null
    }
  }

  // 获取认证头信息 - 支持多种认证方式
  const getAuthHeader = (): { headers: Record<string, string> } => {
    try {
      // 主要认证方式：httpOnly cookie（浏览器自动处理）
      // 对于需要手动设置头部的场景，我们提供兼容性支持
      
      if (!process.client || !isAuthenticated.value) {
        return { headers: {} }
      }

      // 尝试从localStorage获取用户信息作为备用验证
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        return { headers: {} }
      }

      // 对于某些特殊的API调用，可能需要显式的认证头
      // 但主要还是依赖httpOnly cookie
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // 如果有存储的token信息，可以添加到Authorization头中
      // 注意：这主要是为了向后兼容，实际认证仍依赖cookie
      try {
        const userData = JSON.parse(storedUser)
        if (userData && userData.id) {
          // 添加用户ID到自定义头中，某些API可能需要
          headers['X-User-ID'] = userData.id.toString()
        }
      } catch (e) {
        console.warn('Failed to parse stored user data:', e)
      }

      return { headers }
    } catch (error) {
      console.error('Error getting auth header:', error)
      return { headers: {} }
    }
  }

  // 向后兼容：计算属性形式的认证头
  const authHeader = computed(() => getAuthHeader().headers)

  return {
    user,
    isAuthenticated,
    isAdmin,
    loading,
    login,
    logout,
    changePassword,
    initAuth,
    authHeader,
    getAuthHeader,
    validateServerAuth,
    startSilentRefresh,
    stopSilentRefresh
  }
}
