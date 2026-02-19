import { db, eq, and, userIdentities } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const { provider } = body

  if (!provider) {
    throw createError({ statusCode: 400, message: '缺少提供商参数' })
  }

  // 阻止解绑唯一的登录方式（可选，但如果不能保证有密码登录则是最佳实践）
  // 在本系统中，密码登录总是可用的，所以解绑是安全的。

  await db
    .delete(userIdentities)
    .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, provider)))

  return { success: true }
})
