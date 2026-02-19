<template>
  <div class="relative w-full">
    <slot v-if="!hasError" />

    <!-- 错误状态 -->
    <div
      v-else
      class="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl animate-in fade-in zoom-in duration-300"
    >
      <div class="relative mb-6">
        <div class="absolute inset-0 blur-2xl bg-red-500/10 rounded-full" />
        <div
          class="relative flex items-center justify-center w-16 h-16 bg-zinc-950 border border-red-500/30 rounded-2xl text-red-500 shadow-xl shadow-black/40"
        >
          <AlertCircle :size="32" stroke-width="1.5" />
        </div>
      </div>

      <h3 class="text-xl font-black text-zinc-100 tracking-tight mb-2">{{ errorTitle }}</h3>
      <p class="text-[10px] font-black text-zinc-500 uppercase tracking-widest max-w-xs mb-8">
        {{ errorMessage }}
      </p>

      <div class="flex flex-wrap items-center justify-center gap-4">
        <button
          :disabled="retrying"
          class="flex items-center gap-2 px-6 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 text-zinc-400 hover:text-zinc-100 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-black/20 disabled:opacity-50"
          @click="handleRetry"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': retrying }" />
          <span>{{ retrying ? '正在重试' : '重新尝试' }}</span>
        </button>

        <button
          v-if="showDetails"
          class="px-6 py-2.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
          @click="toggleDetails"
        >
          {{ showErrorDetails ? '隐藏详细信息' : '查看详细信息' }}
        </button>
      </div>

      <!-- 错误详情 -->
      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div v-if="showErrorDetails" class="mt-8 w-full max-w-2xl text-left">
          <div class="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                >系统调试信息</span
              >
            </div>
            <pre
              class="text-[10px] font-mono text-zinc-500 leading-relaxed overflow-x-auto p-4 bg-black/30 rounded-xl whitespace-pre-wrap break-all"
              >{{ errorDetails }}</pre
            >
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AlertCircle, RefreshCw } from 'lucide-vue-next'
import { computed, ref } from 'vue'

interface Props {
  error?: Error | string | null
  errorTitle?: string
  errorMessage?: string
  showDetails?: boolean
  onRetry?: () => void | Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  error: null,
  errorTitle: '加载失败',
  errorMessage: '数据加载时发生错误，请稍后重试',
  showDetails: false,
  onRetry: undefined
})

const hasError = computed(() => !!props.error)
const retrying = ref(false)
const showErrorDetails = ref(false)

const errorDetails = computed(() => {
  if (!props.error) return ''
  if (typeof props.error === 'string') return props.error
  return props.error.stack || props.error.message || String(props.error)
})

const handleRetry = async () => {
  if (!props.onRetry || retrying.value) return

  retrying.value = true
  try {
    await props.onRetry()
  } catch (error) {
    console.error('重试失败:', error)
  } finally {
    retrying.value = false
  }
}

const toggleDetails = () => {
  showErrorDetails.value = !showErrorDetails.value
}
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  min-height: 200px;
}

.error-icon {
  width: 64px;
  height: 64px;
  color: #ef4444;
  margin-bottom: 16px;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 8px 0;
}

.error-message {
  font-size: 16px;
  color: #94a3b8;
  margin: 0 0 24px 0;
  max-width: 400px;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  transform: translateY(-1px);
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.retry-btn svg {
  width: 16px;
  height: 16px;
}

.details-btn {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #94a3b8;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.details-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: #f1f5f9;
}

.error-details {
  margin-top: 24px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  text-align: left;
  max-width: 600px;
  width: 100%;
}

.error-details h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.error-details pre {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .error-state {
    padding: 24px 16px;
  }

  .error-icon {
    width: 48px;
    height: 48px;
  }

  .error-title {
    font-size: 18px;
  }

  .error-message {
    font-size: 14px;
  }

  .error-actions {
    flex-direction: column;
    width: 100%;
  }

  .retry-btn,
  .details-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
