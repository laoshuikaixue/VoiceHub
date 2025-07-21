import { ref } from 'vue'
import type { User } from '~/types'

export const useAuth = () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isAdmin = ref(false)
  const loading = ref(false)

  // 从localStorage初始化用户状态
  const initAuth = () => {
    // 确保只在客户端(浏览器)环境中访问localStorage
    if (process.client) {
      const storedUser = localStorage.getItem('user')
      const token = localStorage.getItem('token')

      if (storedUser && token) {
        try {
        const parsedUser = JSON.parse(storedUser) as User
        user.value = parsedUser
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(parsedUser.role)
        } catch (error) {
          // 清除无效的存储数据
          localStorage.removeItem('user')
          localStorage.removeItem('token')
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
          // 存储token和用户信息
          localStorage.setItem('token', userData.token)
          localStorage.setItem('user', JSON.stringify(userData.user))
          
          // 刷新页面以确保认证插件能够应用认证头
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
        ...getAuthHeader()
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

  // 注销
  const logout = () => {
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

  // 获取token
  const getToken = () => {
    if (process.client) {
      return localStorage.getItem('token')
    }
    return null
  }

  // 获取认证头
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
    return {}
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
    getToken,
    getAuthHeader,
    initAuth // 公开initAuth方法
  }
}