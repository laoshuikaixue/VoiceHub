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
  
  // 查找歌曲
  const song = await prisma.song.findUnique({
    where: {
      id: body.songId
    }
  })
  
  if (!song) {
    throw createError({
      statusCode: 404,
      message: '歌曲不存在'
    })
  }
  
  // 删除歌曲的所有投票
  await prisma.vote.deleteMany({
    where: {
      songId: body.songId
    }
  })
  
  // 删除歌曲的所有排期
  await prisma.schedule.deleteMany({
    where: {
      songId: body.songId
    }
  })
  
  // 删除歌曲
  await prisma.song.delete({
    where: {
      id: body.songId
    }
  })
  
  return {
    message: '歌曲已成功删除',
    songId: body.songId
  }
})