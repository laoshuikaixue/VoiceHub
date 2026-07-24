import bcrypt from 'bcryptjs'
import { db, users, userIdentities } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import { getBeijingTime } from '~/utils/timeUtils'
import { validateOAuthRegisterCredentials } from '~/utils/oauth-register'
import { isSecureRequest } from '~~/server/utils/request-utils'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  // 检查是否允许 OAuth 注册
  const config = await db.query.systemSettings.findFirst()
  if (!config?.allowOAuthRegistration) {
    throw createApiError(403, 'AUTH_OAUTH_REGISTER_DISABLED_BIND', '系统已关闭第三方账号注册功能，请登录现有账号进行绑定')
  }

  const body = await readBody(event)
  const { password, confirmPassword } = body
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const selectedGrade = typeof body.grade === 'string' ? body.grade.trim() : ''
  const selectedClass = typeof body.class === 'string' ? body.class.trim() : ''
  const bindingToken = getCookie(event, 'binding-token')

  if (!bindingToken) {
    throw createApiError(400, 'AUTH_REGISTER_SESSION_EXPIRED', '注册会话已过期，请重新通过第三方登录发起')
  }

  let payload
  try {
    payload = verifyBindingToken(bindingToken)
  } catch (e) {
    deleteCookie(event, 'binding-token')
    throw createApiError(400, 'AUTH_INVALID_REGISTER_TOKEN', '无效的注册令牌')
  }

  // 验证输入
  if (!username || !name || !password || !confirmPassword) {
    throw createApiError(400, 'AUTH_NAME_USERNAME_PASSWORD_REQUIRED', '姓名、用户名、密码不能为空')
  }

  const validationError = validateOAuthRegisterCredentials(username, password, confirmPassword)
  if (validationError) {
    throw createError({ statusCode: 400, message: validationError })
  }

  if ((selectedGrade && !selectedClass) || (!selectedGrade && selectedClass)) {
    throw createApiError(400, 'AUTH_GRADE_CLASS_TOGETHER', '年级和班级需要同时选择，或全部留空')
  }

  if (selectedGrade && selectedClass) {
    const existingClass = await db.query.users.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.status, 'active'), eq(t.grade, selectedGrade), eq(t.class, selectedClass)),
      columns: { id: true }
    })

    if (!existingClass) {
      throw createApiError(400, 'AUTH_GRADE_CLASS_MUST_EXIST', '请选择系统内已存在的年级和班级')
    }
  }

  // 检查用户名是否已存在
  const existingUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.username, username)
  })

  if (existingUser) {
    throw createApiError(409, 'AUTH_USERNAME_TAKEN', '用户名已存在，请使用其他用户名')
  }

  // 检查OAuth身份是否已被绑定
  const existingIdentity = await db.query.userIdentities.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.provider, payload.provider), eq(t.providerUserId, payload.providerUserId))
  })

  if (existingIdentity) {
    throw createApiError(409, 'AUTH_OAUTH_ALREADY_BOUND', '该第三方账号已被绑定，请直接登录或绑定到现有账户')
  }

  try {
    // 开事务创建用户和关联身份
    const result = await db.transaction(async (tx) => {
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10)
      const now = getBeijingTime()

      // 创建用户
      const insertedUser = (await tx
        .insert(users)
        .values({
          username,
          name,
          grade: selectedGrade || null,
          class: selectedClass || null,
          password: hashedPassword,
          role: 'USER',
          status: 'active',
          createdAt: now,
          updatedAt: now,
          passwordChangedAt: now,
          lastLogin: now,
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
    const isSecure = isSecureRequest(event)

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
