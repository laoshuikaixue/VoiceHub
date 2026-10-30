<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">{{ locale.desc }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div
          class="bg-bg-secondary-40 border border-border-secondary rounded-xl px-4 py-2 flex items-center gap-3"
          :title="locale.topicsOffNotice"
        >
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest">
            {{ locale.enableTopics }}
          </span>
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              topicsEnabled ? 'bg-primary-hover' : 'bg-bg-tertiary',
              isAdmin ? '' : 'opacity-40 cursor-not-allowed'
            ]"
            :disabled="!isAdmin || flagsSaving"
            @click="toggleTopicsEnabled"
          >
            <span
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                topicsEnabled ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
        <div
          class="bg-bg-secondary-40 border border-border-secondary rounded-xl px-4 py-2 flex items-center gap-3"
          :title="locale.requireTopicDesc"
        >
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest">
            {{ locale.requireTopic }}
          </span>
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              topicsEnabled && isAdmin ? '' : 'opacity-40 cursor-not-allowed',
              topicRequired ? 'bg-primary-hover' : 'bg-bg-tertiary'
            ]"
            :disabled="!topicsEnabled || !isAdmin || flagsSaving"
            @click="toggleTopicRequired"
          >
            <span
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                topicRequired ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
        <button
          class="flex items-center gap-2 px-6 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 self-start md:self-auto"
          @click="openForm()"
        >
          <Plus :size="14" /> {{ locale.add }}
        </button>
      </div>
    </div>

    <!-- 总开关关闭时的提示 -->
    <div
      v-if="!topicsEnabled"
      class="bg-warning-5 border border-warning-20 rounded-xl p-5 flex items-start gap-4"
    >
      <AlertCircle class="text-warning shrink-0 mt-0.5" :size="18" />
      <div class="space-y-1">
        <p class="text-xs font-bold text-text-secondary">{{ locale.topicsOffBadge }}</p>
        <p class="text-[11px] text-text-tertiary leading-relaxed">{{ locale.topicsOffNotice }}</p>
      </div>
    </div>

    <!-- 说明卡片 -->
    <div class="bg-primary-hover-5 border border-primary-10 rounded-xl p-5 flex items-start gap-4">
      <Info class="text-primary shrink-0 mt-0.5" :size="18" />
      <div class="space-y-1">
        <p class="text-xs font-bold text-text-secondary">{{ locale.infoTitle }}</p>
        <p class="text-[11px] text-text-tertiary leading-relaxed">{{ locale.infoDesc }}</p>
      </div>
    </div>

    <!-- 加载 / 错误 / 空 -->
    <div
      v-if="loading"
      class="flex flex-col items-center justify-center py-20 space-y-4 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl"
    >
      <AppSpinner :size="40" />
      <p class="text-xs font-black text-text-tertiary uppercase tracking-widest">{{ locale.loading }}</p>
    </div>

    <div
      v-else-if="error"
      class="bg-error-5 border border-error-10 rounded-xl p-5 flex items-start gap-4"
    >
      <AlertCircle class="text-error shrink-0 mt-0.5" :size="18" />
      <div class="space-y-2">
        <p class="text-xs font-bold text-text-secondary">{{ locale.fetchFailed }}</p>
        <p class="text-[11px] text-text-tertiary leading-relaxed">{{ error }}</p>
        <button class="text-[11px] font-black text-primary hover:underline" @click="fetchTopics">
          {{ locale.retry }}
        </button>
      </div>
    </div>

    <div
      v-else-if="topics.length === 0"
      class="flex flex-col items-center justify-center py-20 space-y-6 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl"
    >
      <div
        class="flex items-center justify-center p-6 rounded-xl bg-bg-primary border border-border-secondary text-text-secondary"
      >
        <Layers :size="48" />
      </div>
      <div class="text-center space-y-2">
        <h3 class="text-lg font-bold text-text-primary">{{ locale.emptyTitle }}</h3>
        <p class="text-xs text-text-tertiary">{{ locale.emptyDesc }}</p>
      </div>
      <button
        class="px-6 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg transition-all active:scale-95"
        @click="openForm()"
      >
        {{ locale.add }}
      </button>
    </div>

    <!-- 专题列表 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="topic in topics"
        :key="topic.id"
        class="group relative flex flex-col bg-bg-secondary-30 border rounded-xl p-7 transition-all hover:shadow-2xl hover:shadow-[0_25px_50px_var(--shadow-color-deep)]"
        :class="topic.enabled ? 'border-border-secondary-80' : 'border-border-secondary-40 opacity-70'"
      >
        <div class="flex items-start justify-between mb-5">
          <div
            class="p-3 rounded-xl bg-bg-primary border flex items-center justify-center"
            :class="topic.enabled ? 'text-primary border-primary-20' : 'text-text-secondary border-border-secondary'"
          >
            <Layers :size="20" />
          </div>
          <span
            class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border"
            :class="statusOf(topic).cls"
          >
            {{ statusOf(topic).label }}
          </span>
        </div>

        <h4 class="text-lg font-black text-text-primary group-hover:text-primary transition-colors break-all">
          {{ topic.name }}
        </h4>
        <p class="text-xs text-text-tertiary font-medium leading-relaxed mt-2 min-h-[32px] line-clamp-2">
          {{ topic.description || locale.noDescription }}
        </p>

        <!-- 专题时段 -->
        <div class="flex items-center gap-2 mt-4 text-[11px] font-bold text-text-secondary">
          <Clock :size="12" class="text-text-disabled shrink-0" />
          <span>{{ topic.startTimeText }}</span>
          <span class="text-text-disabled">—</span>
          <span>{{ topic.endTimeText }}</span>
        </div>

        <!-- 收集进度 -->
        <div class="mt-5 space-y-2">
          <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span class="text-text-disabled">{{ locale.collected }}</span>
            <span class="text-text-secondary">
              {{ topic.accepted }} / {{ topic.maxSubmissions === null ? locale.unlimited : topic.maxSubmissions }}
            </span>
          </div>
          <div class="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="topic.maxSubmissions === null ? 'bg-primary-40' : 'bg-primary'"
              :style="{ width: topic.maxSubmissions === null ? '100%' : `${progressOf(topic)}%` }"
            />
          </div>
        </div>

        <!-- 专题日 -->
        <div class="mt-5 pt-5 border-t border-border-secondary-50 space-y-2">
          <div class="flex items-center gap-2">
            <CalendarDays :size="12" class="text-text-disabled" />
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
              {{ locale.topicDaysLabel }}
            </span>
            <span class="ml-auto text-[10px] font-black text-text-secondary">
              {{ topic.topicDays.length > 0 ? `${topic.topicDays.length} ${locale.daysUnit}` : locale.noDaysShort }}
            </span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <template v-if="topic.topicDays.length > 0">
              <span
                v-for="day in topic.topicDays.slice(0, 6)"
                :key="day"
                class="px-2 py-0.5 rounded bg-primary-10 text-primary border border-primary-20 text-[9px] font-black"
              >
                {{ formatDay(day) }}
              </span>
              <span
                v-if="topic.topicDays.length > 6"
                class="px-2 py-0.5 rounded bg-bg-tertiary-50 text-text-tertiary border border-border-tertiary-50 text-[9px] font-black"
              >
                +{{ topic.topicDays.length - 6 }}
              </span>
            </template>
            <span v-else class="text-[10px] text-text-disabled font-medium">
              {{ locale.noDaysHint }}
            </span>
          </div>
        </div>

        <div class="mt-6 pt-5 border-t border-border-secondary-50 flex items-center justify-between">
          <div class="flex gap-2">
            <button
              class="flex items-center justify-center p-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary hover:text-primary hover:border-primary-30 transition-all"
              :title="locale.edit"
              @click="openForm(topic)"
            >
              <Edit2 :size="14" />
            </button>
            <button
              class="flex items-center justify-center p-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary hover:text-error hover:border-error-30 transition-all"
              :title="locale.delete"
              @click="deleteTarget = topic"
            >
              <Trash2 :size="14" />
            </button>
          </div>
          <button
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
              topic.enabled
                ? 'bg-bg-tertiary text-text-tertiary hover:text-text-primary'
                : 'bg-success text-text-primary shadow-lg shadow-[var(--success-glow-20)]'
            ]"
            @click="toggleEnabled(topic)"
          >
            <Power :size="12" />
            {{ topic.enabled ? locale.disable : locale.enable }}
          </button>
        </div>
      </div>
    </div>

    <!-- 新建 / 编辑弹窗 -->
    <Transition name="modal">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-bg-primary-80 backdrop-blur-sm" @click="closeForm" />
        <div
          class="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl"
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-black text-text-primary tracking-tight">
                {{ editingId ? locale.editTitle : locale.addTitle }}
              </h3>
              <button
                class="flex items-center justify-center p-2 text-text-tertiary hover:text-text-primary transition-colors"
                @click="closeForm"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-6">
              <!-- 名称 -->
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">
                  {{ locale.name }}
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  maxlength="100"
                  :placeholder="locale.namePlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-lg px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>

              <!-- 专题时段 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">
                    {{ locale.startTime }}
                  </label>
                  <AppDateTimePicker
                    v-model="form.startTime"
                    :placeholder="locale.startTime"
                    size="md"
                    rounded="lg"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">
                    {{ locale.endTime }}
                  </label>
                  <AppDateTimePicker
                    v-model="form.endTime"
                    :placeholder="locale.endTime"
                    size="md"
                    rounded="lg"
                  />
                </div>
              </div>
              <p class="text-[9px] text-text-disabled px-1 -mt-2">{{ locale.timeHint }}</p>

              <!-- 收集数量 -->
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 flex items-center gap-2">
                  <Users :size="10" /> {{ locale.quota }}
                </label>
                <div class="relative">
                  <input
                    v-model="form.maxSubmissions"
                    type="number"
                    min="1"
                    step="1"
                    :placeholder="locale.quotaPlaceholder"
                    class="w-full bg-bg-primary border border-border-secondary rounded-lg px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
                  >
                  <button
                    v-if="form.maxSubmissions !== ''"
                    class="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-black text-text-tertiary hover:text-text-primary bg-bg-tertiary rounded"
                    @click="form.maxSubmissions = ''"
                  >
                    {{ locale.setUnlimited }}
                  </button>
                </div>
                <p class="text-[9px] text-text-disabled px-1">{{ locale.quotaHint }}</p>
              </div>

              <!-- 专题日 -->
              <div class="space-y-3 rounded-xl border border-border-secondary bg-bg-primary-40 p-5">
                <div class="flex items-center gap-2">
                  <CalendarDays :size="12" class="text-text-disabled" />
                  <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
                    {{ locale.topicDaysTitle }}
                  </span>
                  <span class="ml-auto text-[10px] font-bold text-text-tertiary">
                    {{ form.topicDays.length }} {{ locale.daysUnit }}
                  </span>
                </div>
                <p class="text-[10px] text-text-tertiary leading-relaxed">{{ locale.topicDaysHint }}</p>

                <!-- 选择日期：统一日期选择器，浮层里点选即写入，无需二次确认 -->
                <AppDatePicker
                  v-model="form.topicDays"
                  multiple
                  :min="dayPickerMin"
                  :max="dayPickerMax"
                  :placeholder="locale.pickDays"
                  size="md"
                  rounded="lg"
                  class-name="w-full"
                />

                <!-- 已选日期 -->
                <div v-if="form.topicDays.length > 0" class="flex flex-wrap gap-2 pt-2">
                  <button
                    v-for="day in form.topicDays"
                    :key="day"
                    class="group/day flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-10 text-primary border border-primary-20 text-[10px] font-black hover:bg-error-10 hover:text-error hover:border-error-20 transition-all"
                    :title="locale.removeDay"
                    @click="removeDay(day)"
                  >
                    {{ formatDay(day) }}
                    <X :size="10" />
                  </button>
                </div>
                <p v-else class="text-[10px] text-text-disabled font-medium pt-1">{{ locale.noDaysHint }}</p>
              </div>

              <!-- 可投稿的播出时段（多选） -->
              <div class="space-y-3 rounded-xl border border-border-secondary bg-bg-primary-40 p-5">
                <div class="flex items-center gap-2">
                  <Clock :size="12" class="text-text-disabled" />
                  <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
                    {{ locale.playTimesTitle }}
                  </span>
                  <span class="ml-auto text-[10px] font-bold text-text-tertiary">
                    {{
                      form.playTimeIds.length > 0
                        ? `${form.playTimeIds.length} ${locale.playTimesUnit}`
                        : locale.playTimesUnlimited
                    }}
                  </span>
                </div>
                <p class="text-[10px] text-text-tertiary leading-relaxed">{{ locale.playTimesHint }}</p>

                <p v-if="playTimeOptions.length === 0" class="text-[10px] text-text-disabled font-medium">
                  {{ locale.playTimesEmpty }}
                </p>
                <div v-else class="flex flex-wrap gap-2">
                  <button
                    v-for="slot in playTimeOptions"
                    :key="slot.id"
                    class="px-3 py-2 rounded-lg border text-[10px] font-black transition-all"
                    :class="
                      form.playTimeIds.includes(slot.id)
                        ? 'bg-primary-hover-10 text-primary border-primary-20'
                        : 'bg-bg-primary text-text-tertiary border-border-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    "
                    @click="togglePlayTime(slot.id)"
                  >
                    {{ playTimeLabel(slot) }}
                    <span v-if="!slot.enabled" class="opacity-60"> · {{ locale.playTimesDisabled }}</span>
                  </button>
                </div>
              </div>

              <!-- 说明 -->
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">
                  {{ locale.descriptionOptional }}
                </label>
                <textarea
                  v-model="form.description"
                  maxlength="500"
                  :placeholder="locale.descriptionPlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-lg px-5 py-4 text-sm text-text-primary focus:outline-none focus:border-primary-30 min-h-[90px] resize-none"
                />
              </div>

              <label class="flex items-center gap-3 cursor-pointer group px-1">
                <input
                  v-model="form.enabled"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-primary"
                >
                <span class="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  {{ locale.enableThisTopic }}
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

          <div class="px-8 py-5 bg-bg-primary-50 border-t border-border-secondary flex justify-end gap-3 sticky bottom-0">
            <button
              class="px-6 py-2.5 text-xs font-bold text-text-tertiary hover:text-text-secondary"
              @click="closeForm"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="submitting"
              class="px-8 py-2.5 bg-primary-hover hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-black rounded-lg shadow-lg transition-all active:scale-95"
              @click="saveTopic"
            >
              {{ submitting ? locale.saving : locale.save }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认 -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-bg-primary-80 backdrop-blur-sm" @click="deleteTarget = null" />
        <div
          class="relative w-full max-w-sm bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="p-8 flex flex-col items-center space-y-6">
            <div
              class="w-16 h-16 rounded-xl bg-error-10 text-error flex items-center justify-center border border-error-10 shadow-xl shadow-[var(--error-glow-5)]"
            >
              <AlertCircle :size="32" />
            </div>
            <div class="text-center space-y-2 px-2">
              <h4 class="text-lg font-bold text-text-primary">
                {{ locale.deleteTitle }}
              </h4>
              <p class="text-xs text-text-tertiary leading-relaxed">
                {{ deleteMessage }}
              </p>
            </div>
            <div class="flex gap-3 w-full pt-2">
              <button
                class="flex-1 px-4 py-3 bg-bg-primary border border-border-secondary text-text-tertiary text-xs font-black rounded-lg transition-all hover:bg-bg-tertiary"
                @click="deleteTarget = null"
              >
                {{ locale.cancel }}
              </button>
              <button
                :disabled="deleting"
                class="flex-1 px-4 py-3 bg-error hover:bg-error disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-black rounded-lg shadow-xl shadow-[var(--error-glow-20)] transition-all active:scale-95"
                @click="confirmDelete"
              >
                {{ deleting ? locale.deleting : locale.confirmDelete }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import type { SubmissionTopic } from '~/types'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import AppDateTimePicker from '~/components/UI/Common/AppDateTimePicker.vue'
import {
  Plus,
  Info,
  Layers,
  CalendarDays,
  Clock,
  Users,
  Edit2,
  Trash2,
  X,
  Power,
  AlertCircle
} from '@lucide/vue'

const { showToast: showNotification } = useToast()
const { getAuthConfig, isAdmin } = useAuth()
const { admin } = useLocale()
const locale = computed(() => admin.value?.submissionTopicManager || {})

const topics = ref<SubmissionTopic[]>([])
// 全局开关：专题投稿是否对学生开放、是否必选（与「播出时段」的两个开关同构）
const topicsEnabled = ref(false)
const topicRequired = ref(false)
const flagsSaving = ref(false)
const loading = ref(false)
const error = ref('')
const showForm = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formError = ref('')
const deleteTarget = ref<SubmissionTopic | null>(null)
const deleting = ref(false)

const form = reactive({
  name: '',
  description: '',
  startTime: '',
  endTime: '',
  maxSubmissions: '' as string,
  enabled: true,
  topicDays: [] as string[],
  playTimeIds: [] as number[]
})

const pad = (value: number) => String(value).padStart(2, '0')

/** 当前北京时间（用 UTC 字段读出东八区墙钟时间） */
const beijingNow = () => new Date(Date.now() + 8 * 60 * 60 * 1000)

const toInputValue = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`

const todayInput = () => toInputValue(beijingNow()).slice(0, 10)

const defaultRange = () => {
  const start = beijingNow()
  start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 10) * 10, 0, 0)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start: toInputValue(start), end: toInputValue(end) }
}

const formatDay = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  const weekdays = locale.value.weekdaysShort || ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()} 周${weekdays[date.getUTCDay()]}`
}

const statusOf = (topic: SubmissionTopic) => {
  if (!topic.enabled) {
    return { label: locale.value.disabled, cls: 'bg-bg-tertiary-50 text-text-disabled border-border-tertiary-50' }
  }
  if (topic.isOpen) {
    return { label: locale.value.openNow, cls: 'bg-success-10 text-success border-success-20' }
  }
  return { label: locale.value.notOpen, cls: 'bg-warning-10 text-warning border-warning-20' }
}

const progressOf = (topic: SubmissionTopic) => {
  if (!topic.maxSubmissions) return 0
  return Math.min(100, Math.round((topic.accepted / topic.maxSubmissions) * 100))
}

const deleteMessage = computed(() => {
  const target = deleteTarget.value
  if (!target) return ''
  const template = locale.value.deleteMessage
  return typeof template === 'function'
    ? template(target.name, target.accepted)
    : String(template || '').replace('{0}', target.name).replace('{1}', String(target.accepted))
})

const extractMessage = (payload: any): string =>
  payload?.data?.message || payload?.data?.statusMessage || payload?.message || payload?.statusMessage || ''

const fetchTopics = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/admin/topics')
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(extractMessage(payload) || locale.value.fetchFailed)
    }
    topics.value = Array.isArray(payload.topics) ? payload.topics : []
    topicsEnabled.value = payload.enabled === true
    topicRequired.value = payload.required === true
  } catch (err: any) {
    error.value = err?.message || locale.value.fetchFailed
  } finally {
    loading.value = false
  }
}

/** 保存两个总开关：两者相互约束，同一请求提交完整组合 */
const saveTopicFlags = async (
  prev: { enabled: boolean; required: boolean },
  successMessage: string,
  failMessage: string
) => {
  if (!isAdmin.value) {
    topicsEnabled.value = prev.enabled
    topicRequired.value = prev.required
    showNotification(locale.value.errors?.adminOnly || '只有管理员才能修改专题投稿开关', 'error')
    return
  }

  flagsSaving.value = true
  try {
    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      body: {
        enableSubmissionTopics: topicsEnabled.value,
        submissionTopicRequired: topicRequired.value
      },
      ...getAuthConfig()
    })
    showNotification(successMessage, 'success')
  } catch (err: any) {
    topicsEnabled.value = prev.enabled
    topicRequired.value = prev.required
    showNotification(extractMessage(err) || failMessage, 'error')
  } finally {
    flagsSaving.value = false
  }
}

const toggleTopicsEnabled = async () => {
  const prev = { enabled: topicsEnabled.value, required: topicRequired.value }
  const next = !prev.enabled
  topicsEnabled.value = next
  // 关闭总开关时「必选」同时失效，避免出现「必选但不生效」的矛盾状态
  topicRequired.value = next ? prev.required : false
  await saveTopicFlags(
    prev,
    next ? locale.value.messages.topicsEnabled : locale.value.messages.topicsDisabled,
    locale.value.errors?.updateFlagsFailed || '更新专题开关失败'
  )
}

const toggleTopicRequired = async () => {
  if (!topicsEnabled.value || !isAdmin.value) return
  const prev = { enabled: topicsEnabled.value, required: topicRequired.value }
  topicRequired.value = !prev.required
  await saveTopicFlags(
    prev,
    topicRequired.value ? locale.value.messages.topicRequiredOn : locale.value.messages.topicRequiredOff,
    locale.value.errors?.updateFlagsFailed || '更新专题开关失败'
  )
}

const openForm = (topic?: SubmissionTopic) => {
  formError.value = ''

  if (topic) {
    editingId.value = topic.id
    form.name = topic.name
    form.description = topic.description || ''
    form.startTime = topic.startTime
    form.endTime = topic.endTime
    form.maxSubmissions = topic.maxSubmissions === null ? '' : String(topic.maxSubmissions)
    form.enabled = topic.enabled
    form.topicDays = [...topic.topicDays]
    form.playTimeIds = Array.isArray(topic.playTimeIds) ? topic.playTimeIds.map(Number) : []
  } else {
    editingId.value = null
    const range = defaultRange()
    form.name = ''
    form.description = ''
    form.startTime = range.start
    form.endTime = range.end
    form.maxSubmissions = ''
    form.enabled = true
    form.topicDays = []
    form.playTimeIds = []
  }
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  editingId.value = null
  formError.value = ''
}

const removeDay = (day: string) => {
  form.topicDays = form.topicDays.filter((item) => item !== day)
}

/** 专题日下限：不早于今天，也不早于专题开始日——避免把日期加到时段之外 */
const dayPickerMin = computed(() => {
  const today = todayInput()
  const startDay = form.startTime ? form.startTime.slice(0, 10) : ''
  return startDay && startDay > today ? startDay : today
})

/** 专题日上限：专题结束日 */
const dayPickerMax = computed(() => (form.endTime ? form.endTime.slice(0, 10) : ''))

const saveTopic = async () => {
  formError.value = ''
  const name = form.name.trim()
  const errors = locale.value.errors || {}

  if (!name) {
    formError.value = errors.nameRequired || '请填写专题名称'
    return
  }
  if (!form.startTime || !form.endTime) {
    formError.value = errors.timeRequired || '请填写专题开始与结束时间'
    return
  }
  if (form.startTime >= form.endTime) {
    formError.value = errors.invalidRange || '专题开始时间必须早于结束时间'
    return
  }

  const quotaText = form.maxSubmissions.trim()
  if (quotaText && (!/^\d+$/.test(quotaText) || Number(quotaText) < 1)) {
    formError.value = errors.invalidQuota || '收集数量必须是正整数，留空表示不限量'
    return
  }

  submitting.value = true
  try {
    const payload = {
      name,
      description: form.description.trim() || null,
      startTime: form.startTime,
      endTime: form.endTime,
      maxSubmissions: quotaText ? Number(quotaText) : null,
      enabled: form.enabled,
      topicDays: form.topicDays,
      playTimeIds: form.playTimeIds
    }

    const response = await fetch(
      editingId.value ? `/api/admin/topics/${editingId.value}` : '/api/admin/topics',
      {
        method: editingId.value ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(extractMessage(result) || errors.saveFailed || '保存失败')
    }

    showNotification(
      editingId.value
        ? locale.value.messages?.updated || '专题已更新'
        : locale.value.messages?.created || '专题已创建',
      'success'
    )
    closeForm()
    await fetchTopics()
  } catch (err: any) {
    formError.value = err?.message || locale.value.errors?.saveFailed || '保存失败'
  } finally {
    submitting.value = false
  }
}

const toggleEnabled = async (topic: SubmissionTopic) => {
  try {
    const response = await fetch(`/api/admin/topics/${topic.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !topic.enabled })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(extractMessage(result) || locale.value.errors?.saveFailed || '操作失败')
    }
    await fetchTopics()
  } catch (err: any) {
    showNotification(err?.message || locale.value.errors?.saveFailed || '操作失败', 'error')
  }
}

const confirmDelete = async () => {
  const target = deleteTarget.value
  if (!target) return

  deleting.value = true
  try {
    const response = await fetch(`/api/admin/topics/${target.id}`, { method: 'DELETE' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(extractMessage(result) || locale.value.errors?.deleteFailed || '删除失败')
    }
    showNotification(locale.value.messages?.deleted || '专题已删除', 'success')
    deleteTarget.value = null
    await fetchTopics()
  } catch (err: any) {
    showNotification(err?.message || locale.value.errors?.deleteFailed || '删除失败', 'error')
  } finally {
    deleting.value = false
  }
}

/** 全站播出时段，供专题多选；加载失败不影响专题本身保存 */
const playTimeOptions = ref<
  { id: number; name: string; startTime?: string | null; endTime?: string | null; enabled: boolean }[]
>([])

const fetchPlayTimeOptions = async () => {
  try {
    const response = await fetch('/api/admin/play-times')
    if (!response.ok) return
    const data = await response.json()
    const list = Array.isArray(data) ? data : data?.playTimes || []
    playTimeOptions.value = list.map((item: any) => ({
      id: Number(item.id),
      name: String(item.name || `#${item.id}`),
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      enabled: item.enabled !== false
    }))
  } catch {
    playTimeOptions.value = []
  }
}

const togglePlayTime = (id: number) => {
  form.playTimeIds = form.playTimeIds.includes(id)
    ? form.playTimeIds.filter((item) => item !== id)
    : [...form.playTimeIds, id]
}

const playTimeLabel = (slot: { name: string; startTime?: string | null; endTime?: string | null }) =>
  slot.startTime && slot.endTime ? `${slot.name} ${slot.startTime}–${slot.endTime}` : slot.name

onMounted(() => {
  fetchTopics()
  fetchPlayTimeOptions()
})

</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
</style>
