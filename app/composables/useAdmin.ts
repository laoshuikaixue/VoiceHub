import { ref } from 'vue'
import { useAuth } from './useAuth'
import { usePermissions } from './usePermissions'
import { useServerErrors } from './useLocaleText'
import { useLocale } from '~/utils/locale'
import { formatDateTime } from '~/utils/timeUtils'
import { notifySchedulePlaylistChanged } from './useSchedulePlaylistSync'
import type { PlayTime, SystemSettings } from '~/types'

export const useAdmin = () => {
  const { getAuthConfig } = useAuth()
  const { can } = usePermissions()
  const { composableErrors } = useLocale()
  const { localize: localizeServerError } = useServerErrors()
  const action = (key: keyof typeof composableErrors.value.actions) =>
    composableErrors.value.actions[key]
  const adminOnly = (key: keyof typeof composableErrors.value.actions) =>
    composableErrors.value.adminOnly(action(key))
  const failed = (key: keyof typeof composableErrors.value.actions) =>
    composableErrors.value.failed(action(key))

  const loading = ref(false)
  const error = ref('')

  // 创建歌曲排期
  const createSchedule = async (
    songId: number,
    playDate: Date,
    playTimeId?: number | null,
    sequence: number = 1
  ) => {
    if (!can('schedule:write')) {
      error.value = adminOnly('createSchedule')
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

      notifySchedulePlaylistChanged({ dates: [formatDateTime(playDate, 'YYYY-MM-DD')] })
      return data
    } catch (err: any) {
      error.value = localizeServerError(err, failed('createSchedule'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 移除排期
  const removeSchedule = async (scheduleId: number) => {
    if (!can('schedule:write')) {
      error.value = adminOnly('removeSchedule')
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
        error.value = response.message || failed('removeSchedule')
        return { success: false, message: error.value } as const
      }

      const playDate = response.schedule?.playDate
      notifySchedulePlaylistChanged(
        typeof playDate === 'string' ? { dates: [playDate.slice(0, 10)] } : {}
      )
      return response
    } catch (err: any) {
      const errorMessage = err.data?.message || localizeServerError(err, failed('removeSchedule'))
      error.value = errorMessage
      console.error('移除排期错误:', err)
      return { success: false, message: errorMessage } as const
    } finally {
      loading.value = false
    }
  }

  // 更新排期顺序；条目可携带 playDate，用于将队列刷新收窄到受影响日期
  const updateScheduleSequence = async (schedules: Array<{ id: number; sequence: number; playDate?: string }>) => {
    if (!can('schedule:write')) {
      error.value = adminOnly('updateScheduleSequence')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()
      const dates = [...new Set(schedules.map((s) => s.playDate?.slice(0, 10)).filter(Boolean))]

      const data = await $fetch('/api/admin/schedule/sequence', {
        method: 'POST',
        body: { schedules: schedules.map(({ id, sequence }) => ({ id, sequence })) },
        ...authConfig
      })

      notifySchedulePlaylistChanged(dates.length ? { dates } : {})
      return data
    } catch (err: any) {
      error.value = localizeServerError(err, failed('updateScheduleSequence'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 标记歌曲已播放
  const markSongAsPlayed = async (songId: number) => {
    if (!can('songs:write')) {
      error.value = adminOnly('markPlayed')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/songs/mark-played', {
        method: 'POST',
        body: { songId },
        ...authConfig
      })

      return data
    } catch (err: any) {
      error.value = localizeServerError(err, failed('markPlayed'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 发送管理员通知
  const sendAdminNotification = async (notificationData: {
    title: string
    content: string
    important?: boolean
    broadcast?: boolean
    scope: 'ALL' | 'GRADE' | 'CLASS' | 'MULTI_CLASS' | 'SPECIFIC_USERS'
    filter: {
      grade?: string
      class?: string
      classes?: Array<{ grade: string; class: string }>
      userIds?: number[]
    }
  }) => {
    if (!can('notifications:write')) {
      error.value = adminOnly('sendNotification')
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
      error.value = localizeServerError(err, failed('sendNotification'))
      throw new Error(error.value, { cause: err })
    } finally {
      loading.value = false
    }
  }

  // 获取系统设置
  const getSystemSettings = async () => {
    if (!can('system-settings:read')) {
      error.value = adminOnly('getSystemSettings')
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
      error.value = localizeServerError(err, failed('getSystemSettings'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新系统设置
  const updateSystemSettings = async (settings: Partial<SystemSettings>) => {
    if (!can('system-settings:write')) {
      error.value = adminOnly('updateSystemSettings')
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
      error.value = localizeServerError(err, failed('updateSystemSettings'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取所有播放时段
  const getPlayTimes = async () => {
    if (!can('play-times:read')) {
      error.value = adminOnly('getPlayTimes')
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
      error.value = localizeServerError(err, failed('getPlayTimes'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建播放时段
  const createPlayTime = async (playTimeData: Partial<PlayTime>) => {
    if (!can('play-times:write')) {
      error.value = adminOnly('createPlayTime')
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
      error.value = localizeServerError(err, failed('createPlayTime'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新播放时段
  const updatePlayTime = async (id: number, playTimeData: Partial<PlayTime>) => {
    if (!can('play-times:write')) {
      error.value = adminOnly('updatePlayTime')
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
      error.value = localizeServerError(err, failed('updatePlayTime'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除播放时段
  const deletePlayTime = async (id: number) => {
    if (!can('play-times:write')) {
      error.value = adminOnly('deletePlayTime')
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
      error.value = localizeServerError(err, failed('deletePlayTime'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除歌曲
  const deleteSong = async (songId: number) => {
    if (!can('songs:delete')) {
      error.value = adminOnly('deleteSong')
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
      error.value = localizeServerError(err, failed('deleteSong'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新歌曲
  const updateSong = async (songId: number, songData: any) => {
    if (!can('songs:write')) {
      error.value = adminOnly('updateSong')
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
      error.value = localizeServerError(err, failed('updateSong'))
      throw err
    } finally {
      loading.value = false
    }
  }

  // 添加歌曲
  const addSong = async (songData: any) => {
    if (!can('songs:write')) {
      error.value = adminOnly('addSong')
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
      error.value = localizeServerError(err, failed('addSong'))
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
