import { db } from '~/drizzle/db'
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
      message: '只有管理员才能访问播出时段'
    })
  }
  
  // 获取播出时段ID
  const id = parseInt(event.context.params?.id || '0')
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '播出时段ID不正确'
    })
  }
  
  // 根据请求方法执行不同操作
  const method = event.method
  
  if (method === 'GET') {
    try {
      // 获取指定播出时段
      const playTime = await prisma.playTime.findUnique({
        where: { id }
      })
      
      if (!playTime) {
        throw createError({
          statusCode: 404,
          message: '找不到指定的播出时段'
        })
      }
      
      return playTime
    } catch (error) {
      console.error('获取播出时段失败:', error)
      throw createError({
        statusCode: 500,
        message: '获取播出时段失败'
      })
    }
  } else if (method === 'PUT') {
    // 更新播出时段
    const body = await readBody(event)
    
    // 验证必填字段
    if (!body.name) {
      throw createError({
        statusCode: 400,
        message: '时段名称不能为空'
      })
    }
    
    // 验证时间格式（如果提供）
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (body.startTime && !timeRegex.test(body.startTime)) {
      throw createError({
        statusCode: 400,
        message: '开始时间格式不正确，应为HH:MM格式'
      })
    }
    
    if (body.endTime && !timeRegex.test(body.endTime)) {
      throw createError({
        statusCode: 400,
        message: '结束时间格式不正确，应为HH:MM格式'
      })
    }
    
    // 验证时间顺序（仅当两者都提供时）
    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
      throw createError({
        statusCode: 400,
        message: '开始时间必须早于结束时间'
      })
    }
    
    try {
      // 检查名称是否已存在（排除当前ID）
      const existingPlayTime = await prisma.playTime.findFirst({
        where: {
          name: {
            equals: body.name,
            mode: 'insensitive' // 忽略大小写
          },
          id: {
            not: id
          }
        }
      })
      
      if (existingPlayTime) {
        throw createError({
          statusCode: 400,
          message: '播出时段名称已存在，请使用其他名称'
        })
      }
      
      // 更新播出时段
      const updatedPlayTime = await prisma.playTime.update({
        where: { id },
        data: {
          name: body.name,
          startTime: body.startTime || null,
          endTime: body.endTime || null,
          description: body.description ?? null,
          enabled: body.enabled !== undefined ? body.enabled : true
        }
      })

      // 清除相关缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSchedulesCache()
        await cacheService.clearPlayTimesCache()
        console.log('[Cache] 排期缓存已清除（播放时间更新）')
      } catch (cacheError) {
        console.warn('[Cache] 清除缓存失败:', cacheError)
      }

      return updatedPlayTime
    } catch (error: any) {
      console.error('更新播出时段失败:', error)
      
      // 如果是我们自定义的错误，直接抛出
      if (error.statusCode) {
        throw error
      }
      
      throw createError({
        statusCode: 500,
        message: '更新播出时段失败'
      })
    }
  } else if (method === 'PATCH') {
    // 部分更新（主要用于启用/禁用）
    const body = await readBody(event)
    
    try {
      // 如果要更新名称，先检查是否存在重名
      if (body.name !== undefined) {
        // 检查名称是否已存在（排除当前ID）
        const existingPlayTime = await prisma.playTime.findFirst({
          where: {
            name: {
              equals: body.name,
              mode: 'insensitive' // 忽略大小写
            },
            id: {
              not: id
            }
          }
        })
        
        if (existingPlayTime) {
          throw createError({
            statusCode: 400,
            message: '播出时段名称已存在，请使用其他名称'
          })
        }
      }
      
      // 更新播出时段
      const updatedPlayTime = await prisma.playTime.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.startTime !== undefined && { startTime: body.startTime }),
          ...(body.endTime !== undefined && { endTime: body.endTime }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.enabled !== undefined && { enabled: body.enabled })
        }
      })

      // 清除相关缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSchedulesCache()
        await cacheService.clearPlayTimesCache()
        console.log('[Cache] 排期缓存已清除（播放时间部分更新）')
      } catch (cacheError) {
        console.warn('[Cache] 清除缓存失败:', cacheError)
      }

      return updatedPlayTime
    } catch (error: any) {
      console.error('部分更新播出时段失败:', error)
      
      // 如果是我们自定义的错误，直接抛出
      if (error.statusCode) {
        throw error
      }
      
      throw createError({
        statusCode: 500,
        message: '部分更新播出时段失败'
      })
    }
  } else if (method === 'DELETE') {
    try {
      // 检查该播出时段是否有关联的歌曲或排期
      const songs = await prisma.song.count({
        where: { preferredPlayTimeId: id }
      })
      
      const schedules = await prisma.schedule.count({
        where: { playTimeId: id }
      })
      
      // 删除该播出时段
      const deletedPlayTime = await prisma.playTime.delete({
        where: { id }
      })
      
      // 如果有关联的歌曲或排期，将它们的playTimeId设为null
      if (songs > 0) {
        await prisma.song.updateMany({
          where: { preferredPlayTimeId: id },
          data: { preferredPlayTimeId: null }
        })
      }
      
      if (schedules > 0) {
        await prisma.schedule.updateMany({
          where: { playTimeId: id },
          data: { playTimeId: null }
        })
      }
      
      // 清除相关缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSchedulesCache()
        await cacheService.clearPlayTimesCache()
        if (songs > 0) {
          await cacheService.clearSongsCache()
        }
        console.log('[Cache] 缓存已清除（播放时间删除）')
      } catch (cacheError) {
        console.warn('[Cache] 清除缓存失败:', cacheError)
      }

      return {
        message: '播出时段已成功删除',
        affected: { songs, schedules }
      }
    } catch (error) {
      console.error('删除播出时段失败:', error)
      throw createError({
        statusCode: 500,
        message: '删除播出时段失败'
      })
    }
  } else {
    throw createError({
      statusCode: 405,
      message: '不支持的请求方法'
    })
  }
})