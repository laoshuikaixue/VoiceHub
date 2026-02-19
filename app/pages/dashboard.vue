<template>
  <div>
    <ClientOnly>
      <div class="admin-layout" @touchend="handleTouchEnd" @touchstart="handleTouchStart">
        <!-- 左侧导航栏 -->
        <AdminSidebar
          :is-open="sidebarOpen"
          :active-tab="activeTab"
          :current-user="currentUser"
          :permissions="permissions"
          :site-title="siteTitle"
          @navigate="handleNavigate"
          @close="closeSidebar"
          @logout="handleLogout"
        />

        <!-- 移动端侧边栏遮罩 -->
        <div
          v-if="sidebarOpen"
          class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          @click="closeSidebar"
        />

        <!-- 主内容区域 -->
        <main
          class="flex-1 flex flex-col h-screen overflow-hidden lg:ml-64 relative bg-[#09090b] text-zinc-100"
        >
          <header
            class="h-16 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-zinc-800 bg-zinc-950/60 backdrop-blur-xl z-30"
          >
            <div class="flex items-center gap-3">
              <button
                class="lg:hidden p-2 text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors"
                @click="toggleSidebar"
              >
                <Menu :size="20" />
              </button>
              <h1 class="text-xl font-bold tracking-tight">{{ getPageTitle() }}</h1>
            </div>
            <div class="flex items-center gap-4">
              <!-- 这里可以添加顶部操作按钮 -->
            </div>
          </header>

          <div class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
            <!-- 移动端返回顶部按钮 -->
            <button
              v-if="showBackToTop"
              aria-label="返回顶部"
              class="fixed bottom-8 right-8 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all z-50"
              @click="scrollToTop"
            >
              <ChevronUp :size="24" />
            </button>

            <!-- 数据概览 -->
            <div
              v-if="activeTab === 'overview' && permissions.canAccessPage('overview')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminOverviewDashboard @navigate="handleNavigate" />
            </div>

            <!-- 歌曲管理 -->
            <div
              v-if="activeTab === 'songs' && permissions.canAccessPage('songs')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminSongManagement />
            </div>

            <!-- 排期管理 -->
            <div
              v-if="activeTab === 'schedule' && permissions.canAccessPage('schedule')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminScheduleManager />
            </div>

            <!-- 打印排期 -->
            <div
              v-if="activeTab === 'print' && permissions.canAccessPage('print')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminSchedulePrinter />
            </div>

            <!-- 数据分析 -->
            <div
              v-if="activeTab === 'data-analysis' && permissions.canAccessPage('data-analysis')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminDataAnalysisPanel />
            </div>

            <!-- 用户管理 -->
            <div
              v-if="activeTab === 'users' && permissions.canAccessPage('users')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminUserManager />
            </div>

            <!-- 消息管理 -->
            <div
              v-if="activeTab === 'notifications' && permissions.canAccessPage('notifications')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminNotificationSender />
            </div>

            <!-- SMTP邮件配置 -->
            <div
              v-if="activeTab === 'smtp-config' && permissions.canAccessPage('smtp-config')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminSmtpManager />
            </div>

            <!-- 播出时段 -->
            <div
              v-if="activeTab === 'playtimes' && permissions.canAccessPage('playtimes')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminPlayTimeManager />
            </div>

            <!-- 投稿管理 -->
            <div
              v-if="activeTab === 'request-times' && permissions.canAccessPage('request-times')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminRequestTimeManager />
            </div>

            <!-- 学期管理 -->
            <div
              v-if="activeTab === 'semesters' && permissions.canAccessPage('semesters')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminSemesterManager />
            </div>

            <!-- 黑名单管理 -->
            <div
              v-if="activeTab === 'blacklist' && permissions.canAccessPage('blacklist')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminBlacklistManager />
            </div>

            <!-- 站点配置 -->
            <div
              v-if="activeTab === 'site-config' && permissions.canAccessPage('site-config')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminSiteConfigManager />
            </div>

            <!-- 数据库操作 -->
            <div
              v-if="activeTab === 'database' && permissions.canAccessPage('database')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminDatabaseManager />
            </div>

            <!-- API密钥管理 -->
            <div
              v-if="activeTab === 'api-keys' && permissions.canAccessPage('api-keys')"
              class="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <LazyAdminApiKeyManager />
            </div>
          </div>
        </main>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Menu, ChevronUp } from 'lucide-vue-next'
import { useAuth } from '~/composables/useAuth'
import logo from '~/public/images/logo.svg'
import { usePermissions } from '~/composables/usePermissions'
import { useSiteConfig } from '~/composables/useSiteConfig'

// 使用站点配置
const { siteTitle, initSiteConfig } = useSiteConfig()

// 导入组件

// 页面元数据
definePageMeta({
  layout: false
})

// 响应式数据
const activeTab = ref('overview')
const currentUser = ref(null)
const sidebarOpen = ref(false)
const showBackToTop = ref(false)

// 服务
let auth = null
const permissions = usePermissions()

// 方法
const getPageTitle = () => {
  const titles = {
    overview: '数据概览',
    songs: '歌曲管理',
    schedule: '排期管理',
    print: '打印排期',
    users: '用户管理',
    notifications: '通知管理',
    'smtp-config': '邮件配置',
    playtimes: '播出时段',
    'request-times': '投稿管理',
    semesters: '学期管理',
    blacklist: '黑名单管理',
    'site-config': '站点配置',
    database: '数据库操作'
  }
  return titles[activeTab.value] || '管理后台'
}

// 动态页面标题
const dynamicTitle = computed(() => {
  const currentPageTitle = getPageTitle()
  if (siteTitle && siteTitle.value) {
    return `${currentPageTitle} | ${siteTitle.value}`
  }
  return `${currentPageTitle} | 校园广播站点歌系统`
})

// 监听activeTab变化，更新页面标题
watch(
  activeTab,
  () => {
    if (typeof document !== 'undefined') {
      document.title = dynamicTitle.value
    }
  },
  { immediate: true }
)

// 监听siteTitle变化，更新页面标题
watch(
  () => siteTitle?.value,
  () => {
    if (typeof document !== 'undefined') {
      document.title = dynamicTitle.value
    }
  }
)

const getRoleDisplayName = (role) => {
  const roleNames = {
    USER: '普通用户',
    SONG_ADMIN: '歌曲管理员',
    ADMIN: '超级管理员',
    SUPER_ADMIN: '超级管理员'
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

// 返回顶部功能
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 监听滚动事件
const handleScroll = () => {
  showBackToTop.value = window.scrollY > 300
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
  // 初始化站点配置
  await initSiteConfig()

  // 初始化服务
  auth = useAuth()

  // 检查认证状态（plugin已经初始化过了）

  if (!auth.isAuthenticated.value) {
    await navigateTo('/login')
    return
  }

  // 检查用户是否有访问后台的权限
  if (!permissions.canAccessAdmin.value) {
    await navigateTo('/')
    return
  }

  currentUser.value = auth.user.value

  // 设置默认页面
  const userPages = permissions.getUserPages.value
  if (userPages.length > 0 && !userPages.includes(activeTab.value)) {
    activeTab.value = userPages[0]
  }

  // 设置初始页面标题
  if (typeof document !== 'undefined') {
    document.title = dynamicTitle.value
  }

  // 添加窗口大小监听器
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)

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
  window.removeEventListener('scroll', handleScroll)
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

/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
