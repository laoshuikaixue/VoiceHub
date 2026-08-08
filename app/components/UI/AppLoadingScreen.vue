<template>
  <section
    class="app-loading-screen"
    role="status"
    aria-live="polite"
    :aria-label="locale.ariaLabel"
  >
    <div class="top-progress-bar" :style="{ width: `${safeProgress}%` }" />

    <WarpCanvas
      :settings="warpSettings"
      :is-accelerating="isAccelerating"
      :current-progress="safeProgress / 100"
    />

    <main class="loading-main">
      <div class="progress-ring-wrap">
        <div class="progress-ring-static" />
        <svg class="progress-ring" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r="54"
            class="ring-track"
            stroke-width="3"
            fill="transparent"
          />
          <circle
            cx="64" cy="64" r="54"
            class="ring-fill"
            :class="{ accelerating: isAccelerating }"
            stroke-width="4"
            stroke-linecap="round"
            fill="transparent"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
        <div class="ring-label">
          <span class="ring-percent" :key="safeProgress">{{ safeProgress }}%</span>
        </div>
      </div>

      <div class="text-container">
        <Transition name="fade-slide" mode="out-in">
          <div class="text-content" :key="displayMessage">
            <h2 class="loading-message">{{ displayMessage }}</h2>
          </div>
        </Transition>
        <span class="phase-badge">{{ phaseLabel }}</span>
      </div>

    </main>


  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import WarpCanvas from './WarpCanvas.vue'
import { useLocale } from '~/utils/locale'

const { auth } = useLocale()
const locale = computed(() => auth.value?.appLoadingScreen || {})
const DEFAULT_PROGRESS = 8

const props = defineProps({
  message: { type: String },
  progress: { type: Number }
})

const displayMessage = computed(() => props.message || locale.value.message)

const safeProgress = computed(() => {
  const normalized = Math.round(Number(props.progress ?? DEFAULT_PROGRESS) || 0)
  return Math.min(100, Math.max(0, normalized))
})

const circumference = 2 * Math.PI * 54
const ringOffset = computed(() => circumference - (circumference * safeProgress.value) / 100)

const phaseLabel = computed(() => {
  const p = safeProgress.value
  if (p >= 100) return 'COMPLETE PHASE'
  if (p >= 88) return 'FINALIZING PHASE'
  if (p >= 82) return 'FALLBACK PHASE'
  if (p >= 68) return 'CONTENT PHASE'
  if (p >= 58) return 'SLOW NETWORK PHASE'
  if (p >= 46) return 'AUTH PHASE'
  if (p >= 28) return 'CONFIG PHASE'
  return 'START PHASE'
})

const isAccelerating = ref(false)

watch(() => props.progress, () => {
  isAccelerating.value = true
  setTimeout(() => { isAccelerating.value = false }, 600)
})

const warpSettings = computed(() => ({
  pattern: 'hyperdrive',
  speedMultiplier: safeProgress.value >= 100 ? 0.3 : 1.3,
  particleCount: 220,
  glowEffect: true,
  interactive: true
}))
</script>

<style scoped>
.app-loading-screen {
  position: fixed;
  inset: 0;
  z-index: var(--z-app-loader, 9000);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  overflow: hidden;
  color: var(--text-primary);
  /* 兜底色：极端情况下 data-theme 未设置导致主题变量缺失时，仍保证加载页不透明，避免主页内容透出 */
  background: var(--bg-primary, #000000);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
}

.loading-main {
  width: 100%;
  max-width: 576px;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  z-index: 10;
  flex: 1;
}

.progress-ring-wrap {
  position: relative;
  width: 128px;
  height: 128px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring-static {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--overlay-5);
}

.progress-ring {
  width: 112px;
  height: 112px;
  transform: rotate(-90deg);
}

.ring-track {
  stroke: var(--overlay-5);
}

.ring-fill {
  stroke: var(--app-loading-brand-primary);
  filter: drop-shadow(0 0 8px var(--app-loading-primary-glow));
  transition: stroke-dashoffset 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 400ms ease;
}

.ring-fill.accelerating {
  filter: drop-shadow(0 0 20px var(--app-loading-primary-glow-accelerating)) brightness(1.3);
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-percent {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: normal;
  color: var(--text-primary);
}

.text-container {
  position: relative;
  height: 80px;
  width: 100%;
  max-width: 448px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.text-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.loading-message {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.025em;
  color: var(--overlay-95);
  text-wrap: balance;
}

@media (min-width: 640px) {
  .loading-message {
    font-size: 20px;
  }
}

.phase-badge {
  margin-top: 8px;
  font-size: 10px;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.2em;
  color: var(--app-loading-text-color);
  text-transform: uppercase;
}

.top-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 3px;
  z-index: 20;
  background: linear-gradient(90deg, var(--app-loading-brand-primary), var(--app-loading-brand-secondary));
  box-shadow: 0 0 12px var(--app-loading-primary-glow), 0 0 40px var(--app-loading-secondary-glow);
  transition: width 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .progress-ring-wrap {
    width: 112px;
    height: 112px;
    margin-bottom: 24px;
  }

  .progress-ring {
    width: 96px;
    height: 96px;
  }

  .ring-percent {
    font-size: 24px;
  }

  .loading-message {
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: none;
  }
}
</style>
