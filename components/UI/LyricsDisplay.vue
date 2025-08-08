<template>
  <div class="lyrics-display" :class="{ 'compact': compact }">
    <!-- 歌词控制栏 -->
    <div v-if="showControls" class="lyrics-controls">
      <button 
        @click="toggleTranslation" 
        :class="{ 'active': showTranslation }"
        class="control-btn"
        :disabled="!hasTranslation"
      >
        译
      </button>
      <button 
        @click="toggleWordByWord" 
        :class="{ 'active': showWordByWord }"
        class="control-btn"
        :disabled="!hasWordByWord"
      >
        逐字
      </button>
      <button @click="scrollToCurrentLyric" class="control-btn">
        定位
      </button>
    </div>

    <!-- 歌词内容 -->
    <div class="lyrics-content" ref="lyricsContainer">
      <!-- 加载状态 -->
    <div v-if="props.isLoading" class="lyrics-loading">
      <div class="loading-spinner"></div>
      <span>加载歌词中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="props.error" class="lyrics-error">
      <Icon name="alert-circle" />
      <span>{{ props.error }}</span>
    </div>

    <!-- 无歌词 -->
    <div v-else-if="!props.currentLyrics || props.currentLyrics.length === 0" class="lyrics-empty">
      <Icon name="music" />
      <span>暂无歌词</span>
    </div>

    <!-- 歌词列表 -->
    <div v-else class="lyrics-list" ref="lyricsList">
      <div
        v-for="(line, index) in props.currentLyrics"
        :key="index"
        :ref="el => setLyricLineRef(el, index)"
        @click="onLyricLineClick(index)"
        class="lyric-line"
        :class="{
          'current': index === props.currentLyricIndex,
          'passed': index < props.currentLyricIndex,
          'clickable': props.allowSeek
        }"
      >
          <!-- 主歌词 -->
          <div class="lyric-main">
            <template v-if="showWordByWord && line.words">
              <span
                v-for="(word, wordIndex) in line.words"
                :key="wordIndex"
                class="lyric-word"
                :class="{ 'word-active': isWordActive(line, word) }"
              >
                {{ word.content }}
              </span>
            </template>
            <template v-else>
              {{ line.content }}
            </template>
          </div>

          <!-- 翻译歌词 -->
          <div 
            v-if="showTranslation && getTranslationForLine(line.time)"
            class="lyric-translation"
          >
            {{ getTranslationForLine(line.time) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 当前歌词显示（紧凑模式） -->
    <div v-if="compact" class="current-lyric-display">
      <div class="current-lyric-main">{{ currentLyricContent }}</div>
      <div v-if="showTranslation && currentTranslationContent" class="current-lyric-translation">
        {{ currentTranslationContent }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { type LyricLine } from '~/composables/useLyrics'
import Icon from './Icon.vue'

interface Props {
  // 是否显示控制按钮
  showControls?: boolean
  // 是否允许点击歌词跳转
  allowSeek?: boolean
  // 紧凑模式（只显示当前歌词）
  compact?: boolean
  // 自动滚动
  autoScroll?: boolean
  // 高度
  height?: string
  // 歌词数据（从父组件传入）
  currentLyrics?: LyricLine[]
  translationLyrics?: LyricLine[]
  wordByWordLyrics?: LyricLine[]
  currentLyricIndex?: number
  currentTime?: number
  isLoading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  showControls: true,
  allowSeek: true,
  compact: false,
  autoScroll: true,
  height: '400px',
  currentLyrics: () => [],
  translationLyrics: () => [],
  wordByWordLyrics: () => [],
  currentLyricIndex: 0,
  currentTime: 0,
  isLoading: false,
  error: null
})

const emit = defineEmits<{
  seek: [time: number]
}>()

// 歌词显示设置（本地状态）
const showTranslation = ref(false)
const showWordByWord = ref(false)

// 计算属性
const currentLyricContent = computed(() => {
  const lyrics = props.currentLyrics
  if (!lyrics || lyrics.length === 0 || props.currentLyricIndex >= lyrics.length) {
    return ''
  }
  return lyrics[props.currentLyricIndex].content
})

const currentTranslationContent = computed(() => {
  if (!showTranslation.value || !props.translationLyrics || props.translationLyrics.length === 0) {
    return ''
  }
  
  const currentTime = props.currentLyrics?.[props.currentLyricIndex]?.time
  if (!currentTime) return ''
  
  // 找到对应时间的翻译歌词
  for (let i = 0; i < props.translationLyrics.length; i++) {
    if (currentTime >= props.translationLyrics[i].time && 
        (i === props.translationLyrics.length - 1 || currentTime < props.translationLyrics[i + 1].time)) {
      return props.translationLyrics[i].content
    }
  }
  return ''
})

// 跳转到指定歌词行
const seekToLyricLine = (index: number): number => {
  if (props.currentLyrics && index >= 0 && index < props.currentLyrics.length) {
    return props.currentLyrics[index].time / 1000 // 返回秒数
  }
  return 0
}

// 模板引用
const lyricsContainer = ref<HTMLElement>()
const lyricsList = ref<HTMLElement>()
const lyricLineRefs = ref<Map<number, HTMLElement>>(new Map())

// 计算属性
const hasTranslation = computed(() => props.translationLyrics.length > 0)
const hasWordByWord = computed(() => props.wordByWordLyrics.length > 0)

// 设置歌词行引用
const setLyricLineRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    lyricLineRefs.value.set(index, el)
  } else {
    lyricLineRefs.value.delete(index)
  }
}

// 切换翻译显示
const toggleTranslation = () => {
  showTranslation.value = !showTranslation.value
}

// 切换逐字歌词显示
const toggleWordByWord = () => {
  showWordByWord.value = !showWordByWord.value
}

// 滚动到当前歌词
const scrollToCurrentLyric = () => {
  if (!props.autoScroll) return
  
  nextTick(() => {
    const currentElement = lyricLineRefs.value.get(props.currentLyricIndex)
    if (currentElement && lyricsContainer.value) {
      const containerRect = lyricsContainer.value.getBoundingClientRect()
      const elementRect = currentElement.getBoundingClientRect()
      
      const scrollTop = lyricsContainer.value.scrollTop
      const targetScrollTop = scrollTop + elementRect.top - containerRect.top - containerRect.height / 2 + elementRect.height / 2
      
      lyricsContainer.value.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      })
    }
  })
}

// 歌词行点击事件
const onLyricLineClick = (index: number) => {
  if (!props.allowSeek) return
  
  const time = seekToLyricLine(index)
  emit('seek', time)
}

// 获取指定时间的翻译歌词
const getTranslationForLine = (time: number): string => {
  if (!showTranslation.value || props.translationLyrics.length === 0) {
    return ''
  }
  
  for (let i = 0; i < props.translationLyrics.length; i++) {
    if (time >= props.translationLyrics[i].time && 
        (i === props.translationLyrics.length - 1 || time < props.translationLyrics[i + 1].time)) {
      return props.translationLyrics[i].content
    }
  }
  return ''
}

// 判断单词是否激活（逐字歌词）
const isWordActive = (line: LyricLine, word: { time: number; duration: number; content: string }): boolean => {
  if (!showWordByWord.value || !word.time || !word.duration) return false
  
  const wordEndTime = word.time + word.duration
  return props.currentTime >= word.time && props.currentTime < wordEndTime
}

// 监听当前歌词索引变化，自动滚动
watch(() => props.currentLyricIndex, () => {
  if (props.autoScroll && !props.compact) {
    scrollToCurrentLyric()
  }
}, { flush: 'post' })

// 暴露方法给父组件
defineExpose({
  scrollToCurrentLyric,
  toggleTranslation,
  toggleWordByWord
})
</script>

<style scoped>
.lyrics-display {
  display: flex;
  flex-direction: column;
  height: v-bind(height);
  max-height: 400px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  position: relative;
}

.lyrics-display.compact {
  height: auto;
  min-height: 60px;
  max-height: 120px;
  background: rgba(255, 255, 255, 0.9);
}

.lyrics-controls {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(248, 250, 252, 0.6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(8px);
}

.control-btn {
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.95);
  border-color: var(--primary-color);
}

.control-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lyrics-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  position: relative;
  scroll-behavior: smooth;
}

.lyrics-loading,
.lyrics-error,
.lyrics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.7);
  gap: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.lyrics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
}

.lyric-line {
  padding: 6px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  line-height: 1.4;
  position: relative;
  text-align: center;
}

.lyric-line.clickable {
  cursor: pointer;
}

.lyric-line.clickable:hover {
  background: rgba(0, 0, 0, 0.04);
}

.lyric-line.passed {
  opacity: 0.4;
}

.lyric-line.current {
  background: rgba(59, 130, 246, 0.08);
  color: var(--primary-color);
  font-weight: 600;
}

.lyric-main {
  font-size: 14px;
  margin-bottom: 2px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.lyric-word {
  transition: color 0.2s ease;
}

.lyric-word.word-active {
  color: var(--primary-color);
  font-weight: 600;
}

.lyric-translation {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  opacity: 0.7;
  margin-top: 2px;
}

.current-lyric-display {
  padding: 12px 16px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.5);
}

.current-lyric-main {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 4px;
  line-height: 1.4;
}

.current-lyric-translation {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  opacity: 0.7;
}

/* 简约的滚动条样式 */
.lyrics-content::-webkit-scrollbar {
  width: 4px;
}

.lyrics-content::-webkit-scrollbar-track {
  background: transparent;
}

.lyrics-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.lyrics-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 滚动动画效果 */
.lyrics-content {
  scroll-padding-top: 50%;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .lyrics-controls {
    padding: 6px 10px;
  }
  
  .lyrics-content {
    padding: 10px 12px;
  }
  
  .lyrics-list {
    gap: 6px;
    padding: 12px 0;
  }
  
  .lyric-main {
    font-size: 13px;
  }
  
  .current-lyric-main {
    font-size: 14px;
  }
  
  .lyric-line {
    padding: 4px 6px;
  }
}

/* 统一使用深色主题 */
.lyrics-display {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
}

.lyrics-display.compact {
  background: rgba(30, 41, 59, 0.9);
}

.lyrics-controls {
  background: rgba(15, 23, 42, 0.6);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.control-btn {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.control-btn:hover:not(:disabled) {
  background: rgba(30, 41, 59, 0.95);
}

.lyric-line.current {
  background: rgba(59, 130, 246, 0.15);
}

.current-lyric-display {
  background: rgba(15, 23, 42, 0.5);
  border-top-color: rgba(255, 255, 255, 0.08);
}

.lyrics-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.lyrics-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>