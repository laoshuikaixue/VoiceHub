export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client) {
    const { syncTime } = useSyncedTime()

    // 绑定到 globalThis，供 isomorphic 代码（如 app/utils/timeUtils.ts）安全调用
    if (typeof globalThis !== 'undefined') {
      ;(globalThis as any).getSyncedTimestamp = getSyncedTimestamp
      ;(globalThis as any).getSyncedDate = getSyncedDate
    }

    // 异步执行时间同步，不阻塞应用初始化
    syncTime().catch(console.error)
  }
})
