export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client) {
    const { syncTime, getSyncedTimestamp, getSyncedDate } = useSyncedTime()

    // 绑定到 globalThis，供 isomorphic 代码（如 app/utils/timeUtils.ts）安全调用
    if (typeof globalThis !== 'undefined') {
      ;(globalThis as any).getSyncedTimestamp = getSyncedTimestamp
      ;(globalThis as any).getSyncedDate = getSyncedDate
    }

    // 同步阻塞时间同步，确保 Hydration 时客户端与服务端时间一致
    try {
      await syncTime()
    } catch (err) {
      console.error('[TimeSync] 客户端时间同步失败:', err)
    }
  }
})
