import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查请求方法
  if (getMethod(event) !== 'POST') {
    throw createError({
      statusCode: 405,
      message: '方法不被允许'
    })
  }

  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  try {
    // 解绑邮箱
    await db
      .update(users)
      .set({
        email: null,
        emailVerified: false,
        emailVerifiedAt: null
      })
      .where(eq(users.id, user.id))

    return {
      success: true,
      message: '邮箱已解绑'
    }
  } catch (error) {
    console.error('解绑邮箱失败:', error)

    throw createError({
      statusCode: 500,
      message: '解绑邮箱失败'
    })
  }
})
