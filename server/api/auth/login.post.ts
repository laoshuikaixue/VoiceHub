import bcrypt from 'bcrypt'
import { prisma, checkDatabaseConnection, reconnectDatabase } from '../../models/schema'
import { JWTEnhanced } from '../../utils/jwt-enhanced'
import { isAccountLocked, getAccountLockRemainingTime, recordLoginFailure, recordLoginSuccess } from '../../services/securityService'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (!body.username || !body.password) {
    throw createError({
      statusCode: 400,
      statusMessage: '用户名和密码不能为空'
    })
  }

  try {
    // 查询用户
    let user
    try {
      user = await prisma.user.findUnique({
        where: { username: body.username },
        select: {
          id: true,
          username: true,
          password: true,
          role: true,
          isActive: true
        }
      })
    } catch (prismaError: any) {
      const result = await prisma.$queryRaw`
        SELECT id, username, password, role, "isActive" 
        FROM "User" 
        WHERE username = ${body.username}
      `
      
      if (Array.isArray(result) && result.length > 0) {
        user = result[0] as any
      }
    }

    if (!user) {
      // 记录失败尝试
      await securityService.recordFailedAttempt(
        body.username, 
        getClientIP(event), 
        'login'
      )
      
      throw createError({
        statusCode: 401,
        statusMessage: '用户名或密码错误'
      })
    }

    if (!user.isActive) {
      await securityService.recordFailedAttempt(
        body.username, 
        getClientIP(event), 
        'login'
      )
      
      throw createError({
        statusCode: 401,
        statusMessage: '账户已被禁用'
      })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(body.password, user.password)
    
    if (!isPasswordValid) {
      await securityService.recordFailedAttempt(
        body.username, 
        getClientIP(event), 
        'login'
      )
      
      throw createError({
        statusCode: 401,
        statusMessage: '用户名或密码错误'
      })
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // 记录成功登录
    await securityService.recordSuccessfulLogin(
      user.username, 
      getClientIP(event)
    )
    
    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
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