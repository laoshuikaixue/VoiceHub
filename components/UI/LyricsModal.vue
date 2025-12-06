<template>
  <Teleport to="body">
    <Transition name="modal-animation">
      <div 
        v-if="isVisible" 
        class="lyrics-modal-overlay" 
        @click="handleOverlayClick"
        @keydown="handleKeydown"
        tabindex="-1"
      >
        <div class="lyrics-fullscreen-container" ref="fullscreenContainer" :class="{ leaving: isExiting }">
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
              :style="{ backgroundImage: `url(${convertToHttps(currentSong.cover)})` }"
            >
            </div>
            <!-- 叠加暗化层，提升白色背景下歌词对比度 -->
            <div class="background-overlay"></div>
          </div>

          <!-- 关闭按钮 -->
          <button class="close-button" @click="closeModal">
            <Icon name="x" size="24" />
          </button>

          <!-- 歌曲信息 -->
          <div class="song-info">
            <div class="song-cover">
              <img 
                v-if="currentSong?.cover" 
                :src="convertToHttps(currentSong.cover)" 
                :alt="currentSong.title"
                referrerpolicy="no-referrer"
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
              <Icon name="lyrics" size="48" />
              <p>暂无歌词</p>
            </div>
            <div class="lyrics-container" v-show="hasLyrics">
              <!-- 这里将集成 @applemusic-like-lyrics/core -->
              <div id="lyric-player-modal" class="lyric-player" ref="lyricsContainer"></div>
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
                <div v-if="isLoadingTrack" class="loading-spinner"></div>
                <Icon v-else :name="isPlaying ? 'pause' : 'play'" size="24" />
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
                @mousedown="handleProgressMouseDown"
                @touchstart="handleProgressTouchStart"
                @touchmove="handleProgressTouchMove"
                @touchend="handleProgressTouchEnd"
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

            <!-- 音质设置 -->
            <div class="quality-section">
              <div class="quality-dropdown" :class="{ active: showQualitySettings }">
                <button 
                  class="quality-btn"
                  @click="showQualitySettings = !showQualitySettings"
                >
                  {{ currentQualityText }}
                  <Icon name="chevron-up" size="16" />
                </button>
                <div v-if="showQualitySettings" class="quality-options">
                  <button
                    v-for="option in currentPlatformOptions"
                    :key="option.value"
                    class="quality-option"
                    :class="{ active: isCurrentQuality(option.value) }"
                    @click="selectQuality(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import {computed, nextTick, onUnmounted, ref, watch} from 'vue'
import {useAudioPlayer} from '~/composables/useAudioPlayer'
import {useAudioPlayerControl} from '~/composables/useAudioPlayerControl'
import {useLyrics} from '~/composables/useLyrics'
import {useLyricPlayer} from '~/composables/useLyricPlayer'
import {useBackgroundRenderer} from '~/composables/useBackgroundRenderer'
import {convertToAmllFormat} from '~/utils/lyricAdapter'
import Icon from '~/components/UI/Icon.vue'
import {useAudioQuality} from '~/composables/useAudioQuality'
import {useAudioPlayerEnhanced} from '~/composables/useAudioPlayerEnhanced'
import {convertToHttps} from '~/utils/url'

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

// 音频播放器状态
const audioPlayer = useAudioPlayer()
const audioPlayerControl = useAudioPlayerControl()
const lyrics = useLyrics()

// 歌词播放器和背景渲染器
const lyricPlayer = useLyricPlayer()
const backgroundRenderer = useBackgroundRenderer()

// 响应式状态
const showQualitySettings = ref(false)
const lyricsContainer = ref(null)
const progressBar = ref(null)
const backgroundContainer = ref(null)
const coverBlurContainer = ref(null)
const progressUpdateTimer = ref(null)
const fullscreenContainer = ref(null)
const isExiting = ref(false)

// 拖拽状态管理
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartTime = ref(0)

// 播放状态
const currentSong = computed(() => audioPlayer.getCurrentSong().value)
const isPlaying = computed(() => audioPlayer.getPlayingStatus().value)
const isLoadingTrack = computed(() => audioPlayerControl.isLoadingTrack.value)
const currentTime = computed(() => audioPlayer.getCurrentPosition().value)
const duration = computed(() => audioPlayer.getDuration().value)
const { getQuality, getQualityLabel, getQualityOptions, saveQuality } = useAudioQuality()
const enhanced = useAudioPlayerEnhanced()

const currentQualityText = computed(() => {
  const platform = currentSong.value?.musicPlatform
  if (!platform) return '音质'
  const quality = getQuality(platform)
  const label = getQualityLabel(platform, quality)
  return label.replace(/音质|音乐/, '').trim() || '音质'
})

// 监听音质变化，强制更新显示
watch(() => {
  const platform = currentSong.value?.musicPlatform
  return platform ? getQuality(platform) : null
}, () => {
  // 触发响应式更新
  nextTick()
}, { deep: true })

const currentPlatformOptions = computed(() => {
  const platform = currentSong.value?.musicPlatform
  if (!platform) return []
  return getQualityOptions(platform)
})

const isCurrentQuality = (qualityValue) => {
  const platform = currentSong.value?.musicPlatform
  if (!platform) return false
  return getQuality(platform) === qualityValue
}

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
  fontSize: 32,
  lineHeight: 1.4,
  activeColor: '#ffffff',
  inactiveColor: 'rgba(255, 255, 255, 0.6)',
  translationColor: 'rgba(255, 255, 255, 0.8)',
  enableSpring: true,
  enableBlur: true,
  enableScale: true
})

// 背景配置
const backgroundConfig = ref({
  type: 'cover', // 'gradient' | 'cover'
  dynamic: true,
  blur: 40,
  brightness: 0.6,
  saturation: 1.05
})

// 响应式字体大小
const getResponsiveFontSize = () => {
  if (typeof window === 'undefined') return 32
  const width = window.innerWidth
  if (width < 768) return 24
  if (width < 1024) return 28
  return 32
}

const handleResize = () => {
  lyricConfig.value.fontSize = getResponsiveFontSize()
}

// 键盘事件处理
const handleKeydown = (event) => {
  if (!props.isVisible) return
  
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closeModal()
      break
    case ' ':
      event.preventDefault()
      togglePlayPause()
      break
    case 'ArrowLeft':
      event.preventDefault()
      previousSong()
      break
    case 'ArrowRight':
      event.preventDefault()
      nextSong()
      break
    case 'ArrowUp':
      event.preventDefault()
      // 音量增加逻辑可以在这里添加
      break
    case 'ArrowDown':
      event.preventDefault()
      // 音量减少逻辑可以在这里添加
      break
  }
}

// 播放控制方法
const togglePlayPause = async () => {
  const audioElements = document.querySelectorAll('audio')
  let audioElement = null
  
  for (const audio of audioElements) {
    if (audio.src && (audio.currentTime > 0 || !audio.paused)) {
      audioElement = audio
      break
    }
  }
  
  if (!audioElement) {
    console.warn('[lyrics-modal] 未找到音频元素')
    return
  }
  
  if (isPlaying.value) {
    audioElement.pause()
    audioPlayer.pauseSong()
  } else {
    audioElement.play().then(() => {
      audioPlayer.playSong(currentSong.value)
    }).catch(error => {
      console.error('[lyrics-modal] 播放失败:', error)
    })
  }
}

const previousSong = () => {
  audioPlayer.playPrevious()
}

const nextSong = () => {
  audioPlayer.playNext()
}

// 点击歌词行时跳转到对应进度
const handleLyricLineSeek = async (seconds) => {
  // 先强制停止歌词播放器的动画状态
  if (lyricPlayer.pause) {
    lyricPlayer.pause()
  }
  
  if (!isPlaying.value) {
    await togglePlayPause()
  }
  
  const audioElements = document.querySelectorAll('audio')
  for (const audio of audioElements) {
    if (audio.src) {
      audio.currentTime = seconds
      break
    }
  }
  
  // 更新音频播放器位置
  audioPlayer.setPosition(seconds)
  
  // 跳转歌词播放器时间（seekTo 方法内部已经处理了动画中断）
  lyricPlayer.seekTo(Math.floor(seconds * 1000))
}

const handleProgressClick = (event) => {
  if (!progressBar.value || isDragging.value) return
  
  const rect = progressBar.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = clickX / rect.width
  const newTime = percentage * duration.value
  
  const audioElements = document.querySelectorAll('audio')
  for (const audio of audioElements) {
    if (audio.src && (audio.currentTime > 0 || !audio.paused)) {
      const audioElement = audio
      audioElement.currentTime = newTime
      audioPlayer.setPosition(newTime)
      lyricPlayer.seekTo(Math.floor(newTime * 1000))
      break
    }
  }
}

// 触摸事件处理
const handleProgressTouchStart = (event) => {
  isDragging.value = true
  dragStartX.value = event.touches[0].clientX
  dragStartTime.value = currentTime.value
  document.addEventListener('touchmove', handleProgressTouchMove, { passive: false })
}

const handleProgressTouchEnd = () => {
  isDragging.value = false
  document.removeEventListener('touchmove', handleProgressTouchMove)
}

const calculateTimeFromClientX = (clientX) => {
  if (!progressBar.value || duration.value === 0) return 0
  const rect = progressBar.value.getBoundingClientRect()
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
  const percentage = x / rect.width
  return Math.max(0, Math.min(percentage * duration.value, duration.value))
}

const seekToTime = (newTime) => {
  const audioElements = document.querySelectorAll('audio')
  for (const audio of audioElements) {
    if (audio.src && (audio.currentTime > 0 || !audio.paused)) {
      audio.currentTime = newTime
      audioPlayer.setPosition(newTime)
      lyricPlayer.seekTo(Math.floor(newTime * 1000))
      break
    }
  }
}

const handleProgressMouseDown = (event) => {
  isDragging.value = true
  const newTime = calculateTimeFromClientX(event.clientX)
  seekToTime(newTime)
  document.addEventListener('mousemove', handleProgressMouseMove)
  document.addEventListener('mouseup', handleProgressMouseUp)
}

const handleProgressMouseMove = (event) => {
  if (!isDragging.value) return
  const newTime = calculateTimeFromClientX(event.clientX)
  seekToTime(newTime)
}

const handleProgressMouseUp = () => {
  if (!isDragging.value) return
  isDragging.value = false
  document.removeEventListener('mousemove', handleProgressMouseMove)
  document.removeEventListener('mouseup', handleProgressMouseUp)
}

const handleProgressTouchMove = (event) => {
  if (!isDragging.value) return
  if (event.touches && event.touches[0]) {
    event.preventDefault()
    const newTime = calculateTimeFromClientX(event.touches[0].clientX)
    seekToTime(newTime)
  }
}

// 音质选择
const selectQuality = async (qualityValue) => {
  const song = currentSong.value
  if (!song?.musicPlatform) return
  if (isCurrentQuality(qualityValue)) {
    showQualitySettings.value = false
    return
  }
  
  const result = await enhanced.enhancedQualitySwitch(song, qualityValue)
  if (result.success) {
    // 只有在切换成功后才保存音质设置
    saveQuality(song.musicPlatform, qualityValue)
    
    const updatedSong = { ...song, musicUrl: result.url }
    audioPlayer.playSong(updatedSong)
  }
  // 如果失败，不保存音质设置，保持原有状态
  showQualitySettings.value = false
}

// 工具方法
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleCoverError = (event) => {
  const img = event.target
  img.style.display = 'none'
}

// 模态框控制
const closeModal = () => {
  if (isExiting.value) return
  isExiting.value = true
  
  setTimeout(() => {
    emit('close')
    isExiting.value = false
  }, 300)
}

const handleOverlayClick = (event) => {
  // 只有点击背景遮罩层时才关闭模态框
  if (event.target.classList.contains('lyrics-modal-overlay')) {
    closeModal()
  }
}

// 进度更新定时器
const startProgressTimer = () => {
  if (progressUpdateTimer.value) return
  
  progressUpdateTimer.value = setInterval(() => {
    if (!props.isVisible) return
    
    const audioElements = document.querySelectorAll('audio')
    let actualCurrentTime = 0
    let actualDuration = 0
    
    for (const audio of audioElements) {
      if (audio.src && (audio.currentTime > 0 || !audio.paused)) {
        actualCurrentTime = audio.currentTime
        actualDuration = audio.duration || 0
        break
      }
    }
    
    if (actualCurrentTime > 0) {
      audioPlayer.updatePosition(actualCurrentTime)
      
      if (duration.value === 0 && actualDuration > 0) {
        audioPlayer.setDuration(actualDuration)
      }
      
      const timeInMs = Math.floor(actualCurrentTime * 1000)
      lyricPlayer.updateTime(timeInMs)
    }
  }, 80)
}

const stopProgressTimer = () => {
  if (progressUpdateTimer.value) {
    clearInterval(progressUpdateTimer.value)
    progressUpdateTimer.value = null
  }
}

// 禁用/恢复页面滚动
const disablePageScroll = () => {
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  document.documentElement.style.setProperty('overscroll-behavior', 'none')
}

const restorePageScroll = () => {
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  document.documentElement.style.removeProperty('overscroll-behavior')
}

// 监听可见性变化
watch(
  () => props.isVisible,
  async (visible) => {
    if (visible) {
      // 显示模态框时的初始化
      disablePageScroll()
      
      await nextTick()
      lyricConfig.value.fontSize = getResponsiveFontSize()
      
      // 初始化歌词播放器
      if (lyricsContainer.value) {
        await lyricPlayer.initializeLyricPlayer(lyricsContainer.value)
        lyricPlayer.onLineClick(handleLyricLineSeek)
        startAnimationLoop()
        // 初始化后应用当前配置并立即设置已有歌词
        await lyricPlayer.updateConfig(lyricConfig.value)
        if (lyrics.currentLyrics.value && lyrics.currentLyrics.value.length > 0) {
          const amllLyrics = convertToAmllFormat(
            lyrics.currentLyrics.value,
            lyrics.translationLyrics.value
          )
          await lyricPlayer.setLyrics(amllLyrics)
        }
      }
      
      // 初始化背景渲染器
      if (backgroundContainer.value) {
        await backgroundRenderer.initializeBackground(backgroundContainer.value)
        
        // 仅在需要封面模糊时设置元素
        if (coverBlurContainer.value && backgroundConfig.value.type === 'cover') {
          backgroundRenderer.setCoverBlurElement(coverBlurContainer.value)
        }
        
        backgroundRenderer.startRender()
      }
      
      // 处理当前歌曲
      if (currentSong.value) {
        if (currentSong.value.musicPlatform && currentSong.value.musicId) {
          await lyrics.fetchLyrics(currentSong.value.musicPlatform, currentSong.value.musicId)
        }
        
        if (currentSong.value.cover) {
          backgroundRenderer.setCoverBackground(currentSong.value.cover)
        }
      }
      
      if (isPlaying.value) {
        startProgressTimer()
      }
      
      document.addEventListener('keydown', handleKeydown)
      window.addEventListener('resize', handleResize)
    } else {
      // 隐藏模态框时的清理
      restorePageScroll()
      stopProgressTimer()
      lyricPlayer.dispose()
      backgroundRenderer.dispose()
      document.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', handleResize)
    }
  }
)

// 监听歌词配置变化
watch(lyricConfig, async (newConfig) => {
  if (props.isVisible) {
    await lyricPlayer.updateConfig(newConfig)
  }
}, { deep: true })

// 监听背景配置变化
watch(backgroundConfig, async (newConfig) => {
  if (props.isVisible) {
    await backgroundRenderer.updateConfig(newConfig)
  }
}, { deep: true })

// 监听当前歌曲变化
watch(currentSong, async (newSong) => {
  if (!props.isVisible || !newSong) return
  
  lyrics.clearLyrics()
  
  if (newSong.musicPlatform && newSong.musicId) {
    await lyrics.fetchLyrics(newSong.musicPlatform, newSong.musicId)
  }
  
  if (newSong.cover) {
    backgroundRenderer.setCoverBackground(newSong.cover)
    await backgroundRenderer.setGradientFromCover(newSong.cover)
  }
})

// 监听歌词数据变化
watch([
  () => lyrics.currentLyrics.value,
  () => lyrics.translationLyrics.value
], async ([newLyrics, newTranslations]) => {
  if (!props.isVisible) return
  
  if (newLyrics && newLyrics.length > 0) {
    const amllLyrics = convertToAmllFormat(newLyrics, newTranslations)
    
    if (lyricPlayer.isInitialized.value) {
      await lyricPlayer.setLyrics(amllLyrics)
    }
  }
})

// 当 hasLyrics 从 false 变为 true 时初始化并设置歌词
watch(hasLyrics, async (has) => {
  if (!props.isVisible) return
  if (has) {
    await nextTick()
    if (lyricsContainer.value && !lyricPlayer.isInitialized.value) {
      await lyricPlayer.initializeLyricPlayer(lyricsContainer.value)
      lyricPlayer.onLineClick(handleLyricLineSeek)
      await lyricPlayer.updateConfig(lyricConfig.value)
    }
    const amllLyrics = convertToAmllFormat(
      lyrics.currentLyrics.value,
      lyrics.translationLyrics.value
    )
    await lyricPlayer.setLyrics(amllLyrics)
  }
})
// 监听播放时间变化
watch(currentTime, (newTime) => {
  if (props.isVisible) {
    const timeInMs = Math.floor(newTime * 1000)
    lyricPlayer.updateTime(timeInMs)
  }
})

// 监听播放状态变化
watch(isPlaying, (playing) => {
  if (!props.isVisible) return
  
  lyricPlayer.setPlayingState(playing)
  
  if (playing) {
    startProgressTimer()
  } else {
    stopProgressTimer()
  }
})

// 启动动画循环
const startAnimationLoop = () => {
  let lastTime = -1
  
  const frame = (time) => {
    if (!props.isVisible) return
    
    if (lastTime === -1) {
      lastTime = time
    }
    
    lyricPlayer.update(time - lastTime)
    lastTime = time
    
    requestAnimationFrame(frame)
  }
  
  requestAnimationFrame(frame)
}

// 监听模态框显示状态变化
watch(() => props.isVisible, (visible) => {
  if (visible) {
    // 模态框打开时绑定键盘事件
    document.addEventListener('keydown', handleKeydown)
    // 禁用页面滚动
    document.body.style.overflow = 'hidden'
    // 启动动画循环
    startAnimationLoop()
  } else {
    // 模态框关闭时解绑键盘事件
    document.removeEventListener('keydown', handleKeydown)
    // 恢复页面滚动
    document.body.style.overflow = ''
    // 停止进度更新
    stopProgressTimer()
  }
})

onUnmounted(() => {
  stopProgressTimer()
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', handleProgressMouseMove)
  document.removeEventListener('mouseup', handleProgressMouseUp)
  document.removeEventListener('touchmove', handleProgressTouchMove)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.lyrics-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-fullscreen-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000000;
  color: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: "SF Pro Display", "PingFang SC", system-ui, sans-serif;
}

.lyrics-fullscreen-container.leaving {
  animation: fadeOutScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.close-button {
  position: absolute;
  top: 2rem;
  right: 2rem;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

/* 复用 lyrics-fullscreen 页面的样式 */
.background-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.gradient-background {
  width: 100%;
  height: 100%;
  display: none;
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
  filter: blur(40px) brightness(0.55) saturate(1.08);
  transform: scale(1.1);
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 背景暗化叠层，确保在亮色封面下歌词具有足够对比度 */
.background-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* 双层叠加：径向渐变集中暗化 + 全局轻度暗化 */
  background:
    radial-gradient(ellipse at center,
      rgba(0, 0, 0, 0.35) 0%,
      rgba(0, 0, 0, 0.5) 60%,
      rgba(0, 0, 0, 0.6) 100%
    ),
    linear-gradient(0deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.28));
  z-index: 1;
}

.song-info {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
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
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.song-cover:hover {
  transform: scale(1.05);
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  transition: all 0.3s ease;
}

.song-artist {
  font-size: 1rem;
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.3s ease;
}

.lyrics-display-area {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.loading-lyrics, .no-lyrics {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  gap: 1rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.lyrics-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyric-player {
  width: 100%;
  height: 100%;
}

.playback-controls {
  position: relative;
  z-index: 1;
  background: rgba(28, 28, 30, 0.45);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.control-btn, .play-pause-btn {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: rgba(255, 255, 255, 0.18);
  transform: none;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-display {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  min-width: 40px;
  text-align: center;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
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
  transition: left 0.1s ease;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.quality-section {
  position: relative;
}

.quality-dropdown {
  position: relative;
}

.quality-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.quality-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.quality-options {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 0.5rem 0;
  min-width: 120px;
  margin-bottom: 0.5rem;
}

.quality-option {
  width: 100%;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.5rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  transition: background 0.2s ease;
}

.quality-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.quality-option.active {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* 动画 */
/* 模态动画 */
.modal-animation-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.modal-animation-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19);
}

.modal-animation-enter-from {
  opacity: 0;
  backdrop-filter: blur(0px);
}

.modal-animation-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}

.modal-animation-enter-from .lyrics-fullscreen-container {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
}

.modal-animation-leave-to .lyrics-fullscreen-container {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

.modal-animation-enter-active .lyrics-fullscreen-container {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s;
}

.modal-animation-leave-active .lyrics-fullscreen-container {
  transition: all 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19);
}

@keyframes fadeOutScale {
  0% { 
    opacity: 1; 
    transform: scale(1); 
  }
  100% { 
    opacity: 0; 
    transform: scale(0.95) translateY(-10px); 
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .close-button {
    top: 1rem;
    right: 1rem;
    width: 36px;
    height: 36px;
  }
  
  .song-info {
    padding: 1rem;
  }
  
  .lyrics-display-area {
    padding: 1rem;
  }
  
  .playback-controls {
    padding: 0.5rem 1rem;
    gap: 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    grid-template-areas:
      "progress progress"
      "controls quality";
    align-items: center;
  }
  
  .progress-section {
    grid-area: progress;
    width: 100%;
  }
  
  .control-buttons {
    grid-area: controls;
    justify-content: center;
  }
  
  .quality-section {
    grid-area: quality;
    justify-self: end;
  }
  
  .control-btn {
    width: 36px;
    height: 36px;
  }
  
  .play-pause-btn {
    width: 44px;
    height: 44px;
  }
}

@media (hover: none) and (pointer: coarse) {
  .lyrics-fullscreen-container {
    --controls-height-mobile: 92px;
  }
  
  .lyrics-container {
    height: calc(100vh - var(--controls-height-mobile));
    overflow: hidden;
    padding-bottom: 0;
  }
  
  .playback-controls {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    background: rgba(28, 28, 30, 0.45);
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    padding: 0.5rem 1rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    gap: 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    grid-template-areas:
      "progress progress"
      "controls quality";
    align-items: center;
  }
  
  .progress-section {
    grid-area: progress;
    width: 100%;
  }
  
  .control-buttons {
    grid-area: controls;
    justify-content: center;
  }
  
  .quality-section {
    grid-area: quality;
    justify-self: end;
  }
  
  .quality-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
  }
  
  .quality-option {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
  }
  
  .progress-thumb {
    width: 20px;
    height: 20px;
  }
  
  .progress-bar {
    height: 6px;
  }
  
  .control-btn:active, .play-pause-btn:active, .quality-btn:active {
    transform: scale(0.96);
  }
}
</style>