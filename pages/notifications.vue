<template>
  <div class="notifications-page">
    <div class="page-header">
      <h1>通知中心</h1>
      <NuxtLink to="/" class="back-link">返回首页</NuxtLink>
    </div>
    
    <div class="page-content">
      <div v-if="!isAuthenticated" class="login-required">
        <p>需要登录才能查看通知</p>
        <NuxtLink to="/login" class="login-button">去登录</NuxtLink>
      </div>
      
      <template v-else>
        <div class="page-actions">
          <NuxtLink to="/notification-settings" class="settings-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            通知设置
          </NuxtLink>
        </div>
        
        <div class="notifications-content">
          <div class="notifications-list-container">
            <div class="list-header">
              <div class="list-title">
                <h2>通知列表</h2>
                <span v-if="hasUnread" class="unread-badge">{{ unreadCount }} 条未读</span>
              </div>
              <button @click="refreshNotifications" class="refresh-button" :disabled="loading">
                <span class="refresh-icon" :class="{ 'spinning': loading }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                  </svg>
                </span>
                刷新
              </button>
            </div>
            
            <div v-if="loading" class="loading">加载中...</div>
            <div v-else-if="notifications.length === 0" class="empty-state">
              暂无通知
            </div>
            <div v-else class="notifications-list">
              <div 
                v-for="notification in notifications" 
                :key="notification.id"
                class="notification-card"
                :class="{ 'unread': !notification.read }"
              >
                <div class="notification-header">
                  <div class="notification-type">
                    <span v-if="notification.type === 'SONG_SELECTED'">🎯 歌曲被选中</span>
                    <span v-else-if="notification.type === 'SONG_PLAYED'">🎵 歌曲已播放</span>
                    <span v-else-if="notification.type === 'SONG_VOTED'">👍 歌曲获得投票</span>
                    <span v-else>📢 系统通知</span>
                  </div>
                  <div class="notification-time">{{ formatTime(notification.createdAt) }}</div>
                </div>
                <div class="notification-body">
                  <h3 class="notification-title">
                    <span v-if="notification.type === 'SONG_SELECTED'">歌曲已选中</span>
                    <span v-else-if="notification.type === 'SONG_PLAYED'">歌曲已播放</span>
                    <span v-else-if="notification.type === 'SONG_VOTED'">收到新投票</span>
                    <span v-else>系统通知</span>
                  </h3>
                  <p class="notification-content">{{ notification.message }}</p>
                </div>
                <div class="notification-actions">
                  <button 
                    v-if="!notification.read" 
                    @click="markAsRead(notification.id)"
                    class="action-button mark-read"
                  >
                    标记为已读
                  </button>
                  <button 
                    @click="deleteNotification(notification.id)"
                    class="action-button delete"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
            
            <div v-if="notifications.length > 0" class="list-actions">
              <button 
                v-if="hasUnread"
                @click="markAllAsRead" 
                class="action-button mark-all-read"
              >
                全部标记为已读
              </button>
              <button 
                @click="clearAllNotifications" 
                class="action-button clear-all"
              >
                清空所有通知
              </button>
            </div>
          </div>
        </div>
        

      </template>
    </div>
    
    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :title="confirmDialogConfig.title"
      :message="confirmDialogConfig.message"
      :type="confirmDialogConfig.type"
      :confirm-text="confirmDialogConfig.confirmText"
      :cancel-text="confirmDialogConfig.cancelText"
      @confirm="handleConfirmAction"
      @cancel="handleCancelAction"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNotifications } from '~/composables/useNotifications'
import { useAuth } from '~/composables/useAuth'
import { useSiteConfig } from '~/composables/useSiteConfig'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

const { siteTitle, initSiteConfig } = useSiteConfig()


// 中间件验证
// definePageMeta({
//   middleware: ['auth']
// })


const notificationsService = useNotifications()
const loading = computed(() => notificationsService.loading.value)
const notifications = computed(() => notificationsService.notifications.value || [])
const unreadCount = computed(() => notificationsService.unreadCount.value || 0)
const hasUnread = computed(() => unreadCount.value > 0)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref({
  title: '',
  message: '',
  type: 'warning',
  confirmText: '确认',
  cancelText: '取消'
})
const pendingAction = ref(null) // 存储待确认的操作
const pendingId = ref(null) // 存储待操作的通知ID

// 检查登录状态
const auth = useAuth()
const isAuthenticated = computed(() => auth.isAuthenticated.value)

// 初始化
onMounted(async () => {
  // 初始化站点配置
  await initSiteConfig()
  
  // 设置页面标题
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `通知 | ${siteTitle.value}`
  }
  
  if (isAuthenticated.value) {
    await fetchNotifications()
  }
})

// 获取通知
const fetchNotifications = async () => {
  await notificationsService.fetchNotifications()
}

// 刷新通知
const refreshNotifications = async () => {
  await fetchNotifications()
}

// 标记为已读
const markAsRead = async (id) => {
  await notificationsService.markAsRead(id)
}

// 标记所有为已读
const markAllAsRead = async () => {
  await notificationsService.markAllAsRead()
}

// 删除通知
const deleteNotification = async (id) => {
  pendingAction.value = 'delete'
  pendingId.value = id
  confirmDialogConfig.value = {
    title: '删除通知',
    message: '确定要删除此通知吗？',
    type: 'warning',
    confirmText: '删除',
    cancelText: '取消'
  }
  showConfirmDialog.value = true
}

// 清空所有通知
const clearAllNotifications = async () => {
  pendingAction.value = 'clearAll'
  confirmDialogConfig.value = {
    title: '清空所有通知',
    message: '确定要清空所有通知吗？此操作不可撤销。',
    type: 'danger',
    confirmText: '清空',
    cancelText: '取消'
  }
  showConfirmDialog.value = true
}

// 处理确认操作
const handleConfirmAction = async () => {
  showConfirmDialog.value = false
  
  if (pendingAction.value === 'delete') {
    await notificationsService.deleteNotification(pendingId.value)
  } else if (pendingAction.value === 'clearAll') {
    await notificationsService.clearAllNotifications()
  }
  
  // 重置状态
  pendingAction.value = null
  pendingId.value = null
}

// 处理取消操作
const handleCancelAction = () => {
  showConfirmDialog.value = false
  pendingAction.value = null
  pendingId.value = null
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
.notifications-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  color: var(--light);
}

.back-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.settings-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-button:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.settings-button svg {
  flex-shrink: 0;
}

.loading,
.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--gray);
  font-size: 16px;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.notification-card {
  background-color: rgba(30, 41, 59, 0.6);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 15px;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.notification-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.notification-card.unread {
  border-left: 4px solid var(--primary);
  background-color: rgba(99, 102, 241, 0.1);
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.notification-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray);
}

.notification-time {
  font-size: 12px;
  color: var(--gray-light);
}

.notification-body {
  margin-bottom: 15px;
}

.notification-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 5px 0;
  color: var(--light);
}

.notification-content {
  font-size: 14px;
  color: var(--light);
  margin: 0;
  line-height: 1.5;
  opacity: 0.9;
}

.notification-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.action-button {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
}

.action-button.mark-read {
  border: 1px solid var(--primary);
  color: var(--primary);
}

.action-button.mark-read:hover {
  background-color: rgba(99, 102, 241, 0.1);
}

.action-button.delete {
  border: 1px solid var(--danger);
  color: var(--danger);
}

.action-button.delete:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.list-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-button.mark-all-read {
  border: 1px solid var(--primary);
  color: var(--primary);
}

.action-button.mark-all-read:hover {
  background-color: rgba(99, 102, 241, 0.1);
}

.action-button.clear-all {
  border: 1px solid var(--danger);
  color: var(--danger);
}

.action-button.clear-all:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

/* 登录提示 */
.login-required {
  text-align: center;
  padding: 40px 20px;
  background-color: rgba(30, 41, 59, 0.4);
  border-radius: 8px;
  margin: 20px 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
}

.login-required p {
  margin-bottom: 20px;
  font-size: 16px;
  color: var(--light);
}

.login-button {
  display: inline-block;
  padding: 10px 24px;
  background-color: var(--primary);
  color: white;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.login-button:hover {
  background-color: var(--primary-dark);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.list-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.list-title h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: var(--light);
}

.unread-badge {
  background-color: var(--primary);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  margin-left: 10px;
  display: inline-block;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background-color: var(--primary);
  color: white;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s ease;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.refresh-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
}

.refresh-button:disabled {
  background-color: var(--gray-dark);
  cursor: not-allowed;
  opacity: 0.7;
}

.refresh-icon {
  display: inline-flex;
  transition: transform 0.5s ease;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .notifications-page {
    padding: 15px;
  }
  
  .page-header h1 {
    font-size: 1.5rem;
  }
  
  .tabs button {
    padding: 8px 15px;
    font-size: 14px;
  }

  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .list-title h2 {
    font-size: 1rem;
  }

  .refresh-button {
    width: 100%;
    justify-content: center;
  }
}
</style>