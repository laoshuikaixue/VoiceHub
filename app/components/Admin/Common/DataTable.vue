<template>
  <div class="data-table">
    <!-- 表格工具栏 -->
    <div v-if="showToolbar" class="table-toolbar">
      <div class="toolbar-left">
        <slot name="toolbar-left">
          <div v-if="selectedRows.length > 0" class="selection-info">
            已选择 {{ selectedRows.length }} 项
          </div>
        </slot>
      </div>
      <div class="toolbar-right">
        <slot name="toolbar-right">
          <button
              v-if="refreshable"
              :disabled="loading"
              class="btn-base btn-secondary btn-sm"
              @click="$emit('refresh')"
          >
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="23,4 23,10 17,10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            刷新
          </button>
        </slot>
      </div>
    </div>

    <!-- 表格容器 -->
    <div class="table-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
        <div class="loading-text">{{ loadingText }}</div>
      </div>

      <!-- 桌面端表格 -->
      <div class="desktop-table">
        <!-- 表格头部 -->
        <div class="table-header">
          <div
              v-if="selectable"
              class="header-cell checkbox-cell"
          >
            <input
                :checked="isAllSelected"
                class="checkbox"
                type="checkbox"
                @change="toggleSelectAll"
            />
          </div>
          <div
              v-for="column in columns"
              :key="column.key"
              :class="column.class"
              :style="{ width: column.width }"
              class="header-cell"
          >
            {{ column.title }}
          </div>
          <div
              v-if="hasActions"
              class="header-cell actions-cell"
          >
            操作
          </div>
        </div>
      </div>

      <!-- 桌面端表格内容 -->
      <div class="desktop-table">
        <div class="table-body">
          <!-- 空状态 -->
          <div v-if="!loading && data.length === 0" class="empty-state">
            <slot name="empty">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12h8"/>
              </svg>
              <div class="empty-text">暂无数据</div>
            </slot>
          </div>

          <!-- 数据行 -->
          <div
              v-for="(row, index) in data"
              :key="getRowKey(row, index)"
              :class="['table-row', {
              selected: selectedRows.includes(getRowKey(row, index)),
              clickable: rowClickable
            }]"
              @click="handleRowClick(row, index)"
          >
            <div
                v-if="selectable"
                class="cell checkbox-cell"
                @click.stop
            >
              <input
                  :checked="selectedRows.includes(getRowKey(row, index))"
                  class="checkbox"
                  type="checkbox"
                  @change="toggleSelectRow(getRowKey(row, index))"
              />
            </div>

            <div
                v-for="column in columns"
                :key="column.key"
                :class="column.class"
                :style="{ width: column.width }"
                class="cell"
            >
              <slot
                  :index="index"
                  :name="`cell-${column.key}`"
                  :row="row"
                  :value="getNestedValue(row, column.key)"
              >
                {{ formatCellValue(getNestedValue(row, column.key), column) }}
              </slot>
            </div>

            <div
                v-if="hasActions"
                class="cell actions-cell"
                @click.stop
            >
              <slot
                  :index="index"
                  :row="row"
                  name="actions"
              >
                <div class="action-buttons">
                  <button class="action-btn edit-btn" title="编辑">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="action-btn delete-btn" title="删除">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    </svg>
                  </button>
                </div>
              </slot>
            </div>
          </div>
        </div>
      </div>

      <!-- 移动端卡片布局 -->
      <div class="mobile-cards">
        <!-- 空状态 -->
        <div v-if="!loading && data.length === 0" class="empty-state">
          <slot name="empty">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12h8"/>
            </svg>
            <div class="empty-text">暂无数据</div>
          </slot>
        </div>

        <!-- 数据卡片 -->
        <div
            v-for="(row, index) in data"
            :key="getRowKey(row, index)"
            :class="['data-card', {
            selected: selectedRows.includes(getRowKey(row, index)),
            clickable: rowClickable
          }]"
            @click="handleRowClick(row, index)"
        >
          <div class="card-header">
            <div v-if="selectable" class="card-selection" @click.stop>
              <input
                  :checked="selectedRows.includes(getRowKey(row, index))"
                  class="checkbox"
                  type="checkbox"
                  @change="toggleSelectRow(getRowKey(row, index))"
              />
            </div>
            <div class="card-primary">
              <slot
                  :index="index"
                  :row="row"
                  name="mobile-primary"
              >
                <!-- 默认显示第一列 -->
                <div class="primary-value">
                  {{ formatCellValue(getNestedValue(row, columns[0]?.key), columns[0]) }}
                </div>
              </slot>
            </div>
            <div v-if="hasActions" class="card-actions" @click.stop>
              <slot
                  :index="index"
                  :row="row"
                  name="actions"
              ></slot>
            </div>
          </div>
          <div class="card-body">
            <slot
                :columns="columns"
                :index="index"
                :row="row"
                name="mobile-content"
            >
              <!-- 默认显示所有列（除第一列外） -->
              <div
                  v-for="column in columns.slice(1)"
                  :key="column.key"
                  class="card-field"
              >
                <span class="field-label">{{ column.title }}:</span>
                <span class="field-value">
                  <slot
                      :index="index"
                      :name="`cell-${column.key}`"
                      :row="row"
                      :value="getNestedValue(row, column.key)"
                  >
                    {{ formatCellValue(getNestedValue(row, column.key), column) }}
                  </slot>
                </span>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination && totalPages > 1" class="pagination">
      <button
          :disabled="currentPage === 1"
          class="pagination-btn"
          @click="$emit('page-change', 1)"
      >
        首页
      </button>
      <button
          :disabled="currentPage === 1"
          class="pagination-btn"
          @click="$emit('page-change', currentPage - 1)"
      >
        上一页
      </button>

      <div class="pagination-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页
      </div>

      <button
          :disabled="currentPage === totalPages"
          class="pagination-btn"
          @click="$emit('page-change', currentPage + 1)"
      >
        下一页
      </button>
      <button
          :disabled="currentPage === totalPages"
          class="pagination-btn"
          @click="$emit('page-change', totalPages)"
      >
        末页
      </button>
    </div>
  </div>
</template>

<script setup>
import {computed, ref, watch} from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: '正在加载...'
  },
  selectable: {
    type: Boolean,
    default: false
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  rowClickable: {
    type: Boolean,
    default: false
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  refreshable: {
    type: Boolean,
    default: true
  },
  pagination: {
    type: Boolean,
    default: false
  },
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits([
  'refresh',
  'row-click',
  'selection-change',
  'page-change'
])

const selectedRows = ref([])

const hasActions = computed(() => {
  return !!props.columns.find(col => col.key === 'actions') ||
      !!Object.keys($slots).find(key => key === 'actions')
})

const isAllSelected = computed(() => {
  return props.data.length > 0 &&
      props.data.every(row => selectedRows.value.includes(getRowKey(row)))
})

const getRowKey = (row, index) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row, index)
  }
  return row[props.rowKey] || index
}

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

const formatCellValue = (value, column) => {
  if (column.formatter && typeof column.formatter === 'function') {
    return column.formatter(value)
  }

  if (value === null || value === undefined) {
    return '-'
  }

  return value
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedRows.value = []
  } else {
    selectedRows.value = props.data.map((row, index) => getRowKey(row, index))
  }
  emit('selection-change', selectedRows.value)
}

const toggleSelectRow = (rowKey) => {
  const index = selectedRows.value.indexOf(rowKey)
  if (index > -1) {
    selectedRows.value.splice(index, 1)
  } else {
    selectedRows.value.push(rowKey)
  }
  emit('selection-change', selectedRows.value)
}

const handleRowClick = (row, index) => {
  if (props.rowClickable) {
    emit('row-click', row, index)
  }
}

// 监听数据变化，清理无效的选择
watch(() => props.data, (newData) => {
  const validKeys = newData.map((row, index) => getRowKey(row, index))
  selectedRows.value = selectedRows.value.filter(key => validKeys.includes(key))
}, {deep: true})
</script>

<style scoped>
.data-table {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* 工具栏 */
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.selection-info {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

/* 表格容器 */
.table-container {
  position: relative;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
  z-index: 10;
}

.loading-text {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

/* 表格头部 */
.table-header {
  display: flex;
  background: var(--table-header-bg);
  border-bottom: 1px solid var(--table-border);
  padding: var(--spacing-lg) var(--spacing-xl);
}

.header-cell {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  flex: 1;
}

.checkbox-cell {
  width: 50px;
  flex: none;
  justify-content: center;
}

.actions-cell {
  width: 120px;
  flex: none;
  justify-content: center;
}

/* 表格主体 */
.table-body {
  min-height: 200px;
}

.table-row {
  display: flex;
  border-bottom: 1px solid var(--table-border);
  padding: var(--spacing-lg) var(--spacing-xl);
  transition: background-color var(--transition-normal);
}

.table-row:hover {
  background-color: var(--table-row-hover);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row.selected {
  background-color: var(--table-selected);
}

.table-row.clickable {
  cursor: pointer;
}

.cell {
  display: flex;
  align-items: center;
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-normal);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.edit-btn {
  background: var(--primary);
  color: var(--text-primary);
}

.edit-btn:hover {
  background: var(--primary-hover);
}

.delete-btn {
  background: var(--error);
  color: var(--text-primary);
}

.delete-btn:hover {
  background: var(--error-hover);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  color: var(--text-tertiary);
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: var(--spacing-lg);
  color: var(--text-disabled);
}

.empty-text {
  font-size: var(--text-base);
  color: var(--text-tertiary);
}

/* 移动端卡片布局 */
.mobile-cards {
  display: none;
}

.data-card {
  background: var(--table-row-bg);
  border: 1px solid var(--table-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-md);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.data-card:hover {
  border-color: var(--border-secondary);
  transform: translateY(-1px);
}

.data-card:active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

.data-card.selected {
  background-color: var(--table-selected);
  border-color: var(--primary);
}

.data-card.clickable {
  cursor: pointer;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--table-border);
  background: var(--bg-tertiary);
}

.card-selection {
  margin-right: var(--spacing-sm);
}

.card-primary {
  flex: 1;
}

.primary-value {
  font-weight: 600;
  font-size: var(--text-base);
  color: var(--text-primary);
}

.card-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.card-body {
  padding: var(--spacing-md);
}

.card-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-tertiary);
}

.card-field:last-child {
  border-bottom: none;
}

.field-label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-weight: 500;
}

.field-value {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-md);
  }

  .toolbar-left,
  .toolbar-right {
    justify-content: center;
  }

  /* 隐藏桌面表格，显示移动端卡片 */
  .desktop-table {
    display: none;
  }

  .mobile-cards {
    display: block;
  }

  .action-buttons {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .action-btn {
    width: 36px;
    height: 36px;
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }
}

/* 小屏幕设备进一步优化 */
@media (max-width: 480px) {
  .data-card {
    margin-bottom: var(--spacing-sm);
  }

  .card-header {
    padding: var(--spacing-sm);
  }

  .card-body {
    padding: var(--spacing-sm);
  }

  .primary-value {
    font-size: var(--text-sm);
  }

  .field-label,
  .field-value {
    font-size: var(--text-xs);
  }

  .action-btn {
    width: 32px;
    height: 32px;
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }
}
</style>
