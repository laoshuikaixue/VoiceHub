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
          class="w-full max-w-md bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <!-- 头部 -->
          <div class="px-7 pt-7 pb-5 flex items-start gap-4">
            <div
              class="w-11 h-11 shrink-0 rounded-2xl bg-primary-10 text-primary flex items-center justify-center"
            >
              <Icon :size="22" name="clock" />
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
          <div class="px-7 pb-6 space-y-5 overflow-y-auto">
            <!-- 第一步：播出日期（可选） -->
            <div class="play-slot-field">
              <label class="play-slot-field-label" for="play-slot-date">
                <Icon :size="14" name="calendar" />
                <span>{{ text.dateLabel }}</span>
                <span class="play-slot-optional-tag">{{ text.optional }}</span>
              </label>
              <input
                id="play-slot-date"
                v-model="localDate"
                class="form-input play-slot-date-input"
                type="date"
                :min="minDate"
              >
              <p class="play-slot-field-hint">
                {{ localDate ? text.dateSelectedHint : text.dateOptionalHint }}
              </p>
            </div>

            <!-- 第二步：播出时段（必选） -->
            <div class="play-slot-field">
              <label class="play-slot-field-label" for="play-slot-time">
                <Icon :size="14" name="clock" />
                <span>{{ text.timeLabel }}</span>
                <span class="play-slot-required-tag">{{ text.required }}</span>
              </label>
              <CustomSelect
                v-model="localTimeId"
                :options="timeOptions"
                label-key="displayName"
                value-key="id"
                :placeholder="text.timePlaceholder"
                :disabled="availableTimes.length === 0"
              />
              <p v-if="localDate && availableTimes.length === 0" class="play-slot-field-error">
                {{ text.noSlotsForDate }}
              </p>
              <p v-else class="play-slot-field-hint">
                {{ localDate ? text.timeRestrictedHint : text.timeFreeHint }}
              </p>
            </div>

            <!-- 自动分配提示 -->
            <div
              v-if="!localDate && localTimeId"
              class="play-slot-auto-hint"
            >
              <Icon :size="15" name="info" />
              <span>{{ text.autoAssignHint }}</span>
            </div>

            <!-- 错误提示 -->
            <p v-if="errorMessage" class="play-slot-field-error">
              {{ errorMessage }}
            </p>
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
              :disabled="!localTimeId"
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

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  // 全部启用的播出时段
  playTimes: {
    type: Array,
    default: () => []
  },
  // 时段是否必选（对应后台「点歌时段必选」开关）
  required: {
    type: Boolean,
    default: false
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
  // 星期文案数组（0=周日…6=周六）
  weekdayNames: {
    type: Array,
    default: () => []
  },
  // 界面文案
  text: {
    type: Object,
    required: true
  },
  // 时段展示文案格式化函数（名称 + 时间范围）
  formatLabel: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['update:show', 'confirm', 'cancel'])

const localDate = ref('')
const localTimeId = ref('')
const errorMessage = ref('')

const minDate = computed(() => props.today || '')

/** 计算日期串（YYYY-MM-DD）对应的星期，0=周日…6=周六；解析失败返回 null */
const getWeekday = (dateString) => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null
  const [y, m, d] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCDay()
}

/** 时段是否在指定星期开放（未配置星期 = 每天开放） */
const slotAppliesToWeekday = (slot, weekday) => {
  if (weekday === null) return true
  const days = Array.isArray(slot?.weekdays) && slot.weekdays.length > 0 ? slot.weekdays : null
  return days === null || days.includes(weekday)
}

/**
 * 可选时段列表：
 * - 选了日期 → 仅列出该日期星期开放的时段（日期优先级高于时段）
 * - 未选日期 → 列出全部启用时段
 */
const availableTimes = computed(() => {
  const weekday = getWeekday(localDate.value)
  return props.playTimes.filter((slot) => slotAppliesToWeekday(slot, weekday))
})

/** 时段下拉选项 */
const timeOptions = computed(() =>
  availableTimes.value.map((slot) => ({
    ...slot,
    displayName: props.formatLabel ? props.formatLabel(slot) : slot.name
  }))
)

/** 打开时重置为初始值 */
watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    localDate.value = props.initialDate || ''
    localTimeId.value = props.initialTimeId ? String(props.initialTimeId) : ''
    errorMessage.value = ''
  }
)

/**
 * 切换日期后：若已选时段在新的日期星期不开放，自动清空时段。
 * 日期优先级高于时段——不允许出现「该日期没有的时段」。
 */
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

const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}

const handleConfirm = () => {
  if (!localTimeId.value) {
    errorMessage.value = props.text.timeRequiredError
    return
  }
  emit('confirm', {
    date: localDate.value || null,
    timeId: localTimeId.value
  })
  emit('update:show', false)
}
</script>

<style scoped>
.play-slot-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.play-slot-field-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.play-slot-required-tag {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--color-error, #ef4444);
  border: 1px solid var(--color-error, #ef4444);
  border-radius: 4px;
  padding: 0 0.25rem;
  line-height: 1.4;
}

.play-slot-optional-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-quaternary);
  border: 1px solid var(--border-secondary);
  border-radius: 4px;
  padding: 0 0.25rem;
  line-height: 1.4;
}

.play-slot-date-input {
  cursor: pointer;
}

.play-slot-field-hint {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.play-slot-field-error {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-error, #ef4444);
  line-height: 1.5;
}

.play-slot-auto-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border-radius: 0.75rem;
  background: var(--bg-tertiary-50);
  border: 1px solid var(--border-secondary-50);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.play-slot-auto-hint :deep(svg) {
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
