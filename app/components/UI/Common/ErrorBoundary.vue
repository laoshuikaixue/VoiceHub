<template>
  <div class="relative w-full">
    <slot v-if="!hasError" />

    <!-- 错误状态 -->
    <div
      v-else
      class="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-bg-secondary-30 border border-dashed border-border-secondary rounded-3xl animate-in fade-in zoom-in duration-300"
    >
      <div class="relative mb-6">
        <div class="absolute inset-0 blur-2xl bg-error-10 rounded-full" />
        <div
          class="relative flex items-center justify-center w-16 h-16 bg-bg-primary border border-error-30 rounded-2xl text-error shadow-xl shadow-[0_20px_25px_var(--shadow-color-deep)]"
        >
          <AlertCircle :size="32" stroke-width="1.5" />
        </div>
      </div>

      <h3 class="text-xl font-black text-text-primary tracking-tight mb-2">{{ displayTitle }}</h3>
      <p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest max-w-xs mb-8">
        {{ displayMessage }}
      </p>

      <div class="flex flex-wrap items-center justify-center gap-4">
        <button
          :disabled="retrying"
          class="flex items-center gap-2 px-6 py-2.5 bg-bg-primary border border-border-secondary hover:border-primary-50 text-text-tertiary hover:text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[0_10px_15px_var(--shadow-color)] disabled:opacity-50"
          @click="handleRetry"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': retrying }" />
          <span>{{ retrying ? locale.retrying : locale.retry }}</span>
        </button>

        <button
          v-if="showDetails"
          class="px-6 py-2.5 bg-bg-secondary-50 border border-border-secondary hover:border-border-tertiary text-text-tertiary hover:text-text-secondary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
          @click="toggleDetails"
        >
          {{ showErrorDetails ? locale.hideDetails : locale.showDetails }}
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
          <div class="p-4 bg-bg-primary border border-border-secondary rounded-2xl">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
                >{{ locale.debugInfo }}</span
              >
            </div>
            <pre
              class="text-[10px] font-mono text-text-tertiary leading-relaxed overflow-x-auto p-4 bg-bg-primary-30 rounded-xl whitespace-pre-wrap break-all"
              >{{ errorDetails }}</pre
            >
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AlertCircle, RefreshCw } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useLocale } from '~/utils/locale'

const { ui } = useLocale()
const locale = computed(() => ui.value?.errorBoundary || {})

interface Props {
  error?: Error | string | null
  errorTitle?: string
  errorMessage?: string
  showDetails?: boolean
  onRetry?: () => void | Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  error: null,
  errorTitle: undefined,
  errorMessage: undefined,
  showDetails: false,
  onRetry: undefined
})

const hasError = computed(() => !!props.error)
const displayTitle = computed(() => props.errorTitle || locale.value.defaultTitle)
const displayMessage = computed(() => props.errorMessage || locale.value.defaultMessage)
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
    console.error(locale.value.retryFailed, error)
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
  color: var(--color-error);
  margin-bottom: 16px;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary-lighter);
  margin: 0 0 8px 0;
}

.error-message {
  font-size: 16px;
  color: var(--text-muted);
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
  background: linear-gradient(135deg, var(--color-indigo-hover), var(--color-collab-hover));
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-indigo), var(--color-collab));
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
  background: var(--overlay-10);
  border: 1px solid var(--overlay-20);
  border-radius: 8px;
  color: var(--text-muted);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.details-btn:hover {
  background: var(--overlay-15);
  border-color: var(--overlay-30);
  color: var(--text-primary-lighter);
}

.error-details {
  margin-top: 24px;
  padding: 16px;
  background: var(--surface-card-bg-medium);
  border: 1px solid var(--overlay-10);
  border-radius: 8px;
  text-align: left;
  max-width: 600px;
  width: 100%;
}

.error-details h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary-lighter);
}

.error-details pre {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
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
