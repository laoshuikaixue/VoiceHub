import bcrypt from 'bcrypt'
import { db, users, userIdentities } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import { getBeijingTime } from '~/utils/timeUtils'
import { validateOAuthRegisterCredentials } from '~/utils/oauth-register'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, confirmPassword } = body
  const bindingToken = getCookie(event, 'binding-token')

  if (!bindingToken) {
    throw createError({ statusCode: 400, message: '注册会话已过期，请重新通过第三方登录发起' })
  }

  let payload
  try {
    payload = verifyBindingToken(bindingToken)
  } catch (e) {
    deleteCookie(event, 'binding-token')
    throw createError({ statusCode: 400, message: '无效的注册令牌' })
  }

  // 验证输入
  if (!username || !password || !confirmPassword) {
    throw createError({ statusCode: 400, message: '用户名、密码不能为空' })
  }

  const validationError = validateOAuthRegisterCredentials(username, password, confirmPassword)
  if (validationError) {
    throw createError({ statusCode: 400, message: validationError })
  }

  // 检查用户名是否已存在
  const existingUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.username, username)
  })

  if (existingUser) {
    throw createError({ statusCode: 409, message: '用户名已存在，请使用其他用户名' })
  }

  // 检查OAuth身份是否已被绑定
  const existingIdentity = await db.query.userIdentities.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.provider, payload.provider), eq(t.providerUserId, payload.providerUserId))
  })

  if (existingIdentity) {
    throw createError({ statusCode: 409, message: '该第三方账号已被绑定，请直接登录或绑定到现有账户' })
  }

  try {
    // 开事务创建用户和关联身份
    const result = await db.transaction(async (tx) => {
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10)

      // 创建用户
      const insertedUser = (await tx
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          role: 'USER',
          status: 'active',
          createdAt: getBeijingTime(),
          updatedAt: getBeijingTime(),
          forcePasswordChange: false
        })
        .returning({ id: users.id }))[0]

      if (!insertedUser) {
        throw new Error('Failed to create user')
      }

      // 关联OAuth身份
      await tx.insert(userIdentities).values({
        userId: insertedUser.id,
        provider: payload.provider,
        providerUserId: payload.providerUserId,
        providerUsername: payload.providerUsername,
        createdAt: getBeijingTime()
      })

      return insertedUser
    })

    // 清除绑定令牌
    deleteCookie(event, 'binding-token')

    // 生成JWT令牌
    const token = JWTEnhanced.generateToken(result.id, 'USER')

    // 自动判断是否需要secure
    const isSecure =
      getRequestURL(event).protocol === 'https:' ||
      getRequestHeader(event, 'x-forwarded-proto') === 'https'

    // 设置cookie
    setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/'
    })

    return {
      success: true,
      user: {
        id: result.id,
        username: username,
        role: 'USER'
      }
    }
  } catch (e: any) {
    console.error('OAuth register error:', e)
    throw createError({
      statusCode: 500,
      message: e.message || '注册失败，请稍后重试'
    })
  }
})
