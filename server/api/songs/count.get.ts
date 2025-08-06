import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 获取查询参数
    const query = getQuery(event)
    const semester = query.semester as string
    
    // 构建查询条件
    const whereCondition: any = {}
    if (semester) {
      whereCondition.semester = semester
    }
    
    // 获取歌曲总数
    const count = await prisma.song.count({
      where: whereCondition
    })
    
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