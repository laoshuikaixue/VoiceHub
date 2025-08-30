<template>
  <transition name="announcement-overlay">
    <div v-if="show" class="announcement-overlay" @click="handleOverlayClick">
      <transition name="announcement">
        <div 
          v-if="show" 
          class="announcement-dialog" 
          :style="dialogStyles"
          @click.stop
        >
          <div class="announcement-header">
            <div class="announcement-icon">
              <Icon name="megaphone" :size="24" />
            </div>
            <h3 class="announcement-title">{{ announcement.title }}</h3>
            <button 
              class="announcement-close" 
              @click="handleClose"
              :style="{ color: announcement.textColor }"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>
          
          <div class="announcement-content">
            <div class="announcement-text" v-html="formattedContent"></div>
            
            <div class="announcement-meta">
              <span class="announcement-type" :class="announcement.type.toLowerCase()">
                {{ announcement.type === 'INTERNAL' ? '站内公告' : '站外公告' }}
              </span>
              <span class="announcement-date">
                {{ formatDate(announcement.createdAt) }}
              </span>
            </div>
          </div>
          
          <div class="announcement-actions">
            <button 
              class="announcement-btn" 
              :style="buttonStyles"
              @click="handleConfirm"
            >
              我知道了
            </button>
            <button 
              v-if="!hideRememberOption"
              class="announcement-btn-secondary" 
              @click="handleRemember"
            >
              今日不再显示
            </button>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  announcement: {
    type: Object,
    required: true
  },
  show: {
    type: Boolean,
    default: false
  },
  hideRememberOption: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm', 'remember'])

// 计算样式
const dialogStyles = computed(() => ({
  backgroundColor: props.announcement.backgroundColor || '#1a1a1a',
  color: props.announcement.textColor || '#ffffff',
  borderColor: props.announcement.buttonColor || '#4F46E5'
}))

const buttonStyles = computed(() => ({
  backgroundColor: props.announcement.buttonColor || '#4F46E5',
  color: '#ffffff'
}))

// 格式化内容（支持简单的HTML）
const formattedContent = computed(() => {
  if (!props.announcement.content) return ''
  
  // 简单的文本格式化
  return props.announcement.content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
})

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 事件处理
const handleOverlayClick = () => {
  // 点击遮罩层不关闭，需要明确点击关闭按钮
}

const handleClose = () => {
  emit('close')
}

const handleConfirm = async () => {
  // 记录浏览量
  try {
    await $fetch(`/api/announcements/${props.announcement.id}/view`, {
      method: 'POST'
    })
  } catch (error) {
    console.warn('记录浏览量失败:', error)
  }
  
  emit('confirm')
}

const handleRemember = () => {
  // 记录到本地存储，今日不再显示
  const today = new Date().toDateString()
  const rememberKey = `announcement_remember_${props.announcement.id}_${today}`
  localStorage.setItem(rememberKey, 'true')
  
  emit('remember')
}

// 键盘事件处理
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.announcement-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.announcement-dialog {
  background: #1a1a1a;
  border-radius: 16px;
  border: 2px solid #4F46E5;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.announcement-header {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.announcement-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.announcement-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.announcement-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.announcement-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.announcement-content {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.announcement-text {
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 16px;
}

.announcement-text :deep(strong) {
  font-weight: 600;
  color: #4F46E5;
}

.announcement-text :deep(em) {
  font-style: italic;
  color: #9CA3AF;
}

.announcement-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #9CA3AF;
}

.announcement-type {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.announcement-type.internal {
  background: rgba(79, 70, 229, 0.2);
  color: #8B5CF6;
}

.announcement-type.external {
  background: rgba(16, 185, 129, 0.2);
  color: #10B981;
}

.announcement-actions {
  padding: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.announcement-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #4F46E5;
  color: white;
}

.announcement-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.announcement-btn-secondary {
  padding: 12px 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: #9CA3AF;
}

.announcement-btn-secondary:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: #ffffff;
}

/* 动画效果 */
.announcement-overlay-enter-active,
.announcement-overlay-leave-active {
  transition: all 0.3s ease;
}

.announcement-overlay-enter-from,
.announcement-overlay-leave-to {
  opacity: 0;
}

.announcement-enter-active,
.announcement-leave-active {
  transition: all 0.3s ease;
}

.announcement-enter-from,
.announcement-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .announcement-overlay {
    padding: 12px;
  }
  
  .announcement-dialog {
    max-width: 100%;
    max-height: 90vh;
  }
  
  .announcement-header {
    padding: 20px;
  }
  
  .announcement-title {
    font-size: 18px;
  }
  
  .announcement-content {
    padding: 20px;
  }
  
  .announcement-actions {
    padding: 20px;
    flex-direction: column;
  }
  
  .announcement-btn,
  .announcement-btn-secondary {
    width: 100%;
  }
}
</style>
