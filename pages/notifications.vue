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
        <div class="tabs">
          <button 
            :class="{ 'active': activeTab === 'list' }" 
            @click="activeTab = 'list'"
          >
            通知列表
          </button>
          <button 
            :class="{ 'active': activeTab === 'settings' }" 
            @click="activeTab = 'settings'"
          >
            通知设置
          </button>
        </div>
        
        <div class="tab-content">
          <div v-if="activeTab === 'list'" class="notifications-list-container">
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
                  <h3 class="notification-title">{{ notification.title }}</h3>
                  <p class="notification-content">{{ notification.content }}</p>
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
          
          <div v-else-if="activeTab === 'settings'" class="settings-container">
            <NotificationSettings />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNotifications } from '~/composables/useNotifications'
import { useAuth } from '~/composables/useAuth'
import NotificationSettings from '~/components/Notifications/NotificationSettings.vue'

// 中间件验证
// definePageMeta({
//   middleware: ['auth']
// })

const activeTab = ref('list')
const notificationsService = useNotifications()
const loading = computed(() => notificationsService.loading.value)
const notifications = computed(() => notificationsService.notifications.value || [])
const hasUnread = computed(() => {
  return notifications.value.some(notification => !notification.read)
})

// 检查登录状态
const auth = useAuth()
const isAuthenticated = computed(() => auth.isAuthenticated.value)

// 初始化
onMounted(async () => {
  if (isAuthenticated.value) {
    await fetchNotifications()
  }
})

// 获取通知
const fetchNotifications = async () => {
  await notificationsService.fetchNotifications()
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
  if (confirm('确定要删除此通知吗？')) {
    await notificationsService.deleteNotification(id)
  }
}

// 清空所有通知
const clearAllNotifications = async () => {
  if (confirm('确定要清空所有通知吗？此操作不可撤销。')) {
    await notificationsService.clearAllNotifications()
  }
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

.tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
}

.tabs button {
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--gray);
}

.tabs button:hover {
  color: var(--primary);
}

.tabs button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
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
}
</style> 