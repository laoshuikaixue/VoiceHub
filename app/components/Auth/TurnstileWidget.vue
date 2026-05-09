<template>
  <div class="turnstile-widget">
    <div ref="containerRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useSiteConfig } from '~/composables/useSiteConfig'

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
const containerRef = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let retryCount = 0
const MAX_RETRIES = 50 // 最大重试 50 次，每次 100ms，共 5 秒
let retryTimer: ReturnType<typeof setTimeout> | null = null

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
      },
      'expired-callback': () => {
        emit('update:modelValue', '')
      }
    })
  } else if (retryCount < MAX_RETRIES) {
    // 如果还没加载好，且未超过最大重试次数，稍微等一下
    retryCount++
    retryTimer = setTimeout(renderWidget, 100)
  } else {
    console.error('Failed to load Turnstile script: timeout exceeded.')
  }
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
  // 如果之前没有加载过 Turnstile 脚本，则动态加载
  if (!document.getElementById('turnstile-script')) {
    const script = document.createElement('script')
    script.id = 'turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
    
    // 监听加载成功
    script.onload = () => {
      renderWidget()
    }
  } else {
    renderWidget()
  }
})

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
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
</style>
