<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <!-- 统计卡片网格 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <div
        v-for="(stat, i) in statCards"
        :key="i"
        class="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all shadow-lg shadow-black/20"
      >
        <div class="flex justify-between items-start mb-4">
          <div
            :class="[
              'p-3 rounded-xl border',
              stat.color === 'blue'
                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                : stat.color === 'emerald'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : stat.color === 'pink'
                    ? 'bg-pink-500/10 text-pink-500 border-pink-500/20'
                    : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
            ]"
          >
            <component :is="stat.icon" :size="24" />
          </div>
          <div
            v-if="stat.trend"
            :class="[
              'flex items-center gap-1 text-[11px] font-bold',
              stat.trendDown ? 'text-red-400' : 'text-emerald-400'
            ]"
          >
            <TrendingDown v-if="stat.trendDown" :size="12" />
            <TrendingUp v-else :size="12" />
            {{ stat.trend }}
          </div>
        </div>
        <div>
          <p class="text-zinc-500 text-sm font-medium">{{ stat.label }}</p>
          <h4 class="text-3xl font-bold tracking-tight text-zinc-100">{{ stat.value }}</h4>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- 最近活动 -->
      <div
        class="lg:col-span-5 bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col shadow-lg shadow-black/20"
      >
        <div class="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-lg font-bold flex items-center gap-2">
            <Activity :size="18" class="text-blue-500" /> {{ locale.recentActivities }}
          </h3>
          <button
            class="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            :class="{ 'animate-spin': loadingActivities }"
            @click="refreshActivities"
          >
            <RefreshCw :size="16" />
          </button>
        </div>
        <div
          class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 min-h-[380px] max-h-[500px]"
        >
          <div
            v-if="loadingActivities && recentActivities.length === 0"
            class="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 py-20"
          >
            <RefreshCw :size="24" class="animate-spin" />
            <span class="text-sm">{{ locale.loading }}</span>
          </div>
          <div
            v-else-if="recentActivities.length === 0"
            class="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 py-20"
          >
            <Inbox :size="24" />
            <span class="text-sm">{{ locale.noActivities }}</span>
          </div>
          <template v-else>
            <div
              v-for="(activity, idx) in recentActivities"
              :key="idx"
              class="flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-800/40 transition-all cursor-pointer group"
            >
              <div
                :class="[
                  'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm',
                  getActivityStyle(activity.type).bg
                ]"
              >
                <component :is="getActivityStyle(activity.type).icon" :size="18" />
              </div>
              <div class="flex-1 min-w-0">
                <h5
                  class="font-bold text-sm text-zinc-200 group-hover:text-blue-400 transition-colors"
                >
                  {{ activity.title }}
                </h5>
                <p class="text-xs text-zinc-500 truncate mt-1">{{ activity.description }}</p>
                <div class="flex items-center gap-1.5 mt-2">
                  <Clock :size="10" class="text-zinc-600" />
                  <span class="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{{
                    formatTime(activity.createdAt)
                  }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 系统状态 -->
      <div
        class="lg:col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/20"
      >
        <div class="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-lg font-bold flex items-center gap-2">
            <ShieldCheck :size="18" class="text-emerald-500" /> {{ locale.systemStatus }}
          </h3>
          <span
            :class="[
              'px-3 py-1 text-[10px] font-black uppercase rounded-full border',
              systemStatus.online
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            ]"
          >
            {{ systemStatus.online ? locale.online : locale.offline }}
          </span>
        </div>
        <div class="p-6 space-y-6">
          <div
            v-for="(status, i) in statusItems"
            :key="i"
            class="flex items-center justify-between group"
          >
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-1.5 h-1.5 rounded-full',
                  status.active
                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                    : 'bg-zinc-600'
                ]"
              />
              <span class="text-xs font-semibold text-zinc-400">{{ status.label }}</span>
            </div>
            <span class="text-xs font-bold text-zinc-200">{{ status.value }}</span>
          </div>
        </div>
        <div class="mt-auto border-t border-zinc-800 px-6 py-4 flex flex-col items-center justify-center gap-1 text-center">
          <span class="text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-600">
            {{ locale.instanceId }}
          </span>
          <button
            type="button"
            class="max-w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors break-all leading-relaxed"
            :title="instanceId || locale.noInstanceId"
            :disabled="!instanceId"
            @click="copyInstanceId"
          >
            {{ instanceId || locale.noInstanceId }}
          </button>
        </div>
      </div>

      <!-- 快速操作 -->
      <div
        class="lg:col-span-3 bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col shadow-lg shadow-black/20"
      >
        <div class="px-6 py-5 border-b border-zinc-800">
          <h3 class="text-lg font-bold flex items-center gap-2">
            <Zap :size="18" class="text-yellow-500" /> {{ locale.quickActions }}
          </h3>
        </div>
        <div class="p-6 space-y-3">
          <button
            v-for="(action, i) in quickActions"
            :key="i"
            :class="[
              'w-full flex items-center gap-3 px-5 py-4 rounded-lg border font-bold text-sm transition-all text-left group',
              action.primary
                ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-900/20 hover:bg-blue-500'
                : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
            ]"
            @click="navigateTo(action.id)"
          >
            <component :is="action.icon" :size="18" />
            {{ action.label }}
            <ExternalLink v-if="action.primary" :size="14" class="ml-auto opacity-50" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  Ban,
  Bell,
  Calendar,
  Clock,
  ExternalLink,
  Heart,
  Inbox,
  Music,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Zap
} from '@lucide/vue'
import packageJson from '~~/package.json'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const emit = defineEmits(['navigate'])
const { success: showSuccess, error: showError } = useToast()
const { admin } = useLocale()
const locale = computed(() => useSafeLocale(admin.value?.overview || {}))
const { format: formatLocaleValue } = useLocaleText(locale)

const systemVersion = ref(packageJson.version)
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
const instanceId = ref('')

const systemStatus = ref({
  online: true,
  database: true,
  api: true
})

// 统计卡片数据
const statCards = computed(() => [
  {
    label: locale.value.statCards?.totalSongs || '总歌曲数',
    value: formatNumber(stats.value.totalSongs),
    icon: Music,
    color: 'blue',
    trend: stats.value.songsChange !== 0 ? `${Math.abs(stats.value.songsChange)}%` : null,
    trendDown: stats.value.songsChange < 0
  },
  {
    label: locale.value.statCards?.registeredUsers || '注册用户',
    value: formatNumber(stats.value.totalUsers),
    icon: Users,
    color: 'emerald'
  },
  {
    label: locale.value.statCards?.todaySchedules || '今日排班',
    value: formatNumber(stats.value.todaySchedules),
    icon: Calendar,
    color: 'zinc'
  },
  {
    label: locale.value.statCards?.weeklyRequests || '本周点歌',
    value: formatNumber(stats.value.weeklyRequests),
    icon: Heart,
    color: 'pink',
    trend: stats.value.requestsChange !== 0 ? `${Math.abs(stats.value.requestsChange)}%` : null,
    trendDown: stats.value.requestsChange < 0
  }
])

// 系统状态项
const statusItems = computed(() => [
  {
    label: locale.value.statusItems?.database || '数据库',
    value: systemStatus.value.database ? locale.value.normal || '正常' : locale.value.abnormal || '异常',
    active: systemStatus.value.database
  },
  {
    label: locale.value.statusItems?.api || 'API',
    value: systemStatus.value.api ? locale.value.normal || '正常' : locale.value.abnormal || '异常',
    active: systemStatus.value.api
  },
  {
    label: locale.value.statusItems?.semester || '当前学期',
    value: stats.value.currentSemester || locale.value.unset || '未设置',
    active: !!stats.value.currentSemester
  },
  {
    label: locale.value.statusItems?.blacklist || '黑名单',
    value: formatLocaleValue(locale.value.itemUnit, String(stats.value.blacklistCount), stats.value.blacklistCount),
    active: stats.value.blacklistCount >= 0
  },
  { label: locale.value.statusItems?.version || '版本', value: `v${systemVersion.value}`, active: true }
])

// 快速操作
const quickActions = computed(() => [
  { label: locale.value.actions?.schedule || '排班管理', icon: Calendar, id: 'schedule', primary: true },
  { label: locale.value.actions?.users || '用户管理', icon: Users, id: 'users' },
  { label: locale.value.actions?.notifications || '通知管理', icon: Bell, id: 'notifications' },
  { label: locale.value.actions?.blacklist || '黑名单', icon: Ban, id: 'blacklist' }
])

const formatNumber = (num) => {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const getActivityStyle = (type) => {
  const styles = {
    song: { icon: Music, bg: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    user: { icon: Users, bg: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
    schedule: { icon: Calendar, bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' }
  }

  return styles[type] || { icon: Activity, bg: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' }
}

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

const loadSystemStatus = async () => {
  try {
    const response = await $fetch('/api/system/status')
    systemStatus.value.online = response?.status === 'ok'
    systemStatus.value.database = !!response?.database?.connected
    systemStatus.value.api = response?.status === 'ok'
    instanceId.value = response?.instance?.instanceId || ''
  } catch (error) {
    console.error('加载系统状态失败:', error)
    systemStatus.value.online = false
    systemStatus.value.database = false
    systemStatus.value.api = false
    instanceId.value = ''
  }
}

const copyToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

const copyInstanceId = async () => {
  if (!instanceId.value) {
    showError(locale.value.noInstanceId || '暂无实例 ID')
    return
  }

  try {
    const copied = await copyToClipboard(instanceId.value)
    if (copied) {
      showSuccess(locale.value.copied || '已复制')
    } else {
      showError(locale.value.copyFailed || '复制失败')
    }
  } catch (error) {
    console.error('复制实例 ID 失败:', error)
    showError(locale.value.copyFailed || '复制失败')
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
  const now = getSyncedDate()
  const diff = now - date

  if (diff < 60000) return locale.value?.justNow || '刚刚'
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return formatLocaleValue(locale.value?.minutesAgo, `${minutes}分钟前`, minutes)
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return formatLocaleValue(locale.value?.hoursAgo, `${hours}小时前`, hours)
  }
  const days = Math.floor(diff / 86400000)
  return formatLocaleValue(locale.value?.daysAgo, `${days}天前`, days)
}

const navigateTo = (tab) => {
  emit('navigate', tab)
}

onMounted(() => {
  loadStats()
  loadSystemStatus()
  loadRecentActivities()
})
</script>

<style scoped>
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
