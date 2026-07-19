import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, initAuth, user } = useAuth()
  const publicRoutes = ['/login', '/', '/auth/error', '/forgot-password', '/reset-password']

  // 客户端初始化认证状态
  if (import.meta.client && !isAuthenticated.value) {
    await initAuth()
  }

  // 强制改密优先于公共页面判断，避免用户通过首页或直接输入地址绕过改密页。
  const passwordChangeRoutes = ['/change-password', '/login', '/forgot-password', '/reset-password']
  if (
    isAuthenticated.value &&
    user.value?.requirePasswordChange &&
    !passwordChangeRoutes.includes(to.path)
  ) {
    return navigateTo('/change-password')
  }

  // 公共页面跳过认证
  if (publicRoutes.includes(to.path) || to.path.startsWith('/api/auth')) {
    return
  }

  // 服务端跳过认证检查
  if (import.meta.server) {
    return
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated.value && to.path !== '/login') {
    // 保存目标路径用于登录后重定向
    const redirect = to.fullPath
    return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`)
  }
})
