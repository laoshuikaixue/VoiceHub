<template>
  <div class="error-boundary">
    <slot v-if="!hasError"/>

    <!-- 错误状态 -->
    <div v-else class="error-state">
      <div class="error-icon">
        <svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
              d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
        </svg>
      </div>

      <h3 class="error-title">{{ errorTitle }}</h3>
      <p class="error-message">{{ errorMessage }}</p>

      <div class="error-actions">
        <button
            :disabled="retrying"
            class="retry-btn"
            @click="handleRetry"
        >
          <svg v-if="retrying" class="spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                opacity="0.25" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
            <path d="M21 12C21 9.61305 20.0518 7.32387 18.364 5.63604C16.6761 3.94821 14.3869 3 12 3"
                  stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
          </svg>
          <svg v-else fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M1 4V10H7M23 20V14H17M20.49 9C19.9828 7.56678 19.1209 6.28392 17.9845 5.27493C16.8482 4.26595 15.4745 3.56905 13.9917 3.24575C12.5089 2.92246 10.9652 2.98546 9.51691 3.42597C8.06861 3.86648 6.76071 4.66952 5.71 5.76L1 10M23 14L18.29 18.24C17.2393 19.3305 15.9314 20.1335 14.4831 20.574C13.0348 21.0145 11.4911 21.0775 10.0083 20.7542C8.52547 20.431 7.1518 19.7341 6.01547 18.7251C4.87913 17.7161 4.01717 16.4332 3.51 15"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
          </svg>
          {{ retrying ? '重试中...' : '重试' }}
        </button>

        <button
            v-if="showDetails"
            class="details-btn"
            @click="toggleDetails"
        >
          {{ showErrorDetails ? '隐藏详情' : '查看详情' }}
        </button>
      </div>

      <!-- 错误详情 -->
      <div v-if="showErrorDetails" class="error-details">
        <h4>错误详情:</h4>
        <pre>{{ errorDetails }}</pre>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
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