<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-bg-primary-85 backdrop-blur-sm"
        @click.self="handleCancel"
      >
        <div
          class="w-full max-w-lg bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <!-- 头部 -->
          <div class="px-7 pt-7 pb-5 flex items-start gap-4">
            <div
              class="w-11 h-11 shrink-0 rounded-2xl bg-primary-10 text-primary flex items-center justify-center"
            >
              <Icon :size="22" :name="mode === 'required' ? 'clock' : 'settings'" />
            </div>
            <div class="min-w-0">
              <h3 class="text-lg font-bold text-text-primary tracking-tight">
                {{ text.title }}
              </h3>
              <p class="mt-1 text-xs text-text-tertiary leading-relaxed">
                {{ text.subtitle }}
              </p>
            </div>
          </div>

          <!-- 表单主体 -->
          <div class="options-body px-7 pb-6 space-y-5 overflow-y-auto">
            <!-- 一、播出日期 + 时段（仅在时段选择功能开启时显示） -->
            <div v-if="slotEnabled" class="options-section">
              <div class="options-section-head">
                <span class="options-section-title">
                  <Icon :size="14" name="calendar" />
                  <span>{{ text.slotSectionTitle }}</span>
                </span>
                <button
                  v-if="localDate || localTimeId"
                  class="options-clear-link"
                  type="button"
                  @click="clearSlot"
                >
                  {{ text.clearSlot }}
                </button>
              </div>

              <div class="options-field">
                <label class="options-label" for="options-slot-date">
                  <span>{{ text.dateLabel }}</span>
                  <span class="options-tag">{{ text.optional }}</span>
                </label>
                <AppDatePicker
                  v-model="localDate"
                  size="md"
                  rounded="lg"
                  class-name="w-full"
                  :min="minDate"
                />
              </div>

              <div class="options-field">
                <label class="options-label" for="options-slot-time">
                  <span>{{ text.timeLabel }}</span>
                  <span :class="['options-tag', { 'options-tag-required': slotRequired }]">
                    {{ slotRequired ? text.required : text.optional }}
                  </span>
                </label>
                <CustomSelect
                  v-model="localTimeId"
                  :options="timeOptions"
                  label-key="displayName"
                  value-key="id"
                  :placeholder="text.timePlaceholder"
                  :disabled="availableTimes.length === 0"
                />
                <p v-if="localDate && availableTimes.length === 0" class="options-hint is-error">
                  {{ text.noSlotsForDate }}
                </p>
                <p v-else-if="localTimeId && !localDate" class="options-hint">
                  {{ text.dateOptionalHint }}
                </p>
                <p v-else class="options-hint">
                  {{ localDate ? text.timeRestrictedHint : text.timeFreeHint }}
                </p>
              </div>
            </div>

            <!-- 投稿内容 -->
            <div
              v-if="showNote || showAnonymous || showCardCode"
              class="options-group"
              :class="{ 'options-group--separated': slotEnabled }"
            >
              <!-- 2.1 投稿留言 / 匿名投稿 -->
              <div v-if="showNote || showAnonymous" class="options-section">
                <div class="options-section-head">
                  <span class="options-section-title">
                    <Icon :size="14" name="message-circle" />
                    <span>{{ showNote ? text.noteLabel : text.anonymousLabel }}</span>
                  </span>
                  <div v-if="showNote" class="options-inline-options">
                    <label class="options-checkbox">
                      <input v-model="notePublicModel" type="checkbox" class="options-checkbox-input" />
                      <span class="options-checkbox-box">
                        <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M1 5L4.5 8.5L11 1.5"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                      <span class="options-checkbox-text">{{ text.publicToUsers }}</span>
                    </label>
                  </div>
                </div>

                <textarea
                  v-if="showNote"
                  id="options-note"
                  v-model="noteModel"
                  maxlength="300"
                  class="options-note-input"
                  :placeholder="text.notePlaceholder"
                />

                <div class="options-note-footer">
                  <label v-if="showAnonymous" class="options-checkbox">
                    <input
                      v-model="noteAnonymousModel"
                      type="checkbox"
                      class="options-checkbox-input"
                    />
                    <span class="options-checkbox-box">
                      <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M1 5L4.5 8.5L11 1.5"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </span>
                    <span class="options-checkbox-text">{{ text.anonymous }}</span>
                  </label>
                  <span v-else />
                  <span v-if="showNote" class="options-counter">{{ noteLength }}/300</span>
                </div>

                <p v-if="showNote && noteApprovalRequired" class="options-hint is-warning">
                  <Icon name="info" :size="12" class="shrink-0" />
                  <span class="truncate">{{ text.approvalHint }}</span>
                </p>
              </div>

              <!-- 2.2 点歌券 -->
              <div v-if="showCardCode" class="options-section">
                <div class="options-section-head">
                  <span class="options-section-title">
                    <Icon :size="14" name="gift" />
                    <span>{{ text.cardCodeLabel }}</span>
                    <span :class="['options-tag', { 'options-tag-required': cardCodeRequired }]">
                      {{ cardCodeRequired ? text.required : text.optional }}
                    </span>
                  </span>
                  <button
                    v-if="cardCode || cardCodeDraft"
                    class="options-clear-link"
                    type="button"
                    @click="emit('clear-card-code')"
                  >
                    {{ text.clear }}
                  </button>
                </div>

                <!-- 点歌券下拉：我的点歌券 + 「手动输入券码」同在一个列表里选择 -->
                <div class="options-field">
                  <label class="options-label" for="options-card-code-select">
                    <span>{{ text.cardCodeSelectLabel }}</span>
                    <span v-if="myCardCodes.length" class="options-tag">
                      {{ text.cardCodeMyCodesCount(myCardCodes.length) }}
                    </span>
                  </label>
                  <CustomSelect
                    :model-value="cardCodeSelection"
                    :options="cardCodeOptions"
                    label-key="displayName"
                    value-key="code"
                    :placeholder="text.cardCodeSelectPlaceholder"
                    @update:model-value="handleCardCodeSelect"
                  />
                  <p v-if="!myCardCodes.length" class="options-hint">
                    {{ text.cardCodeNoCodesHint }}
                  </p>
                </div>

                <!-- 手动输入：仅在下拉中选中「手动输入券码」后展开 -->
                <div v-if="showManualInput" class="options-field">
                  <label class="options-label" for="options-card-code">
                    <span>{{ text.cardCodeManualInput }}</span>
                  </label>
                  <div class="options-card-code-row">
                    <input
                      id="options-card-code"
                      v-model="cardCodeDraftModel"
                      class="options-input"
                      :placeholder="text.cardCodeManualPlaceholder"
                      type="text"
                      @keydown.enter.prevent="emit('save-card-code')"
                    >
                    <button
                      class="options-mini-btn"
                      type="button"
                      :disabled="cardCodeChecking"
                      @click="emit('save-card-code')"
                    >
                      {{ cardCodeChecking ? text.validatingShort : text.cardCodeAddManually }}
                    </button>
                  </div>
                </div>

                <p class="options-hint" :class="cardCodeStatusClass">{{ cardCodeStatus }}</p>
                <p class="options-hint">{{ text.cardCodeHelper }}</p>
              </div>
            </div>

            <!-- 空内容提示 -->
            <p v-if="isEmpty" class="options-hint">
              {{ text.emptyHint }}
            </p>

            <!-- 错误提示 -->
            <p v-if="errorMessage" class="options-hint is-error">{{ errorMessage }}</p>
          </div>

          <!-- 底部操作 -->
          <div
            class="px-7 py-5 bg-bg-secondary-50 border-t border-border-secondary-50 flex items-center justify-end gap-3"
          >
            <button
              class="px-5 py-2.5 text-xs font-bold text-text-tertiary hover:text-text-secondary transition-all"
              type="button"
              @click="handleCancel"
            >
              {{ text.cancel }}
            </button>
            <button
              class="px-7 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg transition-all disabled:opacity-50"
              type="button"
              @click="handleConfirm"
            >
              {{ text.confirm }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import { getBeijingWeekday } from '~/utils/timeUtils'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  /** 弹窗模式：options 保存选项，required 确认后继续投稿。 */
  mode: {
    type: String,
    default: 'options'
  },
  // 播出时段选择功能是否开启（关闭时弹窗内不出现任何时段相关控件）
  slotEnabled: {
    type: Boolean,
    default: false
  },
  // 是否强制选择时段（仅影响标签文案与 required 模式下的校验）
  slotRequired: {
    type: Boolean,
    default: false
  },
  // 全部启用的播出时段
  playTimes: {
    type: Array,
    default: () => []
  },
  // 初始日期（YYYY-MM-DD）
  initialDate: {
    type: String,
    default: ''
  },
  // 初始时段 id
  initialTimeId: {
    type: [String, Number],
    default: ''
  },
  // 今天的日期串（北京时间），作为日期输入下限
  today: {
    type: String,
    default: ''
  },
  // 时段展示文案格式化函数（名称 + 时间范围）
  formatLabel: {
    type: Function,
    default: null
  },
  // 留言：是否展示留言输入框
  showNote: {
    type: Boolean,
    default: false
  },
  // 留言内容（v-model:note）
  note: {
    type: String,
    default: ''
  },
  // 留言是否公开给已登录用户（v-model:note-public）
  notePublic: {
    type: Boolean,
    default: true
  },
  // 是否匿名投稿（v-model:note-anonymous）
  noteAnonymous: {
    type: Boolean,
    default: false
  },
  // 是否展示「匿名投稿」勾选项
  showAnonymous: {
    type: Boolean,
    default: false
  },
  // 公开留言是否需要审核
  noteApprovalRequired: {
    type: Boolean,
    default: false
  },
  // 点歌券：是否展示点歌券输入
  showCardCode: {
    type: Boolean,
    default: false
  },
  // 已保存的点歌券
  cardCode: {
    type: String,
    default: ''
  },
  // 点歌券输入草稿（v-model:card-code-draft）
  cardCodeDraft: {
    type: String,
    default: ''
  },
  // 点歌券是否必填
  cardCodeRequired: {
    type: Boolean,
    default: false
  },
  // 派发到当前用户名下的点歌券（用于下拉选择）
  myCardCodes: {
    type: Array,
    default: () => []
  },
  // 点歌券状态文案与语义色
  cardCodeStatus: {
    type: String,
    default: ''
  },
  cardCodeStatusTone: {
    type: String,
    default: 'idle'
  },
  cardCodeChecking: {
    type: Boolean,
    default: false
  },
  // 界面文案
  text: {
    type: Object,
    required: true
  }
})

const emit = defineEmits([
  'update:show',
  'update:note',
  'update:notePublic',
  'update:noteAnonymous',
  'update:cardCodeDraft',
  'save-card-code',
  'clear-card-code',
  'select-my-card-code',
  'confirm',
  'cancel'
])

const localDate = ref('')
const localTimeId = ref('')
const errorMessage = ref('')
// 是否主动选中了下拉中的「手动输入券码」（选中后展开输入框）
const manualCardCodeMode = ref(false)

const minDate = computed(() => props.today || '')

/** 留言 / 匿名 / 点歌券草稿：v-model 直接透传，父组件是唯一数据源 */
const noteModel = computed({
  get: () => props.note,
  set: (value) => emit('update:note', value)
})

const notePublicModel = computed({
  get: () => props.notePublic,
  set: (value) => emit('update:notePublic', value)
})

const noteAnonymousModel = computed({
  get: () => props.noteAnonymous,
  set: (value) => emit('update:noteAnonymous', value)
})

const cardCodeDraftModel = computed({
  get: () => props.cardCodeDraft,
  set: (value) => emit('update:cardCodeDraft', value)
})

const noteLength = computed(() => String(props.note ?? '').length)

/** 派发到名下的点歌券下拉项 */
const myCardCodeOptions = computed(() =>
  (props.myCardCodes || []).map((item) => ({
    ...item,
    displayName: item.code
  }))
)

/** 「手动输入券码」在下拉列表中的特殊值 */
const MANUAL_CARD_CODE_VALUE = '__manual__'

/** 点歌券下拉包含已派发券与手动输入项。 */
const cardCodeOptions = computed(() => [
  ...myCardCodeOptions.value,
  {
    code: MANUAL_CARD_CODE_VALUE,
    displayName: String(props.text?.cardCodeManualOption || '手动输入券码')
  }
])

/** 根据已保存券码计算下拉选中值。 */
const cardCodeSelection = computed(() => {
  if (manualCardCodeMode.value) return MANUAL_CARD_CODE_VALUE
  const current = String(props.cardCode || '').trim().toUpperCase()
  if (!current) return ''
  const owned = (props.myCardCodes || []).some((item) => String(item.code).toUpperCase() === current)
  return owned ? current : MANUAL_CARD_CODE_VALUE
})

/** 是否处于「手动输入券码」模式（展开输入框） */
const showManualInput = computed(() => cardCodeSelection.value === MANUAL_CARD_CODE_VALUE)

/** 从下拉中选取点歌券：派发券走校验链路，手动输入项则展开输入框 */
const handleCardCodeSelect = (value) => {
  const code = String(value || '').trim()
  if (!code) {
    manualCardCodeMode.value = false
    emit('clear-card-code')
    return
  }
  if (code === MANUAL_CARD_CODE_VALUE) {
    manualCardCodeMode.value = true
    return
  }
  manualCardCodeMode.value = false
  emit('select-my-card-code', code.toUpperCase())
}

/** 三段控件全部不可用时给出提示（例如留言、点歌券、时段均未开启） */
const isEmpty = computed(
  () => !props.slotEnabled && !props.showNote && !props.showAnonymous && !props.showCardCode
)

const cardCodeStatusClass = computed(() => ({
  'is-success': props.cardCodeStatusTone === 'ok',
  'is-error': props.cardCodeStatusTone === 'error',
  'is-warning': props.cardCodeStatusTone === 'warn'
}))

/** 计算日期串（YYYY-MM-DD）对应的星期，0=周日…6=周六；解析失败返回 null */
const getWeekday = (dateString) => getBeijingWeekday(dateString)

/** 时段是否在指定星期开放（未配置星期 = 每天开放） */
const slotAppliesToWeekday = (slot, weekday) => {
  if (weekday === null) return true
  const days = Array.isArray(slot?.weekdays) && slot.weekdays.length > 0 ? slot.weekdays : null
  return days === null || days.includes(weekday)
}

/** 按日期星期过滤可选时段。 */
const availableTimes = computed(() => {
  const weekday = getWeekday(localDate.value)
  return props.playTimes.filter((slot) => slotAppliesToWeekday(slot, weekday))
})

/** 时段下拉选项：id 统一转成字符串，与 localTimeId 的取值类型保持一致 */
const timeOptions = computed(() =>
  availableTimes.value.map((slot) => ({
    ...slot,
    id: String(slot.id),
    displayName: props.formatLabel ? props.formatLabel(slot) : slot.name
  }))
)

/** 打开时同步父组件的当前选择 */
watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    localDate.value = props.slotEnabled ? props.initialDate || '' : ''
    localTimeId.value = props.slotEnabled && props.initialTimeId ? String(props.initialTimeId) : ''
    errorMessage.value = ''
    // 打开时重置手动模式：由已保存券码是否在「我的点歌券」中决定
    manualCardCodeMode.value = false
  }
)

/** 父组件清空点歌券后，退出手动输入模式 */
watch(
  () => props.cardCode,
  (value) => {
    if (!String(value || '').trim()) {
      manualCardCodeMode.value = false
    }
  }
)

/** 切换日期后清除失效时段。 */
watch(localDate, () => {
  errorMessage.value = ''
  if (!localTimeId.value) return
  const slot = props.playTimes.find((item) => String(item.id) === localTimeId.value)
  if (!slot) {
    localTimeId.value = ''
    return
  }
  if (!slotAppliesToWeekday(slot, getWeekday(localDate.value))) {
    localTimeId.value = ''
  }
})

const clearSlot = () => {
  localDate.value = ''
  localTimeId.value = ''
  errorMessage.value = ''
}

const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}

const handleConfirm = () => {
  // 只有「投稿后强制选时段」模式才要求必须选中时段；主动打开的选项弹窗允许留空
  if (props.mode === 'required' && !localTimeId.value) {
    errorMessage.value = props.text.timeRequiredError
    return
  }
  emit('confirm', {
    date: localDate.value || null,
    timeId: localTimeId.value || null
  })
  emit('update:show', false)
}
</script>

<style scoped>
.options-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 「投稿留言 / 点歌券」同属一组，组内不再画分割线 */
.options-group {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 分割线只出现在「投稿内容」组与「播出安排」之间 */
.options-group--separated {
  padding-top: 1.25rem;
  border-top: 1px dashed var(--border-secondary-50);
}

.options-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.options-section-title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1.35;
  color: var(--text-secondary);
}

.options-section-title :deep(svg),
.options-hint :deep(svg) {
  flex: 0 0 auto;
  align-self: center;
  display: block;
  vertical-align: middle;
}

.options-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.options-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-tertiary);
}

.options-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-quaternary);
  border: 1px solid var(--border-secondary);
  border-radius: 4px;
  padding: 0 0.25rem;
  line-height: 1.4;
}

.options-tag-required {
  color: var(--color-error);
  border-color: var(--color-error);
}

.options-clear-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  transition: color 0.15s ease;
}

.options-clear-link:hover {
  color: var(--color-error);
}

.options-hint {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.options-hint.is-error {
  color: var(--color-error);
  font-weight: 700;
}

.options-hint.is-warning {
  color: var(--color-warning);
}

.options-hint.is-success {
  color: var(--color-success);
  font-weight: 700;
}

.options-inline-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

.options-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  min-width: 0;
}

.options-checkbox-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.options-checkbox-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  border: 1.5px solid var(--border-secondary);
  border-radius: 4px;
  background: var(--bg-secondary-60);
  transition: all 0.15s ease;
}

.options-checkbox-box svg {
  width: 11px;
  height: 9px;
  color: var(--text-primary);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.options-checkbox-input:checked + .options-checkbox-box {
  border-color: var(--primary);
  background: var(--primary);
}

.options-checkbox-input:checked + .options-checkbox-box svg {
  opacity: 1;
}

.options-checkbox-input:focus-visible + .options-checkbox-box {
  outline: 2px solid var(--primary-50);
  outline-offset: 2px;
}

.options-checkbox-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.4;
}

.options-note-input {
  width: 100%;
  min-height: 64px;
  border-radius: 0.75rem;
  border: 1px solid var(--border-secondary);
  background: var(--bg-secondary-60);
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  resize: vertical;
  transition: all 0.15s ease;
}

.options-note-input::placeholder {
  color: var(--text-quaternary);
}

.options-note-input:focus {
  outline: none;
  border-color: var(--primary-50);
  box-shadow: 0 0 0 1px var(--primary-10);
}

.options-note-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.options-counter {
  flex-shrink: 0;
}

.options-card-code-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.options-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  border-radius: 0.625rem;
  border: 1px solid var(--border-secondary);
  background: var(--bg-secondary-60);
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.options-input::placeholder {
  color: var(--text-quaternary);
  font-weight: 500;
  letter-spacing: 0;
}

.options-input:focus {
  outline: none;
  border-color: var(--primary-50);
  box-shadow: 0 0 0 1px var(--primary-10);
}

.options-mini-btn {
  flex-shrink: 0;
  height: 38px;
  padding: 0 0.875rem;
  border-radius: 0.625rem;
  border: 1px solid var(--border-secondary);
  background: var(--bg-tertiary-50);
  font-size: 11px;
  font-weight: 800;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.options-mini-btn:hover:not(:disabled) {
  border-color: var(--primary-50);
  color: var(--text-primary);
}

.options-mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.options-body {
  scrollbar-width: thin;
}
</style>
