<template>
  <div>
    <ClientOnly>
      <div
        class="admin-layout"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <!-- 移动端顶部导航栏 -->
        <header class="mobile-header">
          <button @click="toggleSidebar" class="mobile-menu-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="mobile-logo">
            <span class="mobile-logo-text">{{ $config.public.siteTitle || 'VoiceHub' }}</span>
            <span class="mobile-logo-subtitle">管理控制台</span>
          </div>
          <div class="mobile-user">
            <div class="mobile-user-avatar">
              {{ (currentUser?.name || '管理员').charAt(0) }}
            </div>
          </div>
        </header>

        <!-- 移动端遮罩层 -->
        <div
          v-if="sidebarOpen"
          class="mobile-overlay"
          @click="closeSidebar"
        ></div>

        <!-- 左侧导航栏 -->
        <aside :class="['sidebar', { 'sidebar-open': sidebarOpen }]">
          <div class="sidebar-header">
            <NuxtLink to="/" class="logo-link">
              <img src="/images/logo.svg" alt="VoiceHub Logo" class="logo-image" />
              <div class="logo-content">
                <span class="logo-text">{{ $config.public.siteTitle || 'VoiceHub' }}</span>
                <span class="logo-subtitle">管理控制台</span>
              </div>
            </NuxtLink>
          </div>
          
          <nav class="sidebar-nav">
            <div class="nav-section">
              <div class="nav-section-title">概览</div>
              <button 
                :class="['nav-item', { active: activeTab === 'overview' }]" 
                @click="activeTab = 'overview'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="9" x2="15" y2="9"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                数据概览
              </button>
            </div>
            
            <div class="nav-section">
              <div class="nav-section-title">内容管理</div>
              <button
                :class="['nav-item', { active: activeTab === 'schedule' }]"
                @click="activeTab = 'schedule'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                排期管理
              </button>
              <button
                :class="['nav-item', { active: activeTab === 'print' }]"
                @click="activeTab = 'print'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 6,2 18,2 18,9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                打印排期
              </button>
              <button 
                :class="['nav-item', { active: activeTab === 'songs' }]" 
                @click="activeTab = 'songs'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6"/>
                  <path d="m21 12-6-3-6 3-6-3"/>
                </svg>
                歌曲管理
              </button>
            </div>
            
            <div class="nav-section">
              <div class="nav-section-title">用户管理</div>
              <button
                :class="['nav-item', { active: activeTab === 'users' }]"
                @click="activeTab = 'users'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                用户管理
              </button>

            <button
              :class="['nav-item', { active: activeTab === 'roles' }]"
              @click="activeTab = 'roles'"
            >
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <path d="M20 8v6"/>
                <path d="M23 11h-6"/>
              </svg>
              角色管理
            </button>
            </div>
            
            <div class="nav-section">
              <div class="nav-section-title">系统管理</div>
              <button 
                :class="['nav-item', { active: activeTab === 'notifications' }]" 
                @click="activeTab = 'notifications'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                通知管理
              </button>
              <button
                :class="['nav-item', { active: activeTab === 'playtimes' }]"
                @click="activeTab = 'playtimes'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                播出时段
              </button>
              <button
                :class="['nav-item', { active: activeTab === 'semesters' }]"
                @click="activeTab = 'semesters'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                学期管理
              </button>
              <button
                :class="['nav-item', { active: activeTab === 'blacklist' }]"
                @click="activeTab = 'blacklist'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                黑名单管理
              </button>
              <button
                :class="['nav-item', { active: activeTab === 'backup' }]"
                @click="activeTab = 'backup'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
                数据备份
              </button>
            </div>
          </nav>
          
          <div class="sidebar-footer">
            <div class="user-info">
              <div class="user-avatar">
                {{ (currentUser?.name || '管理员').charAt(0) }}
              </div>
              <div class="user-details">
                <div class="user-name">{{ currentUser?.name || '管理员' }}</div>
                <div class="user-role">{{ getRoleDisplayName(currentUser?.role) }}</div>
              </div>
            </div>
            <button @click="handleLogout" class="logout-btn">
              <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </aside>
        
        <!-- 主内容区域 -->
        <main class="main-content">
          <div class="content-header">
            <h1 class="page-title">{{ getPageTitle() }}</h1>
            <div class="content-actions">
              <!-- 页面特定的操作按钮将在这里显示 -->
            </div>
          </div>
          
          <div class="content-body">
            <!-- 移动端返回顶部按钮 -->
            <button
              v-if="showBackToTop"
              @click="scrollToTop"
              class="back-to-top-btn"
              aria-label="返回顶部"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>

            <!-- 数据概览 -->
            <div v-if="activeTab === 'overview'" class="overview-section">
              <OverviewDashboard @navigate="handleNavigate" />
            </div>
            
            <!-- 歌曲管理 -->
            <div v-if="activeTab === 'songs'" class="content-section">
              <SongManagement />
            </div>
            
            <!-- 排期管理 -->
            <div v-if="activeTab === 'schedule'" class="content-section">
              <ScheduleManager />
            </div>

            <!-- 打印排期 -->
            <div v-if="activeTab === 'print'" class="content-section">
              <SchedulePrinter />
            </div>
            
            <!-- 用户管理 -->
            <div v-if="activeTab === 'users'" class="content-section">
              <UserManager />
            </div>

            <!-- 角色管理 -->
            <div v-if="activeTab === 'roles'" class="content-section">
              <RoleManager />
            </div>
            
            <!-- 通知管理 -->
            <div v-if="activeTab === 'notifications'" class="content-section">
              <NotificationSender />
            </div>
            
            <!-- 播出时段 -->
            <div v-if="activeTab === 'playtimes'" class="content-section">
              <PlayTimeManager />
            </div>
            
            <!-- 学期管理 -->
            <div v-if="activeTab === 'semesters'" class="content-section">
              <SemesterManager />
            </div>
            
            <!-- 黑名单管理 -->
            <div v-if="activeTab === 'blacklist'" class="content-section">
              <BlacklistManager />
            </div>

            <!-- 数据备份 -->
            <div v-if="activeTab === 'backup'" class="content-section">
              <BackupManager />
            </div>
          </div>
        </main>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

// 导入组件
import OverviewDashboard from '~/components/Admin/OverviewDashboard.vue'
import SongManagement from '~/components/Admin/SongManagement.vue'
import ScheduleManager from '~/components/Admin/ScheduleManager.vue'
import SchedulePrinter from '~/components/Admin/SchedulePrinter.vue'
import UserManager from '~/components/Admin/UserManager.vue'
import RoleManager from '~/components/Admin/RoleManager.vue'
import NotificationSender from '~/components/Admin/NotificationSender.vue'
import PlayTimeManager from '~/components/Admin/PlayTimeManager.vue'
import SemesterManager from '~/components/Admin/SemesterManager.vue'
import BlacklistManager from '~/components/Admin/BlacklistManager.vue'
import BackupManager from '~/components/Admin/BackupManager.vue'

// 页面元数据
definePageMeta({
  middleware: 'auth',
  layout: false
})

// 响应式数据
const activeTab = ref('overview')
const currentUser = ref(null)
const sidebarOpen = ref(false)

// 服务
let auth = null

// 方法
const getPageTitle = () => {
  const titles = {
    overview: '数据概览',
    songs: '歌曲管理',
    schedule: '排期管理',
    users: '用户管理',
    notifications: '通知管理',
    playtimes: '播出时段',
    semesters: '学期管理',
    blacklist: '黑名单管理',
    backup: '数据备份'
  }
  return titles[activeTab.value] || '管理后台'
}

const getRoleDisplayName = (role) => {
  const roleNames = {
    'USER': '普通用户',
    'SONG_ADMIN': '歌曲管理员',
    'ADMIN': '超级管理员',
    'SUPER_ADMIN': '超级管理员'
  }
  return roleNames[role] || role
}

const handleLogout = async () => {
  if (auth) {
    await auth.logout()
    await navigateTo('/login')
  }
}

// 导航方法
const handleNavigate = (tab) => {
  activeTab.value = tab
  // 移动端点击导航后关闭侧边栏
  if (window.innerWidth <= 768) {
    closeSidebar()
  }
}

// 侧边栏控制方法
const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebar = () => {
  sidebarOpen.value = false
}

// 监听窗口大小变化，大屏幕时自动关闭移动端侧边栏
const handleResize = () => {
  if (window.innerWidth > 768) {
    sidebarOpen.value = false
  }
}

// 触摸手势支持
let touchStartX = 0
let touchStartY = 0
let touchEndX = 0
let touchEndY = 0

const handleTouchStart = (e) => {
  touchStartX = e.changedTouches[0].screenX
  touchStartY = e.changedTouches[0].screenY
}

const handleTouchEnd = (e) => {
  touchEndX = e.changedTouches[0].screenX
  touchEndY = e.changedTouches[0].screenY
  handleSwipe()
}

const handleSwipe = () => {
  const deltaX = touchEndX - touchStartX
  const deltaY = touchEndY - touchStartY
  const minSwipeDistance = 50

  // 只在移动端处理滑动手势
  if (window.innerWidth > 768) return

  // 水平滑动距离大于垂直滑动距离，且超过最小滑动距离
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
    if (deltaX > 0 && touchStartX < 50) {
      // 从左边缘向右滑动，打开侧边栏
      sidebarOpen.value = true
    } else if (deltaX < 0 && sidebarOpen.value) {
      // 向左滑动，关闭侧边栏
      sidebarOpen.value = false
    }
  }
}

// 生命周期
onMounted(async () => {
  // 初始化服务
  auth = useAuth()

  // 检查认证状态
  await auth.initAuth()

  if (!auth.isAuthenticated.value) {
    await navigateTo('/login')
    return
  }

  if (!['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(auth.user.value?.role)) {
    await navigateTo('/')
    return
  }

  currentUser.value = auth.user.value

  // 添加窗口大小监听器
  window.addEventListener('resize', handleResize)

  // 添加双击关闭侧边栏事件
  document.addEventListener('dblclick', (e) => {
    if (window.innerWidth <= 768 && sidebarOpen.value) {
      closeSidebar()
    }
  })
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  position: relative;
}

/* 移动端顶部导航栏 */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #111111;
  border-bottom: 1px solid #1f1f1f;
  z-index: 1001;
  padding: 0 16px;
  align-items: center;
  justify-content: space-between;
}

.mobile-menu-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: #1a1a1a;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.mobile-menu-btn:hover {
  background: #2a2a2a;
}

.mobile-menu-btn svg {
  width: 20px;
  height: 20px;
}

.mobile-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin: 0 16px;
}

.mobile-logo-text {
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
}

.mobile-logo-subtitle {
  font-size: 12px;
  color: #888888;
  font-weight: 400;
}

.mobile-user {
  display: flex;
  align-items: center;
}

.mobile-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
  color: #ffffff;
}

/* 移动端遮罩层 */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* 左侧导航栏 */
.sidebar {
  width: 280px;
  background: #111111;
  border-right: 1px solid #1f1f1f;
  position: fixed;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: transform 0.3s ease;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid #1f1f1f;
}

.logo-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #ffffff;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.logo-link:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.logo-image {
  width: 150px;
  height: auto;
  filter: none;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.logo-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
  white-space: nowrap;
}

.logo-subtitle {
  font-size: 14px;
  color: #888888;
  font-weight: 400;
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 0;
}

.nav-section {
  margin-bottom: 32px;
}

.nav-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #666666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding: 0 20px;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: none;
  border: none;
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.nav-item:hover {
  background: #1a1a1a;
  color: #ffffff;
}

.nav-item.active {
  background: #1e40af;
  color: #ffffff;
}

.nav-item.active .nav-icon {
  color: #ffffff;
}

.nav-icon {
  width: 20px;
  height: 20px;
  color: #888888;
  transition: color 0.2s ease;
}

.nav-item:hover .nav-icon {
  color: #ffffff;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
  min-height: 0; /* 允许flex子项收缩 */
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #1f1f1f;
  background: #111111;
  flex-shrink: 0; /* 防止footer被压缩 */
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
}

.user-details {
  flex: 1;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 2px;
}

.user-role {
  font-size: 12px;
  color: #888888;
}

.logout-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #888888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background: #2a2a2a;
  color: #ffffff;
}

.logout-icon {
  width: 16px;
  height: 16px;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  margin-left: 280px;
  background: #0a0a0a;
  min-height: 100vh;
}

.content-header {
  padding: 32px 40px 24px;
  border-bottom: 1px solid #1f1f1f;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.content-actions {
  display: flex;
  gap: 12px;
}

.content-body {
  padding: 40px;
}

.content-section {
  background: #111111;
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  overflow: hidden;
}

/* 移除重复的sidebar-footer样式 */

/* 响应式设计 */
@media (max-width: 1024px) {
  .sidebar {
    width: 240px;
  }

  .main-content {
    margin-left: 240px;
  }

  .content-body {
    padding: 24px;
  }
}

@media (max-width: 768px) {
  /* 显示移动端头部 */
  .mobile-header {
    display: flex;
  }

  /* 显示移动端遮罩层 */
  .mobile-overlay {
    display: block;
  }

  /* 侧边栏移动端样式 */
  .sidebar {
    width: 280px;
    position: fixed;
    height: 100vh;
    top: 0;
    left: 0;
    transform: translateX(-100%);
    z-index: 1000;
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
  }

  /* 主内容区域 */
  .main-content {
    margin-left: 0;
    padding-top: 60px; /* 为移动端头部留出空间 */
  }

  .content-header {
    padding: 16px 20px 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .content-body {
    padding: 16px;
  }

  /* 侧边栏内部元素的移动端优化 */
  .sidebar-header {
    padding: 20px 16px;
  }

  .logo-image {
    width: 120px;
    margin-bottom: 16px;
  }

  /* 移动端隐藏logo文字 */
  .logo-content {
    display: none;
  }

  .nav-section {
    margin-bottom: 24px;
  }

  .nav-section-title {
    padding: 0 16px;
    font-size: 11px;
  }

  .nav-item {
    padding: 14px 16px;
    font-size: 15px;
  }

  .nav-icon {
    width: 18px;
    height: 18px;
  }

  .sidebar-footer {
    padding: 16px;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .user-name {
    font-size: 13px;
  }

  .user-role {
    font-size: 11px;
  }

  .logout-btn {
    width: 32px;
    height: 32px;
  }

  .logout-icon {
    width: 14px;
    height: 14px;
  }
}

/* 小屏幕设备进一步优化 */
@media (max-width: 480px) {
  .mobile-header {
    height: 56px;
    padding: 0 12px;
  }

  .mobile-menu-btn {
    width: 36px;
    height: 36px;
  }

  .mobile-menu-btn svg {
    width: 18px;
    height: 18px;
  }

  .mobile-logo-text {
    font-size: 14px;
  }

  .mobile-logo-subtitle {
    font-size: 11px;
  }

  .mobile-user-avatar {
    width: 28px;
    height: 28px;
    font-size: 11px;
  }

  .main-content {
    padding-top: 56px;
  }

  .content-header {
    padding: 12px 16px 8px;
  }

  .page-title {
    font-size: 18px;
  }

  .content-body {
    padding: 12px;
  }

  .sidebar {
    width: 260px;
  }

  .sidebar-header {
    padding: 16px 12px;
  }

  .logo-image {
    width: 100px;
    margin-bottom: 12px;
  }

  .nav-item {
    padding: 12px;
    font-size: 14px;
  }

  .nav-section-title {
    padding: 0 12px;
  }

  .sidebar-footer {
    padding: 12px;
  }
}
</style>
