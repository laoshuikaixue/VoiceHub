import bcrypt from 'bcrypt'
import { db, users, userIdentities } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTime } from '~/utils/timeUtils'

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

  // 验证用户名格式
  if (username.length < 3 || username.length > 30) {
    throw createError({ statusCode: 400, message: '用户名长度需要在3-30个字符之间' })
  }

  // 验证用户名仅包含字母、数字、下划线、连字符
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw createError({ statusCode: 400, message: '用户名仅可包含英文、数字、下划线和连字符' })
  }

  // 验证密码长度
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: '密码长度至少为8个字符' })
  }

  // 验证密码一致性
  if (password !== confirmPassword) {
    throw createError({ statusCode: 400, message: '两次输入的密码不一致' })
  }

  const clientIp = getClientIP(event)

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
      const userId = await tx.insert(users).values({
        username,
        password: hashedPassword,
        role: 'USER',
        status: 'active',
        createdAt: getBeijingTime(),
        updatedAt: getBeijingTime(),
        forcePasswordChange: false
      })

      // 获取插入的用户ID
      const insertedUser = await tx.query.users.findFirst({
        where: (t, { eq }) => eq(t.username, username),
        columns: { id: true }
      })

      if (!insertedUser) {
        throw new Error('Failed to retrieve created user')
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
