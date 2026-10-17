import { onMounted, onUnmounted, readonly, ref } from 'vue'

// Web Screen Wake Lock：播放期间阻止屏幕自动熄灭
export const useWakeLock = () => {
  const isSupported = ref(false)
  const isLocked = ref(false)

  let sentinel: WakeLockSentinel | null = null
  // 业务侧是否期望保持常亮（播放中为 true），页签回前台时据此自动重新申请
  let desiredActive = false

  const checkSupport = () => {
    isSupported.value = 'wakeLock' in navigator
    return isSupported.value
  }

  // sentinel 被系统释放（隐藏页签、省电模式）时同步状态并清空引用
  const handleSelfRelease = () => {
    isLocked.value = false
    sentinel = null
  }

  const releaseSentinel = async () => {
    if (!sentinel) return
    const current = sentinel
    sentinel = null
    isLocked.value = false
    try {
      await current.release()
    } catch {
      // 已释放或已被系统回收，忽略
    }
  }

  const requestLock = async () => {
    if (!isSupported.value) return
    desiredActive = true
    // 页签不可见时申请会失败，等 visibilitychange 回前台再补
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (sentinel) return

    try {
      sentinel = await navigator.wakeLock.request('screen')
      isLocked.value = true
      sentinel.addEventListener('release', handleSelfRelease)
    } catch {
      // 申请失败静默降级（移动端省电限制、系统不支持等）
      isLocked.value = false
    }
  }

  const releaseLock = async () => {
    desiredActive = false
    await releaseSentinel()
  }

  // 页签从后台回到前台时，系统已自动释放锁；若仍在播放则重新申请
  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible' && desiredActive && !sentinel) {
      void requestLock()
    }
  }

  onMounted(() => {
    checkSupport()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    void releaseLock()
  })

  return {
    isSupported: readonly(isSupported),
    isLocked: readonly(isLocked),
    requestLock,
    releaseLock
  }
}
