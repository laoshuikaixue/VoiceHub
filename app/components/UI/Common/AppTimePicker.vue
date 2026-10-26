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
      <Clock
        class="shrink-0 transition-colors"
        :size="iconSize"
        :class="isOpen ? 'text-primary' : 'text-text-disabled'"
      />
    </button>

    <!-- 时间浮层：Teleport 到 body，动态层级压过任何弹窗 -->
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
          class="fixed w-[200px] rounded-xl border border-border-secondary bg-bg-primary p-2 shadow-2xl backdrop-blur-xl"
          role="dialog"
          tabindex="-1"
          :aria-label="text.placeholder"
          @keydown.esc.stop="close"
        >
          <!-- 时 / 分 双列滚动选择 -->
          <div class="flex gap-2">
            <!-- 时 -->
            <div class="flex min-w-0 flex-1 flex-col items-center">
              <span class="mb-1 text-[8px] font-black uppercase tracking-widest text-text-disabled">{{
                text.hour
              }}</span>
              <div
                ref="hourColRef"
                class="time-col"
              >
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

            <!-- 分 -->
            <div class="flex min-w-0 flex-1 flex-col items-center">
              <span class="mb-1 text-[8px] font-black uppercase tracking-widest text-text-disabled">{{
                text.minute
              }}</span>
              <div
                ref="minuteColRef"
                class="time-col"
              >
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
            <button type="button" class="date-foot-btn" @click="goNow">
              {{ text.now }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Clock } from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { usePopupZIndex } from '~/composables/useZIndex'
import { getSyncedDate } from '~/composables/useSyncedTime'
import { formatDateTime } from '~/utils/timeUtils'

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
  placeholder: '选择时间',
  now: '现在',
  clear: '清除',
  hour: '时',
  minute: '分'
}

const { common } = useLocale()
const text = computed(() => ({ ...FALLBACK_TEXT, ...(common.value?.timePicker || {}) }))

const isOpen = ref(false)
const containerRef = ref(null)
const triggerRef = ref(null)
const popupRef = ref(null)
const popupStyle = ref({})
const hourColRef = ref(null)
const minuteColRef = ref(null)

const { zIndex, onOpenChange } = usePopupZIndex()

const pad2 = (value) => (value < 10 ? `0${value}` : `${value}`)

const parseValue = (value) => {
  const matched = /^(\d{1,2}):(\d{1,2})$/.exec(String(value ?? '').trim())
  if (!matched) return { hour: null, minute: null }
  const hour = Number(matched[1])
  const minute = Number(matched[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { hour: null, minute: null }
  return { hour, minute }
}

const selected = computed(() => parseValue(props.modelValue))

const hours = computed(() => Array.from({ length: 24 }, (_, i) => i))
const minutes = computed(() => {
  const step = props.minuteStep > 1 ? props.minuteStep : 1
  const out = []
  for (let m = 0; m < 60; m += step) out.push(m)
  return out
})

const hour = computed(() => selected.value.hour)
const minute = computed(() => selected.value.minute)

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
  const { hour: h, minute: m } = selected.value
  if (h === null || m === null) return placeholderText.value
  return `${pad2(h)}:${pad2(m)}`
})

const buildTimeString = (h, m) => `${pad2(h)}:${pad2(m)}`

const scrollColumnToValue = (colRef, value, list) => {
  const col = colRef.value
  if (!col) return
  const index = list.indexOf(value)
  if (index < 0) return
  const target = col.children[index + 1] // +1 跳过顶部 spacer
  if (target) target.scrollIntoView({ block: 'center' })
}

const updatePosition = () => {
  const trigger = triggerRef.value
  if (!trigger || !popupRef.value) return
  const rect = trigger.getBoundingClientRect()
  const popupWidth = popupRef.value.offsetWidth || 200
  const popupHeight = popupRef.value.offsetHeight || 260
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
  const { hour: h, minute: m } = selected.value
  if (h !== null) {
    nextTick(() => scrollColumnToValue(hourColRef, h, hours.value))
  }
  if (m !== null) {
    nextTick(() => scrollColumnToValue(minuteColRef, m, minutes.value))
  }
}

const toggle = async () => {
  if (props.disabled) return
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  isOpen.value = true
  await nextTick()
  popupRef.value?.focus({ preventScroll: true })
  updatePosition()
  requestAnimationFrame(updatePosition)
  syncViewToValue()
}

const close = () => {
  isOpen.value = false
}

const emitValue = (value) => {
  emit('update:modelValue', value)
  emit('change', value)
}

const selectHour = (h) => {
  const m = minute.value ?? 0
  emitValue(buildTimeString(h, m))
  scrollColumnToValue(hourColRef, h, hours.value)
}

const selectMinute = (m) => {
  const h = hour.value ?? 0
  emitValue(buildTimeString(h, m))
  scrollColumnToValue(minuteColRef, m, minutes.value)
}

const clear = () => {
  emitValue('')
  isOpen.value = false
}

const goNow = () => {
  const [h, currentMinute] = formatDateTime(getSyncedDate(), 'HH:mm').split(':').map(Number)
  const step = props.minuteStep > 1 ? props.minuteStep : 1
  let m = currentMinute
  // 对齐到步进
  m = Math.floor(m / step) * step
  emitValue(buildTimeString(h, m))
  syncViewToValue()
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
.time-col {
  position: relative;
  height: 168px;
  width: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
  border-radius: 8px;
  background: var(--bg-secondary-20, var(--bg-tertiary));
  scroll-padding: 84px 0;
}

.time-col::-webkit-scrollbar {
  display: none;
}

/* 顶部/底部留白，使首/末项也能滚动居中 */
.time-col-spacer {
  height: 84px;
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
