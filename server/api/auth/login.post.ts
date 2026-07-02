import bcrypt from 'bcryptjs'
import { db, eq, users, userIdentities, and, systemSettings } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { resolveRequirePasswordChange } from '../../utils/system-settings-helper'
import {
  getAccountLockRemainingTime,
  getIPBlockRemainingTime,
  isAccountLocked,
  isIPBlocked,
  recordLoginFailure,
  recordLoginSuccess,
  recordAccountIpLogin,
  blockUser,
  getUserBlockRemainingTime,
  //导入失败计数查询函数
  getLoginFailureCount
} from '../../services/securityService'
import { CacheService } from '~~/server/services/cacheService'
import { getBeijingTime } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'

// 导入验证码校验函数
import { verifyAndConsumeCaptcha } from '~~/server/utils/captcha'
import { type SystemSettings } from '~/drizzle/schema'

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  
  try {
    const body = await readBody(event)
    const clientIp = getClientIP(event)
    
    let captchaId = ''
    let captchaInput = ''
    
    if (!body.username || !body.password) {
      throw createError({
        statusCode: 400,
        message: '用户名和密码不能为空'
      })
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set')
      throw createError({
        statusCode: 500,
        message: '服务器配置错误'
      })
    }

    // 数据库连接检查 - 使用简单的查询测试连接
    try {
      await db.select().from(users).limit(1)
    } catch (error) {
      console.error('Database connection error:', error)
      throw createError({
        statusCode: 503,
        message: '数据库服务暂时不可用'
      })
    }

    // 检查IP是否被限制
    if (isIPBlocked(clientIp)) {
      const remainingTime = getIPBlockRemainingTime(clientIp)
      throw createError({
        statusCode: 423,
        message: `您的IP地址已被限制访问，请在 ${remainingTime} 分钟后重试`
      })
    }

    // 检查账户是否被锁定
    if (await isAccountLocked(body.username)) {
      const remainingTime = await getAccountLockRemainingTime(body.username)
      throw createError({
        statusCode: 423,
        message: `账户已被锁定，请在 ${remainingTime} 分钟后重试`
      })
    }

    // 读取全局配置：是否启用图形验证码
    let captchaEnabled = false
    let captchaProvider = 'graphic'
    let turnstileSecretKey = ''
    let captchaMaxFailures = 3
    try {
      // 尝试从缓存获取，如果失败再从数据库获取
      const cacheService = CacheService.getInstance()
      let settings = await cacheService.getSystemSettings()
      
      if (!settings) {
        const configRow = await db.select()
          .from(systemSettings)
          .limit(1)
          .then(r => r[0])
          
        if (configRow) {
          settings = configRow as SystemSettings
          // 异步更新缓存，不阻塞登录
          cacheService.setSystemSettings(settings).catch(e => console.warn('缓存系统配置失败:', e))
        }
      }

      if (settings?.captchaEnabled) {
        captchaEnabled = true
        captchaProvider = settings.captchaProvider || 'graphic'
        turnstileSecretKey = settings.turnstileSecretKey || ''
        if (settings.captchaMaxFailures) {
          captchaMaxFailures = settings.captchaMaxFailures
        }
      }
    } catch (e) {
      // 查询异常（如表不存在）时默认关闭验证码，保证登录可用
      console.warn('读取验证码配置失败，已暂时禁用:', e)
    }
    
    // 图形验证码检查
    let needCaptcha = false
    if (captchaEnabled) {
      if (captchaProvider === 'turnstile') {
        needCaptcha = true // Turnstile 每次都验证
      } else {
        const failCount = await getLoginFailureCount(body.username)
        needCaptcha = failCount >= captchaMaxFailures
      }
    }

    // 验证码校验
    if (needCaptcha) {
      if (captchaProvider === 'turnstile') {
        const turnstileToken = body.turnstileToken
        
        if (!turnstileSecretKey) {
          console.error('Turnstile is enabled but secret key is missing!')
          throw createError({
            statusCode: 500,
            message: '验证码服务配置错误，请联系管理员'
          })
        }

        if (!turnstileToken) {
          throw createError({
            statusCode: 400,
            message: '请完成人机验证',
            data: { captchaRequired: true, captchaProvider: 'turnstile' }
          })
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
            console.error('Turnstile verification failed:', result['error-codes'])
            throw createError({
              statusCode: 400,
              message: '人机验证失败或已过期，请重试',
              data: { captchaRequired: true, captchaProvider: 'turnstile' }
            })
          }
        } catch (err: any) {
          if (err.statusCode === 400) throw err
          console.error('Turnstile verification error:', err)
          throw createError({
            statusCode: 500,
            message: '人机验证服务暂时不可用'
          })
        }
      } else {
        captchaId = body.captchaId
        captchaInput = body.captchaInput
        if (!captchaId || !captchaInput) {
          throw createError({
            statusCode: 400,
            message: '请完成图形验证码',
            data: { captchaRequired: true, captchaProvider: 'graphic' }
          })
        }
        
        const isValid = await verifyAndConsumeCaptcha(captchaId, captchaInput)
        if (!isValid) {
          throw createError({
            statusCode: 400,
            message: '验证码错误或已过期，请重新输入',
            data: { captchaRequired: true, captchaProvider: 'graphic' }
          })
        }
      }
    }
    
    // 查找用户
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        grade: users.grade,
        class: users.class,
        password: users.password,
        role: users.role,
        lastLogin: users.lastLogin,
        lastLoginIp: users.lastLoginIp,
        passwordChangedAt: users.passwordChangedAt,
        forcePasswordChange: users.forcePasswordChange,
        status: users.status,
        email: users.email,
        emailVerified: users.emailVerified
      })
      .from(users)
      .where(eq(users.username, body.username))
      .limit(1)

    const user = userResult[0] || null

    if (!user) {
      // 记录登录失败（用户不存在）
      await recordLoginFailure(body.username, clientIp)
      throw createError({
        statusCode: 401,
        message: '用户名或密码错误'
      })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(body.password, user.password)
    if (!isPasswordValid) {
      // 记录登录失败（密码错误）
      await recordLoginFailure(body.username, clientIp)
      throw createError({
        statusCode: 401,
        message: '用户名或密码错误'
      })
    }
    
    // 检查用户状态 (移到2FA之前，防止已退学用户进行2FA验证)
    if (user.status === 'withdrawn') {
      throw createError({ statusCode: 403, message: '该账号已退学，限制访问' })
    } else if (user.status === 'graduate') {
      throw createError({ statusCode: 403, message: '该账号已毕业，限制访问' })
    } else if (user.status === 'banned') {
      throw createError({ statusCode: 403, message: '该账号已被封禁' })
    }

    // 检查是否开启2FA
    const totpIdentity = await db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
    })

    if (totpIdentity) {
      // 生成预认证临时令牌
      const tempToken = JWTEnhanced.sign({
        userId: user.id,
        type: 'pre-auth',
        scope: '2fa_pending'
      }, { expiresIn: '5m' }) // 动态构建验证方式列表
      const methods = ['totp']
      let maskedEmail = ''
      if (user.email && user.emailVerified) {
        methods.push('email')
        // 生成脱敏邮箱提示
        const [local, domain] = user.email.split('@')
        if (local && domain) {
          maskedEmail = local.length <= 2
            ? `***@${domain}`
            : `${local.slice(0, 2)}****@${domain}`
        }
      }
      return {
        success: true,
        requires2FA: true,
        userId: user.id,
        methods,
        maskedEmail,
        tempToken
      }
    }

    await recordLoginSuccess(body.username, clientIp)

    const ipSwitchExceeded = recordAccountIpLogin(body.username, clientIp)
    if (ipSwitchExceeded) {
      blockUser(user.id)
      const ipRemain = getIPBlockRemainingTime(clientIp)
      const userRemain = getUserBlockRemainingTime(user.id)
      throw createError({
        statusCode: 423,
        message: `检测到同一账号短期多IP登录，当前IP限制 ${ipRemain} 分钟，账户保护 ${userRemain} 分钟`
      })
    }

    // 更新登录信息
    await db
      .update(users)
      .set({
        lastLogin: getBeijingTime(),
        lastLoginIp: clientIp
      })
      .where(eq(users.id, user.id))
      .catch((err) => console.error('Error updating user login info:', err))

    // 生成JWT
    const token = JWTEnhanced.generateToken(user.id, user.role)

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

    const processingTime = Date.now() - startTime
    console.log(`Login for ${user.username} processed in ${processingTime}ms`)

    // 统一调用 resolveRequirePasswordChange，内部已包含短路优化逻辑
    const requirePasswordChange = await resolveRequirePasswordChange(user)

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        grade: user.grade,
        class: user.class,
        role: user.role,
        email: user.email,
        emailVerified: user.emailVerified,
        forcePasswordChange: user.forcePasswordChange,
        passwordChangedAt: user.passwordChangedAt,
        requirePasswordChange,
        hasSetPassword: !!user.passwordChangedAt
      }
    }
  } catch (error: any) {
    const errorTime = Date.now() - startTime
    console.error(`Login error after ${errorTime}ms:`, error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '登录过程中发生未知错误'
    })
  }
})
