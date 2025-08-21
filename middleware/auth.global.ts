import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, initAuth } = useAuth();
  const publicRoutes = ['/login', '/', '/about']; // 公共页面

  // 只在客户端初始化认证状态，避免服务端状态共享
  if (process.client && !isAuthenticated.value) {
    await initAuth();
  }

  // 如果目标路由是公共页面，则不进行处理
  if (publicRoutes.includes(to.path)) {
    return;
  }

  // 服务端跳过认证检查，由客户端处理
  if (process.server) {
    return;
  }

  // 如果用户未认证且目标路由不是登录页，则重定向到登录页
  if (!isAuthenticated.value && to.path !== '/login') {
    // 如果用户尝试访问非公共页面，则保存该页面路径，以便登录后重定向
    const redirect = to.fullPath;
    return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`);
  }
});