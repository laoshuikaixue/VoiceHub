import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 使用认证中间件提供的用户信息
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }

    const userId = user.id

    // 检查用户是否存在
    const userData = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userData) {
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