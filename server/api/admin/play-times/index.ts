import { prisma } from '../../../models/schema'
import { CacheService } from '../../../services/cacheService'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理播出时段'
    })
  }
  
  try {
    // 尝试从缓存获取播放时间数据
    const cacheService = CacheService.getInstance()
    let playTimes = await cacheService.getPlayTimes()
    
    if (playTimes) {
      return playTimes
    }
    
    // 缓存中没有，从数据库获取所有播出时段
    playTimes = await prisma.playTime.findMany({
      orderBy: [
        { enabled: 'desc' }, // 启用的排在前面
        { startTime: 'asc' } // 按开始时间排序
      ]
    })
    
    // 将数据存入缓存
    try {
      await cacheService.setPlayTimes(playTimes)
    } catch (cacheError) {
      console.warn('缓存播放时间数据失败:', cacheError)
    }
    
    return playTimes
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})