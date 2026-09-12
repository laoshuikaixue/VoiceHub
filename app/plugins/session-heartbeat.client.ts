import { watch } from 'vue'
import { useAuth } from '~/composables/useAuth'

export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuth()
  const router = useRouter()
  let timer: ReturnType<typeof window.setInterval> | null = null

  const sendHeartbeat = async () => {
    if (document.hidden || !auth.isAuthenticated.value || !auth.user.value) return
    try {
      await $fetch('/api/auth/session/heartbeat', {
        method: 'POST',
        body: { path: router.currentRoute.value.fullPath }
      })
    } catch (error: any) {
      if (error?.statusCode === 401) await auth.initAuth(true)
    }
  }

  const onVisibilityChange = () => {
    if (!document.hidden) void sendHeartbeat()
  }

  const stopUserWatch = watch(() => auth.user.value?.id, (userId) => {
    if (userId) void sendHeartbeat()
  }, { immediate: true })

  const removeRouteHook = router.afterEach(() => {
    void sendHeartbeat()
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  timer = window.setInterval(() => void sendHeartbeat(), 30 * 1000)

  nuxtApp.hook('app:beforeUnmount', () => {
    stopUserWatch()
    removeRouteHook()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (timer) window.clearInterval(timer)
  })
})
