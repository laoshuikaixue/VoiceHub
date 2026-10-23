import { onMounted, onUnmounted, watch } from 'vue'
import { useAudioPlayer } from './useAudioPlayer'
import { useAuth } from './useAuth'
import { useServerErrors } from './useLocaleText'
import { useLocale } from '~/utils/locale'
import { createSchedulePlaylistRefresh } from '~/utils/schedulePlaylistRefresh'
import { isScheduleScopeSaved, type SchedulePlaylistItem, type SchedulePlaylistChange } from '~/utils/schedulePlaylist'

const listeners = new Set<(change: SchedulePlaylistChange) => void>()

export function notifySchedulePlaylistChanged(change: SchedulePlaylistChange = {}) {
  if (import.meta.server) return
  listeners.forEach((listener) => listener(change))
}

export function useSchedulePlaylistSync() {
  const player = useAudioPlayer()
  const auth = useAuth()
  const { audioPlayer: locale } = useLocale()
  const { localize } = useServerErrors()
  let mounted = false

  const notify = (message: string, type: 'warning' | 'error') => {
    window.$showNotification?.(message, type)
  }

  const refresh = createSchedulePlaylistRefresh<SchedulePlaylistItem[]>({
    load: async (signal) => {
      const source = player.scheduleSource.value!
      const query = { date: source.date, ...(source.includeDrafts ? { includeDrafts: 'true' } : {}) }
      const response = await $fetch<SchedulePlaylistItem[] | { data?: { schedules?: SchedulePlaylistItem[] } }>(source.includeDrafts ? '/api/admin/schedule/full' : '/api/songs/public', {
        ...auth.getAuthConfig(), query, signal, timeout: 15_000, retry: 0
      })
      const items = Array.isArray(response) ? response : response?.data?.schedules
      if (!Array.isArray(items)) throw new Error('排期响应格式无效')
      return items.filter((item) => (source.playTimeId === 'all' || (item.playTimeId ?? null) === source.playTimeId))
    },
    apply: (items) => player.syncSchedulePlaylist(items),
    failed: (error, terminal) => {
      if (terminal) {
        player.clearScheduleBinding()
        notify(localize(error), 'error')
      } else notify(localize(error, locale.value.scheduleSyncFailed), 'warning')
    }
  })

  const invalidate = (change: SchedulePlaylistChange) => {
    const { dates, playTimeId } = change
    const source = player.scheduleSource.value
    if (!source || (dates && !dates.includes(source.date))) return
    if (playTimeId !== undefined && playTimeId !== 'all' && source.playTimeId !== 'all' && playTimeId !== source.playTimeId) return
    if (source.pending) {
      if (isScheduleScopeSaved(source, change)) player.activateScheduleBinding()
    } else void refresh.refresh()
  }
  const stopWatching = watch(
    () => [player.scheduleSource.value, auth.user.value?.id, auth.user.value?.role],
    (value, previous) => {
      if (!mounted) return
      const identityChanged = previous && (value[1] !== previous[1] || value[2] !== previous[2])
      if (identityChanged && player.scheduleSource.value) {
        player.clearScheduleBinding()
        notify(locale.value.scheduleSyncAuthChanged, 'warning')
      }
      if (player.scheduleSource.value && !player.scheduleSource.value.pending) refresh.start()
      else refresh.stop()
    },
    { flush: 'sync' }
  )

  onMounted(() => {
    mounted = true
    listeners.add(invalidate)
    if (player.scheduleSource.value && !player.scheduleSource.value.pending) refresh.start()
  })
  onUnmounted(() => {
    mounted = false
    stopWatching()
    refresh.stop()
    listeners.delete(invalidate)
  })
}
