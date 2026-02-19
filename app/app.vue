<template>
  <div class="app" data-theme="dark" data-color-scheme="custom">
    <!-- 全局通知容器组件 -->
    <LazyUINotificationContainer ref="notificationContainer" />

    <!-- 全局音频播放器 - 使用isPlayerVisible控制显示/隐藏 -->
    <LazyUIAudioPlayer
      v-show="isPlayerVisible"
      :song="currentSong"
      :is-playlist-mode="isPlaylistMode"
      @close="handlePlayerClose"
      @ended="handlePlayerEnded"
    />

    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
// 导入通知容器组件和音频播放器
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useAuth } from '~/composables/useAuth'
import { useRoute } from 'vue-router'

// 获取运行时配置
const config = useRuntimeConfig()
const route = useRoute()

// 通知容器引用
const notificationContainer = ref(null)

// 音频播放器
const audioPlayer = useAudioPlayer()
const currentSong = ref(null)
const isPlayerVisible = ref(false) // 控制播放器显示/隐藏

// 判断是否为播放列表模式
// 投稿页面、搜索预览等场景不是播放列表模式，不应该自动跳过
const isPlaylistMode = computed(() => {
  const currentPath = route.path
  // 投稿页面不是播放列表模式
  if (currentPath.includes('/request') || currentPath.includes('/submit')) {
    return false
  }
  // 其他页面默认为播放列表模式（如歌曲列表、播出排期等）
  return true
})

// 监听路由变化，控制播放器显示/隐藏
watch(
  () => route.path,
  (newPath) => {
    // 其他页面，如果有当前歌曲则显示播放器
    if (currentSong.value) {
      isPlayerVisible.value = true
    }
  },
  { immediate: true }
)

// 监听当前播放的歌曲
watch(
  () => audioPlayer.getCurrentSong().value,
  (newSong) => {
    if (newSong) {
      currentSong.value = newSong
      // 显示播放器
      isPlayerVisible.value = true
    } else {
      // 当没有歌曲时，不立即隐藏播放器，而是让动画完成
      currentSong.value = null
    }
  },
  { immediate: true }
)

// 处理播放器关闭事件
const handlePlayerClose = () => {
  // 延迟隐藏播放器，与AudioPlayer组件的动画时长同步
  setTimeout(() => {
    isPlayerVisible.value = false
  }, 500)
}

// 处理播放结束事件
const handlePlayerEnded = () => {
  // 播放完成后直接停止播放器
  audioPlayer.stopSong()
  // 延迟隐藏播放器
  setTimeout(() => {
    isPlayerVisible.value = false
  }, 500)
}

// 使用onMounted确保只在客户端初始化认证
let auth = null
let isAuthenticated = false

// 设置鸿蒙系统控制事件监听
const setupHarmonyOSListeners = () => {
  if (typeof window === 'undefined') return

  // 监听鸿蒙系统控制事件
  const handleHarmonyOSPlay = () => {
    const currentGlobalSong = audioPlayer.getCurrentSong().value
    if (currentGlobalSong) {
      // 如果有当前歌曲，恢复播放
      audioPlayer.playSong(currentGlobalSong)
    }
  }

  const handleHarmonyOSPause = () => {
    audioPlayer.pauseSong()
  }

  const handleHarmonyOSStop = () => {
    audioPlayer.stopSong()
  }

  const handleHarmonyOSNext = async () => {
    try {
      const success = await audioPlayer.playNext()
      if (!success) {
        console.log('没有下一首歌曲或切换失败，继续播放当前歌曲')
        // 如果切换失败，不做任何操作，继续播放当前歌曲
      }
    } catch (error) {
      console.error('切换下一首歌曲失败:', error)
      // 切换失败时不停止播放，继续播放当前歌曲
    }
  }

  const handleHarmonyOSPrevious = async () => {
    try {
      const success = await audioPlayer.playPrevious()
      if (!success) {
        console.log('没有上一首歌曲或切换失败，继续播放当前歌曲')
        // 如果切换失败，不做任何操作，继续播放当前歌曲
      }
    } catch (error) {
      console.error('切换上一首歌曲失败:', error)
      // 切换失败时不停止播放，继续播放当前歌曲
    }
  }

  // 使用Nuxt的事件总线监听鸿蒙控制事件
  if (window.__NUXT__ && window.__NUXT__.$nuxt) {
    const nuxtApp = window.__NUXT__.$nuxt
    if (nuxtApp.$on) {
      nuxtApp.$on('harmonyos-play', handleHarmonyOSPlay)
      nuxtApp.$on('harmonyos-pause', handleHarmonyOSPause)
      nuxtApp.$on('harmonyos-stop', handleHarmonyOSStop)
      nuxtApp.$on('harmonyos-next', handleHarmonyOSNext)
      nuxtApp.$on('harmonyos-previous', handleHarmonyOSPrevious)
    }
  }

  // 备用方案：直接在window上监听自定义事件
  window.addEventListener('harmonyos-play', handleHarmonyOSPlay)
  window.addEventListener('harmonyos-pause', handleHarmonyOSPause)
  window.addEventListener('harmonyos-stop', handleHarmonyOSStop)
  window.addEventListener('harmonyos-next', handleHarmonyOSNext)
  window.addEventListener('harmonyos-previous', handleHarmonyOSPrevious)
}

// 在组件挂载后初始化认证（只会在客户端执行）
onMounted(async () => {
  auth = useAuth()
  isAuthenticated = auth.isAuthenticated.value

  // 初始化鸿蒙系统控制事件监听
  setupHarmonyOSListeners()
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
/* 应用布局 */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

/* 主要内容 */
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
