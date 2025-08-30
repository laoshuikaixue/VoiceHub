<template>
  <div class="demo-page">
    <div class="demo-header">
      <h1>公告功能演示</h1>
      <p>测试站内公告和站外公告的显示效果</p>
    </div>

    <div class="demo-content">
      <div class="demo-section">
        <h2>当前用户状态</h2>
        <div class="user-status">
          <p><strong>登录状态：</strong>{{ user ? '已登录' : '未登录' }}</p>
          <p v-if="user"><strong>用户角色：</strong>{{ user.role }}</p>
          <p v-if="user"><strong>用户名：</strong>{{ user.name || user.username }}</p>
        </div>
      </div>

      <div class="demo-section">
        <h2>可见公告</h2>
        <div class="announcements-list">
          <div
            v-for="announcement in announcements"
            :key="announcement.id"
            class="announcement-card"
            :class="announcement.type.toLowerCase()"
            @click="showAnnouncement(announcement)"
          >
            <div class="announcement-header">
              <h3>{{ announcement.title }}</h3>
              <span class="announcement-type">
                {{ announcement.type === 'INTERNAL' ? '站内' : '站外' }}
              </span>
            </div>
            <p>{{ announcement.content.substring(0, 100) }}...</p>
            <div class="announcement-meta">
              <span>优先级: {{ ['普通', '重要', '紧急'][announcement.priority] }}</span>
              <span>浏览: {{ announcement.viewCount }}</span>
            </div>
          </div>
          
          <div v-if="announcements.length === 0" class="no-announcements">
            <p>当前没有可显示的公告</p>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h2>测试操作</h2>
        <div class="demo-actions">
          <button @click="refreshAnnouncements" class="demo-btn" :disabled="isLoading">
            {{ isLoading ? '加载中...' : '刷新公告' }}
          </button>
          <button @click="showFirstAnnouncement" class="demo-btn">
            显示第一个公告
          </button>
          <button @click="clearRememberRecords" class="demo-btn">
            清除记住记录
          </button>
          <NuxtLink v-if="canManage" to="/admin/announcements" class="demo-btn primary">
            管理公告
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 公告弹窗 -->
    <AnnouncementDialog
      v-if="showDialog && selectedAnnouncement"
      :announcement="selectedAnnouncement"
      :show="showDialog"
      @close="showDialog = false"
      @confirm="handleConfirm"
      @remember="handleRemember"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { usePermissions } from '~/composables/usePermissions'
import { useAnnouncements } from '~/composables/useAnnouncements'
import AnnouncementDialog from '~/components/UI/AnnouncementDialog.vue'

const { user } = useAuth()
const { hasRole } = usePermissions()
const { 
  announcements,
  isLoading,
  fetchAnnouncements,
  showFirstValidAnnouncement,
  markAsViewed,
  rememberAnnouncement,
  cleanupExpiredRememberRecords
} = useAnnouncements()

const showDialog = ref(false)
const selectedAnnouncement = ref(null)

const canManage = computed(() => hasRole(['ADMIN', 'SUPER_ADMIN']))

const refreshAnnouncements = async () => {
  await fetchAnnouncements()
}

const showFirstAnnouncement = async () => {
  const shown = await showFirstValidAnnouncement()
  if (!shown) {
    if (window.$showNotification) {
      window.$showNotification('没有可显示的公告', 'info')
    }
  }
}

const showAnnouncement = (announcement) => {
  selectedAnnouncement.value = announcement
  showDialog.value = true
}

const handleConfirm = async () => {
  if (selectedAnnouncement.value) {
    await markAsViewed(selectedAnnouncement.value.id)
  }
  showDialog.value = false
}

const handleRemember = () => {
  if (selectedAnnouncement.value) {
    rememberAnnouncement(selectedAnnouncement.value.id)
  }
  showDialog.value = false
}

const clearRememberRecords = () => {
  cleanupExpiredRememberRecords()
  // 清除所有记住记录
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('announcement_remember_')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
  
  if (window.$showNotification) {
    window.$showNotification('记住记录已清除', 'success')
  }
}

onMounted(() => {
  refreshAnnouncements()
})

// 页面标题
useHead({
  title: '公告功能演示 - VoiceHub'
})
</script>

<style scoped>
.demo-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  padding: 40px 20px;
}

.demo-header {
  text-align: center;
  margin-bottom: 40px;
}

.demo-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.demo-header p {
  font-size: 16px;
  color: #888;
  margin: 0;
}

.demo-content {
  max-width: 1000px;
  margin: 0 auto;
}

.demo-section {
  background: #111111;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #1f1f1f;
}

.demo-section h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #ffffff;
}

.user-status {
  background: #1a1a1a;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #333;
}

.user-status p {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.user-status p:last-child {
  margin-bottom: 0;
}

.announcements-list {
  display: grid;
  gap: 16px;
}

.announcement-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.announcement-card:hover {
  border-color: #4F46E5;
  transform: translateY(-2px);
}

.announcement-card.internal {
  border-left: 4px solid #8B5CF6;
}

.announcement-card.external {
  border-left: 4px solid #10B981;
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.announcement-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #ffffff;
}

.announcement-type {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(79, 70, 229, 0.2);
  color: #8B5CF6;
}

.announcement-card.external .announcement-type {
  background: rgba(16, 185, 129, 0.2);
  color: #10B981;
}

.announcement-card p {
  font-size: 14px;
  color: #cccccc;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.announcement-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #888;
}

.no-announcements {
  text-align: center;
  padding: 40px;
  color: #888;
}

.demo-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.demo-btn {
  padding: 12px 20px;
  border: 1px solid #333;
  border-radius: 6px;
  background: transparent;
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.demo-btn:hover {
  border-color: #4F46E5;
  color: #ffffff;
  transform: translateY(-1px);
}

.demo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.demo-btn.primary {
  background: #4F46E5;
  border-color: #4F46E5;
  color: #ffffff;
}

.demo-btn.primary:hover {
  background: #6366F1;
  border-color: #6366F1;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .demo-page {
    padding: 20px 12px;
  }
  
  .demo-section {
    padding: 16px;
  }
  
  .demo-actions {
    flex-direction: column;
  }
  
  .demo-btn {
    width: 100%;
  }
  
  .announcement-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
