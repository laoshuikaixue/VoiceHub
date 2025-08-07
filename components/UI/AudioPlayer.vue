<template>
  <div>
    <Transition name="overlay-animation">
      <div v-if="song" class="player-overlay" @click="stopPlaying"></div>
    </Transition>

    <Transition name="player-animation">
      <div v-if="song" class="global-audio-player">
        <div class="player-info">
          <div class="cover-container">
            <template v-if="song.cover && !coverError">
              <img :src="convertToHttps(song.cover)" alt="封面" class="player-cover" @error="handleImageError" />
            </template>
            <div v-else class="text-cover">
              {{ getFirstChar(song.title || '') }}
            </div>
          </div>
          <div class="player-text">
            <h4>{{ song.title }}</h4>
            <p>{{ song.artist }}</p>
          </div>
        </div>

        <div class="player-controls">
          <div class="progress-container">
            <div class="control-with-progress">
              <button class="control-btn" @click="togglePlay">
                <Icon v-if="isPlaying" name="pause" :size="18" color="white" />
                <Icon v-else name="play" :size="18" color="white" />
              </button>

              <div
                class="progress-bar"
                @mousedown="startDrag"
                @touchstart="startTouchDrag"
                @click="seekToPosition"
                ref="progressBar"
              >
                <div class="progress" :style="{ width: `${progress}%` }">
                  <div class="progress-thumb" :class="{ 'dragging': isDragging }"></div>
                </div>
              </div>


            </div>

            <div class="time-display">
              <span class="current-time">{{ formatTime(currentTime) }}</span>
              <span class="duration">{{ formatTime(duration) }}</span>
            </div>
          </div>
        </div>

        <div class="player-actions">
          <div class="quality-selector" :class="{ 'expanded': showQualitySettings }">
            <button class="quality-btn" @click="toggleQualitySettings" title="音质设置">
              <span class="quality-icon">♪</span>
              <span class="quality-text">{{ currentQualityText }}</span>
              <span class="quality-arrow" :class="{ 'rotated': showQualitySettings }">▼</span>
            </button>

            <Transition name="quality-dropdown">
              <div v-if="showQualitySettings && currentPlatformOptions.length > 0" class="quality-dropdown">
                <div
                  v-for="option in currentPlatformOptions"
                  :key="option.value"
                  class="quality-option"
                  :class="{ 'active': isCurrentQuality(option.value) }"
                  @click="selectQuality(option.value)"
                >
                  <span class="option-label">{{ option.label }}</span>
                </div>
              </div>
            </Transition>
          </div>

          <button class="close-player" @click="stopPlaying">
            <Icon name="x" :size="16" color="white" />
          </button>
        </div>

        <audio
          ref="audioPlayer"
          :src="song.musicUrl"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @loadedmetadata="onLoaded"
          @error="onError"
          @play="onPlay"
          @pause="onPause"
          @loadstart="onLoadStart"
          @canplay="onCanPlay"
        ></audio>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  song: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'ended', 'error'])

const audioPlayer = ref(null)
const progressBar = ref(null)
const isPlaying = ref(false)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
const hasError = ref(false)
const isClosing = ref(false)
const coverError = ref(false)
const showQualitySettings = ref(false)

// 音质设置相关
const { getQualityLabel, getQuality, getQualityOptions, saveQuality } = useAudioQuality()

// 全局音频播放器状态管理
const globalAudioPlayer = useAudioPlayer()

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

  const platform = props.song.musicPlatform
  const musicId = props.song.musicId || props.song.id

  // 如果选择的是当前音质，直接返回
  if (isCurrentQuality(qualityValue)) {
    showQualitySettings.value = false
    return
  }

  // 保存当前播放进度和状态
  const currentTimeBackup = audioPlayer.value ? audioPlayer.value.currentTime : 0
  const wasPlaying = isPlaying.value

  // 立即更新播放状态为暂停，避免状态不一致
  if (wasPlaying && audioPlayer.value) {
    audioPlayer.value.pause()
    isPlaying.value = false
    // 同步到全局状态
    globalAudioPlayer.pauseSong()
    // 通知鸿蒙应用暂停
    notifyHarmonyOS('pause')
  }

  // 保存音质设置
  saveQuality(platform, qualityValue)

  // 显示提示
  if (window.$showNotification) {
    const label = getQualityLabel(platform, qualityValue)
    const platformName = platform === 'netease' ? '网易云音乐' : 'QQ音乐'
    window.$showNotification(`${platformName}音质已切换为：${label}`, 'success')
  }

  // 关闭下拉框
  showQualitySettings.value = false

  // 重新获取新音质的URL并加载
  try {
    const newUrl = await getMusicUrl(platform, musicId, qualityValue)
    if (newUrl && audioPlayer.value) {
      // 更新音频源
      audioPlayer.value.src = newUrl

      // 创建一个Promise来处理音频加载
      const loadPromise = new Promise((resolve, reject) => {
        const handleLoadedMetadata = () => {
          audioPlayer.value.removeEventListener('loadedmetadata', handleLoadedMetadata)
          audioPlayer.value.removeEventListener('error', handleError)
          resolve()
        }
        
        const handleError = (err) => {
          audioPlayer.value.removeEventListener('loadedmetadata', handleLoadedMetadata)
          audioPlayer.value.removeEventListener('error', handleError)
          reject(err)
        }

        audioPlayer.value.addEventListener('loadedmetadata', handleLoadedMetadata)
        audioPlayer.value.addEventListener('error', handleError)
      })

      // 加载新的音频
      audioPlayer.value.load()

      // 等待加载完成
      await loadPromise

      // 恢复播放进度
      if (audioPlayer.value && currentTimeBackup > 0) {
        audioPlayer.value.currentTime = currentTimeBackup
        // 立即更新进度显示
        currentTime.value = currentTimeBackup
        if (duration.value > 0) {
          progress.value = (currentTimeBackup / duration.value) * 100
        }
      }

      // 如果之前在播放，恢复播放状态
      if (wasPlaying) {
        // 播放状态会通过onPlay事件自动更新
        await audioPlayer.value.play()
      }
    }
  } catch (error) {
    console.error('切换音质失败:', error)
    if (window.$showNotification) {
      window.$showNotification('切换音质失败，请稍后重试', 'error')
    }
    
    // 如果切换失败，尝试恢复之前的播放状态
    if (wasPlaying && audioPlayer.value && !audioPlayer.value.error) {
      try {
        // 播放状态会通过onPlay事件自动更新
        await audioPlayer.value.play()
      } catch (playError) {
        console.error('恢复播放失败:', playError)
      }
    }
  }
}

// 动态获取音乐URL（支持指定音质）
const getMusicUrl = async (platform, musicId, quality = null) => {
  try {
    const qualityParam = quality || getQuality(platform)
    let apiUrl

    if (platform === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${qualityParam}`
    } else if (platform === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${qualityParam}`
    } else {
      throw new Error('不支持的音乐平台')
    }

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error('获取音乐URL失败')
    }

    const data = await response.json()
    if (data.code === 200 && data.data && data.data.url) {
      return data.data.url
    }

    return null
  } catch (error) {
    console.error('获取音乐URL错误:', error)
    throw error
  }
}



// 拖拽相关
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartProgress = ref(0)

watch(() => props.song, (newSong, oldSong) => {
  if (newSong && newSong.musicUrl) {
    isClosing.value = false
    progress.value = 0
    currentTime.value = 0
    duration.value = 0
    hasError.value = false
    coverError.value = false

    // 先通知鸿蒙应用歌曲信息变化
    setTimeout(() => {
      notifyHarmonyOS('metadata')
    }, 50)

    setTimeout(() => {
      if (audioPlayer.value) {
        audioPlayer.value.load()
        // 播放状态会通过onPlay事件自动更新
        audioPlayer.value.play().catch(err => {
          console.error('播放失败:', err)
          hasError.value = true
          emit('error', err)
        })
      }
    }, 100)
  }
}, { immediate: true })

// 监听全局播放状态变化
const globalPlayingStatus = globalAudioPlayer.getPlayingStatus()
watch(globalPlayingStatus, (newPlayingStatus) => {
  // 如果全局状态变为暂停，同步本地状态
  if (!newPlayingStatus && isPlaying.value) {
    if (audioPlayer.value) {
      audioPlayer.value.pause() // 状态会通过onPause事件自动更新
    }
  }
  // 如果全局状态变为播放，且当前歌曲匹配，同步本地状态
  else if (newPlayingStatus && !isPlaying.value) {
    const currentGlobalSong = globalAudioPlayer.getCurrentSong().value
    if (currentGlobalSong && props.song && currentGlobalSong.id === props.song.id) {
      if (audioPlayer.value && audioPlayer.value.paused) {
        audioPlayer.value.play().catch(err => { // 状态会通过onPlay事件自动更新
          console.error('播放失败:', err)
          hasError.value = true
          emit('error', err)
        })
      }
    }
  }
}, { immediate: true })

const handleImageError = (event) => {
  coverError.value = true
}

const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
}

// 切换播放/暂停
const togglePlay = () => {
  if (!audioPlayer.value) return

  if (isPlaying.value) {
    // 暂停播放 - 状态会通过onPause事件自动更新
    audioPlayer.value.pause()
  } else {
    // 开始播放 - 状态会通过onPlay事件自动更新
    audioPlayer.value.play().catch(err => {
      console.error('播放失败:', err)
      hasError.value = true
      emit('error', err)
    })
  }
}

// 通知鸿蒙应用播放状态变化
const notifyHarmonyOS = (action) => {
  if (typeof window !== 'undefined' && props.song) {
    // 处理封面URL，确保是完整的URL
    let coverUrl = props.song.cover || ''
    
    if (coverUrl && !coverUrl.startsWith('http')) {
      // 如果是相对路径，转换为完整URL
      if (coverUrl.startsWith('/')) {
        coverUrl = window.location.origin + coverUrl
      } else {
        coverUrl = window.location.origin + '/' + coverUrl
      }
    }

    const songInfo = {
      title: props.song.title || '未知歌曲',
      artist: props.song.artist || '未知艺术家',
      album: props.song.album || 'VoiceHub',
      cover: coverUrl,
      duration: duration.value || 0,
      position: currentTime.value || 0
    }

    // 只有在鸿蒙环境中才调用相关API
    if (window.voiceHubPlayer) {
      if (action === 'play') {
        window.voiceHubPlayer.onPlayStateChanged(true, songInfo)
      } else if (action === 'pause') {
        window.voiceHubPlayer.onPlayStateChanged(false, songInfo)
      } else if (action === 'metadata') {
        window.voiceHubPlayer.onSongChanged(songInfo)
      }
    }
  }
}

const stopPlaying = () => {
  if (isClosing.value) return

  isClosing.value = true

  if (audioPlayer.value) {
    audioPlayer.value.pause() // 状态会通过onPause事件自动更新
    audioPlayer.value.currentTime = 0
    // 同步到全局状态
    globalAudioPlayer.stopSong()
  }

  setTimeout(() => {
    emit('close')
  }, 300)
}

// 处理时间更新事件
const onTimeUpdate = () => {
  if (!audioPlayer.value) return
  
  currentTime.value = audioPlayer.value.currentTime
  
  if (audioPlayer.value.duration) {
    progress.value = (audioPlayer.value.currentTime / audioPlayer.value.duration) * 100
    
    // 每5秒通知一次鸿蒙应用播放位置（避免过于频繁的更新）
    const currentTimeInt = Math.floor(audioPlayer.value.currentTime)
    if (currentTimeInt % 5 === 0 && isPlaying.value) {
      notifyHarmonyOS('play') // 这会包含当前位置信息
    }
  }
}

// 处理播放结束事件
const onEnded = () => {
  // 播放状态会通过onPause事件自动更新（播放结束时会触发pause事件）
  progress.value = 0
  currentTime.value = 0
  emit('ended')
}

// 处理音频加载事件
const onLoaded = () => {
  if (!audioPlayer.value) return
  duration.value = audioPlayer.value.duration
  
  // 音频加载完成后，立即同步状态到鸿蒙应用
  if (props.song) {
    notifyHarmonyOS('metadata')
  }
}

// 处理错误事件
const onError = (err) => {
  console.error('音频加载错误:', err)
  hasError.value = true
  emit('error', err)
}

// 处理播放事件（音频实际开始播放时触发）
const onPlay = () => {
  if (!isPlaying.value) {
    isPlaying.value = true
    // 同步到全局状态
    if (props.song) {
      globalAudioPlayer.playSong(props.song)
    }
    // 通知鸿蒙应用
    notifyHarmonyOS('play')
  }
}

// 处理暂停事件（音频实际暂停时触发）
const onPause = () => {
  if (isPlaying.value) {
    isPlaying.value = false
    // 同步到全局状态
    globalAudioPlayer.pauseSong()
    // 通知鸿蒙应用
    notifyHarmonyOS('pause')
  }
}

// 处理加载开始事件
const onLoadStart = () => {
  // 重置错误状态
  hasError.value = false
}

// 处理可以播放事件
const onCanPlay = () => {
  // 音频准备就绪，确保状态同步
  if (props.song) {
    notifyHarmonyOS('metadata')
  }
}

// 格式化时间
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}



// 进度条拖拽功能
const startDrag = (event) => {
  if (event.button !== 0) return // 只响应左键

  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartProgress.value = progress.value

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
  event.preventDefault()
}

const onDrag = (event) => {
  if (!isDragging.value || !progressBar.value) return

  const rect = progressBar.value.getBoundingClientRect()
  const newX = event.clientX - rect.left
  const percentage = Math.max(0, Math.min(100, (newX / rect.width) * 100))

  progress.value = percentage

  // 实时更新播放位置
  if (audioPlayer.value && duration.value) {
    audioPlayer.value.currentTime = (percentage / 100) * duration.value
  }
}

const endDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  // 清理触摸事件
  document.removeEventListener('touchmove', onTouchDrag)
  document.removeEventListener('touchend', endTouchDrag)
  
  // 拖拽结束后，如果正在播放，同步状态到鸿蒙应用
  if (isPlaying.value && props.song) {
    notifyHarmonyOS('play')
  }
}

// 触摸事件处理
const startTouchDrag = (event) => {
  if (event.touches.length !== 1) return // 只响应单指触摸

  isDragging.value = true
  const touch = event.touches[0]
  dragStartX.value = touch.clientX
  dragStartProgress.value = progress.value

  document.addEventListener('touchmove', onTouchDrag, { passive: false })
  document.addEventListener('touchend', endTouchDrag)
  event.preventDefault()
}

const onTouchDrag = (event) => {
  if (!isDragging.value || !progressBar.value || event.touches.length !== 1) return

  const touch = event.touches[0]
  const rect = progressBar.value.getBoundingClientRect()
  const deltaX = touch.clientX - dragStartX.value
  const progressBarWidth = rect.width
  const deltaProgress = (deltaX / progressBarWidth) * 100

  let newProgress = dragStartProgress.value + deltaProgress
  newProgress = Math.max(0, Math.min(100, newProgress))

  const percentage = newProgress
  if (audioPlayer.value && duration.value) {
    audioPlayer.value.currentTime = (percentage / 100) * duration.value
  }

  event.preventDefault()
}

const endTouchDrag = () => {
  isDragging.value = false
  document.removeEventListener('touchmove', onTouchDrag)
  document.removeEventListener('touchend', endTouchDrag)
  
  // 拖拽结束后，如果正在播放，同步状态到鸿蒙应用
  if (isPlaying.value && props.song) {
    notifyHarmonyOS('play')
  }
}

// 添加进度条点击跳转功能
const seekToPosition = (event) => {
  if (!audioPlayer.value || isDragging.value) return

  const progressBar = event.currentTarget
  const clickPosition = event.offsetX
  const barWidth = progressBar.clientWidth
  const seekPercentage = (clickPosition / barWidth)

  // 设置新的播放位置
  audioPlayer.value.currentTime = seekPercentage * duration.value

  // 更新进度
  progress.value = seekPercentage * 100
  
  // 跳转后，如果正在播放，同步状态到鸿蒙应用
  if (isPlaying.value && props.song) {
    notifyHarmonyOS('play')
  }
}



// 处理点击外部关闭下拉框
const handleClickOutside = (event) => {
  const qualitySelector = event.target.closest('.quality-selector')
  if (!qualitySelector && showQualitySettings.value) {
    showQualitySettings.value = false
  }
}

// 组件挂载时添加事件监听
onMounted(() => {
  // 添加点击外部关闭下拉框的监听
  document.addEventListener('click', handleClickOutside)
  
  // 如果有当前歌曲，立即发送元数据到HarmonyOS
  if (props.song) {
    notifyHarmonyOS('metadata')
  }
})

// 组件卸载时释放资源
onUnmounted(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.src = ''
  }
  // 清理拖拽事件监听器
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('touchmove', onTouchDrag)
  document.removeEventListener('touchend', endTouchDrag)
  // 移除点击外部监听
  document.removeEventListener('click', handleClickOutside)
})


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
  flex: 1;
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

</style>