import { getCookie } from 'h3'
import { JWTEnhanced } from '~/server/utils/jwt-enhanced'
import { prisma } from '~/prisma/client'

export default defineNuxtPlugin(async (nuxtApp) => {
  // 只在服务器端运行
  if (process.client) return

  const event = nuxtApp.ssrContext?.event
  if (!event) return

  // 使用 useState 确保每个请求的状态是隔离的
  const userState = useState('user', () => null)
  const isAuthenticatedState = useState('isAuthenticated', () => false)
  const isAdminState = useState('isAdmin', () => false)

  const resetAuthState = () => {
    userState.value = null
    isAuthenticatedState.value = false
    isAdminState.value = false
  }

  try {
    // 对于Web应用，token主要通过cookie传递
    const token = getCookie(event, 'auth_token')

    if (!token) {
      resetAuthState()
      return
    }

    // 验证token
    const decoded = JWTEnhanced.verifyToken(token)
    if (!decoded) {
      resetAuthState()
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
      // 创建一个可序列化的纯数据对象
      const userPayload = {
        id: user.id,
        username: user.username,
        name: user.name,
        grade: user.grade,
        class: user.class,
        role: user.role,
        // 转换为ISO字符串以安全序列化
        passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null
      }
      // 使用useState更新状态，这将安全地传递给客户端
      userState.value = userPayload
      isAuthenticatedState.value = true
      // 修正角色检查逻辑，使用大写
      isAdminState.value = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)
    } else {
      resetAuthState()
    }
  } catch (error) {
    console.error('Auth server plugin error:', error)
    resetAuthState()
  }
})