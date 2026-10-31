import { computed, ref } from 'vue'

export const useProgress = () => {
  const progress = ref(0)
  const message = ref('')
  const subMessage = ref('')
  const active = ref(false)
  const indeterminate = ref(false)
  const completed = ref(false)
  const error = ref('')

  // 进度百分比，确保在0-100范围内
  const percentage = computed(() => {
    return Math.min(100, Math.max(0, progress.value))
  })

  // 启动进度条
  const start = (initialMessage = '处理中...') => {
    progress.value = 0
    message.value = initialMessage
    subMessage.value = ''
    active.value = true
    indeterminate.value = false
    completed.value = false
    error.value = ''
  }

  // 启动不确定进度条（不显示具体百分比，用于未知进度的操作）
  const startIndeterminate = (initialMessage = '处理中...') => {
    progress.value = 0
    message.value = initialMessage
    subMessage.value = ''
    active.value = true
    indeterminate.value = true
    completed.value = false
    error.value = ''
  }

  // 更新进度
  const update = (newProgress: number, newMessage?: string, newSubMessage?: string) => {
    progress.value = newProgress

    if (newMessage !== undefined) {
      message.value = newMessage
    }

    if (newSubMessage !== undefined) {
      subMessage.value = newSubMessage
    }

    if (progress.value >= 100) {
      complete()
    }
  }

  // 完成进度
  const complete = (finalMessage = '处理完成') => {
    progress.value = 100
    message.value = finalMessage
    active.value = true
    indeterminate.value = false
    completed.value = true

    // 2秒后自动隐藏进度条
    setTimeout(() => {
      if (completed.value) {
        active.value = false
      }
    }, 2000)
  }

  // 设置错误
  const setError = (errorMessage: string) => {
    error.value = errorMessage
    active.value = true
    indeterminate.value = false

    // 3秒后自动隐藏错误
    setTimeout(() => {
      if (error.value) {
        active.value = false
        error.value = ''
      }
    }, 3000)
  }

  // 重置进度条
  const reset = () => {
    progress.value = 0
    message.value = ''
    subMessage.value = ''
    active.value = false
    indeterminate.value = false
    completed.value = false
    error.value = ''
  }

  return {
    progress,
    percentage,
    message,
    subMessage,
    active,
    indeterminate,
    completed,
    error,
    start,
    startIndeterminate,
    update,
    complete,
    setError,
    reset
  }
}
