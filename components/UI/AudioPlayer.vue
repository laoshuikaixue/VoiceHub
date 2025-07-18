<template>
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
          
          <div class="progress-bar">
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
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

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

watch(() => props.song, (newSong) => {
  if (newSong && newSong.musicUrl) {
    // 当歌曲变更时，重置状态
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
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
    isPlaying.value = false
  }
  emit('close')
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

// 组件卸载时释放资源
onUnmounted(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.src = ''
  }
})
</script>

<style scoped>
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

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #0043F8 0%, #0075F8 100%);
  border-radius: 3px;
  transition: width 0.1s linear;
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
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.control-btn:hover {
  transform: scale(1.1);
}

.play-icon {
  margin-left: 2px;
}

.pause-icon {
  font-size: 12px;
}

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
}

/* 响应式调整 */
@media (max-width: 768px) {
  .global-audio-player {
    width: 95%;
    padding: 0.75rem;
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
}
</style> 