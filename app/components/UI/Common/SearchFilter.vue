<template>
  <div class="flex flex-col lg:flex-row items-center gap-4 w-full">
    <!-- 搜索输入框 -->
    <div class="relative flex-1 w-full">
      <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search :size="16" class="text-zinc-500" />
      </div>
      <input
        :value="searchQuery"
        type="text"
        :placeholder="searchPlaceholder"
        class="block w-full pl-11 pr-11 py-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs font-bold text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-blue-600/5 transition-all"
        @input="$emit('update:searchQuery', $event.target.value)"
      >
      <button
        v-if="searchQuery"
        class="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
        @click="$emit('update:searchQuery', '')"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- 过滤器容器 -->
    <div v-if="filters.length > 0" class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
      <div v-for="filter in filters" :key="filter.key" class="flex-1 lg:flex-none min-w-[140px]">
        <!-- 选择框过滤器 - 使用 CustomSelect -->
        <CustomSelect
          v-if="filter.type === 'select'"
          :label="filter.label"
          :value="getSelectValueLabel(filter)"
          :options="filter.options.map((o) => o.label)"
          class="w-full"
          @change="(val) => updateSelectFilter(filter, val)"
        />

        <!-- 日期范围过滤器 -->
        <div
          v-else-if="filter.type === 'dateRange'"
          class="flex items-center gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-2xl"
        >
          <input
            type="date"
            :value="filterValues[filter.key]?.start || ''"
            class="bg-transparent border-none text-[10px] font-bold text-zinc-300 focus:ring-0 px-2 py-1 w-28"
            @input="updateDateRange(filter.key, 'start', $event.target.value)"
          >
          <span class="text-zinc-700 text-[10px] font-black uppercase">至</span>
          <input
            type="date"
            :value="filterValues[filter.key]?.end || ''"
            class="bg-transparent border-none text-[10px] font-bold text-zinc-300 focus:ring-0 px-2 py-1 w-28"
            @input="updateDateRange(filter.key, 'end', $event.target.value)"
          >
        </div>

        <!-- 多选过滤器 -->
        <div v-else-if="filter.type === 'multiSelect'" ref="dropdownRef" class="relative">
          <button
            class="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl transition-all hover:border-zinc-700"
            :class="{ 'border-blue-500/50 bg-blue-600/5': openDropdown === filter.key }"
            @click="toggleDropdown(filter.key)"
          >
            <div class="flex flex-col items-start gap-0.5 overflow-hidden">
              <span
                v-if="filter.label"
                class="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none"
                >{{ filter.label }}</span
              >
              <span class="text-[11px] font-bold text-zinc-300 truncate w-full text-left">{{
                getMultiSelectLabel(filter)
              }}</span>
            </div>
            <ChevronDown
              :size="14"
              class="text-zinc-500 shrink-0 transition-transform"
              :class="{ 'rotate-180': openDropdown === filter.key }"
            />
          </button>

          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div
              v-if="openDropdown === filter.key"
              class="absolute z-50 mt-2 w-full min-w-[200px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden py-1"
            >
              <div class="max-h-60 overflow-y-auto custom-scrollbar">
                <label
                  v-for="option in filter.options"
                  :key="option.value"
                  class="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 cursor-pointer group transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="(filterValues[filter.key] || []).includes(option.value)"
                    class="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 transition-all"
                    @change="toggleMultiSelectOption(filter.key, option.value)"
                  >
                  <span class="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">{{
                    option.label
                  }}</span>
                </label>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="showActions" class="flex items-center gap-2 w-full lg:w-auto">
      <button
        v-if="hasActiveFilters"
        class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-red-500/30 hover:bg-red-500/5 text-zinc-400 hover:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all"
        @click="clearAllFilters"
      >
        <RotateCcw :size="14" />
        <span>清除筛选</span>
      </button>

      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Search, X, ChevronDown, RotateCcw } from 'lucide-vue-next'
import CustomSelect from './CustomSelect.vue'

const props = defineProps({
  searchQuery: { type: String, default: '' },
  searchPlaceholder: { type: String, default: '搜索...' },
  filters: { type: Array, default: () => [] },
  filterValues: { type: Object, default: () => ({}) },
  showActions: { type: Boolean, default: true }
})

const emit = defineEmits(['update:searchQuery', 'update:filterValues', 'filter-change'])

const openDropdown = ref(null)
const dropdownRef = ref(null)

const hasActiveFilters = computed(() => {
  return (
    props.searchQuery ||
    Object.values(props.filterValues).some((value) => {
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some((v) => v)
      }
      return value !== '' && value !== null && value !== undefined
    })
  )
})

const updateFilter = (key, value) => {
  const newValues = { ...props.filterValues, [key]: value }
  emit('update:filterValues', newValues)
  emit('filter-change', { key, value, allValues: newValues })
}

const updateSelectFilter = (filter, label) => {
  const option = filter.options.find((o) => o.label === label)
  if (option) {
    updateFilter(filter.key, option.value)
  }
}

const getSelectValueLabel = (filter) => {
  const value = props.filterValues[filter.key]
  const option = filter.options.find((o) => o.value === value)
  return option ? option.label : filter.placeholder || '请选择'
}

const updateDateRange = (key, type, value) => {
  const currentRange = props.filterValues[key] || {}
  const newRange = { ...currentRange, [type]: value }
  updateFilter(key, newRange)
}

const toggleMultiSelectOption = (filterKey, optionValue) => {
  const currentValues = props.filterValues[filterKey] || []
  const newValues = currentValues.includes(optionValue)
    ? currentValues.filter((v) => v !== optionValue)
    : [...currentValues, optionValue]
  updateFilter(filterKey, newValues)
}

const toggleDropdown = (key) => {
  openDropdown.value = openDropdown.value === key ? null : key
}

const getMultiSelectLabel = (filter) => {
  const selectedValues = props.filterValues[filter.key] || []
  if (selectedValues.length === 0) return filter.placeholder || '请选择'
  if (selectedValues.length === 1) {
    const option = filter.options.find((opt) => opt.value === selectedValues[0])
    return option ? option.label : selectedValues[0]
  }
  return `已选 ${selectedValues.length} 项`
}

const clearAllFilters = () => {
  emit('update:searchQuery', '')
  const clearedValues = {}
  props.filters.forEach((f) => {
    if (f.type === 'multiSelect') clearedValues[f.key] = []
    else if (f.type === 'dateRange') clearedValues[f.key] = { start: '', end: '' }
    else clearedValues[f.key] = ''
  })
  emit('update:filterValues', clearedValues)
  emit('filter-change', { key: 'all', value: null, allValues: clearedValues })
}

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    openDropdown.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.search-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
}

/* 搜索部分 */
.search-section {
  flex: 1;
  min-width: 300px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--spacing-lg);
  width: 20px;
  height: 20px;
  color: var(--text-quaternary);
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-md) 48px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  color: var(--input-text);
  font-size: var(--text-sm);
  transition: all var(--transition-normal);
}

.search-input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-shadow-focus);
}

.search-input::placeholder {
  color: var(--input-placeholder);
}

.clear-search-btn {
  position: absolute;
  right: var(--spacing-md);
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--text-quaternary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-normal);
}

.clear-search-btn:hover {
  background: var(--bg-quaternary);
  color: var(--text-primary);
}

.clear-search-btn svg {
  width: 16px;
  height: 16px;
}

/* 过滤器部分 */
.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.filter-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.filter-select,
.date-input {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  color: var(--input-text);
  font-size: var(--text-sm);
  cursor: pointer;
}

.filter-select:focus,
.date-input:focus {
  outline: none;
  border-color: var(--input-border-focus);
}

/* 日期范围过滤器 */
.date-range-filter {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.date-separator {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

/* 多选过滤器 */
.multi-select-filter {
  position: relative;
}

.multi-select-dropdown {
  position: relative;
}

.multi-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  color: var(--input-text);
  font-size: var(--text-sm);
  cursor: pointer;
  min-width: 150px;
  transition: all var(--transition-normal);
}

.multi-select-trigger:hover {
  border-color: var(--input-border-focus);
}

.multi-select-trigger svg {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-normal);
}

.multi-select-dropdown.open .multi-select-trigger svg {
  transform: rotate(180deg);
}

.multi-select-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  max-height: 200px;
  overflow-y: auto;
  margin-top: var(--spacing-xs);
}

.multi-select-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  transition: background-color var(--transition-normal);
}

.multi-select-option:hover {
  background: var(--bg-hover);
}

.multi-select-option .checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

/* 操作部分 */
.actions-section {
  display: flex;
  gap: var(--spacing-md);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-filter {
    flex-direction: column;
    align-items: stretch;
  }

  .search-section {
    min-width: auto;
  }

  .filters-section {
    flex-direction: column;
  }

  .date-range-filter {
    flex-direction: column;
    align-items: stretch;
  }

  .actions-section {
    justify-content: center;
  }
}
</style>
