import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, initAuth, user } = useAuth()
  const publicRoutes = ['/login', '/', '/auth/error', '/forgot-password', '/reset-password']

  // 客户端初始化认证状态
  if (import.meta.client && !isAuthenticated.value) {
    await initAuth()
  }

  // 强制改密优先级最高：已认证但需要修改密码的用户，必须先去改密页面
  // 注意：此检查必须在公共路由检查之前，避免用户停留在首页等公共页面绕过强制改密
  if (
    import.meta.client &&
    isAuthenticated.value &&
    user.value?.requirePasswordChange &&
    to.path !== '/change-password'
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
