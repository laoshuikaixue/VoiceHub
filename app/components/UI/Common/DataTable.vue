<template>
  <div class="space-y-4">
    <!-- 表格工具栏 -->
    <div
      v-if="showToolbar"
      class="flex flex-col sm:flex-row items-center justify-between gap-4 px-1"
    >
      <div class="flex items-center gap-3">
        <slot name="toolbar-left">
          <div
            v-if="selectedRows.length > 0"
            class="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg"
          >
            <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest"
              >已选择 {{ selectedRows.length }} 项</span
            >
            <button
              class="p-0.5 text-blue-400 hover:text-blue-300 transition-colors"
              @click="$emit('clear-selection')"
            >
              <X :size="12" />
            </button>
          </div>
        </slot>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <slot name="toolbar-right">
          <button
            v-if="refreshable"
            :disabled="loading"
            class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            @click="$emit('refresh')"
          >
            <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
            <span>刷新数据</span>
          </button>
        </slot>
      </div>
    </div>

    <!-- 表格主容器 -->
    <div
      class="relative bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl shadow-black/20"
    >
      <!-- 加载状态 -->
      <div
        v-if="loading"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-[2px] animate-in fade-in duration-300"
      >
        <div
          class="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"
        />
        <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{{
          loadingText
        }}</span>
      </div>

      <!-- 桌面端表格 -->
      <div class="hidden md:block overflow-x-auto custom-scrollbar">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-zinc-800 bg-zinc-900/50">
              <th v-if="selectable" class="p-4 w-10">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  class="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                  @change="toggleSelectAll"
                >
              </th>
              <th
                v-for="column in columns"
                :key="column.key"
                :class="[
                  column.class,
                  'p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest'
                ]"
                :style="{ width: column.width }"
              >
                {{ column.title }}
              </th>
              <th
                v-if="hasActions"
                class="p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-right"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/50">
            <tr v-if="!loading && data.length === 0">
              <td :colspan="totalColumns" class="p-20 text-center">
                <slot name="empty">
                  <div class="flex flex-col items-center gap-3 text-zinc-700">
                    <Database :size="40" stroke-width="1" />
                    <span class="text-[10px] font-black uppercase tracking-widest"
                      >暂无数据内容</span
                    >
                  </div>
                </slot>
              </td>
            </tr>
            <tr
              v-for="(row, index) in data"
              :key="getRowKey(row, index)"
              class="group hover:bg-zinc-800/30 transition-colors cursor-default"
              :class="{ 'bg-blue-600/5': selectedRows.includes(getRowKey(row, index)) }"
              @click="handleRowClick(row, index)"
            >
              <td v-if="selectable" class="p-4" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedRows.includes(getRowKey(row, index))"
                  class="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                  @change="toggleSelectRow(getRowKey(row, index))"
                >
              </td>
              <td
                v-for="column in columns"
                :key="column.key"
                :class="[column.class, 'p-4 text-xs font-bold text-zinc-300']"
              >
                <slot
                  :name="`cell-${column.key}`"
                  :row="row"
                  :index="index"
                  :value="getNestedValue(row, column.key)"
                >
                  {{ formatCellValue(getNestedValue(row, column.key), column) }}
                </slot>
              </td>
              <td v-if="hasActions" class="p-4 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <slot name="actions" :row="row" :index="index">
                    <button
                      class="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                      title="编辑"
                    >
                      <Edit2 :size="14" />
                    </button>
                    <button
                      class="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                      title="删除"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </slot>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 移动端卡片列表 -->
      <div class="md:hidden divide-y divide-zinc-800">
        <div v-if="!loading && data.length === 0" class="p-20 text-center">
          <slot name="empty">
            <div class="flex flex-col items-center gap-3 text-zinc-700">
              <Database :size="40" stroke-width="1" />
              <span class="text-[10px] font-black uppercase tracking-widest">暂无数据内容</span>
            </div>
          </slot>
        </div>
        <div
          v-for="(row, index) in data"
          :key="getRowKey(row, index)"
          class="p-4 space-y-4 hover:bg-zinc-800/30 transition-colors"
          :class="{ 'bg-blue-600/5': selectedRows.includes(getRowKey(row, index)) }"
          @click="handleRowClick(row, index)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div v-if="selectable" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedRows.includes(getRowKey(row, index))"
                  class="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                  @change="toggleSelectRow(getRowKey(row, index))"
                >
              </div>
              <slot name="mobile-primary" :row="row" :index="index">
                <span class="text-sm font-black text-zinc-100">{{
                  formatCellValue(getNestedValue(row, columns[0]?.key), columns[0])
                }}</span>
              </slot>
            </div>
            <div v-if="hasActions" class="flex items-center gap-1" @click.stop>
              <slot name="actions" :row="row" :index="index">
                <button
                  class="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                >
                  <Edit2 :size="14" />
                </button>
                <button
                  class="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                >
                  <Trash2 :size="14" />
                </button>
              </slot>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-y-3 gap-x-4">
            <div v-for="column in columns.slice(1)" :key="column.key" class="space-y-1">
              <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest block">{{
                column.title
              }}</span>
              <div class="text-xs font-bold text-zinc-400">
                <slot
                  :name="`cell-${column.key}`"
                  :row="row"
                  :index="index"
                  :value="getNestedValue(row, column.key)"
                >
                  {{ formatCellValue(getNestedValue(row, column.key), column) }}
                </slot>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  X,
  RefreshCw,
  Database,
  Edit2,
  Trash2,
  ChevronRight,
  MoreHorizontal
} from 'lucide-vue-next'

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '正在加载数据...' },
  selectable: { type: Boolean, default: false },
  selectedRows: { type: Array, default: () => [] },
  rowKey: { type: [String, Function], default: 'id' },
  refreshable: { type: Boolean, default: false },
  showToolbar: { type: Boolean, default: true },
  hasActions: { type: Boolean, default: true },
  rowClickable: { type: Boolean, default: false }
})

const emit = defineEmits(['update:selectedRows', 'row-click', 'refresh', 'clear-selection'])

const totalColumns = computed(() => {
  let count = props.columns.length
  if (props.selectable) count++
  if (props.hasActions) count++
  return count
})

const isAllSelected = computed(() => {
  if (props.data.length === 0) return false
  return props.data.every((row) => props.selectedRows.includes(getRowKey(row)))
})

const getRowKey = (row, index) => {
  if (typeof props.rowKey === 'function') return props.rowKey(row, index)
  return row[props.rowKey] || index
}

const getNestedValue = (obj, path) => {
  if (!path) return undefined
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}

const formatCellValue = (value, column) => {
  if (column.formatter) return column.formatter(value)
  if (value === null || value === undefined) return '-'
  return value
}

const toggleSelectAll = (event) => {
  const checked = event.target.checked
  const newSelectedRows = checked
    ? [...new Set([...props.selectedRows, ...props.data.map((row) => getRowKey(row))])]
    : props.selectedRows.filter((id) => !props.data.map((row) => getRowKey(row)).includes(id))
  emit('update:selectedRows', newSelectedRows)
}

const toggleSelectRow = (key) => {
  const newSelectedRows = props.selectedRows.includes(key)
    ? props.selectedRows.filter((id) => id !== key)
    : [...props.selectedRows, key]
  emit('update:selectedRows', newSelectedRows)
}

const handleRowClick = (row, index) => {
  if (props.rowClickable) {
    emit('row-click', { row, index })
  }
}
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
