<template>
  <div class="notification-container" aria-live="polite">
    <TransitionGroup class="notification-list" name="notification-list" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification-item', notification.type]"
        role="alert"
      >
        <div class="notification-icon-badge">
          <Icon v-if="notification.type === 'success'" :size="15" name="success" />
          <Icon v-else-if="notification.type === 'error'" :size="15" name="error" />
          <Icon v-else-if="notification.type === 'warning'" :size="15" name="warning" />
          <Icon v-else :size="15" name="info" />
        </div>
        <div class="notification-content">
          {{ notification.message }}
        </div>
        <button
          class="notification-close"
          type="button"
          aria-label="关闭通知"
          @click="removeToast(notification.id)"
        >
          <Icon :size="13" name="close" />
        </button>

        <div v-if="notification.duration > 0" class="notification-progress">
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
import { onMounted } from 'vue'
import Icon from './Icon.vue'
import { useToast } from '~/composables/useToast'

const { toasts, removeToast } = useToast()
const notifications = toasts

onMounted(() => {
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
  top: max(16px, env(safe-area-inset-top, 16px));
  left: 0;
  right: 0;
  z-index: 99999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px;
  box-sizing: border-box;
}

.notification-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.notification-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  position: relative;
  max-width: min(480px, calc(100vw - 32px));
  min-width: 0;
  width: fit-content;
  padding: 10px 14px 10px 12px;
  border-radius: 14px;
  background: var(--panel-bg);
  color: var(--text-primary);
  font-family: 'MiSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13.5px;
  line-height: 1.45;
  box-shadow:
    0 4px 6px -1px var(--mask-10, rgba(0, 0, 0, 0.05)),
    0 10px 25px -3px var(--mask-30, rgba(0, 0, 0, 0.12)),
    0 0 0 1px var(--border-color);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  overflow: hidden;
  box-sizing: border-box;
  will-change: transform, opacity;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.notification-item:hover {
  box-shadow:
    0 6px 10px -1px var(--mask-20, rgba(0, 0, 0, 0.08)),
    0 16px 32px -4px var(--mask-40, rgba(0, 0, 0, 0.16)),
    0 0 0 1px var(--border-color);
}

.notification-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  margin-right: 10px;
  flex-shrink: 0;
}

.success .notification-icon-badge {
  background: var(--success-light);
  color: var(--color-success);
  box-shadow: 0 0 10px var(--success-glow);
}

.error .notification-icon-badge {
  background: var(--error-light);
  color: var(--color-error);
  box-shadow: 0 0 10px var(--error-glow);
}

.warning .notification-icon-badge {
  background: var(--warning-light);
  color: var(--color-warning);
  box-shadow: 0 0 10px var(--warning-glow);
}

.info .notification-icon-badge {
  background: var(--primary-light);
  color: var(--primary);
  box-shadow: 0 0 10px var(--primary-glow);
}

.notification-content {
  flex: 1;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-word;
  padding-right: 6px;
}

.notification-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-left: 6px;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.notification-close:hover {
  color: var(--text-primary);
  background: var(--overlay-10);
}

.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--overlay-5);
}

.notification-progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  animation: notification-progress-shrink linear forwards;
}

.success .notification-progress-bar {
  background: var(--color-success);
}

.error .notification-progress-bar {
  background: var(--color-error);
}

.warning .notification-progress-bar {
  background: var(--color-warning);
}

.info .notification-progress-bar {
  background: var(--primary);
}

@keyframes notification-progress-shrink {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

.notification-list-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.notification-list-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.94);
}

.notification-list-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.notification-list-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.96);
}

.notification-list-move {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (max-width: 640px) {
  .notification-container {
    top: max(14px, env(safe-area-inset-top, 14px));
    padding: 0 16px;
  }

  .notification-list {
    gap: 8px;
  }

  .notification-item {
    max-width: calc(100vw - 32px);
    min-width: 0;
    width: fit-content;
    padding: 9px 13px 9px 10px;
    border-radius: 12px;
    font-size: 13px;
  }

  .notification-icon-badge {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    margin-right: 8px;
  }
}
</style>
