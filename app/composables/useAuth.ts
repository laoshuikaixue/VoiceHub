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

    // 如果已认证，直接返回缓存的用户信息
    if (isAuthenticated.value && user.value) {
      return user.value
    }

    try {
      const data = await $fetch<{ user: User }>('/api/auth/verify', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

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
    } catch (error: any) {
      const hadAuth = isAuthenticated.value
      
      // 只有当之前是已认证状态，且接口明确返回401（Token无效/过期），才进行清理和跳转
      if (hadAuth && error.statusCode === 401) {
         clearAuthState()
         // Token失效，重定向到登录页
         await navigateTo('/auth/login?error=SessionExpired')
      } else if (!hadAuth && error.statusCode === 401) {
        // 未登录状态下的 401，仅确保状态清理，不跳转
        clearAuthState()
      }
      return null
    }
  }

  const login = async (username: string, password: string) => {
    const response = await $fetch<any>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })

    if (response.success) {
      if (response.requires2FA) {
        return response
      }

      if (response.user) {
        token.value = 'cookie-based'
        user.value = response.user
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(response.user.role)
        return response
      }
    }

    throw new Error('登录响应格式错误')
  }

  const verify2FA = async (userId: number, code: string, type: 'totp' | 'email') => {
    const response = await $fetch<{ success: boolean; user: User }>('/api/auth/2fa/verify', {
      method: 'POST',
      body: { userId, code, type }
    })

    if (response.success && response.user) {
      token.value = 'cookie-based'
      user.value = response.user
      isAuthenticated.value = true
      isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(response.user.role)
      return response
    }
    throw new Error('验证失败')
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
    verify2FA,
    logout,
    changePassword,
    setInitialPassword,
    refreshUser,
    initAuth,
    getAuthConfig
  }
}
