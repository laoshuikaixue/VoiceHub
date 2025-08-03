import { hasPermission } from '../../../utils/permissions.js'

export default defineEventHandler(async (event) => {
  // 验证用户认证
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '需要登录'
    })
  }

  // 检查排期管理权限
  const canManageSchedule = hasPermission(user, 'schedule.manage')
  if (!canManageSchedule) {
    throw createError({
      statusCode: 403,
      statusMessage: '没有排期管理权限'
    })
  }
  
  try {
    const body = await readBody(event)
    const { schedules } = body
    
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少排期数据'
      })
    }
    
    const prisma = event.context.prisma
    
    // 批量更新排期顺序
    const results = await Promise.all(
      schedules.map(async (item) => {
        return prisma.schedule.update({
          where: {
            id: Number(item.id)
          },
          data: {
            sequence: item.sequence
          }
        })
      })
    )
    
    return {
      success: true,
      count: results.length
    }
  } catch (error: any) {
    console.error('更新排期顺序失败:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '更新排期顺序失败'
    })
  }
})