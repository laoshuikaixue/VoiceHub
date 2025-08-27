import { db } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能访问'
    })
  }
  
  if (!['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理学期'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.semesterId) {
    throw createError({
      statusCode: 400,
      message: '学期ID不能为空'
    })
  }
  
  // 检查学期是否存在
  const semester = await prisma.semester.findUnique({
    where: {
      id: body.semesterId
    }
  })
  
  if (!semester) {
    throw createError({
      statusCode: 404,
      message: '学期不存在'
    })
  }
  
  // 使用事务确保数据一致性
  await prisma.$transaction(async (tx) => {
    // 先将所有学期设为非活跃
    await tx.semester.updateMany({
      where: {
        isActive: true
      },
      data: {
        isActive: false
      }
    })
    
    // 设置指定学期为活跃
    await tx.semester.update({
      where: {
        id: body.semesterId
      },
      data: {
        isActive: true
      }
    })
  })
  
  return { message: '活跃学期设置成功' }
})
