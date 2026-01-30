<template>
  <Teleport to="body">
    <Transition :name="isMobile ? 'slide-up' : 'modal-animation'">
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
            <Icon :name="isMobile ? 'chevron-down' : 'x'" size="24"/>
          </button>

          <!-- 频谱可视化 (左侧边缘) -->
          <canvas v-if="!isMobile" ref="spectrumCanvas" class="spectrum-visualizer" width="100" height="800"></canvas>

          <!-- 移动端浮动封面 (跨页动画) -->
          <div 
            v-if="isMobile && currentSong?.cover" 
            ref="mobileFloatingCoverRef"
            class="mobile-floating-cover"
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
            @scroll="onMainContentScroll"
            @click="handleOverlayClick" 
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

              <div ref="pageOneInfoRef" class="song-info-container">
                <div class="song-details">
                  <h1 class="song-title">
                    {{ currentSong?.title || '未知歌曲' }}
                  </h1>
                  <p class="song-artist">{{ currentSong?.artist || '未知艺术家' }}</p>
                  
                  <!-- 音质标识 (歌手名下方) -->
                  <div 
                    v-if="currentSong?.musicPlatform" 
                    class="mobile-quality-badge"
                    @click.stop="showQualitySettings = !showQualitySettings"
                  >
                    {{ currentQualityText }}

                    <!-- 音质切换菜单 -->
                    <div v-if="showQualitySettings" class="badge-quality-menu" @click.stop>
                      <div 
                        v-for="option in currentPlatformOptions"
                        :key="option.value"
                        class="badge-quality-option"
                        :class="{ active: isCurrentQuality(option.value) }"
                        @click="selectQuality(option.value)"
                      >
                        {{ option.label }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧区域：歌词显示 -->
            <div class="right-column">
              <!-- 移动端顶部迷你信息栏 -->
              <div v-if="isMobile" class="mobile-lyric-header">
                <div class="header-spacer"></div> <!-- 为缩小后的封面留白 -->
                <div ref="pageTwoInfoRef" class="mini-song-info">
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
const hasPushedHistory = ref(false)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 375)
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 812)

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

const selectQuality = async (qualityValue) => {
  if (!currentSong.value || !currentSong.value.musicPlatform) return
  // 如果选择的是当前音质，直接返回
  if (isCurrentQuality(qualityValue)) {
    showQualitySettings.value = false
    return
  }

  // 使用增强的音质切换功能
  const result = await enhanced.enhancedQualitySwitch(currentSong.value, qualityValue)

  if (result.success) {
    // 保存音质设置
    saveQuality(currentSong.value.musicPlatform, qualityValue)

    // 更新歌曲的音乐链接
    const updatedSong = {
      ...currentSong.value,
      musicUrl: result.url
    }

    // 更新全局状态
    if (audioPlayer.updateCurrentSong) {
        audioPlayer.updateCurrentSong(updatedSong)
    }

    showQualitySettings.value = false
  }
}

// 移动端状态与动画
const mobileFloatingCoverRef = ref(null)
const pageOneInfoRef = ref(null)
const pageTwoInfoRef = ref(null)
let animationFrameId = null

// 缓存布局参数
let cachedLayout = {
  width: 0,
  height: 0,
  contentWidth: 0,
  startTop: 0,
  realStartLeft: 0,
  totalTranslateX: 0,
  totalTranslateY: 0,
  targetScale: 1,
  startSize: 280
}

const updateLayoutCache = () => {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const h = window.innerHeight
  
  // 起始状态 (第一页中心)
  const startSize = 280
  // 垂直位置：与 CSS 中的 padding-top: 15vh 一致
  const startTop = h * 0.15
  const realStartLeft = (w - startSize) / 2
  
  // 结束状态 (第二页左上角)
  const endSize = 48
  const endTop = 50 
  const endLeft = 24
  
  cachedLayout = {
    width: w,
    height: h,
    contentWidth: mainContent.value ? mainContent.value.clientWidth : w,
    startTop,
    realStartLeft,
    totalTranslateX: endLeft - realStartLeft,
    totalTranslateY: endTop - startTop,
    targetScale: endSize / startSize,
    startSize
  }

  // 初始化静态样式，避免在滚动时计算
  if (mobileFloatingCoverRef.value) {
      const el = mobileFloatingCoverRef.value
      el.style.width = `${startSize}px`
      el.style.height = `${startSize}px`
      el.style.top = `${startTop}px`
      el.style.left = `${realStartLeft}px`
      el.style.transformOrigin = '0 0'
      el.style.zIndex = '100'
      el.style.borderRadius = '12px'
      // 固定阴影，避免重绘
      el.style.boxShadow = '0 16px 36px rgba(0,0,0,0.4)'
  }

  // 立即触发一次更新以修正位置
  if (isMobile.value) {
     requestAnimationFrame(() => {
        // 如果当前还没滚动，p=0
        const p = currentScrollProgress || 0
        // 重新调用 updateMobileAnimations 需要 width
        // 这里简单模拟一下
        updateMobileAnimations(p * cachedLayout.contentWidth, cachedLayout.contentWidth)
     })
  }
}

const updateMobileState = () => {
  if (typeof window !== 'undefined') {
    // 统一将 1024px 以下视为移动端/平板模式（左右滑动分页）
    const newIsMobile = window.innerWidth <= 1024
    if (newIsMobile !== isMobile.value) {
      isMobile.value = newIsMobile
      if (newIsMobile) {
        nextTick(updateLayoutCache)
      }
    } else if (newIsMobile) {
        updateLayoutCache()
    }
  }
}

// 使用非响应式变量存储滚动进度
let currentScrollProgress = 0

const updateMobileAnimations = (scrollLeft, width) => {
  let p = scrollLeft / width
  if (p < 0) p = 0
  if (p > 1) p = 1
  currentScrollProgress = p
  
  // 1. 更新封面动画
  if (mobileFloatingCoverRef.value) {
    const { 
      startTop, realStartLeft, 
      totalTranslateX, totalTranslateY, 
      targetScale, startSize 
    } = cachedLayout

    const currentScale = 1 + (targetScale - 1) * p
    const currentTranslateX = totalTranslateX * p
    const currentTranslateY = totalTranslateY * p

    const el = mobileFloatingCoverRef.value
    
    // 恢复圆角变化，但通过 scale 反向补偿以保持视觉平滑
    // 起始圆角 12px, 结束圆角 (缩小后) 看起来像 4px -> 实际上如果是 scale 缩放，圆角也会缩放
    // startSize 280 -> endSize 48 (ratio ~0.17)
    // 如果 border-radius 固定 12px，缩放后视觉上变成 12 * 0.17 = 2px，太小了
    // 我们希望结束时视觉圆角大约是 4px-8px
    // 所以我们需要动态计算 border-radius，除以 scale 来抵消缩放影响
    
    // 目标视觉圆角：开始 12px -> 结束 6px
    // 实际设置值 = 目标视觉圆角 / currentScale
    const targetVisualRadius = 12 - (6 * p) 
    const radius = targetVisualRadius / currentScale
    
    // 使用 cssText 一次性设置，减少重排
    // 注意：这里我们只更新变化的属性，其他静态属性在 updateLayoutCache 中已设置
    // 但为了确保覆盖，还是需要设置
    // 优化：只设置变化的 transform 和 borderRadius
    el.style.transform = `translate3d(${currentTranslateX}px, ${currentTranslateY}px, 0) scale(${currentScale})`
    el.style.borderRadius = `${radius}px`
    el.style.opacity = 1
    // 确保点击穿透逻辑依然生效
    el.style.pointerEvents = p > 0.8 ? 'none' : 'auto'
  }

  // 2. 更新 Page One Info (Opacity & Translate)
  if (pageOneInfoRef.value) {
    const el = pageOneInfoRef.value
    const opacity = Math.max(0, 1 - p * 2.5)
    const translateY = p * -20
    
    el.style.opacity = opacity
    el.style.transform = `translateY(${translateY}px)`
  }

  // 3. 更新 Page Two Info (Opacity & Translate)
  if (pageTwoInfoRef.value) {
    const el = pageTwoInfoRef.value
    const opacity = Math.max(0, (p - 0.6) * 2.5)
    const translateY = (1 - p) * 10
    
    el.style.opacity = opacity
    el.style.transform = `translateY(${translateY}px)`
    el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none'
  }
}

// 移动端分页处理
const onMainContentScroll = (event) => {
  if (!isMobile.value) return
  
  const el = event.target
  const scrollLeft = el.scrollLeft
  // 如果缓存没有初始化，尝试初始化
  if (!cachedLayout.contentWidth) {
    updateLayoutCache()
  }
  const width = cachedLayout.contentWidth || el.clientWidth
  
  // 仅在页面索引变化时更新响应式状态
  const newPage = Math.round(scrollLeft / width)
  if (currentMobilePage.value !== newPage) {
    currentMobilePage.value = newPage
  }
  
  // 动画更新
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  animationFrameId = requestAnimationFrame(() => {
    updateMobileAnimations(scrollLeft, width)
  })
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
  type: 'cover', // 'gradient' (渐变) | 'cover' (封面)
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
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }
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
const handlePopState = () => {
  if (props.isVisible) {
    hasPushedHistory.value = false
    emit('close')
  }
}

const closeModal = () => {
  if (isExiting.value) return

  if (isMobile.value && hasPushedHistory.value) {
    history.back()
    return
  }

  isExiting.value = true

  setTimeout(() => {
    emit('close')
    isExiting.value = false
  }, 300)
}

const handleOverlayClick = (event) => {
  // 如果音质菜单是打开的，点击任意地方（除了菜单本身，菜单本身的点击事件在模板中已用 @click.stop 处理）都应该关闭
  if (showQualitySettings.value) {
    showQualitySettings.value = false
    // 如果是点击背景遮罩层，同时也执行关闭模态框逻辑
    if (event.target.classList.contains('lyrics-modal-overlay')) {
      closeModal()
    }
    return
  }

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

        // 初始化背景渲染器
        if (backgroundContainer.value) {
          await backgroundRenderer.initializeBackground(backgroundContainer.value)

          // 仅在需要封面模糊时设置元素
          if (coverBlurContainer.value && backgroundConfig.value.type === 'cover') {
            backgroundRenderer.setCoverBlurElement(coverBlurContainer.value)
          }

          backgroundRenderer.startRender()
        }

        // 优先设置封面背景，避免等待歌词加载
        if (currentSong.value && currentSong.value.cover) {
          backgroundRenderer.setCoverBackground(currentSong.value.cover)
        }

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

        // 处理当前歌曲 - 异步获取歌词，不阻塞其他初始化
        if (currentSong.value) {
          if (currentSong.value.musicPlatform && currentSong.value.musicId) {
            lyrics.fetchLyrics(currentSong.value.musicPlatform, currentSong.value.musicId)
          }
        }

        if (isPlaying.value) {
          startProgressTimer()
        }

        document.addEventListener('keydown', handleKeydown)
        window.addEventListener('resize', handleResize)
        window.addEventListener('resize', updateMobileState)
        
        // 初始检查
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

  if (newSong.cover) {
    backgroundRenderer.setCoverBackground(newSong.cover)
    await backgroundRenderer.setGradientFromCover(newSong.cover)
  }

  if (newSong.musicPlatform && newSong.musicId) {
    lyrics.fetchLyrics(newSong.musicPlatform, newSong.musicId)
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

    if (isMobile.value) {
      history.pushState({ modal: 'lyrics' }, '')
      hasPushedHistory.value = true
      window.addEventListener('popstate', handlePopState)
    }
    
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

    if (hasPushedHistory.value) {
      history.back()
      hasPushedHistory.value = false
    }
    window.removeEventListener('popstate', handlePopState)
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

/* 背景 */
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

/* 关闭按钮 */
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

/* 主内容布局 */
.main-content {
  position: relative;
  z-index: 50; /* 提高层级以确保子元素（如音质菜单）在播放控制条之上 */
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 4rem 6rem;
  gap: 6rem;
  height: calc(100% - 120px);
  box-sizing: border-box;
  pointer-events: none; /* 让点击事件穿透到下层的播放控制条（如果有重叠） */
}

/* 左侧栏 */
.left-column {
  flex: 0 0 45%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; /* 居中对齐 */
  gap: 2.5rem;
  padding-left: 3rem; /* 向右偏移 */
  pointer-events: auto; /* 恢复子元素交互 */
}

.album-cover-wrapper {
  width: 100%;
  max-width: 380px;
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
  text-align: center;
}

.song-title {
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #ffffff;
  line-height: 1.2;
  letter-spacing: -0.02em;
  white-space: nowrap; /* 防止不必要换行 */
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%; /* 确保不超过容器宽度 */
}

.song-artist {
  font-size: 1.4rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  margin: 0;
  letter-spacing: -0.01em;
}

/* 右侧栏 */
.right-column {
  flex: 1;
  height: 100%;
  pointer-events: auto; /* 恢复子元素交互 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  /* 遮罩层顶部/底部渐隐效果 */
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

/* 播放控制 */
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

/* 音质区域 */
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

/* 过渡动画 */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
  transform: translateY(40px) scale(0.98);
}

/* 移动端滑入动画 */
.slide-up-enter-active {
  transition: transform 0.4s ease-in;
}

.slide-up-leave-active {
  transition: transform 0.6s ease-in;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 1;
}

/* 移动端特定元素 */
.mobile-floating-cover {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
  will-change: transform, width, height, top, left, border-radius, box-shadow;
  /* 确保图片适应 */
}

.mobile-floating-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quality-tag-text {
  display: inline-block;
  vertical-align: middle;
  font-size: 0.4em; /* 相对于 h1 */
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
    top: 50px; /* 大致匹配 endTop 逻辑 */
    left: 0;
    width: 100%;
    padding: 0 24px 0 84px; /* 左内边距: 24px + 48px(封面) + 12px(间隙) */
    pointer-events: none;
    z-index: 50;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: 48px;
  }

  .header-spacer {
    /* 占位符由 padding 处理，但保留它以备 DOM 结构需要，或者移除它 */
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
    position: relative;
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
    user-select: none; /* 禁止选择 */
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent; /* 移除点击高亮 */
  }
  
  .mobile-quality-badge:active {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(0.96);
  }

  /* 音质菜单动画 */
  .badge-quality-menu {
    position: absolute;
    top: 100%; /* 向下弹出 */
    bottom: auto;
    left: 50%;
    transform: translateX(-50%) scale(0.9);
    margin-top: 12px; /* 顶部间距 */
    margin-bottom: 0;
    background: rgba(245, 245, 245, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    padding: 4px;
    min-width: 100px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    border: 1px solid rgba(255, 255, 255, 0.4);
    z-index: 99999; /* 提高层级 */
    display: flex;
    flex-direction: column;
    gap: 2px;
    opacity: 0;
    transform-origin: top center; /* 动画原点设为顶部 */
    animation: menu-pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    max-height: 240px;
    overflow-y: auto;
  }

  @keyframes menu-pop-in {
    0% {
      opacity: 0;
      transform: translateX(-50%) scale(0.9) translateY(-10px);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) scale(1) translateY(0);
    }
  }

  @keyframes menu-pop-up {
    0% {
      opacity: 0;
      transform: translateX(-50%) scale(0.9) translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) scale(1) translateY(0);
    }
  }

  .badge-quality-option {
    width: 100%;
    text-align: center;
    background: transparent;
    color: #333; /* 深色文字 */
    padding: 8px 12px; /* 减小内边距 */
    border-radius: 8px;
    font-size: 0.85rem; /* 稍微减小字体 */
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    font-weight: 500;
    user-select: none; /* 禁止选择 */
    -webkit-user-select: none;
  }

  .badge-quality-option:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .badge-quality-option.active {
    color: #007AFF; /* 蓝色字 */
    background: #ffffff;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .mobile-pagination-dots {
  display: none;
  position: absolute;
  bottom: 150px; /* 根据控制栏高度调整 */
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

/* 响应式 */
/* 1024px 以下为移动端/平板布局 */
@media (max-width: 1024px) {
  /* 移动端分页布局 */
  .main-content {
    flex-direction: row;
    justify-content: flex-start; /* 覆盖桌面端的 center，防止分页错位 */
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
  
  /* 隐藏滚动条 */
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
    justify-content: flex-start; /* 从上部开始，配合 padding 控制位置 */
    align-items: center;
    text-align: center;
    gap: 2.5rem;
    padding: 15vh 2rem 160px; /* 顶部内边距 15vh (与 JS startTop 匹配) */
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
    padding: 100px 1.5rem 180px; /* 增加顶部内边距以适应头部 */
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
    /* 阴影由 JS 中的浮动封面处理 */
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
    /* 过渡效果由 JS 控制 */
  }

  .song-title {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block; /* 覆盖 inline-block */
    max-width: 100%; /* 放宽宽度限制 */
    padding: 0 1rem; /* 增加内边距防止贴边 */
    box-sizing: border-box;
  }
  
  .song-artist {
    font-size: 1.3rem;
  }
  
  .mobile-pagination-dots {
    display: flex;
  }

  .close-button {
    top: 54px; /* 下移以与顶部封面对齐 */
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    width: auto;
    height: auto;
    padding: 8px;
    z-index: 200; /* 确保在最上层，避免被 main-content 遮挡 */
  }

  .playback-controls {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 1rem 1.5rem calc(0.5rem + env(safe-area-inset-bottom));
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
  
  /* 移动端隐藏原音质区域 */
  .quality-section {
    display: none;
  }

  .badge-quality-menu {
    top: auto;
    bottom: 100%;
    margin-top: 0;
    margin-bottom: 12px;
    transform-origin: bottom center;
    animation: menu-pop-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 隐藏左侧栏非必要元素 */
  /* 隐藏右侧栏干扰元素 */
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