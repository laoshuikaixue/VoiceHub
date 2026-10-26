<template>
  <div ref="containerRef" class="relative" :class="className">
    <!-- 触发器：盒子结构与 CustomSelect 完全一致，保证并排时高度/基线对齐 -->
    <button
      ref="triggerRef"
      type="button"
      class="flex w-full items-center gap-2 text-left transition-all focus:outline-none focus-visible:border-primary-30"
      :class="[sizeClass, roundedClass, variantClass, stateClass]"
      :disabled="disabled"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click="toggle"
      @keydown.esc.stop="close"
    >
      <span class="flex min-w-0 flex-1 flex-col">
        <span
          v-if="label"
          class="mb-0.5 text-[8px] font-black uppercase leading-none tracking-widest transition-colors"
          :class="isOpen ? 'text-primary' : 'text-text-disabled'"
        >
          {{ label }}
        </span>
        <span class="truncate" :class="valueTextClass">{{ displayText }}</span>
      </span>
      <Calendar
        class="shrink-0 transition-colors"
        :size="iconSize"
        :class="isOpen ? 'text-primary' : 'text-text-disabled'"
      />
    </button>

    <!-- 日历浮层：Teleport 到 body，动态层级压过任何弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          ref="popupRef"
          :style="[popupStyle, { zIndex }]"
          class="fixed w-[268px] rounded-xl border border-border-secondary bg-bg-primary p-2 shadow-2xl backdrop-blur-xl"
          role="dialog"
          tabindex="-1"
          :aria-label="text.placeholder"
          @keydown.esc.stop="close"
        >
          <!-- 头部：翻页 + 年/月（可点击下钻切换视图） -->
          <div class="mb-1 flex items-center justify-between gap-1">
            <button
              type="button"
              class="date-nav-btn"
              :aria-label="viewMode === 'years' ? text.prevYear : viewMode === 'months' ? text.prevYear : text.prevMonth"
              @click="shift(-1)"
            >
              <ChevronLeft :size="14" />
            </button>

            <div class="flex min-w-0 items-center justify-center gap-1">
              <button
                v-if="viewMode !== 'years'"
                type="button"
                class="date-title-btn"
                :class="viewMode === 'months' ? 'text-primary' : ''"
                @click="toggleView('years')"
              >
                {{ yearTitle }}
              </button>
              <button
                v-if="viewMode === 'days'"
                type="button"
                class="date-title-btn"
                @click="toggleView('months')"
              >
                {{ monthTitle }}
              </button>
              <span v-else-if="viewMode === 'years'" class="date-title-static">{{ yearRangeTitle }}</span>
            </div>

            <button
              type="button"
              class="date-nav-btn"
              :aria-label="viewMode === 'years' ? text.nextYear : viewMode === 'months' ? text.nextYear : text.nextMonth"
              @click="shift(1)"
            >
              <ChevronRight :size="14" />
            </button>
          </div>

          <!-- 日期视图 -->
          <template v-if="viewMode === 'days'">
            <div class="mb-1 grid grid-cols-7 gap-0.5">
              <span
                v-for="(weekday, index) in text.weekdays"
                :key="`weekday-${index}`"
                class="flex h-6 items-center justify-center text-[9px] font-black uppercase tracking-wider text-text-disabled"
              >
                {{ weekday }}
              </span>
            </div>
            <div class="grid grid-cols-7 gap-0.5">
              <button
                v-for="cell in calendarCells"
                :key="cell.iso"
                type="button"
                class="date-cell"
                :class="cellClass(cell)"
                :disabled="cell.disabled"
                @click="selectDay(cell)"
              >
                {{ cell.day }}
              </button>
            </div>

            <!-- 底部操作 -->
            <div class="mt-1.5 flex items-center justify-between border-t border-border-secondary pt-1.5">
              <button
                v-if="clearable"
                type="button"
                class="date-foot-btn hover:text-error"
                @click="clear"
              >
                {{ text.clear }}
              </button>
              <span v-else />
              <button
                type="button"
                class="date-foot-btn"
                :class="todayDisabled ? 'cursor-not-allowed opacity-40' : ''"
                :disabled="todayDisabled"
                @click="goToday"
              >
                {{ text.today }}
              </button>
            </div>
          </template>

          <!-- 月份视图 -->
          <div v-else-if="viewMode === 'months'" class="grid grid-cols-3 gap-1">
            <button
              v-for="(name, index) in text.monthNames"
              :key="`month-${index}`"
              type="button"
              class="date-panel-cell"
              :class="index === viewMonth ? 'is-active' : ''"
              @click="pickMonth(index)"
            >
              {{ name }}
            </button>
          </div>

          <!-- 年份视图 -->
          <div v-else class="grid grid-cols-3 gap-1">
            <button
              v-for="year in yearPage"
              :key="`year-${year}`"
              type="button"
              class="date-panel-cell"
              :class="year === viewYear ? 'is-active' : ''"
              @click="pickYear(year)"
            >
              {{ year }}{{ text.yearSuffix }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Calendar, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { usePopupZIndex } from '~/composables/useZIndex'
import { getSyncedDate } from '~/composables/useSyncedTime'
import { getBeijingDateString } from '~/utils/timeUtils'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  // 框内小标签（与 CustomSelect 的 label 同构）
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: true
  },
  // 可选范围，格式 YYYY-MM-DD
  min: {
    type: String,
    default: ''
  },
  max: {
    type: String,
    default: ''
  },
  // 由调用方指定的北京时间日期
  today: {
    type: String,
    default: ''
  },
  className: {
    type: String,
    default: ''
  },
  // xs | sm（默认，对齐 CustomSelect）| md | lg | xl
  size: {
    type: String,
    default: 'sm'
  },
  // none | md | lg | xl | 2xl | full
  rounded: {
    type: String,
    default: 'lg'
  },
  // boxed：带背景与边框；ghost：透明无边框（嵌在容器内使用）
  variant: {
    type: String,
    default: 'boxed'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const FALLBACK_TEXT = {
  placeholder: '选择日期',
  today: '今天',
  clear: '清除',
  prevMonth: '上一月',
  nextMonth: '下一月',
  prevYear: '上一年',
  nextYear: '下一年',
  weekdays: ['日', '一', '二', '三', '四', '五', '六'],
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  yearSuffix: '年'
}

const { common } = useLocale()
const text = computed(() => ({ ...FALLBACK_TEXT, ...(common.value?.datePicker || {}) }))

const isOpen = ref(false)
const containerRef = ref(null)
const triggerRef = ref(null)
const popupRef = ref(null)
const popupStyle = ref({})
const viewYear = ref(2000)
const viewMonth = ref(0)
const viewMode = ref('days')
const yearsPageStart = ref(2000)

// 浮层层级：打开时取递增层级，确保压过所在弹窗
const { zIndex, onOpenChange } = usePopupZIndex()

const pad2 = (value) => (value < 10 ? `0${value}` : `${value}`)
const toISODate = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

const parseISODate = (value) => {
  const matched = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value ?? '').trim())
  if (!matched) return null
  const year = Number(matched[1])
  const month = Number(matched[2]) - 1
  const day = Number(matched[3])
  if (!year || month < 0 || month > 11 || day < 1 || day > 31) return null
  return { year, month, day }
}

const normalizeISODate = (value) => {
  const parsed = parseISODate(value)
  return parsed ? toISODate(parsed.year, parsed.month, parsed.day) : ''
}

const currentDate = ref(getBeijingDateString(getSyncedDate()))

// 基准日期使用同步后的北京时间
const todayDate = computed(() => {
  const fromProps = parseISODate(props.today)
  if (fromProps) return fromProps
  return parseISODate(currentDate.value)
})
const todayISO = computed(() => toISODate(todayDate.value.year, todayDate.value.month, todayDate.value.day))

const minISO = computed(() => normalizeISODate(props.min))
const maxISO = computed(() => normalizeISODate(props.max))

const isOutOfRange = (iso) => {
  if (minISO.value && iso < minISO.value) return true
  if (maxISO.value && iso > maxISO.value) return true
  return false
}

const selectedDate = computed(() => parseISODate(props.modelValue))
const todayDisabled = computed(() => isOutOfRange(todayISO.value))

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'px-2 py-1 text-[10px]'
    case 'md':
      return 'px-3 py-2.5 text-sm'
    case 'lg':
      return 'px-4 py-3 text-sm'
    case 'xl':
      return 'p-3 text-base'
    case 'sm':
    default:
      return 'px-3 py-2 text-[11px]'
  }
})

const roundedClass = computed(
  () =>
    ({
      none: 'rounded-none',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      full: 'rounded-full'
    })[props.rounded] || 'rounded-lg'
)

const variantClass = computed(() =>
  props.variant === 'ghost' ? 'bg-transparent' : 'bg-bg-primary border'
)

const stateClass = computed(() => {
  if (props.disabled) return 'cursor-not-allowed opacity-50'
  if (props.variant === 'ghost') {
    return isOpen.value ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
  }
  return isOpen.value
    ? 'cursor-pointer border-primary-50 bg-primary-hover-5 shadow-lg'
    : 'cursor-pointer border-border-secondary hover:border-border-tertiary'
})

const iconSize = computed(() => (props.size === 'xs' ? 11 : props.size === 'sm' ? 12 : 14))

const valueTextClass = computed(() => {
  const weight = props.size === 'sm' || props.size === 'xs' ? 'font-bold' : 'font-medium'
  return [weight, displayText.value === placeholderText.value ? 'text-text-disabled' : 'text-text-secondary']
})

const placeholderText = computed(() => props.placeholder || text.value.placeholder)

const displayText = computed(() => {
  const selected = selectedDate.value
  if (!selected) return placeholderText.value
  return `${selected.year}/${pad2(selected.month + 1)}/${pad2(selected.day)}`
})

const yearTitle = computed(() => `${viewYear.value}${text.value.yearSuffix}`)
const monthTitle = computed(() => text.value.monthNames?.[viewMonth.value] ?? `${viewMonth.value + 1}`)
const yearPage = computed(() => Array.from({ length: 12 }, (_, index) => yearsPageStart.value + index))
const yearRangeTitle = computed(() =>
  `${yearsPageStart.value} - ${yearsPageStart.value + 11}`
)

const buildCell = (year, month, day, outside) => {
  const iso = toISODate(year, month, day)
  return {
    iso,
    day,
    outside,
    isToday: iso === todayISO.value,
    isSelected: iso === normalizeISODate(props.modelValue),
    disabled: isOutOfRange(iso)
  }
}

// 固定 42 格（6 行），翻月时高度不跳动
const calendarCells = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const leading = new Date(year, month, 1).getDay()
  const total = daysInMonth(year, month)
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevTotal = daysInMonth(prevYear, prevMonth)
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year

  const cells = []
  for (let offset = leading - 1; offset >= 0; offset -= 1) {
    cells.push(buildCell(prevYear, prevMonth, prevTotal - offset, true))
  }
  for (let day = 1; day <= total; day += 1) {
    cells.push(buildCell(year, month, day, false))
  }
  let nextDay = 1
  while (cells.length < 42) {
    cells.push(buildCell(nextYear, nextMonth, nextDay, true))
    nextDay += 1
  }
  return cells
})

const cellClass = (cell) => {
  if (cell.disabled) return 'is-disabled'
  if (cell.isSelected) return 'is-selected'
  if (cell.isToday) return 'is-today'
  if (cell.outside) return 'is-outside'
  return ''
}

const updatePosition = () => {
  const trigger = triggerRef.value
  if (!trigger || !popupRef.value) return
  const rect = trigger.getBoundingClientRect()
  const popupWidth = popupRef.value.offsetWidth || 268
  const popupHeight = popupRef.value.offsetHeight || 320
  const gap = 4
  const margin = 8
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  let top = rect.bottom + gap
  let transformOrigin = 'top'

  if (spaceBelow < popupHeight + gap && spaceAbove > spaceBelow) {
    top = Math.max(margin, rect.top - popupHeight - gap)
    transformOrigin = 'bottom'
  }

  // 默认左对齐；右侧空间不足时右对齐防溢出
  let left = rect.left
  if (left + popupWidth > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - popupWidth - margin)
  }

  const originClass = transformOrigin === 'bottom' ? 'bottom' : 'top'
  popupStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    transformOrigin: `${originClass} ${rect.left + rect.width / 2 > window.innerWidth / 2 ? 'right' : 'left'}`
  }
}

const syncViewToValue = () => {
  const base = selectedDate.value || todayDate.value
  let year = base.year
  let month = base.month

  // 选中项被 min/max 排除时，视图落在最近的合法月份
  if (minISO.value && toISODate(year, month, 1) < minISO.value.slice(0, 7) + '-01') {
    const minParsed = parseISODate(minISO.value)
    if (minParsed) {
      year = minParsed.year
      month = minParsed.month
    }
  } else if (maxISO.value && toISODate(year, month, 1) > maxISO.value.slice(0, 7) + '-01') {
    const maxParsed = parseISODate(maxISO.value)
    if (maxParsed) {
      year = maxParsed.year
      month = maxParsed.month
    }
  }

  viewYear.value = year
  viewMonth.value = month
  viewMode.value = 'days'
  yearsPageStart.value = Math.floor(year / 12) * 12
}

const toggle = async () => {
  if (props.disabled) return
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  currentDate.value = getBeijingDateString(getSyncedDate())
  syncViewToValue()
  isOpen.value = true
  await nextTick()
  popupRef.value?.focus({ preventScroll: true })
  updatePosition()
  requestAnimationFrame(updatePosition)
}

const close = () => {
  isOpen.value = false
}

const shift = (direction) => {
  if (viewMode.value === 'days') {
    const next = viewMonth.value + direction
    if (next < 0) {
      viewMonth.value = 11
      viewYear.value -= 1
    } else if (next > 11) {
      viewMonth.value = 0
      viewYear.value += 1
    } else {
      viewMonth.value = next
    }
    return
  }
  if (viewMode.value === 'months') {
    viewYear.value += direction
    return
  }
  yearsPageStart.value += direction * 12
}

const toggleView = (mode) => {
  if (mode === 'years') {
    viewMode.value = viewMode.value === 'years' ? 'days' : 'years'
    return
  }
  if (mode === 'months') {
    viewMode.value = viewMode.value === 'months' ? 'days' : 'months'
  }
}

const pickMonth = (month) => {
  viewMonth.value = month
  viewMode.value = 'days'
}

const pickYear = (year) => {
  viewYear.value = year
  yearsPageStart.value = Math.floor(year / 12) * 12
  viewMode.value = 'months'
}

const emitValue = (value) => {
  emit('update:modelValue', value)
  emit('change', value)
}

const selectDay = (cell) => {
  if (cell.disabled || !cell.iso) return
  emitValue(cell.iso)
  if (cell.outside) {
    const parsed = parseISODate(cell.iso)
    if (parsed) {
      viewYear.value = parsed.year
      viewMonth.value = parsed.month
    }
  }
  isOpen.value = false
}

const clear = () => {
  emitValue('')
  isOpen.value = false
}

const goToday = () => {
  currentDate.value = getBeijingDateString(getSyncedDate())
  if (todayDisabled.value) return
  viewYear.value = todayDate.value.year
  viewMonth.value = todayDate.value.month
  viewMode.value = 'days'
  emitValue(todayISO.value)
  isOpen.value = false
}

const handleClickOutside = (event) => {
  if (!isOpen.value) return
  const inTrigger = containerRef.value?.contains(event.target)
  const inPopup = popupRef.value?.contains(event.target)
  if (!inTrigger && !inPopup) isOpen.value = false
}

const handleViewportChange = () => {
  if (isOpen.value) updatePosition()
}

watch(isOpen, (open) => {
  onOpenChange(open)
  if (open) {
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
  } else {
    if (popupRef.value?.contains(document.activeElement)) triggerRef.value?.focus({ preventScroll: true })
    window.removeEventListener('scroll', handleViewportChange, true)
    window.removeEventListener('resize', handleViewportChange)
  }
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
})
</script>

<style scoped>
.date-nav-btn {
  display: flex;
  height: 22px;
  width: 22px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}

.date-nav-btn:hover {
  background: var(--primary-hover-10, var(--bg-tertiary));
  color: var(--primary);
}

.date-title-btn {
  padding: 2px 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.date-title-btn:hover {
  background: var(--primary-hover-10, var(--bg-tertiary));
  color: var(--primary);
}

.date-title-static {
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

.date-cell {
  display: flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all 0.12s ease;
}

.date-cell:hover:not(.is-disabled) {
  background: var(--primary-hover-10, var(--bg-tertiary));
  color: var(--primary);
}

.date-cell.is-outside {
  color: var(--text-disabled);
  opacity: 0.55;
}

.date-cell.is-today {
  color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary-30);
}

.date-cell.is-selected {
  background: var(--primary-hover-20, var(--primary-hover-10));
  color: var(--primary);
  font-weight: 900;
  box-shadow: inset 0 0 0 1px var(--primary-50);
}

.date-cell.is-selected:hover {
  background: var(--primary-hover-30, var(--primary-hover-20));
  color: var(--primary);
}

.date-cell.is-disabled {
  cursor: not-allowed;
  color: var(--text-disabled);
  opacity: 0.25;
}

.date-panel-cell {
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all 0.12s ease;
}

.date-panel-cell:hover {
  background: var(--primary-hover-10, var(--bg-tertiary));
  color: var(--primary);
}

.date-panel-cell.is-active {
  background: var(--primary-hover-20, var(--primary-hover-10));
  color: var(--primary);
  font-weight: 900;
  box-shadow: inset 0 0 0 1px var(--primary-50);
}

.date-foot-btn {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}

.date-foot-btn:hover:not(:disabled) {
  color: var(--primary);
}
</style>
