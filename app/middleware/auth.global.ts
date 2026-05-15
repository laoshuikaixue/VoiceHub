import { useAuth } from '~/composables/useAuth'
import type { User } from '~/types'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, initAuth, user, setAuthState, clearAuthState } = useAuth()
  const publicRoutes = ['/login', '/', '/auth/error', '/forgot-password', '/reset-password']

  // 初始化认证状态（客户端 + 服务端均执行）
  if (!isAuthenticated.value) {
    if (import.meta.client) {
      await initAuth()
    } else if (import.meta.server) {
      // 服务端：直接从 H3 请求上下文读取 server/middleware/auth.ts 已经验证好的用户。
      // 该中间件对所有页面 SSR 请求做"软认证"，若 token 有效会附加 event.context.user
      // （含 requirePasswordChange / hasSetPassword 等关键字段），从而避免一次额外的
      // 内部 $fetch('/api/auth/verify') 调用，缩短 SSR 路径。
      const event = useRequestEvent()
      const ctxUser = event?.context?.user as
        | (User & { status?: string; requirePasswordChange?: boolean; hasSetPassword?: boolean })
        | undefined

      if (ctxUser?.id) {
        // 仅同步 SSR 渲染需要的字段；has2FA / avatar 等需要 identities 关联查询的字段
        // 在 server 中间件中未附加，留待客户端 hydration 时通过 initAuth() 补全（见 useAuth.ts）。
        setAuthState({
          id: ctxUser.id,
          username: ctxUser.username,
          name: ctxUser.name,
          grade: ctxUser.grade,
          class: ctxUser.class,
          role: ctxUser.role,
          requirePasswordChange: ctxUser.requirePasswordChange,
          hasSetPassword: ctxUser.hasSetPassword,
          forcePasswordChange: ctxUser.forcePasswordChange,
          passwordChangedAt: ctxUser.passwordChangedAt
        } as User)
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

  // 未认证用户重定向到登录页
  if (!isAuthenticated.value && to.path !== '/login') {
    // 保存目标路径用于登录后重定向
    const redirect = to.fullPath
    return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`)
  }
})
