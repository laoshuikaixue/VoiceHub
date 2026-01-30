<template>
  <transition name="dialog-overlay">
    <div v-if="show" class="dialog-overlay" @click="handleOverlayClick">
      <transition name="dialog">
        <div v-if="show" class="dialog" @click.stop>
          <div class="dialog-header">
            <div :class="type" class="dialog-icon">
              <Icon
                  v-if="type === 'warning'"
                  :size="20"
                  name="warning"
              />
              <Icon
                  v-else-if="type === 'danger'"
                  :size="20"
                  name="warning"
              />
              <Icon
                  v-else-if="type === 'info'"
                  :size="20"
                  name="info"
              />
              <Icon
                  v-else
                  :size="20"
                  name="info"
              />
            </div>
            <h3 class="dialog-title">{{ title }}</h3>
          </div>

          <div class="dialog-content">
            <p>{{ message }}</p>
          </div>

          <div class="dialog-actions">
            <button
                :disabled="loading"
                class="dialog-btn dialog-btn-cancel"
                @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
                :class="type"
                :disabled="loading"
                class="dialog-btn dialog-btn-confirm"
                @click="handleConfirm"
            >
              <span v-if="loading" class="loading-spinner"></span>
              {{ confirmText }}
            </button>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import Icon from './Icon.vue'


const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'warning', // 'warning', 'danger', 'info'
    validator: value => ['warning', 'danger', 'info'].includes(value)
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  loading: {
    type: Boolean,
    default: false
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['confirm', 'cancel', 'close'])

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !props.loading) {
    emit('cancel')
    emit('close')
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.dialog {
  background: #21242D;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-header {
  display: flex;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  font-size: 20px;
  font-weight: bold;
}

.dialog-icon.warning {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.dialog-icon.danger {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.dialog-icon.info {
  background: rgba(11, 90, 254, 0.2);
  color: #0B5AFE;
}

.dialog-title {
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  font-family: 'MiSans', sans-serif;
}

.dialog-content {
  padding: 16px 24px 24px;
}

.dialog-content p {
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  font-family: 'MiSans', sans-serif;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  padding: 0 24px 24px;
  justify-content: flex-end;
}

.dialog-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'MiSans', sans-serif;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 80px;
  justify-content: center;
}

.dialog-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.dialog-btn-cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.dialog-btn-confirm {
  color: white;
  border: 1px solid transparent;
}

.dialog-btn-confirm.warning {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.dialog-btn-confirm.warning:hover:not(:disabled) {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.dialog-btn-confirm.danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.dialog-btn-confirm.danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
}

.dialog-btn-confirm.info {
  background: linear-gradient(135deg, #0B5AFE, #0847d1);
}

.dialog-btn-confirm.info:hover:not(:disabled) {
  background: linear-gradient(135deg, #0847d1, #0639b8);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 动画效果 */
.dialog-overlay-enter-active {
  animation: overlay-in 0.3s ease-out;
}

.dialog-overlay-leave-active {
  animation: overlay-out 0.2s ease-in;
}

.dialog-enter-active {
  animation: dialog-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.dialog-leave-active {
  animation: dialog-out 0.2s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

@keyframes overlay-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes overlay-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes dialog-in {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes dialog-out {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  100% {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
}
</style>