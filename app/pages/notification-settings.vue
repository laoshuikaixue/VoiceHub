<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900/50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1000px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-zinc-100"
            @click="goBack"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h1>
            <p class="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">
              {{ locale.subtitle }}
            </p>
          </div>
        </div>

        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          @click="saveSettings"
        >
          <template v-if="saving"> <Loader2 :size="14" class="animate-spin" /> {{ locale.saving }} </template>
          <template v-else> <Save :size="14" /> {{ locale.saveSettings }} </template>
        </button>
      </div>
    </div>

    <div class="max-w-[1000px] mx-auto px-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-32">
        <Loader2 :size="32" class="text-blue-500 animate-spin mb-4" />
        <p class="text-zinc-500 text-sm font-medium">{{ locale.loading }}</p>
      </div>

      <div v-else class="space-y-8">
        <!-- 站内通知设置 -->
        <section :class="sectionClass">
          <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
            <div class="p-2.5 bg-blue-500/10 rounded-xl">
              <Bell :size="20" class="text-blue-500" />
            </div>
            <div>
              <h2 class="text-base font-black text-zinc-100">{{ locale.inAppTitle }}</h2>
              <p class="text-xs text-zinc-500 mt-0.5">{{ locale.inAppDesc }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 歌曲被选中消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">{{ locale.songSelectedTitle }}</h3>
                <p class="text-[11px] text-zinc-500 mt-1">{{ locale.songSelectedDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songSelectedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 歌曲已播放消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">{{ locale.songPlayedTitle }}</h3>
                <p class="text-[11px] text-zinc-500 mt-1">{{ locale.songPlayedDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songPlayedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 歌曲获得投票消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">{{ locale.songVotedTitle }}</h3>
                <p class="text-[11px] text-zinc-500 mt-1">{{ locale.songVotedDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songVotedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 系统通知 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">{{ locale.systemTitle }}</h3>
                <p class="text-[11px] text-zinc-500 mt-1">{{ locale.systemDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.systemNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 投票阈值设置 -->
            <div :class="[itemClass, 'md:col-span-1']">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">{{ locale.voteThresholdTitle }}</h3>
                <p class="text-[11px] text-zinc-500 mt-1">{{ locale.voteThresholdDesc }}</p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="localSettings.songVotedThreshold"
                  type="number"
                  max="100"
                  min="1"
                  class="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-blue-500/30"
                >
                <span class="text-[10px] font-black text-zinc-600 uppercase">{{ locale.voteUnit }}</span>
              </div>
            </div>

            <!-- 通知刷新间隔 -->
            <div :class="[itemClass, 'md:col-span-1']">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">{{ locale.refreshTitle }}</h3>
                <p class="text-[11px] text-zinc-500 mt-1">{{ locale.refreshDesc }}</p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="localSettings.refreshInterval"
                  type="range"
                  max="300"
                  min="30"
                  step="30"
                  class="w-24 h-1.5 bg-zinc-800 rounded-full appearance-none accent-blue-600 cursor-pointer"
                >
                <span class="text-[11px] font-bold text-blue-500 min-w-[40px] text-right"
                  >{{ localSettings.refreshInterval }}s</span
                >
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Bell, ArrowLeft, Save, Loader2 } from '@lucide/vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { siteTitle, initSiteConfig } = useSiteConfig()
const { showToast } = useToast()
const { pages } = useLocale()
const locale = computed(() => pages.value?.notificationSettings || {})

// 样式类常量
const sectionClass = 'bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl'
const itemClass =
  'flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-2xl hover:bg-zinc-900/50 transition-all group'

// 页面状态
const loading = ref(true)
const saving = ref(false)

// 通知设置
const localSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 5,
  systemNotify: true,
  refreshInterval: 60
})

// 通知显示函数
const showNotification = (message, type = 'info') => {
  showToast(message, type)
}

// 返回主页
const goBack = () => {
  navigateTo('/')
}

// 页面初始化
onMounted(async () => {
  await initSiteConfig()

  // 设置页面标题
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `${locale.value.title} | ${siteTitle.value}`
  }

  await loadSettings()
})

// 加载设置
const loadSettings = async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/notifications/settings')

    if (response.success) {
      localSettings.value = {
        songSelectedNotify: response.data.songSelectedNotify || false,
        songPlayedNotify: response.data.songPlayedNotify || false,
        songVotedNotify: response.data.songVotedNotify || false,
        songVotedThreshold: response.data.songVotedThreshold || 5,
        systemNotify: response.data.systemNotify || true,
        refreshInterval: response.data.refreshInterval || 60
      }
    }
  } catch (err) {
    console.error(locale.value.loadFailedLog, err)
    showNotification(locale.value.loadFailed, 'error')
  } finally {
    loading.value = false
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    saving.value = true
    const response = await $fetch('/api/notifications/settings', {
      method: 'POST',
      body: localSettings.value
    })
    if (response.success) {
      showNotification(locale.value.saveSuccess, 'success')
    } else {
      showNotification(response.message || locale.value.saveFailed, 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || locale.value.saveFailed, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
</style>
