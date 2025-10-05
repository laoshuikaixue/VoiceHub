<template>
  <div :style="{ height }" class="lyrics-display">
    <div ref="containerRef" class="lyrics-container">
      <template v-if="!isLoading && !error && (currentLyrics?.length || translationLyrics?.length)">
        <div
            v-for="(line, index) in currentLyrics"
            :key="index"
            :ref="el => setLineRef(el, index)"
            :class="{ active: index === currentLyricIndex, passed: index < currentLyricIndex, upcoming: index > currentLyricIndex }"
            class="lyric-line"
            @click="allowSeek && handleSeek(line.time)"
        >
          <!-- 主歌词 -->
          <div class="line-primary">
            <template v-if="displayWords(line).length">
              <span
                  v-for="(w, wi) in displayWords(line)"
                  :key="wi"
                  :class="{ 'word-active': isWordActive(line, w) }"
                  class="lyric-word"
              >
                {{ w.content }}
              </span>
            </template>
            <template v-else>
              {{ line.content || '...' }}
            </template>
          </div>

          <!-- 翻译歌词 -->
          <div v-if="translationLyrics && translationLyrics[index] && translationLyrics[index].content && translationLyrics[index].content.trim() && translationLyrics[index].content !== '//'"
               class="line-translation">
            {{ translationLyrics[index].content }}
          </div>
        </div>
      </template>

      <div v-else-if="isLoading" class="placeholder">歌词加载中...</div>
      <div v-else-if="error" class="placeholder error">{{ error }}</div>
      <div v-else class="placeholder">暂无歌词</div>
    </div>
  </div>
</template>

<script setup>
import {nextTick, onMounted, ref, watch} from 'vue'

const props = defineProps({
  currentLyrics: {type: Array, default: () => []},
  translationLyrics: {type: Array, default: () => []},
  wordByWordLyrics: {type: Array, default: () => []},
  currentLyricIndex: {type: Number, default: -1},
  currentTime: {type: Number, default: 0},
  height: {type: String, default: '240px'},
  compact: {type: Boolean, default: false},
  showControls: {type: Boolean, default: true},
  allowSeek: {type: Boolean, default: false},
  isLoading: {type: Boolean, default: false},
  error: {type: String, default: ''}
})

const emit = defineEmits(['seek'])

const containerRef = ref(null)
const lineRefs = ref([])

const setLineRef = (el, index) => {
  if (el) {
    lineRefs.value[index] = el
  }
}

const scrollToActive = () => {
  if (!containerRef.value) return
  const activeEl = lineRefs.value[props.currentLyricIndex]
  if (!activeEl) return

  const container = containerRef.value
  const offsetTop = activeEl.offsetTop
  const half = container.clientHeight / 2
  const target = offsetTop - half + activeEl.clientHeight / 2

  container.scrollTo({top: target, behavior: 'smooth'})
}

const displayWords = (line) => {
  // 优先使用逐字歌词
  if (line && Array.isArray(line.words) && line.words.length) return line.words
  // 回退到全局 word-by-word 数据（如解析器返回分离结构）
  const idx = props.currentLyrics.indexOf(line)
  if (idx >= 0 && props.wordByWordLyrics && props.wordByWordLyrics[idx]) {
    return props.wordByWordLyrics[idx].words || []
  }
  return []
}

const isWordActive = (line, word) => {
  const wordStart = (word.time ?? 0)
  const wordEnd = wordStart + (word.duration ?? 0)
  const tMs = (props.currentTime || 0) * 1000
  return tMs >= wordStart && tMs < wordEnd
}

const handleSeek = (timeMs) => emit('seek', Math.max(0, (timeMs || 0) / 1000))

watch(
    () => props.currentLyricIndex,
    async () => {
      await nextTick()
      scrollToActive()
    }
)

watch(
    () => [props.currentLyrics, props.translationLyrics],
    async () => {
      await nextTick()
      scrollToActive()
    },
    {deep: true}
)

onMounted(async () => {
  await nextTick()
  scrollToActive()
})
</script>

<style scoped>
.lyrics-display {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.lyrics-container {
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: 8px 0;
  /* 顶/底部渐隐，仿 Apple Music */
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.7) 8%, #000 18%, #000 82%, rgba(0, 0, 0, 0.7) 92%, rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.7) 8%, #000 18%, #000 82%, rgba(0, 0, 0, 0.7) 92%, rgba(0, 0, 0, 0) 100%);
}

.lyric-line {
  padding: 6px 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.68);
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), color 420ms ease, text-shadow 420ms ease, opacity 420ms ease;
  line-height: 1.6;
  white-space: pre-wrap;
  will-change: transform, text-shadow, opacity;
}

/* 非当前行的层次 */
.lyric-line.passed {
  opacity: 0.5;
  transform: scale(0.995);
}

.lyric-line.upcoming {
  opacity: 0.75;
}

/* 当前行 - 丝滑放大并带光晕 */
.lyric-line.active {
  color: #fff;
  transform: translateY(-1px) scale(1.05);
  text-shadow: 0 0 10px rgba(99, 179, 237, 0.45), 0 0 22px rgba(59, 130, 246, 0.4);
  animation: popIn 460ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes popIn {
  0% {
    transform: translateY(8px) scale(0.98);
    opacity: 0.6;
    text-shadow: 0 0 0 rgba(59, 130, 246, 0);
  }
  55% {
    transform: translateY(-2px) scale(1.07);
    opacity: 1;
    text-shadow: 0 0 14px rgba(99, 179, 237, 0.5), 0 0 26px rgba(59, 130, 246, 0.45);
  }
  100% {
    transform: translateY(0) scale(1.03);
    text-shadow: 0 0 10px rgba(99, 179, 237, 0.45), 0 0 22px rgba(59, 130, 246, 0.4);
  }
}

.line-primary {
  font-size: 13.5px;
  font-weight: 600;
}

/* 当前行字体稍大，视觉焦点更强 */
.lyric-line.active .line-primary {
  font-size: 15.2px;
  letter-spacing: 0.15px;
}

.line-translation {
  font-size: 12px;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.5);
}

.lyric-word {
  display: inline-block;
  margin: 0 1px;
  padding: 0 1px;
  transition: color 180ms ease, text-shadow 180ms ease, transform 180ms ease;
}

.word-active {
  color: #fff;
  text-shadow: 0 0 6px rgba(255, 255, 255, 0.55), 0 0 14px rgba(99, 179, 237, 0.5);
  transform: translateY(-0.5px);
}

.placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
}

.placeholder.error {
  color: #ff7676;
}
</style>