<template>
  <div class="app">
    <header v-if="showHeader" class="site-header">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <div class="site-branding flex items-center">
          <img v-if="config.public.siteLogo" :src="config.public.siteLogo" alt="网站Logo" class="site-logo mr-2" />
          <h1 class="site-title text-xl font-bold">{{ config.public.siteTitle }}</h1>
        </div>
        <div class="site-description text-sm text-gray-600 hidden md:block">
          {{ config.public.siteDescription }}
        </div>
      </div>
    </header>
    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'

// 获取运行时配置
const config = useRuntimeConfig()

// 根据路由决定是否显示头部
const route = useRoute()
const showHeader = computed(() => {
  // 在首页不显示头部，因为首页已经有了自己的标题区域
  return route.path !== '/'
})

// 使用onMounted确保只在客户端初始化认证
let auth = null
let isAuthenticated = false

// 在组件挂载后初始化认证（只会在客户端执行）
onMounted(() => {
  auth = useAuth()
  isAuthenticated = auth.isAuthenticated.value
})

// 使用计算属性确保安全地访问auth对象
const safeIsAuthenticated = computed(() => auth?.isAuthenticated?.value || false)

const handleLogout = () => {
  if (auth) {
    auth.logout()
  }
}
</script>

<style>
/* 全局样式由assets/css/main.css提供 */

/* 应用布局 */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* 站点头部 */
.site-header {
  background-color: #fff;
  border-bottom: 1px solid #eaeaea;
}

.site-logo {
  max-height: 40px;
  width: auto;
}

/* 主要内容 */
.main-content {
  flex: 1;
  padding: 0;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .main-content {
    padding: 0;
  }
  
  .site-description {
    display: none;
  }
}
</style>
