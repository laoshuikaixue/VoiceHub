<template>
  <div class="min-h-screen bg-[#121318] text-zinc-200 pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-[#121318]/80 backdrop-blur-xl border-b border-zinc-900/50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1200px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-zinc-100"
            @click="goBack"
            title="返回"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-zinc-100 tracking-tight">客户端设置</h1>
            <p class="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">
              Desktop Settings
            </p>
          </div>
        </div>

        <button
          :disabled="!apiUrl"
          class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveApiUrl"
        >
          <template v-if="saving"> <Loader2 :size="14" class="animate-spin" /> 保存中... </template>
          <template v-else> <Save :size="14" /> 保存配置 </template>
        </button>
      </div>
    </div>

    <div class="max-w-[1200px] mx-auto px-4">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 左列：服务器连接 & 系统信息 -->
        <div class="space-y-6">
          <!-- 服务器连接 -->
          <section :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-blue-500/10 rounded-xl">
                <Server :size="20" class="text-blue-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">服务器连接</h2>
                <p class="text-xs text-zinc-500 mt-0.5">配置 VoiceHub 服务器的连接地址</p>
              </div>
            </div>

            <div class="space-y-4">
              <div :class="cardClass">
                <label class="text-xs font-bold text-zinc-400 mb-2 block">服务器地址</label>
                <div class="flex gap-3">
                  <div class="relative flex-1">
                    <input
                      v-model="apiUrl"
                      type="text"
                      placeholder="例如：http://localhost:3000"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                      :class="{ 'border-rose-500/50': connectionStatus?.type === 'error', 'border-emerald-500/50': connectionStatus?.type === 'success' }"
                    />
                    <div v-if="connectionStatus" class="absolute right-3 top-2.5">
                      <Loader2 v-if="connectionStatus.type === 'info'" :size="16" class="animate-spin text-zinc-500" />
                      <CheckCircle2 v-else-if="connectionStatus.type === 'success'" :size="16" class="text-emerald-500" />
                      <AlertCircle v-else-if="connectionStatus.type === 'error'" :size="16" class="text-rose-500" />
                    </div>
                  </div>
                  <button
                    :disabled="!apiUrl || testing"
                    class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                    @click="testConnection"
                  >
                    <Activity :size="14" />
                    {{ testing ? '测试' : '测试' }}
                  </button>
                </div>
                
                <transition name="fade">
                  <p v-if="connectionStatus" :class="['text-[10px] font-medium mt-2 ml-1 flex items-center gap-1.5', statusColorClass]">
                    {{ connectionStatus.message }}
                  </p>
                </transition>
              </div>
            </div>
          </section>

          <!-- 系统信息 -->
          <section class="px-6 py-4 rounded-2xl border border-zinc-800/30 bg-zinc-900/20">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-1">客户端版本</span>
                <span class="text-sm font-mono text-zinc-400">v1.0.0</span>
              </div>
              <div>
                <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-1">运行平台</span>
                <span class="text-sm font-mono text-zinc-400">{{ platform }}</span>
              </div>
              <div class="sm:col-span-2">
                <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-1">配置文件路径</span>
                <code class="text-[11px] font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded block overflow-hidden text-ellipsis whitespace-nowrap">{{ configPath || '未找到' }}</code>
              </div>
            </div>
          </section>
        </div>

        <!-- 右列：通用设置 & 定时播放 -->
        <div class="space-y-6">
          <!-- 通用设置 -->
          <section :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-purple-500/10 rounded-xl">
                <Settings :size="20" class="text-purple-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">通用设置</h2>
                <p class="text-xs text-zinc-500 mt-0.5">自定义应用的行为与外观</p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4">
              <!-- 开机自启 -->
              <div :class="itemClass">
                <div class="flex-1">
                  <h3 class="text-sm font-bold text-zinc-200">开机自启</h3>
                  <p class="text-[11px] text-zinc-500 mt-1">系统启动时自动运行应用</p>
                </div>
                <div class="shrink-0">
                  <input
                    v-model="preferences.autoStart"
                    type="checkbox"
                    class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                    @change="savePreferences"
                  >
                </div>
              </div>

              <!-- 最小化到托盘 -->
              <div :class="itemClass">
                <div class="flex-1">
                  <h3 class="text-sm font-bold text-zinc-200">最小化到托盘</h3>
                  <p class="text-[11px] text-zinc-500 mt-1">点击最小化按钮时隐藏到系统托盘</p>
                </div>
                <div class="shrink-0">
                  <input
                    v-model="preferences.minimizeToTray"
                    type="checkbox"
                    class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                    @change="savePreferences"
                  >
                </div>
              </div>

              <!-- 关闭时隐藏 -->
              <div :class="itemClass">
                <div class="flex-1">
                  <h3 class="text-sm font-bold text-zinc-200">关闭时隐藏</h3>
                  <p class="text-[11px] text-zinc-500 mt-1">点击关闭按钮时最小化而非退出</p>
                </div>
                <div class="shrink-0">
                  <input
                    v-model="preferences.closeToTray"
                    type="checkbox"
                    class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                    @change="savePreferences"
                  >
                </div>
              </div>
            </div>
          </section>

          <!-- 定时播放 -->
          <section :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-emerald-500/10 rounded-xl">
                <Clock :size="20" class="text-emerald-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">定时播放</h2>
                <p class="text-xs text-zinc-500 mt-0.5">自动化广播排期任务</p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4">
              <!-- 启用定时播放 -->
              <div :class="itemClass">
                <div class="flex-1">
                  <h3 class="text-sm font-bold text-zinc-200">启用定时播放</h3>
                  <p class="text-[11px] text-zinc-500 mt-1">根据排期表自动播放歌曲</p>
                </div>
                <div class="shrink-0">
                  <input
                    v-model="preferences.enableScheduledPlay"
                    type="checkbox"
                    class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                    @change="savePreferences"
                  >
                </div>
              </div>

              <!-- 自动同步排期 -->
              <div :class="itemClass">
                <div class="flex-1">
                  <h3 class="text-sm font-bold text-zinc-200">自动同步排期</h3>
                  <p class="text-[11px] text-zinc-500 mt-1">定期从服务器同步最新排期表</p>
                </div>
                <div class="shrink-0">
                  <input
                    v-model="preferences.autoSyncSchedule"
                    type="checkbox"
                    class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                    @change="savePreferences"
                  >
                </div>
              </div>

              <!-- 手动同步 -->
              <div :class="cardClass">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-xs text-zinc-500">
                    <RefreshCw :size="12" />
                    <span>上次同步: {{ lastSyncTime || '从未同步' }}</span>
                  </div>
                  <button
                    class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5"
                    @click="syncScheduleNow"
                    :disabled="!apiUrl"
                  >
                    <RefreshCw :size="12" :class="{ 'animate-spin': syncing }" />
                    {{ syncing ? '同步中...' : '立即同步' }}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ArrowLeft, 
  Server, 
  Settings, 
  Clock, 
  Activity, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-vue-next'

const router = useRouter()
const { apiBaseUrl, setApiUrl, getPreferences, setPreferences: savePrefs } = useDesktopAPI()

// 样式常量
const sectionClass = 'bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-2xl'
const cardClass = 'bg-zinc-950/40 border border-zinc-800/50 rounded-2xl p-5 transition-all hover:border-zinc-700/50'
const itemClass = 'flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-2xl hover:bg-zinc-900/50 transition-all group'

const apiUrl = ref('')
const platform = ref('Unknown')
const configPath = ref('')
const connectionStatus = ref<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
const lastSyncTime = ref('')
const saving = ref(false)
const testing = ref(false)
const syncing = ref(false)

const preferences = ref({
  autoStart: false,
  minimizeToTray: true,
  closeToTray: true,
  enableScheduledPlay: false,
  autoSyncSchedule: true
})

const statusColorClass = computed(() => {
  if (!connectionStatus.value) return ''
  switch (connectionStatus.value.type) {
    case 'success': return 'text-emerald-500'
    case 'error': return 'text-rose-500'
    case 'info': return 'text-blue-500'
    default: return 'text-zinc-500'
  }
})

onMounted(async () => {
  // 加载当前API地址
  apiUrl.value = apiBaseUrl.value

  // 加载平台信息
  if (window.electron) {
    platform.value = window.electron.platform
    
    // 获取配置文件路径
    const path = await window.electron.getConfigPath?.()
    if (path) {
      configPath.value = path
    }
  }

  // 加载用户偏好
  const prefs = await getPreferences()
  if (prefs) {
    preferences.value = { ...preferences.value, ...prefs }
  }

  // 加载上次同步时间
  loadLastSyncTime()
})

const goBack = () => {
  router.back()
}

const saveApiUrl = async () => {
  if (!apiUrl.value) return
  
  saving.value = true
  try {
    const result = await setApiUrl(apiUrl.value)
    if (result?.success) {
      // 更新运行时配置
      const { $updateDesktopApiUrl } = useNuxtApp()
      if ($updateDesktopApiUrl) {
        $updateDesktopApiUrl(apiUrl.value)
      }

      connectionStatus.value = {
        type: 'success',
        message: '配置已保存'
      }
      setTimeout(() => {
        connectionStatus.value = null
      }, 3000)
    } else {
      connectionStatus.value = {
        type: 'error',
        message: '保存失败，请检查权限'
      }
    }
  } finally {
    saving.value = false
  }
}

const savePreferences = async () => {
  await savePrefs(preferences.value)
}

const testConnection = async () => {
  testing.value = true
  connectionStatus.value = {
    type: 'info',
    message: '正在连接服务器...'
  }
  
  try {
    // 确保 URL 格式正确
    let url = apiUrl.value.trim()
    if (!url) {
      testing.value = false
      return
    }
    if (!url.startsWith('http')) {
      url = `http://${url}`
      apiUrl.value = url // 自动补全
    }

    const response = await fetch(`${url}/api/songs/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      connectionStatus.value = {
        type: 'success',
        message: `连接成功！服务器在线 (歌曲数: ${data.length || 0})`
      }
    } else {
      connectionStatus.value = {
        type: 'error',
        message: `连接失败 (HTTP ${response.status})`
      }
    }
  } catch (error) {
    connectionStatus.value = {
      type: 'error',
      message: '无法连接到服务器，请检查地址或网络'
    }
  } finally {
    testing.value = false
  }
}

// 模拟加载上次同步时间
const loadLastSyncTime = () => {
  const time = localStorage.getItem('last_schedule_sync')
  if (time) {
    lastSyncTime.value = new Date(Number(time)).toLocaleString()
  }
}

const syncScheduleNow = async () => {
  syncing.value = true
  // 模拟同步延迟
  await new Promise(resolve => setTimeout(resolve, 1000))
  localStorage.setItem('last_schedule_sync', Date.now().toString())
  loadLastSyncTime()
  syncing.value = false
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 简单的设置按钮样式，无背景，仅hover变色 */
.settings-btn-simple {
  @apply text-zinc-400 hover:text-zinc-100 transition-colors p-1;
}
</style>
