import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能撤回歌曲'
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
  
  // 检查是否是用户自己的投稿
  if (song.requesterId !== user.id && user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只能撤回自己的投稿'
    })
  }
  
  // 检查歌曲是否已经播放
  if (song.played) {
    throw createError({
      statusCode: 400,
      message: '已播放的歌曲不能撤回'
    })
  }
  
  // 删除歌曲的所有投票
  await prisma.vote.deleteMany({
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
    message: '歌曲已成功撤回',
    songId: body.songId
  }
}) 