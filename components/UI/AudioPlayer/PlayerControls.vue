<template>
  <div class="player-controls">
    <div class="progress-container">
      <div class="control-with-progress">
        <!-- 上一首按钮 -->
        <button 
          class="control-btn prev-btn" 
          @click="$emit('previous')" 
          :disabled="!hasPrevious"
          :title="hasPrevious ? '上一首' : '没有上一首'"
        >
          <Icon name="skip-back" :size="18" color="white" />
        </button>
        
        <!-- 播放/暂停按钮 -->
        <button class="control-btn play-pause-btn" @click="$emit('togglePlay')" :disabled="hasError">
          <Icon v-if="isPlaying" name="pause" :size="18" color="white" />
          <Icon v-else name="play" :size="18" color="white" />
        </button>
        
        <!-- 下一首按钮 -->
        <button 
          class="control-btn next-btn" 
          @click="$emit('next')" 
          :disabled="!hasNext"
          :title="hasNext ? '下一首' : '没有下一首'"
        >
          <Icon name="skip-forward" :size="18" color="white" />
        </button>

        <div class="progress-container-wrapper">
          <div
            class="progress-bar"
            @mousedown="handleProgressMouseDown"
            @touchstart="handleProgressTouchStart"
            @click="handleProgressClick"
            ref="progressBar"
          >
            <div 
              class="progress" 
              :class="{ 'dragging': isDragging }"
              :style="{ '--progress-width': `${progress}%` }"
            >
              <div class="progress-thumb" :class="{ 'dragging': isDragging }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="time-display">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span class="duration">{{ formatTime(duration) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  isPlaying: {
    type: Boolean,
    default: false
  },
  hasError: {
    type: Boolean,
    default: false
  },
  hasPrevious: {
    type: Boolean,
    default: false
  },
  hasNext: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    default: 0
  },
  isDragging: {
    type: Boolean,
    default: false
  },
  currentTime: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'togglePlay',
  'previous',
  'next',
  'startDrag',
  'startTouchDrag',
  'seekToPosition'
])

const progressBar = ref(null)

const formatTime = (time) => {
  if (!time || isNaN(time)) return '0:00'
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 进度条事件处理
const handleProgressMouseDown = (event) => {
  emit('startDrag', event, progressBar.value)
}

const handleProgressTouchStart = (event) => {
  emit('startTouchDrag', event, progressBar.value)
}

const handleProgressClick = (event) => {
  // 防止拖拽时触发点击
  if (props.isDragging) return
  emit('seekToPosition', event)
}

defineExpose({
  progressBar
})
</script>

<style scoped>
.player-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-with-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.control-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.control-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-pause-btn {
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.15);
}

.progress-container-wrapper {
  flex: 1;
  min-width: 0;
}

.progress-bar {
  width: 100%;
  height: 20px; /* 增加触摸区域 */
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  touch-action: none; /* 防止移动端滚动 */
}

.progress {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  transition: height 0.2s ease;
}

.progress::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--progress-width, 0%);
  background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
  border-radius: 2px;
  transition: width 0.05s linear;
  will-change: width;
}

.progress-thumb {
  position: absolute;
  left: calc(var(--progress-width, 0%) - 6px);
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.1s ease;
  will-change: opacity, transform;
  pointer-events: none;
}

.progress-bar:hover .progress,
.progress.dragging {
  height: 6px;
}

.progress-bar:hover .progress-thumb,
.progress-thumb.dragging {
  opacity: 1;
}

.progress-thumb.dragging {
  transform: translateY(-50%) scale(1.2);
}

/* 移动端优化 */
@media (hover: none) and (pointer: coarse) {
  .progress-bar {
    height: 24px; /* 增加移动端触摸区域 */
  }
  
  .progress {
    height: 6px; /* 移动端稍微增加高度 */
  }
  
  .progress-thumb {
    width: 16px; /* 移动端增大拇指大小 */
    height: 16px;
    left: calc(var(--progress-width, 0%) - 8px);
    opacity: 1; /* 移动端始终显示 */
  }
  
  .progress-bar:active .progress {
    height: 8px; /* 触摸时进一步增大 */
  }
}

.time-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  width: 100%;
}

.current-time,
.duration {
  font-variant-numeric: tabular-nums;
}
</style>