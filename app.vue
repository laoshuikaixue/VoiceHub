<template>
  <div class="app" data-theme="dark" data-color-scheme="custom">
    <!-- 全局通知容器组件 -->
    <LazyUINotificationContainer ref="notificationContainer" />
    
    <!-- 全局音频播放器 - 使用isPlayerVisible控制显示/隐藏 -->
    <LazyUIAudioPlayer
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
import { onMounted, computed, ref, watch, nextTick } from 'vue'
// 导入通知容器组件和音频播放器
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useAuth } from '~/composables/useAuth'

// 获取运行时配置
const config = useRuntimeConfig()

// 通知容器引用
const notificationContainer = ref(null)

// 音频播放器
const audioPlayer = useAudioPlayer()
const currentSong = ref(null)
const isPlayerVisible = ref(false) // 控制播放器显示/隐藏
const isAudioPlayerPreloaded = ref(false) // 音频播放器预加载状态

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

// 预加载音频播放器模块
const preloadAudioPlayerModules = async () => {
  if (isAudioPlayerPreloaded.value) return
  
  try {
    // 等待首页完全加载后再开始预加载
    await nextTick()
    
    // 延迟500ms，确保首页加载优先级
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 预加载音频播放器相关的composables
    const preloadPromises = [
      // 预加载音频播放器控制模块
      import('~/composables/useAudioPlayerControl'),
      // 预加载音频播放器同步模块
      import('~/composables/useAudioPlayerSync'),
      // 预加载音质管理模块
      import('~/composables/useAudioQuality'),
      // 预加载增强功能模块
      import('~/composables/useAudioPlayerEnhanced'),
      // 预加载歌词功能模块
      import('~/composables/useLyrics'),
      // 预加载WebSocket模块
      import('~/composables/useMusicWebSocket')
    ]
    
    // 并行加载所有模块
    await Promise.all(preloadPromises)
    
    // 预加载音频播放器组件（但不渲染）
    await import('~/components/UI/AudioPlayer.vue')
    
    isAudioPlayerPreloaded.value = true
    console.log('音频播放器模块预加载完成')
  } catch (error) {
    console.warn('音频播放器模块预加载失败:', error)
    // 预加载失败不影响正常功能，播放时会正常加载
  }
}

// 使用onMounted确保只在客户端初始化认证
let auth = null
let isAuthenticated = false

// 在组件挂载后初始化认证（只会在客户端执行）
onMounted(async () => {
  auth = useAuth()
  isAuthenticated = auth.isAuthenticated.value
  
  // 初始化鸿蒙系统控制事件监听
  setupHarmonyOSListeners()
  
  // 异步预加载音频播放器模块，不影响首页加载速度
  await preloadAudioPlayerModules()
})

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
