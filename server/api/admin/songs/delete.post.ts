import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID不能为空'
    })
  }
  
  try {
    // 使用事务确保删除操作的原子性
    const result = await prisma.$transaction(async (tx) => {
      // 在事务中重新检查歌曲是否存在
      const song = await tx.song.findUnique({
        where: {
          id: body.songId
        }
      })
      
      if (!song) {
        throw createError({
          statusCode: 404,
          message: '歌曲不存在或已被删除'
        })
      }
      
      console.log(`开始删除歌曲: ${song.title} (ID: ${body.songId})`)
      
      // 删除歌曲的所有投票
      const deletedVotes = await tx.vote.deleteMany({
        where: {
          songId: body.songId
        }
      })
      console.log(`删除了 ${deletedVotes.count} 个投票记录`)
      
      // 删除歌曲的所有排期
      const deletedSchedules = await tx.schedule.deleteMany({
        where: {
          songId: body.songId
        }
      })
      console.log(`删除了 ${deletedSchedules.count} 个排期记录`)
      
      // 删除歌曲
      const deletedSong = await tx.song.delete({
        where: {
          id: body.songId
        }
      })
      
      console.log(`成功删除歌曲: ${deletedSong.title}`)
      
      return {
        message: '歌曲已成功删除',
        songId: body.songId,
        deletedVotes: deletedVotes.count,
        deletedSchedules: deletedSchedules.count
      }
    })
    
    return result
    
  } catch (error: any) {
    console.error('删除歌曲时发生错误:', error)
    
    // 如果是已经格式化的错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 处理Prisma特定错误
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        message: '歌曲不存在或已被删除'
      })
    }
    
    // 其他未知错误
    throw createError({
      statusCode: 500,
      message: '删除歌曲时发生未知错误'
    })
  }
})