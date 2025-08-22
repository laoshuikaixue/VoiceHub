import bcrypt from 'bcrypt'
import { prisma, checkDatabaseConnection, reconnectDatabase } from '../../models/schema'
import { JWTEnhanced } from '../../utils/jwt-enhanced'
import { isAccountLocked, getAccountLockRemainingTime, recordLoginFailure, recordLoginSuccess } from '../../services/securityService'

export default defineEventHandler(async (event) => {
  const startTime = Date.now()

  try {
    const body = await readBody(event)
    const clientIp = getRequestIP(event, { xForwardedFor: true }) || '未知IP'

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

    // 数据库连接检查
    const isConnected = await checkDatabaseConnection().catch(() => false)
    if (!isConnected) {
      const reconnected = await reconnectDatabase().catch(() => false)
      if (!reconnected) {
        throw createError({
          statusCode: 503,
          message: '数据库服务暂时不可用'
        })
      }
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
    const user = await prisma.user.findUnique({
      where: { username: body.username },
      select: {
        id: true,
        username: true,
        name: true,
        grade: true,
        class: true,
        password: true,
        role: true,
        lastLogin: true,
        lastLoginIp: true,
        passwordChangedAt: true
      }
    })

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

    // 登录成功，清除失败记录
    recordLoginSuccess(body.username)

    // 更新登录信息
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        lastLoginIp: clientIp
      }
    }).catch(err => console.error('Error updating user login info:', err))

    // 生成JWT
    const token = JWTEnhanced.generateToken(user.id, user.role)

    // 设置cookie
    setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
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