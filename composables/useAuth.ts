import { ref } from 'vue'
import { navigateTo } from '#app'
import type { User } from '~/types'

const user = ref<User | null>(null)
const token = ref<string | null>(null)
const isAuthenticated = ref(false)
const isAdmin = ref(false)
const loading = ref(false)

export const useAuth = () => {
  // 清除认证状态
  const clearAuthState = () => {
    user.value = null
    token.value = null
    isAuthenticated.value = false
    isAdmin.value = false
    
    // 注意：httpOnly cookie无法通过JavaScript清除，需要通过服务器端清除
    // 这里只清除客户端状态
  }
  
  // 初始化认证状态
  const initAuth = async () => {
    if (typeof window === 'undefined') return
    
    try {
      // 尝试获取当前用户信息来验证认证状态
      // 如果cookie中有有效的JWT，服务器会返回用户信息
      const userData = await $fetch('/api/auth/verify', {
        credentials: 'include'
      })
      
      if (userData && userData.id) {
        user.value = userData
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.role)
        // token现在存储在httpOnly cookie中，客户端不需要直接访问
        token.value = 'cookie-based' // 标识使用cookie认证
      } else {
        clearAuthState()
      }
    } catch (error) {
      console.log('用户未认证或认证已过期')
      clearAuthState()
    }
  }

  // 登录
  const login = async (username: string, password: string) => {
    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include', // 确保cookie会被设置
        body: {
          username,
          password
        }
      })
      
      if (response.success && response.user) {
        // 更新状态 - token现在存储在httpOnly cookie中
        token.value = 'cookie-based' // 标识使用cookie认证
        user.value = response.user
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(response.user.role)
        
        return response
      } else {
        throw new Error('登录响应格式错误')
      }
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        ...getAuthConfig()
      })
    } finally {
      loading.value = false
    }
  }

  const setInitialPassword = async (newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/set-initial-password', {
        method: 'POST',
        body: { newPassword },
        ...getAuthConfig()
      })
      if (user.value) {
        user.value.needsPasswordChange = false
      }
    } finally {
      loading.value = false
    }
  }

  const refreshUser = async () => {
    const userData = await $fetch('/api/auth/verify', getAuthConfig())
    user.value = userData
    isAuthenticated.value = true
    isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.role)
  }

  const logout = async (redirect = true) => {
    try {
      await $fetch('/api/auth/logout', { 
        method: 'POST',
        ...getAuthConfig()
      })
    } catch (error) {
      // Ignore server-side logout errors
    }

    clearAuthState()

    if (process.client && redirect) {
      await navigateTo('/login')
    }
  }

  // 获取认证配置（现在主要是确保cookie会被发送）
  const getAuthConfig = () => {
    return {
      credentials: 'include' as RequestCredentials
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    loading,
    login,
    logout,
    changePassword,
    setInitialPassword,
    refreshUser,
    initAuth,
    getAuthConfig
  }
}
