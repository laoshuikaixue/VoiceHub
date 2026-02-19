<!-- 侧边栏组件 -->
<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 w-64 bg-[#09090b] border-r border-zinc-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="flex flex-col h-full p-4">
      <!-- 品牌标识区域 -->
      <div class="flex items-center px-2 mb-6 mt-2">
        <NuxtLink to="/" class="flex items-center gap-2.5 group">
          <!-- Logo 图标 -->
          <div class="flex-shrink-0 group-hover:scale-110 transition-all duration-300">
            <img :src="logo" alt="VoiceHub Logo" class="w-8 h-8 object-contain" >
          </div>
          <!-- 品牌文字 -->
          <div class="flex flex-col justify-center">
            <h1 class="font-bold text-lg text-zinc-100 leading-none tracking-tight">VoiceHub</h1>
            <p
              class="text-[10px] text-zinc-500 mt-1.5 uppercase tracking-widest font-bold leading-none"
            >
              管理控制台
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- 导航菜单区域 -->
      <nav class="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        <div v-for="(group, idx) in menuGroups" :key="idx" class="space-y-1">
          <template v-if="shouldShowGroup(group)">
            <!-- 分组标题 -->
            <h3 class="px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2">
              {{ group.section }}
            </h3>
            <!-- 菜单项列表 -->
            <template v-for="item in group.items" :key="item.id">
              <button
                v-if="permissions.canAccessPage(item.permissionId || item.id)"
                :class="[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all group border',
                  activeTab === item.id
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 border-transparent'
                ]"
                @click="onNavigate(item.id)"
              >
                <!-- 菜单图标 -->
                <component
                  :is="item.icon"
                  :size="18"
                  :class="
                    activeTab === item.id
                      ? 'text-blue-400'
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  "
                />
                <span class="truncate">{{ item.label }}</span>
                <!-- 选中状态指示器 -->
                <div
                  v-if="activeTab === item.id"
                  class="ml-auto w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                />
              </button>
            </template>
          </template>
        </div>
      </nav>

      <!-- 用户信息及退出登录 -->
      <div class="mt-4 pt-4 border-t border-zinc-800">
        <div
          class="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
        >
          <!-- 用户头像/首字母 -->
          <img
            v-if="currentUser?.avatar && !avatarError"
            :src="currentUser.avatar"
            class="w-10 h-10 rounded-lg object-cover border border-zinc-700 shrink-0"
            @error="avatarError = true"
          >
          <div
            v-else
            class="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-zinc-700 shrink-0"
          >
            {{ (currentUser?.name || '管').charAt(0) }}
          </div>
          <!-- 用户详细信息 -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-black truncate text-zinc-100">
              {{ currentUser?.name || '管理员' }}
            </p>
            <p
              class="text-[10px] text-zinc-500 truncate uppercase tracking-wider font-medium mt-0.5"
            >
              {{ currentUser?.role?.replace('_', ' ') || 'ADMIN' }}
            </p>
          </div>
          <!-- 退出按钮 -->
          <button
            class="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            title="退出登录"
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
  Globe,
  Database,
  Lock
} from 'lucide-vue-next'
import logo from '~/public/images/logo.png'

const avatarError = ref(false)

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
const menuGroups = [
  {
    section: '概览',
    items: [{ icon: LayoutDashboard, label: '数据概览', id: 'overview' }]
  },
  {
    section: '内容管理',
    items: [
      { icon: CalendarDays, label: '排期管理', id: 'schedule' },
      { icon: Printer, label: '打印排期', id: 'print' },
      { icon: Music2, label: '歌曲管理', id: 'songs' },
      { icon: BarChart3, label: '数据分析', id: 'data-analysis', permissionId: 'data-analysis' }
    ]
  },
  {
    section: '用户管理',
    items: [{ icon: Users, label: '用户管理', id: 'users' }]
  },
  {
    section: 'API管理',
    items: [{ icon: Key, label: 'API密钥管理', id: 'api-keys' }]
  },
  {
    section: '系统管理',
    items: [
      { icon: Bell, label: '通知管理', id: 'notifications' },
      { icon: Mail, label: '邮件配置', id: 'smtp-config' },
      { icon: Clock, label: '播出时段', id: 'playtimes' },
      { icon: FileEdit, label: '投稿管理', id: 'request-times' },
      { icon: BookOpen, label: '学期管理', id: 'semesters' },
      { icon: Ban, label: '黑名单管理', id: 'blacklist' },
      { icon: Globe, label: '站点配置', id: 'site-config' },
      { icon: Database, label: '数据库操作', id: 'database' }
    ]
  },
  {
    section: '账户管理',
    items: [{ icon: Lock, label: '修改密码', id: 'password' }]
  }
]

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
  const roleNames = {
    USER: '普通用户',
    SONG_ADMIN: '歌曲管理员',
    ADMIN: '管理员',
    SUPER_ADMIN: '超级管理员'
  }
  return roleNames[role] || role
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
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
