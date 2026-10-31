<template>
  <div ref="containerRef" class="relative" :class="className">
  <div
    :aria-activedescendant="activeDescendant"
    :aria-controls="listboxId"
    :aria-expanded="isOpen"
    :aria-haspopup="'listbox'"
    :aria-disabled="disabled ? 'true' : undefined"
    :class="[
      sizeClass,
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      isOpen
        ? 'border-primary-50 bg-primary-hover-5 shadow-lg'
        : 'border-border-secondary hover:border-border-tertiary'
    ]"
    :tabindex="disabled ? -1 : 0"
    class="flex select-none items-center gap-2 rounded-lg border bg-bg-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    role="combobox"
    @click="toggleDropdown"
    @keydown="handleKeydown"
  >
    <div class="flex flex-col flex-1 min-w-0">
      <span
        v-if="label"
        class="mb-0.5 text-xs font-semibold uppercase leading-none tracking-wider text-text-disabled transition-colors"
        :class="isOpen ? 'text-primary' : 'text-text-disabled'"
      >
        {{ label }}
      </span>
      <span class="truncate font-semibold text-text-secondary">{{ displayLabel }}</span>
    </div>
      <div class="transition-transform duration-200" :class="{ 'rotate-180': isOpen }">
        <ChevronDown :size="12" :class="isOpen ? 'text-primary' : 'text-text-secondary'" />
      </div>
    </div>

    <Teleport to="body">
      <Transition name="select-pop">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          :id="listboxId"
          :style="[dropdownStyle, { zIndex }]"
          class="fixed rounded-lg border border-border-secondary bg-bg-primary p-1 shadow-2xl backdrop-blur-xl"
          role="listbox"
        >
          <div class="custom-scrollbar max-h-[220px] overflow-y-auto">
            <button
              v-for="(option, index) in normalizedOptions"
              :id="optionId(index)"
              :key="option.value"
              :aria-selected="isSelected(option) ? 'true' : 'false'"
              :class="[
                isSelected(option)
                  ? 'bg-primary-hover-10 text-primary'
                  : 'text-text-tertiary hover:bg-bg-tertiary-40 hover:text-text-primary',
                highlightedIndex === index ? 'bg-bg-tertiary-40 text-text-primary' : ''
              ]"
              :data-index="index"
              class="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold transition-colors"
              role="option"
              type="button"
              @click="selectOption(option)"
              @mouseenter="highlightedIndex = index"
            >
              <span class="truncate">{{ option.label }}</span>
              <Icon v-if="isSelected(option)" name="check" :size="12" class="shrink-0" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, useId, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'
import { usePopupZIndex } from '~/composables/useZIndex'

const props = defineProps({
  label: String,
  modelValue: [String, Number, Object, Array],
  value: [String, Number, Object, Array],
  options: {
    type: Array,
    required: true
  },
  className: String,
  labelKey: {
    type: String,
    default: 'label'
  },
  valueKey: {
    type: String,
    default: 'value'
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  multiple: {
    type: Boolean,
    default: false
  },
  // 与 AppDatePicker 统一的高度档位：xs | sm（默认）| md | lg | xl
  size: {
    type: String,
    default: 'sm'
  }
})

const emit = defineEmits(['update:modelValue', 'update:value', 'change'])

const isOpen = ref(false)
const highlightedIndex = ref(-1)
const listboxId = `custom-select-list-${useId()}`
const containerRef = ref(null)
const dropdownRef = ref(null)
const dropdownStyle = ref({})
// 下拉层需压过所在弹窗，层级在展开时动态分配
const { zIndex, onOpenChange } = usePopupZIndex()
const { common } = useLocale()
const locale = computed(() => common.value || {})
const resolvedPlaceholder = computed(() => props.placeholder || locale.value?.selectPlaceholder || '请选择')

// 与 AppDatePicker 完全一致的尺寸档位，保证两者并排时高度/基线对齐
const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'px-2 py-1 text-xs'
    case 'md':
      return 'px-3 py-2.5 text-sm'
    case 'lg':
      return 'px-4 py-3 text-sm'
    case 'xl':
      return 'p-3 text-base'
    case 'sm':
    default:
      return 'px-3 py-2 text-xs'
  }
})

// 统一获取当前值
const currentValue = computed(() => {
  if (props.modelValue !== undefined) return props.modelValue
  return props.value
})

// 规范化选项为 { label, value } 格式
const normalizedOptions = computed(() => {
  return props.options.map((option) => {
    if (typeof option === 'object' && option !== null) {
      return {
        label: option[props.labelKey] || option.label,
        value: option[props.valueKey] !== undefined ? option[props.valueKey] : option.value,
        original: option
      }
    }
    return { label: option, value: option, original: option }
  })
})

// 选项值与 v-model 的类型可能不一致（如 id 是数字 2、v-model 是字符串 '2'），
// 只比较原始值，否则匹配失败会退化成直接显示原始 id
const isSameValue = (a, b) => {
  if (a === b) return true
  const isPrimitive = (value) => typeof value === 'string' || typeof value === 'number'
  return isPrimitive(a) && isPrimitive(b) && String(a) === String(b)
}

// 获取当前显示标签
const displayLabel = computed(() => {
  if (props.multiple) {
    const selectedValues = Array.isArray(currentValue.value) ? currentValue.value : []
    const labels = normalizedOptions.value
      .filter((option) => selectedValues.some((value) => isSameValue(option.value, value)))
      .map((option) => option.label)
    return labels.length > 0 ? labels.join('、') : props.placeholder
  }

  const selected = normalizedOptions.value.find((opt) => isSameValue(opt.value, currentValue.value))
  return selected
    ? selected.label
    : currentValue.value && typeof currentValue.value !== 'object'
      ? currentValue.value
      : resolvedPlaceholder.value
})

const isSelected = (option) => {
  if (props.multiple) {
    return (
      Array.isArray(currentValue.value) &&
      currentValue.value.some((value) => isSameValue(option.value, value))
    )
  }
  return isSameValue(option.value, currentValue.value)
}

const updatePosition = () => {
  if (!isOpen.value || !containerRef.value || !dropdownRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight || 200 // 预估高度

  const windowHeight = window.innerHeight
  const spaceBelow = windowHeight - rect.bottom
  const spaceAbove = rect.top

  let top = rect.bottom + 4
  let transformOrigin = 'top'

  // 如果底部空间不足，并且顶部空间更充足或者能完全放下弹层，则向上展开
  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    top = rect.top - dropdownHeight - 4
    transformOrigin = 'bottom'
  }

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: '120px',
    transformOrigin
  }
}

const optionId = (index) => `${listboxId}-option-${index}`

const activeDescendant = computed(() =>
  isOpen.value && highlightedIndex.value >= 0 ? optionId(highlightedIndex.value) : undefined
)

const scrollHighlightedIntoView = async () => {
  await nextTick()
  const target = dropdownRef.value?.querySelector(
    `[data-index="${highlightedIndex.value}"]`
  )
  target?.scrollIntoView({ block: 'nearest' })
}

const openDropdown = async () => {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  const selectedIndex = normalizedOptions.value.findIndex((option) => isSelected(option))
  highlightedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
  await nextTick()
  updatePosition()
  requestAnimationFrame(updatePosition)
  scrollHighlightedIntoView()
}

const closeDropdown = (restoreFocus = false) => {
  if (!isOpen.value) return
  isOpen.value = false
  highlightedIndex.value = -1
  if (restoreFocus) containerRef.value?.querySelector('[role="combobox"]')?.focus()
}

const moveHighlight = (delta) => {
  const total = normalizedOptions.value.length
  if (total === 0) return
  highlightedIndex.value = (highlightedIndex.value + delta + total) % total
  scrollHighlightedIntoView()
}

const handleKeydown = (event) => {
  if (props.disabled) return
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) openDropdown()
      else moveHighlight(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) openDropdown()
      else moveHighlight(-1)
      break
    case 'Home':
      if (!isOpen.value) return
      event.preventDefault()
      highlightedIndex.value = 0
      scrollHighlightedIntoView()
      break
    case 'End':
      if (!isOpen.value) return
      event.preventDefault()
      highlightedIndex.value = normalizedOptions.value.length - 1
      scrollHighlightedIntoView()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!isOpen.value) openDropdown()
      else {
        const option = normalizedOptions.value[highlightedIndex.value]
        if (option) selectOption(option)
      }
      break
    case 'Escape':
      if (!isOpen.value) return
      event.preventDefault()
      closeDropdown(true)
      break
    case 'Tab':
      closeDropdown()
      break
  }
}

const toggleDropdown = async () => {
  if (props.disabled) return
  if (isOpen.value) {
    closeDropdown()
  } else {
    await openDropdown()
  }
}

const selectOption = (option) => {
  if (props.multiple) {
    const selectedValues = Array.isArray(currentValue.value) ? [...currentValue.value] : []
    // 与显示/选中态一致使用宽松比较，避免类型不一致时「显示为已选却点不掉」并 push 进混合类型数组
    const existingIndex = selectedValues.findIndex((value) => isSameValue(option.value, value))
    if (existingIndex >= 0) {
      selectedValues.splice(existingIndex, 1)
    } else {
      selectedValues.push(option.value)
    }
    emit('update:modelValue', selectedValues)
    emit('update:value', selectedValues)
    emit('change', selectedValues)
    return
  }

  emit('update:modelValue', option.value)
  emit('update:value', option.value)
  emit('change', option.value)
  closeDropdown(true)
}

const handleClickOutside = (event) => {
  // 检查点击是否在容器内部或者下拉框内部
  const isClickInContainer = containerRef.value && containerRef.value.contains(event.target)
  const isClickInDropdown = dropdownRef.value && dropdownRef.value.contains(event.target)

  if (!isClickInContainer && !isClickInDropdown) {
    closeDropdown()
  }
}

const handleScrollOrResize = () => {
  if (isOpen.value) {
    updatePosition()
  }
}

// 监听 isOpen 变化来添加/移除事件监听
watch(isOpen, (val) => {
  onOpenChange(val)
  if (val) {
    window.addEventListener('scroll', handleScrollOrResize, true) // capture=true 以捕获子元素的滚动
    window.addEventListener('resize', handleScrollOrResize)
  } else {
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
  }
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
})
</script>

<style scoped>
.select-pop-enter-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.select-pop-leave-active {
  transition:
    opacity var(--duration-press) var(--ease-out),
    transform var(--duration-press) var(--ease-out);
}

.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}
</style>
