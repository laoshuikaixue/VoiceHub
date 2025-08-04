import bcrypt from 'bcrypt'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const body = await readBody(event)
  
  // 验证必填字段
  if (!body.name || !body.username || !body.password) {
    throw createError({
      statusCode: 400,
      message: '姓名、账号名和密码不能为空'
    })
  }
  
  try {
    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: {
        username: body.username
      }
    })
    
    if (existingUser) {
      throw createError({
        statusCode: 400,
        message: '账号名已存在'
      })
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(body.password, 10)

    // 角色权限控制
    let validRole = 'USER'
    if (body.role && ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
      // 超级管理员可以创建任何角色的用户
      if (user.role === 'SUPER_ADMIN') {
        validRole = body.role
      } 
      // 管理员只能创建管理员以下的角色（USER, SONG_ADMIN）
      else if (user.role === 'ADMIN') {
        if (['USER', 'SONG_ADMIN'].includes(body.role)) {
          validRole = body.role
        } else {
          throw createError({
            statusCode: 403,
            message: '管理员只能创建用户和歌曲管理员角色'
          })
        }
      }
      // 其他角色不能创建用户
      else {
        throw createError({
          statusCode: 403,
          message: '没有权限创建用户'
        })
      }
    }

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        username: body.username,
        password: hashedPassword,
        role: validRole,
        grade: body.grade,
        class: body.class
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    return {
      success: true,
      user: newUser,
      message: '用户创建成功'
    }
  } catch (error) {
    console.error('创建用户失败:', error)
    throw createError({
      statusCode: 500,
      message: '创建用户失败'
    })
  }
})