import { createError, defineEventHandler, readBody } from 'h3'

import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, eq, ne } from 'drizzle-orm'

// 生成6位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 验证码存储（生产环境应使用Redis等持久化存储）
const verificationCodes = new Map<string, { code: string; userId: number; expiresAt: number }>()

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
    const body = await readBody(event)
    const { action, meowId, verificationCode } = body

    // 如果是验证并绑定操作
    if (action === 'verify_and_bind' && verificationCode) {
      const storedData = verificationCodes.get(meowId)
      if (!storedData) {
        throw createError({
          statusCode: 400,
          statusMessage: '验证码已过期，请重新发送'
        })
      }

      if (storedData.userId !== userId) {
        throw createError({
          statusCode: 400,
          statusMessage: '验证码不匹配'
        })
      }

      if (Date.now() > storedData.expiresAt) {
        verificationCodes.delete(meowId)
        throw createError({
          statusCode: 400,
          statusMessage: '验证码已过期，请重新发送'
        })
      }

      if (storedData.code !== verificationCode) {
        throw createError({
          statusCode: 400,
          statusMessage: '验证码错误'
        })
      }

      // 验证通过，绑定账号
      await db
        .update(users)
        .set({
          meowNickname: meowId,
          meowBoundAt: new Date()
        })
        .where(eq(users.id, userId))

      // 清除验证码
      verificationCodes.delete(meowId)

      return {
        success: true,
        message: 'MeoW 账号绑定成功！'
      }
    }

    // 如果是发送验证码操作
    if (action === 'send_verification') {
      if (!meowId || !meowId.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: '请输入 MeoW 用户 ID'
        })
      }

      // 验证用户ID格式
      if (meowId.includes('/')) {
        throw createError({
          statusCode: 400,
          statusMessage: '用户 ID 不能包含斜杠'
        })
      }

      // 检查用户是否存在
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      const userExists = userResult[0]

      if (!userExists) {
        throw createError({
          statusCode: 404,
          statusMessage: '用户不存在'
        })
      }

      // 检查是否有其他用户绑定了相同的 MeoW ID（仅用于记录，不阻止绑定）
      const existingUsers = await db
        .select({
          name: users.name,
          username: users.username
        })
        .from(users)
        .where(and(eq(users.meowNickname, meowId), ne(users.id, userId)))

      if (existingUsers.length > 0) {
        console.log(
          `MeoW ID "${meowId}" 已被 ${existingUsers.length} 个其他用户绑定:`,
          existingUsers.map((u) => `${u.name}(${u.username})`).join(', ')
        )
      }

      // 生成验证码
      const code = generateVerificationCode()
      const expiresAt = Date.now() + 5 * 60 * 1000 // 5分钟过期

      // 存储验证码
      verificationCodes.set(meowId, {
        code,
        userId,
        expiresAt
      })

      // 发送验证码到 MeoW
      const message = `VoiceHub 账号绑定验证码：${code}（5分钟内有效）`
      const title = 'VoiceHub 账号绑定'

      try {
        // 使用 GET 请求发送验证码
        const meowUrl = `https://api.chuckfang.com/${encodeURIComponent(meowId)}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`

        const response = await fetch(meowUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'VoiceHub/1.0'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 200) {
          throw new Error(result.message || '发送失败')
        }

        return {
          success: true,
          message: '验证码已发送到您的 MeoW，请查收并输入验证码完成绑定',
          requiresVerification: true
        }
      } catch (error) {
        // 清除验证码
        verificationCodes.delete(meowId)

        console.error('发送 MeoW 验证码失败:', error)
        throw createError({
          statusCode: 500,
          statusMessage: '发送验证码失败，请检查 MeoW ID 是否正确或稍后重试'
        })
      }
    }

    // 如果不是有效的操作
    throw createError({
      statusCode: 400,
      statusMessage: '无效的操作'
    })
  } catch (error) {
    console.error('MeoW 绑定失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '绑定失败，请稍后重试'
    })
  }
})
