import bcrypt from 'bcryptjs'
import { db, users, userIdentities } from '~/drizzle/db'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import { getServerDate } from '~~/server/utils/serverTime'
import { validateOAuthRegisterCredentials } from '~/utils/oauth-register'
import { isSecureRequest } from '~~/server/utils/request-utils'
import { createApiError } from '~~/server/utils/apiError'
import { createAuthSession } from '~~/server/utils/auth-session'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { resolveGradeClassError, REMARK_MAX_LENGTH } from '~~/server/utils/register-validation'
import { isGradeClassValid } from '~~/server/utils/grade-class-options'
import { getIdentityAvatarUrl } from '~~/server/utils/user-avatar'
import { verifyEmailCode } from '~~/server/utils/email-verification'
import { notifyRegistration } from '~~/server/utils/registration-notify'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  // 数据库连接检查（在读取配置前执行，DB 故障时返回明确的 503）
  try {
    await db.select().from(users).limit(1)
  } catch (error) {
    console.error('Database connection error:', error)
    throw createApiError(503, SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE, '数据库服务暂时不可用')
  }

  // 检查是否允许 OAuth 注册
  const config = await db.query.systemSettings.findFirst()
  if (!config?.allowOAuthRegistration) {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_OAUTH_REGISTER_DISABLED_BIND, '系统已关闭第三方账号注册功能，请登录现有账号进行绑定')
  }

  const body = await readBody(event)
  const { password, confirmPassword } = body
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const selectedGrade = typeof body.grade === 'string' ? body.grade.trim() : ''
  const selectedClass = typeof body.class === 'string' ? body.class.trim() : ''
  const remark = typeof body.remark === 'string' ? body.remark.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const emailCode = typeof body.emailCode === 'string' ? body.emailCode.trim() : ''
  const bindingToken = getCookie(event, 'binding-token')

  // 邮箱必填由管理员开关控制（与本地注册同源）：开启时邮箱必填；验证码在用户名检查后消费
  const emailRequired = Boolean(config?.registerEmailRequired)
  if (emailRequired && !email) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请填写邮箱地址')
  }
  if (email && !EMAIL_REGEX.test(email)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请输入有效的邮箱地址')
  }

  if (remark.length > REMARK_MAX_LENGTH) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `备注不能超过 ${REMARK_MAX_LENGTH} 个字符`)
  }
  if (!bindingToken) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_REGISTER_SESSION_EXPIRED, '注册会话已过期，请重新通过第三方登录发起')
  }

  let payload
  try {
    payload = verifyBindingToken(bindingToken)
  } catch (e) {
    deleteCookie(event, 'binding-token')
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_INVALID_REGISTER_TOKEN, '无效的注册令牌')
  }

  // 验证输入
  if (!username || !name || !password || !confirmPassword) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_NAME_USERNAME_PASSWORD_REQUIRED, '姓名、用户名、密码不能为空')
  }

  const validationError = validateOAuthRegisterCredentials(username, password, confirmPassword)
  if (validationError) {
    throw createApiError(400, validationError.code, validationError.message)
  }

  const gradeClassError = resolveGradeClassError(
    selectedGrade,
    selectedClass,
    Boolean(config?.registerRequiresGradeClass)
  )
  if (gradeClassError) {
    throw createApiError(400, gradeClassError.code, gradeClassError.message)
  }

  if (selectedGrade && selectedClass) {
    const valid = await isGradeClassValid(selectedGrade, selectedClass)

    if (!valid) {
      throw createApiError(400, SERVER_ERROR_CODES.AUTH_GRADE_CLASS_MUST_EXIST, '请选择系统内已存在的年级和班级')
    }
  }

  // 检查用户名是否已存在
  const existingUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.username, username)
  })

  if (existingUser) {
    throw createApiError(409, SERVER_ERROR_CODES.AUTH_USERNAME_TAKEN, '用户名已存在，请使用其他用户名')
  }

  // 检查OAuth身份是否已被绑定
  const existingIdentity = await db.query.userIdentities.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.provider, payload.provider), eq(t.providerUserId, payload.providerUserId))
  })

  if (existingIdentity) {
    throw createApiError(409, SERVER_ERROR_CODES.AUTH_OAUTH_ALREADY_BOUND, '该第三方账号已被绑定，请直接登录或绑定到现有账户')
  }

  // 邮箱验证码在最后校验（前置校验通过后消费）
  if (email && !(await verifyEmailCode(email, emailCode))) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_EMAIL_CODE_INVALID, '邮箱验证码无效或已过期，请重新获取')
  }

  try {
    // 开事务创建用户和关联身份
    const result = await db.transaction(async (tx) => {
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10)
      const now = getServerDate()
      const avatarUrl = getIdentityAvatarUrl({
        provider: payload.provider,
        providerUserId: payload.providerUserId,
        providerUsername: payload.providerUsername,
        avatar: payload.avatar
      })

      // 创建用户（onConflictDoNothing 兜底并发用户名竞态）
      const insertedUser = (await tx
        .insert(users)
        .values({
          username,
          name,
          grade: selectedGrade || null,
          class: selectedClass || null,
          password: hashedPassword,
          role: 'USER',
          status: config?.oauthRegisterRequiresApproval ? 'pending' : 'active',
          remark: remark || null,
          email: email || null,
          emailVerified: email ? true : null,
          createdAt: now,
          updatedAt: now,
          passwordChangedAt: now,
          lastLogin: now,
          forcePasswordChange: false,
          avatarProvider: avatarUrl ? payload.provider : null,
          avatarProviderUserId: avatarUrl ? payload.providerUserId : null
        })
        .onConflictDoNothing()
        .returning({ id: users.id, tokenVersion: users.tokenVersion }))[0]

      if (!insertedUser) {
        throw createApiError(409, SERVER_ERROR_CODES.AUTH_USERNAME_TAKEN, '用户名已存在，请使用其他用户名')
      }

      // 关联OAuth身份
      await tx.insert(userIdentities).values({
        userId: insertedUser.id,
        provider: payload.provider,
        providerUserId: payload.providerUserId,
        providerUsername: payload.providerUsername,
        avatar: payload.avatar || null,
        createdAt: now,
      })

      return insertedUser
    })

    // 清除绑定令牌
    deleteCookie(event, 'binding-token')

    // 注册通知（站内通知管理员 + 邮件；异步，失败不影响主流程）
    void notifyRegistration(result.id, username, name, email, Boolean(config?.oauthRegisterRequiresApproval))

    // 需要审核时：不签发登录态，等待管理员审核
    if (config?.oauthRegisterRequiresApproval) {
      return {
        success: true,
        pendingApproval: true
      }
    }

    // 生成JWT令牌
    const { token } = await createAuthSession(event, { id: result.id, role: 'USER', tokenVersion: result.tokenVersion }, payload.provider || 'oauth')

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
    // 业务错误码（如用户名冲突 409）直接透传
    if (e?.statusCode) throw e
    console.error('OAuth register error:', e)
    throw createApiError(500, SERVER_ERROR_CODES.AUTH_SYSTEM_ERROR, e.message || '注册失败，请稍后重试')
  }
})
