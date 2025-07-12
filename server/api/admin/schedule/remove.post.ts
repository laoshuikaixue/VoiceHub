import { PrismaClient } from '@prisma/client'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: '需要管理员权限'
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
    
    const prisma = new PrismaClient()
    
    // 删除排期
    const deletedSchedule = await prisma.schedule.delete({
      where: {
        id: Number(scheduleId)
      }
    })
    
    await prisma.$disconnect()
    
    return {
      success: true,
      schedule: deletedSchedule
    }
  } catch (error: any) {
    console.error('移除排期失败:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '移除排期失败'
    })
  }
}) 