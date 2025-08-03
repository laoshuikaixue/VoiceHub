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

    // 获取用户的 MeoW 绑定信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        meowNickname: true
      }
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    if (!user.meowNickname) {
      throw createError({
        statusCode: 400,
        statusMessage: '尚未绑定 MeoW 账号'
      })
    }

    // 发送测试通知
    const message = `这是来自 VoiceHub 的测试通知！您的账号 ${user.username} 已成功绑定 MeoW。`
    const title = 'VoiceHub 测试通知'
    
    const meowUrl = `https://api.chuckfang.com/${encodeURIComponent(user.meowNickname)}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`
    
    const response = await fetch(meowUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VoiceHub/1.0'
      }
    })

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: '发送测试通知失败'
      })
    }

    const result = await response.json()
    
    if (result.status !== 200) {
      throw createError({
        statusCode: 500,
        statusMessage: result.message || '发送测试通知失败'
      })
    }

    return {
      success: true,
      message: '测试通知发送成功'
    }
  } catch (error) {
    console.error('发送 MeoW 测试通知失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '发送测试通知失败，请稍后重试'
    })
  }
})