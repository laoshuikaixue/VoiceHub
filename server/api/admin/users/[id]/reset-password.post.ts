import bcrypt from 'bcrypt'
import { prisma } from '../../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  // 安全获取ID参数
  const params = event.context.params || {}
  const id = parseInt(params.id || '')
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID'
    })
  }

  const body = await readBody(event)
  
  if (!body.newPassword) {
    throw createError({
      statusCode: 400,
      message: '新密码不能为空'
    })
  }
  
  try {
    // 查询用户是否存在
    const userExists = await prisma.user.findUnique({
      where: { id }
    })
    
    if (!userExists) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(body.newPassword, 10)
    
    // 更新密码，同时更新passwordChangedAt字段，使旧令牌失效
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date() // 添加密码修改时间戳
      }
    })
    
    return {
      success: true,
      message: '密码重置成功'
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    throw createError({
      statusCode: 500,
      message: '重置密码失败'
    })
  }
}) 