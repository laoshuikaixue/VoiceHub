import { prisma } from '../../models/schema'

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
      message: '只有管理员才能标记歌曲已播放'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID不能为空'
    })
  }
  
  // 检查歌曲是否存在
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
  
  // 标记歌曲已播放
  const updatedSong = await prisma.song.update({
    where: {
      id: body.songId
    },
    data: {
      played: true,
      playedAt: new Date()
    }
  })
  
  // 更新对应的排期
  await prisma.schedule.updateMany({
    where: {
      songId: body.songId
    },
    data: {
      played: true
    }
  })
  
  return {
    id: updatedSong.id,
    title: updatedSong.title,
    artist: updatedSong.artist,
    played: updatedSong.played,
    playedAt: updatedSong.playedAt
  }
}) 