<template>
  <div class="lyrics-fullscreen-container">
    <!-- 动态背景 -->
    <div class="background-layer" ref="backgroundContainer">
      <div 
        v-if="backgroundConfig.type === 'gradient'" 
        class="gradient-background"
        :class="{ 'dynamic': backgroundConfig.dynamic }"
      ></div>
      <div 
        v-else-if="backgroundConfig.type === 'cover' && currentSong?.cover" 
        class="cover-background"
        ref="coverBlurContainer"
        :style="{ backgroundImage: `url(${currentSong.cover})` }"
      >
        <div class="cover-blur-overlay"></div>
      </div>
    </div>

    <!-- 歌曲信息 -->
    <div class="song-info">
      <div class="song-cover">
        <img 
          v-if="currentSong?.cover" 
          :src="currentSong.cover" 
          :alt="currentSong.title"
          @error="handleCoverError"
        />
        <div v-else class="default-cover">
          <Icon name="music" size="24" />
        </div>
      </div>
      <div class="song-details">
        <h1 class="song-title">{{ currentSong?.title || '未知歌曲' }}</h1>
        <p class="song-artist">{{ currentSong?.artist || '未知艺术家' }}</p>
      </div>
    </div>

    <!-- 歌词显示区域 -->
    <div class="lyrics-display-area">
      <div 
        v-if="isLoadingLyrics" 
        class="loading-lyrics"
      >
        <div class="loading-spinner"></div>
        <p>加载歌词中...</p>
      </div>
      <div 
        v-else-if="!hasLyrics" 
        class="no-lyrics"
      >
        <Icon name="music-note" size="48" />
        <p>暂无歌词</p>
      </div>
      <div class="lyrics-container">
        <!-- 这里将集成 @applemusic-like-lyrics/core -->
        <div id="lyric-player" class="lyric-player" ref="lyricsContainer"></div>
      </div>
    </div>

    <!-- 播放控制栏 -->
    <div class="playback-controls">
      <div class="control-buttons">
        <button 
          class="control-btn"
          @click="previousSong"
          :disabled="!hasPrevious"
        >
          <Icon name="skip-back" size="20" />
        </button>
        <button 
          class="play-pause-btn"
          @click="togglePlayPause"
        >
          <Icon :name="isPlaying ? 'pause' : 'play'" size="24" />
        </button>
        <button 
          class="control-btn"
          @click="nextSong"
          :disabled="!hasNext"
        >
          <Icon name="skip-forward" size="20" />
        </button>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <span class="time-display">{{ formatTime(currentTime) }}</span>
        <div 
          class="progress-bar"
          ref="progressBar"
          @click="handleProgressClick"
        >
          <div 
            class="progress-fill"
            :style="{ width: `${progressPercentage}%` }"
          ></div>
          <div 
            class="progress-thumb"
            :style="{ left: `${progressPercentage}%` }"
          ></div>
        </div>
        <span class="time-display">{{ formatTime(duration) }}</span>
      </div>

      <!-- 音量控制 -->
      <div class="volume-section">
        <button 
          class="control-btn"
          @click="toggleMute"
        >
          <Icon :name="isMuted ? 'volume-x' : 'volume-2'" size="18" />
        </button>
        <div class="volume-slider">
          <input 
            type="range" 
            min="0" 
            max="100" 
            v-model="volumeLevel"
            @input="handleVolumeChange"
          />
        </div>
      </div>
    </div>

    <!-- 设置按钮 -->
    <button 
      class="settings-btn"
      @click="showSettings = !showSettings"
    >
      <Icon name="settings" size="20" />
    </button>

    <!-- 返回按钮 -->
    <button 
      class="back-btn"
      @click="exitFullscreen"
    >
      <Icon name="x" size="20" />
    </button>

    // 设置面板
    <div 
      v-if="showSettings" 
      class="settings-panel"
      @click.stop
    >
      <div class="settings-content">
        <div class="settings-header">
          <h3>设置</h3>
          <button 
            class="close-settings-btn"
            @click="showSettings = false"
          >
            <Icon name="x" size="16" />
          </button>
        </div>
        
        <div class="settings-section">
          <h4>歌词设置</h4>
          
          <div class="setting-group">
            <label>字体大小</label>
            <div class="range-input-group">
              <input 
                type="range" 
                min="16" 
                max="32" 
                v-model="lyricConfig.fontSize"
                class="range-input"
              />
              <span class="range-value">{{ lyricConfig.fontSize }}px</span>
            </div>
          </div>
    
          <div class="setting-group">
            <label>行高</label>
            <div class="range-input-group">
              <input 
                type="range" 
                min="1.2" 
                max="2.0" 
                step="0.1"
                v-model="lyricConfig.lineHeight"
                class="range-input"
              />
              <span class="range-value">{{ lyricConfig.lineHeight }}</span>
            </div>
          </div>
    
          <div class="setting-group">
            <label>对齐位置</label>
            <div class="range-input-group">
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                v-model="lyricConfig.alignPosition"
                class="range-input"
              />
              <span class="range-value">{{ Math.round(lyricConfig.alignPosition * 100) }}%</span>
            </div>
          </div>
    
          <div class="setting-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="lyricConfig.enableBlur"
              />
              <span class="checkbox-text">启用模糊效果</span>
            </label>
          </div>
    
          <div class="setting-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="lyricConfig.enableScale"
              />
              <span class="checkbox-text">启用缩放效果</span>
            </label>
          </div>
    
          <div class="setting-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="lyricConfig.enableSpring"
              />
              <span class="checkbox-text">启用弹性动画</span>
            </label>
          </div>
        </div>
    
        <div class="settings-section">
          <h4>背景设置</h4>
          
          <div class="setting-group">
            <label>背景类型</label>
            <select v-model="backgroundConfig.type" class="select-input">
              <option value="gradient">网格渐变</option>
              <option value="cover">封面模糊</option>
            </select>
          </div>
    
          <div class="setting-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="backgroundConfig.dynamic"
              />
              <span class="checkbox-text">动态效果</span>
            </label>
          </div>
    
          <div v-if="backgroundConfig.dynamic" class="setting-group">
            <label>流动速度</label>
            <div class="range-input-group">
              <input 
                type="range" 
                min="1" 
                max="10" 
                v-model="backgroundConfig.flowSpeed"
                class="range-input"
              />
              <span class="range-value">{{ backgroundConfig.flowSpeed }}</span>
            </div>
          </div>
    
          <div class="setting-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="backgroundConfig.colorMask"
              />
              <span class="checkbox-text">颜色遮罩</span>
            </label>
          </div>
    
          <div v-if="backgroundConfig.colorMask" class="setting-group">
            <label>遮罩透明度</label>
            <div class="range-input-group">
              <input 
                type="range" 
                min="0" 
                max="80" 
                v-model="backgroundConfig.maskOpacity"
                class="range-input"
              />
              <span class="range-value">{{ backgroundConfig.maskOpacity }}%</span>
            </div>
          </div>
        </div>
    
        <div class="settings-section">
          <h4>快捷键</h4>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <span class="shortcut-key">空格</span>
              <span class="shortcut-desc">播放/暂停</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-key">←</span>
              <span class="shortcut-desc">上一首</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-key">→</span>
              <span class="shortcut-desc">下一首</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-key">Esc</span>
              <span class="shortcut-desc">退出全屏</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useLyrics } from '~/composables/useLyrics'
import { useLyricPlayer } from '~/composables/useLyricPlayer'
import { useBackgroundRenderer } from '~/composables/useBackgroundRenderer'
import { convertToAmllFormat } from '~/utils/lyricAdapter'
import Icon from '~/components/UI/Icon.vue'

// 路由和导航
const router = useRouter()

// 音频播放器状态
const audioPlayer = useAudioPlayer()
const lyrics = useLyrics()

// 歌词播放器和背景渲染器
const lyricPlayer = useLyricPlayer()
const backgroundRenderer = useBackgroundRenderer()

// 响应式状态
const showSettings = ref(false)
const lyricsContainer = ref<HTMLElement | null>(null)
const progressBar = ref<HTMLElement | null>(null)
const backgroundContainer = ref<HTMLElement | null>(null)
const coverBlurContainer = ref<HTMLElement | null>(null)
const progressUpdateTimer = ref<NodeJS.Timeout | null>(null)

// 播放状态
const currentSong = computed(() => audioPlayer.getCurrentSong().value)
const isPlaying = computed(() => audioPlayer.getPlayingStatus().value)
const currentTime = computed(() => audioPlayer.getCurrentPosition().value)
const duration = computed(() => audioPlayer.getDuration().value)
const volumeLevel = ref(100)
const isMuted = ref(false)

// 歌词状态
const hasLyrics = computed(() => lyrics.currentLyrics.value && lyrics.currentLyrics.value.length > 0)
const isLoadingLyrics = computed(() => lyrics.isLoading.value)

// 播放列表状态
const hasPrevious = computed(() => audioPlayer.hasPrevious.value)
const hasNext = computed(() => audioPlayer.hasNext.value)

// 进度百分比
const progressPercentage = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// 歌词配置
const lyricConfig = ref({
  fontSize: 24,
  lineHeight: 1.6,
  activeColor: '#ffffff',
  inactiveColor: 'rgba(255,255,255,0.6)',
  passedColor: 'rgba(255,255,255,0.4)',
  enableBlur: true,
  enableScale: true,
  enableSpring: true,
  alignPosition: 0.5
})

// 背景配置
const backgroundConfig = ref({
  type: 'gradient' as 'gradient' | 'cover',
  dynamic: true,
  flowSpeed: 4,
  colorMask: false,
  maskColor: '#000000',
  maskOpacity: 30
})

// 播放控制方法
const togglePlayPause = () => {
  if (isPlaying.value) {
    audioPlayer.pauseSong()
  } else {
    // 如果有当前歌曲，恢复播放
    if (currentSong.value) {
      audioPlayer.playSong(currentSong.value)
    }
  }
}

const previousSong = () => {
  audioPlayer.playPrevious()
}

const nextSong = () => {
  audioPlayer.playNext()
}

const handleProgressClick = (event: MouseEvent) => {
  if (!progressBar.value) return
  
  const rect = progressBar.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = clickX / rect.width
  const newTime = percentage * duration.value
  
  audioPlayer.setPosition(newTime)
}

const handleVolumeChange = () => {
  // 音量控制需要通过实际的音频元素来实现
  // 这里只是更新UI状态，实际音量控制应该在音频播放组件中处理
  isMuted.value = volumeLevel.value === 0
}

const toggleMute = () => {
  if (isMuted.value) {
    volumeLevel.value = 50 // 恢复到中等音量
    isMuted.value = false
  } else {
    volumeLevel.value = 0
    isMuted.value = true
  }
}

// 工具方法
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleCoverError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

const exitFullscreen = () => {
  router.back()
}

const handleKeydown = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'Space':
      event.preventDefault()
      togglePlayPause()
      break
    case 'Escape':
      exitFullscreen()
      break
    case 'ArrowLeft':
      previousSong()
      break
    case 'ArrowRight':
      nextSong()
      break
  }
}

// 启动进度更新定时器
const startProgressTimer = () => {
  if (progressUpdateTimer.value) {
    clearInterval(progressUpdateTimer.value)
  }
  
  progressUpdateTimer.value = setInterval(() => {
    // 只有在播放状态下才更新进度
    if (isPlaying.value && currentSong.value) {
      // 获取实际的音频元素
      const audioElements = document.querySelectorAll('audio')
      let actualCurrentTime = 0
      let actualDuration = 0
      
      // 找到正在播放的音频元素
      for (const audio of audioElements) {
        if (!audio.paused && audio.currentTime > 0) {
          actualCurrentTime = audio.currentTime
          actualDuration = audio.duration
          break
        }
      }
      
      // 如果找到了实际播放时间，更新全局状态
      if (actualCurrentTime > 0) {
        audioPlayer.updatePosition(actualCurrentTime)
        
        // 如果全局状态中的duration为0，但音频元素有duration，则更新它
        if (duration.value === 0 && actualDuration > 0) {
          audioPlayer.setDuration(actualDuration)
        }
        
        // 更新歌词时间
        const timeInMs = Math.floor(actualCurrentTime * 1000)
        lyricPlayer.updateTime(timeInMs)
      }
    }
  }, 100) // 每100ms更新一次
}

// 停止进度更新定时器
const stopProgressTimer = () => {
  if (progressUpdateTimer.value) {
    clearInterval(progressUpdateTimer.value)
    progressUpdateTimer.value = null
  }
}



// 页面元数据
definePageMeta({
  layout: false,
  title: '全屏歌词'
})

// 监听歌词配置变化
watch(lyricConfig, async (newConfig) => {
  await lyricPlayer.updateConfig(newConfig)
}, { deep: true })

// 监听背景配置变化
watch(backgroundConfig, async (newConfig) => {
  await backgroundRenderer.updateConfig(newConfig)
}, { deep: true })

// 监听当前歌曲变化
watch(currentSong, async (newSong) => {
  if (newSong) {
    console.log('[lyrics-fullscreen] 歌曲变化:', newSong.title)
    
    // 重置时长和进度
    if (duration.value === 0) {
      console.log('[lyrics-fullscreen] 当前时长为0，尝试从音频元素获取')
      
      // 等待一小段时间让音频元素加载
      await nextTick()
      setTimeout(() => {
        const audioElements = document.querySelectorAll('audio')
        for (const audio of audioElements) {
          if (audio.src && audio.duration > 0) {
            console.log('[lyrics-fullscreen] 从音频元素获取到时长:', audio.duration)
            audioPlayer.setDuration(audio.duration)
            break
          }
        }
      }, 500) // 延迟500ms确保音频元素已加载
    }
    
    // 更新歌词播放器
    lyricPlayer.loadSong(newSong.title, newSong.artist)
    
    // 使用正确的参数调用 fetchLyrics
    if (newSong.musicPlatform && newSong.musicId) {
      console.log('[lyrics-fullscreen] 开始获取歌词...')
      await lyrics.fetchLyrics(newSong.musicPlatform, newSong.musicId)
      console.log('[lyrics-fullscreen] 歌词获取完成')
    } else {
      console.warn('[lyrics-fullscreen] 缺少音乐平台或歌曲ID，无法获取歌词')
    }
    
    // 设置封面背景和渐变颜色
    if (newSong.cover) {
      console.log('[lyrics-fullscreen] 设置封面背景:', newSong.cover)
      backgroundRenderer.setCoverBackground(newSong.cover)
      // 基于封面设置渐变颜色
      await backgroundRenderer.setGradientFromCover(newSong.cover)
    }
  }
})

// 监听歌词数据变化
watch(() => lyrics.currentLyrics.value, async (newLyrics) => {
  console.log('[lyrics-fullscreen] 歌词数据变化:', newLyrics?.length || 0, '行歌词')
  console.log('[lyrics-fullscreen] 歌词播放器状态:', lyricPlayer.isInitialized.value)
  
  if (newLyrics && newLyrics.length > 0) {
    console.log('[lyrics-fullscreen] 转换歌词为 AMLL 格式...')
    // 转换歌词格式为 AMLL 格式
    const amllLyrics = convertToAmllFormat(newLyrics)
    console.log('[lyrics-fullscreen] AMLL 歌词转换完成，行数:', amllLyrics.length)
    console.log('[lyrics-fullscreen] 第一行歌词示例:', amllLyrics[0])
    
    if (lyricPlayer.isInitialized.value) {
      await lyricPlayer.setLyrics(amllLyrics)
      console.log('[lyrics-fullscreen] 歌词设置到播放器完成')
    } else {
      console.warn('[lyrics-fullscreen] 歌词播放器未初始化，无法设置歌词')
    }
  } else {
    console.log('[lyrics-fullscreen] 无歌词数据')
  }
})

// 监听播放时间变化
watch(currentTime, (newTime) => {
  // 确保时间是整数毫秒
  const timeInMs = Math.floor(newTime * 1000)
  lyricPlayer.updateTime(timeInMs)
})

// 监听歌曲时长变化，确保进度条能正常工作
watch(duration, (newDuration) => {
  console.log('[lyrics-fullscreen] 歌曲时长更新:', newDuration)
  // 如果时长从0变为有效值，重新计算进度百分比
  if (newDuration > 0 && currentTime.value > 0) {
    console.log('[lyrics-fullscreen] 重新计算进度百分比')
  }
})

// 监听播放状态变化
watch(isPlaying, (playing) => {
  lyricPlayer.setPlayingState(playing)
  
  // 根据播放状态启动或停止进度定时器
  if (playing) {
    startProgressTimer()
  } else {
    stopProgressTimer()
  }
})



// 生命周期
onMounted(async () => {
  // 等待 DOM 渲染完成
  await nextTick()
  
  console.log('[lyrics-fullscreen] 开始初始化组件...')
  
  // 初始化歌词播放器
  if (lyricsContainer.value) {
    console.log('[lyrics-fullscreen] 初始化歌词播放器...')
    await lyricPlayer.initializeLyricPlayer(lyricsContainer.value)
    console.log('[lyrics-fullscreen] 歌词播放器初始化完成')
    
    // 启动动画循环（类似于 applemusic-like-lyrics-page-main）
    startAnimationLoop()
  } else {
    console.warn('[lyrics-fullscreen] 歌词容器未找到')
  }
  
  // 初始化背景渲染器
  if (backgroundContainer.value) {
    console.log('[lyrics-fullscreen] 初始化背景渲染器...')
    await backgroundRenderer.initializeBackground(backgroundContainer.value)
    
    // 设置封面模糊元素
    if (coverBlurContainer.value) {
      backgroundRenderer.setCoverBlurElement(coverBlurContainer.value)
    }
    
    // 开始渲染
    backgroundRenderer.startRender()
    console.log('[lyrics-fullscreen] 背景渲染器初始化完成')
  }
  
  // 如果有当前歌曲，处理歌词
  if (currentSong.value) {
    console.log('[lyrics-fullscreen] 处理当前歌曲:', currentSong.value.title)
    // 使用正确的参数调用 fetchLyrics
    if (currentSong.value.musicPlatform && currentSong.value.musicId) {
      await lyrics.fetchLyrics(currentSong.value.musicPlatform, currentSong.value.musicId)
    }
    
    if (currentSong.value.cover) {
      backgroundRenderer.setCoverBackground(currentSong.value.cover)
    }
  }
  
  // 如果当前正在播放，启动进度定时器
  if (isPlaying.value) {
    startProgressTimer()
  }
  
  // 监听键盘事件
  document.addEventListener('keydown', handleKeydown)
  console.log('[lyrics-fullscreen] 组件初始化完成')
})

// 启动动画循环（参考 applemusic-like-lyrics-page-main）
const startAnimationLoop = () => {
  let lastTime = -1
  
  const frame = (time: number) => {
    if (lastTime === -1) {
      lastTime = time
    }
    
    // 更新歌词播放器
    lyricPlayer.update(time - lastTime)
    lastTime = time
    
    requestAnimationFrame(frame)
  }
  
  requestAnimationFrame(frame)
}

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  
  // 停止进度定时器
  stopProgressTimer()
  
  // 清理资源
  lyricPlayer.dispose()
  backgroundRenderer.dispose()
})
</script>

<style scoped>
.lyrics-fullscreen-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000000;
  color: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: "SF Pro Display", "PingFang SC", system-ui, sans-serif;
  /* 添加进入动画 */
  animation: fadeInScale 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

/* 页面进入动画 */
@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 背景层 */
.background-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  /* 背景渐入动画 */
  animation: backgroundFadeIn 0.8s ease-out forwards;
}

@keyframes backgroundFadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.gradient-background {
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);
  background-size: 400% 400%;
  /* 添加渐变过渡效果 */
  transition: all 0.5s ease;
}

.gradient-background.dynamic {
  animation: gradientFlow 15s ease infinite;
}

@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.cover-background {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  filter: blur(20px);
  transform: scale(1.1);
  /* 添加封面切换过渡 */
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.cover-blur-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  /* 遮罩层过渡 */
  transition: background-color 0.5s ease;
}

/* 歌曲信息 */
.song-info {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
  /* 添加滑入动画 */
  animation: slideInFromTop 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both;
}

@keyframes slideInFromTop {
  0% {
    opacity: 0;
    transform: translateY(-30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.song-cover {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  /* 封面切换动画 */
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.song-cover:hover {
  transform: scale(1.05);
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 图片加载过渡 */
  transition: opacity 0.3s ease;
}

.default-cover {
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.3s ease;
}

.song-details {
  flex: 1;
}

.song-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: #ffffff;
  /* 文字切换动画 */
  transition: all 0.3s ease;
}

.song-artist {
  font-size: 1rem;
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.3s ease;
}

/* 歌词显示区域 */
.lyrics-display-area {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  /* 歌词区域滑入动画 */
  animation: slideInFromBottom 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.4s both;
}

@keyframes slideInFromBottom {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.no-lyrics, .loading-lyrics {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  /* 状态切换动画 */
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.no-lyrics p, .loading-lyrics p {
  margin: 1rem 0 0 0;
  font-size: 1.1rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.lyrics-container {
  width: 100%;
  height: 100%;
  position: relative;
  /* 歌词容器淡入 */
  animation: fadeIn 0.6s ease;
}

.lyric-player {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 播放控制栏 */
.playback-controls {
  position: relative;
  z-index: 2;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-radius: 8px 8px 0 0;
  /* 控制栏滑入动画 */
  animation: slideInFromBottom 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.6s both;
  /* 背景过渡 */
  transition: background-color 0.3s ease, backdrop-filter 0.3s ease;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.control-btn, .play-pause-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  /* 添加按钮弹性动画 */
  transform-origin: center;
}

.control-btn {
  width: 40px;
  height: 40px;
}

.play-pause-btn {
  width: 48px;
  height: 48px;
}

.control-btn:hover, .play-pause-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.control-btn:active, .play-pause-btn:active {
  transform: scale(0.95);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn:disabled:hover {
  transform: none;
  background: rgba(255, 255, 255, 0.1);
}

/* 进度条 */
.progress-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-display {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
  min-width: 40px;
  text-align: center;
  /* 时间显示过渡 */
  transition: color 0.3s ease;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  /* 进度条过渡 */
  transition: all 0.2s ease;
}

.progress-bar:hover {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: #ffffff;
  border-radius: 2px;
  transition: width 0.1s ease;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-bar:hover .progress-thumb {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.2);
}

/* 音量控制 */
.volume-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.volume-slider input {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  transition: all 0.2s ease;
}

.volume-slider input:hover {
  height: 6px;
}

.volume-slider input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.volume-slider input::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

/* 设置和返回按钮 */
.settings-btn, .back-btn {
  position: absolute;
  z-index: 3;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  /* 按钮滑入动画 */
  animation: slideInFromRight 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.8s both;
}

@keyframes slideInFromRight {
  0% {
    opacity: 0;
    transform: translateX(20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.settings-btn {
  top: 2rem;
  right: 4rem;
}

.back-btn {
  top: 2rem;
  right: 2rem;
}

.settings-btn:hover, .back-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

.settings-btn:active, .back-btn:active {
  transform: scale(0.9);
}

/* 设置面板 */
.settings-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 320px;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px);
  z-index: 4;
  overflow-y: auto;
  /* 设置面板滑入动画 */
  transform: translateX(100%);
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.settings-panel:not(.hidden) {
  transform: translateX(0);
}

.settings-content {
  padding: 2rem;
  /* 内容淡入动画 */
  animation: fadeIn 0.5s ease 0.2s both;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-header h3 {
  color: #ffffff;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.close-settings-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-settings-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.close-settings-btn:active {
  transform: scale(0.95);
}

.settings-section {
  margin-bottom: 2rem;
  /* 设置项滑入动画 */
  animation: slideInFromLeft 0.5s ease both;
}

@keyframes slideInFromLeft {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.settings-section:nth-child(2) { animation-delay: 0.1s; }
.settings-section:nth-child(3) { animation-delay: 0.2s; }
.settings-section:nth-child(4) { animation-delay: 0.3s; }

.settings-section h4 {
  color: #ffffff;
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.9;
}

.setting-group {
  margin-bottom: 1.5rem;
}

.setting-group label {
  display: block;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.range-input-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.range-input {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.range-input:hover {
  height: 6px;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.range-value {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  min-width: 40px;
  text-align: right;
  font-weight: 500;
  transition: color 0.3s ease;
}

.checkbox-group {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0 !important;
  transition: all 0.2s ease;
}

.checkbox-label:hover {
  transform: translateX(2px);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-right: 0.75rem;
  accent-color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.select-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.select-input:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.select-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  transition: all 0.2s ease;
}

.shortcut-item:hover {
  transform: translateX(2px);
}

.shortcut-key {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  transition: all 0.2s ease;
}

.shortcut-desc {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .song-info {
    padding: 1rem;
    gap: 0.75rem;
  }
  
  .song-cover {
    width: 50px;
    height: 50px;
  }
  
  .song-title {
    font-size: 1.1rem;
  }
  
  .song-artist {
    font-size: 0.9rem;
  }
  
  .lyrics-display-area {
    padding: 1rem;
  }
  
  .playback-controls {
    padding: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .control-buttons {
    gap: 0.75rem;
  }
  
  .control-btn {
    width: 36px;
    height: 36px;
  }
  
  .play-pause-btn {
    width: 44px;
    height: 44px;
  }
  
  .progress-section {
    order: 3;
    width: 100%;
    margin-top: 0.5rem;
  }
  
  .time-display {
    font-size: 0.8rem;
    min-width: 35px;
  }
  
  .settings-panel {
    width: 100%;
  }
  
  .settings-content {
    padding: 1.5rem;
  }
  
  .volume-section {
    display: none;
  }
  
  .settings-btn, .back-btn {
    width: 36px;
    height: 36px;
    top: 1.5rem;
  }
  
  .settings-btn {
    right: 3.5rem;
  }
  
  .back-btn {
    right: 1.5rem;
  }
  
  /* 移动端优化动画 */
  .lyrics-fullscreen-container {
    animation-duration: 0.4s;
  }
  
  .song-info {
    animation-duration: 0.6s;
    animation-delay: 0.1s;
  }
  
  .lyrics-display-area {
    animation-duration: 0.6s;
    animation-delay: 0.2s;
  }
  
  .playback-controls {
    animation-duration: 0.6s;
    animation-delay: 0.3s;
  }
}

/* 平板设备优化 */
@media (min-width: 769px) and (max-width: 1024px) {
  .song-info {
    padding: 1.5rem;
  }
  
  .playback-controls {
    padding: 1.25rem 1.5rem;
    gap: 1.5rem;
  }
  
  .settings-panel {
    width: 280px;
  }
  
  .settings-content {
    padding: 1.75rem;
  }
}

/* 大屏设备优化 */
@media (min-width: 1440px) {
  .song-info {
    padding: 2.5rem;
  }
  
  .song-cover {
    width: 70px;
    height: 70px;
  }
  
  .song-title {
    font-size: 1.4rem;
  }
  
  .song-artist {
    font-size: 1.1rem;
  }
  
  .playback-controls {
    padding: 2rem 2.5rem;
    gap: 2.5rem;
  }
  
  .control-btn {
    width: 44px;
    height: 44px;
  }
  
  .play-pause-btn {
    width: 52px;
    height: 52px;
  }
  
  .settings-panel {
    width: 360px;
  }
  
  .settings-content {
    padding: 2.5rem;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .control-btn, .play-pause-btn {
    /* 增大触摸目标 */
    min-width: 44px;
    min-height: 44px;
  }
  
  .progress-bar {
    height: 6px;
    /* 触摸设备上默认更粗的进度条 */
  }
  
  .progress-thumb {
    opacity: 1;
    width: 16px;
    height: 16px;
  }
  
  .range-input {
    height: 6px;
  }
  
  .range-input::-webkit-slider-thumb {
    width: 20px;
    height: 20px;
  }
  
  .volume-slider input {
    height: 6px;
  }
  
  .volume-slider input::-webkit-slider-thumb {
    width: 16px;
    height: 16px;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .lyrics-fullscreen-container {
    background: #000000;
  }
  
  .song-title {
    color: #ffffff;
  }
  
  .song-artist {
    color: #cccccc;
  }
  
  .control-btn, .play-pause-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .control-btn:hover, .play-pause-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .progress-fill {
    background: #ffffff;
  }
  
  .settings-panel {
    background: rgba(0, 0, 0, 0.98);
    border-left: 1px solid rgba(255, 255, 255, 0.2);
  }
}

/* 减少动画偏好支持 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .gradient-background.dynamic {
    animation: none;
  }
  
  .loading-spinner {
    animation: none;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid #ffffff;
  }
}

/* 暗色主题偏好支持 */
@media (prefers-color-scheme: dark) {
  .lyrics-fullscreen-container {
    background: #000000;
  }
  
  .cover-blur-overlay {
    background: rgba(0, 0, 0, 0.6);
  }
  
  .playback-controls {
    background: rgba(0, 0, 0, 0.8);
  }
  
  .settings-panel {
    background: rgba(0, 0, 0, 0.97);
  }
}

/* 横屏模式优化 */
@media (orientation: landscape) and (max-height: 600px) {
  .song-info {
    padding: 1rem 2rem;
  }
  
  .lyrics-display-area {
    padding: 1rem 2rem;
  }
  
  .playback-controls {
    padding: 1rem 2rem;
  }
  
  .settings-btn, .back-btn {
    top: 1rem;
  }
}

/* 竖屏模式优化 */
@media (orientation: portrait) {
  .lyrics-display-area {
    /* 竖屏时给歌词更多空间 */
    flex: 1.2;
  }
  
  .playback-controls {
    /* 竖屏时控制栏稍微紧凑 */
    padding: 1.25rem 2rem;
  }
}

.settings-section {
  margin-bottom: 2rem;
  /* 设置项滑入动画 */
  animation: slideInFromLeft 0.5s ease both;
}

@keyframes slideInFromLeft {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.settings-section:nth-child(2) { animation-delay: 0.1s; }
.settings-section:nth-child(3) { animation-delay: 0.2s; }
.settings-section:nth-child(4) { animation-delay: 0.3s; }

.settings-section h4 {
  color: #ffffff;
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.9;
}

.setting-group {
  margin-bottom: 1.5rem;
}

.setting-group label {
  display: block;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.range-input-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.range-input {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.range-input:hover {
  height: 6px;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.range-value {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  min-width: 40px;
  text-align: right;
  font-weight: 500;
  transition: color 0.3s ease;
}

.checkbox-group {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0 !important;
  transition: all 0.2s ease;
}

.checkbox-label:hover {
  transform: translateX(2px);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-right: 0.75rem;
  accent-color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.select-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.select-input:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.select-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  transition: all 0.2s ease;
}

.shortcut-item:hover {
  transform: translateX(2px);
}

.shortcut-key {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  transition: all 0.2s ease;
}

.shortcut-desc {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .song-info {
    padding: 1rem;
  }
  
  .playback-controls {
    padding: 1rem;
    gap: 1rem;
  }
  
  .settings-panel {
    width: 100%;
  }
  
  .volume-section {
    display: none;
  }
}
</style>