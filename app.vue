<template>
  <div class="app">
    <!-- 全局通知组件 -->
    <Notification
      v-if="notification.show"
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
      @close="closeNotification"
    />
    
    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
// 导入通知组件
import Notification from '~/components/UI/Notification.vue'

// 获取运行时配置
const config = useRuntimeConfig()

// 通知状态
const notification = ref({
  show: false,
  message: '',
  type: 'info'
})

// 全局事件总线，用于在任何组件中触发通知
const showGlobalNotification = (message, type = 'info') => {
  notification.value = {
    show: true,
    message,
    type
  }
  
  // 3秒后自动关闭
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

// 关闭通知
const closeNotification = () => {
  notification.value.show = false
}

// 挂载全局通知方法到window对象，以便在composables中使用
onMounted(() => {
  window.$showNotification = showGlobalNotification
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
  position: relative;
}

/* 移除旧的Logo定位样式 */

/* 主要内容 - 确保渐变能透过去 */
.main-content {
  flex: 1;
  padding: 0;
  position: relative;
  z-index: 1;
  background: transparent;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .main-content {
    padding: 0;
  }
}
</style>
