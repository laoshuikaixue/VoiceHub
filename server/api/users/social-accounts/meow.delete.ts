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

    // 检查用户是否存在
    const userDataResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    const userData = userDataResult[0]

    if (!userData) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 解除 MeoW 绑定
    await db
      .update(users)
      .set({
        meowNickname: null,
        meowBoundAt: null
      })
      .where(eq(users.id, userId))

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
