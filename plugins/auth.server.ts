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
      return
    }

    // 验证token
    if (!process.env.JWT_SECRET) return
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      userId: number,
      role: string
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
      // 将用户信息注入到nuxtApp状态中，供客户端hydration使用
      nuxtApp.payload.user = {
        ...user,
        needsPasswordChange: !user.passwordChangedAt
      }
      nuxtApp.payload.isAuthenticated = true
      nuxtApp.payload.isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)
    }
  } catch (error) {
    // 如果token无效，不做任何处理，让客户端处理
  }
})