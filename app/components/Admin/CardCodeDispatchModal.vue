<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm" @click="close" />

      <div class="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-panel-bg-dark bg-panel-bg-deepest shadow-2xl">
        <!-- 头部 -->
        <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-panel-bg-dark bg-panel-bg-deepest-95 px-5 py-4 backdrop-blur-sm">
          <div class="min-w-0">
            <h3 class="truncate text-base font-black text-text-primary-lighter">{{ locale.assignTitle }}</h3>
            <p class="mt-0.5 truncate text-[11px] text-text-tertiary">{{ locale.assignDesc }}</p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-panel-bg-dark hover:text-text-primary-light"
            :aria-label="locale.cancelSelection"
            @click="close"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- 主体（可滚动） -->
        <div class="space-y-5 overflow-y-auto px-5 py-5">
          <!-- 行内派发提示：该券状态不可直接派发 -->
          <p
            v-if="notice"
            class="rounded-xl border border-warning-20 bg-warning-10 px-3 py-2.5 text-[11px] leading-relaxed text-warning"
          >
            {{ notice }}
          </p>

          <!-- 接收人：树形选择器 -->
          <div>
            <p class="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignSelectUser }}</p>
            <CardCodeRecipientPicker v-model="recipients" :max="recipientsMax" />
          </div>

          <!-- 券来源 -->
          <div>
            <p class="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignSource }}</p>
            <div class="flex gap-1 rounded-xl border border-border-secondary bg-bg-primary p-1">
              <button
                type="button"
                class="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                :class="source === 'generate' ? 'bg-primary-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'"
                @click="source = 'generate'"
              >
                {{ locale.assignSourceGenerate }}
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                :class="source === 'selected' ? 'bg-primary-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'"
                @click="source = 'selected'"
              >
                {{ locale.assignSourceSelected }}
              </button>
            </div>

            <!-- 使用已有点歌券 -->
            <div v-if="source === 'selected'" class="mt-2 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5">
              <p class="mb-2 text-sm text-text-primary">{{ getMessage('assignSelectedCodes', selectedIds.length) }}</p>
              <p class="mb-2 text-[11px] text-text-tertiary">{{ locale.assignSelectCodesHint }}</p>
              <CardCodeAvailablePicker v-model="selectedIds" :preset-coupons="props.coupons" />
            </div>

            <!-- 来源二：按接收人现场生成 -->
            <div v-else class="mt-2">
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignCountPerUser }}</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="countPerUser"
                  type="number"
                  min="1"
                  max="100"
                  class="w-24 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
                >
                <p class="text-[11px] leading-relaxed text-text-tertiary">
                  {{ getMessage('assignGenerateHint', countPerUser, resolvedRecipientCount) }}
                </p>
              </div>
            </div>
          </div>

          <!-- 派发分布提示 -->
          <p class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-[11px] leading-relaxed text-text-tertiary">
            <template v-if="source === 'selected'">
              {{ getMessage('assignDistributionHint', selectedIds.length, resolvedRecipientCount) }}
            </template>
            <template v-else>
              {{ getMessage('assignGenerateDistributionHint', countPerUser, resolvedRecipientCount) }}
            </template>
          </p>

          <!-- 备注 -->
          <div>
            <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.note }}</label>
            <input
              v-model="note"
              type="text"
              :placeholder="locale.assignNotePlaceholder"
              class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            >
          </div>

          <!-- 通知 -->
          <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-text-secondary">
            <input v-model="notify" type="checkbox" class="h-4 w-4 rounded border-border-tertiary bg-bg-secondary text-primary">
            {{ locale.assignNotify }}
          </label>

          <!-- 提交 -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="flex items-center gap-2 rounded-xl bg-primary-hover px-4 py-2 text-xs font-black text-text-primary transition-colors hover:bg-primary disabled:opacity-50"
              :disabled="assigning || !canSubmit"
              @click="submit"
            >
              <AppSpinner v-if="assigning" :size="14" color="white" />
              <Send v-else :size="14" /> {{ assigning ? locale.exporting : locale.assignSubmit }}
            </button>
            <span v-if="assignResult" class="text-xs font-bold" :class="assignResult.failedCount > 0 ? 'text-warning' : 'text-success'">
              {{ assignResult.failedCount > 0
                ? getMessage('assignPartial', assignResult.assignedCount, assignResult.failedCount)
                : getMessage('assignSuccess', assignResult.assignedCount) }}
            </span>
          </div>

          <!-- 派发结果明细 -->
          <div v-if="assignResult" class="space-y-2 rounded-xl border border-border-secondary bg-bg-primary p-3">
            <p class="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignResultTitle }}</p>
            <p class="text-xs font-bold text-text-primary">
              {{ getMessage('assignResultSummary', assignResult.assignedCount, assignResult.servedRecipients, assignResult.failedCount) }}
            </p>
            <p v-if="assignResult.skippedRecipients.length" class="text-[11px] leading-relaxed text-warning">
              {{ getMessage('assignSkippedRecipients', assignResult.skippedRecipients.length) }}
              {{ assignResult.skippedRecipients.map((item) => item.name || item.username).join('、') }}
            </p>
            <p v-if="assignResult.generateMode && assignResult.generatedCodes.length" class="text-[11px] leading-relaxed text-text-tertiary">
              {{ getMessage('assignGeneratedCodes', assignResult.generatedCodes.length) }}
              {{ assignResult.generatedCodes.join('、') }}
            </p>
            <p v-if="assignResult.invalidRecipients.length" class="text-[11px] leading-relaxed text-error">
              {{ locale.assignInvalidRecipients }}
              {{ assignResult.invalidRecipients.map((item) => `#${item.userId} ${localizeFailure(item)}`).join('；') }}
            </p>
            <div v-if="assignResult.failures.length" class="space-y-1">
              <p v-for="(failure, index) in assignResult.failures" :key="index" class="text-[11px] leading-relaxed text-text-secondary">
                <span class="font-mono text-text-primary">{{ failure.code || `#${failure.cardCodeId}` }}</span>
                — {{ localizeFailure(failure) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Send, X } from '@lucide/vue'
import CardCodeRecipientPicker from '~/components/Admin/CardCodeRecipientPicker.vue'
import CardCodeAvailablePicker from '~/components/Admin/CardCodeAvailablePicker.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  // 预勾选券
  coupons: {
    type: Array,
    default: () => []
  },
  // 派发提示
  notice: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'dispatched'])

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const { msg: getMessage } = useLocaleText(locale)
const { localize: localizeServerError } = useServerErrors()
const localizeFailure = (item) => localizeServerError(
  { data: item?.error },
  locale.value.assignFailed
)

const recipients = ref([])
const source = ref('selected')
const countPerUser = ref(1)
const note = ref('')
const notify = ref(true)
const assigning = ref(false)
const assignResult = ref(null)
// 弹窗内勾选的点歌券 ID（「使用已有点歌券」来源）
const selectedIds = ref([])

const recipientsMax = 500
const presetIds = computed(() =>
  props.coupons
    .map((item) => Number(item?.id))
    .filter((id) => Number.isInteger(id) && id > 0)
)
const resolvedRecipientCount = computed(() => recipients.value.length)

const canSubmit = computed(() => {
  if (resolvedRecipientCount.value <= 0) return false
  if (source.value === 'generate') {
    return Number.isInteger(countPerUser.value) && countPerUser.value >= 1 && countPerUser.value <= 100
  }
  return selectedIds.value.length > 0
})

// 打开弹窗时重置表单
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    assignResult.value = null
    assigning.value = false
    recipients.value = []
    note.value = ''
    notify.value = true
    countPerUser.value = 1
    selectedIds.value = [...presetIds.value]
    source.value = 'selected'
  }
)

const close = () => emit('update:modelValue', false)

const submit = async () => {
  if (assigning.value) return
  if (!resolvedRecipientCount.value) {
    showToast(locale.value?.assignNoUser || '请先选择接收用户', 'warning')
    return
  }
  const useGenerate = source.value === 'generate'
  if (!useGenerate && !selectedIds.value.length) {
    showToast(locale.value?.assignNoCodes || '请先在列表中勾选要派发的点歌券', 'warning')
    return
  }
  if (useGenerate && (!Number.isInteger(countPerUser.value) || countPerUser.value < 1)) {
    showToast(locale.value?.assignInvalidCount || '每人派发张数必须为正整数', 'warning')
    return
  }

  assigning.value = true
  assignResult.value = null
  try {
    const res = await $fetch('/api/admin/card-codes/assign', {
      method: 'POST',
      body: {
        userIds: recipients.value.map((item) => item.id),
        ...(useGenerate
          ? { countPerUser: countPerUser.value }
          : { cardCodeIds: selectedIds.value }),
        note: note.value.trim(),
        notify: notify.value
      }
    })

    assignResult.value = {
      assignedCount: Number(res?.assignedCount || 0),
      failedCount: Number(res?.failedCount || 0),
      servedRecipients: Number(res?.servedRecipients || 0),
      generateMode: Boolean(res?.generateMode),
      generatedCodes: Array.isArray(res?.generatedCodes) ? res.generatedCodes : [],
      skippedRecipients: Array.isArray(res?.skippedRecipients) ? res.skippedRecipients : [],
      invalidRecipients: Array.isArray(res?.invalidRecipients) ? res.invalidRecipients : [],
      failures: Array.isArray(res?.failures) ? res.failures : []
    }

    if (assignResult.value.assignedCount > 0) {
      showToast(
        assignResult.value.failedCount > 0
          ? getMessage('assignPartial', assignResult.value.assignedCount, assignResult.value.failedCount)
          : getMessage('assignSuccess', assignResult.value.assignedCount),
        assignResult.value.failedCount > 0 ? 'warning' : 'success'
      )
    } else {
      showToast(locale.value?.assignAllFailed || '所有点歌券派发失败', 'error')
    }

    emit('dispatched')
  } catch (error) {
    console.error('派发点歌券失败', error)
    showToast(localizeServerError(error, locale.value.assignFailed), 'error')
  } finally {
    assigning.value = false
  }
}
</script>
