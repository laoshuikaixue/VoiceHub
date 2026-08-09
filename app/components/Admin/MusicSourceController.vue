<template>
  <div class="max-w-[900px] mx-auto space-y-6 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ t.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">{{ t.description }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          @click="resetForm"
        >
          <RotateCcw :size="14" /> {{ t.reset }}
        </button>
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-6 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50"
          @click="saveConfig"
        >
          <template v-if="saving">
            <AppSpinner :size="14" /> {{ t.saving }}
          </template>
          <template v-else-if="saveSuccess">
            <CheckCircle2 :size="14" /> {{ t.saved }}
          </template>
          <template v-else>
            <Save :size="14" /> {{ t.saveConfig }}
          </template>
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="flex flex-col items-center justify-center py-20 bg-bg-secondary-20 border border-border-secondary-50 rounded-2xl space-y-4"
    >
      <AppSpinner :size="40" />
      <p class="text-xs font-black text-text-tertiary uppercase tracking-widest">{{ t.loading }}</p>
    </div>

    <div v-else class="space-y-6">
      <!-- 平台开关 -->
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 shadow-xl space-y-5">
        <div class="flex items-center justify-between border-b border-border-secondary pb-4">
          <h3 class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
            <ToggleLeft :size="16" class="text-warning" /> {{ t.switchTitle }}
          </h3>
          <button
            class="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border-secondary text-text-tertiary hover:text-text-primary hover:border-border-tertiary transition-all"
            @click="resetEnabledPlatforms"
          >
            <RotateCcw :size="12" /> {{ t.reset }}
          </button>
        </div>
        <p class="text-[10px] text-text-tertiary">{{ t.switchDesc }}</p>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="pf in platformOrder"
            :key="pf"
            :class="[
              'flex items-center justify-between p-3 border rounded-xl transition-all',
              enabledPlatforms.includes(pf)
                ? 'border-primary-10 bg-primary-5'
                : 'border-border-secondary bg-bg-secondary-60 opacity-60'
            ]"
          >
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold text-text-primary">{{ getPlatformLabel(pf) }}</span>
            </div>
            <button
              :class="[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-all cursor-pointer',
                enabledPlatforms.includes(pf) ? 'bg-primary' : 'bg-bg-tertiary-70'
              ]"
              @click="togglePlatform(pf)"
            >
              <span
                :class="[
                  'inline-block h-3.5 w-3.5 rounded-full bg-bg-primary shadow transition-transform',
                  enabledPlatforms.includes(pf) ? 'translate-x-5' : 'translate-x-1'
                ]"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- 平台排序 -->
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 shadow-xl space-y-5">
        <div class="flex items-center justify-between border-b border-border-secondary pb-4">
          <h3 class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
            <GripVertical :size="16" class="text-primary" /> {{ t.orderTitle }}
          </h3>
          <button
            class="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border-secondary text-text-tertiary hover:text-text-primary hover:border-border-tertiary transition-all"
            @click="resetPlatformOrder"
          >
            <RotateCcw :size="12" /> {{ t.resetOrder }}
          </button>
        </div>
        <p class="text-[10px] text-text-tertiary">{{ t.orderDesc }}</p>
        <div class="space-y-2">
          <TransitionGroup name="platform-order" tag="div" class="space-y-2">
            <div
              v-for="(pf, idx) in platformOrder"
              :key="pf"
              :class="[
                'flex items-center gap-3 p-3 border rounded-xl transition-all cursor-move select-none',
                dragOverIndex === idx ? 'border-t-2 border-t-primary' : '',
                enabledPlatforms.includes(pf)
                  ? 'border-border-secondary bg-bg-secondary-40'
                  : 'border-border-tertiary bg-bg-secondary-70 opacity-60'
              ]"
              draggable="true"
              @dragstart="handleDragStart($event, idx)"
              @dragend="handleDragEnd($event)"
              @dragover.prevent
              @dragenter.prevent="handleDragEnter($event, idx)"
              @dragleave="handleDragLeave"
              @drop.stop.prevent="handleDrop($event, idx)"
            >
              <span class="text-[10px] font-black text-text-tertiary w-5 text-center">{{ idx + 1 }}</span>
              <div class="flex items-center justify-center text-text-disabled hover:text-text-primary">
                <GripVertical :size="14" />
              </div>
              <div class="flex items-center gap-2 flex-1">
                <span class="text-xs font-medium text-text-primary">{{ getPlatformLabel(pf) }}</span>
                <span
                  :class="[
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    enabledPlatforms.includes(pf)
                      ? 'bg-primary-5 text-primary'
                      : 'bg-bg-tertiary-70 text-text-tertiary'
                  ]"
                >
                  {{ enabledPlatforms.includes(pf) ? platformStatusText.enabled : platformStatusText.disabled }}
                </span>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  ToggleLeft,
  GripVertical,
  Save,
  RotateCcw,
  CheckCircle2
} from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { usePlatformConfig, DEFAULT_PLATFORMS } from '~/composables/usePlatformConfig'
import { useLocale } from '~/utils/locale'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { getPlatformDisplayName } from '~/utils/platforms'

const { admin, siteConfig, currentLocale } = useLocale()
const { refreshPlatformConfig } = usePlatformConfig()
const { localize } = useServerErrors()

const showNotification = (msg, type) => {
  if (window.$showNotification) {
    window.$showNotification(msg, type)
  }
}

// 页面文案（音源控制页专属），使用 useSafeLocale + useLocaleText 模式
const locale = computed(() => useSafeLocale(admin.value?.musicSourceController || {}))
const { t: callT } = useLocaleText(locale)
const t = computed(() => ({
  title: callT('title'),
  description: callT('description'),
  saveConfig: callT('saveConfig'),
  saving: callT('saving'),
  saved: callT('saved'),
  reset: callT('reset'),
  loading: callT('loading'),
  fetchFailed: callT('fetchFailed'),
  saveSuccess: callT('saveSuccess'),
  saveFailedRetry: callT('saveFailedRetry'),
  switchTitle: callT('switchTitle'),
  switchDesc: callT('switchDesc'),
  orderTitle: callT('orderTitle'),
  orderDesc: callT('orderDesc'),
  resetOrder: callT('resetOrder'),
  mustKeepOne: callT('mustKeepOne')
}))

const siteLocale = computed(() => useSafeLocale(siteConfig.value || {}))
const { t: siteT } = useLocaleText(siteLocale)
const platformStatusText = computed(() => ({
  enabled: siteT('platformEnabled', '已启用'),
  disabled: siteT('platformDisabled', '已禁用')
}))

const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)

const enabledPlatforms = ref([...DEFAULT_PLATFORMS])
const platformOrder = ref([...DEFAULT_PLATFORMS])

const parsePlatformArray = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return [...DEFAULT_PLATFORMS]
    const valid = parsed.filter((p) => DEFAULT_PLATFORMS.includes(p))
    return valid.length > 0 ? valid : [...DEFAULT_PLATFORMS]
  } catch {
    return [...DEFAULT_PLATFORMS]
  }
}

const getPlatformLabel = (key) => getPlatformDisplayName(key, siteConfig.value, currentLocale.value)

// 拖拽排序（参考排期管理序列的交互模式：拖拽中仅标记插入位置，drop 时重排，配合 TransitionGroup 动画）
const dragOverIndex = ref(-1)
let draggedIndex = -1

const handleDragStart = (e, idx) => {
  draggedIndex = idx
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(idx))
  setTimeout(() => {
    e.target.classList.add('opacity-50')
  }, 0)
}

const handleDragEnter = (e, idx) => {
  e.preventDefault()
  dragOverIndex.value = idx
}

const handleDragLeave = (e) => {
  if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
    dragOverIndex.value = -1
  }
}

const handleDrop = (e, idx) => {
  e.preventDefault()
  dragOverIndex.value = -1
  if (draggedIndex === -1 || draggedIndex === idx) return
  const order = [...platformOrder.value]
  const [item] = order.splice(draggedIndex, 1)
  order.splice(idx, 0, item)
  platformOrder.value = order
}

const handleDragEnd = (e) => {
  e.target.classList.remove('opacity-50')
  draggedIndex = -1
  dragOverIndex.value = -1
}

const togglePlatform = (pf) => {
  const enabled = enabledPlatforms.value
  if (enabled.length <= 1 && enabled.includes(pf)) {
    showNotification(t.value.mustKeepOne || '至少保留一个平台启用', 'warning')
    return
  }
  if (enabled.includes(pf)) {
    enabledPlatforms.value = enabled.filter((p) => p !== pf)
  } else {
    enabledPlatforms.value = [...enabled, pf]
  }
}

// 重置启用状态到默认值
const resetEnabledPlatforms = () => {
  enabledPlatforms.value = [...DEFAULT_PLATFORMS]
}

// 重置排序到默认值
const resetPlatformOrder = () => {
  platformOrder.value = [...DEFAULT_PLATFORMS]
}

// 加载配置
const loadConfig = async () => {
  try {
    loading.value = true
    const data = await $fetch('/api/admin/system-settings', { credentials: 'include' })
    enabledPlatforms.value = parsePlatformArray(data.enabledPlatforms)
    platformOrder.value = parsePlatformArray(data.platformOrder)
  } catch (error) {
    console.error('加载音源配置失败:', error)
    showNotification(t.value.fetchFailed || '加载配置失败', 'error')
    enabledPlatforms.value = [...DEFAULT_PLATFORMS]
    platformOrder.value = [...DEFAULT_PLATFORMS]
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    saving.value = true
    const configToSave = {
      enabledPlatforms: JSON.stringify(enabledPlatforms.value),
      platformOrder: JSON.stringify(platformOrder.value)
    }

    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: configToSave
    })

    saveSuccess.value = true
    showNotification(t.value.saveSuccess || '音源配置已保存', 'success')
    // 刷新全局平台配置，确保 RequestForm 和搜索逻辑立即生效
    await refreshPlatformConfig()
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (error) {
    console.error('保存音源配置失败:', error)
    const msg = localize(error, t.value.saveFailedRetry || '保存失败')
    showNotification(msg, 'error')
  } finally {
    saving.value = false
  }
}

// 重置表单：重新从服务器加载原始数据
const resetForm = () => {
  loadConfig()
}

onMounted(loadConfig)
</script>

<style scoped>
/* 平台排序拖拽过渡动画 */
.platform-order-move,
.platform-order-enter-active,
.platform-order-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.platform-order-enter-from,
.platform-order-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.platform-order-leave-active {
  position: absolute;
  width: 100%;
}
</style>