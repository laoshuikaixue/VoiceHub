import { db, userIdentities, eq, and, users } from '~/drizzle/db'
import bcrypt from 'bcrypt'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const { password } = body

  if (!password) {
    throw createError({ statusCode: 400, message: '请输入密码' })
  }

  // 验证密码
  const dbUserResult = await db.select({ password: users.password }).from(users).where(eq(users.id, user.id)).limit(1)
  const dbUser = dbUserResult[0]

  if (!dbUser) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const isPasswordValid = await bcrypt.compare(password, dbUser.password)
  if (!isPasswordValid) {
    // 密码错误不应返回 401，否则会触发全局登出
    throw createError({ statusCode: 403, message: '密码错误' })
  }
  
  // 删除TOTP记录
  await db.delete(userIdentities)
    .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp')))

  return { success: true }
})
