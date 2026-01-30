<template>
  <div class="search-filter">
    <!-- 搜索输入框 -->
    <div class="search-section">
      <div class="search-input-wrapper">
        <svg class="search-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
            :placeholder="searchPlaceholder"
            :value="searchQuery"
            class="search-input"
            type="text"
            @input="$emit('update:searchQuery', $event.target.value)"
        />
        <button
            v-if="searchQuery"
            class="clear-search-btn"
            @click="$emit('update:searchQuery', '')"
        >
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" x2="6" y1="6" y2="18"/>
            <line x1="6" x2="18" y1="6" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 过滤器 -->
    <div v-if="filters.length > 0" class="filters-section">
      <div
          v-for="filter in filters"
          :key="filter.key"
          class="filter-group"
      >
        <label v-if="filter.label" class="filter-label">{{ filter.label }}</label>

        <!-- 选择框过滤器 -->
        <select
            v-if="filter.type === 'select'"
            :value="filterValues[filter.key]"
            class="filter-select"
            @change="updateFilter(filter.key, $event.target.value)"
        >
          <option
              v-for="option in filter.options"
              :key="option.value"
              :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <!-- 日期范围过滤器 -->
        <div v-else-if="filter.type === 'dateRange'" class="date-range-filter">
          <input
              :placeholder="filter.startPlaceholder || '开始日期'"
              :value="filterValues[filter.key]?.start || ''"
              class="date-input"
              type="date"
              @input="updateDateRange(filter.key, 'start', $event.target.value)"
          />
          <span class="date-separator">至</span>
          <input
              :placeholder="filter.endPlaceholder || '结束日期'"
              :value="filterValues[filter.key]?.end || ''"
              class="date-input"
              type="date"
              @input="updateDateRange(filter.key, 'end', $event.target.value)"
          />
        </div>

        <!-- 多选过滤器 -->
        <div v-else-if="filter.type === 'multiSelect'" class="multi-select-filter">
          <div :class="{ open: openDropdown === filter.key }" class="multi-select-dropdown">
            <button
                class="multi-select-trigger"
                @click="toggleDropdown(filter.key)"
            >
              <span>
                {{ getMultiSelectLabel(filter) }}
              </span>
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>

            <div v-if="openDropdown === filter.key" class="multi-select-options">
              <label
                  v-for="option in filter.options"
                  :key="option.value"
                  class="multi-select-option"
              >
                <input
                    :checked="(filterValues[filter.key] || []).includes(option.value)"
                    class="checkbox"
                    type="checkbox"
                    @change="toggleMultiSelectOption(filter.key, option.value)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="showActions" class="actions-section">
      <button
          :disabled="!hasActiveFilters"
          class="btn-base btn-secondary btn-sm"
          @click="clearAllFilters"
      >
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        清除筛选
      </button>

      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup>
import {computed, onMounted, onUnmounted, ref} from 'vue'

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  searchPlaceholder: {
    type: String,
    default: '搜索...'
  },
  filters: {
    type: Array,
    default: () => []
  },
  filterValues: {
    type: Object,
    default: () => ({})
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:filterValues',
  'filter-change'
])

const openDropdown = ref(null)

const hasActiveFilters = computed(() => {
  return props.searchQuery ||
      Object.values(props.filterValues).some(value => {
        if (Array.isArray(value)) return value.length > 0
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(v => v)
        }
        return value !== '' && value !== null && value !== undefined
      })
})

const updateFilter = (key, value) => {
  const newValues = {...props.filterValues, [key]: value}
  emit('update:filterValues', newValues)
  emit('filter-change', {key, value, allValues: newValues})
}

const updateDateRange = (key, type, value) => {
  const currentRange = props.filterValues[key] || {}
  const newRange = {...currentRange, [type]: value}
  updateFilter(key, newRange)
}

const toggleMultiSelectOption = (filterKey, optionValue) => {
  const currentValues = props.filterValues[filterKey] || []
  const newValues = currentValues.includes(optionValue)
      ? currentValues.filter(v => v !== optionValue)
      : [...currentValues, optionValue]

  updateFilter(filterKey, newValues)
}

const getMultiSelectLabel = (filter) => {
  const selectedValues = props.filterValues[filter.key] || []
  if (selectedValues.length === 0) {
    return filter.placeholder || '请选择'
  }
  if (selectedValues.length === 1) {
    const option = filter.options.find(opt => opt.value === selectedValues[0])
    return option ? option.label : selectedValues[0]
  }
  return `已选择 ${selectedValues.length} 项`
}

const toggleDropdown = (key) => {
  openDropdown.value = openDropdown.value === key ? null : key
}

const closeDropdown = () => {
  openDropdown.value = null
}

const clearAllFilters = () => {
  emit('update:searchQuery', '')
  emit('update:filterValues', {})
  emit('filter-change', {key: null, value: null, allValues: {}})
}

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  if (!event.target.closest('.multi-select-dropdown')) {
    closeDropdown()
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
