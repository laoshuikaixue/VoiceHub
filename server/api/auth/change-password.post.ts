import bcrypt from 'bcrypt'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权'
    })
  }

  const body = await readBody(event)
  
  if (!body.currentPassword || !body.newPassword) {
    throw createError({
      statusCode: 400,
      message: '当前密码和新密码不能为空'
    })
  }
  
  // 获取用户完整信息
  const currentUser = await prisma.user.findUnique({
    where: {
      id: user.userId
    }
  })
  
  if (!currentUser) {
    throw createError({
      statusCode: 404,
      message: '用户不存在'
    })
  }
  
  // 验证当前密码
  const isPasswordValid = await bcrypt.compare(body.currentPassword, currentUser.password)
  
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      message: '当前密码不正确'
    })
  }
  
  // 加密新密码
  const hashedPassword = await bcrypt.hash(body.newPassword, 10)
  
  // 更新密码
  await prisma.user.update({
    where: {
      id: user.userId
    },
    data: {
      password: hashedPassword
    }
  })
  
  return {
    success: true,
    message: '密码修改成功'
  }
}) 