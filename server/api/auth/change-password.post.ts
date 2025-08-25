import bcrypt from 'bcrypt'
import { prisma } from '../../models/schema'
import { recordLoginFailure, recordLoginSuccess } from '../../services/securityService'

export default defineEventHandler(async (event) => {
  // 验证用户身份
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '未授权'
    })
  }
  
  const body = await readBody(event)
  if (!body.currentPassword || !body.newPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: '当前密码和新密码都是必需的'
    })
  }

  try {
    // 查询用户详细信息
    let userDetails
    try {
      userDetails = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          username: true,
          password: true
        }
      })
    } catch (prismaError: any) {
      const result = await prisma.$queryRaw`
        SELECT id, username, password 
        FROM "User" 
        WHERE id = ${user.id}
      `
      
      if (Array.isArray(result) && result.length > 0) {
        userDetails = result[0] as any
      }
    }

    if (!userDetails) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(body.currentPassword, userDetails.password)
    
    if (!isPasswordValid) {
      // 记录安全事件
      const clientIp = getRequestIP(event, { xForwardedFor: true }) || '未知IP'
      recordLoginFailure(userDetails.username, clientIp)
      
      throw createError({
        statusCode: 400,
        statusMessage: '当前密码不正确'
      })
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(body.newPassword, userDetails.password)
    if (isSamePassword) {
      throw createError({
        statusCode: 400,
        statusMessage: '新密码不能与当前密码相同'
      })
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(body.newPassword, 12)

    // 更新密码
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedNewPassword }
      })
    } catch (updateError: any) {
      // 如果Prisma更新失败，尝试使用原始SQL
      await prisma.$executeRaw`
        UPDATE "User" 
        SET password = ${hashedNewPassword} 
        WHERE id = ${user.id}
      `
    }
    
    // 记录成功的密码修改
    recordLoginSuccess(userDetails.username)
    
    return {
      success: true,
      message: '密码修改成功'
    }
  } catch (error: any) {
    // 已格式化的错误直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 记录错误信息
    console.error('修改密码过程中发生未处理的错误:', error)
    
    // 创建错误响应
    throw createError({
      statusCode: 500,
      statusMessage: '修改密码失败: ' + (error.message || '未知错误')
    })
  }
})