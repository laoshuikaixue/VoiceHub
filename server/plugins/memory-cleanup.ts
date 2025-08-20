import { MemoryStore } from '../utils/memory-store'
import { JWTEnhanced } from '../utils/jwt-enhanced'

// Nuxt服务器插件，在服务器启动时初始化内存清理机制
export default defineNitroPlugin(async (nitroApp) => {
  console.log('🚀 初始化内存清理机制...')
  
  // 启动内存存储的自动清理
  MemoryStore.startAutoCleanup()
  
  // 启动JWT增强模块的自动清理
  JWTEnhanced.startAutoCleanup()
  
  // 监听服务器关闭事件，清理资源
  nitroApp.hooks.hook('close', () => {
    console.log('🛑 服务器关闭，清理内存资源...')
    MemoryStore.clearAll()
    JWTEnhanced.clearAll()
  })
  
  // 定期输出内存使用统计（仅在开发环境）
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = MemoryStore.getStats()
      const jwtStats = JWTEnhanced.getStats()
      
      if (stats.totalItems > 0 || jwtStats.totalItems > 0) {
        console.log('📊 内存使用统计:', {
          memoryStore: stats,
          jwtEnhanced: jwtStats,
          timestamp: new Date().toISOString()
        })
      }
    }, 10 * 60 * 1000) // 每10分钟输出一次
  }
  
  console.log('✅ 内存清理机制初始化完成')
})