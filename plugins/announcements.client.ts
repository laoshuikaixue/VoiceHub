import { useAnnouncements } from '~/composables/useAnnouncements'

export default defineNuxtPlugin(async (nuxtApp) => {
  // 只在客户端运行
  if (process.server) return

  const { 
    showFirstValidAnnouncement, 
    cleanupExpiredRememberRecords 
  } = useAnnouncements()

  // 页面加载完成后尝试显示公告
  nuxtApp.hook('app:mounted', async () => {
    // 清理过期的记住记录
    cleanupExpiredRememberRecords()
    
    // 延迟一下，确保页面完全加载
    setTimeout(async () => {
      try {
        await showFirstValidAnnouncement()
      } catch (error) {
        console.warn('显示公告失败:', error)
      }
    }, 1000)
  })
})
