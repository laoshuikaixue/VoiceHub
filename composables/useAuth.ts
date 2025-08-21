import { useState, navigateTo } from '#app'
import type { User } from '~/types'

export const useAuth = () => {
  const user = useState<User | null>('user', () => null)
  const token = useState<string | null>('token', () => null)
  const isAuthenticated = useState<boolean>('isAuthenticated', () => false)
  const isAdmin = useState<boolean>('isAdmin', () => false)
  const loading = useState<boolean>('loading', () => false)

  const clearAuthState = () => {
    user.value = null
    token.value = null
    isAuthenticated.value = false
    isAdmin.value = false
  }

  const initAuth = async () => {
    // 客户端执行
    if (typeof window === 'undefined' || process.server) {
      return
    }

    // 已认证跳过
    if (isAuthenticated.value && user.value) {
      return
    }

    try {
      const data = await $fetch<{ user: User }>('/api/auth/verify')
      
      if (data && data.user) {
        user.value = data.user
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(data.user.role)
        token.value = 'cookie-based'
      } else {
        clearAuthState()
      }
    } catch (error) {
      console.log('用户未认证或认证已过期')
      clearAuthState()
    }
  }

  const login = async (username: string, password: string) => {
    const response = await $fetch<{ success: boolean, user: User }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    
    if (response.success && response.user) {
      token.value = 'cookie-based'
      user.value = response.user
      isAuthenticated.value = true
      isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(response.user.role)
      return response
    } else {
      throw new Error('登录响应格式错误')
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
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
      })
      if (user.value) {
        user.value.needsPasswordChange = false
      }
    } finally {
      loading.value = false
    }
  }

  const refreshUser = async () => {
    const data = await $fetch<{ user: User }>('/api/auth/verify')
    if (data && data.user) {
      user.value = data.user
      isAuthenticated.value = true
      isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(data.user.role)
    }
  }

  const logout = async (redirect = true) => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      // 忽略登出错误
    }

    clearAuthState()

    if (process.client && redirect) {
      await navigateTo('/')
    }
  }

  const getAuthConfig = () => {
    // 返回认证配置
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
    getAuthConfig,
  }
}
