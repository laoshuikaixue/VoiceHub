import { prisma } from '../../../models/schema'
import { hasPermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能删除歌曲'
    })
  }

  // 检查权限
  const canManageSongs = await hasPermission(user.id, 'song_manage')
  if (!canManageSongs) {
    throw createError({
      statusCode: 403,
      message: '没有歌曲管理权限'
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