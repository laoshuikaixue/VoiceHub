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
      message: '只有管理员才能添加播出时段'
    })
  }
  
  // 获取请求体
  const body = await readBody(event)
  
  // 验证必填字段
  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: '时段名称不能为空'
    })
  }
  
  // 验证时间格式（如果提供了时间）
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
    // 检查名称是否已存在
    const existingPlayTime = await prisma.playTime.findFirst({
      where: {
        name: {
          equals: body.name,
          mode: 'insensitive' // 忽略大小写
        }
      }
    })
    
    if (existingPlayTime) {
      throw createError({
        statusCode: 400,
        message: '播出时段名称已存在，请使用其他名称'
      })
    }
    
    // 创建新的播出时段
    const newPlayTime = await prisma.playTime.create({
      data: {
        name: body.name,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        description: body.description || null,
        enabled: body.enabled !== undefined ? body.enabled : true
      }
    })

    // 清除相关缓存
    try {
      await CacheService.clearSchedulesCache()
      await CacheService.clearPlayTimesCache()
    } catch (cacheError) {
      console.warn('清除缓存失败:', cacheError)
    }

    return newPlayTime
  } catch (error: any) {
    console.error('创建播出时段失败:', error)
    
    // 如果是我们自定义的错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: '创建播出时段失败'
    })
  }
})