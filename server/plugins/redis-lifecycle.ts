import { disconnectRedis, getRedisClient, isRedisConfigured } from '~~/server/utils/redis'

export default defineNitroPlugin((nitroApp) => {
  if (isRedisConfigured()) {
    getRedisClient().catch((error) => {
      console.error('[Redis] 初始化短期状态服务失败:', error)
    })
  } else {
    console.log('[Redis] 未配置，将使用单实例内存短期状态')
  }

  nitroApp.hooks.hook('close', async () => {
    await disconnectRedis()
  })
})
