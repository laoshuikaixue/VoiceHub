import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '需要管理员权限'
    })
  }

  // 获取学期ID
  const semesterId = parseInt(getRouterParam(event, 'id') || '0')
  if (!semesterId || isNaN(semesterId)) {
    throw createError({
      statusCode: 400,
      statusMessage: '无效的学期ID'
    })
  }

  // 检查学期是否存在
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId }
  })

  if (!semester) {
    throw createError({
      statusCode: 404,
      statusMessage: '学期不存在'
    })
  }

  // 检查是否为当前活跃学期
  if (semester.isActive) {
    throw createError({
      statusCode: 400,
      statusMessage: '不能删除当前活跃的学期'
    })
  }

  // 检查是否有关联的歌曲
  const songCount = await prisma.song.count({
    where: { semester: semester.name }
  })

  if (songCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `该学期下还有 ${songCount} 首歌曲，无法删除`
    })
  }

  // 删除学期
  await prisma.semester.delete({
    where: { id: semesterId }
  })

  return {
    success: true,
    message: '学期删除成功'
  }
})