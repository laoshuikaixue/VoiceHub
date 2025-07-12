import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: '邮箱和密码不能为空'
    })
  }
  
  // 查找用户
  const user = await prisma.user.findUnique({
    where: {
      email: body.email
    }
  })
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '用户不存在'
    })
  }
  
  // 验证密码
  const isPasswordValid = await bcrypt.compare(body.password, user.password)
  
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      message: '密码不正确'
    })
  }
  
  // 生成JWT令牌
  const token = jwt.sign(
    { 
      userId: user.id,
      role: user.role
    },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  )
  
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  }
}) 