<template>
  <div>
    <Transition name="overlay-animation">
      <div v-show="visible && !isMobile" class="player-overlay" />
    </Transition>

    <Transition name="player-animation">
      <div
        v-show="visible"
        class="music-widget"
        :class="{ 'mobile-player-bar': isMobile }"
        @click="handlePlayerClick"
      >
        <!-- 移动端顶部进度条 -->
        <div
          v-if="isMobile"
          class="mobile-top-progress"
          @click.stop="handleSeekToPosition"
          @touchstart.stop="handleStartTouchDrag"
        >
          <div :style="{ width: `${control.progress.value}%` }" class="progress-fill" />
        </div>

        <!-- 标题区域 -->
        <div class="title">
          <!-- 封面 -->
          <div
            class="cover-container"
            @click.stop="
              isMobile
                ? activeSong?.musicPlatform === 'bilibili'
                  ? openBilibiliVideo()
                  : toggleLyrics()
                : null
            "
          >
            <template v-if="activeSong && activeSong.cover && !coverError">
              <img
                :src="convertToHttps(activeSong.cover)"
                alt="封面"
                class="player-cover"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              >
            </template>
            <div v-else class="text-cover">
              {{ getFirstChar(activeSong?.title || '') }}
            </div>
          </div>

          <!-- 歌曲信息 -->
          <div class="song-info">
            <p class="song-title">{{ activeSong?.title || '未知歌曲' }}</p>
            <p class="song-artist">{{ activeSong?.artist || '未知艺术家' }}</p>
          </div>

          <!-- 移动端播放控制 -->
          <div v-if="isMobile" class="mobile-controls">
            <button class="mobile-control-btn" @click.stop="handleTogglePlay">
              <div v-if="control.isLoadingTrack.value" class="loading-spinner-small" />
              <Icon
                v-else
                :name="control.isPlaying.value ? 'pause' : 'play'"
                :size="24"
                color="white"
              />
            </button>
            <button class="mobile-control-btn" @click.stop="stopPlaying">
              <Icon name="close" :size="20" color="rgba(255,255,255,0.6)" />
            </button>
          </div>

          <!-- PC端右上角关闭按钮 -->
          <div v-if="!isMobile" class="close-button" title="关闭播放器" @click="stopPlaying">
            <span class="music-icon">×</span>
          </div>
        </div>

        <!-- 媒体控制区域 (PC端显示) -->
        <div v-if="!isMobile" class="media-controls">
          <!-- 进度条区域 -->
          <div class="time">
            <!-- 进度条 -->
            <div
              ref="progressBar"
              class="progress-bar"
              @click="handleSeekToPosition"
              @mousedown="handleStartDrag"
              @touchstart="handleStartTouchDrag"
            >
              <div :style="{ width: `${control.progress.value}%` }" class="progress-fill" />
            </div>

            <!-- 时间和音质显示 -->
            <div class="time-details-and-audio-q">
              <span class="current-time">{{ formatTime(control.currentTime.value) }}</span>
              <div class="audio-quality" title="音质设置" @click="toggleQualitySettings">
                <span>{{ currentQualityText }}</span>
              </div>
              <span
                :title="timeDisplayMode === 'remaining' ? '点击显示总时长' : '点击显示剩余时长'"
                class="remaining-time clickable-time"
                @click="toggleTimeDisplayMode"
              >
                {{ rightTimeText }}
              </span>
            </div>
          </div>

          <!-- 控制按钮区域 -->
          <div class="controls-frame">
            <!-- 左侧歌词按钮 -->
            <span
              v-if="activeSong?.musicPlatform === 'bilibili'"
              class="lyrics-btn music-icon"
              title="观看视频"
              @click="openBilibiliVideo"
            >
              <Icon name="video" size="20" />
            </span>
            <span v-else class="lyrics-btn music-icon" title="歌词" @click="toggleLyrics">
              <Icon name="music" size="20" />
            </span>

            <!-- 中央播放控制 -->
            <div class="center-controls">
              <!-- 上一首 -->
              <span
                :class="{ disabled: !sync.globalAudioPlayer.hasPrevious.value }"
                class="control-btn music-icon"
                title="上一首"
                @click="handlePrevious"
              >
                <Icon name="skip-back" size="20" />
              </span>

              <!-- 播放/暂停 -->
              <span
                :class="{ disabled: control.hasError.value || control.isLoadingTrack.value }"
                class="play-pause-btn music-icon"
                title="播放/暂停"
                @click="handleTogglePlay"
              >
                <div v-if="control.isLoadingTrack.value" class="loading-spinner" />
                <Icon v-else-if="control.isPlaying.value" name="pause" size="24" />
                <Icon v-else name="play" size="24" />
              </span>

              <!-- 下一首 -->
              <span
                :class="{ disabled: !sync.globalAudioPlayer.hasNext.value }"
                class="control-btn music-icon"
                title="下一首"
                @click="handleNext"
              >
                <Icon name="skip-forward" size="20" />
              </span>
            </div>

            <!-- 右侧占位 -->
            <div class="right-placeholder" />
          </div>
        </div>

        <!-- 音质选择下拉菜单 -->
        <Transition name="quality-dropdown">
          <div v-if="showQualitySettings" class="quality-dropdown">
            <div
              v-for="option in currentPlatformOptions"
              :key="option.value"
              :class="{ active: isCurrentQuality(option.value) }"
              class="quality-option"
              @click="selectQuality(option.value)"
            >
              <span class="sf-pro">{{ option.label }}</span>
            </div>
          </div>
        </Transition>

        <!-- 歌词显示区域 -->
        <Transition name="lyrics-slide">
          <div v-if="showLyrics" class="lyrics-panel">
            <AppleMusicLyrics
              :allow-seek="true"
              :current-lyric-index="control.lyrics.currentLyricIndex.value"
              :current-lyrics="control.lyrics.currentLyrics.value"
              :current-time="control.currentTime.value"
              :error="control.lyrics.error.value"
              :font-size="24"
              :is-loading="control.lyrics.isLoading.value"
              :line-height="1.4"
              :show-translation="false"
              :translation-lyrics="control.lyrics.translationLyrics.value"
              :word-by-word-lyrics="control.lyrics.wordByWordLyrics.value"
              active-line-color="#ffffff"
              height="120px"
              inactive-line-color="rgba(255, 255, 255, 0.6)"
              @seek="handleLyricSeek"
            />
          </div>
        </Transition>

        <!-- 音频元素 -->
        <AudioElement
          ref="audioElementRef"
          :song="song"
          @canplay="handleCanPlay"
          @ended="handleEnded"
          @error="handleError"
          @loadedmetadata="handleLoaded"
          @loadstart="handleLoadStart"
          @pause="handlePause"
          @play="handlePlay"
          @timeupdate="handleTimeUpdate"
        />
      </div>
    </Transition>

    <!-- 全屏歌词模态（仅客户端渲染） -->
    <ClientOnly>
      <LyricsModal :is-visible="showFullscreenLyrics" @close="showFullscreenLyrics = false" />
    </ClientOnly>

    <!-- 哔哩哔哩 iframe 预览模态 -->
    <ClientOnly>
      <BilibiliIframeModal
        :show="showBilibiliIframe"
        :bvid="activeSong?.musicId?.split(':')[0]"
        :page="activeSong?.musicId?.split(':')[2] ? parseInt(activeSong.musicId.split(':')[2]) : 1"
        @close="showBilibiliIframe = false"
      />
    </ClientOnly>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppleMusicLyrics from './AppleMusicLyrics.vue'
import LyricsModal from './LyricsModal.vue'
import AudioElement from './AudioPlayer/AudioElement.vue'
import BilibiliIframeModal from './BilibiliIframeModal.vue'
import Icon from './Icon.vue'
import { useAudioPlayerControl } from '~/composables/useAudioPlayerControl'
import { useAudioPlayerSync } from '~/composables/useAudioPlayerSync'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { useAudioPlayerEnhanced } from '~/composables/useAudioPlayerEnhanced'
import { useMediaSession } from '~/composables/useMediaSession'
import { getBilibiliUrl } from '~/utils/url'

// 添加 router 导入
const router = useRouter()

const props = defineProps({
  song: {
    type: Object,
    default: null
  },
  playlist: {
    type: Array,
    default: () => []
  },
  isPlaylistMode: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'ended', 'error', 'songChange'])

// 使用 composables
const control = useAudioPlayerControl()
const sync = useAudioPlayerSync()
const { getQualityLabel, getQuality, getQualityOptions, saveQuality } = useAudioQuality()
const enhanced = useAudioPlayerEnhanced()
const mediaSession = useMediaSession()

// 组件引用
const audioElementRef = ref(null)
const playerControlsRef = ref(null)

// UI 状态
const isClosing = ref(false)
const isClosed = ref(false)
const showLyrics = ref(false)
const showFullscreenLyrics = ref(false)
const showQualitySettings = ref(false)
const coverError = ref(false)
const useAppleMusicStyle = ref(true) // 默认使用Apple Music风格
const showBilibiliIframe = ref(false) // 显示哔哩哔哩 iframe 预览

// 时长显示模式：'remaining' 显示剩余时长，'total' 显示总时长
const timeDisplayMode = ref('remaining')

// 同步标记，避免双向触发
const isSyncingFromGlobal = ref(false)
const isMounted = ref(false)

// 获取音频播放器引用
const audioPlayer = computed(() => audioElementRef.value?.audioPlayer)
const progressBar = computed(() => playerControlsRef.value?.progressBar)

// 记录最近一首歌曲，避免关闭过程中props.song为空导致渲染错误
const lastSong = ref(null)
watch(
  () => props.song,
  (newSong, oldSong) => {
    if (newSong) {
      // 检测是否为音质切换（同一首歌但URL不同）
      if (oldSong && newSong.id === oldSong.id && newSong.musicUrl !== oldSong.musicUrl) {
        // 保存当前播放状态和进度
        const wasPlaying = control.isPlaying.value
        const currentTime = control.currentTime.value

        // 在音频加载完成后恢复状态
        nextTick(() => {
          if (audioPlayer.value) {
            const restoreState = () => {
              audioPlayer.value.currentTime = currentTime
              if (wasPlaying) {
                control.play()
              }
            }
            // 监听元数据加载完成事件（此时duration已知，可以seek）
            audioPlayer.value.addEventListener('loadedmetadata', restoreState, { once: true })
          }
        })
      }

      lastSong.value = newSong
      // 新歌到来时视为重新打开，清除关闭标记
      isClosed.value = false
    }
  }
)

// 渲染用的安全歌曲对象：优先使用当前歌曲，其次使用最后一首
const activeSong = computed(() => props.song ?? lastSong.value)

// 控制可见性：父级仍传入歌曲且未处于关闭或已关闭状态
const visible = computed(() => !!props.song && !isClosing.value && !isClosed.value)

// 音频事件处理器
const handleTimeUpdate = () => {
  if (!audioPlayer.value || isSyncingFromGlobal.value) return

  const currentTime = audioPlayer.value.currentTime
  const duration = audioPlayer.value.duration

  control.onTimeUpdate(currentTime)

  // 更新 Media Session 位置状态
  if (mediaSession.isSupported.value && duration > 0) {
    mediaSession.updatePosition(currentTime, duration, control.isPlaying.value ? 1 : 0)
  }

  // 只在播放状态下发送进度更新，避免暂停时发送位置为0的更新
  // 不传递song参数，避免覆盖已设置的元数据
  if (control.isPlaying.value) {
    sync.throttledProgressUpdate(currentTime, duration, control.isPlaying.value)
  }
}

const handlePlay = () => {
  if (isSyncingFromGlobal.value) return

  control.onPlay()
  sync.syncPlayStateToGlobal(true, props.song)

  // 更新 Media Session 播放状态
  if (mediaSession.isSupported.value) {
    mediaSession.updatePlaybackState(true)
  }

  // 直接调用鸿蒙侧播放状态更新，不传递歌曲信息避免覆盖元数据
  if (
    typeof window !== 'undefined' &&
    window.voiceHubPlayer &&
    window.voiceHubPlayer.onPlayStateChanged
  ) {
    window.voiceHubPlayer.onPlayStateChanged(true, {
      position: control.currentTime.value,
      duration: control.duration.value
    })
  }

  sync.sendWebSocketUpdate({
    songId: props.song?.id,
    isPlaying: true,
    position: control.currentTime.value,
    duration: control.duration.value,
    volume: 1,
    playlistIndex: sync.globalAudioPlayer.getCurrentPlaylistIndex().value
  })
}

const handlePause = () => {
  if (isSyncingFromGlobal.value) return

  control.onPause()
  sync.syncPlayStateToGlobal(false, props.song)

  // 更新 Media Session 播放状态
  if (mediaSession.isSupported.value) {
    mediaSession.updatePlaybackState(false)
  }

  // 直接调用鸿蒙侧播放状态更新，不传递歌曲信息避免覆盖元数据
  if (
    typeof window !== 'undefined' &&
    window.voiceHubPlayer &&
    window.voiceHubPlayer.onPlayStateChanged
  ) {
    window.voiceHubPlayer.onPlayStateChanged(false, {
      position: control.currentTime.value,
      duration: control.duration.value
    })
  }

  sync.sendWebSocketUpdate({
    songId: props.song?.id,
    isPlaying: false,
    position: control.currentTime.value,
    duration: control.duration.value,
    volume: 1,
    playlistIndex: sync.globalAudioPlayer.getCurrentPlaylistIndex().value
  })
}

const handleLoaded = async () => {
  if (!audioPlayer.value) return

  control.onLoaded(audioPlayer.value.duration)

  // 更新 Media Session 元数据
  if (mediaSession.isSupported.value && props.song) {
    mediaSession.updateSong({
      id: props.song.id,
      title: props.song.title || '未知歌曲',
      artist: props.song.artist || '未知艺术家',
      cover: props.song.cover || null,
      musicUrl: props.song.musicUrl || null
    })
  }

  // 先传递基本的歌曲元数据给鸿蒙侧（不包含歌词）
  sync.notifyHarmonyOS(
    'metadata',
    {
      title: props.song?.title || '',
      artist: props.song?.artist || '',
      album: props.song?.album || '',
      artwork: props.song?.cover || '',
      duration: audioPlayer.value.duration
    },
    props.song
  )

  // 如果歌曲有平台信息，主动获取并等待歌词加载完成后单独传递歌词
  if (props.song?.musicPlatform && props.song?.musicId) {
    // 主动触发歌词获取
    await control.lyrics.fetchLyrics(props.song.musicPlatform, props.song.musicId)

    // 等待歌词数据实际加载完成，最多等待8秒
    const maxWaitTime = 8000
    const startTime = Date.now()

    // 等待歌词加载状态变化：从未开始 -> 加载中 -> 完成/失败
    while (Date.now() - startTime < maxWaitTime) {
      // 检查是否有歌词数据
      if (control.lyrics.currentLyrics.value.length > 0) {
        break
      }

      // 检查是否加载失败（不在加载中且有错误）
      if (!control.lyrics.isLoading.value && control.lyrics.error.value) {
        break
      }

      // 检查是否加载完成但无歌词（不在加载中且无错误且无歌词）
      if (
        !control.lyrics.isLoading.value &&
        !control.lyrics.error.value &&
        control.lyrics.currentLyrics.value.length === 0
      ) {
        break
      }

      // 等待100ms后再次检查
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 检查歌词是否加载成功
    const harmonyLyrics = control.lyrics.getFormattedLyricsForHarmonyOS()
    const hasValidLyrics =
      harmonyLyrics &&
      harmonyLyrics !== '[00:00.00]暂无歌词' &&
      control.lyrics.currentLyrics.value.length > 0

    if (hasValidLyrics) {
      // 使用专门的歌词更新方法
      control.lyrics.notifyHarmonyOSLyricsUpdate(harmonyLyrics)
    } else {
      // 清空歌词
      control.lyrics.notifyHarmonyOSLyricsUpdate('')
    }
  }

  // 延迟同步播放列表状态
  setTimeout(() => {
    sync.notifyPlaylistState()
  }, 100)
}

const handleError = async (error) => {
  // 如果是哔哩哔哩视频播放失败，提供 iframe 预览选项
  if (props.song?.musicPlatform === 'bilibili') {
    // 手动设置错误状态，替代 control.onError(error) 以避免通用提示
    control.hasError.value = true
    control.isPlaying.value = false

    // 同步全局播放状态，确保全局状态与本地状态一致
    sync.syncPlayStateToGlobal(false, props.song)

    if (window.$showNotification) {
      window.$showNotification(
        isMobile.value
          ? '哔哩哔哩视频播放失败，点击封面以预览'
          : '哔哩哔哩视频播放失败，点击视频图标以预览',
        'warning'
      )
    }

    // 不自动关闭播放器，让用户可以点击视频图标
    // 但要停止加载状态
    control.isLoadingTrack.value = false
    return
  }

  control.onError(error)

  // 使用增强的错误处理逻辑
  const result = await enhanced.handlePlaybackError(
    error,
    props.song,
    (newSong) => emit('songChange', newSong),
    handleNext,
    () => emit('close'),
    props.isPlaylistMode
  )

  if (result.handled) {
    if (result.shouldRetry) {
      // 重试当前歌曲
      setTimeout(() => {
        if (audioPlayer.value) {
          audioPlayer.value.load()
          control.play()
        }
      }, 500)
    } else if (result.newSong) {
      // 已经切换到新歌曲，不需要额外处理
      console.log('已切换到新歌曲或新音质')
    } else if (result.shouldClose) {
      // 已经关闭播放器，不需要额外处理
      console.log('播放器已关闭')
      // 同步关闭全屏歌词模态
      showFullscreenLyrics.value = false
    }
  } else {
    // 如果增强处理失败，使用原始错误处理
    emit('error', error)
  }
}

const handleEnded = () => {
  control.onEnded()
  // 歌曲播放完成时关闭全屏歌词模态
  showFullscreenLyrics.value = false
  emit('ended')
}

const handleLoadStart = () => {
  control.onLoadStart()
}

const handleCanPlay = () => {
  control.onCanPlay()
}

// UI 事件处理器
const handleTogglePlay = async () => {
  if (!ensureAudioPlayerRef()) {
    console.error('[AudioPlayer] 音频播放器引用验证失败，无法切换播放状态')
    return
  }

  await control.togglePlay()
}

const handlePrevious = async () => {
  const result = await sync.playPrevious(props.song)
  if (result.success && result.newSong) {
    emit('songChange', result.newSong)
  }
}

const handleNext = async () => {
  const result = await sync.playNext(props.song)
  if (result.success && result.newSong) {
    emit('songChange', result.newSong)
  }
}

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 确保音频播放器引用的辅助函数
const ensureAudioPlayerRef = () => {
  // 首先检查计算属性是否有值
  if (!audioPlayer.value) {
    console.warn('[AudioPlayer] 音频播放器引用不存在，尝试重新获取...')
    return false
  }

  // 确保 control 有正确的音频播放器引用
  if (!control.audioPlayer.value || control.audioPlayer.value !== audioPlayer.value) {
    control.setAudioPlayerRef(audioPlayer.value)
  }

  // 双重验证：确保引用确实可用
  if (!control.audioPlayer.value) {
    console.error('[AudioPlayer] 无法设置音频播放器引用到 control')
    return false
  }

  return true
}

// 进度条拖拽事件处理器
const handleStartDrag = (event) => {
  if (!ensureAudioPlayerRef()) {
    console.error('[AudioPlayer] 音频播放器引用验证失败，无法开始拖拽')
    return
  }

  // 获取进度条元素引用
  const progressBarElement = event.currentTarget
  if (!progressBarElement) {
    console.error('[AudioPlayer] 无法获取进度条元素引用')
    return
  }

  control.startDrag(event, progressBarElement)
}

const handleStartTouchDrag = (event) => {
  if (!ensureAudioPlayerRef()) {
    console.error('[AudioPlayer] 音频播放器引用验证失败，无法开始触摸拖拽')
    return
  }

  // 获取进度条元素引用
  const progressBarElement = event.currentTarget
  if (!progressBarElement) {
    console.error('[AudioPlayer] 无法获取进度条元素引用')
    return
  }

  // 阻止默认行为，防止页面滚动
  event.preventDefault()
  event.stopPropagation()

  control.startTouchDrag(event, progressBarElement)
}

const handleSeekToPosition = (event) => {
  if (!ensureAudioPlayerRef()) {
    console.error('[AudioPlayer] 音频播放器引用验证失败，无法跳转位置')
    return
  }

  control.seekToPosition(event)
}

// 获取当前歌曲平台的音质文本
const currentQualityText = computed(() => {
  if (!props.song || !props.song.musicPlatform) return '音质'

  const platform = props.song.musicPlatform
  const quality = getQuality(platform)
  const label = getQualityLabel(platform, quality)

  // 简化显示文本
  return label.replace(/音质|音乐/, '').trim() || '音质'
})

// 获取当前平台的音质选项
const currentPlatformOptions = computed(() => {
  if (!props.song || !props.song.musicPlatform) return []
  return getQualityOptions(props.song.musicPlatform)
})

// 检查是否是当前音质
const isCurrentQuality = (qualityValue) => {
  if (!props.song || !props.song.musicPlatform) return false
  return getQuality(props.song.musicPlatform) === qualityValue
}

// 切换时长显示模式
const toggleTimeDisplayMode = () => {
  timeDisplayMode.value = timeDisplayMode.value === 'remaining' ? 'total' : 'remaining'
}

// 计算右侧时间显示文本
const rightTimeText = computed(() => {
  if (timeDisplayMode.value === 'total') {
    return formatTime(control.duration.value)
  } else {
    return `-${formatTime(control.duration.value - control.currentTime.value)}`
  }
})

// 切换音质设置显示
const toggleQualitySettings = () => {
  showQualitySettings.value = !showQualitySettings.value
}

// 关闭音质设置
const closeQualitySettings = () => {
  showQualitySettings.value = false
}

// 处理点击外部区域关闭音质设置
const handleClickOutside = (event) => {
  if (!showQualitySettings.value) return

  // 检查点击是否在音质设置区域内
  const qualityDropdown = document.querySelector('.quality-dropdown')
  const qualityButton = document.querySelector('.audio-quality')

  if (qualityDropdown && qualityButton) {
    const isClickInsideDropdown = qualityDropdown.contains(event.target)
    const isClickOnButton = qualityButton.contains(event.target)

    if (!isClickInsideDropdown && !isClickOnButton) {
      closeQualitySettings()
    }
  }
}

// 选择音质
const selectQuality = async (qualityValue) => {
  if (!props.song || !props.song.musicPlatform) return

  // 如果选择的是当前音质，直接返回
  if (isCurrentQuality(qualityValue)) {
    return
  }

  // 使用增强的音质切换功能
  const result = await enhanced.enhancedQualitySwitch(props.song, qualityValue)

  if (result.success) {
    // 只有在切换成功后才保存音质设置
    saveQuality(props.song.musicPlatform, qualityValue)

    // 更新歌曲的音乐链接
    const updatedSong = {
      ...props.song,
      musicUrl: result.url
    }

    // 通知父组件更新歌曲
    emit('songChange', updatedSong)

    // 重新加载音频
    if (audioPlayer.value) {
      const wasPlaying = control.isPlaying.value
      const currentTime = control.currentTime.value

      audioPlayer.value.load()

      // 如果之前在播放，加载完成后继续播放
      if (wasPlaying) {
        audioPlayer.value.addEventListener(
          'canplay',
          () => {
            audioPlayer.value.currentTime = currentTime
            control.play()
          },
          { once: true }
        )
      }
    }

    // 同步状态到全局
    sync.syncPlayStateToGlobal(control.isPlaying.value, updatedSong)

    // 直接调用鸿蒙侧播放状态更新
    if (
      typeof window !== 'undefined' &&
      window.voiceHubPlayer &&
      window.voiceHubPlayer.onPlayStateChanged
    ) {
      window.voiceHubPlayer.onPlayStateChanged(control.isPlaying.value, {
        position: control.currentTime.value,
        duration: control.duration.value
      })
    }
  }
  // 如果失败，增强的composable已经显示了错误通知，不保存音质设置
}

// 歌词相关方法
const toggleLyrics = () => {
  // 显示全屏歌词模态而不是跳转页面
  showFullscreenLyrics.value = true
}

const openBilibiliVideo = () => {
  const song = activeSong.value
  if (!song) return

  // 如果播放器有错误，显示 iframe 预览
  if (control.hasError.value) {
    showBilibiliIframe.value = true
    return
  }

  // 否则在新窗口打开
  const url = getBilibiliUrl(song)
  if (url && url !== '#') {
    window.open(url, '_blank')
  }
}

const handleLyricSeek = async (time) => {
  // 如果当前处于暂停状态，先开始播放
  if (!control.isPlaying.value) {
    await control.play()
  }

  // 跳转到指定时间 - seek 方法内部会处理歌词动画的中断
  control.seek(time)
  sync.updateGlobalPosition(time, control.duration.value)
}

// 停止播放并关闭播放器
const stopPlaying = () => {
  if (isClosing.value) return

  // 立即停止音频播放和同步状态，确保用户点击关闭时音乐立即停止
  control.stop()
  sync.syncStopToGlobal()

  // 设置关闭状态
  isClosing.value = true

  // 同步关闭全屏歌词模态和音质设置
  showFullscreenLyrics.value = false
  showQualitySettings.value = false

  // 等待关闭动画完成后再触发 close 事件
  setTimeout(() => {
    // 标记已关闭，防止父级延迟隐藏期间闪回
    isClosed.value = true
    emit('close')
    isClosing.value = false
  }, 500) // 匹配 leave-active 动画时长
}

// 监听器和生命周期钩子
watch(
  () => props.song,
  async (newSong, oldSong) => {
    if (!newSong) return

    // 重置封面错误状态
    coverError.value = false

    // 避免双向触发
    if (isSyncingFromGlobal.value) return

    // 确保组件已经挂载
    if (!isMounted.value) return

    // 如果是新歌曲，加载并播放
    if (!oldSong || newSong.id !== oldSong.id) {
      const loadSuccess = await control.loadSong(newSong)
      if (loadSuccess) {
        sync.setGlobalPlaylist(newSong, props.playlist)
        await control.play()
      }
    }
  },
  { immediate: false }
)

// 监听全局播放状态变化，避免双向触发
watch(
  () => sync.globalAudioPlayer.getPlayingStatus().value,
  (newPlayingStatus) => {
    if (isSyncingFromGlobal.value) return

    isSyncingFromGlobal.value = true

    if (!newPlayingStatus && control.isPlaying.value) {
      control.pause()
    } else if (newPlayingStatus && !control.isPlaying.value) {
      const currentGlobalSong = sync.globalAudioPlayer.getCurrentSong().value
      if (currentGlobalSong && props.song && currentGlobalSong.id === props.song.id) {
        control.play()
      }
    }

    nextTick(() => {
      isSyncingFromGlobal.value = false
    })
  },
  { immediate: true }
)

// 监听全局歌曲变化
watch(
  () => sync.globalAudioPlayer.getCurrentSong().value,
  (newGlobalSong) => {
    if (newGlobalSong && (!props.song || newGlobalSong.id !== props.song.id)) {
      emit('songChange', newGlobalSong)
    }
  },
  { immediate: false }
)

// 监听播放列表状态变化
watch(
  [
    () => sync.globalAudioPlayer.hasNext.value,
    () => sync.globalAudioPlayer.hasPrevious.value,
    () => sync.globalAudioPlayer.getCurrentPlaylistIndex().value,
    () => sync.globalAudioPlayer.getCurrentPlaylist().value
  ],
  () => {
    sync.notifyPlaylistState()
  },
  { immediate: true }
)

const isMobile = ref(false)

// 检查是否为移动端
const checkMobile = () => {
  if (import.meta.client) {
    isMobile.value = window.innerWidth <= 768
  }
}

// 移动端点击播放条处理
const handlePlayerClick = () => {
  if (isMobile.value) {
    if (activeSong.value?.musicPlatform === 'bilibili') {
      openBilibiliVideo()
    } else {
      toggleLyrics()
    }
  }
}

onMounted(async () => {
  // 处理热重载清理
  enhanced.handleHotReload()

  // 设置挂载标记
  isMounted.value = true

  // 移动端检查
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // 等待子组件挂载完成
  await nextTick()

  // 增强的音频播放器引用获取逻辑
  let retryCount = 0
  const maxRetries = 15 // 增加重试次数
  const retryDelay = 50 // 减少重试间隔，提高响应速度

  while (!audioPlayer.value && retryCount < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay))
    retryCount++

    // 强制触发响应式更新
    await nextTick()
  }

  if (!audioPlayer.value) {
    // 设置一个延迟重试机制，以防组件稍后才完全初始化
    setTimeout(async () => {
      if (audioPlayer.value && !control.audioPlayer.value) {
        control.setAudioPlayerRef(audioPlayer.value)
        control.setProgressBarRef(progressBar.value)
      }
    }, 1000)

    return
  }

  // 设置音频播放器和进度条引用
  control.setAudioPlayerRef(audioPlayer.value)
  control.setProgressBarRef(progressBar.value)

  // 验证引用是否正确设置
  if (!control.audioPlayer.value) {
    return
  }

  // 初始化 WebSocket 连接
  sync.initializeWebSocket()

  // 重置重试状态
  enhanced.resetRetryState()

  // 处理初始歌曲的播放
  if (props.song) {
    const loadSuccess = await control.loadSong(props.song)
    if (loadSuccess) {
      sync.setGlobalPlaylist(props.song, props.playlist)

      // 传递加载状态到鸿蒙侧
      sync.notifyHarmonyOS(
        'load',
        {
          position: 0,
          duration: control.duration.value
        },
        props.song
      )

      // loadSong方法已经包含了自动播放逻辑，这里不需要重复调用
      // 如果自动播放失败，设置用户交互监听器
      if (!control.isPlaying.value) {
        // 通知鸿蒙侧播放失败（暂停状态）
        sync.notifyHarmonyOS(
          'pause',
          {
            position: 0,
            duration: control.duration.value
          },
          props.song
        )

        // 监听用户交互，一旦用户交互就尝试播放
        const handleUserInteraction = async () => {
          if (!control.isPlaying.value && props.song) {
            const retryPlaySuccess = await control.play()
            if (retryPlaySuccess) {
              // 移除事件监听器
              document.removeEventListener('click', handleUserInteraction)
              document.removeEventListener('touchstart', handleUserInteraction)
              document.removeEventListener('keydown', handleUserInteraction)
            }
          }
        }

        document.addEventListener('click', handleUserInteraction, { once: true })
        document.addEventListener('touchstart', handleUserInteraction, { once: true })
        document.addEventListener('keydown', handleUserInteraction, { once: true })
      }
    }
  }

  // 初始化鸿蒙系统控制事件
  sync.initializeHarmonyOSControls({
    onPlay: () => {
      isSyncingFromGlobal.value = true
      control.play()
      nextTick(() => {
        isSyncingFromGlobal.value = false
      })
    },
    onPause: () => {
      isSyncingFromGlobal.value = true
      control.pause()
      nextTick(() => {
        isSyncingFromGlobal.value = false
      })
    },
    onStop: () => {
      isSyncingFromGlobal.value = true
      control.stop()
      sync.syncStopToGlobal()

      // 通知鸿蒙侧清理元数据
      if (sync.isHarmonyOS()) {
        sync.notifyHarmonyOS(
          'metadata',
          {},
          {
            title: '',
            artist: '',
            album: '',
            cover: '',
            duration: 0,
            position: 0
          },
          ''
        )
      }

      nextTick(() => {
        isSyncingFromGlobal.value = false
      })
    },
    onNext: handleNext,
    onPrevious: handlePrevious,
    onSeek: (time) => {
      control.seek(time)
      sync.updateGlobalPosition(time, control.duration.value)
    },
    onPositionUpdate: (time) => {
      // 使用强制更新位置方法，确保UI同步
      control.forceUpdatePosition(time)
      sync.updateGlobalPosition(time, control.duration.value)
    }
  })

  // 初始化 Media Session API (SMTC支持)
  if (mediaSession.isSupported.value) {
    mediaSession.initialize(props.song, {
      onPlay: async () => {
        await control.play()
      },
      onPause: () => {
        control.pause()
      },
      onStop: () => {
        control.stop()
        sync.syncStopToGlobal()
      },
      onPreviousTrack: () => {
        handlePrevious()
      },
      onNextTrack: () => {
        handleNext()
      },
      onSeekTo: (details) => {
        if (details.seekTime !== undefined) {
          control.seek(details.seekTime)
          sync.updateGlobalPosition(details.seekTime, control.duration.value)
        }
      },
      onSeekBackward: (details) => {
        const seekOffset = details.seekOffset || 10 // 默认后退10秒
        const newTime = Math.max(0, control.currentTime.value - seekOffset)
        control.seek(newTime)
        sync.updateGlobalPosition(newTime, control.duration.value)
      },
      onSeekForward: (details) => {
        const seekOffset = details.seekOffset || 10 // 默认前进10秒
        const newTime = Math.min(control.duration.value, control.currentTime.value + seekOffset)
        control.seek(newTime)
        sync.updateGlobalPosition(newTime, control.duration.value)
      }
    })
  }

  // 暴露播放器实例到全局（鸿蒙环境）
  if (sync.isHarmonyOS()) {
    window.voiceHubPlayerInstance = {
      play: () => control.play(),
      pause: () => control.pause(),
      stop: () => control.stop(),
      seek: (time) => control.seek(time),
      getCurrentTime: () => control.currentTime.value,
      getDuration: () => control.duration.value,
      isPlaying: () => control.isPlaying.value
    }
  }

  // 添加点击外部区域关闭音质设置的事件监听器
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  // 清理音频播放器
  control.cleanup()

  // 清理 Media Session
  if (mediaSession.isSupported.value) {
    mediaSession.cleanup()
  }

  // 清理鸿蒙系统控制事件
  sync.cleanupHarmonyOSControls()

  // 清理全局实例
  if (sync.isHarmonyOS() && window.voiceHubPlayerInstance) {
    delete window.voiceHubPlayerInstance
  }

  // 重置重试状态
  enhanced.resetRetryState()

  // 移除点击外部区域的事件监听器
  document.removeEventListener('click', handleClickOutside)
})

// 格式化时间
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 转换为 HTTPS
const convertToHttps = (url) => {
  if (!url) return ''
  return url.replace(/^http:/, 'https:')
}

// 处理图片错误
const handleImageError = () => {
  coverError.value = true
}

// 获取首字符
const getFirstChar = (text) => {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}
</script>

<style scoped>
/* 导入 SF Pro 字体 - 使用官方 CDN */
@import url('https://cdn.jsdelivr.net/npm/sf-font@1.0.0/stylesheet.min.css');

/* 全局字体平滑优化 */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 呼吸光效动画 */
@keyframes breathing-glow {
  0%,
  100% {
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 12px 48px rgba(0, 0, 0, 0.4),
      0 6px 24px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      inset 0 -1px 0 rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(255, 255, 255, 0.15),
      0 0 40px rgba(255, 255, 255, 0.08);
  }
}

/* 微妙的光晕脉动 */
@keyframes subtle-pulse {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

/* IOS Liquid Glass UI 风格 */
.player-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20vh;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.3));
  z-index: 999;
  backdrop-filter: blur(1px);
  pointer-events: none;
}

/* 背景遮罩动画 */
.overlay-animation-enter-active {
  transition: opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.overlay-animation-leave-active {
  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.6, 1);
}

.overlay-animation-enter-from,
.overlay-animation-leave-to {
  opacity: 0;
}

/* 播放器进入/退出动画（基于 Transition 类） */
.player-animation-enter-active,
.player-animation-leave-active {
  transition:
    transform 0.5s cubic-bezier(0.4, 0, 0.6, 1),
    opacity 0.5s cubic-bezier(0.4, 0, 0.6, 1);
  will-change: transform, opacity;
  transform-origin: center bottom;
}

.player-animation-enter-from {
  transform: translateX(-50%) translateY(100%) scale(0.98);
  opacity: 0;
}

.player-animation-enter-to {
  transform: translateX(-50%) translateY(0) scale(1);
  opacity: 1;
}

.player-animation-leave-from {
  transform: translateX(-50%) translateY(0) scale(1);
  opacity: 1;
}

.player-animation-leave-to {
  transform: translateX(-50%) translateY(100%) scale(0.98);
  opacity: 0;
}

/* 移动端播放器样式 */
.music-widget.mobile-player-bar {
  bottom: calc(
    92px + env(safe-area-inset-bottom, 0px)
  ); /* 放在悬浮 tab 上方 (16px bottom + 64px height + 12px gap) */
  left: 10px;
  right: 10px;
  width: calc(100% - 20px);
  height: 64px;
  transform: none;
  border-radius: 16px;
  padding: 0 12px;
  flex-direction: row;
  align-items: center;
  background: rgba(20, 20, 25, 0.85);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: none;
  overflow: hidden;
}

.music-widget.mobile-player-bar:hover {
  transform: none;
}

/* 移动端顶部进度条 */
.mobile-top-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  z-index: 10;
}

.mobile-top-progress .progress-fill {
  height: 100%;
  background: #0b5afe;
  box-shadow: 0 0 8px rgba(11, 90, 254, 0.6);
  border-radius: 0 1px 1px 0;
}

.music-widget.mobile-player-bar .title {
  width: 100%;
  margin-left: 0;
  column-gap: 12px;
}

.music-widget.mobile-player-bar .cover-container {
  width: 44px;
  height: 44px;
  aspect-ratio: 1;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.music-widget.mobile-player-bar .song-info {
  flex: 1;
  min-width: 0;
}

.music-widget.mobile-player-bar .song-title {
  font-size: 15px;
  font-weight: 600;
  margin-top: 2px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-widget.mobile-player-bar .song-artist {
  font-size: 12px;
  opacity: 0.6;
}

.mobile-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-control-btn {
  background: none;
  border: none;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.mobile-control-btn:active {
  transform: scale(0.9);
  opacity: 0.7;
}

/* 移动端动画适配 */
.player-animation-enter-from.mobile-player-bar,
.player-animation-leave-to.mobile-player-bar {
  transform: translateY(100px) scale(0.95);
  opacity: 0;
}

.loading-spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 时间区域 */
.time {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: flex-start;
  align-self: stretch;
  row-gap: 10px;
  width: 376px;
}

/* 进度条样式 */
.progress-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  border-radius: 7px;
  background: rgba(74, 74, 74, 0.39);
  height: 7px;
  width: 100%;
  max-width: 376px;
  align-self: stretch;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  backdrop-filter: blur(30px) saturate(1.5) brightness(1.2);
  -webkit-backdrop-filter: blur(30px) saturate(1.5) brightness(1.2);
}

.progress-fill {
  background: rgba(255, 255, 255, 0.7);
  height: 100%;
  transition: width 0.1s linear;
  border-radius: 6px;
  position: relative;
}

/* MusicWidget 主容器 - 增强 Liquid Glass 效果 + 呼吸光效 */
.music-widget {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05)),
    rgba(128, 128, 128, 0.25);
  padding: 10px 7px 10px 13px;
  width: 400px;
  height: 165px;
  backdrop-filter: blur(60px) saturate(2) brightness(1.1);
  -webkit-backdrop-filter: blur(60px) saturate(2) brightness(1.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.2),
    0 4px 12px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  z-index: 1000;
  will-change: transform, opacity;
  font-family:
    'SF Pro Display', 'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial,
    Helvetica, sans-serif;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  animation: breathing-glow 4s ease-in-out infinite;
}

.music-widget:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    0 12px 32px rgba(0, 0, 0, 0.25),
    0 6px 16px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 0 40px rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
}

/* 标题区域 */
.title {
  display: flex;
  align-items: center;
  column-gap: 12px;
  margin-left: 4px;
  width: 376px;
}

/* 封面容器 */
.cover-container {
  width: 42px;
  height: 42px;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.text-cover {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  font-family:
    'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial, Helvetica,
    sans-serif;
}

/* 歌曲信息文本 */
.song-info {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  align-items: flex-start;
  justify-content: center;
  row-gap: 2px;
  min-width: 0;
}

.song-title {
  display: -webkit-box;
  flex-shrink: 0;
  align-self: stretch;
  overflow: hidden;
  line-height: 22px;
  padding-bottom: 2px;
  letter-spacing: -0.4px;
  color: #ffffff;
  font-family:
    'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial, Helvetica,
    sans-serif;
  font-size: 20px;
  font-weight: 600;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.song-artist {
  display: -webkit-box;
  flex-shrink: 0;
  align-self: stretch;
  overflow: hidden;
  line-height: 20px;
  letter-spacing: -0.4px;
  color: #ffffff75;
  font-family:
    'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial, Helvetica,
    sans-serif;
  font-size: 15px;
  font-weight: 300;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 关闭按钮 */
.close-button {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 100px;
  background: #00000042;
  padding: 6px;
  width: 32px;
  height: 32px;
  backdrop-filter: blur(34px);
  -webkit-backdrop-filter: blur(34px);
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.6);
  transform: scale(1.05);
}

.close-icon {
  color: #ffffff;
  font-size: 15px;
  line-height: 1;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 媒体控制区域 */
.media-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
  justify-content: center;
  margin-right: 4px;
  row-gap: 8px;
  flex: 1;
  margin-top: 16px;
}

/* 进度条和时间区域 */
.progress-section {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: flex-start;
  align-self: stretch;
  row-gap: 10px;
}

/* 进度条 */
.ios-progress-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  border: 1px solid #1a1a1a;
  border-radius: 7px;
  height: 8px;
  width: 100%;
  overflow: hidden;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.ios-progress-bar:hover {
  border-color: #333;
  box-shadow:
    0 0 20px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.progress-fill {
  background: linear-gradient(90deg, #ffffffb2, #ffffff);
  height: 8px;
  transition: width 0.1s linear;
  border-radius: 7px;
  position: absolute;
  left: 0;
  top: 0;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

/* 时间和音质显示 */
.time-quality-display {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  justify-content: space-between;
}

.current-time,
.remaining-time {
  flex-shrink: 0;
  width: 60px;
  line-height: 18px;
  letter-spacing: 0.42px;
  color: rgba(255, 255, 255, 0.7);
  font-family:
    'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial, Helvetica,
    sans-serif;
  font-size: 12px;
  font-weight: 600;
}

.remaining-time {
  text-align: right;
}

/* 可点击时间样式 */
.clickable-time {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.clickable-time:hover {
  color: #ffffff;
  transform: scale(1.05);
}

.clickable-time:active {
  transform: scale(0.95);
}

.audio-quality-badge {
  flex-shrink: 0;
  align-self: stretch;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff1a;
  border-radius: 4px;
  padding: 0 8px;
  color: #ffffffb3;
  font-size: 10px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.audio-quality-badge:hover {
  background: #ffffff26;
  color: #ffffff;
}

/* 控制按钮区域 */
.control-buttons {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  justify-content: space-between;
  min-width: 376px;
}

/* 控制按钮 - 增强光效交互 */
.ios-control-btn {
  background: none;
  border: none;
  color: #ffffff92;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  width: 44px;
  border-radius: 50%;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  font-family:
    'SF Pro Display', 'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial,
    Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.ios-control-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.ios-control-btn:hover {
  color: #ffffff;
  transform: scale(1.1);
  box-shadow:
    0 0 20px rgba(255, 255, 255, 0.2),
    0 0 40px rgba(255, 255, 255, 0.1);
}

.ios-control-btn:hover::before {
  opacity: 1;
}

.ios-control-btn:active {
  transform: scale(0.95);
  box-shadow:
    0 0 15px rgba(255, 255, 255, 0.3),
    inset 0 0 10px rgba(255, 255, 255, 0.1);
}

.ios-control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ios-control-btn:disabled:hover {
  transform: none;
}

/* 左右控制按钮 */
.side-control {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 中央播放控制 */
.center-controls {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  column-gap: 43px;
}

/* 播放控制按钮统一样式 */
.play-pause-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 右侧操作区域 */
.right-actions {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 歌词面板样式 */
.lyrics-panel {
  margin-top: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 0.5rem;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* 歌词滑动动画 */
.lyrics-slide-enter-active,
.lyrics-slide-leave-active {
  transition: all 0.3s ease;
  transform-origin: top;
}

.lyrics-slide-enter-from,
.lyrics-slide-leave-to {
  opacity: 0;
  transform: scaleY(0);
  max-height: 0;
}

.lyrics-slide-enter-to,
.lyrics-slide-leave-from {
  opacity: 1;
  transform: scaleY(1);
  max-height: 120px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .music-widget {
    width: 95%;
    max-width: 400px;
    margin: 0 auto;
  }

  .title {
    width: calc(100% - 8px);
  }

  .time {
    width: calc(100% - 8px);
  }

  .control-buttons {
    min-width: auto;
    width: calc(100% - 8px);
  }

  .controls-frame {
    min-width: auto;
    width: calc(100% - 8px);
  }
}

@media (max-width: 480px) {
  .music-widget {
    width: calc(100% - 2rem);
    padding: 8px 6px 8px 10px;
  }

  .time {
    width: calc(100% - 4px);
  }

  .song-title {
    font-size: 18px;
  }

  .song-artist {
    font-size: 14px;
  }

  .center-controls {
    column-gap: 30px;
  }
}

/* 加载和错误状态 */
.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 内部元素淡入动画 */
.title-section {
  animation: fade-slide-in 0.6s ease-out 0.1s both;
}

.media-controls {
  animation: fade-slide-in 0.6s ease-out 0.2s both;
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 时间和音质显示区域 */
.time-details-and-audio-q {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  justify-content: space-between;
  position: relative;
}

.current-time,
.remaining-time {
  flex-shrink: 0;
  width: 60px;
  line-height: 18px;
  letter-spacing: 0.42px;
  color: #ffffffb3;
  font-family:
    'SF Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, Arial, Helvetica,
    sans-serif;
  font-size: 12px;
  font-weight: 600;
}

.remaining-time {
  text-align: right;
}

.audio-quality {
  flex-shrink: 0;
  align-self: stretch;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff1a;
  border-radius: 4px;
  padding: 0 8px;
  color: #ffffffb3;
  font-size: 10px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.audio-quality:hover {
  background: #ffffff26;
  color: #ffffff;
}

.audio-quality:active {
  transform: scale(0.95);
}

/* 控制按钮框架 */
.controls-frame {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  justify-content: space-between;
  min-width: 329px;
}

/* 歌词按钮 */
.lyrics-btn {
  width: 39px;
  font-size: 25px;
  text-align: center;
  color: #ffffff92;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lyrics-btn:hover {
  color: #ffffff;
  transform: scale(1.1);
}

/* 控制按钮 */
.control-btn {
  line-height: 29px;
  font-size: 24px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  transform: scale(1.1);
}

.control-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.control-btn.disabled:hover {
  transform: none;
}

/* 播放暂停按钮 */
.play-pause-btn {
  line-height: 44px;
  font-size: 37px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.play-pause-btn:hover:not(.disabled) {
  transform: scale(1.1);
}

.play-pause-btn:active:not(.disabled) {
  transform: scale(0.95);
}

.play-pause-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.play-pause-btn.disabled:hover {
  transform: none;
}

/* 右侧占位 */
.right-placeholder {
  width: 39px;
  height: 29px;
}

/* 音质下拉菜单 - 增强光效 */
.quality-dropdown {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15)),
    rgba(128, 128, 128, 0.85);
  border-radius: 12px;
  padding: 8px 0;
  backdrop-filter: blur(60px) saturate(2) brightness(1.1);
  -webkit-backdrop-filter: blur(60px) saturate(2) brightness(1.1);
  border: 1px solid rgba(255, 255, 255, 0.4);
  z-index: 9999;
  min-width: 120px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    0 12px 32px rgba(0, 0, 0, 0.3),
    0 6px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 0 30px rgba(255, 255, 255, 0.1);
}

.quality-option {
  padding: 8px 16px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  margin: 2px 6px;
  position: relative;
  border: 1px solid transparent;
  background: transparent;
}

.quality-option::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.quality-option:hover {
  color: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 4px 16px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.quality-option:hover::before {
  opacity: 1;
}

.quality-option.active {
  color: #007aff;
  background:
    linear-gradient(135deg, rgba(0, 122, 255, 0.25), rgba(0, 122, 255, 0.15)),
    rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.6);
  font-weight: 600;
  transform: translateY(-2px);
  box-shadow:
    0 6px 20px rgba(0, 122, 255, 0.4),
    0 2px 8px rgba(0, 122, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 0 0 1px rgba(0, 122, 255, 0.2);
}

/* 音质下拉动画 - 向上弹出优化 */
.quality-dropdown-enter-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.6, 1);
}

.quality-dropdown-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.6, 1);
}

.quality-dropdown-enter-from,
.quality-dropdown-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.9);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
}

.quality-dropdown-enter-to,
.quality-dropdown-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
}

/* 毛玻璃效果增强 */
@supports (backdrop-filter: blur(50px)) {
  .global-audio-player {
    background: rgba(128, 128, 128, 0.25);
  }
}

@supports not (backdrop-filter: blur(50px)) {
  .global-audio-player {
    background: rgba(128, 128, 128, 0.8);
  }
}
</style>
