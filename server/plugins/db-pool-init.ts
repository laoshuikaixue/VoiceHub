import { dbPool } from '~/server/utils/db-pool'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('[DB Pool Plugin] 初始化数据库连接池...')
  
  try {
    // 初始化连接池
    await dbPool.initialize()
    console.log('[DB Pool Plugin] 数据库连接池初始化成功')
    
    // 在每个请求前检查连接状态
    nitroApp.hooks.hook('request', async (event) => {
      // 只对API请求检查连接
      if (event.node.req.url?.startsWith('/api/')) {
        try {
          await dbPool.ensureConnection()
        } catch (error) {
          console.error('[DB Pool Plugin] 请求前连接检查失败:', error)
        }
      }
    })
    
    // 在应用关闭时清理连接
    nitroApp.hooks.hook('close', async () => {
      console.log('[DB Pool Plugin] 应用关闭，清理数据库连接...')
      try {
        const { prisma } = await import('~/prisma/client')
        await prisma.$disconnect()
        console.log('[DB Pool Plugin] 数据库连接已清理')
      } catch (error) {
        console.error('[DB Pool Plugin] 清理连接时出错:', error)
      }
    })
    
  } catch (error) {
    console.error('[DB Pool Plugin] 初始化失败:', error)
  }
})
