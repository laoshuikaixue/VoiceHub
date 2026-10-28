<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">
          {{ locale.desc }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div
          class="bg-bg-secondary-40 border border-border-secondary rounded-xl px-4 py-2 flex items-center gap-3"
        >
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
            >{{ locale.enableSelection }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enablePlayTimeSelection ? 'bg-primary-hover' : 'bg-bg-tertiary'
            ]"
            @click="toggleGlobalEnabled"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                enablePlayTimeSelection ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
        <div
          class="bg-bg-secondary-40 border border-border-secondary rounded-xl px-4 py-2 flex items-center gap-3"
          :title="locale.requireSlotDesc"
        >
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
            >{{ locale.requireSlot }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enablePlayTimeSelection ? '' : 'opacity-40 cursor-not-allowed',
              playSlotRequired ? 'bg-primary-hover' : 'bg-bg-tertiary'
            ]"
            :disabled="!enablePlayTimeSelection"
            @click="toggleSlotRequired"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                playSlotRequired ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
        <button
          class="flex items-center gap-2 px-6 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95"
          @click="openAddForm"
        >
          <Plus :size="14" /> {{ locale.add }}
        </button>
      </div>
    </div>

    <!-- 信息卡片 -->
    <div class="bg-primary-hover-5 border border-primary-10 rounded-xl p-5 flex items-start gap-4">
      <Info class="text-primary shrink-0 mt-0.5" :size="18" />
      <div class="space-y-1">
        <p class="text-xs font-bold text-text-secondary">{{ locale.aboutTitle }}</p>
        <p class="text-[11px] text-text-tertiary leading-relaxed">
          {{ locale.aboutDesc }}
        </p>
      </div>
    </div>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="flex flex-col items-center justify-center py-20 space-y-4 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl"
    >
      <AppSpinner :size="40" />
      <p class="text-xs font-black text-text-tertiary uppercase tracking-widest">{{ locale.loading }}</p>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="error"
      class="bg-error-5 border border-error-10 rounded-xl p-5 flex items-start gap-4"
    >
      <AlertCircle class="text-error shrink-0 mt-0.5" :size="18" />
      <div class="space-y-1">
        <p class="text-xs font-bold text-text-secondary">{{ locale.fetchFailed }}</p>
        <p class="text-[11px] text-text-tertiary leading-relaxed">{{ error }}</p>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="playTimes.length === 0"
      class="flex flex-col items-center justify-center py-20 space-y-6 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl"
    >
      <div class="flex items-center justify-center p-6 rounded-xl bg-bg-primary border border-border-secondary text-text-secondary">
        <Clock :size="48" />
      </div>
      <div class="text-center space-y-2">
        <h3 class="text-lg font-bold text-text-primary">{{ locale.emptyTitle }}</h3>
        <p class="text-xs text-text-tertiary">{{ locale.emptyDesc }}</p>
      </div>
    </div>

    <!-- 时段网格 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <TransitionGroup name="list">
        <div
          v-for="playTime in playTimes"
          :key="playTime.id"
          :class="[
            'group relative bg-bg-secondary-30 border rounded-xl p-8 transition-all hover:shadow-2xl hover:shadow-[0_25px_50px_var(--shadow-color-deep)]',
            playTime.enabled ? 'border-border-secondary-80' : 'border-border-secondary-40 opacity-60'
          ]"
        >
          <div class="flex items-start justify-between mb-6">
            <div
              :class="[
                'p-3 rounded-xl bg-bg-primary border border-border-secondary transition-all flex items-center justify-center',
                playTime.enabled ? 'text-primary border-primary-20' : 'text-text-secondary'
              ]"
            >
              <Clock :size="20" />
            </div>
            <div class="flex items-center gap-2">
              <span
                v-if="playTime.isDefault"
                class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-primary-10 text-primary border-primary-20"
              >
                {{ locale.defaultBadge }}
              </span>
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all',
                  playTime.enabled
                    ? 'bg-success-10 text-success border-success-20'
                    : 'bg-bg-tertiary-50 text-text-disabled border-border-tertiary-50'
                ]"
              >
                {{ playTime.enabled ? locale.enabled : locale.disabled }}
              </span>
              <button class="flex items-center justify-center p-1.5 text-text-secondary hover:text-text-tertiary">
                <MoreVertical :size="14" />
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <h4
                class="text-lg font-black text-text-primary group-hover:text-primary transition-colors"
              >
                {{ playTime.name }}
              </h4>
              <div
                class="flex items-center gap-2 mt-1.5 text-primary-80 font-black tracking-tighter"
              >
                <span class="text-xl">{{ playTime.startTime || locale.unlimited }}</span>
                <div class="w-4 h-[2px] bg-bg-tertiary" />
                <span class="text-xl">{{ playTime.endTime || locale.unlimited }}</span>
              </div>
            </div>

            <!-- 适用星期：未配置 = 每天均可选 -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="day in weekdayChips(playTime.weekdays)"
                :key="day.value"
                :class="[
                  'px-1.5 py-0.5 rounded text-[9px] font-black border transition-all',
                  day.active
                    ? 'bg-primary-10 text-primary border-primary-20'
                    : 'bg-bg-tertiary-50 text-text-disabled border-border-tertiary-50'
                ]"
              >
                {{ day.label }}
              </span>
            </div>

            <p class="text-xs text-text-tertiary font-medium leading-relaxed min-h-[32px] line-clamp-2">
              {{ playTime.description || locale.noDescription }}
            </p>
          </div>

          <div class="mt-8 pt-6 border-t border-border-secondary-50 flex items-center justify-between">
            <div class="flex gap-2">
              <button
                class="flex items-center justify-center p-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary hover:text-primary hover:border-primary-30 transition-all"
                @click="editPlayTime(playTime)"
              >
                <Edit2 :size="14" />
              </button>
              <button
                class="flex items-center justify-center p-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary hover:text-error hover:border-error-30 transition-all"
                @click="confirmDelete(playTime)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
            <button
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                playTime.enabled
                  ? 'bg-bg-tertiary text-text-tertiary hover:text-text-primary'
                  : 'bg-success text-text-primary shadow-lg shadow-[var(--success-glow-20)]'
              ]"
              @click="togglePlayTimeStatus(playTime)"
            >
              <Power :size="12" />
              {{ playTime.enabled ? locale.disable : locale.enable }}
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- 添加/编辑弹窗 -->
    <Transition name="modal">
      <div
        v-if="showAddForm || editingPlayTime"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-bg-primary-80 backdrop-blur-sm" @click="cancelForm" />
        <div
          class="relative w-full max-w-lg bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-black text-text-primary tracking-tight">
                {{ editingPlayTime ? locale.editTitle : locale.addTitle }}
              </h3>
              <button
                class="flex items-center justify-center p-2 text-text-tertiary hover:text-text-primary transition-colors"
                @click="cancelForm"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.name }}</label
                >
                <input
                  v-model="formData.name"
                  type="text"
                  :placeholder="locale.namePlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-lg px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>

              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                    >{{ locale.startTimeOptional }}</label
                  >
                  <AppTimePicker
                    v-model="formData.startTime"
                    :placeholder="locale.startTimeOptional"
                    size="md"
                    rounded="lg"
                  />
                  <p class="text-[9px] text-text-disabled px-1">{{ locale.startTimeHint }}</p>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                    >{{ locale.endTimeOptional }}</label
                  >
                  <AppTimePicker
                    v-model="formData.endTime"
                    :placeholder="locale.endTimeOptional"
                    size="md"
                    rounded="lg"
                  />
                  <p class="text-[9px] text-text-disabled px-1">{{ locale.endTimeHint }}</p>
                </div>
              </div>

              <div class="space-y-2">
                <label
                  class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 flex items-center gap-2"
                >
                  <CalendarDays :size="10" /> {{ locale.weekdaysTitle }}
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="day in weekdayOptions"
                    :key="day.value"
                    type="button"
                    :class="[
                      'px-3 py-2 rounded-lg text-xs font-black border transition-all',
                      formData.weekdays.includes(day.value)
                        ? 'bg-primary-hover-10 text-primary border-primary-30'
                        : 'bg-bg-primary border-border-secondary text-text-tertiary hover:border-border-tertiary'
                    ]"
                    @click="toggleWeekday(day.value)"
                  >
                    {{ day.label }}
                  </button>
                </div>
                <p class="text-[9px] text-text-disabled px-1">{{ locale.weekdaysHint }}</p>
              </div>

              <div class="space-y-2">
                <label
                  class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 flex items-center gap-2"
                >
                  <AlignLeft :size="10" /> {{ locale.descriptionOptional }}
                </label>
                <textarea
                  v-model="formData.description"
                  :placeholder="locale.descriptionPlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-lg px-5 py-4 text-sm text-text-primary focus:outline-none focus:border-primary-30 min-h-[100px] resize-none"
                />
              </div>

              <label class="flex items-center gap-3 cursor-pointer group px-1">
                <input
                  v-model="formData.enabled"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-primary"
                >
                <span
                  class="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors"
                  >{{ locale.enableThisPlayTime }}</span
                >
              </label>

              <label
                :class="[
                  'flex items-start gap-3 px-1 group',
                  formData.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                ]"
              >
                <input
                  v-model="formData.isDefault"
                  type="checkbox"
                  class="mt-0.5 w-4 h-4 rounded border-border-secondary bg-bg-primary"
                  :disabled="!formData.enabled"
                >
                <span class="min-w-0">
                  <span
                    class="block text-xs font-bold text-text-secondary group-hover:text-primary transition-colors"
                    >{{ locale.defaultSlot }}</span
                  >
                  <span class="mt-1 block text-[10px] leading-relaxed text-text-tertiary">{{
                    locale.defaultSlotHint
                  }}</span>
                </span>
              </label>

              <div
                v-if="formError"
                class="bg-error-10 border border-error-20 rounded-lg p-3 text-[11px] text-error"
              >
                {{ formError }}
              </div>
            </div>
          </div>

          <div class="px-8 py-6 bg-bg-primary-50 border-t border-border-secondary flex justify-end gap-3">
            <button
              class="px-6 py-2.5 text-xs font-bold text-text-tertiary hover:text-text-secondary"
              @click="cancelForm"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="formSubmitting"
              class="px-8 py-2.5 bg-primary-hover hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-black rounded-lg shadow-lg transition-all active:scale-95"
              @click="savePlayTime"
            >
              {{ formSubmitting ? locale.saving : locale.saveSettings }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认弹窗 -->
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-bg-primary-80 backdrop-blur-sm"
          @click="showDeleteConfirm = false"
        />
        <div
          class="relative w-full max-w-sm bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="p-8">
            <div class="flex flex-col items-center py-4 space-y-6">
              <div
                class="w-16 h-16 rounded-xl bg-error-10 text-error flex items-center justify-center border border-error-10 shadow-xl shadow-[var(--error-glow-5)]"
              >
                <AlertCircle :size="32" />
              </div>
              <div class="text-center space-y-2 px-4">
                <h4 class="text-lg font-bold text-text-primary">
                  {{ deleteConfirmTitleText }}
                </h4>
                <p class="text-xs text-text-tertiary leading-relaxed">
                  {{ locale.deleteConfirmDesc }}
                </p>
              </div>
              <div class="flex gap-3 w-full pt-4">
                <button
                  class="flex-1 px-4 py-3 bg-bg-primary border border-border-secondary text-text-tertiary text-xs font-black rounded-lg transition-all hover:bg-bg-tertiary"
                  @click="showDeleteConfirm = false"
                >
                  {{ locale.cancel }}
                </button>
                <button
                  :disabled="deleteInProgress"
                  class="flex-1 px-4 py-3 bg-error hover:bg-error disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-black rounded-lg shadow-xl shadow-[var(--error-glow-20)] transition-all active:scale-95"
                  @click="deletePlayTime"
                >
                  {{ deleteInProgress ? locale.deleting : locale.confirmDelete }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import type { PlayTime } from '~/types'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import AppTimePicker from '~/components/UI/Common/AppTimePicker.vue'
import {
  Plus,
  Clock,
  Edit2,
  Trash2,
  MoreVertical,
  Power,
  Info,
  AlertCircle,
  X,
  AlignLeft,
  CalendarDays
} from '@lucide/vue'

const { getAuthConfig, isAdmin } = useAuth()
const { showToast: showNotification } = useToast()
const { localize: localizeServerError } = useServerErrors()
const { admin } = useLocale()
const locale = computed(() => {
  const base = admin.value?.playTimeManager || {}
  const emptyText = () => ''
  return useSafeLocale({
    ...base,
    errors: { ...(base.errors || {}) },
    messages: { ...(base.messages || {}) },
    deleteConfirmTitle: base.deleteConfirmTitle || emptyText
  })
})

const playTimes = ref<PlayTime[]>([])
const loading = ref(false)
const error = ref('')
const showAddForm = ref(false)
const editingPlayTime = ref<PlayTime | null>(null)
const playTimeToDelete = ref<PlayTime | null>(null)
const showDeleteConfirm = ref(false)
const formSubmitting = ref(false)
const deleteInProgress = ref(false)
const formError = ref('')
const enablePlayTimeSelection = ref(false)
// 「点歌时段必选」总开关：开启后用户提交点歌必须选择播出日期与时段
const playSlotRequired = ref(false)
const deleteConfirmTitleText = computed(() => {
  const title = locale.value.deleteConfirmTitle
  const name = playTimeToDelete.value?.name || ''
  if (typeof title === 'function') return title(name)
  return (title || '').replace('{0}', name)
})

// 星期选项（0=周日 … 6=周六）
const weekdayOptions = computed(() => {
  const labels = locale.value.weekdaysFull || ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return [0, 1, 2, 3, 4, 5, 6].map((value) => ({ value, label: labels[value] }))
})

// 卡片上的星期展示：配置了星期则高亮显示，未配置则全部置灰（表示每天均可选）
const weekdayChips = (weekdays: number[] | null | undefined) => {
  const days = Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : null
  const labels = locale.value.weekdaysShort || ['日', '一', '二', '三', '四', '五', '六']
  return [0, 1, 2, 3, 4, 5, 6].map((value) => ({
    value,
    label: labels[value],
    active: days === null || days.includes(value)
  }))
}

// 勾选/取消适用星期
const toggleWeekday = (value: number) => {
  const index = formData.weekdays.indexOf(value)
  if (index >= 0) {
    formData.weekdays.splice(index, 1)
  } else {
    formData.weekdays.push(value)
    formData.weekdays.sort((a, b) => a - b)
  }
}

// 表单数据
const formData = reactive({
  id: 0,
  name: '',
  startTime: '',
  endTime: '',
  description: '',
  enabled: true,
  // 适用星期（0=周日…6=周六），空数组 = 每天均可选
  weekdays: [] as number[],
  // 默认播出时段：用户投稿未选择时段时自动预选
  isDefault: false
})

// 停用的时段不能作为默认时段：取消启用时同步取消默认勾选
watch(
  () => formData.enabled,
  (enabled) => {
    if (!enabled) formData.isDefault = false
  }
)

// 初始化
onMounted(async () => {
  await fetchPlayTimes()
  await fetchSystemSettings()
})

// 获取播出时段列表
const fetchPlayTimes = async () => {
  if (!isAdmin.value) {
    error.value = locale.value.errors.adminOnly
    return
  }

  loading.value = true
  error.value = ''

  try {
    const authConfig = getAuthConfig()
    const data = await $fetch('/api/admin/play-times', {
      ...authConfig
    })

    // 自定义排序：先按启用状态排序，然后有时间的排在前面，没有时间的排在后面
    playTimes.value = data.sort((a: PlayTime, b: PlayTime) => {
      // 默认时段排最前，便于识别
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1
      }

      // 然后按启用状态排序
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1 // 启用的排在前面
      }

      // 然后按是否有时间排序
      const aHasTime = !!(a.startTime || a.endTime)
      const bHasTime = !!(b.startTime || b.endTime)

      if (aHasTime !== bHasTime) {
        return aHasTime ? -1 : 1 // 有时间的排在前面
      }

      // 如果都有时间，按开始时间排序
      if (aHasTime && bHasTime) {
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime)
        } else if (a.startTime) {
          return -1
        } else if (b.startTime) {
          return 1
        }
      }

      // 最后按名称排序
      return a.name.localeCompare(b.name)
    })
  } catch (err: any) {
    error.value = localizeServerError(err, locale.value.errors.fetchPlayTimesFailed)
  } finally {
    loading.value = false
  }
}

// 获取系统设置
const fetchSystemSettings = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const data = await $fetch('/api/admin/system-settings', {
      ...authConfig
    })
    enablePlayTimeSelection.value = data.enablePlayTimeSelection
    playSlotRequired.value = data.playSlotRequired || false
  } catch (err: any) {
    console.error('获取系统设置失败:', getErrorMessage(err))
  }
}

// 切换全局启用状态。
const toggleGlobalEnabled = async () => {
  const prev = { enabled: enablePlayTimeSelection.value, required: playSlotRequired.value }
  const nextEnabled = !prev.enabled
  enablePlayTimeSelection.value = nextEnabled
  playSlotRequired.value = nextEnabled ? prev.required : false
  await savePlayTimeFlags(prev, locale.value.messages.systemSettingsUpdated, locale.value.errors.updateSystemSettingsFailed)
}

// 切换「时段必选」总开关（仅在总开关开启时可用）
const toggleSlotRequired = async () => {
  if (!enablePlayTimeSelection.value) return
  const prev = { enabled: enablePlayTimeSelection.value, required: playSlotRequired.value }
  playSlotRequired.value = !prev.required
  await savePlayTimeFlags(prev, locale.value.messages.slotRequiredUpdated, locale.value.errors.updateSlotRequiredFailed)
}

// 保存两个开关：两者相互约束，同一请求提交完整组合
const savePlayTimeFlags = async (prev, successMessage, failMessage) => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      body: {
        enablePlayTimeSelection: enablePlayTimeSelection.value,
        playSlotRequired: playSlotRequired.value
      },
      ...authConfig
    })

    showNotification(successMessage, 'success')
  } catch (err: any) {
    error.value = getErrorMessage(err) || failMessage
    showNotification(error.value, 'error')
    // 保存失败回滚两个开关状态
    enablePlayTimeSelection.value = prev.enabled
    playSlotRequired.value = prev.required
  }
}

// 打开添加表单
const openAddForm = () => {
  showAddForm.value = true
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true,
    weekdays: [],
    isDefault: false
  })
}

// 编辑播出时段
const editPlayTime = (playTime: PlayTime) => {
  editingPlayTime.value = playTime
  Object.assign(formData, {
    id: playTime.id,
    name: playTime.name,
    startTime: playTime.startTime || '',
    endTime: playTime.endTime || '',
    description: playTime.description || '',
    enabled: playTime.enabled,
    // 未配置星期 = 每天均可选，编辑时展示为空（不勾选任何一天）
    weekdays: Array.isArray(playTime.weekdays) ? [...playTime.weekdays].sort((a, b) => a - b) : [],
    isDefault: playTime.isDefault === true
  })
}

// 切换播出时段状态
const togglePlayTimeStatus = async (playTime: PlayTime) => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const updated: any = await $fetch(`/api/admin/play-times/${playTime.id}`, {
      method: 'PATCH',
      body: {
        enabled: !playTime.enabled
      },
      ...authConfig
    })

    // 更新本地数据
    await fetchPlayTimes()
    // 停用的如果是默认时段，后端会同时取消默认，按返回的 defaultCleared 给出明确提示
    const message = updated?.defaultCleared
      ? locale.value?.messages?.defaultSlotCleared || 'Default play time cleared'
      : playTime.enabled
        ? locale.value?.messages?.playTimeDisabled || 'Play time disabled'
        : locale.value?.messages?.playTimeEnabled || 'Play time enabled'
    showNotification(message, 'success')
  } catch (err: any) {
    error.value = localizeServerError(err, locale.value.errors.updatePlayTimeStatusFailed)
    showNotification(error.value, 'error')
  }
}

// 确认删除
const confirmDelete = (playTime: PlayTime) => {
  playTimeToDelete.value = playTime
  showDeleteConfirm.value = true
}

// 删除播出时段
const deletePlayTime = async () => {
  if (!playTimeToDelete.value || !isAdmin.value) return

  deleteInProgress.value = true

  try {
    const authConfig = getAuthConfig()
    await $fetch(`/api/admin/play-times/${playTimeToDelete.value.id}`, {
      method: 'DELETE',
      ...authConfig
    })

    // 更新本地数据
    await fetchPlayTimes()
    showDeleteConfirm.value = false
    playTimeToDelete.value = null
    showNotification(locale.value?.messages?.playTimeDeleted || 'Play time deleted', 'success')
  } catch (err: any) {
    error.value = localizeServerError(err, locale.value.errors.deletePlayTimeFailed)
    showNotification(error.value, 'error')
  } finally {
    deleteInProgress.value = false
  }
}

// 保存播出时段
const savePlayTime = async () => {
  formError.value = ''

  // 时间验证（仅当两个时间都有填写时才进行比较）
  if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
    formError.value = locale.value.errors.startBeforeEnd
    return
  }

  // 至少要有名称
  if (!formData.name.trim()) {
    formError.value = locale.value.errors.nameRequired
    return
  }

  // 检查名称是否重复
  const isUpdate = !!editingPlayTime.value
  const nameExists = playTimes.value.some(
    (pt) =>
      pt.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!isUpdate || pt.id !== formData.id)
  )

  if (nameExists) {
    formError.value = locale.value.errors.nameExists
    return
  }

  formSubmitting.value = true

  try {
    const authConfig = getAuthConfig()

    await $fetch(isUpdate ? `/api/admin/play-times/${formData.id}` : '/api/admin/play-times', {
      method: isUpdate ? 'PUT' : 'POST',
      body: {
        name: formData.name.trim(),
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        description: formData.description || null,
        enabled: formData.enabled,
        // 空数组 = 清除星期配置，恢复每天均可选
        weekdays: [...formData.weekdays].sort((a, b) => a - b),
        // 停用的时段不能作为默认时段
        isDefault: formData.enabled ? formData.isDefault : false
      },
      ...authConfig
    })

    // 更新本地数据
    await fetchPlayTimes()
    cancelForm()
    showNotification(
      isUpdate
        ? (locale.value?.messages?.playTimeUpdated || 'Play time updated')
        : (locale.value?.messages?.playTimeCreated || 'Play time created'),
      'success'
    )
  } catch (err: any) {
    formError.value = localizeServerError(err, locale.value.errors.savePlayTimeFailed)
    showNotification(formError.value, 'error')
  } finally {
    formSubmitting.value = false
  }
}

// 取消表单
const cancelForm = () => {
  showAddForm.value = false
  editingPlayTime.value = null
  formError.value = ''

  // 重置表单数据
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true,
    weekdays: [],
    isDefault: false
  })
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: all 0.3s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
  opacity: 0;
}
</style>
