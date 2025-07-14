import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能更新系统设置'
    })
  }
  
  try {
    const body = await readBody(event)
    
    // 验证请求体
    if (typeof body.enablePlayTimeSelection !== 'boolean') {
      throw createError({
        statusCode: 400,
        message: '请求参数无效'
      })
    }
    
    // 获取当前设置，如果不存在则创建
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      // 如果不存在，创建新设置
      settings = await prisma.systemSettings.create({
        data: {
          enablePlayTimeSelection: body.enablePlayTimeSelection
        }
      })
    } else {
      // 如果存在，更新设置
      settings = await prisma.systemSettings.update({
        where: {
          id: settings.id
        },
        data: {
          enablePlayTimeSelection: body.enablePlayTimeSelection
        }
      })
    }
    
    return settings
  } catch (error) {
    console.error('更新系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '更新系统设置失败'
    })
  }
}) 