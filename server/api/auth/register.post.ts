import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { db, users } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { validateOAuthRegisterCredentials } from '~/utils/oauth-register'
import { isSecureRequest } from '~~/server/utils/request-utils'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'
import { verifyAndConsumeCaptcha } from '~~/server/utils/captcha'
import { resolveGradeClassError, REMARK_MAX_LENGTH } from '~~/server/utils/register-validation'
import { isGradeClassValid } from '~~/server/utils/grade-class-options'
import { verifyEmailCode } from '~~/server/utils/email-verification'
import { notifyRegistration } from '~~/server/utils/registration-notify'

const REGISTER_RATE_LIMIT = 5
const REGISTER_RATE_WINDOW_MS = 60 * 60 * 1000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const clientIp = getClientIP(event)

  // 数据库连接检查（在读取配置前执行，DB 故障时返回明确的 503 兜底）
  try {
    await db.select().from(users).limit(1)
  } catch (error) {
    console.error('Database connection error:', error)
    throw createApiError(503, SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE, '数据库服务暂时不可用')
  }

  const config = await db.query.systemSettings.findFirst()

  // 开关：是否开放用户名密码注册
  if (!config?.allowRegister) {
    throw createApiError(403, SERVER_ERROR_CODES.AUTH_REGISTER_DISABLED, '系统未开放注册')
  }

  // 限流：按 IP 每小时最多 5 次注册请求
  const limitResult = await checkDistributedRateLimit(`register:${clientIp}`, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS)
  if (!limitResult.isAllowed) {
    const waitMinutes = Math.ceil((limitResult.resetTime - getServerTimestamp()) / 60000)
    throw createApiError(429, SERVER_ERROR_CODES.AUTH_RATE_LIMITED_MINUTES, `注册请求过于频繁，请等待 ${waitMinutes} 分钟后再试`, { params: [waitMinutes] })
  }

  // 验证码：开启验证码服务时注册必须通过（图形验证码或 Turnstile）
  const captchaEnabled = Boolean(config?.captchaEnabled)
  const captchaProvider = config?.captchaProvider || 'graphic'
  if (captchaEnabled) {
    if (captchaProvider === 'turnstile') {
      const turnstileSecretKey = config?.turnstileSecretKey || ''
      const turnstileToken = body.turnstileToken

      if (!turnstileSecretKey) {
        throw createApiError(500, SERVER_ERROR_CODES.AUTH_CAPTCHA_SERVICE_UNAVAILABLE, '验证码服务配置错误，请联系管理员')
      }

      if (!turnstileToken) {
        throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_REQUIRED, '请完成人机验证', { captchaRequired: true, captchaProvider: 'turnstile' })
      }

      const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
      const formData = new URLSearchParams()
      formData.append('secret', turnstileSecretKey)
      formData.append('response', turnstileToken)
      formData.append('remoteip', clientIp)

      try {
        const result: any = await $fetch(verifyUrl, {
          method: 'POST',
          body: formData,
          timeout: 5000
        })

        if (!result.success) {
          throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_FAILED_OR_EXPIRED, '人机验证失败或已过期，请重试', { captchaRequired: true, captchaProvider: 'turnstile' })
        }
      } catch (err: any) {
        if (err.statusCode === 400) throw err
        console.error('Turnstile verification error:', err)
        throw createApiError(500, SERVER_ERROR_CODES.AUTH_CAPTCHA_SERVICE_UNAVAILABLE, '人机验证服务暂时不可用')
      }
    } else {
      const captchaId = body.captchaId
      const captchaInput = body.captchaInput
      if (!captchaId || !captchaInput) {
        throw createApiError(400, SERVER_ERROR_CODES.AUTH_IMAGE_CAPTCHA_REQUIRED, '请完成图形验证码', { captchaRequired: true, captchaProvider: 'graphic' })
      }

      const isValid = await verifyAndConsumeCaptcha(captchaId, captchaInput)
      if (!isValid) {
        throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_FAILED_OR_EXPIRED, '验证码错误或已过期，请重新输入', { captchaRequired: true, captchaProvider: 'graphic' })
      }
    }
  }

  // 字段校验
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
  const selectedGrade = typeof body.grade === 'string' ? body.grade.trim() : ''
  const selectedClass = typeof body.class === 'string' ? body.class.trim() : ''
  const remark = typeof body.remark === 'string' ? body.remark.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const emailCode = typeof body.emailCode === 'string' ? body.emailCode.trim() : ''

  if (!username || !name || !password || !confirmPassword) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_NAME_USERNAME_PASSWORD_REQUIRED, '姓名、用户名、密码不能为空')
  }

  const validationError = validateOAuthRegisterCredentials(username, password, confirmPassword)
  if (validationError) {
    throw createApiError(400, validationError.code, validationError.message)
  }

  // 邮箱必填由管理员开关控制（需 SMTP 已配置方可开启）：开启时邮箱必填
  const emailRequired = Boolean(config?.registerEmailRequired)
  if (emailRequired && !email) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请填写邮箱地址')
  }
  // 邮箱格式校验（验证码校验在用户名唯一性检查之后执行，避免失败即烧码）
  if (email && !EMAIL_REGEX.test(email)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请输入有效的邮箱地址')
  }

  if (remark.length > REMARK_MAX_LENGTH) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `备注不能超过 ${REMARK_MAX_LENGTH} 个字符`)
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

  // 用户名唯一性检查（预查 + 插入 onConflictDoNothing 兜底并发竞态）
  const existingUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.username, username)
  })

  if (existingUser) {
    throw createApiError(409, SERVER_ERROR_CODES.AUTH_USERNAME_TAKEN, '用户名已存在，请使用其他用户名')
  }

  // 邮箱验证码在最后校验（此时用户名等前置校验均已通过，失败即消费不会误烧码）
  if (email && !(await verifyEmailCode(email, emailCode))) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_EMAIL_CODE_INVALID, '邮箱验证码无效或已过期，请重新获取')
  }

  const requiresApproval = Boolean(config?.registerRequiresApproval)

  try {
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)
    const now = getServerDate()

    // 创建用户
    const insertedUser = (await db
      .insert(users)
      .values({
        username,
        name,
        grade: selectedGrade || null,
        class: selectedClass || null,
        password: hashedPassword,
        role: 'USER',
        status: requiresApproval ? 'pending' : 'active',
        remark: remark || null,
        email: email || null,
        emailVerified: email ? true : null,
        createdAt: now,
        updatedAt: now,
        passwordChangedAt: now,
        lastLogin: now,
        forcePasswordChange: false
      })
      .onConflictDoNothing()
      .returning({ id: users.id, tokenVersion: users.tokenVersion }))[0]

    if (!insertedUser) {
      throw createApiError(409, SERVER_ERROR_CODES.AUTH_USERNAME_TAKEN, '用户名已存在，请使用其他用户名')
    }

    // 需要审核：不签发登录态，等待管理员审核
    // 注册通知（异步，不阻塞主流程）
    void notifyRegistration(insertedUser.id, username, name, email, requiresApproval)

    if (requiresApproval) {
      return {
        success: true,
        pendingApproval: true
      }
    }

    // 无需审核：直接登录
    const token = JWTEnhanced.generateToken(insertedUser.id, 'USER', insertedUser.tokenVersion)
    const isSecure = isSecureRequest(event)

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
        id: insertedUser.id,
        username: username,
        role: 'USER'
      }
    }
  } catch (e: any) {
    // 业务错误码（如用户名冲突 409）直接透传
    if (e?.statusCode) throw e
    console.error('Register error:', e)
    throw createApiError(500, SERVER_ERROR_CODES.AUTH_SYSTEM_ERROR, e.message || '注册失败，请稍后重试')
  }
})
