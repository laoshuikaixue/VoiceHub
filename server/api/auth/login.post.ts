import bcrypt from 'bcrypt'
import { prisma, checkDatabaseConnection, reconnectDatabase } from '../../models/schema'
import { JWTEnhanced } from '../../utils/jwt-enhanced'
import { MemoryStore } from '../../utils/memory-store'

export default defineEventHandler(async (event) => {
  // 记录请求开始时间，用于计算处理时间
  const startTime = Date.now()
  
  try {
  const body = await readBody(event)
    
    console.log('Login attempt for user:', body.username)
    console.log('Environment:', process.env.NODE_ENV, 'Vercel:', process.env.VERCEL === '1' ? 'Yes' : 'No')
    
    // 获取客户端信息用于锁定检查
    const clientIp = getRequestIP(event, { xForwardedFor: true }) || '未知IP'
    const identifier = `${body.username}:${clientIp}`
    
    // 检查是否被锁定（防暴力破解）
    if (MemoryStore.isBlocked(identifier)) {
      const remainingTime = MemoryStore.getRemainingBlockTime(identifier)
      throw createError({
        statusCode: 429,
        message: `登录尝试过于频繁，请在 ${remainingTime} 分钟后重试`
      })
    }
  
  if (!body.username || !body.password) {
    throw createError({
      statusCode: 400,
      message: '账号名和密码不能为空'
    })
  }
    
    // 检查 JWT_SECRET 是否已设置
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set')
      throw createError({
        statusCode: 500,
        message: '服务器配置错误：缺少必要的环境变量'
      })
    }
    
    // 检查数据库连接
    console.log('Checking database connection...')
    const isConnected = await checkDatabaseConnection().catch((error) => {
      console.error('Database connection check error:', error)
      return false
    })
    
    if (!isConnected) {
      console.log('Database connection check failed, attempting to reconnect...')
      
      // 多次尝试重新连接数据库
      let reconnected = false
      const maxRetries = 3
      
      for (let i = 0; i < maxRetries; i++) {
        console.log(`Reconnection attempt ${i + 1}/${maxRetries}...`)
        
        reconnected = await reconnectDatabase().catch((error) => {
          console.error(`Reconnection attempt ${i + 1} failed:`, error)
          return false
        })
        
        if (reconnected) {
          console.log('Database reconnection successful')
          break
        }
        
        // 如果不是最后一次尝试，则等待一段时间后重试
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000 // 指数退避策略
          console.log(`Waiting ${delay}ms before next attempt...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      if (!reconnected) {
        console.error('All database reconnection attempts failed')
        throw createError({
          statusCode: 503,
          message: '数据库服务暂时不可用，请稍后再试'
        })
      }
  }
  
  // 查找用户
    let user
    try {
      console.log('Querying database for user...')
      
      // 使用原始SQL查询，避免模式不匹配问题
      try {
        // 首先尝试使用Prisma模型
        user = await prisma.user.findUnique({
    where: {
      username: body.username
          },
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
            passwordChangedAt: true // 添加密码修改时间字段
    }
  })
      } catch (schemaError) {
        console.warn('Schema mismatch detected, trying raw query:', schemaError)
        
        // 如果失败，使用原始SQL查询
        const result = await prisma.$queryRaw`
          SELECT id, username, name, grade, class, password, role, "lastLogin", "lastLoginIp", "passwordChangedAt"
          FROM "User"
          WHERE username = ${body.username}
        `
        
        // 将结果转换为单个用户对象
        user = Array.isArray(result) && result.length > 0 ? result[0] : null
      }
      
      console.log('User found:', user ? 'yes' : 'no')
    } catch (error) {
      console.error('Database error when finding user:', error)
      
      // 尝试重新连接数据库并重试查询
      console.log('Attempting to reconnect and retry query...')
      await reconnectDatabase().catch((reconnectError) => {
        console.error('Reconnection failed:', reconnectError)
      })
      
      try {
        // 使用简化的查询，只获取必要字段
        user = await prisma.$queryRaw`
          SELECT id, username, name, grade, class, password, role, "lastLogin", "lastLoginIp", "passwordChangedAt"
          FROM "User"
          WHERE username = ${body.username}
        `
        
        // 将结果转换为单个用户对象
        user = Array.isArray(user) && user.length > 0 ? user[0] : null
        
        console.log('Retry successful, user found:', user ? 'yes' : 'no')
      } catch (retryError) {
        console.error('Retry failed:', retryError)
        
        // 提供更详细的错误信息
        const errorDetails = retryError instanceof Error ? retryError.message : 'Unknown error'
        
        throw createError({
          statusCode: 500,
          message: `数据库查询错误，请稍后再试 (${errorDetails})`
        })
      }
    }
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '用户不存在'
    })
  }
  
  // 验证密码
    let isPasswordValid
    try {
      console.log('Verifying password...')
      isPasswordValid = await bcrypt.compare(body.password, user.password)
      console.log('Password valid:', isPasswordValid)
    } catch (error) {
      console.error('bcrypt error:', error)
      throw createError({
        statusCode: 500,
        message: '密码验证错误'
      })
    }
  
  if (!isPasswordValid) {
    // 记录失败的登录尝试
    MemoryStore.recordLoginAttempt(identifier, false)
    
    throw createError({
      statusCode: 401,
      message: '密码不正确'
    })
  }
  
  // 登录成功，清除失败记录
  MemoryStore.recordLoginAttempt(identifier, true)
  
  // 获取用户代理信息
  const userAgent = getRequestHeader(event, 'user-agent') || 'Unknown'
  console.log('Client info:', { ip: clientIp, userAgent: userAgent.substring(0, 100) })
  
  // 更新用户最后登录时间和IP
    try {
      console.log('Updating user login information...')
      
      // 使用原始SQL更新，避免模式不匹配问题
      await prisma.$executeRaw`
        UPDATE "User"
        SET "lastLogin" = NOW(),
            "lastLoginIp" = ${clientIp}
        WHERE id = ${user.id}
      `
      
      console.log('User login time updated')
    } catch (error) {
      console.error('Error updating user login time:', error)
      // 不中断登录流程，继续生成令牌
    }
  
  // 生成增强的JWT token对
    let tokenPair
    try {
      console.log('Generating enhanced JWT token pair...')
      tokenPair = JWTEnhanced.generateTokenPair(
        user.id,
        user.role,
        userAgent
      )
      console.log('JWT token pair generated:', { sessionId: tokenPair.sessionId })
    } catch (error) {
      console.error('JWT token generation error:', error)
      throw createError({
        statusCode: 500,
        message: '令牌生成错误'
      })
    }
    
    // 计算并记录总处理时间
    const processingTime = Date.now() - startTime
    console.log(`Login request processed in ${processingTime}ms`)
    
    // 检查用户是否需要强制修改密码（passwordChangedAt为空表示使用默认密码）
    const needsPasswordChange = !user.passwordChangedAt
    console.log('Needs password change:', needsPasswordChange)
  
  // 设置httpOnly cookies
  setCookie(event, 'auth-token', tokenPair.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15分钟
    path: '/'
  })
  
  setCookie(event, 'refresh-token', tokenPair.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7天
    path: '/'
  })

  return {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    sessionId: tokenPair.sessionId,
    expiresIn: 15 * 60, // access token过期时间（秒）
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      grade: user.grade,
      class: user.class,
      role: user.role,
      lastLogin: user.lastLogin,
      lastLoginIp: user.lastLoginIp,
      needsPasswordChange: needsPasswordChange // 是否需要强制修改密码
    }
  }
  } catch (error: any) {
    // 计算并记录错误处理时间
    const errorTime = Date.now() - startTime
    console.error(`Login error after ${errorTime}ms:`, error)
    
    // 如果是已经格式化的错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 否则创建一个通用的服务器错误，并包含更多诊断信息
    const errorMessage = error.message || '未知错误'
    const errorName = error.name || 'Error'
    
    throw createError({
      statusCode: 500,
      message: `登录失败：${errorName} - ${errorMessage}`
    })
  }
})