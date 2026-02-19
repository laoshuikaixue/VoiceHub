<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 :size="24" class="text-blue-500 animate-spin mb-3" />
      <p class="text-zinc-500 text-xs font-medium">加载中...</p>
    </div>

    <div
      v-else-if="error"
      class="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <AlertCircle :size="16" class="text-rose-500" />
        <span class="text-xs text-rose-500 font-medium">{{ error }}</span>
      </div>
      <button
        class="px-3 py-1 bg-rose-500 text-white text-[10px] font-black uppercase rounded-lg hover:bg-rose-400 transition-all"
        @click="fetchSettings"
      >
        重试
      </button>
    </div>

    <div v-else class="space-y-4">
      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-zinc-200">歌曲被选中通知</h3>
          <p class="text-[11px] text-zinc-500 mt-0.5">当您投稿的歌曲被选中安排播放时通知您</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.songSelectedNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-zinc-200">歌曲已播放通知</h3>
          <p class="text-[11px] text-zinc-500 mt-0.5">当您投稿的歌曲被播放时通知您</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.songPlayedNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-zinc-200">歌曲获得投票通知</h3>
          <p class="text-[11px] text-zinc-500 mt-0.5">当您投稿的歌曲获得新投票时通知您</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.songVotedNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div
        v-if="localSettings.songVotedNotify"
        class="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-zinc-500 uppercase tracking-widest">投票通知阈值</h3>
          <span class="text-xs font-bold text-blue-500"
            >每获得 {{ localSettings.songVotedThreshold }} 票通知一次</span
          >
        </div>
        <input
          v-model.number="localSettings.songVotedThreshold"
          type="range"
          max="10"
          min="1"
          step="1"
          class="w-full h-1.5 bg-zinc-800 rounded-full appearance-none accent-blue-600 cursor-pointer"
          @change="saveSettings"
        >
        <div class="flex justify-between text-[10px] font-black text-zinc-700">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-zinc-200">系统通知</h3>
          <p class="text-[11px] text-zinc-500 mt-0.5">接收系统公告和其他重要通知</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.systemNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div class="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h3 class="text-sm font-bold text-zinc-200">通知刷新间隔</h3>
            <p class="text-[11px] text-zinc-500 mt-0.5">设置通知自动刷新的时间间隔</p>
          </div>
          <span class="text-xs font-bold text-blue-500">{{
            formatRefreshInterval(localSettings.refreshInterval)
          }}</span>
        </div>
        <input
          v-model.number="localSettings.refreshInterval"
          type="range"
          max="300"
          min="10"
          step="10"
          class="w-full h-1.5 bg-zinc-800 rounded-full appearance-none accent-blue-600 cursor-pointer"
          @change="saveSettings"
        >
        <div class="flex justify-between text-[10px] font-black text-zinc-700">
          <span>10s</span>
          <span>5m</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Loader2, AlertCircle } from 'lucide-vue-next'
import { useNotifications } from '~/composables/useNotifications'

const notificationsService = useNotifications()
const loading = computed(() => notificationsService.loading.value)
const error = computed(() => notificationsService.error.value)
const settings = computed(() => notificationsService.settings.value)

// 样式类
const itemClass =
  'flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-2xl hover:bg-zinc-900/50 transition-all'

// 本地设置，用于双向绑定
const localSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 1,
  systemNotify: true,
  refreshInterval: 60
})

// 监听设置变化
watch(
  settings,
  (newSettings) => {
    if (newSettings) {
      localSettings.value = {
        songSelectedNotify: newSettings.songSelectedNotify,
        songPlayedNotify: newSettings.songPlayedNotify,
        songVotedNotify: newSettings.songVotedNotify,
        songVotedThreshold: newSettings.songVotedThreshold || 1,
        systemNotify: newSettings.systemNotify,
        refreshInterval: newSettings.refreshInterval || 60
      }
    }
  },
  { immediate: true }
)

// 初始化
onMounted(async () => {
  await fetchSettings()
})

// 获取设置
const fetchSettings = async () => {
  await notificationsService.fetchNotificationSettings()
}

// 保存设置
const saveSettings = async () => {
  await notificationsService.updateNotificationSettings(localSettings.value)
}

// 格式化刷新间隔
const formatRefreshInterval = (seconds) => {
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
  }
}
</script>

<style scoped>
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #2563eb; /* blue-600 */
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #2563eb;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

input[type='range']::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}
</style>
