import { useAuth } from '~/composables/useAuth'
import type { User } from '~/types'
import { isAdminRole } from '~/utils/auth-constants'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, initAuth, user, setAuthState, clearAuthState } = useAuth()
  const publicRoutes = ['/login', '/', '/auth/error', '/forgot-password', '/reset-password']

  // 初始化认证状态（客户端 + 服务端均执行）
  if (!isAuthenticated.value || (import.meta.client && !user.value?._isFullProfile)) {
    if (import.meta.client) {
      await initAuth()
    } else if (import.meta.server) {
      // 服务端：直接从 H3 请求上下文读取 server/middleware/auth.ts 已经验证好的用户。
      // 该中间件对所有页面 SSR 请求做"软认证"，若 token 有效会附加 event.context.user
      // （含 requirePasswordChange / hasSetPassword 等关键字段），从而避免一次额外的
      // 内部 $fetch('/api/auth/verify') 调用，缩短 SSR 路径。
      const event = useRequestEvent()
      // server/middleware/auth.ts 附加的 context.user 在 User 字段之上还带了
      // 仅服务端关心的 status（用于禁用判定），这里通过交叉类型兼容。
      const ctxUser = event?.context?.user as (User & { status?: string }) | undefined

      if (ctxUser?.id) {
        // server/middleware/auth.ts 已对 ctxUser 做了字段过滤（仅含安全字段），
        // 直接传递整个对象，避免手动映射遗漏新增字段。
        // has2FA / avatar 等需要 identities 关联查询的字段留待客户端 initAuth() 补全。
        setAuthState(ctxUser as User)
      } else {
        // 未登录访客或 token 无效，明确清理状态确保 SSR / 客户端一致
        clearAuthState()
      }
    }
  }

  // 强制改密优先级最高：已认证但需要修改密码的用户，必须先去改密页面
  // 注意：此检查在服务端和客户端均执行，服务端会发送 302 重定向避免页面闪烁
  const allowedRoutes = ['/change-password', '/forgot-password', '/reset-password']
  if (
    isAuthenticated.value &&
    user.value?.requirePasswordChange &&
    !allowedRoutes.includes(to.path)
  ) {
    return navigateTo('/change-password', { redirectCode: 302 })
  }

  // 公共页面跳过认证
  if (publicRoutes.includes(to.path) || to.path.startsWith('/api/auth')) {
    return
  }

  // 管理员路由权限校验：非管理员访问 /admin* 时，重定向到 /dashboard
  // 这一检查在 server/middleware/auth.ts 中已提前清除了 ctxUser，但为双保险仍在此处执行。
  if (to.path.startsWith('/admin') && isAuthenticated.value) {
    if (!isAdminRole(user.value?.role)) {
      return navigateTo('/dashboard')
    }
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated.value && to.path !== '/login') {
    // 保存目标路径用于登录后重定向
    const redirect = to.fullPath
    return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`)
  }
})
