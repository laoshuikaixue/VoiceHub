import bcrypt from 'bcrypt'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (!body.email || !body.password || !body.name) {
    throw createError({
      statusCode: 400,
      message: '邮箱、密码和用户名不能为空'
    })
  }
  
  // 检查邮箱是否已被注册
  const existingUser = await prisma.user.findUnique({
    where: {
      email: body.email
    }
  })
  
  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: '该邮箱已被注册'
    })
  }
  
  // 加密密码
  const hashedPassword = await bcrypt.hash(body.password, 10)
  
  // 创建新用户
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      password: hashedPassword,
      role: 'USER' // 默认为普通用户
    }
  })
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
}) 