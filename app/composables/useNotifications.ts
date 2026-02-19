import { computed, ref } from 'vue'
import { useAuth } from './useAuth'
import type { Notification, NotificationSettings } from '~/types'

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export const useNotifications = () => {
  const { getAuthConfig, isAuthenticated } = useAuth()

  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const settings = ref<NotificationSettings | null>(null)
  const loading = ref(false)
  const error = ref('')

  // 分页相关状态
  const currentPage = ref(1)
  const pageSize = ref(10)
  const totalPages = ref(0)
  const totalCount = ref(0)
  const hasNextPage = computed(() => currentPage.value < totalPages.value)
  const hasPrevPage = computed(() => currentPage.value > 1)
  const isPaginationLoading = ref(false)

  const fetchNotifications = async (page?: number, limit?: number) => {
    if (!isAuthenticated.value) {
      notifications.value = []
      unreadCount.value = 0
      resetPagination()
      return
    }

    // 如果是分页请求（非初始加载），显示分页加载状态
    if (page && page !== 1) {
      isPaginationLoading.value = true
    } else {
      loading.value = true
    }
    error.value = ''

    // 使用传入的参数或当前状态
    const requestPage = page || currentPage.value
    const requestLimit = limit || pageSize.value

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/notifications', {
        query: {
          page: requestPage,
          limit: requestLimit
        },
        ...authConfig
      })

      if (data) {
        notifications.value = data.notifications || []
        unreadCount.value = data.unreadCount || 0

        // 更新分页信息
        if (data.pagination) {
          currentPage.value = data.pagination.currentPage
          totalPages.value = data.pagination.totalPages
          totalCount.value = data.pagination.totalCount
          pageSize.value = data.pagination.limit
          hasNextPage.value = data.pagination.hasNextPage
          hasPrevPage.value = data.pagination.hasPrevPage
        }
      }
    } catch (err: any) {
      const errorHandler = useErrorHandler()
      if (await errorHandler.checkAndHandleFetchError(err)) {
        return
      }
      console.error('获取通知错误:', err)
      notifications.value = []
      unreadCount.value = 0
      resetPagination()
    } finally {
      loading.value = false
      isPaginationLoading.value = false
    }
  }

  // 重置分页状态
  const resetPagination = () => {
    currentPage.value = 1
    totalPages.value = 0
    totalCount.value = 0
    hasNextPage.value = false
    hasPrevPage.value = false
  }

  // 分页导航方法
  const goToPage = async (page: number) => {
    if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
      await fetchNotifications(page, pageSize.value)
    }
  }

  const nextPage = async () => {
    if (hasNextPage.value) {
      await goToPage(currentPage.value + 1)
    }
  }

  const prevPage = async () => {
    if (hasPrevPage.value) {
      await goToPage(currentPage.value - 1)
    }
  }

  const changePageSize = async (newSize: number) => {
    if (newSize !== pageSize.value) {
      pageSize.value = newSize
      // 重新计算当前页，确保不超出范围
      const newTotalPages = Math.ceil(totalCount.value / newSize)
      const newCurrentPage = Math.min(currentPage.value, newTotalPages || 1)
      await fetchNotifications(newCurrentPage, newSize)
    }
  }

  const fetchNotificationSettings = async () => {
    if (!isAuthenticated.value) {
      settings.value = null
      return
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/notifications/settings', {
        ...authConfig
      })

      if (data) {
        settings.value = data
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

  const updateNotificationSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能更新通知设置'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/notifications/settings', {
        method: 'POST',
        body: newSettings,
        ...authConfig
      })

      if (data) {
        settings.value = data
        return data
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
      const authConfig = getAuthConfig()

      const data = await $fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        ...authConfig
      })

      const index = notifications.value.findIndex((n: Notification) => n.id === notificationId)
      if (index !== -1) {
        notifications.value[index].read = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }

      return data
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
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/notifications/read-all', {
        method: 'POST',
        ...authConfig
      })

      if (data) {
        notifications.value.forEach((n) => (n.read = true))
        unreadCount.value = 0
        return data
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
      const authConfig = getAuthConfig()

      await $fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        ...authConfig
      })

      // 更新本地通知列表
      const index = notifications.value.findIndex((n: Notification) => n.id === notificationId)
      if (index !== -1) {
        if (!notifications.value[index].read) {
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        }
        notifications.value.splice(index, 1)
      }

      // 删除后重新获取当前页数据，以补充后续通知
      if (notifications.value.length === 0 && currentPage.value > 1) {
        // 如果当前页数据已被清空且不是第一页，则跳转到上一页
        await goToPage(currentPage.value - 1)
      } else {
        // 否则重新加载当前页（如果有下一页数据会自动补充上来）
        await fetchNotifications(currentPage.value, pageSize.value)
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
      const authConfig = getAuthConfig()

      await $fetch('/api/notifications/clear-all', {
        method: 'DELETE',
        ...authConfig
      })

      // 清空本地通知列表
      notifications.value = []
      unreadCount.value = 0
      resetPagination()

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
    // 分页相关状态
    currentPage,
    pageSize,
    totalPages,
    totalCount,
    hasNextPage,
    hasPrevPage,
    isPaginationLoading,
    // 原有方法
    fetchNotifications,
    fetchNotificationSettings,
    updateNotificationSettings,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    // 分页方法
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPagination
  }
}
