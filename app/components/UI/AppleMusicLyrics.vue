<template>
  <div :style="{ height }" class="apple-music-lyrics">
    <!-- 使用自定义的Apple Music风格歌词显示 -->
    <div v-if="!isLoading && !error && currentLyrics.length" class="lyrics-wrapper">
      <div ref="lyricContainer" class="custom-lyric-player">
        <div
          v-for="(line, index) in currentLyrics"
          :key="index"
          :class="[
            'lyric-line',
            {
              active: index === currentLyricIndex,
              passed: index < currentLyricIndex,
              upcoming: index > currentLyricIndex
            }
          ]"
          :style="getLyricLineStyle(index)"
          @click="handleLineClick(line, index)"
        >
          <div class="main-lyric">{{ line.content || '' }}</div>
          <div
            v-if="
              showTranslation &&
              translationLyrics[index]?.content &&
              translationLyrics[index].content !== '//'
            "
            class="translation-lyric"
          >
            {{ translationLyrics[index].content }}
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="isLoading" class="placeholder">
      <div class="loading-spinner" />
      <p>歌词加载中...</p>
    </div>

    <div v-else-if="error" class="placeholder error">
      <p>{{ error }}</p>
    </div>

    <div v-else class="placeholder">
      <p>暂无歌词</p>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  // 歌词数据
  currentLyrics: { type: Array, default: () => [] },
  translationLyrics: { type: Array, default: () => [] },
  wordByWordLyrics: { type: Array, default: () => [] },

  // 播放状态
  currentTime: { type: Number, default: 0 },
  currentLyricIndex: { type: Number, default: -1 },
  isLoading: { type: Boolean, default: false },
  error: { type: String, default: '' },

  // 样式配置
  height: { type: String, default: '400px' },
  fontSize: { type: Number, default: 18 },
  lineHeight: { type: Number, default: 1.6 },
  activeLineColor: { type: String, default: '#ffffff' },
  inactiveLineColor: { type: String, default: 'rgba(255, 255, 255, 0.6)' },
  backgroundColor: { type: String, default: 'transparent' },

  // 交互配置
  allowSeek: { type: Boolean, default: true },

  // 显示选项
  showTranslation: { type: Boolean, default: false }
})

const emit = defineEmits(['seek'])

const lyricContainer = ref(null)

// 处理歌词行点击
const handleLineClick = (line, index) => {
  if (props.allowSeek && line.time !== undefined) {
    emit('seek', line.time / 1000) // 转换为秒
  }
}

// 获取歌词行样式
const getLyricLineStyle = (index) => {
  const isActive = index === props.currentLyricIndex
  const isPassed = index < props.currentLyricIndex

  return {
    fontSize: `${props.fontSize}px`,
    lineHeight: props.lineHeight,
    color: isActive ? props.activeLineColor : props.inactiveLineColor,
    opacity: isPassed ? 0.4 : isActive ? 1 : 0.7,
    transform: isActive ? 'scale(1.05)' : 'scale(1)',
    fontWeight: isActive ? '600' : '400'
  }
}

// 自动滚动到当前歌词
watch(
  () => props.currentLyricIndex,
  (newIndex) => {
    if (newIndex >= 0 && lyricContainer.value) {
      nextTick(() => {
        const container = lyricContainer.value
        const activeLine = container.querySelector('.lyric-line.active')

        if (activeLine) {
          const containerHeight = container.clientHeight
          const lineTop = activeLine.offsetTop
          const lineHeight = activeLine.clientHeight

          // 计算滚动位置，让当前歌词居中显示
          const scrollTop = lineTop - containerHeight / 2 + lineHeight / 2

          container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          })
        }
      })
    }
  }
)
</script>

<style scoped>
.apple-music-lyrics {
  width: 100%;
  overflow: hidden;
  background: transparent;
  position: relative;
}

.lyrics-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.custom-lyric-player {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 60px 20px;
  box-sizing: border-box;

  /* 隐藏滚动条但保持滚动功能 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.custom-lyric-player::-webkit-scrollbar {
  display: none;
}

.lyric-line {
  text-align: center;
  margin: 16px 0;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  user-select: none;
  position: relative;
}

.lyric-line:hover {
  background: rgba(255, 255, 255, 0.05);
}

.lyric-line.active {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.main-lyric {
  font-size: inherit;
  line-height: inherit;
  font-weight: inherit;
  margin-bottom: 4px;
  transition: all 0.3s ease;
}

.translation-lyric {
  font-size: 0.85em;
  opacity: 0.8;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4px;
}

.lyric-line.active .translation-lyric {
  color: rgba(255, 255, 255, 0.9);
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
}

.placeholder.error {
  color: #ff6b6b;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Apple Music风格的渐变效果 */
.custom-lyric-player::before,
.custom-lyric-player::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 60px;
  pointer-events: none;
  z-index: 1;
}

.custom-lyric-player::before {
  top: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
}

.custom-lyric-player::after {
  bottom: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
}

/* 深色主题适配 */
@media (prefers-color-scheme: dark) {
  .placeholder {
    color: rgba(255, 255, 255, 0.7);
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .custom-lyric-player {
    padding: 40px 16px;
  }

  .lyric-line {
    margin: 12px 0;
    padding: 6px 12px;
  }

  .placeholder {
    font-size: 14px;
  }
}
</style>
