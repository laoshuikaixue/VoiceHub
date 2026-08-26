<!-- 侧边栏组件 -->
<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 w-64 bg-bg-primary border-r border-border-secondary transform transition-transform duration-300 ease-in-out lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="flex flex-col h-full p-4">
      <!-- 品牌标识区域 -->
      <div class="flex items-center px-2 mb-6 mt-2">
        <NuxtLink to="/" class="flex items-center gap-2.5 group">
          <!-- Logo 图标 -->
          <div class="flex-shrink-0 group-hover:scale-110 transition-all duration-300">
            <img src="/assets/logo.png" alt="VoiceHub Logo" class="w-8 h-8 object-contain" >
          </div>
          <!-- 品牌文字 -->
          <div class="flex flex-col justify-center">
            <h1 class="font-bold text-lg text-text-primary leading-none tracking-tight">VoiceHub</h1>
            <p
              class="text-[10px] text-text-tertiary mt-1.5 uppercase tracking-widest font-bold leading-none"
            >
              {{ locale.console }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- 导航菜单区域 -->
      <nav class="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        <div v-for="(group, idx) in menuGroups" :key="idx" class="space-y-1">
          <template v-if="shouldShowGroup(group)">
            <!-- 分组标题 -->
            <h3 class="px-3 text-[10px] font-bold text-text-disabled uppercase tracking-[0.2em] mb-2">
              {{ group.section }}
            </h3>
            <!-- 菜单项列表 -->
            <template v-for="item in group.items" :key="item.id">
              <button
                v-if="permissions.canAccessPage(item.permissionId || item.id)"
                :class="[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all group border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-10 focus-visible:ring-inset',
                  activeTab === item.id
                    ? 'bg-primary-hover-10 text-primary border-primary-20'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary-40 border-transparent'
                ]"
                @click="onNavigate(item.id)"
              >
                <!-- 菜单图标 -->
                <component
                  :is="item.icon"
                  :size="18"
                  :class="
                    activeTab === item.id
                      ? 'text-primary'
                      : 'text-text-tertiary group-hover:text-text-secondary'
                  "
                />
                <span class="truncate">{{ item.label }}</span>
                <!-- 选中状态指示器 -->
                <div
                  v-if="activeTab === item.id"
                  class="ml-auto w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_var(--primary-60)]"
                />
              </button>
            </template>
          </template>
        </div>
      </nav>

      <!-- 用户信息及退出登录 -->
      <div class="mt-4 pt-4 border-t border-border-secondary">
        <div
          class="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary-50 border border-border-secondary-50 hover:bg-bg-tertiary-30 transition-colors"
        >
          <!-- 用户头像/首字母 -->
          <img
            v-if="currentUser?.avatar && !avatarError"
            :src="currentUser.avatar"
            class="w-10 h-10 rounded-lg object-cover border border-border-tertiary shrink-0"
            @error="avatarError = true"
          >
          <div
            v-else
            class="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-tertiary font-bold border border-border-tertiary shrink-0"
          >
            {{ (currentUser?.name || locale.avatarFallback || '管').charAt(0) }}
          </div>
          <!-- 用户详细信息 -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-black truncate text-text-primary">
              {{ currentUser?.name || locale.adminFallback }}
            </p>
            <p
              class="text-[10px] text-text-tertiary truncate uppercase tracking-wider font-medium mt-0.5"
            >
              {{ getRoleDisplayName(currentUser?.role || 'ADMIN') }}
            </p>
          </div>
          <!-- 退出按钮 -->
          <button
            class="p-2 text-text-disabled hover:text-error hover:bg-error-10 rounded-lg transition-all"
            :title="locale.logout"
            @click="$emit('logout')"
          >
            <LogOut :size="16" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
/**
 * 后台管理侧边栏组件
 */
import {
  LayoutDashboard,
  CalendarDays,
  Printer,
  Music2,
  BarChart3,
  Users,
  Key,
  Bell,
  Mail,
  LogOut,
  Clock,
  FileEdit,
  BookOpen,
  Ban,
  ListMusic,
  Globe,
  Database,
  Lock,
  Ticket,
  GraduationCap
} from '@lucide/vue'
import { useLocale } from '~/utils/locale'

const avatarError = ref(false)
const { admin } = useLocale()
const locale = computed(() => admin.value?.sidebar || {})

const props = defineProps({
  // 侧边栏是否打开（移动端）
  isOpen: Boolean,
  // 当前激活的标签页 ID
  activeTab: String,
  // 当前登录用户信息
  currentUser: Object,
  // 权限控制对象
  permissions: Object,
  // 站点标题
  siteTitle: String
})

watch(
  () => props.currentUser?.avatar,
  () => {
    avatarError.value = false
  }
)

const emit = defineEmits(['navigate', 'close', 'logout'])

// 菜单分组配置
const menuGroups = computed(() => [
  {
    section: locale.value.sections?.overview || '概览',
    items: [{ icon: LayoutDashboard, label: locale.value.menu?.overview || '数据概览', id: 'overview' }]
  },
  {
    section: locale.value.sections?.content || '内容管理',
    items: [
      { icon: CalendarDays, label: locale.value.menu?.schedule || '排班管理', id: 'schedule' },
      { icon: Printer, label: locale.value.menu?.print || '打印管理', id: 'print' },
      { icon: Music2, label: locale.value.menu?.songs || '点歌管理', id: 'songs' },
      {
        icon: BarChart3,
        label: locale.value.menu?.dataAnalysis || '数据分析',
        id: 'data-analysis',
        permissionId: 'data-analysis'
      }
    ]
  },
  {
    section: locale.value.sections?.users || '用户管理',
    items: [
      { icon: Users, label: locale.value.menu?.users || '用户管理', id: 'users' },
      { icon: GraduationCap, label: locale.value.menu?.gradeClass || '年级班级', id: 'grade-class' }
    ]
  },
  {
    section: locale.value.sections?.api || 'API',
    items: [{ icon: Key, label: locale.value.menu?.apiKeys || 'API 密钥', id: 'api-keys' }]
  },
  {
    section: locale.value.sections?.system || '系统设置',
    items: [
      { icon: Bell, label: locale.value.menu?.notifications || '通知管理', id: 'notifications' },
      { icon: Mail, label: locale.value.menu?.smtpConfig || 'SMTP 配置', id: 'smtp-config' },
      { icon: Clock, label: locale.value.menu?.playtimes || '播放时段', id: 'playtimes' },
      { icon: FileEdit, label: locale.value.menu?.requestTimes || '点歌时段', id: 'request-times' },
      { icon: BookOpen, label: locale.value.menu?.semesters || '学期管理', id: 'semesters' },
      { icon: Ban, label: locale.value.menu?.blacklist || '黑名单', id: 'blacklist' },
      { icon: Ticket, label: locale.value.menu?.cardCodes || '卡密管理', id: 'card-codes' },
      { icon: ListMusic, label: locale.value.menu?.musicSource || '音源控制', id: 'music-source' },
      { icon: Globe, label: locale.value.menu?.siteConfig || '站点配置', id: 'site-config' },
      { icon: Database, label: locale.value.menu?.database || '数据库', id: 'database' }
    ]
  },
  {
    section: locale.value.sections?.account || '账户',
    items: [{ icon: Lock, label: locale.value.menu?.password || '修改密码', id: 'password' }]
  }
])

/**
 * 判断是否应该显示该菜单组
 * @param {Object} group 菜单组对象
 */
const shouldShowGroup = (group) => {
  if (!props.permissions) return true
  return group.items.some((item) => props.permissions.canAccessPage(item.permissionId || item.id))
}

/**
 * 导航点击处理
 * @param {string} id 菜单项 ID
 */
const onNavigate = (id) => {
  if (id === 'password') {
    navigateTo('/change-password')
    return
  }
  emit('navigate', id)
}

/**
 * 获取角色显示名称
 * @param {string} role 角色标识
 */
const getRoleDisplayName = (role) => {
  return locale.value.roles?.[role] || role
}
</script>

<style scoped>
/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}
</style>
