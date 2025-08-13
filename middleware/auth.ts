export default defineNuxtRouteMiddleware((to, from) => {
  // 在服务器端，依赖服务器端认证插件设置的payload
  if (process.server) {
    const nuxtApp = useNuxtApp()
    
    console.log('[Route Middleware] 服务器端检查认证状态:', {
      path: to.path,
      isAuthenticated: nuxtApp.payload.isAuthenticated,
      user: nuxtApp.payload.user?.username
    })
    
    // 检查SSR payload中的认证状态
    if (!nuxtApp.payload.isAuthenticated) {
      console.log('[Route Middleware] 认证失败，重定向到登录页')
      return navigateTo('/login')
    }
    
    // 如果是dashboard页面，检查管理员权限
    if (to.path === '/dashboard') {
      const userRole = nuxtApp.payload.user?.role
      if (!['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(userRole)) {
        throw createError({
          statusCode: 403,
          statusMessage: '需要管理员权限才能访问此页面'
        })
      }
    }
    return
  }
  
  // 在客户端，使用useAuth检查认证状态
  const auth = useAuth()
  
  // 确保认证状态已初始化
  auth.initAuth()
  
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
