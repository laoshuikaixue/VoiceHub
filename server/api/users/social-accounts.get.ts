import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

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

    // 获取用户的社交账号绑定信息
    const userDataResult = await db
      .select({
        id: users.id,
        meowNickname: users.meowNickname,
        meowBoundAt: users.meowBoundAt
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const userData = userDataResult[0]

    if (!userData) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    const socialAccounts = {}

    // MeoW 账号信息
    if (userData.meowNickname) {
      socialAccounts.meow = {
        nickname: userData.meowNickname,
        boundAt: userData.meowBoundAt
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
