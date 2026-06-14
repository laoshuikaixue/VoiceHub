<template>
  <div class="review-page">
    <Head>
      <Title>{{ locale.pageTitle }}</Title>
      <Meta name="theme-color" content="#000000" />
      <Meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
      />
    </Head>

    <!-- Loading State -->
    <div v-if="pending" class="state-screen loading">
      <div class="spinner" />
      <p class="loading-text">{{ locale.loading }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="state-screen error">
      <div class="icon-warning">⚠️</div>
      <div class="text-center">
        <h2 class="error-title">{{ locale.errorTitle }}</h2>
        <p class="error-desc">{{ locale.errorDesc }}</p>
      </div>
      <button class="retry-btn" @click="refresh"><span>🔄</span> {{ locale.retry }}</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="isEmpty" class="state-screen empty">
      <div class="empty-icon-circle">
        <span class="empty-icon">🎵</span>
      </div>
      <h2 class="empty-title">{{ locale.emptyTitle }}</h2>
      <p class="empty-desc">{{ locale.emptyDesc }}</p>
      <NuxtLink to="/" class="home-btn">{{ locale.goRequest }}</NuxtLink>
    </div>

    <!-- Main Content -->
    <div
      v-else
      class="slides-container"
      @wheel="handleWheel"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Progress Indicators -->
      <div class="indicators">
        <button
          v-for="(slide, idx) in slides"
          :key="slide.id"
          class="indicator-dot"
          :class="{ active: idx === currentIndex }"
          @click="goToSlide(idx)"
        />
      </div>

      <!-- Slide Transition -->
      <Transition :name="transitionName">
        <component
          :is="currentSlideComponent"
          :key="currentIndex"
          :data="data"
          :active="!isAnimating"
          class="slide-wrapper"
        />
      </Transition>

      <!-- Scroll Hint -->
      <Transition name="fade">
        <div v-if="currentIndex === 0" class="scroll-hint">
          <span>{{ locale.scrollHint }}</span>
          <svg
            class="animate-bounce"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import IntroSlide from '~/components/year-review/IntroSlide.vue'
import FirstSongSlide from '~/components/year-review/FirstSongSlide.vue'
import StatsSlide from '~/components/year-review/StatsSlide.vue'
import ArtistSlide from '~/components/year-review/ArtistSlide.vue'
import MiscSlide from '~/components/year-review/MiscSlide.vue'
import OutroSlide from '~/components/year-review/OutroSlide.vue'
import { useLocale } from '~/utils/locale'

// 导入全局样式
import '~/assets/css/year-review.css'

const { pages } = useLocale()
const locale = computed(() => pages.value.yearReview)

const { data: responseData, pending, error, refresh } = await useFetch('/api/user/year-review')

const data = computed(() => {
  if (!responseData.value) return null
  return responseData.value.data || responseData.value
})

const isEmpty = computed(() => {
  if (!data.value) return true
  return data.value.totalRequests === 0 && data.value.totalVotes === 0
})

// --- 幻灯片配置 ---
const slides = computed(() => {
  if (!data.value) return []

  const list = [
    { id: 'intro', component: IntroSlide },
    ...(data.value.firstSong ? [{ id: 'first', component: FirstSongSlide }] : []),
    { id: 'stats', component: StatsSlide },
    ...(data.value.topArtist ? [{ id: 'artist', component: ArtistSlide }] : []),
    { id: 'misc', component: MiscSlide },
    { id: 'outro', component: OutroSlide }
  ]
  return list
})

const currentIndex = ref(0)
const direction = ref(1) // 1 for down (next), -1 for up (prev)
const isAnimating = ref(false)
const transitionName = ref('slide-up')

const currentSlideComponent = computed(() => {
  return slides.value[currentIndex.value]?.component
})

// --- 导航逻辑 ---
const goToSlide = (index) => {
  if (isAnimating.value || index === currentIndex.value) return
  if (index < 0 || index >= slides.value.length) return

  const newDir = index > currentIndex.value ? 1 : -1
  direction.value = newDir
  transitionName.value = newDir > 0 ? 'slide-up' : 'slide-down'

  isAnimating.value = true
  currentIndex.value = index

  setTimeout(() => {
    isAnimating.value = false
  }, 600) // Match transition duration
}

const nextSlide = () => goToSlide(currentIndex.value + 1)
const prevSlide = () => goToSlide(currentIndex.value - 1)

// --- 事件监听 ---

// 键盘
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const handleKeyDown = (e) => {
  if (e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault()
    nextSlide()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    prevSlide()
  }
}

// 滚轮（防抖）
let wheelTimeout = null
const handleWheel = (e) => {
  if (Math.abs(e.deltaY) > 20 && !isAnimating.value) {
    if (wheelTimeout) clearTimeout(wheelTimeout)
    wheelTimeout = setTimeout(() => {
      if (e.deltaY > 0) nextSlide()
      else prevSlide()
    }, 50)
  }
}

// 触摸
let touchStartY = 0
const handleTouchStart = (e) => {
  touchStartY = e.touches[0].clientY
}

const handleTouchEnd = (e) => {
  const touchEndY = e.changedTouches[0].clientY
  const diff = touchStartY - touchEndY

  if (Math.abs(diff) > 50) {
    // Threshold
    if (diff > 0)
      nextSlide() // Swipe Up -> Next
    else prevSlide() // Swipe Down -> Prev
  }
}
</script>

<style scoped>
.review-page {
  position: fixed;
  inset: 0;
  background-color: #000;
  color: #fff;
  z-index: 9999;
  font-family:
    'MiSans',
    system-ui,
    -apple-system,
    sans-serif;
  overflow: hidden;
}

/* 状态屏幕 */
.state-screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #000;
  z-index: 50;
}

.loading .spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #8b5cf6; /* brand-purple */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 1rem;
  color: #9ca3af;
  font-size: 0.875rem;
  animation: pulse 2s infinite;
}

.error .icon-warning {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.error-desc {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.retry-btn {
  padding: 0.5rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.empty .empty-icon-circle {
  width: 5rem;
  height: 5rem;
  background: #111827;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.empty-icon {
  font-size: 2.25rem;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.empty-desc {
  color: #6b7280;
  margin-bottom: 2rem;
}

.home-btn {
  padding: 0.75rem 2rem;
  background: #8b5cf6;
  border-radius: 9999px;
  font-weight: 700;
  box-shadow: 0 10px 15px -3px rgba(139, 92, 246, 0.2);
  transition: background 0.2s;
}

.home-btn:hover {
  background: #7c3aed;
}

/* 幻灯片容器 */
.slides-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.slide-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
}

/* 指示器 */
.indicators {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.indicator-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.3s;
}

.indicator-dot:hover {
  background: rgba(255, 255, 255, 0.6);
}

.indicator-dot.active {
  height: 1.5rem;
  background: #fff;
}

/* 滚动提示 */
.scroll-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
