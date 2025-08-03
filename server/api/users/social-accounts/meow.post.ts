import { createError, defineEventHandler, readBody, getHeader } from 'h3'
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
    const body = await readBody(event)
    const { nickname } = body

    if (!nickname) {
      throw createError({
        statusCode: 400,
        statusMessage: '昵称不能为空'
      })
    }

    // 验证昵称格式
    if (nickname.includes('/')) {
      throw createError({
        statusCode: 400,
        statusMessage: '昵称不能包含斜杠'
      })
    }

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

    // 检查昵称是否已被其他用户绑定
    const existingUser = await prisma.user.findFirst({
      where: {
        meowNickname: nickname,
        id: { not: userId }
      }
    })

    if (existingUser) {
      throw createError({
        statusCode: 400,
        statusMessage: '该昵称已被其他用户绑定'
      })
    }

    // 更新用户的 MeoW 绑定信息
    await prisma.user.update({
      where: { id: userId },
      data: {
        meowNickname: nickname,
        meowBoundAt: new Date()
      }
    })

    return {
      success: true,
      message: 'MeoW 账号绑定成功'
    }
  } catch (error) {
    console.error('绑定 MeoW 账号失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '绑定失败，请稍后重试'
    })
  }
})