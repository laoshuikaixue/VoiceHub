import { CacheService } from '~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '需要歌曲管理员及以上权限'
    })
  }
  
  try {
    const body = await readBody(event)
    const { scheduleId } = body
    
    if (!scheduleId) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少排期ID'
      })
    }
    
    const prisma = event.context.prisma
    const scheduleIdNumber = Number(scheduleId)
    
    console.log(`准备删除排期 ID=${scheduleIdNumber}`)
    
    // 先检查排期是否存在
    const existingSchedule = await prisma.schedule.findUnique({
      where: {
        id: scheduleIdNumber
      },
      include: {
        song: {
          select: {
            title: true,
            artist: true
          }
        }
      }
    })
    
    if (!existingSchedule) {
      console.log(`排期不存在 ID=${scheduleIdNumber}`)
      return {
        success: false,
        message: '排期不存在或已被删除'
      }
    }
    
    console.log(`找到排期 ID=${scheduleIdNumber}, 歌曲=${existingSchedule.song?.title || '未知歌曲'}`)
    
    // 删除排期
    const deletedSchedule = await prisma.schedule.delete({
      where: {
        id: scheduleIdNumber
      }
    })
    
    console.log(`成功删除排期 ID=${scheduleIdNumber}`)
    
    // 清除相关缓存
    const { cache } = await import('~/server/utils/cache-helpers')
    await cache.deletePattern('schedules:*')
    await cache.deletePattern('stats:*')
    console.log('[Cache] 排期缓存和统计缓存已清除（删除排期）')
    
    return {
      success: true,
      schedule: deletedSchedule
    }
  } catch (error: any) {
    console.error('移除排期失败:', error)
    
    // 处理Prisma特定错误
    if (error.code === 'P2025') {
      return {
        success: false,
        message: '排期不存在或已被删除'
      }
    }
    
    // 确保返回一个成功=false的响应，而不是抛出错误
    return {
      success: false,
      message: error.message || '移除排期失败',
      error: error.code || 'UNKNOWN_ERROR'
    }
  }
})