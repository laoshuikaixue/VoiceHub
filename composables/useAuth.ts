import { ref } from 'vue'
import { navigateTo } from '#app'
import type { User } from '~/types'

const user = ref<User | null>(null)
const token = ref<string | null>(null)
const isAuthenticated = ref(false)
const isAdmin = ref(false)
const loading = ref(false)

export const useAuth = () => {
  const clearAuthState = () => {
    user.value = null
    token.value = null
    isAuthenticated.value = false
    isAdmin.value = false
    
    if (process.client) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('isAdmin')
      localStorage.removeItem('currentUserId')
    }
  }
  
  const initAuth = async () => {
    if (!process.client) return
    
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('auth_token')
    const storedAuth = localStorage.getItem('isAuthenticated')
    const storedAdmin = localStorage.getItem('isAdmin')
    
    if (storedUser && storedToken && storedAuth === 'true') {
      try {
        const parsedUser = JSON.parse(storedUser)
        user.value = parsedUser
        token.value = storedToken
        isAuthenticated.value = true
        isAdmin.value = storedAdmin === 'true'
      } catch (error) {
        clearAuthState()
      }
    } else {
      clearAuthState()
    }
  }

  const login = async (username: string, password: string) => {
    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })
      
      if (response.user && response.token) {
        user.value = response.user
        token.value = response.token
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(response.user.role)
        
        localStorage.setItem('auth_token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('isAdmin', isAdmin.value.toString())
        localStorage.setItem('currentUserId', response.user.id.toString())
        
        return response
      }
    } catch (error: any) {
      // 重新抛出错误，保持原始错误信息
      // 这样前端组件就能接收到服务器返回的具体错误信息
      throw error
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        ...getAuthHeader()
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
        ...getAuthHeader()
      })
      if (user.value) {
        user.value.needsPasswordChange = false
      }
    } finally {
      loading.value = false
    }
  }

  const refreshUser = async () => {
    const userData = await $fetch('/api/auth/verify', getAuthHeader())
    user.value = userData
    isAuthenticated.value = true
    isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.role)
    
    if (process.client) {
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('currentUserId', userData.id.toString())
    }
  }

  const logout = async (redirect = true) => {
    try {
      await $fetch('/api/auth/logout', { 
        method: 'POST',
        ...getAuthHeader()
      })
    } catch (error) {
      // Ignore server-side logout errors
    }

    clearAuthState()

    if (process.client && redirect) {
      await navigateTo('/login')
    }
  }

  const getAuthHeader = (): { headers: Record<string, string> } => {
    const authToken = token.value || (process.client ? localStorage.getItem('auth_token') : null)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    
    return {
      headers
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
    getAuthHeader
  }
}
