<template>
  <div class="app" data-theme="dark" data-color-scheme="custom">
    <!-- 全局通知组件 -->
    <Notification
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
      :duration="notification.duration"
      @close="closeNotification"
    />
    
    <!-- 全局音频播放器 - 使用isPlayerVisible控制显示/隐藏 -->
    <AudioPlayer
      v-if="isPlayerVisible"
      :song="currentSong"
      @close="handlePlayerClose"
      @ended="handlePlayerEnded"
    />
    
    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
import { onMounted, computed, ref, watch } from 'vue'
// 导入通知组件和音频播放器
import Notification from '~/components/UI/Notification.vue'
import AudioPlayer from '~/components/UI/AudioPlayer.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useAuth } from '~/composables/useAuth'

// 获取运行时配置
const config = useRuntimeConfig()

// 通知状态
const notification = ref({
  show: false,
  message: '',
  type: 'info',
  duration: 3000,
  timer: null
});

// 关闭通知
const closeNotification = () => {
  clearTimeout(notification.value.timer);
  notification.value.show = false;
};

// 显示通知
const showNotification = (message, type = 'info', duration = 3000) => {
  // 如果已有通知，先关闭
  closeNotification();
  
  // 设置新通知
  notification.value = {
    show: true,
    message,
    type,
    duration,
    timer: setTimeout(() => {
      notification.value.show = false;
    }, duration)
  };
};

// 全局挂载通知函数
onMounted(() => {
  window.$showNotification = showNotification;
});

// 音频播放器
const audioPlayer = useAudioPlayer()
const currentSong = ref(null)
const isPlayerVisible = ref(false) // 控制播放器显示/隐藏

// 监听当前播放的歌曲
watch(() => audioPlayer.getCurrentSong().value, (newSong) => {
  if (newSong) {
    currentSong.value = newSong
    isPlayerVisible.value = true
  } else {
    // 当没有歌曲时，不立即隐藏播放器，而是让动画完成
    currentSong.value = null
  }
}, { immediate: true })

// 处理播放器关闭事件
const handlePlayerClose = () => {
  // 先停止播放
  audioPlayer.stopSong()
  // 延迟隐藏播放器，让动画有时间执行
  setTimeout(() => {
    isPlayerVisible.value = false
  }, 400) // 略大于动画持续时间
}

// 处理播放结束事件
const handlePlayerEnded = () => {
  audioPlayer.stopSong()
}

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
