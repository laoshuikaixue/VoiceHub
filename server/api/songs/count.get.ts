import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 获取歌曲总数
    const count = await prisma.song.count()
    
    return {
      count
    }
  } catch (error) {
    console.error('Error fetching song count:', error)
    throw createError({
      statusCode: 500,
      message: '获取歌曲数量失败'
    })
  }
}) 