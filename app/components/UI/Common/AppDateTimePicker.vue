<template>
  <div ref="containerRef" class="relative" :class="className">
    <!-- 触发器：与 AppDatePicker / CustomSelect 完全一致的结构，保证并排对齐 -->
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

    <!-- 日历 + 时间浮层：Teleport 到 body，动态层级压过任何弹窗 -->
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

            <!-- 时间选择：时 / 分 双列滚动 -->
            <div class="mt-1.5 border-t border-border-secondary pt-1.5">
              <div class="flex gap-2">
                <div class="flex min-w-0 flex-1 flex-col items-center">
                  <span class="mb-1 text-[8px] font-black uppercase tracking-widest text-text-disabled">{{
                    timeText.hour
                  }}</span>
                  <div ref="hourColRef" class="time-col">
                    <div class="time-col-spacer" />
                    <button
                      v-for="h in hours"
                      :key="`h-${h}`"
                      type="button"
                      class="time-cell"
                      :class="h === hour ? 'is-selected' : ''"
                      @click="selectHour(h)"
                    >
                      {{ pad2(h) }}
                    </button>
                    <div class="time-col-spacer" />
                  </div>
                </div>
                <div class="flex min-w-0 flex-1 flex-col items-center">
                  <span class="mb-1 text-[8px] font-black uppercase tracking-widest text-text-disabled">{{
                    timeText.minute
                  }}</span>
                  <div ref="minuteColRef" class="time-col">
                    <div class="time-col-spacer" />
                    <button
                      v-for="m in minutes"
                      :key="`m-${m}`"
                      type="button"
                      class="time-cell"
                      :class="m === minute ? 'is-selected' : ''"
                      @click="selectMinute(m)"
                    >
                      {{ pad2(m) }}
                    </button>
                    <div class="time-col-spacer" />
                  </div>
                </div>
              </div>
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
import { formatDateTime, getBeijingDateString } from '~/utils/timeUtils'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
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
  min: {
    type: String,
    default: ''
  },
  max: {
    type: String,
    default: ''
  },
  today: {
    type: String,
    default: ''
  },
  // 分钟步进，默认 1；可设为 5 / 15 / 30
  minuteStep: {
    type: Number,
    default: 1
  },
  className: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'sm'
  },
  rounded: {
    type: String,
    default: 'lg'
  },
  variant: {
    type: String,
    default: 'boxed'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const FALLBACK_TEXT = {
  placeholder: '选择日期时间',
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

const FALLBACK_TIME = {
  hour: '时',
  minute: '分'
}

const { common } = useLocale()
const text = computed(() => ({ ...FALLBACK_TEXT, ...(common.value?.datePicker || {}) }))
const timeText = computed(() => ({ ...FALLBACK_TIME, ...(common.value?.timePicker || {}) }))

const isOpen = ref(false)
const containerRef = ref(null)
const triggerRef = ref(null)
const popupRef = ref(null)
const popupStyle = ref({})
const hourColRef = ref(null)
const minuteColRef = ref(null)
const viewYear = ref(2000)
const viewMonth = ref(0)
const viewMode = ref('days')
const yearsPageStart = ref(2000)

const { zIndex, onOpenChange } = usePopupZIndex()

const pad2 = (value) => (value < 10 ? `0${value}` : `${value}`)
const toISODate = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

const parseCombined = (value) => {
  const matched = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(:\d{2}(?:\.\d{1,6})?)?$/.exec(String(value ?? '').trim())
  if (!matched) return null
  const year = Number(matched[1])
  const month = Number(matched[2]) - 1
  const day = Number(matched[3])
  const hour = Number(matched[4])
  const minute = Number(matched[5])
  if (!year || month < 0 || month > 11 || day < 1 || day > 31) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  const seconds = matched[6] || ''
  if (seconds && Number(seconds.slice(1)) >= 60) return null
  return { year, month, day, hour, minute, seconds }
}

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

const selected = computed(() => parseCombined(props.modelValue))
const selectedDate = computed(() => {
  const s = selected.value
  return s ? { year: s.year, month: s.month, day: s.day } : null
})
const selectedTime = computed(() => {
  const s = selected.value
  return s ? { hour: s.hour, minute: s.minute, seconds: s.seconds } : null
})
const todayDisabled = computed(() => isOutOfRange(todayISO.value))

const hours = computed(() => Array.from({ length: 24 }, (_, i) => i))
const minutes = computed(() => {
  const step = props.minuteStep > 1 ? props.minuteStep : 1
  const out = []
  for (let m = 0; m < 60; m += step) out.push(m)
  return out
})

const hour = computed(() => (selectedTime.value ? selectedTime.value.hour : null))
const minute = computed(() => (selectedTime.value ? selectedTime.value.minute : null))

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
  const s = selected.value
  if (!s) return placeholderText.value
  return `${s.year}/${pad2(s.month + 1)}/${pad2(s.day)} ${pad2(s.hour)}:${pad2(s.minute)}`
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
    isSelected: iso === (selectedDate.value ? toISODate(selectedDate.value.year, selectedDate.value.month, selectedDate.value.day) : ''),
    disabled: isOutOfRange(iso)
  }
}

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

const scrollColumnToValue = (colRef, value, list) => {
  const col = colRef.value
  if (!col) return
  const index = list.indexOf(value)
  if (index < 0) return
  const target = col.children[index + 1]
  if (target) target.scrollIntoView({ block: 'center' })
}

const updatePosition = () => {
  const trigger = triggerRef.value
  if (!trigger || !popupRef.value) return
  const rect = trigger.getBoundingClientRect()
  const popupWidth = popupRef.value.offsetWidth || 268
  const popupHeight = popupRef.value.offsetHeight || 420
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

  // 同步时间列滚动位置
  if (hour.value !== null) nextTick(() => scrollColumnToValue(hourColRef, hour.value, hours.value))
  if (minute.value !== null) nextTick(() => scrollColumnToValue(minuteColRef, minute.value, minutes.value))
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

const buildTimeString = (h, m) => `${pad2(h)}:${pad2(m)}${selectedTime.value?.seconds || ''}`

const currentDateISO = () => {
  const d = selectedDate.value
  if (d) return toISODate(d.year, d.month, d.day)
  return todayISO.value
}

const selectDay = (cell) => {
  if (cell.disabled || !cell.iso) return
  const timeStr = selectedTime.value
    ? buildTimeString(selectedTime.value.hour, selectedTime.value.minute)
    : formatDateTime(getSyncedDate(), 'HH:mm')
  emitValue(`${cell.iso}T${timeStr}`)
  if (cell.outside) {
    const parsed = parseISODate(cell.iso)
    if (parsed) {
      viewYear.value = parsed.year
      viewMonth.value = parsed.month
    }
  }
  isOpen.value = false
}

const selectHour = (h) => {
  const m = minute.value ?? 0
  emitValue(`${currentDateISO()}T${buildTimeString(h, m)}`)
  scrollColumnToValue(hourColRef, h, hours.value)
}

const selectMinute = (m) => {
  const h = hour.value ?? 0
  emitValue(`${currentDateISO()}T${buildTimeString(h, m)}`)
  scrollColumnToValue(minuteColRef, m, minutes.value)
}

const clear = () => {
  emitValue('')
  isOpen.value = false
}

const goToday = () => {
  currentDate.value = getBeijingDateString(getSyncedDate())
  if (todayDisabled.value) return
  const [h, currentMinute] = formatDateTime(getSyncedDate(), 'HH:mm').split(':').map(Number)
  const step = props.minuteStep > 1 ? props.minuteStep : 1
  let m = currentMinute
  m = Math.floor(m / step) * step
  emitValue(`${todayISO.value}T${pad2(h)}:${pad2(m)}`)
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

/* 时间列滚动选择 */
.time-col {
  position: relative;
  height: 140px;
  width: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
  border-radius: 8px;
  background: var(--bg-secondary-20, var(--bg-tertiary));
  scroll-padding: 70px 0;
}

.time-col::-webkit-scrollbar {
  display: none;
}

.time-col-spacer {
  height: 70px;
}

.time-cell {
  display: flex;
  width: 100%;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-secondary);
  scroll-snap-align: center;
  transition: all 0.12s ease;
}

.time-cell:hover {
  background: var(--primary-hover-10, var(--bg-tertiary));
  color: var(--primary);
}

.time-cell.is-selected {
  background: var(--primary-hover-20, var(--primary-hover-10));
  color: var(--primary);
  font-weight: 900;
  box-shadow: inset 0 0 0 1px var(--primary-50);
}
</style>
