<template>
  <Teleport to="body">
    <Transition :name="isMobile ? 'mobile-flow' : 'modal-animation'">
      <div
          v-if="isVisible"
          class="lyrics-modal-overlay"
          tabindex="-1"
          style="--main-cover-color: 255, 255, 255;"
          @click="handleOverlayClick"
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
            :style="{ zIndex: isMobile && showQualitySettings ? 101 : undefined }"
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
                <div class="lyrics-container">
                  <!-- 集成 AMLyric 组件 (传入毫秒) -->
                  <AMLyric v-if="lyricSettings.useAMLyrics.value" :current-time="currentTime" />
                  <!-- 集成 DefaultLyric 组件 (传入秒) -->
                  <DefaultLyric v-else :current-time="currentTime" />
                </div>
              </div>
              
              <!-- 歌词设置工具栏 -->
              <div class="lyric-toolbar">
                 <Popover placement="top-end" :offset="12">
                   <template #trigger>
                     <div class="toolbar-btn" title="歌词设置">
                        <Icon name="settings" size="20" />
                     </div>
                   </template>
                   <template #content>
                     <div class="lyric-settings-content">
                        <div class="setting-item switch">
                           <span class="label">AM 风格歌词</span>
                           <input type="checkbox" v-model="lyricSettings.useAMLyrics.value" />
                        </div>
                        <div class="setting-item">
                           <span class="label">字体大小</span>
                           <div class="control">
                              <button @click="lyricSettings.lyricFontSize.value -= 2">-</button>
                              <span>{{ lyricSettings.lyricFontSize.value }}</span>
                              <button @click="lyricSettings.lyricFontSize.value += 2">+</button>
                           </div>
                        </div>
                        <div class="setting-item">
                           <span class="label">歌词偏移 (ms)</span>
                           <div class="control">
                              <button @click="lyricSettings.lyricOffset.value -= 100">-</button>
                              <span>{{ lyricSettings.lyricOffset.value }}</span>
                              <button @click="lyricSettings.lyricOffset.value += 100">+</button>
                           </div>
                        </div>
                        <div class="setting-item switch" v-if="!lyricSettings.useAMLyrics.value">
                           <span class="label">显示翻译</span>
                           <input type="checkbox" v-model="lyricSettings.showTranslation.value" />
                        </div>
                        <div class="setting-item switch" v-if="!lyricSettings.useAMLyrics.value">
                           <span class="label">显示罗马音</span>
                           <input type="checkbox" v-model="lyricSettings.showRoma.value" />
                        </div>
                        <div class="setting-item switch" v-if="!lyricSettings.useAMLyrics.value">
                           <span class="label">逐字歌词 (YRC)</span>
                           <input type="checkbox" v-model="lyricSettings.showYrc.value" />
                        </div>
                     </div>
                   </template>
                 </Popover>
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
import {computed, nextTick, onUnmounted, ref, watch, onMounted} from 'vue'
import {useAudioPlayer} from '~/composables/useAudioPlayer'
import {useAudioPlayerControl} from '~/composables/useAudioPlayerControl'
import {useLyricSettings} from '~/composables/useLyricSettings'
import {useBackgroundRenderer} from '~/composables/useBackgroundRenderer'
import Icon from '~/components/UI/Icon.vue'
import {useAudioQuality} from '~/composables/useAudioQuality'
import {useAudioPlayerEnhanced} from '~/composables/useAudioPlayerEnhanced'
import {useAudioVisualizer} from '~/composables/useAudioVisualizer'
import {convertToHttps} from '~/utils/url'
import AMLyric from '~/components/Player/PlayerLyric/AMLyric.vue'
import DefaultLyric from '~/components/Player/PlayerLyric/DefaultLyric.vue'
import Popover from '~/components/UI/Common/Popover.vue'

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
const lyricSettings = useLyricSettings()

// 背景渲染器
const backgroundRenderer = useBackgroundRenderer()
const audioVisualizer = useAudioVisualizer()

// 响应式状态
const showQualitySettings = ref(false)
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

// 定时器
const resizeTimer = ref(null)

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
  if (isCurrentQuality(qualityValue)) {
    showQualitySettings.value = false
    return
  }

  const result = await enhanced.enhancedQualitySwitch(currentSong.value, qualityValue)

  if (result.success) {
    saveQuality(currentSong.value.musicPlatform, qualityValue)

    const updatedSong = {
      ...currentSong.value,
      musicUrl: result.url
    }

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
  
  const startSize = 280
  const startTop = h * 0.15
  const realStartLeft = (w - startSize) / 2
  
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

  if (mobileFloatingCoverRef.value) {
      const el = mobileFloatingCoverRef.value
      el.style.width = `${startSize}px`
      el.style.height = `${startSize}px`
      el.style.top = `${startTop}px`
      el.style.left = `${realStartLeft}px`
      el.style.transformOrigin = '0 0'
      el.style.zIndex = '100'
      el.style.borderRadius = '12px'
      el.style.boxShadow = '0 16px 36px rgba(0,0,0,0.4)'
      // 确保硬件加速
      el.style.transform = 'translate3d(0, 0, 0)'
      el.style.willChange = 'transform, border-radius'
  }

  if (isMobile.value) {
     requestAnimationFrame(() => {
        const p = currentScrollProgress || 0
        updateMobileAnimations(p * cachedLayout.contentWidth, cachedLayout.contentWidth)
     })
  }
}

const updateMobileState = () => {
  if (typeof window !== 'undefined') {
    const newIsMobile = window.innerWidth <= 1024
    if (newIsMobile !== isMobile.value) {
      isMobile.value = newIsMobile
      // 调整字体大小
      lyricSettings.adjustFontSizeForDevice()
      if (newIsMobile) {
        nextTick(updateLayoutCache)
      }
    } else if (newIsMobile) {
        updateLayoutCache()
    }
  }
}

let currentScrollProgress = 0

const updateMobileAnimations = (scrollLeft, width) => {
  let p = scrollLeft / width
  if (p < 0) p = 0
  if (p > 1) p = 1
  currentScrollProgress = p
  
  if (mobileFloatingCoverRef.value) {
    const { 
      totalTranslateX, totalTranslateY, 
      targetScale 
    } = cachedLayout

    const currentScale = 1 + (targetScale - 1) * p
    const currentTranslateX = totalTranslateX * p
    const currentTranslateY = totalTranslateY * p

    const el = mobileFloatingCoverRef.value
    
    const targetVisualRadius = 12 - (6 * p) 
    const radius = targetVisualRadius / currentScale
    
    // 使用 transform 和 will-change 优化性能
    el.style.transform = `translate3d(${currentTranslateX}px, ${currentTranslateY}px, 0) scale(${currentScale})`
    el.style.borderRadius = `${radius}px`
    el.style.opacity = '1'
    el.style.pointerEvents = p > 0.8 ? 'none' : 'auto'
  }

  if (pageOneInfoRef.value) {
    const el = pageOneInfoRef.value
    const opacity = Math.max(0, 1 - p * 2.5)
    const translateY = p * -20
    
    // 使用 transform 优化性能
    el.style.opacity = String(opacity)
    el.style.transform = `translate3d(0, ${translateY}px, 0)`
  }

  if (pageTwoInfoRef.value) {
    const el = pageTwoInfoRef.value
    const opacity = Math.max(0, (p - 0.6) * 2.5)
    const translateY = (1 - p) * 10
    
    // 使用 transform 优化性能
    el.style.opacity = String(opacity)
    el.style.transform = `translate3d(0, ${translateY}px, 0)`
    el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none'
  }
}

const onMainContentScroll = (event) => {
  if (!isMobile.value) return
  
  const el = event.target
  const scrollLeft = el.scrollLeft
  if (!cachedLayout.contentWidth) {
    updateLayoutCache()
  }
  const width = cachedLayout.contentWidth || el.clientWidth
  
  const newPage = Math.round(scrollLeft / width)
  if (currentMobilePage.value !== newPage) {
    currentMobilePage.value = newPage
  }
  
  // 使用 requestAnimationFrame 优化性能，避免频繁更新
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

// 播放列表状态
const hasPrevious = computed(() => audioPlayer.hasPrevious.value)
const hasNext = computed(() => audioPlayer.hasNext.value)

const progressPercentage = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// 背景配置
const backgroundConfig = ref({
  type: 'cover',
  dynamic: true,
  blur: 40,
  brightness: 0.6,
  saturation: 1.05,
  flowSpeed: 0.3
})

// 定义窗口大小变化处理函数（防抖优化）
const handleResize = () => {
  if (resizeTimer.value) {
    clearTimeout(resizeTimer.value)
  }
  resizeTimer.value = setTimeout(() => {
    if (typeof window !== 'undefined') {
      windowWidth.value = window.innerWidth
      windowHeight.value = window.innerHeight
    }
    updateMobileState()
  }, 150) // 增加防抖延迟以减少频繁触发
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    updateMobileState()
    // 初始化时调整字体大小
    lyricSettings.adjustFontSizeForDevice()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})

const handleKeydown = (event) => {
  if (!props.isVisible) return

  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closeModal()
      break
    case ' ':
      // 如果焦点在按钮上，忽略此自定义处理，让原生按钮点击生效，防止重复触发
      if (document.activeElement && document.activeElement.tagName.toLowerCase() === 'button') {
          return;
      }
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
  }
}

const togglePlayPause = async () => {
  await audioPlayerControl.togglePlay()
}

const previousSong = () => {
  audioPlayer.playPrevious()
}

const nextSong = () => {
  audioPlayer.playNext()
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
      break
    }
  }
}

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

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleCoverError = (event) => {
  const img = event.target
  img.style.display = 'none'
}

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
  if (showQualitySettings.value) {
    showQualitySettings.value = false
    if (event.target.classList.contains('lyrics-modal-overlay')) {
      closeModal()
    }
    return
  }

  if (event.target.classList.contains('lyrics-modal-overlay')) {
    closeModal()
  }
}

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
    }
  }, 80)
}

const stopProgressTimer = () => {
  if (progressUpdateTimer.value) {
    clearInterval(progressUpdateTimer.value)
    progressUpdateTimer.value = null
  }
}

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

watch(
    () => props.isVisible,
    async (visible) => {
      if (visible) {
        disablePageScroll()

        await nextTick()

        if (backgroundContainer.value) {
          await backgroundRenderer.initializeBackground(backgroundContainer.value)

          if (coverBlurContainer.value && backgroundConfig.value.type === 'cover') {
            backgroundRenderer.setCoverBlurElement(coverBlurContainer.value)
          }

          backgroundRenderer.startRender()
        }

        if (currentSong.value && currentSong.value.cover) {
          backgroundRenderer.setCoverBackground(currentSong.value.cover)
        }

        // 歌词由 LyricManager 自动监听 currentTrack 变化并获取，这里不需要手动 fetch
        // 但如果首次打开且没有歌词，可以触发一次检查（Manager 已有 immediate watch）

        if (isPlaying.value) {
          startProgressTimer()
        }

        document.addEventListener('keydown', handleKeydown)
        window.addEventListener('resize', handleResize)
        window.addEventListener('resize', updateMobileState)
        
        updateMobileState()

        if (isMobile.value) {
          // 重置移动端状态
          currentMobilePage.value = 0
          scrollProgress.value = 0
          currentScrollProgress = 0
          
          // 等待DOM更新后滚动到第一页并重置动画状态
          await nextTick()
          if (mainContent.value) {
            mainContent.value.scrollLeft = 0
          }
          
          // 更新布局缓存并重置动画状态
          updateLayoutCache()
          
          // 强制更新动画到初始状态
          updateMobileAnimations(0, cachedLayout.contentWidth || window.innerWidth)
        }
      } else {
        restorePageScroll()
        stopProgressTimer()
        backgroundRenderer.dispose()
        document.removeEventListener('keydown', handleKeydown)
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('resize', updateMobileState)
        
        // 清理动画帧
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
      }
    }
)

watch(backgroundConfig, async (newConfig) => {
  if (props.isVisible) {
    await backgroundRenderer.updateConfig(newConfig)
  }
}, {deep: true})

watch(currentSong, async (newSong) => {
  if (!props.isVisible || !newSong) return

  if (newSong.cover) {
    backgroundRenderer.setCoverBackground(newSong.cover)
    await backgroundRenderer.setGradientFromCover(newSong.cover)
  }
})

watch(isPlaying, (playing) => {
  if (!props.isVisible) return

  if (playing) {
    startProgressTimer()
  } else {
    stopProgressTimer()
  }
})

const startAnimationLoop = () => {
  const frame = () => {
    if (!props.isVisible) return
    drawSpectrum()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

const drawSpectrum = () => {
  if (!spectrumCanvas.value || !audioVisualizer.isInitialized.value) return
  
  const canvas = spectrumCanvas.value
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  
  const data = audioVisualizer.getFrequencyData()
  if (data.length === 0) return

  ctx.clearRect(0, 0, width, height)
  
  const barCount = 40
  const barHeight = height / barCount / 1.5
  const gap = 4
  const usableHeight = height - (barCount * gap)
  const blockH = usableHeight / barCount
  
  const step = Math.floor(data.length / 2 / barCount) 
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  
  for (let i = 0; i < barCount; i++) {
     const dataIndex = i * step
     const value = data[dataIndex] || 0
     
     const percent = value / 255
     const barW = width * percent * 0.8
     
     const y = height - (i * (blockH + gap)) - 100
     if (y < 0) break
     
     ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + percent * 0.5})`
     
     ctx.beginPath()
     ctx.roundRect(0, y, Math.max(4, barW), blockH, 4)
     ctx.fill()
  }
}

watch(() => props.isVisible, async (visible) => {
  if (visible) {
    if (isMobile.value) {
      history.pushState({ modal: 'lyrics' }, '')
      hasPushedHistory.value = true
      window.addEventListener('popstate', handlePopState)
    }
    
    const audioElements = document.querySelectorAll('audio')
    for (const audio of audioElements) {
        if (audio.src) {
            audioVisualizer.initialize(audio)
            break
        }
    }
    
    startAnimationLoop()
  } else {
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
  
  // 清理动画帧
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  
  // 清理定时器
  if (resizeTimer.value) {
    clearTimeout(resizeTimer.value)
    resizeTimer.value = null
  }
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
  z-index: 50;
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 4rem 6rem;
  gap: 6rem;
  height: calc(100% - 120px);
  box-sizing: border-box;
  pointer-events: none;
}

/* 左侧栏 */
.left-column {
  flex: 0 0 45%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2.5rem;
  padding-left: 3rem;
  pointer-events: auto;
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
  transform: scale(1.02);
}

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
  white-space: normal;
  overflow: visible;
  text-align: center;
  width: 100%;
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
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
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
  flex-shrink: 0;
}

.progress-bar {
  flex: 1;
  min-width: 0;
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

/* 歌词工具栏 */
.lyric-toolbar {
  position: absolute;
  bottom: 2rem;
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lyric-settings-content {
  width: 240px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
}

.setting-item .control {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 2px;
}

.setting-item button {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.setting-item button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.setting-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #fa2d48;
}

/* 音质菜单动画 */
.badge-quality-menu {
  position: absolute;
  bottom: 100%; /* 向上弹出 */
  top: auto;
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  margin-bottom: 12px; /* 底部间距 */
  margin-top: 0;
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
  transform-origin: bottom center; /* 动画原点设为底部 */
  animation: menu-pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  max-height: 240px;
  overflow-y: auto;
}

@keyframes menu-pop-in {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.9) translateY(10px);
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

/* 响应式 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: row;
    justify-content: flex-start;
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
    /* 优化滚动性能 */
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }
  
  .main-content::-webkit-scrollbar {
    display: none;
  }

  .left-column {
    flex: 0 0 100vw;
    flex-shrink: 0;
    width: 100vw;
    height: 100%;
    scroll-snap-align: start;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    gap: 2.5rem;
    padding: 15vh 2rem 160px;
    box-sizing: border-box;
    max-width: none;
    overflow: hidden;
    /* 优化渲染性能 */
    will-change: transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  .right-column {
    flex: 0 0 100vw;
    flex-shrink: 0;
    width: 100vw;
    height: 100%;
    scroll-snap-align: start;
    padding: 100px 1.5rem 180px;
    overflow-y: hidden;
    box-sizing: border-box;
    mask-image: none;
    -webkit-mask-image: none;
    position: relative;
    display: flex;
    flex-direction: column;
    /* 优化渲染性能 */
    will-change: transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  .lyrics-display-area {
    width: 100%;
    height: 100%;
    overflow: hidden; /* 移除 auto，交给 AMLyric 内部滚动 */
    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  }

  .album-cover-wrapper {
    width: 280px;
    height: 280px;
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
    /* 优化动画性能 */
    will-change: opacity, transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  .song-title {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
    max-width: 100%;
    padding: 0 1rem;
    box-sizing: border-box;
    white-space: normal;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
  }
  
  .song-artist {
    font-size: 1.3rem;
  }
  
  .mobile-pagination-dots {
    display: flex;
  }

  .close-button {
    top: 54px;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    width: auto;
    height: auto;
    padding: 8px;
    z-index: 200;
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
    z-index: 60;
  }

  .progress-section {
    gap: 0.8rem;
  }

  .control-buttons {
    justify-content: space-between;
    width: 100%;
    padding: 0 1rem;
  }
  
  .badge-quality-menu {
    top: auto;
    bottom: 100%;
    margin-top: 0;
    margin-bottom: 12px;
    transform-origin: bottom center;
    animation: menu-pop-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .lyric-toolbar {
    bottom: 180px;
    right: 1.5rem;
  }
  
  .mobile-lyric-header {
    position: absolute;
    top: 50px;
    left: 0;
    width: 100%;
    padding: 0 70px 0 84px;
    pointer-events: none;
    z-index: 50;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: 48px;
    /* 优化动画性能 */
    will-change: opacity, transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  .mini-song-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    overflow: hidden;
    /* 优化渲染 */
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
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

/* 移动端更有层次感的 flow 动画 */
.mobile-flow-enter-active,
.mobile-flow-leave-active {
  transition:
    opacity 0.5s cubic-bezier(0.2, 0, 0.2, 1),
    transform 0.5s cubic-bezier(0.2, 0, 0.2, 1),
    filter 0.5s cubic-bezier(0.2, 0, 0.2, 1);
}

.mobile-flow-enter-from,
.mobile-flow-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(30px);
  filter: blur(10px);
}

.mobile-floating-cover {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
  will-change: transform, border-radius;
  /* 启用硬件加速 */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  perspective: 1000px;
  -webkit-perspective: 1000px;
}

.mobile-floating-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 优化图片渲染 */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}
</style>
