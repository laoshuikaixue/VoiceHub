<template>
  <div>
    <Transition name="overlay-animation">
      <div v-if="song" class="player-overlay" @click="stopPlaying"></div>
    </Transition>
    
    <Transition name="player-animation">
      <div v-if="song" class="global-audio-player">
        <div class="player-info">
          <div class="cover-container">
            <template v-if="song.cover">
              <img :src="song.cover" alt="封面" class="player-cover" @error="handleImageError" />
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
                <span v-if="isPlaying" class="pause-icon">❚❚</span>
                <span v-else class="play-icon">▶</span>
              </button>
              
              <div class="progress-bar" @click="seekToPosition">
                <div class="progress" :style="{ width: `${progress}%` }"></div>
              </div>
            </div>
            
            <div class="time-display">
              <span class="current-time">{{ formatTime(currentTime) }}</span>
              <span class="duration">{{ formatTime(duration) }}</span>
            </div>
          </div>
        </div>
        
        <button class="close-player" @click="stopPlaying">×</button>
        
        <audio 
          ref="audioPlayer" 
          :src="song.musicUrl" 
          @timeupdate="onTimeUpdate" 
          @ended="onEnded"
          @loadedmetadata="onLoaded"
          @error="onError"
        ></audio>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  song: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'ended', 'error'])

const audioPlayer = ref(null)
const isPlaying = ref(false)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
const hasError = ref(false)
const isClosing = ref(false) // 新增：标记是否正在关闭

watch(() => props.song, (newSong) => {
  if (newSong && newSong.musicUrl) {
    // 当歌曲变更时，重置状态
    isClosing.value = false
    progress.value = 0
    currentTime.value = 0
    duration.value = 0
    hasError.value = false
    
    // 延迟执行播放，确保DOM已更新
    setTimeout(() => {
      if (audioPlayer.value) {
        audioPlayer.value.load()
        audioPlayer.value.play().catch(err => {
          console.error('播放失败:', err)
          hasError.value = true
          emit('error', err)
        })
        isPlaying.value = true
      }
    }, 100)
  }
}, { immediate: true })

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = 'none'
  event.target.parentNode.classList.add('text-cover')
  event.target.parentNode.textContent = getFirstChar(props.song?.title || '')
}

// 获取标题第一个字符
const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
}

// 切换播放/暂停
const togglePlay = () => {
  if (!audioPlayer.value) return
  
  if (isPlaying.value) {
    audioPlayer.value.pause()
    isPlaying.value = false
  } else {
    audioPlayer.value.play().catch(err => {
      console.error('播放失败:', err)
      hasError.value = true
      emit('error', err)
    })
    isPlaying.value = true
  }
}

// 停止播放
const stopPlaying = () => {
  if (isClosing.value) return // 防止重复触发
  
  isClosing.value = true
  
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
    isPlaying.value = false
  }
  
  // 添加延迟，让动画有时间执行
  setTimeout(() => {
    emit('close')
  }, 300) // 动画持续时间
}

// 处理时间更新事件
const onTimeUpdate = () => {
  if (!audioPlayer.value) return
  
  currentTime.value = audioPlayer.value.currentTime
  
  if (audioPlayer.value.duration) {
    progress.value = (audioPlayer.value.currentTime / audioPlayer.value.duration) * 100
  }
}

// 处理播放结束事件
const onEnded = () => {
  isPlaying.value = false
  progress.value = 0
  currentTime.value = 0
  emit('ended')
}

// 处理音频加载事件
const onLoaded = () => {
  if (!audioPlayer.value) return
  duration.value = audioPlayer.value.duration
}

// 处理错误事件
const onError = (err) => {
  console.error('音频加载错误:', err)
  hasError.value = true
  emit('error', err)
}

// 格式化时间
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 添加进度条点击跳转功能
const seekToPosition = (event) => {
  if (!audioPlayer.value) return
  
  const progressBar = event.currentTarget
  const clickPosition = event.offsetX
  const barWidth = progressBar.clientWidth
  const seekPercentage = (clickPosition / barWidth)
  
  // 设置新的播放位置
  audioPlayer.value.currentTime = seekPercentage * duration.value
  
  // 更新进度
  progress.value = seekPercentage * 100
}

// 组件卸载时释放资源
onUnmounted(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.src = ''
  }
})
</script>

<style scoped>
/* 背景遮罩层 */
.player-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40vh; /* 只覆盖底部区域 */
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
  border-radius: 10px;
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
  border-radius: 6px;
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
  overflow: hidden;
  transition: height 0.2s ease;
}

.progress-bar:hover {
  height: 8px;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #0043F8 0%, #0075F8 100%);
  border-radius: 3px;
  transition: width 0.1s linear;
  position: relative;
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
  opacity: 0.5;
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

/* 修复关闭按钮动画 */
.close-player {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
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
    bottom: 0.5rem;
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
}
</style> 