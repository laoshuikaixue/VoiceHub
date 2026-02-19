import { ref } from 'vue'
import { useAuth } from './useAuth'
import type { PlayTime, SystemSettings } from '~/types'

export const useAdmin = () => {
  const { getAuthConfig, isAdmin } = useAuth()

  const loading = ref(false)
  const error = ref('')

  // 创建歌曲排期
  const createSchedule = async (
    songId: number,
    playDate: Date,
    playTimeId?: number | null,
    sequence: number = 1
  ) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能创建排期'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/schedule', {
        method: 'POST',
        body: { songId, playDate, playTimeId, sequence },
        ...authConfig
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
      return { success: false, message: error.value } as const
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const response = await $fetch<{
        success: boolean
        message?: string
        schedule?: any
      }>('/api/admin/schedule/remove', {
        method: 'POST',
        body: { scheduleId },
        ...authConfig
      })

      // 检查响应
      if (!response.success) {
        error.value = response.message || '移除排期失败'
        return { success: false, message: error.value } as const
      }

      return response
    } catch (err: any) {
      const errorMessage = err.data?.message || err.message || '移除排期失败'
      error.value = errorMessage
      console.error('移除排期错误:', err)
      return { success: false, message: errorMessage } as const
    } finally {
      loading.value = false
    }
  }

  // 更新排期顺序
  const updateScheduleSequence = async (schedules: Array<{ id: number; sequence: number }>) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能更新排期顺序'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/schedule/sequence', {
        method: 'POST',
        body: { schedules },
        ...authConfig
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
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/mark-played', {
        method: 'POST',
        body: { songId },
        ...authConfig
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
    title: string
    content: string
    scope: 'ALL' | 'GRADE' | 'CLASS' | 'MULTI_CLASS'
    filter: {
      grade?: string
      class?: string
      classes?: Array<{ grade: string; class: string }>
    }
  }) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能发送系统通知'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/notifications/send', {
        method: 'POST',
        body: notificationData,
        ...authConfig
      })

      return data
    } catch (err: any) {
      error.value = err.message || '发送通知失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取系统设置
  const getSystemSettings = async () => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能获取系统设置'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/system-settings', {
        ...authConfig
      })

      return data as SystemSettings
    } catch (err: any) {
      error.value = err.message || '获取系统设置失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新系统设置
  const updateSystemSettings = async (settings: Partial<SystemSettings>) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能更新系统设置'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/system-settings', {
        method: 'POST',
        body: settings,
        ...authConfig
      })

      return data as SystemSettings
    } catch (err: any) {
      error.value = err.message || '更新系统设置失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取所有播放时段
  const getPlayTimes = async () => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能获取播放时段'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/play-times', {
        ...authConfig
      })

      return data as PlayTime[]
    } catch (err: any) {
      error.value = err.message || '获取播放时段失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建播放时段
  const createPlayTime = async (playTimeData: Partial<PlayTime>) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能创建播放时段'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/play-times', {
        method: 'POST',
        body: playTimeData,
        ...authConfig
      })

      return data as PlayTime
    } catch (err: any) {
      error.value = err.message || '创建播放时段失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新播放时段
  const updatePlayTime = async (id: number, playTimeData: Partial<PlayTime>) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能更新播放时段'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch(`/api/admin/play-times/${id}`, {
        method: 'PUT',
        body: playTimeData,
        ...authConfig
      })

      return data as PlayTime
    } catch (err: any) {
      error.value = err.message || '更新播放时段失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除播放时段
  const deletePlayTime = async (id: number) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能删除播放时段'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch(`/api/admin/play-times/${id}`, {
        method: 'DELETE',
        ...authConfig
      })

      return data
    } catch (err: any) {
      error.value = err.message || '删除播放时段失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除歌曲
  const deleteSong = async (songId: number) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能删除歌曲'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/songs/delete', {
        method: 'POST',
        body: { songId },
        ...authConfig
      })

      return data
    } catch (err: any) {
      error.value = err.message || '删除歌曲失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新歌曲
  const updateSong = async (songId: number, songData: any) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能更新歌曲'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch(`/api/songs/${songId}/update`, {
        method: 'PUT',
        body: songData,
        ...authConfig
      })

      return data
    } catch (err: any) {
      error.value = err.message || '更新歌曲失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 添加歌曲
  const addSong = async (songData: any) => {
    if (!isAdmin.value) {
      error.value = '只有管理员才能添加歌曲'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/songs/add', {
        method: 'POST',
        body: songData,
        ...authConfig
      })

      return data
    } catch (err: any) {
      error.value = err.message || '添加歌曲失败'
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
    sendAdminNotification,
    getSystemSettings,
    updateSystemSettings,
    getPlayTimes,
    createPlayTime,
    updatePlayTime,
    deletePlayTime,
    deleteSong,
    updateSong,
    addSong
  }
}
