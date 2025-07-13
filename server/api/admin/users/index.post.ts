import bcrypt from 'bcrypt'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || user.role !== 'ADMIN') {
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
    
    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        username: body.username,
        password: hashedPassword,
        role: body.role === 'ADMIN' ? 'ADMIN' : 'USER',
        grade: body.grade,
        class: body.class
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        grade: true,
        class: true
      }
    })
    
    return newUser
  } catch (error) {
    console.error('创建用户失败:', error)
    throw createError({
      statusCode: 500,
      message: '创建用户失败'
    })
  }
}) 