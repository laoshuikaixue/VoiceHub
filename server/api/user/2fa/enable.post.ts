import otplib from 'otplib'
const { authenticator } = otplib
import { db, userIdentities, eq, and } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  const body = await readBody(event)
  const { token, secret } = body

  if (!token || !secret) {
    throw createError({ statusCode: 400, message: '缺少验证码或密钥' })
  }

  const isValid = authenticator.check(token, secret)
  if (!isValid) {
    throw createError({ statusCode: 400, message: '验证码错误' })
  }

  // 检查是否已存在
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  if (existing) {
     // 更新密钥
     await db.update(userIdentities)
       .set({ providerUserId: secret })
       .where(eq(userIdentities.id, existing.id))
  } else {
    // 保存到数据库
    await db.insert(userIdentities).values({
      userId: user.id,
      provider: 'totp',
      providerUserId: secret,
      createdAt: new Date()
    })
  }

  return { success: true }
})
