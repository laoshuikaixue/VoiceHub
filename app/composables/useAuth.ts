import { navigateTo, useState } from '#app'
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
    if (typeof window === 'undefined' || import.meta.server) {
      return null
    }

    // 已认证跳过，但仍返回用户信息
    if (isAuthenticated.value && user.value) {
      return user.value
    }

    try {
      const data = await $fetch<{ user: User }>('/api/auth/verify')

      if (data && data.user) {
        user.value = data.user
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(data.user.role)
        token.value = 'cookie-based'
        return data.user
      } else {
        clearAuthState()
        return null
      }
    } catch (error) {
      console.log('用户未认证或认证已过期')
      clearAuthState()
      return null
    }
  }

  const login = async (username: string, password: string) => {
    const response = await $fetch<{ success: boolean; user: User }>('/api/auth/login', {
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
        body: { currentPassword, newPassword }
      })
    } catch (error: any) {
      // 处理FetchError，提取错误信息
      if (error.data && error.data.statusMessage) {
        throw new Error(error.data.statusMessage)
      } else if (error.data && error.data.message) {
        throw new Error(error.data.message)
      } else if (error.statusMessage) {
        throw new Error(error.statusMessage)
      } else if (error.message) {
        throw new Error(error.message)
      } else {
        throw new Error('密码修改失败，请重试')
      }
    } finally {
      loading.value = false
    }
  }

  const setInitialPassword = async (newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/set-initial-password', {
        method: 'POST',
        body: { newPassword }
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

    if (import.meta.client && redirect) {
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
    getAuthConfig
  }
}
