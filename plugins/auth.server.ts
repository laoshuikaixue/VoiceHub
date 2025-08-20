import jwt from 'jsonwebtoken'
import { getCookie } from 'h3'
import { prisma } from '~/server/models/schema'
import crypto from 'crypto'

export default defineNuxtPlugin(async (nuxtApp) => {
  // 只在服务器端运行
  if (process.client) return

  const event = nuxtApp.ssrContext?.event
  if (!event) return

  // 生成唯一的会话标识符，防止payload缓存混乱
  const sessionId = crypto.randomUUID()
  const requestTimestamp = Date.now()
  
  console.log(`[Auth SSR] Processing request ${sessionId} at ${new Date(requestTimestamp).toISOString()}`)

  try {
    // 从cookie获取token
    const token = getCookie(event, 'auth-token')
    
    if (!token) {
      console.log(`[Auth SSR] No token found for session ${sessionId}`)
      // 确保清理任何残留的认证状态，添加会话标识符
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      return
    }

    // 验证token
    if (!process.env.JWT_SECRET) {
      console.error(`[Auth SSR] JWT_SECRET not configured for session ${sessionId}`)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      nuxtApp.payload._error = 'JWT_SECRET_MISSING'
      return
    }
    
    let decoded: { userId: number, role: string, iat?: number }
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as {
        userId: number,
        role: string,
        iat?: number
      }
      console.log(`[Auth SSR] Token decoded successfully for session ${sessionId}, userId: ${decoded.userId}`)
    } catch (jwtError: any) {
      console.error(`[Auth SSR] JWT verification failed for session ${sessionId}:`, jwtError.message)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      nuxtApp.payload._error = 'INVALID_TOKEN'
      return
    }

    // 检查token是否过期（额外的安全检查）
    const now = Math.floor(Date.now() / 1000)
    const tokenAge = decoded.iat ? now - decoded.iat : 0
    const maxAge = 24 * 60 * 60 // 24小时
    
    if (tokenAge > maxAge) {
      console.warn(`[Auth SSR] Token expired for session ${sessionId}, user ${decoded.userId}, age: ${tokenAge}s`)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      nuxtApp.payload._error = 'TOKEN_EXPIRED'
      return
    }

    // 获取用户信息，添加额外的安全检查
    let user
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          name: true,
          grade: true,
          class: true,
          role: true,
          passwordChangedAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
      console.log(`[Auth SSR] Database query completed for session ${sessionId}, user found: ${!!user}`)
    } catch (dbError: any) {
      console.error(`[Auth SSR] Database error for session ${sessionId}:`, dbError.message)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      nuxtApp.payload._error = 'DATABASE_ERROR'
      return
    }

    if (user) {
      // 严格验证用户ID一致性
      if (user.id !== decoded.userId) {
        console.error(`[Auth SSR] CRITICAL: User ID mismatch for session ${sessionId}: token=${decoded.userId}, db=${user.id}`)
        nuxtApp.payload.user = null
        nuxtApp.payload.isAuthenticated = false
        nuxtApp.payload.isAdmin = false
        nuxtApp.payload._sessionId = sessionId
        nuxtApp.payload._timestamp = requestTimestamp
        nuxtApp.payload._error = 'USER_ID_MISMATCH'
        return
      }

      // 创建带有唯一标识符的payload，防止缓存混乱
      const userPayload = {
        ...user,
        needsPasswordChange: !user.passwordChangedAt,
        _timestamp: requestTimestamp,
        _sessionId: sessionId, // 唯一会话标识符
        _userId: user.id, // 用于客户端验证
        _tokenUserId: decoded.userId, // token中的用户ID，用于双重验证
        _payloadHash: crypto.createHash('sha256').update(`${user.id}-${user.username}-${requestTimestamp}-${sessionId}`).digest('hex') // payload完整性校验
      }

      // 将用户信息注入到nuxtApp状态中，供客户端hydration使用
      nuxtApp.payload.user = userPayload
      nuxtApp.payload.isAuthenticated = true
      nuxtApp.payload.isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      
      console.log(`[Auth SSR] Payload set successfully for session ${sessionId}, user ${user.id} (${user.username})`)
    } else {
      console.warn(`[Auth SSR] User not found for session ${sessionId}, token userId: ${decoded.userId}`)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      nuxtApp.payload._sessionId = sessionId
      nuxtApp.payload._timestamp = requestTimestamp
      nuxtApp.payload._error = 'USER_NOT_FOUND'
    }
  } catch (error: any) {
    console.error(`[Auth SSR] Critical error for session ${sessionId}:`, error.message || error)
    // 确保清理任何可能的残留状态，添加错误信息
    nuxtApp.payload.user = null
    nuxtApp.payload.isAuthenticated = false
    nuxtApp.payload.isAdmin = false
    nuxtApp.payload._sessionId = sessionId
    nuxtApp.payload._timestamp = requestTimestamp
    nuxtApp.payload._error = 'CRITICAL_ERROR'
    nuxtApp.payload._errorMessage = error.message || 'Unknown error'
  }
})