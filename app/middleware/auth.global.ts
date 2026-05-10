import { useAuth } from '~/composables/useAuth'
import { isAdminRole } from '~/utils/auth-constants'
import type { User } from '~/types'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, isAdmin, initAuth, user, token } = useAuth()
  const publicRoutes = ['/login', '/', '/auth/error', '/forgot-password', '/reset-password']

  // 初始化认证状态（客户端 + 服务端均执行）
  if (!isAuthenticated.value) {
    if (import.meta.client) {
      await initAuth()
    } else if (import.meta.server) {
      // 服务端：通过 cookie 中的 token 调用内部 API 获取用户状态
      // Nitro 内部路由会直接调用 handler，无需真正的 HTTP 请求，性能可靠
      // 使用 useRequestHeaders 自动转发请求中的所有 Cookie，避免手动拼接字符串遗漏其它 cookie
      try {
        const headers = useRequestHeaders(['cookie'])
        if (headers.cookie) {
          const data = await $fetch<{ user: User; valid: boolean }>('/api/auth/verify', {
            headers
          })
          if (data?.user) {
            user.value = data.user
            isAuthenticated.value = true
            isAdmin.value = isAdminRole(data.user.role)
            token.value = 'cookie-based'
          }
        }
      } catch (e) {
        // 服务端验证失败（token 无效/过期等），清理状态确保一致性
        // 客户端 hydration 后会再次尝试认证
        user.value = null
        isAuthenticated.value = false
        isAdmin.value = false
        token.value = null
      }
    }
  }

  // 强制改密优先级最高：已认证但需要修改密码的用户，必须先去改密页面
  // 注意：此检查在服务端和客户端均执行，服务端会发送 302 重定向避免页面闪烁
  if (
    isAuthenticated.value &&
    user.value?.requirePasswordChange &&
    to.path !== '/change-password'
  ) {
    return navigateTo('/change-password', { redirectCode: 302 })
  }

  // 公共页面跳过认证
  if (publicRoutes.includes(to.path) || to.path.startsWith('/api/auth')) {
    return
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated.value && to.path !== '/login') {
    // 保存目标路径用于登录后重定向
    const redirect = to.fullPath
    return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`)
  }
})
