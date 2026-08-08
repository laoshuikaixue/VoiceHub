<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 :size="24" class="text-primary animate-spin mb-3" />
      <p class="text-text-tertiary text-xs font-medium">{{ locale.loadingShort }}</p>
    </div>

    <div
      v-else-if="error"
      class="p-4 bg-error-10 border border-error-20 rounded-xl flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <AlertCircle :size="16" class="text-error" />
        <span class="text-xs text-error font-medium">{{ error }}</span>
      </div>
      <button
        class="px-3 py-1 bg-error text-text-primary text-[10px] font-black uppercase rounded-lg hover:bg-error transition-all"
        @click="fetchSettings"
      >
        {{ locale.retry }}
      </button>
    </div>

    <div v-else class="space-y-4">
      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-text-primary">{{ locale.songSelectedTitle }}</h3>
          <p class="text-[11px] text-text-tertiary mt-0.5">{{ locale.songSelectedDesc }}</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.songSelectedNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-text-primary">{{ locale.songPlayedTitle }}</h3>
          <p class="text-[11px] text-text-tertiary mt-0.5">{{ locale.songPlayedDesc }}</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.songPlayedNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-text-primary">{{ locale.songVotedTitle }}</h3>
          <p class="text-[11px] text-text-tertiary mt-0.5">{{ locale.songVotedDesc }}</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.songVotedNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div
        v-if="localSettings.songVotedNotify"
        class="p-4 bg-bg-primary-50 border border-border-secondary rounded-2xl space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-text-tertiary uppercase tracking-widest">{{ locale.voteThresholdTitle }}</h3>
          <span class="text-xs font-bold text-primary"
            >{{ formatLocaleValue(locale.voteThresholdText, localSettings.songVotedThreshold) }}</span
          >
        </div>
        <input
          v-model.number="localSettings.songVotedThreshold"
          type="range"
          max="10"
          min="1"
          step="1"
          class="w-full h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer"
          @change="saveSettings"
        >
        <div class="flex justify-between text-[10px] font-black text-text-secondary">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      <div :class="itemClass">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-text-primary">{{ locale.systemTitle }}</h3>
          <p class="text-[11px] text-text-tertiary mt-0.5">{{ locale.systemDesc }}</p>
        </div>
        <div class="shrink-0">
          <input
            v-model="localSettings.systemNotify"
            type="checkbox"
            class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            @change="saveSettings"
          >
        </div>
      </div>

      <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-2xl space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h3 class="text-sm font-bold text-text-primary">{{ locale.refreshTitle }}</h3>
            <p class="text-[11px] text-text-tertiary mt-0.5">{{ locale.refreshDesc }}</p>
          </div>
          <span class="text-xs font-bold text-primary">{{
            formatRefreshInterval(localSettings.refreshInterval)
          }}</span>
        </div>
        <input
          v-model.number="localSettings.refreshInterval"
          type="range"
          max="300"
          min="10"
          step="10"
          class="w-full h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer"
          @change="saveSettings"
        >
        <div class="flex justify-between text-[10px] font-black text-text-secondary">
          <span>10s</span>
          <span>5m</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Loader2, AlertCircle } from '@lucide/vue'
import { useNotifications } from '~/composables/useNotifications'
import { useLocale } from '~/utils/locale'

const notificationsService = useNotifications()
const { pages } = useLocale()
const locale = computed(() => pages.value?.notificationSettings || {})
const loading = computed(() => notificationsService.loading.value)
const error = computed(() => notificationsService.error.value)
const settings = computed(() => notificationsService.settings.value)

// 样式类
const itemClass =
  'flex items-center justify-between p-4 bg-bg-primary-30 border border-border-secondary rounded-2xl hover:bg-bg-secondary-50 transition-all'

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
    return formatLocaleValue(locale.value?.seconds, seconds) || `${seconds}s`
  } else {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0
      ? formatLocaleValue(locale.value?.minutesSeconds, minutes, remainingSeconds) || `${minutes}m ${remainingSeconds}s`
      : formatLocaleValue(locale.value?.minutes, minutes) || `${minutes}m`
  }
}
</script>

<style scoped>
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: var(--color-accent-hover); /* blue-600 */
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--color-accent-hover);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

input[type='range']::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}
</style>
