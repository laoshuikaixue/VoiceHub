import { createError, defineEventHandler, getCookie } from 'h3'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // 从认证中间件获取用户信息
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: '请先登录'
      })
    }

    const userId = user.id

    // 检查用户是否存在
    const userRecord = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userRecord) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 检查是否已绑定 MeoW
    if (!userRecord.meowNickname) {
      throw createError({
        statusCode: 400,
        statusMessage: '您尚未绑定 MeoW 账号'
      })
    }

    // 解绑 MeoW 账号
    await prisma.user.update({
      where: { id: userId },
      data: {
        meowNickname: null,
        meowBoundAt: null
      }
    })

    return {
      success: true,
      message: 'MeoW 账号已成功解绑'
    }

  } catch (error) {
    console.error('MeoW 解绑失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '解绑失败，请稍后重试'
    })
  }
})