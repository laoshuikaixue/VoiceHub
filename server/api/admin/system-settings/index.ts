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
      message: '只有管理员才能查看系统设置'
    })
  }
  
  try {
    // 获取系统设置，如果不存在则创建默认设置
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          enablePlayTimeSelection: false
        }
      })
    }
    
    return settings
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取系统设置失败'
    })
  }
}) 