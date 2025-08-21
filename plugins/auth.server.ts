import { JWTEnhanced } from '~/server/utils/jwt-enhanced'
import { prisma } from '~/prisma/client'

export default defineNuxtPlugin(async (nuxtApp) => {
  // 只在服务器端运行
  if (process.client) return

  const event = nuxtApp.ssrContext?.event
  if (!event) return

  try {
    // 从 Authorization 头获取 token
    const authHeader = getRequestHeader(event, 'authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    
    if (!token) {
      // 清理认证状态
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
      return
    }

    // 验证token
    const decoded = JWTEnhanced.verifyToken(token)
    if (!decoded) {
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
        passwordChangedAt: true
      }
    })

    if (user) {
      nuxtApp.payload.user = user
      nuxtApp.payload.isAuthenticated = true
      nuxtApp.payload.isAdmin = user.role === 'admin'
    } else {
      nuxtApp.payload.user = null
      nuxtApp.payload.isAuthenticated = false
      nuxtApp.payload.isAdmin = false
    }
  } catch (error) {
    nuxtApp.payload.user = null
    nuxtApp.payload.isAuthenticated = false
    nuxtApp.payload.isAdmin = false
  }
})