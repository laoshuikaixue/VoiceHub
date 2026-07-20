import { navigateTo, useState } from '#app'
import type { User } from '~/types'
import { useUserFilters } from '~/composables/useUserFilters'

interface LoginResponse {
  success: boolean
  user?: User
  requires2FA?: boolean
  userId?: number
  methods?: string[]
  tempToken?: string // 预认证临时令牌
}

interface PasswordChangeResponse {
  passwordChangedAt?: string
}

const AUTH_STATE_TTL_MS = 30 * 1000

export const useAuth = () => {
  const user = useState<User | null>('user', () => null)
  const token = useState<string | null>('token', () => null)
  const isAuthenticated = useState<boolean>('isAuthenticated', () => false)
  const isAdmin = useState<boolean>('isAdmin', () => false)
  const loading = useState<boolean>('loading', () => false)
  const lastAuthVerifiedAt = useState<number>('lastAuthVerifiedAt', () => 0)

  const clearAuthState = () => {
    user.value = null
    token.value = null
    isAuthenticated.value = false
    isAdmin.value = false
    lastAuthVerifiedAt.value = 0
  }

  const setAuthState = (loggedInUser: User) => {
    token.value = 'cookie-based'
    user.value = loggedInUser
    isAuthenticated.value = true
    isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(loggedInUser.role)
    lastAuthVerifiedAt.value = Date.now()
  }

  const initAuth = async (forceRefresh = false) => {
    // 客户端执行
    if (typeof window === 'undefined' || import.meta.server) {
      return null
    }

    // 短时间内复用认证结果，避免每次客户端导航都串行查询数据库。
    if (
      !forceRefresh &&
      isAuthenticated.value &&
      user.value &&
      Date.now() - lastAuthVerifiedAt.value < AUTH_STATE_TTL_MS
    ) {
      return user.value
    }

    try {
      const data = await $fetch<{ user: User }>('/api/auth/verify', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (data && data.user) {
        setAuthState(data.user)
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
        await navigateTo('/login?error=SessionExpired')
      } else if (!hadAuth && error.statusCode === 401) {
        // 未登录状态下的 401，仅确保状态清理，不跳转
        clearAuthState()
      } else if (hadAuth) {
        // 临时网络故障时短暂保留现有状态，避免每次导航重复冲击认证接口。
        lastAuthVerifiedAt.value = Date.now()
      }
      return null
    }
  }

  const login = async (username: string, password: string) => {
    const response = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })

    if (response.success) {
      if (response.requires2FA) {
        return response
      }

      if (response.user) {
        setAuthState(response.user)
        return response
      }
    }

    throw new Error('登录响应格式错误')
  }

  const verify2FA = async (
    userId: number,
    code: string,
    type: 'totp' | 'email',
    tempToken?: string
  ) => {
    const response = await $fetch<{ success: boolean; user: User }>('/api/auth/2fa/verify', {
      method: 'POST',
      body: { userId, code, type, token: tempToken }
    })

    if (response.success && response.user) {
      setAuthState(response.user)
      return response
    }
    throw new Error('验证失败')
  }

  const refreshUser = async () => {
    const data = await $fetch<{ user: User }>('/api/auth/verify')
    if (data?.user) {
      setAuthState(data.user)
      return data.user
    }
    return null
  }

  const syncPasswordChangeState = async (
    response: PasswordChangeResponse,
    refreshFailureMessage: string
  ) => {
    if (user.value) {
      user.value.requirePasswordChange = false
      user.value.forcePasswordChange = false
      user.value.passwordChangedAt = response.passwordChangedAt || null
      user.value.hasSetPassword = true
      user.value.needsInitialPasswordSetup = false
    }

    try {
      await refreshUser()
    } catch (error) {
      console.warn(refreshFailureMessage, error)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    loading.value = true
    try {
      const response = await $fetch<PasswordChangeResponse>('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword }
      })
      await syncPasswordChangeState(response, '密码修改成功，但刷新用户状态失败:')
    } catch (error: any) {
      throw new Error(
        error?.data?.message ||
          error?.data?.statusMessage ||
          error?.message ||
          error?.statusMessage ||
          '密码修改失败，请重试'
      )
    } finally {
      loading.value = false
    }
  }

  const setInitialPassword = async (newPassword: string) => {
    loading.value = true
    try {
      const response = await $fetch<PasswordChangeResponse>('/api/auth/set-initial-password', {
        method: 'POST',
        body: { newPassword }
      })
      await syncPasswordChangeState(response, '初始密码设置成功，但刷新用户状态失败:')
    } finally {
      loading.value = false
    }
  }

  const logout = async (redirect = true) => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      // 忽略登出错误
    }

    clearAuthState()

    // 清理 admin 相关全局状态
    try {
      const { resetUserFilters } = useUserFilters()
      resetUserFilters()
    } catch (e) {
      // ignore
    }

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

  const getToken = () => {
    // httpOnly cookie 模式下客户端不能读取真实 JWT，调用方应依赖同源 cookie。
    if (token.value === 'cookie-based') {
      return null
    }

    return token.value
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
    getToken,
    getAuthConfig
  }
}
