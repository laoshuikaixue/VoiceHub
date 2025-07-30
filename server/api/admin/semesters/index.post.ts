import { prisma } from '../../../models/schema'

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

  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: '学期名称不能为空'
    })
  }
  
  try {
    // 检查学期名称是否已存在
    const existingSemester = await prisma.semester.findUnique({
      where: {
        name: body.name
      }
    })
    
    if (existingSemester) {
      throw createError({
        statusCode: 400,
        message: '该学期名称已存在'
      })
    }
    
    // 如果设置为活跃学期，先将其他学期设为非活跃
    if (body.isActive) {
      await prisma.semester.updateMany({
        where: {
          isActive: true
        },
        data: {
          isActive: false
        }
      })
    }
    
    // 创建新学期
    const semester = await prisma.semester.create({
      data: {
        name: body.name,
        isActive: body.isActive || false
      }
    })
    
    return semester
  } catch (error: any) {
    console.error('创建学期失败:', error)
    
    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: 500,
        message: '创建学期失败，请稍后重试'
      })
    }
  }
})
