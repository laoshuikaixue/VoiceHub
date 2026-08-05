<template>
  <div class="turnstile-widget">
    <div v-if="status === 'loading'" class="turnstile-loading" role="status">
      <svg class="turnstile-loading-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4a8 8 0 1 0 7.75 10" />
      </svg>
      <span>{{ locale.turnstileLoading }}</span>
    </div>
    <div v-else-if="status === 'error'" class="turnstile-load-error" role="alert">
      <div class="turnstile-load-error-content">
        <svg class="turnstile-warning-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v4m0 4h.01" />
        </svg>
        <div>
          <p class="turnstile-load-error-title">{{ locale.turnstileLoadFailed }}</p>
          <p class="turnstile-load-error-desc">{{ locale.turnstileLoadFailedDesc }}</p>
        </div>
      </div>
      <button type="button" class="turnstile-retry" @click="retry">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-14.9-3L3 10m0 0V5m0 5h5M4 13a8.1 8.1 0 0 0 14.9 3L21 14m0 0v5m0-5h-5" /></svg>
        {{ locale.turnstileRetry }}
      </button>
    </div>
    <div v-show="status === 'ready'" ref="containerRef"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useLocale } from '~/utils/locale'

declare global {
  interface Window {
    turnstile: any
  }
}

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { siteConfig } = useSiteConfig()
const { auth } = useLocale()
const locale = computed(() => auth.value?.loginForm || {})
const containerRef = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
let widgetId: string | null = null
let retryCount = 0
const MAX_RETRIES = 50 // 最大重试 50 次，每次 100ms，共 5 秒
let retryTimer: ReturnType<typeof setTimeout> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

watch(() => siteConfig.value.turnstileSiteKey, (newKey) => {
  if (newKey && !widgetId) {
    renderWidget()
  }
}, { immediate: true })

function renderWidget() {
  if (!containerRef.value || !siteConfig.value.turnstileSiteKey || widgetId !== null) return

  // 确保全局存在 turnstile 对象
  if (window.turnstile) {
    widgetId = window.turnstile.render(containerRef.value, {
      sitekey: siteConfig.value.turnstileSiteKey,
      callback: (token: string) => {
        emit('update:modelValue', token)
      },
      'error-callback': () => {
        emit('update:modelValue', '')
        status.value = 'error'
      },
      'timeout-callback': () => {
        emit('update:modelValue', '')
        status.value = 'error'
      },
      'expired-callback': () => {
        emit('update:modelValue', '')
      }
    })
    status.value = 'ready'
    if (timeoutTimer) clearTimeout(timeoutTimer)
  } else if (retryCount < MAX_RETRIES) {
    // 如果还没加载好，且未超过最大重试次数，稍微等一下
    retryCount++
    retryTimer = setTimeout(renderWidget, 100)
  } else {
    status.value = 'error'
  }
}

function startTimeout() {
  if (timeoutTimer) clearTimeout(timeoutTimer)
  timeoutTimer = setTimeout(() => {
    if (widgetId === null) status.value = 'error'
  }, 5000)
}

async function retry() {
  if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
  widgetId = null
  retryCount = 0
  status.value = 'loading'
  startTimeout()
  await nextTick()
  if (window.turnstile) {
    renderWidget()
    return
  }
  document.getElementById('turnstile-script')?.remove()
  const script = document.createElement('script')
  script.id = 'turnstile-script'
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.onload = renderWidget
  script.onerror = () => { status.value = 'error' }
  document.head.appendChild(script)
}

const reset = () => {
  if (widgetId !== null && window.turnstile) {
    window.turnstile.reset(widgetId)
    emit('update:modelValue', '')
  }
}

defineExpose({
  reset
})

onMounted(() => {
  startTimeout()
  // 如果之前没有加载过 Turnstile 脚本，则动态加载
  if (!document.getElementById('turnstile-script')) {
    const script = document.createElement('script')
    script.id = 'turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
    
    // 监听加载成功
    script.onload = renderWidget
    script.onerror = () => { status.value = 'error' }
  } else {
    const script = document.getElementById('turnstile-script')
    if (window.turnstile) {
      renderWidget()
    } else if (script) {
      script.addEventListener('load', renderWidget, { once: true })
      script.addEventListener('error', () => { status.value = 'error' }, { once: true })
    }
  }
})

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
  if (timeoutTimer) clearTimeout(timeoutTimer)
  if (widgetId !== null && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})
</script>

<style scoped>
.turnstile-widget {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  margin-bottom: 8px;
}

.turnstile-loading,
.turnstile-load-error {
  box-sizing: border-box;
  width: 100%;
  min-height: 66px;
  border: 1px solid #dfe3e8;
  border-radius: 12px;
  background: #fafbfc;
}

.turnstile-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  color: #52606d;
  font-size: 14px;
}

.turnstile-loading-icon,
.turnstile-warning-icon,
.turnstile-retry svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.turnstile-loading-icon {
  width: 17px;
  height: 17px;
  color: #3ac7c0;
  animation: turnstile-spin 1s linear infinite;
}

.turnstile-load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-color: #f3d36b;
  background: #fffbed;
  color: #9a5700;
}

.turnstile-load-error-content { display: flex; align-items: flex-start; gap: 9px; min-width: 0; }
.turnstile-warning-icon { flex: 0 0 auto; width: 16px; height: 16px; margin-top: 2px; }
.turnstile-load-error-title { margin: 0; font-size: 14px; }
.turnstile-load-error-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.35; }
.turnstile-retry { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 7px 10px; border: 1px solid #efb84b; border-radius: 7px; background: #fff; color: #9a5700; font-size: 13px; cursor: pointer; }
.turnstile-retry:hover { background: #fff7df; }
.turnstile-retry svg { width: 13px; height: 13px; }

@keyframes turnstile-spin { to { transform: rotate(360deg); } }
</style>
