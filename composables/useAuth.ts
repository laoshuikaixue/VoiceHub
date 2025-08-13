import { ref } from 'vue'
import type { User } from '~/types'

export const useAuth = () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isAdmin = ref(false)
  const loading = ref(false)

  // 从SSR payload或localStorage初始化用户状态
  const initAuth = () => {
    // 首先尝试从SSR payload获取用户信息
    const nuxtApp = useNuxtApp()
    if (nuxtApp.payload.user && nuxtApp.payload.isAuthenticated) {
      user.value = nuxtApp.payload.user as User
      isAuthenticated.value = nuxtApp.payload.isAuthenticated
      isAdmin.value = nuxtApp.payload.isAdmin || false
      
      // 同步到localStorage（仅客户端）
      if (process.client) {
        localStorage.setItem('user', JSON.stringify(nuxtApp.payload.user))
      }
      return
    }
    
    // 如果没有SSR payload，则从localStorage获取（仅客户端）
    if (process.client) {
      const storedUser = localStorage.getItem('user')

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User
          user.value = parsedUser
          isAuthenticated.value = true
          isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(parsedUser.role)
        } catch (error) {
          // 清除无效的存储数据
          localStorage.removeItem('user')
          user.value = null
          isAuthenticated.value = false
          isAdmin.value = false
        }
      } else {
        user.value = null
        isAuthenticated.value = false
        isAdmin.value = false
      }
    }
  }

  // 登录
  const login = async (username: string, password: string) => {
    loading.value = true
    try {
      const { data, error } = await useFetch('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })

      if (error.value) {
        // 获取服务器返回的详细错误信息
        const errorMessage = error.value.data?.message || error.value.statusMessage || '登录失败'
        throw new Error(errorMessage)
      }

      if (data.value) {
        const userData = data.value as any
        user.value = userData.user
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.user.role)

        // 确保只在客户端环境中存储数据
        if (process.client) {
          // 存储用户信息到localStorage作为备份
          localStorage.setItem('user', JSON.stringify(userData.user))
          
          // 刷新页面以确保认证状态生效
          window.location.reload()
        }
        
        return userData
      }
    } finally {
      loading.value = false
    }
  }

  // 修改密码
  const changePassword = async (currentPassword: string, newPassword: string) => {
    loading.value = true
    try {
      const { data, error } = await useFetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        credentials: 'include' // 确保包含cookie
      })

      if (error.value) {
        // 获取服务器返回的详细错误信息
        const errorMessage = error.value.data?.message || error.value.statusMessage || '密码修改失败'
        throw new Error(errorMessage)
      }

      return data.value
    } finally {
      loading.value = false
    }
  }

  // 设置初始密码（仅需要强制修改密码时可用）
  const setInitialPassword = async (newPassword: string) => {
    loading.value = true
    try {
      // 只有需要强制修改密码时才允许设置初始密码
      if (!user.value || !("needsPasswordChange" in user.value) || !user.value.needsPasswordChange) {
        throw new Error('当前不需要设置初始密码')
      }
      
      const { data, error } = await useFetch('/api/auth/set-initial-password', {
        method: 'POST',
        body: { newPassword },
        credentials: 'include' // 确保包含cookie
      })
      if (error.value) {
        const errorMessage = error.value.data?.message || error.value.statusMessage || '初始密码设置失败'
        throw new Error(errorMessage)
      }
      return data.value
    } finally {
      loading.value = false
    }
  }

  // 注销
  const logout = async () => {
    try {
      // 调用服务器端logout API清除cookie
      await $fetch('/api/auth/logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error('服务器端登出失败:', error)
    }
    
    user.value = null
    isAuthenticated.value = false
    isAdmin.value = false

    // 确保只在客户端环境中访问localStorage
    if (process.client) {
      // 清除存储的认证信息
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // 刷新页面以清除认证状态
      window.location.href = '/'
    }
  }

  // 获取token（主要用于向后兼容）
  const getToken = () => {
    if (process.client) {
      return localStorage.getItem('token')
    }
    return null
  }

  // 获取认证头（现在主要依赖cookie，这个方法作为备用）
  const getAuthHeader = () => {
    if (process.client) {
      const token = localStorage.getItem('token')
      if (token) {
        return {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    }
    // 现在主要依赖cookie认证，返回空对象
    return {}
  }

  // 刷新用户信息
  const refreshUser = async () => {
    if (!isAuthenticated.value) {
      return
    }

    try {
      const { data, error } = await useFetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include' // 确保包含cookie
      })

      if (error.value) {
        // 如果获取用户信息失败，可能认证已过期，执行登出
        logout()
        return
      }

      if (data.value) {
        const userData = data.value as any
        user.value = userData
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.role)

        // 更新localStorage中的用户信息
        if (process.client) {
          localStorage.setItem('user', JSON.stringify(userData))
        }
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error)
      // 发生错误时不执行登出，保持当前状态
    }
  }

  // 初始化认证
  initAuth()

  return {
    user,
    isAuthenticated,
    isAdmin,
    loading,
    login,
    logout,
    changePassword,
    setInitialPassword,
    refreshUser,
    getToken,
    getAuthHeader,
    initAuth // 公开initAuth方法
  }
}
