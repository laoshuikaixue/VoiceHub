<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20 px-2">
    <!-- 顶部标题和全局开关 -->
    <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
      <div class="space-y-1">
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-zinc-500">{{ locale.desc }}</p>
      </div>

      <div
        class="flex flex-wrap items-center gap-4 bg-zinc-900/40 border border-zinc-800 p-2 rounded-3xl"
      >
        <div class="flex items-center gap-3 px-3 border-r border-zinc-800/50 mr-1">
          <span class="text-[10px] font-black text-zinc-500 uppercase tracking-widest"
            >{{ locale.currentStatus }}</span
          >
          <span
            :class="[
              'px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all',
              hitRequestTime ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
            ]"
          >
            {{ hitRequestTime ? locale.open : locale.closed }}
          </span>
        </div>

        <div class="flex items-center gap-3 px-2">
          <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest"
            >{{ locale.enableRequest }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enableRequest ? 'bg-blue-600' : 'bg-zinc-800'
            ]"
            @click="toggleGlobalRequest"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-white rounded-full transition-all',
                enableRequest ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>

        <div class="flex items-center gap-3 px-2 border-l border-zinc-800/50">
          <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest"
            >{{ locale.enableTimeLimit }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enableRequestTimeLimitation ? 'bg-purple-600' : 'bg-zinc-800'
            ]"
            @click="toggleTimeLimitation"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-white rounded-full transition-all',
                enableRequestTimeLimitation ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- 添加时段按钮卡片 -->
      <button
        class="group relative h-full min-h-[220px] bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-blue-600/5 hover:border-blue-500/40 transition-all active:scale-95"
        @click="showAddForm = true"
      >
        <div
          class="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-blue-500 group-hover:bg-blue-600/10 group-hover:border-blue-500/20 transition-all"
        >
          <Plus :size="28" />
        </div>
        <div class="text-center">
          <h4
            class="text-sm font-black text-zinc-400 group-hover:text-blue-400 transition-colors uppercase tracking-widest"
          >
            {{ locale.addTime }}
          </h4>
          <p class="text-[10px] text-zinc-600 mt-1">{{ locale.addTimeDesc }}</p>
        </div>
      </button>

      <!-- 时段列表 -->
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="slot in requestTimes"
          :key="slot.id"
          :class="[
            'group bg-zinc-900/40 border rounded-3xl p-8 space-y-6 transition-all hover:shadow-2xl hover:shadow-black/40',
            slot.enabled && !slot.past ? 'border-zinc-800' : 'border-zinc-800/40 opacity-60'
          ]"
        >
          <div class="flex items-start justify-between">
            <div
              :class="[
                'p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-400 transition-colors',
                slot.enabled && !slot.past
                  ? 'text-blue-500 border-blue-500/20 shadow-lg shadow-blue-900/10'
                  : ''
              ]"
            >
              <Calendar :size="22" />
            </div>
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all',
                  slot.past
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : slot.enabled
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/50'
                ]"
              >
                {{ slot.past ? locale.expired : slot.enabled ? locale.enabled : locale.disabled }}
              </span>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <h4
                class="text-lg font-black text-zinc-100 flex items-baseline gap-2 group-hover:text-blue-400 transition-colors"
              >
                {{ slot.name }}
                <span class="text-xs font-bold text-zinc-600 tracking-tight"
                  >({{ slot.accepted }}/{{ slot.expected || '∞' }})</span
                >
              </h4>
              <div class="mt-3 space-y-2">
                <div class="flex items-center gap-2 text-zinc-500 font-bold">
                  <Clock :size="12" class="text-zinc-700" />
                  <span class="text-[10px] uppercase tracking-tighter truncate">{{
                    slot.startTime || locale.unlimited
                  }}</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-500 font-bold">
                  <div class="w-3 h-[2px] bg-zinc-800 ml-1.5" />
                  <span class="text-[10px] uppercase tracking-tighter truncate">{{
                    slot.endTime || locale.unlimited
                  }}</span>
                </div>
              </div>
            </div>

            <p
              class="text-xs text-zinc-500 font-medium leading-relaxed min-h-[32px] line-clamp-2 italic"
            >
              {{ slot.description || locale.noDescription }}
            </p>

            <!-- 投稿进度条 -->
            <div class="space-y-1.5">
              <div
                class="flex justify-between text-[9px] font-black text-zinc-600 uppercase tracking-widest px-0.5"
              >
                <span>{{ locale.progress }}</span>
                <span
                  >{{
                    slot.expected > 0
                      ? Math.min(100, Math.round((slot.accepted / slot.expected) * 100))
                      : 0
                  }}%</span
                >
              </div>
              <div
                class="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50"
              >
                <div
                  class="h-full transition-all duration-500"
                  :style="{
                    width: `${slot.expected > 0 ? Math.min(100, (slot.accepted / slot.expected) * 100) : 0}%`
                  }"
                  :class="
                    slot.expected > 0 && slot.accepted >= slot.expected
                      ? 'bg-rose-500'
                      : 'bg-blue-500'
                  "
                />
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-zinc-800/50 flex items-center justify-between">
            <div class="flex gap-2">
              <button
                v-show="!slot.past"
                class="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                @click="editRequestTime(slot)"
              >
                <Edit2 :size="14" />
              </button>
              <button
                class="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                @click="confirmDelete(slot)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
            <button
              v-show="!slot.past"
              :class="[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                slot.enabled
                  ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
              ]"
              @click="toggleRequestTimeStatus(slot)"
            >
              <Power :size="12" />
              {{ slot.enabled ? locale.disable : locale.enable }}
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- 统计概览 -->
    <div
      class="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
    >
      <div v-for="(stat, i) in stats" :key="i" class="flex items-center gap-4 group">
        <div
          :class="[
            'w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 transition-colors',
            `group-hover:text-${stat.color}-500`
          ]"
        >
          <component :is="stat.icon" :size="20" />
        </div>
        <div>
          <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            {{ stat.label }}
          </p>
          <h5 class="text-xl font-black text-zinc-200">{{ stat.value }}</h5>
        </div>
      </div>
    </div>

    <!-- 添加/编辑模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showAddForm || editingRequestTime"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
      >
        <div
          class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 class="text-xl font-black text-zinc-100">
              {{ editingRequestTime ? locale.editTitle : locale.addTitle }}
            </h3>
            <button class="text-zinc-500 hover:text-zinc-300 transition-colors" @click="cancelForm">
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.name }}</label
              >
              <input
                v-model="formData.name"
                type="text"
                :placeholder="locale.namePlaceholder"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30"
              >
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.startDateTime }}</label
                >
                <input
                  v-model="formData.startTime"
                  type="datetime-local"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.endDateTime }}</label
                >
                <input
                  v-model="formData.endTime"
                  type="datetime-local"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.expectedCount }}</label
                >
                <div class="relative group">
                  <input
                    v-model="formData.expected"
                    type="number"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30"
                  >
                  <div
                    class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-zinc-600 font-bold text-[10px]"
                  >
                    <Hash :size="12" />
                    {{ locale.songUnit }}
                  </div>
                </div>
                <p class="text-[9px] text-zinc-600 px-1">{{ locale.expectedHint }}</p>
              </div>
              <div class="space-y-2 flex flex-col justify-center pt-2">
                <label class="flex items-center gap-3 cursor-pointer group px-1">
                  <input
                    v-model="formData.enabled"
                    type="checkbox"
                    class="w-4.5 h-4.5 rounded-lg border-zinc-800 bg-zinc-950 accent-blue-600"
                  >
                  <div>
                    <span
                      class="text-xs font-bold text-zinc-300 group-hover:text-blue-400 transition-colors"
                      >{{ locale.enableThisRequestTime }}</span
                    >
                    <p class="text-[9px] text-zinc-600 font-medium">
                      {{ locale.enableThisRequestTimeHint }}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.descriptionOptional }}</label
              >
              <textarea
                v-model="formData.description"
                :placeholder="locale.descriptionPlaceholder"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 min-h-[100px] resize-none"
              />
            </div>

            <div
              v-if="formError"
              class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold"
            >
              <AlertCircle :size="16" />
              {{ formError }}
            </div>
          </div>

          <div class="px-8 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex gap-3 justify-end">
            <button
              class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300"
              @click="cancelForm"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="formSubmitting"
              class="px-10 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
              @click="saveRequestTime"
            >
              {{ formSubmitting ? locale.saving : locale.saveSettings }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
        @click.self="showDeleteConfirm = false"
      >
        <div
          class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-8"
        >
          <div class="flex flex-col items-center space-y-6">
            <div
              class="w-16 h-16 rounded-[2rem] bg-red-600/10 text-red-500 flex items-center justify-center border border-red-500/20 shadow-xl shadow-red-900/10"
            >
              <Trash2 :size="28" />
            </div>
            <div class="text-center space-y-2 px-4">
              <h4 class="text-lg font-bold text-zinc-100">
                {{ locale.deleteConfirmTitle(RequestTimeToDelete?.name || '') }}
              </h4>
              <p class="text-xs text-zinc-500 leading-relaxed">
                {{ locale.deleteConfirmPrefix }}
                <span class="text-zinc-300 font-bold">{{ locale.disable }}</span> {{ locale.deleteConfirmSuffix }}
              </p>
            </div>
            <div class="flex gap-3 w-full pt-4">
              <button
                class="flex-1 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-xs font-black rounded-2xl transition-all"
                @click="showDeleteConfirm = false"
              >
                {{ locale.keepTime }}
              </button>
              <button
                :disabled="deleteInProgress"
                class="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-2xl shadow-xl shadow-red-900/20 transition-all active:scale-95 disabled:opacity-50"
                @click="deleteRequestTime"
              >
                {{ deleteInProgress ? locale.deleting : locale.confirmDelete }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 说明部分 -->
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-6 space-y-4">
        <h4
          class="text-xs font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2"
        >
          <CheckCircle2 :size="14" class="text-emerald-500" /> {{ locale.priorityTitle }}
        </h4>
        <ul class="text-[11px] text-zinc-500 space-y-2 font-medium">
          <li class="flex gap-2">
            <span class="text-zinc-700 font-black">1.</span>
            <span
              ><span class="text-zinc-300">{{ locale.globalSwitch }}</span>
              {{ locale.priorityGlobal }}</span
            >
          </li>
          <li class="flex gap-2">
            <span class="text-zinc-700 font-black">2.</span>
            <span
              >{{ locale.priorityTimeLimitPrefix }} <span class="text-zinc-300">{{ locale.timeLimit }}</span> {{ locale.priorityTimeLimitMiddle }}
              <span class="text-zinc-300">{{ locale.enabled }}</span> {{ locale.priorityTimeLimitAnd }}
              <span class="text-zinc-300">{{ locale.expectedCountShort }}</span> {{ locale.priorityTimeLimitSuffix }}</span
            >
          </li>
          <li class="flex gap-2">
            <span class="text-zinc-700 font-black">3.</span>
            <span>{{ locale.priorityNoLimit }}</span>
          </li>
        </ul>
      </div>

      <div class="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-6 space-y-4">
        <h4
          class="text-xs font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2"
        >
          <XCircle :size="14" class="text-rose-500" /> {{ locale.noticeTitle }}
        </h4>
        <ul class="text-[11px] text-zinc-500 space-y-2 font-medium">
          <li class="flex gap-2">
            <span class="text-zinc-700 font-black">•</span>
            <span>{{ locale.noticeOverlap }}</span>
          </li>
          <li class="flex gap-2">
            <span class="text-zinc-700 font-black">•</span>
            <span>{{ locale.noticeUnlimited }}</span>
          </li>
          <li class="flex gap-2">
            <span class="text-zinc-700 font-black">•</span>
            <span>{{ locale.noticeExpired }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useLocale } from '~/utils/locale'
import type { RequestTime } from '~/types'
import {
  Plus,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Power,
  AlertCircle,
  Hash,
  CheckCircle2,
  XCircle,
  X,
  BarChart3,
  Filter
} from '@lucide/vue'

const { getAuthConfig, isAdmin } = useAuth()
const { admin } = useLocale()
const locale = computed(() => {
  const base = admin.value?.requestTimeManager || {}
  const emptyText = () => ''
  return {
    ...base,
    errors: { ...(base.errors || {}) },
    stats: { ...(base.stats || {}) },
    deleteConfirmTitle: base.deleteConfirmTitle || emptyText
  }
})

const requestTimes = ref<RequestTime[]>([])
const loading = ref(false)
const error = ref('')
const showAddForm = ref(false)
const editingRequestTime = ref<RequestTime | null>(null)
const RequestTimeToDelete = ref<RequestTime | null>(null)
const showDeleteConfirm = ref(false)
const formSubmitting = ref(false)
const deleteInProgress = ref(false)
const formError = ref('')
const enableRequestTimeLimitation = ref(false)
const hitRequestTime = ref(false)
const enableRequest = ref(true)

let refreshInterval: any = null

const formData = reactive({
  id: 0,
  name: '',
  startTime: '',
  endTime: '',
  description: '',
  enabled: true,
  expected: 0
})

// 统计数据
const stats = computed(() => {
  const activeSlots = requestTimes.value.filter((s) => s.enabled && !s.past)
  
  // 检查是否有不限容量的活跃时段
  const hasUnlimitedActiveSlot = activeSlots.some((s) => !s.expected || s.expected === 0)
  
  const totalExpectedActive = activeSlots.reduce((acc, s) => acc + (s.expected || 0), 0)
  const totalAcceptedActive = activeSlots.reduce((acc, s) => acc + s.accepted, 0)
  
  // 累计已接收可以统计所有的（包括过去的），也可以只统计活跃的。通常累计是历史总计，但也可以分历史和当前。
  // 原逻辑是统计所有 requestTimes 的 accepted。保持原逻辑。
  const totalAcceptedAll = requestTimes.value.reduce((acc, s) => acc + s.accepted, 0)

  return [
    {
      label: locale.value?.stats?.activeSlots || 'Active slots',
      value: activeSlots.length.toString(),
      icon: Clock,
      color: 'blue'
    },
    {
      label: locale.value?.stats?.totalAccepted || 'Total accepted',
      value: totalAcceptedAll.toString(),
      icon: BarChart3,
      color: 'emerald'
    },
    {
      label: locale.value?.stats?.totalCapacity || 'Total capacity',
      value: activeSlots.length === 0
        ? (locale.value?.none || 'None')
        : (hasUnlimitedActiveSlot ? (locale.value?.unlimited || 'Unlimited') : totalExpectedActive.toString()),
      icon: Hash,
      color: 'purple'
    },
    {
      label: locale.value?.stats?.remainingCapacity || 'Remaining capacity',
      value: activeSlots.length === 0 
        ? (locale.value?.none || 'None')
        : (hasUnlimitedActiveSlot 
            ? (locale.value?.unlimited || 'Unlimited')
            : Math.max(0, totalExpectedActive - totalAcceptedActive).toString()),
      icon: Filter,
      color: 'amber'
    }
  ]
})

onMounted(async () => {
  await fetchRequestTimes()
  await fetchSystemSettings()
  await fetchRequestTimeHit()

  // 每 30 秒自动刷新一次状态，以确保时间同步
  refreshInterval = setInterval(fetchRequestTimeHit, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

const fetchRequestTimes = async () => {
  if (!isAdmin.value) {
    error.value = locale.value.errors.adminOnly
    return
  }

  loading.value = true
  error.value = ''

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/request-times', {
      headers: {
        'Content-Type': 'application/json'
      },
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || locale.value.errors.fetchFailedWithStatus(response.status))
    }

    const data = await response.json()

    requestTimes.value = data.sort((a: RequestTime, b: RequestTime) => {
      if (a.past !== b.past) return a.past ? 1 : -1
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      const aHasTime = !!(a.startTime || a.endTime)
      const bHasTime = !!(b.startTime || b.endTime)
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1
      if (aHasTime && bHasTime) {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime)
        else if (a.startTime) return -1
        else if (b.startTime) return 1
      }
      return a.name.localeCompare(b.name)
    })
  } catch (err: any) {
    error.value = err.message || locale.value.errors.fetchFailed
  } finally {
    loading.value = false
  }
}

const fetchSystemSettings = async () => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      headers: { 'Content-Type': 'application/json' },
      ...authConfig
    })
    if (!response.ok) return
    const data = await response.json()
    enableRequestTimeLimitation.value = data.enableRequestTimeLimitation
    enableRequest.value = !data.forceBlockAllRequests
  } catch (err: any) {
    console.error('获取系统设置失败:', err.message)
  }
}

const fetchRequestTimeHit = async () => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/request-times', {
      headers: { 'Content-Type': 'application/json' },
      ...authConfig
    })
    if (!response.ok) return
    const data = await response.json()
    hitRequestTime.value = data.hit
  } catch (err: any) {
    console.error('获取投稿开放状态失败:', err.message)
  }
}

const toggleGlobalRequest = async () => {
  enableRequest.value = !enableRequest.value
  await updateSystemSettings()
  await fetchRequestTimeHit()
}

const toggleTimeLimitation = async () => {
  enableRequestTimeLimitation.value = !enableRequestTimeLimitation.value
  await updateSystemSettings()
  await fetchRequestTimeHit()
}

const updateSystemSettings = async () => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enableRequestTimeLimitation: enableRequestTimeLimitation.value,
        forceBlockAllRequests: !enableRequest.value
      }),
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || locale.value.errors.updateSystemSettingsFailedWithStatus(response.status))
    }
  } catch (err: any) {
    error.value = err.message || locale.value.errors.updateSystemSettingsFailed
  }
}

const editRequestTime = (RequestTime: RequestTime) => {
  editingRequestTime.value = RequestTime
  Object.assign(formData, {
    id: RequestTime.id,
    name: RequestTime.name,
    startTime: RequestTime.startTime,
    endTime: RequestTime.endTime,
    description: RequestTime.description || '',
    enabled: RequestTime.enabled,
    expected: RequestTime.expected || 0
  })
}

const toggleRequestTimeStatus = async (RequestTime: RequestTime) => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch(`/api/admin/request-times/${RequestTime.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !RequestTime.enabled }),
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || locale.value.errors.updateStatusFailedWithStatus(response.status))
    }
    await fetchRequestTimes()
    await fetchRequestTimeHit()
  } catch (err: any) {
    error.value = err.message || locale.value.errors.updateStatusFailed
  }
}

const confirmDelete = (RequestTime: RequestTime) => {
  RequestTimeToDelete.value = RequestTime
  showDeleteConfirm.value = true
}

const deleteRequestTime = async () => {
  if (!RequestTimeToDelete.value || !isAdmin.value) return
  deleteInProgress.value = true
  try {
    const authConfig = getAuthConfig()
    const response = await fetch(`/api/admin/request-times/${RequestTimeToDelete.value.id}`, {
      method: 'DELETE',
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || locale.value.errors.deleteFailedWithStatus(response.status))
    }
    await fetchRequestTimes()
    await fetchRequestTimeHit()
    showDeleteConfirm.value = false
    RequestTimeToDelete.value = null
  } catch (err: any) {
    error.value = err.message || locale.value.errors.deleteFailed
  } finally {
    deleteInProgress.value = false
  }
}

const saveRequestTime = async () => {
  formError.value = ''
  if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
    formError.value = locale.value.errors.startBeforeEnd
    return
  }
  if (!formData.name.trim()) {
    formError.value = locale.value.errors.nameRequired
    return
  }
  const isUpdate = !!editingRequestTime.value
  const nameExists = requestTimes.value.some(
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
    const response = await fetch(
      isUpdate ? `/api/admin/request-times/${formData.id}` : '/api/admin/request-times',
      {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          description: formData.description || null,
          enabled: formData.enabled,
          expected: formData.expected || 0
        }),
        ...authConfig
      }
    )
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || locale.value.errors.saveFailedWithStatus(isUpdate, response.status)
      )
    }
    await fetchRequestTimes()
    await fetchRequestTimeHit()
    cancelForm()
  } catch (err: any) {
    formError.value = err.message || locale.value.errors.saveFailed
  } finally {
    formSubmitting.value = false
  }
}

const cancelForm = () => {
  showAddForm.value = false
  editingRequestTime.value = null
  formError.value = ''
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true,
    expected: 0
  })
}
</script>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
