import { createError, defineEventHandler, getHeader } from 'h3'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // 验证用户身份
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }

    const token = authHeader.substring(7)
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    } catch (error) {
      throw createError({
        statusCode: 401,
        statusMessage: '无效的访问令牌'
      })
    }

    const userId = decoded.userId

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 解除 MeoW 绑定
    await prisma.user.update({
      where: { id: userId },
      data: {
        meowNickname: null,
        meowBoundAt: null
      }
    })

    return {
      success: true,
      message: 'MeoW 账号解绑成功'
    }
  } catch (error) {
    console.error('解绑 MeoW 账号失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '解绑失败，请稍后重试'
    })
  }
})