export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    const { syncTime, now: getSyncedTimestamp, nowDate: getSyncedDate } = useSyncedTime()

    // 立即绑定到 globalThis，组件初始化时即可安全调用（同步完成前回退到 Date.now）
    if (typeof globalThis !== 'undefined') {
      ;(globalThis as any).getSyncedTimestamp = getSyncedTimestamp
      ;(globalThis as any).getSyncedDate = getSyncedDate
    }

    // 异步同步，不阻塞应用挂载
    syncTime().catch(console.error)
  }
})
