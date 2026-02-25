import otplib from 'otplib'
const { authenticator } = otplib
import { db, userIdentities, eq, and, users } from '~/drizzle/db'
import { twoFactorCodes } from '~~/server/utils/twoFactorStore'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { code, type, token } = body

  if (!code || !type) {
    throw createError({ statusCode: 400, message: '缺少必要参数' })
  }

  // 验证预认证临时令牌
  let targetUserId: number

  if (token) {
    try {
      const decoded = JWTEnhanced.verify(token) as any
      if (decoded.type !== 'pre-auth' || decoded.scope !== '2fa_pending') {
        throw new Error('无效的预认证令牌')
      }
      targetUserId = decoded.userId
    } catch (e) {
      throw createError({ statusCode: 401, message: '会话已失效，请重新登录' })
    }
  } else {
    // 强制要求 Token
    throw createError({ statusCode: 400, message: '缺少预认证令牌，请重新登录' })
  }

  // 获取用户信息
  const userResult = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)
  const user = userResult[0]
  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  let verified = false

  if (type === 'totp') {
    const identity = await db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.userId, targetUserId), eq(userIdentities.provider, 'totp'))
    })
    if (!identity) {
      throw createError({ statusCode: 400, message: '未开启TOTP验证' })
    }
    verified = authenticator.check(code, identity.providerUserId)
    
    if (!verified) {
      throw createError({ statusCode: 400, message: '动态验证码错误' })
    }
  } else if (type === 'email') {
    const stored = twoFactorCodes.get(targetUserId)
    
    if (!stored) {
      throw createError({ statusCode: 400, message: '验证码已过期或不存在' })
    }

    if (stored.expiresAt <= Date.now()) {
      twoFactorCodes.delete(targetUserId)
      throw createError({ statusCode: 400, message: '验证码已过期' })
    }

    // 检查尝试次数
    if (stored.attempts >= 5) {
      twoFactorCodes.delete(targetUserId)
      throw createError({ statusCode: 400, message: '验证尝试次数过多，请重新获取' })
    }

    if (stored.code === code) {
      verified = true
      twoFactorCodes.delete(targetUserId) // 验证成功后删除
    } else {
      // 增加尝试次数
      stored.attempts++
      twoFactorCodes.set(targetUserId, stored)
      throw createError({ statusCode: 400, message: `验证码错误，剩余尝试次数：${5 - stored.attempts}` })
    }
  } else {
    throw createError({ statusCode: 400, message: '不支持的验证类型' })
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
  const authToken = JWTEnhanced.generateToken(user.id, user.role)
  
  const isSecure =
      getRequestURL(event).protocol === 'https:' ||
      getRequestHeader(event, 'x-forwarded-proto') === 'https'

  setCookie(event, 'auth-token', authToken, {
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
