import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import type { Notification, NotificationSettings } from '~/types'

export const useNotifications = () => {
  const { getAuthHeader, isAuthenticated } = useAuth()
  
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const settings = ref<NotificationSettings | null>(null)
  const loading = ref(false)
  const error = ref('')
  
  // 获取用户通知列表
  const fetchNotifications = async () => {
    if (!isAuthenticated.value) {
      notifications.value = []
      unreadCount.value = 0
      return
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const { data, error: fetchError } = await useFetch('/api/notifications', {
        headers: {
          ...authHeaders.headers
        }
      })
      
      if (fetchError.value) {
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return
        }
        throw new Error(fetchError.value.message || `获取通知失败: ${fetchError.value.statusCode}`)
      }
      
      if (data.value) {
        notifications.value = data.value.notifications || []
        unreadCount.value = data.value.unreadCount || 0
      }
    } catch (err: any) {
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return
      }
      console.error('获取通知错误:', err)
      notifications.value = []
      unreadCount.value = 0
    } finally {
      loading.value = false
    }
  }
  
  // 获取通知设置
  const fetchNotificationSettings = async () => {
    if (!isAuthenticated.value) {
      settings.value = null
      return
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const { data, error: fetchError } = await useFetch('/api/notifications/settings', {
        headers: {
          ...authHeaders.headers
        }
      })
      
      if (fetchError.value) {
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return
        }
        throw new Error(fetchError.value.message || `获取通知设置失败: ${fetchError.value.statusCode}`)
      }
      
      if (data.value) {
        settings.value = data.value
      }
    } catch (err: any) {
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return
      }
      console.error('获取通知设置错误:', err)
      settings.value = null
    } finally {
      loading.value = false
    }
  }
  
  // 更新通知设置
  const updateNotificationSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能更新通知设置'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const { data, error: fetchError } = await useFetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          ...authHeaders.headers
        },
        body: newSettings
      })
      
      if (fetchError.value) {
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return null
        }
        throw new Error(fetchError.value.message || `更新通知设置失败: ${fetchError.value.statusCode}`)
      }
      
      if (data.value) {
        settings.value = data.value
        return data.value
      }
      return null
    } catch (err: any) {
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return null
      }
      error.value = err.message || '更新通知设置失败'
      console.error('更新通知设置错误:', err)
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 标记通知为已读
  const markAsRead = async (notificationId: number) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能标记通知'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const { data, error: fetchError } = await useFetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          ...authHeaders.headers
        }
      })
      
      if (fetchError.value) {
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return null
        }
        throw new Error(fetchError.value.message || `标记通知失败: ${fetchError.value.statusCode}`)
      }
      
      const index = notifications.value.findIndex((n: Notification) => n.id === notificationId)
      if (index !== -1) {
        notifications.value[index].read = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
      
      return data.value
    } catch (err: any) {
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return null
      }
      error.value = err.message || '标记通知失败'
      console.error('标记通知错误:', err)
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 标记所有通知为已读
  const markAllAsRead = async () => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能标记通知'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const { data, error: fetchError } = await useFetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          ...authHeaders.headers
        }
      })
      
      if (fetchError.value) {
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return null
        }
        throw new Error(fetchError.value.message || `标记所有通知失败: ${fetchError.value.statusCode}`)
      }
      
      if (data.value) {
        notifications.value.forEach(n => n.read = true)
        unreadCount.value = 0
        return data.value
      }
      return null
    } catch (err: any) {
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return null
      }
      error.value = err.message || '标记所有通知失败'
      console.error('标记所有通知错误:', err)
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 删除通知
  const deleteNotification = async (notificationId: number) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能删除通知'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const { data, error: fetchError } = await useFetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        }
      })
      
      if (fetchError.value) {
        // 检查401错误
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return null
        }
        
        throw new Error(fetchError.value.message || `删除通知失败: ${fetchError.value.statusCode}`)
      }
      
      // 更新本地通知列表
      const index = notifications.value.findIndex((n: Notification) => n.id === notificationId)
      if (index !== -1) {
        if (!notifications.value[index].read) {
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        }
        notifications.value.splice(index, 1)
      }
      
      return true
    } catch (err: any) {
      // 检查是否为401错误
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return null
      }
      
      error.value = err.message || '删除通知失败'
      console.error('删除通知错误:', err)
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 清空所有通知
  const clearAllNotifications = async () => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能清空通知'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const { data, error: fetchError } = await useFetch('/api/notifications/clear-all', {
        method: 'DELETE',
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        }
      })
      
      if (fetchError.value) {
        // 检查401错误
        const errorHandler = useErrorHandler()
        if (await errorHandler.checkAndHandleFetchError(fetchError.value)) {
          return null
        }
        
        throw new Error(fetchError.value.message || `清空通知失败: ${fetchError.value.statusCode}`)
      }
      
      // 清空本地通知列表
      notifications.value = []
      unreadCount.value = 0
      
      return true
    } catch (err: any) {
      // 检查是否为401错误
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return null
      }
      
      error.value = err.message || '清空通知失败'
      console.error('清空通知错误:', err)
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 计算未读通知数量
  const computedUnreadCount = computed(() => unreadCount.value)
  
  return {
    notifications,
    unreadCount: computedUnreadCount,
    settings,
    loading,
    error,
    fetchNotifications,
    fetchNotificationSettings,
    updateNotificationSettings,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  }
}