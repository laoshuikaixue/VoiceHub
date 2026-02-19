import { db, eq, and, userIdentities } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const { provider, id } = body

  if (!provider) {
    throw createError({ statusCode: 400, message: '缺少提供商参数' })
  }

  // 如果提供了 ID，按 ID 解绑
  if (id) {
    await db
      .delete(userIdentities)
      .where(and(eq(userIdentities.id, id), eq(userIdentities.userId, user.id)))
  } else {
    // 否则解绑该 Provider 下的所有绑定
    await db
      .delete(userIdentities)
      .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, provider)))
  }

  return { success: true }
})
