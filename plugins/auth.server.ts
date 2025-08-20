import jwt from 'jsonwebtoken'
import { getCookie } from 'h3'
import { prisma } from '~/server/models/schema'

export default defineNuxtPlugin(async (nuxtApp) => {
  // 只在服务器端运行
  if (process.client) return

  const event = nuxtApp.ssrContext?.event
  if (!event) return

  try {
    // 从cookie获取token
    const token = getCookie(event, 'auth-token')
    
    if (!token) {
      // 确保清理任何残留的认证状态
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      return
    }

    // 验证token
    if (!process.env.JWT_SECRET) {
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      return
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      userId: number,
      role: string,
      iat?: number
    }

    // 检查token是否过期（额外的安全检查）
    const now = Math.floor(Date.now() / 1000)
    const tokenAge = decoded.iat ? now - decoded.iat : 0
    const maxAge = 24 * 60 * 60 // 24小时
    
    if (tokenAge > maxAge) {
      console.warn(`[Auth] Token expired for user ${decoded.userId}, age: ${tokenAge}s`)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      return
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
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

    if (user) {
      // 验证用户ID一致性
      if (user.id !== decoded.userId) {
        console.error(`[Auth] User ID mismatch: token=${decoded.userId}, db=${user.id}`)
        nuxtApp.payload.user = null
        nuxtApp.payload.isAuthenticated = false
        nuxtApp.payload.isAdmin = false
        return
      }

      // 创建带有时间戳和用户ID的payload，防止缓存混乱
      const userPayload = {
        ...user,
        needsPasswordChange: !user.passwordChangedAt,
        _timestamp: Date.now(),
        _userId: user.id // 用于客户端验证
      }

      // 将用户信息注入到nuxtApp状态中，供客户端hydration使用
      nuxtApp.payload.user = userPayload
      nuxtApp.payload.isAuthenticated = true
      nuxtApp.payload.isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)
      
      console.log(`[Auth] SSR payload set for user ${user.id} (${user.username})`)
    } else {
      console.warn(`[Auth] User not found for token userId: ${decoded.userId}`)
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
    }
  } catch (error) {
    console.error('[Auth] SSR authentication error:', error)
    // 确保清理任何可能的残留状态
    nuxtApp.payload.user = null
    nuxtApp.payload.isAuthenticated = false
    nuxtApp.payload.isAdmin = false
  }
})