export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client) {
    const { syncTime } = useSyncedTime()
    // 异步执行时间同步，不阻塞应用初始化
    syncTime().catch(console.error)
  }
})
