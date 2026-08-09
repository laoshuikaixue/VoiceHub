<template>
  <transition name="notification">
    <div
      v-if="show"
      :class="{
        success: type === 'success',
        error: type === 'error',
        info: type === 'info'
      }"
      class="notification"
    >
      <div class="notification-icon">
        <Icon v-if="type === 'success'" :size="16" name="success" />
        <Icon v-else-if="type === 'error'" :size="16" name="error" />
        <Icon v-else :size="16" name="info" />
      </div>
      <div class="notification-content">
        {{ message }}
      </div>
      <button class="notification-close" @click="$emit('close')">
        <Icon :size="16" name="close" />
      </button>

      <!-- 进度条 -->
      <div v-if="autoClose" class="notification-progress">
        <div :style="{ animationDuration: `${duration}ms` }" class="notification-progress-bar" />
      </div>
    </div>
  </transition>
</template>

<script setup>
import Icon from './Icon.vue'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info', // 'success', 'error', 'info'
    validator: (value) => ['success', 'error', 'info'].includes(value)
  },
  autoClose: {
    type: Boolean,
    default: true
  },
  duration: {
    type: Number,
    default: 3000 // 默认3秒后自动关闭
  }
})

defineEmits(['close'])
</script>

<style scoped>
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 99999;
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--mask-40);
  background: var(--panel-bg);
  color: var(--text-primary);
  max-width: 400px;
  min-width: 300px;
  font-family: 'MiSans', sans-serif;
  overflow: hidden; /* 确保进度条不会溢出 */
}

.notification.success {
  border-left: 4px solid var(--color-success);
}

.notification.error {
  border-left: 4px solid var(--color-error);
}

.notification.info {
  border-left: 4px solid var(--color-accent);
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  margin-right: 16px;
  font-weight: bold;
  font-size: 16px;
}

.success .notification-icon {
  background: var(--success-20);
  color: var(--color-success);
}

.error .notification-icon {
  background: var(--error-20);
  color: var(--color-error);
}

.info .notification-icon {
  background: var(--color-accent-alpha-20);
  color: var(--color-accent);
}

.notification-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.notification-close {
  background: transparent;
  border: none;
  color: var(--overlay-60);
  font-size: 20px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  padding: 0;
  transition: color 0.2s;
}

.notification-close:hover {
  color: var(--text-primary);
}

/* 进度条 */
.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--overlay-10);
}

.notification-progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  animation: progress-shrink linear forwards;
}

.success .notification-progress-bar {
  background-color: var(--color-success);
}

.error .notification-progress-bar {
  background-color: var(--color-error);
}

.info .notification-progress-bar {
  background-color: var(--color-accent);
}

@keyframes progress-shrink {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

/* 动画效果 */
.notification-enter-active {
  animation: notification-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.notification-leave-active {
  animation: notification-out 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

@keyframes notification-in {
  0% {
    opacity: 0;
    transform: translateX(40px) scale(0.9);
  }
  50% {
    transform: translateX(-5px) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes notification-out {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(20px) scale(0.9);
  }
}
</style>
