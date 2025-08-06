import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能查看投稿状态'
    })
  }
  
  try {
    // 获取系统设置
    const systemSettings = await prisma.systemSettings.findFirst()
    
    // 超级管理员和管理员不受投稿限制
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
    
    if (!systemSettings?.enableSubmissionLimit) {
      return {
        limitEnabled: false,
        dailyLimit: null,
        weeklyLimit: null,
        dailyUsed: 0,
        weeklyUsed: 0,
        dailyRemaining: null,
        weeklyRemaining: null,
        submissionClosed: false
      }
    }

    // 检查是否设置了限额为0（关闭投稿）
    const dailyLimit = systemSettings.dailySubmissionLimit || 0
    const weeklyLimit = systemSettings.weeklySubmissionLimit || 0
    
    if ((dailyLimit === 0 && systemSettings.dailySubmissionLimit !== null) || 
        (weeklyLimit === 0 && systemSettings.weeklySubmissionLimit !== null)) {
      return {
        limitEnabled: true,
        dailyLimit: dailyLimit || null,
        weeklyLimit: weeklyLimit || null,
        dailyUsed: 0,
        weeklyUsed: 0,
        dailyRemaining: 0,
        weeklyRemaining: 0,
        submissionClosed: !isAdmin // 管理员不受投稿关闭限制
      }
    }
    
    const now = new Date()
    
    // 计算每日使用量
    let dailyUsed = 0
    if (systemSettings.dailySubmissionLimit && systemSettings.dailySubmissionLimit > 0) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
      
      dailyUsed = await prisma.song.count({
        where: {
          requesterId: user.id,
          createdAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        }
      })
    }
    
    // 计算每周使用量
    let weeklyUsed = 0
    if (systemSettings.weeklySubmissionLimit && systemSettings.weeklySubmissionLimit > 0) {
      const startOfWeek = new Date(now)
      const dayOfWeek = now.getDay()
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
      startOfWeek.setDate(now.getDate() - daysToSubtract)
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      weeklyUsed = await prisma.song.count({
        where: {
          requesterId: user.id,
          createdAt: {
            gte: startOfWeek,
            lt: endOfWeek
          }
        }
      })
    }
    
    return {
      limitEnabled: true,
      dailyLimit: systemSettings.dailySubmissionLimit || null,
      weeklyLimit: systemSettings.weeklySubmissionLimit || null,
      dailyUsed,
      weeklyUsed,
      dailyRemaining: systemSettings.dailySubmissionLimit ? Math.max(0, systemSettings.dailySubmissionLimit - dailyUsed) : null,
      weeklyRemaining: systemSettings.weeklySubmissionLimit ? Math.max(0, systemSettings.weeklySubmissionLimit - weeklyUsed) : null,
      submissionClosed: false
    }
  } catch (error) {
    console.error('获取投稿状态失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取投稿状态失败'
    })
  }
})