<template>
  <section
    class="app-loading-screen"
    role="status"
    aria-live="polite"
    :aria-label="LOADING_SCREEN_TEXT.ARIA_LABEL"
  >
    <div class="loading-content">
      <div class="loader-mark" aria-hidden="true">
        <div class="loader-orbit" />
        <div class="loader-core" />
      </div>

      <div class="copy">
        <p class="eyebrow">VoiceHub</p>
        <h1>{{ displayTitle }}</h1>
        <p class="message">{{ displayMessage }}</p>
      </div>

      <div class="progress-wrap" aria-hidden="true">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${safeProgress}%` }" />
        </div>
        <span class="progress-value">{{ safeProgress }}%</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const LOADING_SCREEN_TEXT = {
  ARIA_LABEL: 'VoiceHub 正在加载',
  TITLE: 'Loading',
  MESSAGE: '正在同步排期、歌曲和用户状态',
  DEFAULT_PROGRESS: 8
}

const props = defineProps<{
  title?: string
  message?: string
  progress?: number
}>()

const displayTitle = computed(() => props.title || LOADING_SCREEN_TEXT.TITLE)
const displayMessage = computed(() => props.message || LOADING_SCREEN_TEXT.MESSAGE)

const safeProgress = computed(() => {
  const normalized = Math.round(Number(props.progress ?? LOADING_SCREEN_TEXT.DEFAULT_PROGRESS) || 0)
  return Math.min(100, Math.max(0, normalized))
})
</script>

<style scoped>
.app-loading-screen {
  position: fixed;
  inset: 0;
  z-index: var(--z-app-loader, 9000);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 50% 42%, rgba(59, 130, 246, 0.18), transparent 34%),
    #07080d;
}

.loading-content {
  position: relative;
  display: flex;
  width: min(360px, 100%);
  flex-direction: column;
  align-items: center;
  gap: 22px;
  text-align: center;
}

.loader-mark {
  position: relative;
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
}

.loader-orbit {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background:
    conic-gradient(from 90deg, rgba(59, 130, 246, 0), #60a5fa, #22c55e, rgba(59, 130, 246, 0)),
    rgba(255, 255, 255, 0.04);
  mask: radial-gradient(circle, transparent 0 58%, #000 60%);
  box-shadow: 0 0 30px rgba(59, 130, 246, 0.25);
  animation: loader-spin 1.45s linear infinite;
}

.loader-core {
  position: absolute;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f8fafc, #bfdbfe);
  box-shadow:
    0 0 24px rgba(96, 165, 250, 0.36),
    inset 0 -6px 12px rgba(59, 130, 246, 0.24);
  animation: core-breathe 1.8s ease-in-out infinite;
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  color: rgba(147, 197, 253, 0.9);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #f8fafc;
  font-size: clamp(24px, 5vw, 34px);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.08;
}

.message {
  min-height: 22px;
  margin: 0;
  color: rgba(226, 232, 240, 0.64);
  font-size: 13px;
  font-weight: 600;
}

.progress-wrap {
  display: grid;
  width: min(300px, 100%);
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
}

.progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  box-shadow: 0 0 24px rgba(34, 197, 94, 0.34);
  transition: width 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.progress-value {
  min-width: 36px;
  color: rgba(219, 234, 254, 0.86);
  font-size: 11px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

@keyframes loader-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes core-breathe {
  0%,
  100% {
    transform: scale(0.94);
  }
  50% {
    transform: scale(1);
  }
}

@media (max-width: 640px) {
  .app-loading-screen {
    padding: 20px;
  }

  .loading-content {
    gap: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loader-orbit,
  .loader-core {
    animation: none;
  }
}
</style>
