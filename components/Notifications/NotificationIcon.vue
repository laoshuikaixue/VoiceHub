<template>
  <div class="notification-icon-wrapper">
    <button
      @click="toggleNotifications"
      class="notification-icon"
      :class="{ 'has-notifications': unreadCount > 0 }"
    >
      <Icon name="bell" :size="20" color="#cccccc" class="icon" />
      <span v-if="unreadCount > 0" class="notification-badge"></span>
    </button>
    
    <div v-if="showNotifications" class="notifications-dropdown">
      <div class="notifications-header">
        <h3>通知</h3>
        <div class="notifications-actions">
          <button 
            v-if="hasUnread"
            @click="markAllAsRead" 
            class="action-button"
            :disabled="loading"
          >
            全部已读
          </button>
          <button 
            @click="openSettings" 
            class="action-button"
            :disabled="loading"
          >
            设置
          </button>
        </div>
      </div>
      
      <div v-if="loading" class="notifications-loading">
        加载中...
      </div>
      
      <div v-else-if="notifications.length === 0" class="notifications-empty">
        暂无通知
      </div>
      
      <div v-else class="notifications-list">
        <div 
          v-for="notification in notifications" 
          :key="notification.id"
          class="notification-item"
          :class="{ 'unread': !notification.read }"
          @click="viewNotification(notification)"
        >
          <div class="notification-icon-type">
            <Icon v-if="notification.type === 'SONG_SELECTED'" name="target" :size="16" color="#4f46e5" />
            <Icon v-else-if="notification.type === 'SONG_PLAYED'" name="music" :size="16" color="#10b981" />
            <Icon v-else-if="notification.type === 'SONG_VOTED'" name="thumbs-up" :size="16" color="#f59e0b" />
            <Icon v-else name="speaker" :size="16" color="#6b7280" />
          </div>
          <div class="notification-content">
            <div class="notification-title">
              <span v-if="notification.type === 'SONG_SELECTED'">歌曲已选中</span>
              <span v-else-if="notification.type === 'SONG_PLAYED'">歌曲已播放</span>
              <span v-else-if="notification.type === 'SONG_VOTED'">收到新投票</span>
              <span v-else>系统通知</span>
            </div>
            <div class="notification-text">{{ notification.message }}</div>
            <div class="notification-time">{{ formatTime(notification.createdAt) }}</div>
          </div>
          <button 
            @click.stop="deleteNotification(notification.id)" 
            class="notification-delete"
            title="删除"
          >
            ×
          </button>
        </div>
      </div>
      
      <div class="notifications-footer">
        <button 
          v-if="notifications.length > 0"
          @click="clearAllNotifications" 
          class="clear-all-button"
        >
          清空所有通知
        </button>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :title="confirmDialogConfig.title"
      :message="confirmDialogConfig.message"
      :type="confirmDialogConfig.type"
      :confirm-text="confirmDialogConfig.confirmText"
      :cancel-text="confirmDialogConfig.cancelText"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNotifications } from '~/composables/useNotifications'
import Icon from '~/components/UI/Icon.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

const props = defineProps({
  autoRefresh: {
    type: Boolean,
    default: true
  },
  refreshInterval: {
    type: Number,
    default: 60000 // 默认1分钟刷新一次
  }
})

const emit = defineEmits(['open-settings'])

const notificationsService = useNotifications()
const showNotifications = ref(false)
const loading = computed(() => notificationsService.loading.value)
const notifications = computed(() => notificationsService.notifications.value || [])
const unreadCount = computed(() => notificationsService.unreadCount.value || 0)
const hasUnread = computed(() => unreadCount.value > 0)
const displayCount = computed(() => unreadCount.value > 99 ? '99+' : unreadCount.value)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref({
  title: '确认删除',
  message: '确定要删除此通知吗？',
  type: 'warning',
  confirmText: '删除',
  cancelText: '取消'
})
const pendingDeleteId = ref(null)

let refreshTimer = null

// 初始化
onMounted(async () => {
  await fetchNotifications()
  
  if (props.autoRefresh) {
    startAutoRefresh()
  }
  
  // 添加点击外部关闭下拉菜单
  document.addEventListener('click', handleOutsideClick)
})

// 清理
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  document.removeEventListener('click', handleOutsideClick)
})

// 获取通知
const fetchNotifications = async () => {
  await notificationsService.fetchNotifications()
}

// 开始自动刷新
const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    fetchNotifications()
  }, props.refreshInterval)
}

// 切换通知面板
const toggleNotifications = async (event) => {
  event.stopPropagation()
  showNotifications.value = !showNotifications.value
  
  if (showNotifications.value) {
    await fetchNotifications()
  }
}

// 处理外部点击
const handleOutsideClick = (event) => {
  const dropdown = document.querySelector('.notifications-dropdown')
  const icon = document.querySelector('.notification-icon')
  
  if (
    showNotifications.value && 
    dropdown && 
    !dropdown.contains(event.target) && 
    icon && 
    !icon.contains(event.target)
  ) {
    showNotifications.value = false
  }
}

// 查看通知
const viewNotification = async (notification) => {
  if (!notification.read) {
    await notificationsService.markAsRead(notification.id)
  }
}

// 删除通知
const deleteNotification = async (id) => {
  pendingDeleteId.value = id
  showConfirmDialog.value = true
}

// 确认删除
const handleConfirmDelete = async () => {
  if (pendingDeleteId.value) {
    if (pendingDeleteId.value === 'all') {
      // 清空所有通知
      await notificationsService.clearAllNotifications()
    } else {
      // 删除单个通知
      await notificationsService.deleteNotification(pendingDeleteId.value)
    }
    pendingDeleteId.value = null
  }
  showConfirmDialog.value = false
}

// 取消删除
const handleCancelDelete = () => {
  pendingDeleteId.value = null
  showConfirmDialog.value = false
}

// 标记所有为已读
const markAllAsRead = async () => {
  await notificationsService.markAllAsRead()
}

// 清空所有通知
const clearAllNotifications = async () => {
  confirmDialogConfig.value = {
    title: '确认清空',
    message: '确定要清空所有通知吗？',
    type: 'warning',
    confirmText: '清空',
    cancelText: '取消'
  }
  pendingDeleteId.value = 'all'
  showConfirmDialog.value = true
}

// 打开设置
const openSettings = () => {
  emit('open-settings')
  showNotifications.value = false
}

// 格式化时间
const formatTime = (timeString) => {
  const date = new Date(timeString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // 小于1分钟
  if (diff < 60000) {
    return '刚刚'
  }
  
  // 小于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  }
  
  // 小于24小时
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  }
  
  // 小于30天
  if (diff < 2592000000) {
    return `${Math.floor(diff / 86400000)}天前`
  }
  
  // 大于30天，显示具体日期
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}
</script>

<style scoped>
.notification-icon-wrapper {
  position: relative;
}

.notification-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.notification-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}

.notification-icon.has-notifications .icon {
  animation: pulse 2s infinite;
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #ff4444;
  border: 2px solid #121318;
  display: block;
  z-index: 10;
  box-shadow: 0 0 0 1px rgba(255, 68, 68, 0.3);
}

.notifications-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 320px;
  max-height: 480px;
  background-color: rgba(30, 41, 59, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--light);
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.notifications-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(15, 23, 42, 0.5);
}

.notifications-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--light);
}

.notifications-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  background: transparent;
  border: none;
  color: var(--danger);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.action-button:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.action-button:disabled {
  color: var(--gray);
  cursor: not-allowed;
}

.notifications-loading,
.notifications-empty {
  padding: 24px;
  text-align: center;
  color: var(--gray);
  font-size: 14px;
}

.notifications-list {
  flex: 1;
  overflow-y: auto;
  max-height: 360px;
}

.notification-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.notification-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.notification-item.unread {
  background-color: rgba(239, 68, 68, 0.1);
}

.notification-item.unread:hover {
  background-color: rgba(239, 68, 68, 0.15);
}

.notification-icon-type {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--light);
}

.notification-text {
  font-size: 13px;
  color: var(--gray-light);
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-time {
  font-size: 11px;
  color: var(--gray);
}

.notification-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray);
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.notification-item:hover .notification-delete {
  opacity: 1;
}

.notification-delete:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--light);
}

.notifications-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.clear-all-button {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--gray-light);
  font-size: 12px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-all-button:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>