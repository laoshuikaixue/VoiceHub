import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能标记歌曲'
    })
  }
  
  // 检查是否是管理员
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只有管理员可以标记歌曲为已播放'
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
  
  // 检查是否是撤回操作
  const isUnmark = body.unmark === true
  
  // 检查歌曲播放状态
  if (!isUnmark && song.played) {
    throw createError({
      statusCode: 400,
      message: '歌曲已经标记为已播放'
    })
  } else if (isUnmark && !song.played) {
    throw createError({
      statusCode: 400,
      message: '歌曲尚未标记为已播放'
    })
  }
  
  // 更新歌曲状态
  const updatedSong = await prisma.song.update({
    where: {
      id: body.songId
    },
    data: {
      played: !isUnmark,
      playedAt: isUnmark ? null : new Date()
    }
  })
  
  return {
    message: isUnmark ? '歌曲已成功撤回已播放状态' : '歌曲已成功标记为已播放',
    song: {
      id: updatedSong.id,
      title: updatedSong.title,
      artist: updatedSong.artist,
      played: updatedSong.played,
      playedAt: updatedSong.playedAt
    }
  }
}) 