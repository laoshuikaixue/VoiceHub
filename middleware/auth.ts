export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuth()
  
  // 检查认证状态
  if (!auth.isAuthenticated.value) {
    return navigateTo('/login')
  }
  
  // 如果是dashboard页面，检查管理员权限
  if (to.path === '/dashboard') {
    const userRole = auth.user.value?.role
    if (!['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userRole)) {
      throw createError({
        statusCode: 403,
        statusMessage: '需要管理员权限才能访问此页面'
      })
    }
  }
})
