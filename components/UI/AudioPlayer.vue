<template>
  <div>
    <Transition name="overlay-animation">
      <div v-if="song" class="player-overlay" @click="stopPlaying"></div>
    </Transition>

    <Transition name="player-animation">
      <div v-if="song" class="global-audio-player">
        <!-- 播放器信息 -->
        <PlayerInfo :song="song"/>

        <!-- 播放器控制 -->
        <PlayerControls
            ref="playerControlsRef"
            :current-time="control.currentTime.value"
            :duration="control.duration.value"
            :has-error="control.hasError.value"
            :has-next="sync.globalAudioPlayer.hasNext.value"
            :has-previous="sync.globalAudioPlayer.hasPrevious.value"
            :is-dragging="control.isDragging.value"
            :is-loading="control.isLoadingNewSong.value"
            :is-playing="control.isPlaying.value"
            :progress="control.progress.value"
            @next="handleNext"
            @previous="handlePrevious"
            @toggle-play="handleTogglePlay"
            @start-drag="control.startDrag"
            @start-touch-drag="control.startTouchDrag"
            @seek-to-position="control.seekToPosition"
        />

        <!-- 播放器操作 -->
        <PlayerActions
            :current-platform-options="currentPlatformOptions"
            :current-quality-text="currentQualityText"
            :is-current-quality="isCurrentQuality"
            :show-lyrics="showLyrics"
            :song="song"
            @close="stopPlaying"
            @toggle-lyrics="toggleLyrics"
            @select-quality="selectQuality"
        />

        <!-- 歌词显示区域 -->
        <Transition name="lyrics-slide">
          <div v-if="showLyrics" class="lyrics-panel">
            <LyricsDisplay
                :allow-seek="true"
                :compact="true"
                :current-lyric-index="control.lyrics.currentLyricIndex.value"
                :current-lyrics="control.lyrics.currentLyrics.value"
                :current-time="control.currentTime.value"
                :error="control.lyrics.error.value"
                :is-loading="control.lyrics.isLoading.value"
                :show-controls="false"
                :translation-lyrics="control.lyrics.translationLyrics.value"
                :word-by-word-lyrics="control.lyrics.wordByWordLyrics.value"
                height="120px"
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
  </div>
</template>

<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import LyricsDisplay from './LyricsDisplay.vue'
import PlayerInfo from './AudioPlayer/PlayerInfo.vue'
import PlayerControls from './AudioPlayer/PlayerControls.vue'
import PlayerActions from './AudioPlayer/PlayerActions.vue'
import AudioElement from './AudioPlayer/AudioElement.vue'
import {useAudioPlayerControl} from '~/composables/useAudioPlayerControl'
import {useAudioPlayerSync} from '~/composables/useAudioPlayerSync'
import {useAudioQuality} from '~/composables/useAudioQuality'
import {useAudioPlayerEnhanced} from '~/composables/useAudioPlayerEnhanced'

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
const {getQualityLabel, getQuality, getQualityOptions, saveQuality} = useAudioQuality()
const enhanced = useAudioPlayerEnhanced()

// 组件引用
const audioElementRef = ref(null)
const playerControlsRef = ref(null)

// UI 状态
const isClosing = ref(false)
const showLyrics = ref(false)

// 同步标记，避免双向触发
const isSyncingFromGlobal = ref(false)
const isMounted = ref(false)

// 获取音频播放器引用
const audioPlayer = computed(() => audioElementRef.value?.audioPlayer)
const progressBar = computed(() => playerControlsRef.value?.progressBar)

// 音频事件处理器
const handleTimeUpdate = () => {
  if (!audioPlayer.value || isSyncingFromGlobal.value) return

  const currentTime = audioPlayer.value.currentTime
  const duration = audioPlayer.value.duration

  // 修复参数传递问题：onTimeUpdate只接受一个参数
  control.onTimeUpdate(currentTime)

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

  // 直接调用鸿蒙侧播放状态更新，不传递歌曲信息避免覆盖元数据
  if (typeof window !== 'undefined' && window.voiceHubPlayer && window.voiceHubPlayer.onPlayStateChanged) {
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

  // 直接调用鸿蒙侧播放状态更新，不传递歌曲信息避免覆盖元数据
  if (typeof window !== 'undefined' && window.voiceHubPlayer && window.voiceHubPlayer.onPlayStateChanged) {
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

  // 先传递基本的歌曲元数据给鸿蒙侧（不包含歌词）
  sync.notifyHarmonyOS('metadata', {
    title: props.song?.title || '',
    artist: props.song?.artist || '',
    album: props.song?.album || '',
    artwork: props.song?.cover || '',
    duration: audioPlayer.value.duration
  }, props.song)

  // 如果歌曲有平台信息，主动获取并等待歌词加载完成后单独传递歌词
  if (props.song?.musicPlatform && props.song?.musicId) {
    // 主动触发歌词获取
    await control.lyrics.fetchLyrics(props.song.musicPlatform, props.song.musicId)

    // 等待歌词数据实际加载完成，最多等待8秒
    const maxWaitTime = 8000
    const startTime = Date.now()

    // 等待歌词加载状态变化：从未开始 -> 加载中 -> 完成/失败
    while ((Date.now() - startTime) < maxWaitTime) {
      // 检查是否有歌词数据
      if (control.lyrics.currentLyrics.value.length > 0) {
        break
      }

      // 检查是否加载失败（不在加载中且有错误）
      if (!control.lyrics.isLoading.value && control.lyrics.error.value) {
        break
      }

      // 检查是否加载完成但无歌词（不在加载中且无错误且无歌词）
      if (!control.lyrics.isLoading.value && !control.lyrics.error.value && control.lyrics.currentLyrics.value.length === 0) {
        break
      }

      // 等待100ms后再次检查
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 检查歌词是否加载成功
    const harmonyLyrics = control.lyrics.getFormattedLyricsForHarmonyOS()
    const hasValidLyrics = harmonyLyrics && harmonyLyrics !== '[00:00.00]暂无歌词' && control.lyrics.currentLyrics.value.length > 0

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
    }
  } else {
    // 如果增强处理失败，使用原始错误处理
    emit('error', error)
  }
}

const handleEnded = () => {
  control.onEnded()
  emit('ended')
}

const handleLoadStart = () => {
  control.onLoadStart()
}

const handleCanPlay = () => {
  control.onCanPlay()
}

// UI 事件处理器
const handleTogglePlay = () => {
  control.togglePlay()
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

// 切换音质设置显示
const toggleQualitySettings = () => {
  showQualitySettings.value = !showQualitySettings.value
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
        audioPlayer.value.addEventListener('canplay', () => {
          audioPlayer.value.currentTime = currentTime
          control.play()
        }, {once: true})
      }
    }

    // 同步状态到全局
    sync.syncPlayStateToGlobal(control.isPlaying.value, updatedSong)

    // 直接调用鸿蒙侧播放状态更新
    if (typeof window !== 'undefined' && window.voiceHubPlayer && window.voiceHubPlayer.onPlayStateChanged) {
      window.voiceHubPlayer.onPlayStateChanged(control.isPlaying.value, {
        position: control.currentTime.value,
        duration: control.duration.value
      })
    }
  }
  // 如果失败，增强的composable已经显示了错误通知
}

// 歌词相关方法
const toggleLyrics = () => {
  showLyrics.value = !showLyrics.value
}

const handleLyricSeek = (time) => {
  control.seek(time)
  sync.updateGlobalPosition(time, control.duration.value)
}

// 停止播放并关闭播放器
const stopPlaying = () => {
  if (isClosing.value) return

  isClosing.value = true
  control.stop()
  sync.syncStopToGlobal()

  setTimeout(() => {
    emit('close')
  }, 300)
}

// 监听器和生命周期钩子
watch(() => props.song, async (newSong, oldSong) => {
  if (!newSong) return

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
}, {immediate: false})

// 监听全局播放状态变化，避免双向触发
watch(() => sync.globalAudioPlayer.getPlayingStatus().value, (newPlayingStatus) => {
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
}, {immediate: true})

// 监听全局歌曲变化
watch(() => sync.globalAudioPlayer.getCurrentSong().value, (newGlobalSong) => {
  if (newGlobalSong && (!props.song || newGlobalSong.id !== props.song.id)) {
    emit('songChange', newGlobalSong)
  }
}, {immediate: false})

// 监听播放列表状态变化
watch([
  () => sync.globalAudioPlayer.hasNext.value,
  () => sync.globalAudioPlayer.hasPrevious.value,
  () => sync.globalAudioPlayer.getCurrentPlaylistIndex().value,
  () => sync.globalAudioPlayer.getCurrentPlaylist().value
], () => {
  sync.notifyPlaylistState()
}, {immediate: true})

onMounted(async () => {
  // 处理热重载清理
  enhanced.handleHotReload()

  // 设置挂载标记
  isMounted.value = true

  // 等待子组件挂载完成
  await nextTick()

  // 确保音频播放器引用已正确获取
  let retryCount = 0
  const maxRetries = 10

  while (!audioPlayer.value && retryCount < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100))
    retryCount++
  }

  if (!audioPlayer.value) {
    console.error('[AudioPlayer] ❌ 无法获取音频播放器引用，自动播放将失败')
    return
  }

  // 设置音频播放器和进度条引用
  control.setAudioPlayerRef(audioPlayer.value)
  control.setProgressBarRef(progressBar.value)

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
      sync.notifyHarmonyOS('load', {
        position: 0,
        duration: control.duration.value
      }, props.song)

      // 尝试播放，如果失败（由于浏览器自动播放策略），等待用户交互
      const playSuccess = await control.play()

      if (!playSuccess) {
        // 通知鸿蒙侧播放失败（暂停状态）
        sync.notifyHarmonyOS('pause', {
          position: 0,
          duration: control.duration.value
        }, props.song)

        // 监听用户交互，一旦用户交互就尝试播放
        const handleUserInteraction = async () => {
          if (!control.hasUserInteracted.value && props.song) {
            const retryPlaySuccess = await control.play()
            if (retryPlaySuccess) {
              // 移除事件监听器
              document.removeEventListener('click', handleUserInteraction)
              document.removeEventListener('touchstart', handleUserInteraction)
              document.removeEventListener('keydown', handleUserInteraction)
            }
          }
        }

        document.addEventListener('click', handleUserInteraction, {once: true})
        document.addEventListener('touchstart', handleUserInteraction, {once: true})
        document.addEventListener('keydown', handleUserInteraction, {once: true})
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
        sync.notifyHarmonyOS('metadata', {}, {
          title: '',
          artist: '',
          album: '',
          cover: '',
          duration: 0,
          position: 0
        }, '')
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
})

onUnmounted(() => {
  // 清理音频播放器
  control.cleanup()

  // 清理鸿蒙系统控制事件
  sync.cleanupHarmonyOSControls()

  // 清理全局实例
  if (sync.isHarmonyOS() && window.voiceHubPlayerInstance) {
    delete window.voiceHubPlayerInstance
  }

  // 重置重试状态
  enhanced.resetRetryState()
})


// 格式化时间
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}


</script>

<style scoped>
/* 背景遮罩层 */
.player-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20vh; /* 只覆盖底部区域 */
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5));
  z-index: 999;
  backdrop-filter: blur(1px);
  pointer-events: none; /* 允许点击穿透 */
}

/* 背景遮罩动画 */
.overlay-animation-enter-active {
  transition: opacity 0.4s ease;
}

.overlay-animation-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-animation-enter-from,
.overlay-animation-leave-to {
  opacity: 0;
}

/* 播放器动画效果 - 增强版 */
.player-animation-enter-active {
  animation: slide-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); /* 使用弹性曲线 */
  transform-origin: center bottom;
}

.player-animation-leave-active {
  animation: slide-down 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

@keyframes slide-up {
  0% {
    transform: translate(-50%, 100%);
    opacity: 0;
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  50% {
    transform: translate(-50%, -5%); /* 轻微过冲效果 */
    opacity: 0.9;
  }
  100% {
    transform: translate(-50%, 0);
    opacity: 1;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }
}

@keyframes slide-down {
  0% {
    transform: translate(-50%, 0);
    opacity: 1;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }
  100% {
    transform: translate(-50%, 120%);
    opacity: 0;
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
}

/* 添加内部元素的动画 */
.player-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  animation: fade-in 0.6s ease-out 0.1s both; /* 延迟0.1s后开始 */
}

.player-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  animation: fade-in 0.6s ease-out 0.2s both; /* 延迟0.2s后开始 */
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 全局播放器的模糊效果 */
.global-audio-player {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 800px;
  background: rgba(0, 10, 20, 0.95);
  border-radius: 15px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  backdrop-filter: blur(1px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  will-change: transform, opacity; /* 优化动画性能 */
}

.player-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cover-container {
  width: 60px;
  height: 60px;
  position: relative;
  flex-shrink: 0;
}

.player-cover {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
}

.text-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0043F8 0%, #0075F8 100%);
  color: #FFFFFF;
  font-size: 28px;
  font-weight: bold;
  font-family: 'MiSans', sans-serif;
  border-radius: 6px;
}

.player-text {
  flex: 1;
  min-width: 0;
}

.player-text h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-text p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-container {
  width: 100%;
}

.control-with-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.progress-container-wrapper {
  flex: 1;
  position: relative;
}

.progress-click-area {
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  bottom: -8px;
  cursor: pointer;
  z-index: 10;
}

.progress-click-area:hover + .progress-container {
  height: 6px;
  margin-top: -1px;
}

.control-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(11, 90, 254, 0.8);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-pause-btn {
  width: 40px;
  height: 40px;
  margin: 0 8px;
}

.control-btn:hover {
  transform: scale(1.1);
  background: rgba(11, 90, 254, 1);
  box-shadow: 0 0 15px rgba(11, 90, 254, 0.5);
}

.control-btn:active {
  transform: scale(0.95);
}

/* 添加波纹效果 */
.control-btn::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 70%);
  opacity: 0;
  transform: scale(0);
  border-radius: 50%;
}

.control-btn:active::after {
  animation: ripple 0.6s ease-out;
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* 播放/暂停图标动画 */
.control-btn:hover .play-icon {
  transform: scale(1.2);
}

.control-btn:hover .pause-icon {
  transform: scale(1.2);
}

/* 增强进度条效果 */
.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  overflow: visible;
  transition: height 0.2s ease;
  touch-action: none; /* 防止触摸时的默认行为 */
}

/* 增加触摸区域但不影响视觉 */
.progress-bar::before {
  content: '';
  position: absolute;
  top: -10px;
  bottom: -10px;
  left: 0;
  right: 0;
  z-index: 1;
}

.progress-bar:hover {
  height: 8px;
}

.progress-bar:hover .progress-thumb {
  opacity: 1;
  transform: scale(1);
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #0043F8 0%, #0075F8 100%);
  border-radius: 3px;
  transition: width 0.1s linear;
  position: relative;
}

/* 进度条拖拽按钮 */
.progress-thumb {
  position: absolute;
  top: 50%;
  right: -6px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-radius: 50%;
  transform: translateY(-50%) scale(0);
  opacity: 0;
  transition: all 0.2s ease;
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.progress-thumb.dragging {
  cursor: grabbing;
  transform: translateY(-50%) scale(1.2);
  opacity: 1;
}

/* 进度条光晕效果 */
.progress::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 5px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  box-shadow: 0 0 10px 3px rgba(255, 255, 255, 0.5);
  opacity: 0.3;
}


.time-display {
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-top: 4px;
}

.control-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(11, 90, 254, 0.8);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.control-btn:hover {
  transform: scale(1.1);
}

.play-icon {
  margin-left: 2px;
  transition: transform 0.3s ease;
}

.pause-icon {
  font-size: 12px;
  transition: transform 0.3s ease;
}

/* 播放器操作按钮区域 */
.player-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.5rem;
  z-index: 10;
}

.quality-selector {
  position: relative;
  display: flex;
  flex-direction: column;
}

.quality-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border-radius: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  animation: fade-rotate-in 0.4s ease 0.1s both;
  min-width: 80px;
  justify-content: space-between;
}

.quality-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.quality-selector.expanded .quality-btn {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.quality-icon {
  font-size: 0.9rem;
}

.quality-text {
  font-size: 0.75rem;
  font-weight: 500;
  flex: 1;
  text-align: center;
}

.quality-arrow {
  font-size: 0.6rem;
  transition: transform 0.3s ease;
}

.quality-arrow.rotated {
  transform: rotate(180deg);
}

.quality-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  z-index: 1000;
  margin-bottom: 0.25rem;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.quality-option {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s ease;
}

.quality-option:hover {
  background: rgba(255, 255, 255, 0.15);
}

.quality-option.active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.option-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.quality-option.active .option-label {
  color: #fff;
  font-weight: 600;
}

/* 下拉框动画 */
.quality-dropdown-enter-active,
.quality-dropdown-leave-active {
  transition: all 0.2s ease;
  transform-origin: bottom;
}

.quality-dropdown-enter-from,
.quality-dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.8) translateY(10px);
}

.quality-dropdown-enter-to,
.quality-dropdown-leave-from {
  opacity: 1;
  transform: scaleY(1) translateY(0);
}

/* 修复关闭按钮动画 */
.close-player {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 20px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: all 0.3s ease;
  animation: fade-rotate-in 0.4s ease 0.2s both; /* 添加进入动画 */
}

.close-player:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

/* 关闭按钮动画 */
@keyframes fade-rotate-in {
  from {
    opacity: 0;
    transform: rotate(-45deg) scale(0.5);
  }
  to {
    opacity: 1;
    transform: rotate(0) scale(1);
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .global-audio-player {
    width: 95%;
    padding: 0.75rem;
    bottom: 1.5rem;
  }

  .player-text h4 {
    font-size: 14px;
  }

  .player-text p {
    font-size: 12px;
  }

  .cover-container {
    width: 45px;
    height: 45px;
  }


  .player-animation-enter-active {
    animation-duration: 0.4s; /* 移动设备上稍微加快动画速度 */
  }

  .player-animation-leave-active {
    animation-duration: 0.3s;
  }

  .progress-thumb {
    width: 16px;
    height: 16px;
    right: -8px;
    opacity: 1; /* 移动端始终显示 */
    transform: translateY(-50%) scale(1);
  }

  .progress-bar {
    height: 6px; /* 保持原有高度 */
  }

  /* 移动端更大的触摸区域 */
  .progress-bar::before {
    top: -15px;
    bottom: -15px;
  }

  .progress-bar:hover .progress-thumb {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
}

/* 歌词面板样式 */
.lyrics-panel {
  margin-top: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 0.5rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
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

/* 操作按钮样式 */
.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.8);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: scale(1.1);
}

.action-btn.active {
  background: rgba(59, 130, 246, 0.25);
  color: #fff;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.35);
  transform: scale(1.06);
  animation: pulse 1.8s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.35);
  }
  50% {
    box-shadow: 0 0 18px rgba(59, 130, 246, 0.55);
  }
  100% {
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.35);
  }
}
</style>