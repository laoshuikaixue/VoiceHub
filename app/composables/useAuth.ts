import { navigateTo, useState } from '#app'
import type { User } from '~/types'
import { useUserFilters } from '~/composables/useUserFilters'
import { isAdminRole } from '~/utils/auth-constants'

interface LoginResponse {
  success: boolean
  user?: User
  requires2FA?: boolean
  userId?: number
  methods?: string[]
  tempToken?: string // 预认证临时令牌
}

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

  const setAuthState = (loggedInUser: User) => {
    token.value = 'cookie-based'
    user.value = loggedInUser
    isAuthenticated.value = true
    isAdmin.value = isAdminRole(loggedInUser.role)
  }

  /** 设置完整 profile（login / verify2FA 返回的完整用户数据） */
  const setFullAuthState = (loggedInUser: User) => {
    setAuthState({ ...loggedInUser, _isFullProfile: true })
  }

  const initAuth = async () => {
    // 客户端执行
    if (typeof window === 'undefined' || import.meta.server) {
      return null
    }

    // 若 SSR 中间件仅写入了"部分用户视图"（缺 has2FA / avatar 等需要 identities 关联查询的字段），
    // 客户端 hydration 后需主动请求 verify 接口补全完整字段；否则直接复用已有状态避免重复请求。
    if (isAuthenticated.value && user.value && user.value._isFullProfile) {
      return user.value
    }

    try {
      const data = await $fetch<{ user: User }>('/api/auth/verify', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (data && data.user) {
        user.value = { ...data.user, _isFullProfile: true }
        isAuthenticated.value = true
        isAdmin.value = isAdminRole(data.user.role)
        token.value = 'cookie-based'
        return user.value
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
        setFullAuthState(response.user)
        return response
      }
    }

    throw new Error('登录响应格式错误')
  }

  const verify2FA = async (userId: number, code: string, type: 'totp' | 'email', tempToken?: string) => {
    const response = await $fetch<{ success: boolean; user: User }>('/api/auth/2fa/verify', {
      method: 'POST',
      body: { userId, code, type, token: tempToken }
    })

    if (response.success && response.user) {
      setFullAuthState(response.user)
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
      // 改密成功后立即清除强制改密标志，避免前端中间件继续拦截
      if (user.value) {
        user.value.requirePasswordChange = false
        user.value.passwordChangedAt = new Date().toISOString()
      }
    } catch (error: any) {
      // 处理 FetchError，提取错误信息（优先使用 message）
      if (error.data && error.data.message) {
        throw new Error(error.data.message)
      } else if (error.data && error.data.statusMessage) {
        throw new Error(error.data.statusMessage)
      } else if (error.message) {
        throw new Error(error.message)
      } else if (error.statusMessage) {
        throw new Error(error.statusMessage)
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
        user.value.requirePasswordChange = false
        user.value.hasSetPassword = true
        user.value.passwordChangedAt = new Date().toISOString()
      }
    } finally {
      loading.value = false
    }
  }

  const refreshUser = async () => {
    const data = await $fetch<{ user: User }>('/api/auth/verify')
    if (data && data.user) {
      setFullAuthState(data.user)
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
    getAuthConfig,
    // 暴露内部状态更新方法，供中间件等外部场景复用，避免重复实现 isAdmin 判断逻辑
    setAuthState,
    clearAuthState
  }
}
