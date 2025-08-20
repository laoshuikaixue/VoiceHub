import { ref, computed } from 'vue'
import { navigateTo } from '#app'
import type { User } from '~/types'

const user = ref<User | null>(null)
const isAuthenticated = ref(false)
const isAdmin = ref(false)
const loading = ref(false)
let silentRefreshTimer: NodeJS.Timeout | null = null
let initAuthPromise: Promise<void> | null = null // 防止重复初始化

export const useAuth = () => {
  // 验证服务器端认证状态
  const validateServerAuth = async (): Promise<boolean> => {
    try {
      const response = await $fetch('/api/auth/me')
      
      // 检查返回的用户数据
      if (response && response.id) {
        // 验证用户ID一致性（防止用户身份混乱）
        if (user.value && user.value.id !== response.id) {
          console.error(`[Auth] CRITICAL: User ID mismatch detected: current=${user.value.id}, server=${response.id}`)
          await forceReauthentication('用户身份不匹配')
          return false
        }
        
        // 验证服务器返回的用户ID与_userId字段一致性
        if (response._userId && response.id !== response._userId) {
          console.error(`[Auth] CRITICAL: Server response ID mismatch: id=${response.id}, _userId=${response._userId}`)
          await forceReauthentication('服务器数据不一致')
          return false
        }
        
        // 检查payload时间戳，确保数据新鲜度
        if (response._validatedAt) {
          const age = Date.now() - response._validatedAt
          if (age > 5 * 60 * 1000) { // 5分钟
            console.warn(`[Auth] Server validation data too old: ${age}ms, re-validating...`)
            // 数据过旧，需要重新验证
            return await validateServerAuth()
          }
        }
        
        // 更新用户状态
        user.value = response as User
        isAuthenticated.value = true
        isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(response.role)
        
        // 同步更新nuxtApp.payload
        const nuxtApp = useNuxtApp()
        nuxtApp.payload.user = {
          ...response,
          _timestamp: Date.now(),
          _userId: response.id
        }
        
        // 更新localStorage
        if (process.client) {
          localStorage.setItem('user', JSON.stringify(response))
        }
        
        console.log(`[Auth] Server validation successful for user ${response.id} (${response.username})`)
        return true
      }
      
      console.warn('[Auth] Server validation returned invalid user data')
      await clearAuthState()
      return false
    } catch (error: any) {
      console.error('[Auth] Server validation failed:', error)
      
      // 如果是401错误或身份相关错误，强制重新认证
      if (error.statusCode === 401 || error.message?.includes('身份') || error.message?.includes('不匹配')) {
        await forceReauthentication(error.message || '认证失效')
      } else {
        await clearAuthState()
      }
      
      return false
    }
  }

  // 清理认证状态的辅助函数
  const clearAuthState = async () => {
    console.log('[Auth] Clearing all authentication state')
    
    user.value = null
    isAuthenticated.value = false
    isAdmin.value = false
    
    // 清理nuxtApp.payload
    const nuxtApp = useNuxtApp()
    if (nuxtApp.payload.user) {
      delete nuxtApp.payload.user
    }
    
    // 清理localStorage
    if (process.client) {
      localStorage.removeItem('user')
    }
    
    // 停止静默刷新
    stopSilentRefresh()
  }
  
  // 强制重新认证机制
  const forceReauthentication = async (reason: string) => {
    console.error(`[Auth] FORCE REAUTHENTICATION: ${reason}`)
    
    // 立即清理所有状态
    await clearAuthState()
    
    // 清理所有cookies
    if (process.client) {
      document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      
      // 显示警告信息
      console.warn(`[Auth] 检测到安全问题：${reason}，请重新登录`)
      
      // 可以在这里添加用户通知逻辑
      // 例如：显示toast通知或弹窗
      
      // 重定向到登录页面
      await navigateTo('/login', { replace: true })
    }
  }

  // 从SSR payload或localStorage初始化用户状态
  const initAuth = async () => {
    // 防止重复初始化（竞态条件保护）
    if (initAuthPromise) {
      console.log('[Auth] Init already in progress, waiting...')
      return initAuthPromise
    }

    initAuthPromise = (async () => {
      try {
        const nuxtApp = useNuxtApp()
        console.log('[Auth] Starting authentication initialization')

        // 1. 优先从SSR payload获取 (在服务器端渲染时)
        if (nuxtApp.payload.user) {
          const payloadUser = nuxtApp.payload.user as any
          
          // 验证payload的完整性和时效性
          if (payloadUser._userId && payloadUser._timestamp) {
            const payloadAge = Date.now() - payloadUser._timestamp
            
            // 检查payload是否过期（5分钟）
            if (payloadAge > 5 * 60 * 1000) {
              console.warn(`[Auth] SSR payload expired, age: ${payloadAge}ms, re-validating...`)
              if (process.client) {
                // payload过期，需要重新验证
                if (await validateServerAuth()) {
                  startSilentRefresh()
                } else {
                  await logout(false)
                }
              }
              return
            }
            
            // 验证用户ID一致性
            if (payloadUser.id !== payloadUser._userId) {
              console.error(`[Auth] Payload user ID mismatch: ${payloadUser.id} vs ${payloadUser._userId}`)
              await clearAuthState()
              return
            }
          } else {
            console.warn('[Auth] SSR payload missing security metadata, re-validating...')
            if (process.client) {
              // 缺少安全元数据，重新验证
              user.value = payloadUser // 临时设置用于ID验证
              if (await validateServerAuth()) {
                startSilentRefresh()
              } else {
                await logout(false)
              }
              return
            }
          }
          
          // SSR payload有效，使用它初始化状态
          user.value = payloadUser as User
          isAuthenticated.value = true
          isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(payloadUser.role)
          
          console.log(`[Auth] Initialized from SSR payload for user ${payloadUser.id} (${payloadUser.username})`)
          
          if (process.client) {
            // 更新localStorage以保持同步
            localStorage.setItem('user', JSON.stringify(payloadUser))
            startSilentRefresh()
          }
          return
        }

        // 2. 客户端从localStorage恢复状态并验证
        if (process.client) {
          const storedUser = localStorage.getItem('user')
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser)
              
              // 验证存储数据的完整性
              if (!parsedUser.id || !parsedUser.username) {
                console.error('[Auth] Invalid stored user data, clearing...')
                await clearAuthState()
                return
              }
              
              console.log(`[Auth] Attempting to restore user ${parsedUser.id} (${parsedUser.username}) from localStorage`)
              
              // 临时设置用户状态用于validateServerAuth中的ID验证
              user.value = parsedUser
              
              if (await validateServerAuth()) {
                startSilentRefresh()
              } else {
                // 如果验证失败，则执行登出
                console.warn('[Auth] Server validation failed, logging out')
                await logout(false) // 传递false避免重定向循环
              }
            } catch (error) {
              console.error('[Auth] Failed to parse stored user data:', error)
              await clearAuthState()
            }
          } else {
            console.log('[Auth] No stored user data found')
            // 确保状态完全清理
            await clearAuthState()
          }
        }
      } catch (error) {
        console.error('[Auth] Critical error during initialization:', error)
        await clearAuthState()
      } finally {
        initAuthPromise = null
        console.log('[Auth] Authentication initialization completed')
      }
    })()

    return initAuthPromise
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

  // 设置初始密码
  const setInitialPassword = async (newPassword: string) => {
    loading.value = true
    try {
      await $fetch('/api/auth/set-initial-password', {
        method: 'POST',
        body: { newPassword },
      })
      // 初始密码设置成功后，更新用户状态
      if (user.value) {
        user.value.needsPasswordChange = false
      }
    } catch (error: any) {
      const errorMessage = error.data?.message || '初始密码设置失败'
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  // 刷新用户信息
  const refreshUser = async () => {
    try {
      const nuxtApp = useNuxtApp()
      const userData = await $fetch('/api/auth/me', {
        headers: getAuthHeader()
      })
      user.value = userData
      isAuthenticated.value = true
      isAdmin.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.role)
      
      // 同时更新 nuxtApp.payload
      if (nuxtApp.payload) {
        nuxtApp.payload.user = userData
        nuxtApp.payload.isAuthenticated = true
        nuxtApp.payload.isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userData.role)
      }
    } catch (error: any) {
      console.error('刷新用户信息失败:', error)
      throw error
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
    setInitialPassword,
    refreshUser,
    initAuth,
    authHeader,
    getAuthHeader,
    validateServerAuth,
    startSilentRefresh,
    stopSilentRefresh
  }
}
