import { prisma } from '../../models/schema'
import type { PlayTime } from '@prisma/client'

export default defineEventHandler(async (event) => {
  try {
    // 获取系统设置，检查是否启用播出时段选择
    const settings = await prisma.systemSettings.findFirst()
    const enabled = settings?.enablePlayTimeSelection || false
    
    // 如果启用了播出时段选择，则获取所有启用的播出时段
    let playTimes: PlayTime[] = []
    if (enabled) {
      playTimes = await prisma.playTime.findMany({
        where: { enabled: true },
        orderBy: { startTime: 'asc' }
      })
    }
    
    return {
      enabled,
      playTimes
    }
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
}) 