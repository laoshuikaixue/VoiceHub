<template>
  <Teleport to="body">
    <Transition name="modal-animation">
      <div
          v-if="isVisible"
          class="lyrics-modal-overlay"
          tabindex="-1"
          @click="handleOverlayClick"
          @keydown="handleKeydown"
      >
        <div ref="fullscreenContainer" :class="{ leaving: isExiting }" class="lyrics-fullscreen-container">
          <!-- 动态背景 -->
          <div ref="backgroundContainer" class="background-layer">
            <div
                v-if="backgroundConfig.type === 'gradient'"
                :class="{ 'dynamic': backgroundConfig.dynamic }"
                class="gradient-background"
            ></div>
            <div
                v-else-if="backgroundConfig.type === 'cover' && currentSong?.cover"
                ref="coverBlurContainer"
                :style="{ backgroundImage: `url(${convertToHttps(currentSong.cover)})` }"
                class="cover-background"
            >
            </div>
            <!-- 叠加暗化层，提升白色背景下歌词对比度 -->
            <div class="background-overlay"></div>
          </div>

          <!-- 关闭按钮 -->
          <button class="close-button" @click="closeModal">
            <Icon name="x" size="24"/>
          </button>

          <!-- 频谱可视化 (左侧边缘) -->
          <canvas v-if="!isMobile" ref="spectrumCanvas" class="spectrum-visualizer" width="100" height="800"></canvas>

          <!-- 移动端浮动封面 (跨页动画) -->
          <div 
            v-if="isMobile && currentSong?.cover" 
            class="mobile-floating-cover"
            :style="mobileCoverStyle"
          >
            <img 
              :src="convertToHttps(currentSong.cover)" 
              class="cover-image" 
              referrerpolicy="no-referrer"
            />
          </div>

          <!-- 主内容区域 -->
          <div 
            class="main-content" 
            ref="mainContent"
            @scroll="handleMobileScroll"
          >
            <!-- 左侧区域：封面和歌曲信息 -->
            <div class="left-column">
              <!-- 桌面端显示，移动端隐藏(透明占位) -->
              <div class="album-cover-wrapper" :style="{ opacity: isMobile ? 0 : 1, pointerEvents: isMobile ? 'none' : 'auto' }">
                <div class="song-cover-container">
                  <div class="song-cover shadow-cover" :class="{ 'playing': isPlaying }">
                    <img
                        v-if="currentSong?.cover"
                        :alt="currentSong.title"
                        :src="convertToHttps(currentSong.cover)"
                        class="cover-image"
                        referrerpolicy="no-referrer"
                        @error="handleCoverError"
                    />
                    <div v-else class="default-cover">
                      <Icon name="music" size="64"/>
                    </div>
                  </div>
                </div>
              </div>

              <div class="song-info-container" :style="pageOneInfoStyle">
                <div class="song-details">
                  <h1 class="song-title">
                    {{ currentSong?.title || '未知歌曲' }}
                  </h1>
                  <p class="song-artist">{{ currentSong?.artist || '未知艺术家' }}</p>
                  
                  <!-- 移动端音质标识 (新设计：歌手名下方) -->
                  <div 
                    v-if="isMobile && currentSong?.musicPlatform" 
                    class="mobile-quality-badge"
                    @click.stop="showQualitySettings = !showQualitySettings"
                  >
                    <Icon name="music" size="12" style="margin-right: 4px; opacity: 0.8"/>
                    {{ currentQualityText }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧区域：歌词显示 -->
            <div class="right-column">
              <!-- 移动端顶部迷你信息栏 -->
              <div v-if="isMobile" class="mobile-lyric-header">
                <div class="header-spacer"></div> <!-- 为缩小后的封面留白 -->
                <div class="mini-song-info" :style="pageTwoInfoStyle">
                   <div class="mini-text-col">
                      <span class="mini-title">{{ currentSong?.title }}</span>
                      <span class="mini-artist">{{ currentSong?.artist }}</span>
                   </div>
                </div>
              </div>

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
                  <Icon name="lyrics" size="48"/>
                  <p>暂无歌词</p>
                </div>
                <div v-show="hasLyrics" class="lyrics-container">
                  <!-- 这里将集成 @applemusic-like-lyrics/core -->
                  <div id="lyric-player-modal" ref="lyricsContainer" class="lyric-player"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 移动端分页指示器 -->
          <div class="mobile-pagination-dots">
            <span 
              class="dot" 
              :class="{ active: currentMobilePage === 0 }"
              @click="scrollToPage(0)"
            ></span>
            <span 
              class="dot" 
              :class="{ active: currentMobilePage === 1 }"
              @click="scrollToPage(1)"
            ></span>
          </div>

          <!-- 播放控制栏 -->
          <div class="playback-controls">
            <div class="control-buttons">
              <button
                  :disabled="!hasPrevious"
                  class="control-btn"
                  @click="previousSong"
              >
                <Icon name="skip-back" size="24"/>
              </button>
              <button
                  class="play-pause-btn"
                  @click="togglePlayPause"
              >
                <div v-if="isLoadingTrack" class="loading-spinner"></div>
                <Icon v-else :name="isPlaying ? 'pause' : 'play'" size="32"/>
              </button>
              <button
                  :disabled="!hasNext"
                  class="control-btn"
                  @click="nextSong"
              >
                <Icon name="skip-forward" size="24"/>
              </button>
            </div>

            <!-- 进度条 -->
            <div class="progress-section">
              <span class="time-display">{{ formatTime(currentTime) }}</span>
              <div
                  ref="progressBar"
                  class="progress-bar"
                  @click="handleProgressClick"
                  @mousedown="handleProgressMouseDown"
                  @touchend="handleProgressTouchEnd"
                  @touchmove="handleProgressTouchMove"
                  @touchstart="handleProgressTouchStart"
              >
                <div
                    :style="{ width: `${progressPercentage}%` }"
                    class="progress-fill"
                ></div>
                <div
                    :style="{ left: `${progressPercentage}%` }"
                    class="progress-thumb"
                ></div>
              </div>
              <span class="time-display">{{ formatTime(duration) }}</span>
            </div>

            <!-- 音质设置 -->
            <div class="quality-section">
              <div :class="{ active: showQualitySettings }" class="quality-dropdown">
                <button
                    class="quality-btn"
                    @click="showQualitySettings = !showQualitySettings"
                >
                  {{ currentQualityText }}
                  <Icon name="chevron-up" size="16"/>
                </button>
                <div v-if="showQualitySettings" class="quality-options">
                  <button
                      v-for="option in currentPlatformOptions"
                      :key="option.value"
                      :class="{ active: isCurrentQuality(option.value) }"
                      class="quality-option"
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
import {useAudioVisualizer} from '~/composables/useAudioVisualizer'
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
const audioVisualizer = useAudioVisualizer()

// 响应式状态
const showQualitySettings = ref(false)
const lyricsContainer = ref(null)
const progressBar = ref(null)
const backgroundContainer = ref(null)
const coverBlurContainer = ref(null)
const spectrumCanvas = ref(null)
const progressUpdateTimer = ref(null)
const fullscreenContainer = ref(null)
const isExiting = ref(false)
const mainContent = ref(null)
const currentMobilePage = ref(0)
const scrollProgress = ref(0)
const isMobile = ref(false)

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
const {getQuality, getQualityLabel, getQualityOptions, saveQuality} = useAudioQuality()
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
}, {deep: true})

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

// 移动端状态与动画
const updateMobileState = () => {
  if (typeof window !== 'undefined') {
    // 统一将 1024px 以下视为移动端/平板模式（左右滑动分页）
    isMobile.value = window.innerWidth <= 1024
  }
}

const mobileCoverStyle = computed(() => {
  if (!isMobile.value) return {}
  
  const p = scrollProgress.value
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 812
  
  // 起始状态 (Page 1 Center)
  const startSize = 280
  // 垂直位置：与 CSS 中的 padding-top: 15vh 保持一致
  const startTop = windowHeight * 0.15
  const startLeft = windowWidth * 0.5
  
  // 结束状态 (Page 2 Top Left)
  const endSize = 48
  // 顶部偏移量：状态栏高度(safe-area) + Header高度/2 - 封面高度/2
  // 假设 Header 高度 48px，top 50px
  const endTop = 50 
  const endLeft = 24
  
  // 插值计算
  const currentSize = startSize - (startSize - endSize) * p
  const currentTop = startTop - (startTop - endTop) * p
  const currentLeft = startLeft - (startLeft - endLeft) * p
  
  // Transform 插值 (-50% -> 0%)
  // Start: translate(-50%, -50%) (因为 startTop/Left 是中心点吗？不，上面代码是 top/left 定位)
  // 修正：上面的 startTop/startLeft 应该是基于左上角的坐标，而不是中心点
  // startLeft = windowWidth * 0.5 - startSize / 2
  
  const realStartLeft = (windowWidth - startSize) / 2
  
  // 修正插值
  const realCurrentLeft = realStartLeft - (realStartLeft - endLeft) * p
  
  // 之前的逻辑中 transform 也在变，这会很复杂。建议直接操作 top/left/width/height，移除 transform
  
  return {
    width: `${currentSize}px`,
    height: `${currentSize}px`,
    top: `${currentTop}px`,
    left: `${realCurrentLeft}px`,
    position: 'absolute',
    zIndex: 100,
    borderRadius: `${12 - 4*p}px`,
    boxShadow: `0 ${16 - 12*p}px ${36 - 28*p}px rgba(0,0,0,${0.4 - 0.2*p})`,
    opacity: 1,
    // 确保点击穿透（如果在第二页需要操作下方的 Header）
    pointerEvents: p > 0.8 ? 'none' : 'auto' 
  }
})

const pageOneInfoStyle = computed(() => {
  if (!isMobile.value) return {}
  return {
    opacity: Math.max(0, 1 - scrollProgress.value * 2.5),
    transform: `translateY(${scrollProgress.value * -20}px)`
  }
})

const pageTwoInfoStyle = computed(() => {
  if (!isMobile.value) return {}
  // 在后半段才显示
  const p = scrollProgress.value
  const opacity = Math.max(0, (p - 0.6) * 2.5)
  return {
    opacity: opacity,
    transform: `translateY(${(1 - p) * 10}px)`,
    pointerEvents: opacity > 0.5 ? 'auto' : 'none'
  }
})

// 移动端分页处理
const handleMobileScroll = (event) => {
  const el = event.target
  const width = el.clientWidth
  const scrollLeft = el.scrollLeft
  currentMobilePage.value = Math.round(scrollLeft / width)
  
  // 计算进度 0 -> 1
  let progress = scrollLeft / width
  if (progress < 0) progress = 0
  if (progress > 1) progress = 1
  scrollProgress.value = progress
}

const scrollToPage = (pageIndex) => {
  if (!mainContent.value) return
  const width = mainContent.value.clientWidth
  mainContent.value.scrollTo({
    left: pageIndex * width,
    behavior: 'smooth'
  })
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
  saturation: 1.05,
  flowSpeed: 0.3
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
  updateMobileState()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    updateMobileState()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})

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
  document.addEventListener('touchmove', handleProgressTouchMove, {passive: false})
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

    const updatedSong = {...song, musicUrl: result.url}
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
        window.addEventListener('resize', updateMobileState)
        
        // Initial check
        updateMobileState()

        // 重置移动端滚动状态，防止从第二页关闭后再打开显示异常
        if (isMobile.value) {
          currentMobilePage.value = 0
          scrollProgress.value = 0
        }
      } else {
        // 隐藏模态框时的清理
        restorePageScroll()
        stopProgressTimer()
        lyricPlayer.dispose()
        backgroundRenderer.dispose()
        document.removeEventListener('keydown', handleKeydown)
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('resize', updateMobileState)
      }
    }
)

// 监听歌词配置变化
watch(lyricConfig, async (newConfig) => {
  if (props.isVisible) {
    await lyricPlayer.updateConfig(newConfig)
  }
}, {deep: true})

// 监听背景配置变化
watch(backgroundConfig, async (newConfig) => {
  if (props.isVisible) {
    await backgroundRenderer.updateConfig(newConfig)
  }
}, {deep: true})

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

    drawSpectrum()

    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

// 绘制频谱
const drawSpectrum = () => {
  if (!spectrumCanvas.value || !audioVisualizer.isInitialized.value) return
  
  const canvas = spectrumCanvas.value
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  
  const data = audioVisualizer.getFrequencyData()
  if (data.length === 0) return

  ctx.clearRect(0, 0, width, height)
  
  // 垂直分块频谱 (Vertical Block Spectrum)
  // 左侧绘制，模仿图片中的样式：一列垂直的块，随音量/频率跳动
  
  // 我们取低频到中频部分，因为它们视觉上最活跃
  // 比如取前 32 个频点，或者合并为 16 个块
  const barCount = 40
  const barHeight = height / barCount / 1.5 // 留出间隙
  const gap = 4
  const usableHeight = height - (barCount * gap)
  const blockH = usableHeight / barCount
  
  // 抽样频率数据
  // 我们只取低频部分，因为通常鼓点和贝斯在这里
  const step = Math.floor(data.length / 2 / barCount) 
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  
  for (let i = 0; i < barCount; i++) {
     const dataIndex = i * step
     const value = data[dataIndex] || 0
     
     // 计算该块的透明度或长度
     // 图片显示的是一列块，每个块的宽度或不透明度变化，或者只是长度变化
     // 看起来像 VU meter，从下往上？或者从中间往两边？
     // 图片左侧是一列不规则的条。
     
     // 尝试：根据音量决定条的长度
     const percent = value / 255
     const barW = width * percent * 0.8 // 最大 80% 宽度
     
     // 绘制圆角矩形
     const y = height - (i * (blockH + gap)) - 100 // 从底部向上，留出底部空间
     if (y < 0) break
     
     // 柔和的白色块
     ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + percent * 0.5})`
     
     ctx.beginPath()
     ctx.roundRect(0, y, Math.max(4, barW), blockH, 4)
     ctx.fill()
  }
}

// 监听模态框显示状态变化
watch(() => props.isVisible, async (visible) => {
  if (visible) {
    // 模态框打开时绑定键盘事件
    document.addEventListener('keydown', handleKeydown)
    // 禁用页面滚动
    document.body.style.overflow = 'hidden'
    
    // 初始化音频可视化
    // 尝试从 DOM 中查找音频元素
    const audioElements = document.querySelectorAll('audio')
    for (const audio of audioElements) {
        // 只要有 src 就可以尝试连接，不需要必须正在播放
        if (audio.src) {
            audioVisualizer.initialize(audio)
            break
        }
    }
    
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
  background: rgba(0, 0, 0, 0.95);
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

/* Background */
.background-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.gradient-background {
  width: 100%;
  height: 100%;
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
  filter: blur(60px) brightness(0.4) saturate(1.4);
  transform: scale(1.3);
  transition: background-image 0.8s ease-in-out;
}

.background-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%);
  z-index: 1;
}

/* Close Button */
.close-button {
  position: absolute;
  top: 2rem;
  right: 2rem;
  z-index: 50;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.spectrum-visualizer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100px;
  height: 100%;
  z-index: 5;
  pointer-events: none;
  opacity: 0.6;
}

.song-cover-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
  color: white;
}

/* Main Content Layout */
.main-content {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 4rem 6rem;
  gap: 6rem;
  height: calc(100% - 120px);
  box-sizing: border-box;
}

/* Left Column */
.left-column {
  flex: 0 0 45%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2.5rem;
}

.album-cover-wrapper {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.song-cover {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
  transform: scale(0.85);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease;
  position: relative;
}

.song-cover.playing {
  transform: scale(1);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
}

.song-cover:hover {
  transform: scale(1.02); /* 此时基于 playing 状态（如果 playing 为 true，可能需要注意 CSS 优先级，不过 hover 在后通常生效，但这里 base 是 scale(1) 或 scale(0.85)） */
}

/* 修正 hover 逻辑，使其叠加在当前状态上有点困难，简单处理即可。
   或者我们让 hover 稍微放大一点点。
   如果 playing，scale(1) -> hover scale(1.02)
   如果 paused，scale(0.85) -> hover scale(0.87) 
   纯 CSS 比较难做相对缩放，除非用 CSS 变量。
   暂时先只保留 playing 的缩放，hover 效果可以简化或者忽略，因为在移动端或全屏模式下 hover 没那么重要，且容易冲突。
   还是保留 hover，但要注意 */

.song-cover.playing:hover {
  transform: scale(1.02);
}

.song-cover:not(.playing):hover {
  transform: scale(0.88);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #333, #555);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.song-info-container {
  width: 100%;
  text-align: left;
}

.song-title {
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #ffffff;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.song-artist {
  font-size: 1.4rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  margin: 0;
  letter-spacing: -0.01em;
}

/* Right Column */
.right-column {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  /* Mask for fade out effect at top/bottom */
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
}

.lyrics-display-area {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.lyrics-container {
  width: 100%;
  height: 100%;
}

.lyric-player {
  width: 100%;
  height: 100%;
}

.loading-lyrics, .no-lyrics {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  gap: 1rem;
  font-size: 1.1rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Playback Controls */
.playback-controls {
  position: relative;
  z-index: 20;
  width: 100%;
  padding: 1rem 4rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.time-display {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  min-width: 45px;
  text-align: center;
  font-weight: 500;
}

.progress-bar {
  flex: 1;
  height: 5px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  transition: height 0.2s ease;
}

.progress-bar:hover {
  height: 5px;
}

.progress-fill {
  height: 100%;
  background: #ffffff;
  border-radius: 3px;
  pointer-events: none;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.1s ease;
  pointer-events: none;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.progress-bar:hover .progress-thumb {
  transform: translate(-50%, -50%) scale(1);
}

.control-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  position: relative;
}

.control-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.control-btn:hover {
  color: white;
  transform: scale(1.1);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
}

.play-pause-btn {
  background: transparent;
  color: white;
  width: auto;
  height: auto;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.play-pause-btn:hover {
  transform: scale(1.1);
}

/* Quality Section */
.quality-section {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.quality-btn {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.quality-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.quality-options {
  position: absolute;
  bottom: 120%;
  right: 0;
  background: rgba(30, 30, 30, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 10px;
  padding: 6px;
  min-width: 120px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.quality-option {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.quality-option:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.quality-option.active {
  color: #fa2d48;
  background: rgba(250, 45, 72, 0.1);
}

/* Transitions */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
  transform: translateY(40px) scale(0.98);
}

/* Mobile specific elements */
.mobile-floating-cover {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
  will-change: transform, width, height, top, left, border-radius, box-shadow;
  /* Ensure image fits */
}

.mobile-floating-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quality-tag-text {
  display: inline-block;
  vertical-align: middle;
  font-size: 0.4em; /* Relative to h1 */
  padding: 3px 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 8px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-6px);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
}

.mobile-lyric-header {
    position: absolute;
    top: 50px; /* Match endTop logic roughly */
    left: 0;
    width: 100%;
    padding: 0 24px 0 84px; /* Left padding: 24px + 48px(cover) + 12px(gap) */
    pointer-events: none;
    z-index: 50;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: 48px;
  }

  .header-spacer {
    /* Spacer is handled by padding, but keep it for DOM structure if needed or remove it */
    display: none;
  }

  .mini-song-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* 左对齐 */
    width: 100%;
    overflow: hidden;
  }

  .mini-text-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    overflow: hidden;
    gap: 2px;
  }

  .mini-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 4px rgba(0,0,0,0.3);
    line-height: 1.2;
    display: block;
    width: 100%;
  }

  .mini-artist {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    line-height: 1.2;
    display: block;
    width: 100%;
  }

  .mobile-quality-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    margin-top: 12px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }
  
  .mobile-quality-badge:active {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(0.96);
  }

  .mobile-pagination-dots {
  display: none;
  position: absolute;
  bottom: 150px; /* Adjust based on controls height */
  left: 50%;
  transform: translateX(-50%);
  gap: 8px;
  z-index: 30;
  pointer-events: none;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: auto;
}

.dot.active {
  background: #ffffff;
  transform: scale(1.2);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

/* Responsive */
/* 统一使用 1024px 作为移动端/平板布局的分界线 */
@media (max-width: 1024px) {
  /* Mobile Pagination Layout */
  .main-content {
    flex-direction: row;
    justify-content: flex-start; /* 关键修复：覆盖桌面端的 center，防止分页错位 */
    align-items: flex-start;
    padding: 0;
    gap: 0;
    width: 100vw;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    position: absolute;
    top: 0;
    left: 0;
  }
  
  /* Hide scrollbar */
  .main-content::-webkit-scrollbar {
    display: none;
  }

  .left-column {
    flex: 0 0 100vw; /* 强制不收缩 */
    flex-shrink: 0;
    width: 100vw;
    height: 100%;
    scroll-snap-align: start;
    flex-direction: column;
    justify-content: flex-start; /* 改为从上部开始，配合 padding 控制位置 */
    align-items: center;
    text-align: center;
    gap: 2.5rem;
    padding: 15vh 2rem 160px; /* Top padding 15vh (match JS startTop) */
    box-sizing: border-box;
    max-width: none;
    overflow: hidden; /* 防止内容溢出 */
  }

  .right-column {
    flex: 0 0 100vw; /* 强制不收缩 */
    flex-shrink: 0;
    width: 100vw;
    height: 100%;
    scroll-snap-align: start;
    padding: 100px 1.5rem 180px; /* Increased top padding for header */
    overflow-y: hidden; /* 内部歌词区域滚动，外部不滚动 */
    box-sizing: border-box;
    mask-image: none;
    -webkit-mask-image: none;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .lyrics-display-area {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  }

  .album-cover-wrapper {
    width: 280px;
    height: 280px;
    /* Box shadow is now handled by floating cover in JS */
  }

  .song-info-container {
    text-align: center;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: initial;
    opacity: 1;
    transform: none;
    /* transition由JS控制 */
  }

  .song-title {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: inline-block;
    max-width: 90%;
  }
  
  .song-artist {
    font-size: 1.3rem;
  }
  
  .mobile-pagination-dots {
    display: flex;
  }

  .playback-controls {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 1rem 1.5rem calc(1rem + env(safe-area-inset-bottom));
    gap: 1rem;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    box-sizing: border-box;
    z-index: 60; /* 确保在最上层 */
  }

  .progress-section {
    gap: 0.8rem;
  }

  .control-buttons {
    justify-content: space-between;
    width: 100%;
    padding: 0 1rem;
  }
  
  /* Hide original quality section on mobile */
  .quality-section {
    display: none;
  }

  /* 隐藏左侧栏的非必要元素（如果有的话，目前左侧主要是封面和信息） */
  /* 隐藏右侧栏可能存在的其他干扰 */
}

@media (max-width: 768px) {
  .album-cover-wrapper {
    width: 260px;
    height: 260px;
  }
  
  .song-title {
    font-size: 1.8rem;
  }
}

</style>