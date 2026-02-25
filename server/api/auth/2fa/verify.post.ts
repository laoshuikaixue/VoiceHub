import otplib from 'otplib'
const { authenticator } = otplib
import { db, userIdentities, eq, and, users } from '~/drizzle/db'
import { twoFactorCodes } from '~~/server/utils/twoFactorStore'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, code, type } = body

  if (!userId || !code || !type) {
    throw createError({ statusCode: 400, message: '缺少必要参数' })
  }

  // 获取用户信息
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = userResult[0]
  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  let verified = false

  if (type === 'totp') {
    const identity = await db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.userId, userId), eq(userIdentities.provider, 'totp'))
    })
    if (!identity) {
      throw createError({ statusCode: 400, message: '未开启TOTP验证' })
    }
    verified = authenticator.check(code, identity.providerUserId)
  } else if (type === 'email') {
    const stored = twoFactorCodes.get(userId)
    if (stored && stored.code === code && stored.expiresAt > Date.now()) {
      verified = true
      twoFactorCodes.delete(userId) // 验证成功后删除
    } else {
       if (stored && stored.expiresAt <= Date.now()) {
          twoFactorCodes.delete(userId)
          throw createError({ statusCode: 400, message: '验证码已过期' })
       }
    }
  } else {
    throw createError({ statusCode: 400, message: '不支持的验证类型' })
  }

  if (!verified) {
    throw createError({ statusCode: 401, message: '验证码错误' })
  }

  // 验证通过，更新登录信息
  const clientIp = getClientIP(event)
  
  await db.update(users)
    .set({
      lastLogin: getBeijingTime(),
      lastLoginIp: clientIp
    })
    .where(eq(users.id, user.id))
    .catch((err) => console.error('Error updating user login info:', err))

  // 生成Token
  const token = JWTEnhanced.generateToken(user.id, user.role)
  
  const isSecure =
      getRequestURL(event).protocol === 'https:' ||
      getRequestHeader(event, 'x-forwarded-proto') === 'https'

  setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
  })

  return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        grade: user.grade,
        class: user.class,
        role: user.role,
        needsPasswordChange: !user.passwordChangedAt,
        has2FA: true
      }
  }
})
