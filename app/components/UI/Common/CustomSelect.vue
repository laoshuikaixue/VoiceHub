<template>
  <div ref="containerRef" class="relative" :class="className">
    <div
      class="flex items-center gap-2 px-3 py-2 bg-zinc-950 border rounded-lg transition-all select-none"
      :class="[
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        isOpen
          ? 'border-blue-500/50 bg-blue-600/5 shadow-lg'
          : 'border-zinc-800 hover:border-zinc-700'
      ]"
      @click="toggleDropdown"
    >
      <div class="flex flex-col flex-1 min-w-0">
        <span
          v-if="label"
          class="text-[8px] font-black uppercase tracking-widest leading-none mb-0.5 transition-colors"
          :class="isOpen ? 'text-blue-400' : 'text-zinc-600'"
        >
          {{ label }}
        </span>
        <span class="text-[11px] font-bold text-zinc-300 truncate">{{ displayLabel }}</span>
      </div>
      <div class="transition-transform duration-200" :class="{ 'rotate-180': isOpen }">
        <ChevronDown :size="12" :class="isOpen ? 'text-blue-400' : 'text-zinc-700'" />
      </div>
    </div>

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
          ref="dropdownRef"
          :style="dropdownStyle"
          class="fixed z-[9999] p-1 bg-[#0c0c0e] border border-zinc-800 rounded-lg shadow-2xl backdrop-blur-xl"
        >
          <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
            <button
              v-for="option in normalizedOptions"
              :key="option.value"
              class="w-full flex items-center justify-between px-3 py-2 rounded-md text-[11px] font-bold transition-all"
              :class="[
                isSelected(option)
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40'
              ]"
              @click="selectOption(option)"
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
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  label: String,
  modelValue: [String, Number, Object],
  value: [String, Number, Object],
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
    default: '请选择'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'update:value', 'change'])

const isOpen = ref(false)
const containerRef = ref(null)
const dropdownRef = ref(null)
const dropdownStyle = ref({})

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

// 获取当前显示标签
const displayLabel = computed(() => {
  const selected = normalizedOptions.value.find((opt) => opt.value === currentValue.value)
  return selected
    ? selected.label
    : currentValue.value && typeof currentValue.value !== 'object'
      ? currentValue.value
      : props.placeholder
})

const isSelected = (option) => {
  return option.value === currentValue.value
}

const updatePosition = () => {
  if (!isOpen.value || !containerRef.value || !dropdownRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight || 200 // 预估高度
  
  const windowHeight = window.innerHeight
  const spaceBelow = windowHeight - rect.bottom
  const spaceAbove = rect.top

  let top = rect.bottom + 4
  let transformOrigin = 'origin-top'

  // 如果底部空间不足，并且顶部空间更充足或者能完全放下弹层，则向上展开
  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    top = rect.top - dropdownHeight - 4
    transformOrigin = 'origin-bottom'
  }

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: '120px',
    transformOrigin
  }
}

const toggleDropdown = async () => {
  if (props.disabled) return
  if (isOpen.value) {
    isOpen.value = false
  } else {
    isOpen.value = true
    // 等待下拉框渲染以便获取其实际高度
    await nextTick()
    // 此时元素已存在于 DOM 中，但可能尚未完全重绘，因此先触发一次计算
    // 并通过 requestAnimationFrame 再次触发，确保计算出正确的高度
    updatePosition()
    requestAnimationFrame(updatePosition)
  }
}

const selectOption = (option) => {
  emit('update:modelValue', option.value)
  emit('update:value', option.value)
  emit('change', option.value)
  isOpen.value = false
}

const handleClickOutside = (event) => {
  // 检查点击是否在容器内部或者下拉框内部
  const isClickInContainer = containerRef.value && containerRef.value.contains(event.target)
  const isClickInDropdown = dropdownRef.value && dropdownRef.value.contains(event.target)

  if (!isClickInContainer && !isClickInDropdown) {
    isOpen.value = false
  }
}

const handleScrollOrResize = () => {
  if (isOpen.value) {
    updatePosition()
  }
}

// 监听 isOpen 变化来添加/移除事件监听
watch(isOpen, (val) => {
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
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
