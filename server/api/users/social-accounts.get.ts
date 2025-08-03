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

    // 获取用户的社交账号绑定信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        meowNickname: true,
        meowBoundAt: true
      }
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    const socialAccounts = {}

    // MeoW 账号信息
    if (user.meowNickname) {
      socialAccounts.meow = {
        nickname: user.meowNickname,
        boundAt: user.meowBoundAt
      }
    }

    return socialAccounts
  } catch (error) {
    console.error('获取社交账号信息失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '获取社交账号信息失败'
    })
  }
})