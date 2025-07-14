import { ref } from 'vue'
import { useAuth } from './useAuth'

export const useAdmin = () => {
  const { getAuthHeader, isAdmin } = useAuth()
  
  const loading = ref(false)
  const error = ref('')
  
  // 创建歌曲排期
  const createSchedule = async (songId: number, playDate: Date, sequence: number = 1) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能创建排期'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/schedule', {
        method: 'POST',
        body: { songId, playDate, sequence },
        headers: authHeaders.headers
      })
      
      return data
    } catch (err: any) {
      error.value = err.message || '创建排期失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // 移除排期
  const removeSchedule = async (scheduleId: number) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能移除排期'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/schedule/remove', {
        method: 'POST',
        body: { scheduleId },
        headers: authHeaders.headers
      })
      
      return data
    } catch (err: any) {
      error.value = err.message || '移除排期失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // 更新排期顺序
  const updateScheduleSequence = async (schedules: Array<{id: number, sequence: number}>) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能更新排期顺序'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/schedule/sequence', {
        method: 'POST',
        body: { schedules },
        headers: authHeaders.headers
      })
      
      return data
    } catch (err: any) {
      error.value = err.message || '更新排期顺序失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // 标记歌曲已播放
  const markSongAsPlayed = async (songId: number) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能标记歌曲已播放'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/mark-played', {
        method: 'POST',
        body: { songId },
        headers: authHeaders.headers
      })
      
      return data
    } catch (err: any) {
      error.value = err.message || '标记播放失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // 发送管理员通知
  const sendAdminNotification = async (notificationData: {
    title: string,
    content: string,
    scope: 'ALL' | 'GRADE' | 'CLASS' | 'MULTI_CLASS',
    filter: {
      grade?: string,
      class?: string,
      classes?: Array<{grade: string, class: string}>
    }
  }) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能发送系统通知'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/notifications/send', {
        method: 'POST',
        body: notificationData,
        headers: authHeaders.headers
      })
      
      return data
    } catch (err: any) {
      error.value = err.message || '发送通知失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    loading,
    error,
    createSchedule,
    removeSchedule,
    markSongAsPlayed,
    updateScheduleSequence,
    sendAdminNotification
  }
} 