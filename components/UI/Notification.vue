<template>
  <transition name="notification">
    <div 
      v-if="show" 
      class="notification"
      :class="{
        'success': type === 'success',
        'error': type === 'error',
        'info': type === 'info'
      }"
    >
      <div class="notification-icon">
        <span v-if="type === 'success'">✓</span>
        <span v-else-if="type === 'error'">✕</span>
        <span v-else>ℹ</span>
      </div>
      <div class="notification-content">
        {{ message }}
      </div>
      <button class="notification-close" @click="$emit('close')">×</button>
    </div>
  </transition>
</template>

<script setup>
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
    validator: value => ['success', 'error', 'info'].includes(value)
  }
})

defineEmits(['close'])
</script>

<style scoped>
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: #21242D;
  color: #FFFFFF;
  max-width: 400px;
  min-width: 300px;
  font-family: 'MiSans', sans-serif;
}

.notification.success {
  border-left: 4px solid #10b981;
}

.notification.error {
  border-left: 4px solid #ef4444;
}

.notification.info {
  border-left: 4px solid #0B5AFE;
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 12px;
  font-weight: bold;
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
  color: #0B5AFE;
}

.notification-content {
  flex: 1;
}

.notification-close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  padding: 0;
}

/* 动画效果 */
.notification-enter-active, .notification-leave-active {
  transition: all 0.3s ease;
}
.notification-enter-from, .notification-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style> 