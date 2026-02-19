import { asc, db, desc, playTimes } from '~/drizzle/db'
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
    const cachedPlayTimes = await cacheService.getPlayTimes()

    if (cachedPlayTimes) {
      return cachedPlayTimes
    }

    // 缓存中没有，从数据库获取所有播出时段
    const playTimesResult = await db
      .select()
      .from(playTimes)
      .orderBy(desc(playTimes.enabled), asc(playTimes.startTime))

    // 将数据存入缓存
    try {
      await cacheService.setPlayTimes(playTimesResult)
    } catch (cacheError) {
      console.warn('缓存播放时间数据失败:', cacheError)
    }

    return playTimesResult
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})
