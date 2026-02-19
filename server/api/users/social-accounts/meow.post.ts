import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, eq, ne } from 'drizzle-orm'

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
    const userDataResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    const userData = userDataResult[0]

    if (!userData) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 检查是否有其他用户绑定了相同的昵称（仅用于记录，不阻止绑定）
    const existingUsers = await db
      .select({
        name: users.name,
        username: users.username
      })
      .from(users)
      .where(and(eq(users.meowNickname, nickname), ne(users.id, userId)))

    if (existingUsers.length > 0) {
      console.log(
        `MeoW ID "${nickname}" 已被 ${existingUsers.length} 个其他用户绑定:`,
        existingUsers.map((u) => `${u.name}(${u.username})`).join(', ')
      )
    }

    // 更新用户的 MeoW 绑定信息
    await db
      .update(users)
      .set({
        meowNickname: nickname,
        meowBoundAt: new Date()
      })
      .where(eq(users.id, userId))

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
