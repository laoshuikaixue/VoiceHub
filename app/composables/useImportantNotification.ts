import { useState } from '#app'
import { useAuth } from '~/composables/useAuth'
import { useServerErrors } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

export interface ImportantNotification {
  id: number
  title: string | null
  message: string
  important: boolean
  read: boolean
  createdAt: string
  sender: {
    id: number
    name: string | null
    username: string | null
  } | null
}

let inFlightCheck: Promise<ImportantNotification | null> | null = null
let inFlightUserId: number | null = null
let requestVersion = 0

export const useImportantNotification = () => {
  const notification = useState<ImportantNotification | null>('important-notification', () => null)
  const loading = useState<boolean>('important-notification-loading', () => false)
  const closing = useState<boolean>('important-notification-closing', () => false)
  const error = useState<string>('important-notification-error', () => '')
  const checkedUserId = useState<number | null>('important-notification-user', () => null)
  const { user, isAuthenticated } = useAuth()
  const { localize: localizeServerError } = useServerErrors()
  const { importantNotification: locale } = useLocale()
  const toast = useToast()

  const resetImportantNotification = () => {
    requestVersion += 1
    notification.value = null
    loading.value = false
    closing.value = false
    error.value = ''
    checkedUserId.value = null
    inFlightCheck = null
    inFlightUserId = null
  }

  const checkImportantNotification = async (force = false) => {
    if (import.meta.server) return null

    const currentUserId = user.value?.id
    if (!isAuthenticated.value || !currentUserId || user.value?.requirePasswordChange === true) {
      resetImportantNotification()
      return null
    }

    if (!force && checkedUserId.value === currentUserId) {
      return notification.value
    }

    if (inFlightCheck && inFlightUserId === currentUserId) {
      return inFlightCheck
    }

    const activeRequestVersion = requestVersion
    inFlightUserId = currentUserId
    loading.value = true
    error.value = ''

    const checkPromise = $fetch<{ notification: ImportantNotification | null }>(
      '/api/notifications/important'
    )
      .then((response) => {
        if (
          activeRequestVersion !== requestVersion ||
          !isAuthenticated.value ||
          user.value?.id !== currentUserId
        ) {
          return null
        }

        notification.value = response.notification
        checkedUserId.value = currentUserId
        return response.notification
      })
      .catch((fetchError) => {
        if (activeRequestVersion !== requestVersion) return null

        error.value = localizeServerError(fetchError, locale.value.loadFailed)
        toast.error(error.value)
        return null
      })
      .finally(() => {
        if (activeRequestVersion === requestVersion) {
          loading.value = false
        }
        if (inFlightCheck === checkPromise) {
          inFlightCheck = null
          inFlightUserId = null
        }
      })

    inFlightCheck = checkPromise
    return checkPromise
  }

  const markAsReadAndClose = async () => {
    const currentNotification = notification.value
    const currentUserId = user.value?.id
    if (!currentNotification || !currentUserId || closing.value) return false

    closing.value = true
    error.value = ''

    try {
      await $fetch(`/api/notifications/${currentNotification.id}/read`, {
        method: 'POST'
      })

      if (user.value?.id !== currentUserId) {
        resetImportantNotification()
        return true
      }

      if (notification.value?.id === currentNotification.id) {
        notification.value = { ...notification.value, read: true }
        notification.value = null
      }
      checkedUserId.value = null
      await checkImportantNotification(true)
      return true
    } catch (fetchError) {
      // 通知已被管理员编辑重发或删除时旧 ID 会 404，按已不存在处理，避免弹窗无法关闭
      const notFoundError = fetchError as { statusCode?: number; response?: { status?: number } }
      if (notFoundError?.statusCode === 404 || notFoundError?.response?.status === 404) {
        if (notification.value?.id === currentNotification.id) {
          notification.value = null
        }
        checkedUserId.value = null
        await checkImportantNotification(true)
        return true
      }
      error.value = localizeServerError(fetchError, locale.value.closeFailed)
      return false
    } finally {
      closing.value = false
    }
  }

  return {
    notification,
    loading,
    closing,
    error,
    checkedUserId,
    checkImportantNotification,
    markAsReadAndClose,
    resetImportantNotification
  }
}
