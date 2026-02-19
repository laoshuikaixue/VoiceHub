import bcrypt from 'bcrypt'
import { db, eq, users } from '~/drizzle/db'
import { JWTEnhanced } from '../../utils/jwt-enhanced'
import {
  getAccountLockRemainingTime,
  getIPBlockRemainingTime,
  isAccountLocked,
  isIPBlocked,
  recordLoginFailure,
  recordLoginSuccess,
  recordAccountIpLogin,
  blockUser,
  getUserBlockRemainingTime
} from '../../services/securityService'
import { getBeijingTime } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  const startTime = Date.now()

  try {
    const body = await readBody(event)
    const clientIp = getClientIP(event)

    if (!body.username || !body.password) {
      throw createError({
        statusCode: 400,
        message: '账号名和密码不能为空'
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
    if (isAccountLocked(body.username)) {
      const remainingTime = getAccountLockRemainingTime(body.username)
      throw createError({
        statusCode: 423,
        message: `账户已被锁定，请在 ${remainingTime} 分钟后重试`
      })
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
        status: users.status
      })
      .from(users)
      .where(eq(users.username, body.username))
      .limit(1)

    const user = userResult[0] || null

    if (!user) {
      // 记录登录失败（用户不存在）
      recordLoginFailure(body.username, clientIp)
      throw createError({
        statusCode: 401,
        message: '用户不存在'
      })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(body.password, user.password)
    if (!isPasswordValid) {
      // 记录登录失败（密码错误）
      recordLoginFailure(body.username, clientIp)
      throw createError({
        statusCode: 401,
        message: '密码不正确'
      })
    }

    // 检查用户状态
    if (user.status === 'withdrawn') {
      throw createError({
        statusCode: 403,
        message: '账户已停用，无法登录系统。如有疑问请联系管理员。'
      })
    }

    recordLoginSuccess(body.username, clientIp)

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

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        grade: user.grade,
        class: user.class,
        role: user.role,
        needsPasswordChange: !user.passwordChangedAt
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
