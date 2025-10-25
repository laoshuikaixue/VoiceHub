import {useAuth} from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
    const {isAuthenticated, initAuth} = useAuth();
    const publicRoutes = ['/login', '/'];

    // 客户端初始化认证状态
    if (process.client && !isAuthenticated.value) {
        await initAuth();
    }

    // 公共页面跳过认证
    if (publicRoutes.includes(to.path)) {
        return;
    }

    // 服务端跳过认证检查
    if (process.server) {
        return;
    }

    // 未认证用户重定向到登录页
    if (!isAuthenticated.value && to.path !== '/login') {
        // 保存目标路径用于登录后重定向
        const redirect = to.fullPath;
        return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
});