<template>
  <div class="overview-dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <StatCard
          :change="stats.songsChange"
          :value="stats.totalSongs"
          icon="songs"
          icon-class="primary"
          label="总歌曲数"
      />

      <StatCard
          :value="stats.totalUsers"
          icon="users"
          icon-class="success"
          label="注册用户"
      />

      <StatCard
          :value="stats.todaySchedules"
          icon="schedule"
          icon-class="info"
          label="今日排期"
      />

      <StatCard
          :change="stats.requestsChange"
          :value="stats.weeklyRequests"
          icon="votes"
          icon-class="warning"
          label="本周点歌"
      />
    </div>

    <!-- 图表和活动 -->
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <div class="card-header">
          <h3>最近活动</h3>
          <button class="refresh-btn" @click="refreshActivities">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="23,4 23,10 17,10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
        <div class="activity-list">
          <div v-if="loadingActivities" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="recentActivities.length === 0" class="empty-state">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12h8"/>
            </svg>
            <span>暂无活动记录</span>
          </div>
          <div v-else>
            <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
              <div :class="activity.type" class="activity-icon">
                <svg v-if="activity.type === 'song'" fill="none" stroke="currentColor" stroke-width="2"
                     viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6"/>
                </svg>
                <svg v-else-if="activity.type === 'user'" fill="none" stroke="currentColor" stroke-width="2"
                     viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <svg v-else-if="activity.type === 'schedule'" fill="none" stroke="currentColor" stroke-width="2"
                     viewBox="0 0 24 24">
                  <rect height="18" rx="2" ry="2" width="18" x="3" y="4"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
                <svg v-else fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" x2="12" y1="8" y2="12"/>
                  <line x1="12" x2="12.01" y1="16" y2="16"/>
                </svg>
              </div>
              <div class="activity-content">
                <div class="activity-title">{{ activity.title }}</div>
                <div class="activity-description">{{ activity.description }}</div>
                <div class="activity-time">{{ formatTime(activity.createdAt) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-card">
        <div class="card-header">
          <h3>系统状态</h3>
          <div :class="{ online: systemStatus.online }" class="status-indicator">
            {{ systemStatus.online ? '在线' : '离线' }}
          </div>
        </div>
        <div class="system-status">
          <div class="status-item">
            <div :class="{ active: systemStatus.database }" class="status-dot"></div>
            <span>数据库连接</span>
            <div class="status-value">{{ systemStatus.database ? '正常' : '异常' }}</div>
          </div>
          <div class="status-item">
            <div :class="{ active: systemStatus.api }" class="status-dot"></div>
            <span>API服务</span>
            <div class="status-value">{{ systemStatus.api ? '正常' : '异常' }}</div>
          </div>
          <div class="status-item">
            <div :class="{ active: !!stats.currentSemester }" class="status-dot"></div>
            <span>当前学期</span>
            <div class="status-value">{{ stats.currentSemester || '未设置' }}</div>
          </div>
          <div class="status-item">
            <div :class="{ active: stats.blacklistCount >= 0 }" class="status-dot"></div>
            <span>黑名单项目</span>
            <div class="status-value">{{ stats.blacklistCount }} 项</div>
          </div>
          <div class="status-item">
            <div class="status-dot active"></div>
            <span>系统版本</span>
            <div class="status-value">v{{ systemVersion }}</div>
          </div>
        </div>
      </div>

      <div class="dashboard-card">
        <div class="card-header">
          <h3>快速操作</h3>
        </div>
        <div class="quick-actions">
          <button class="action-btn primary" @click="navigateTo('schedule')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect height="18" rx="2" ry="2" width="18" x="3" y="4"/>
              <line x1="16" x2="16" y1="2" y2="6"/>
              <line x1="8" x2="8" y1="2" y2="6"/>
              <line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            管理排期
          </button>
          <button class="action-btn" @click="navigateTo('users')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            用户管理
          </button>
          <button class="action-btn" @click="navigateTo('notifications')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            发送通知
          </button>
          <button class="action-btn" @click="navigateTo('blacklist')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/>
            </svg>
            黑名单管理
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import StatCard from './Common/StatCard.vue'
import packageJson from '~/package.json'

// 定义事件
const emit = defineEmits(['navigate'])

// 系统版本号
const systemVersion = ref(packageJson.version)

// 导航方法
const navigateTo = (tab) => {
  emit('navigate', tab)
}

// 响应式数据
const stats = ref({
  totalSongs: 0,
  totalUsers: 0,
  todaySchedules: 0,
  weeklyRequests: 0,
  songsChange: 0,
  usersChange: 0,
  requestsChange: 0,
  totalSchedules: 0,
  currentSemester: '',
  blacklistCount: 0
})

const recentActivities = ref([])
const loadingActivities = ref(false)

const systemStatus = ref({
  online: true,
  database: true,
  api: true
})

// 方法
const loadStats = async () => {
  try {
    const response = await $fetch('/api/admin/stats', {
      ...useAuth().getAuthConfig()
    })
    stats.value = response
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const loadRecentActivities = async () => {
  loadingActivities.value = true
  try {
    const response = await $fetch('/api/admin/activities', {
      ...useAuth().getAuthConfig()
    })
    recentActivities.value = response.activities || []
  } catch (error) {
    console.error('加载活动记录失败:', error)
    recentActivities.value = []
  } finally {
    loadingActivities.value = false
  }
}

const refreshActivities = () => {
  loadRecentActivities()
}

const formatTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

// 生命周期
onMounted(() => {
  loadStats()
  loadRecentActivities()
})
</script>

<style scoped>
.overview-dashboard {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.stat-card {
  background: #111111;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: all 0.2s ease;
}

.stat-card:hover {
  border-color: #2a2a2a;
  transform: translateY(-2px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
  color: #ffffff;
}

.stat-icon.songs {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.users {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.schedules {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.activity {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #888888;
  margin-bottom: 8px;
}

.stat-change {
  font-size: 12px;
  color: #666666;
}

.stat-change.positive {
  color: #10b981;
}

/* 仪表板网格 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
}

.dashboard-card {
  background: #111111;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid #1f1f1f;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.refresh-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #888888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: #2a2a2a;
  color: #ffffff;
}

.refresh-btn svg {
  width: 16px;
  height: 16px;
}

.status-indicator {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  background: #1f1f1f;
  color: #888888;
}

.status-indicator.online {
  background: #10b981;
  color: #ffffff;
}

/* 活动列表 */
.activity-list {
  padding: 24px;
  max-height: 400px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666666;
  gap: 12px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #1f1f1f;
  border-top: 2px solid #667eea;
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

.empty-state svg {
  width: 32px;
  height: 32px;
  color: #444444;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #1a1a1a;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-icon svg {
  width: 16px;
  height: 16px;
  color: #ffffff;
}

.activity-icon.song {
  background: #667eea;
}

.activity-icon.user {
  background: #f5576c;
}

.activity-icon.schedule {
  background: #4facfe;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 4px;
}

.activity-description {
  font-size: 12px;
  color: #888888;
  margin-bottom: 4px;
}

.activity-time {
  font-size: 11px;
  color: #666666;
}

/* 系统状态 */
.system-status {
  padding: 24px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #1a1a1a;
}

.status-item:last-child {
  border-bottom: none;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #444444;
  flex-shrink: 0;
}

.status-dot.active {
  background: #10b981;
}

.status-item span {
  flex: 1;
  font-size: 14px;
  color: #cccccc;
}

.status-value {
  font-size: 12px;
  color: #888888;
}

/* 快速操作 */
.quick-actions {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}

.action-btn:hover {
  background: #2a2a2a;
  color: #ffffff;
  border-color: #3a3a3a;
}

.action-btn.primary {
  background: #1e40af;
  border-color: #1e40af;
  color: #ffffff;
}

.action-btn.primary:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .overview-dashboard {
    gap: 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .dashboard-card {
    border-radius: 10px;
  }

  .card-header {
    padding: 16px 20px;
  }

  .card-header h3 {
    font-size: 16px;
  }

  .refresh-btn {
    width: 36px;
    height: 36px;
  }

  .refresh-btn svg {
    width: 18px;
    height: 18px;
  }

  .activity-list {
    padding: 20px;
    max-height: 300px;
  }

  .activity-item {
    padding: 10px 0;
  }

  .activity-icon {
    width: 28px;
    height: 28px;
  }

  .activity-icon svg {
    width: 14px;
    height: 14px;
  }

  .activity-title {
    font-size: 13px;
  }

  .activity-description {
    font-size: 11px;
  }

  .activity-time {
    font-size: 10px;
  }

  .system-status {
    padding: 20px;
  }

  .status-item {
    padding: 10px 0;
  }

  .status-item span {
    font-size: 13px;
  }

  .status-value {
    font-size: 11px;
  }

  .quick-actions {
    padding: 20px;
    gap: 10px;
  }

  .action-btn {
    padding: 12px 14px !important;
    font-size: 13px !important;
    width: 100% !important;
    justify-content: flex-start !important;
    box-sizing: border-box !important;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }
}

/* 小屏幕设备进一步优化 */
@media (max-width: 480px) {
  .overview-dashboard {
    gap: 16px;
  }

  .stats-grid {
    gap: 12px;
  }

  .dashboard-grid {
    gap: 12px;
  }

  .card-header {
    padding: 12px 16px;
  }

  .card-header h3 {
    font-size: 15px;
  }

  .refresh-btn {
    width: 32px;
    height: 32px;
  }

  .refresh-btn svg {
    width: 16px;
    height: 16px;
  }

  .activity-list {
    padding: 16px;
    max-height: 250px;
  }

  .system-status {
    padding: 16px;
  }

  .quick-actions {
    padding: 16px;
    gap: 8px;
  }

  .action-btn {
    padding: 10px 12px !important;
    font-size: 12px !important;
    width: 100% !important;
    justify-content: flex-start !important;
    box-sizing: border-box !important;
  }

  .action-btn svg {
    width: 12px;
    height: 12px;
  }
}
</style>
