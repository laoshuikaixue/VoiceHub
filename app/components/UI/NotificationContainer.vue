<template>
  <div class="notification-container">
    <TransitionGroup class="notification-list" name="notification-list" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="{
          success: notification.type === 'success',
          error: notification.type === 'error',
          info: notification.type === 'info'
        }"
        class="notification-item"
      >
        <div class="notification-icon">
          <Icon v-if="notification.type === 'success'" :size="16" name="success" />
          <Icon v-else-if="notification.type === 'error'" :size="16" name="error" />
          <Icon v-else :size="16" name="info" />
        </div>
        <div class="notification-content">
          {{ notification.message }}
        </div>
        <button class="notification-close" @click="removeToast(notification.id)">
          <Icon :size="16" name="close" />
        </button>

        <!-- 进度条 -->
        <div class="notification-progress">
          <div
            :style="{
              animationDuration: `${notification.duration}ms`
            }"
            class="notification-progress-bar"
          />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { useToast } from '~/composables/useToast'

// 使用 useToast 的共享状态
const { toasts, removeToast } = useToast()
const notifications = toasts

// 全局挂载通知函数 (兼容旧代码)
onMounted(() => {
  // 兼容旧的全局调用方式
  window.$showNotification = (message, type = 'info', autoClose = true, duration = 3000) => {
    const { showToast } = useToast()
    showToast(message, type, duration)
  }

  window.$clearNotifications = () => {
    notifications.value = []
  }
})
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 99999;
  pointer-events: none;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  background: #21242d;
  color: #ffffff;
  max-width: 400px;
  min-width: 300px;
  font-family: 'MiSans', sans-serif;
  overflow: hidden;
  position: relative;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.notification-item.success {
  border-left: 4px solid #10b981;
}

.notification-item.error {
  border-left: 4px solid #ef4444;
}

.notification-item.info {
  border-left: 4px solid #0b5afe;
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
  flex-shrink: 0;
}

.success .notification-icon {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.error .notification-icon {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.info .notification-icon {
  background: rgba(11, 90, 254, 0.2);
  color: #0b5afe;
}

.notification-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.notification-close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
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
  flex-shrink: 0;
}

.notification-close:hover {
  color: #ffffff;
}

/* 进度条 */
.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.notification-progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  animation: progress-shrink linear forwards;
}

.success .notification-progress-bar {
  background-color: #10b981;
}

.error .notification-progress-bar {
  background-color: #ef4444;
}

.info .notification-progress-bar {
  background-color: #0b5afe;
}

@keyframes progress-shrink {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

/* 列表动画 */
.notification-list-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.notification-list-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.notification-list-enter-to {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.notification-list-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

/* 移动动画 - 当通知被移除时，其他通知向上移动 */
.notification-list-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }

  .notification-item {
    max-width: none;
    min-width: auto;
  }
}

/* 悬停效果 */
.notification-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  transition: all 0.2s ease;
}

/* 暗色主题优化 */
@media (prefers-color-scheme: dark) {
  .notification-item {
    background: rgba(33, 36, 45, 0.95);
    border-color: rgba(255, 255, 255, 0.15);
  }
}
</style>
