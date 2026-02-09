<template>
  <Teleport to="body">
    <Transition name="modal-animation">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-content import-modal">
          <!-- 结果展示视图 -->
          <div v-if="importResult" class="result-view">
            <div class="modal-header">
              <h3>导入结果</h3>
              <button type="button" class="close-btn" @click="close">&times;</button>
            </div>
            
            <div class="modal-body">
              <div class="result-summary">
                <div class="summary-item success">
                  <span class="label">成功导入</span>
                  <span class="count">{{ importResult.success }}</span>
                </div>
                <div class="summary-item failed">
                  <span class="label">导入失败/跳过</span>
                  <span class="count">{{ importResult.failed }}</span>
                </div>
              </div>

              <div v-if="importResult.details && importResult.details.length > 0" class="result-details">
                <h4>详细信息：</h4>
                <div class="details-list">
                  <div v-for="(detail, index) in importResult.details" :key="index" class="detail-item">
                    {{ detail }}
                  </div>
                </div>
              </div>
              <div v-else class="result-empty">
                <p>全部歌曲导入成功！</p>
              </div>
            </div>

            <div class="modal-footer">
              <div class="action-buttons full-width">
                <button type="button" class="btn btn-primary" @click="close">完成</button>
              </div>
            </div>
          </div>

          <!-- 正常导入视图 -->
          <div v-else class="import-view">
            <div class="modal-header">
              <h3>从历史学期导入</h3>
              <button type="button" class="close-btn" @click="close">&times;</button>
            </div>

            <div class="modal-filters">
              <div class="filter-group">
                <label>选择学期：</label>
              <select v-model="selectedSemester" class="semester-select" :disabled="loadingSemesters">
                  <option value="" disabled>请选择学期</option>
                  <option v-for="sem in semesterList" :key="sem.id" :value="sem.name">
                    {{ sem.name }}
                  </option>
                </select>
            </div>
            
            <div class="filter-tabs">
              <button 
                type="button"
                v-for="type in ['unplayed', 'played', 'all']" 
                :key="type"
                :class="['filter-tab', { active: filterType === type }]"
                @click="filterType = type"
              >
                {{ getFilterLabel(type) }}
              </button>
            </div>
          </div>

          <div class="modal-body">
            <div v-if="loadingSemesters || loadingSongs" class="loading-state">
              <div class="loading-spinner"></div>
              <p>加载中...</p>
            </div>

            <div v-else-if="error" class="error-state">
              <p>{{ error }}</p>
              <button type="button" class="retry-btn" @click="loadSongs">重试</button>
            </div>

            <div v-else-if="!selectedSemester" class="empty-state">
              <p>请选择一个学期以查看歌曲</p>
            </div>

            <div v-else-if="filteredSongs.length === 0" class="empty-state">
              <p>没有找到符合条件的歌曲</p>
            </div>

            <div v-else class="songs-list">
              <div 
                v-for="song in filteredSongs" 
                :key="song.id" 
                class="song-item"
                :class="{ selected: isSelected(song.id) }"
                @click="toggleSelection(song.id)"
              >
                <div class="checkbox-wrapper">
                  <div class="custom-checkbox" :class="{ checked: isSelected(song.id) }">
                    <Icon v-if="isSelected(song.id)" name="check" :size="12" color="white" />
                  </div>
                </div>
                <div class="song-cover">
                  <img :src="convertToHttps(song.cover)" alt="cover" loading="lazy" />
                </div>
                <div class="song-info">
                  <h4 class="song-title">{{ song.title }}</h4>
                  <div class="song-meta">
                    <span class="song-artist">{{ song.artist }}</span>
                    <span class="song-requester">投稿人: {{ song.requester }}</span>
                  </div>
                </div>
                <div class="song-status">
                  <span v-if="song.played" class="status-badge played">已收录</span>
                  <span v-else class="status-badge unplayed">未收录</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="selection-info">
              <button type="button" class="text-btn" @click="toggleSelectAll">
                {{ isAllSelected ? '取消全选' : '全选' }}
              </button>
              <span class="selected-count">已选 {{ selectedSongIds.size }} 首</span>
            </div>
            <div class="action-buttons">
              <button type="button" class="btn btn-secondary" @click="close">取消</button>
              <button 
                type="button"
                class="btn btn-primary" 
                :disabled="selectedSongIds.size === 0 || importing"
                @click="handleImport"
              >
                {{ importing ? '导入中...' : '确认导入' }}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Icon from '../UI/Icon.vue'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'import-success'])

const semesterList = ref([])
const selectedSemester = ref('')
const songs = ref([])
const loadingSemesters = ref(false)
const loadingSongs = ref(false)
const error = ref('')
const filterType = ref('unplayed') // 'unplayed', 'played', 'all'
const selectedSongIds = ref(new Set())
const importing = ref(false)
const importResult = ref(null)

const getFilterLabel = (type) => {
  const map = {
    'unplayed': '未被收录',
    'played': '被收录',
    'all': '全部'
  }
  return map[type]
}

const filteredSongs = computed(() => {
  if (!songs.value) return []
  return songs.value.filter(song => {
    if (filterType.value === 'all') return true
    if (filterType.value === 'played') return song.played
    if (filterType.value === 'unplayed') return !song.played
    return true
  })
})

const isAllSelected = computed(() => {
  return filteredSongs.value.length > 0 && 
         filteredSongs.value.every(s => selectedSongIds.value.has(s.id))
})

const isSelected = (id) => selectedSongIds.value.has(id)

const toggleSelection = (id) => {
  if (selectedSongIds.value.has(id)) {
    selectedSongIds.value.delete(id)
  } else {
    selectedSongIds.value.add(id)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消全选可见项
    filteredSongs.value.forEach(s => selectedSongIds.value.delete(s.id))
  } else {
    // 全选可见项
    filteredSongs.value.forEach(s => selectedSongIds.value.add(s.id))
  }
}

const fetchSemesters = async () => {
  loadingSemesters.value = true
  try {
    const res = await $fetch('/api/semesters/options')
    if (res.success) {
      // 过滤掉当前活跃学期，防止从当前学期导入到当前学期
      semesterList.value = res.data.filter(sem => !sem.isActive)
      // 不自动选择，强制用户手动选择
    }
  } catch (e) {
    console.error('Failed to fetch semesters', e)
    error.value = '加载学期列表失败'
  } finally {
    loadingSemesters.value = false
  }
}

const loadSongs = async () => {
  if (!selectedSemester.value) return
  
  loadingSongs.value = true
  error.value = ''
  songs.value = []
  selectedSongIds.value.clear()
  
  try {
    const res = await $fetch('/api/songs', {
      params: {
        semester: selectedSemester.value,
        scope: 'mine',
        bypass_cache: 'true' // 确保获取最新数据
      }
    })
    
    if (res.success) {
      songs.value = res.data.songs
    }
  } catch (e) {
    console.error('Failed to fetch songs', e)
    error.value = '加载歌曲列表失败'
  } finally {
    loadingSongs.value = false
  }
}

const handleImport = async () => {
  if (selectedSongIds.value.size === 0) return
  
  importing.value = true
  try {
    const res = await $fetch('/api/songs/import', {
      method: 'POST',
      body: {
        songIds: Array.from(selectedSongIds.value)
      }
    })
    
    if (res.success) {
      if (res.results) {
        importResult.value = res.results
      } else {
        // 如果结果结构不同，进行降级处理
        importResult.value = {
          success: res.count,
          failed: 0,
          details: []
        }
      }
      emit('import-success')
      // 不关闭弹窗，显示结果视图
    }
  } catch (e) {
    console.error('Import failed', e)
    if (window.$showNotification) {
      window.$showNotification(e.message || '导入失败', 'error')
    }
  } finally {
    importing.value = false
  }
}

const close = () => {
  emit('close')
  importResult.value = null
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    importResult.value = null // 重置结果
    if (semesterList.value.length === 0) {
      fetchSemesters()
    }
    // 重置状态
    selectedSongIds.value.clear()
    filterType.value = 'unplayed'
  }
})

watch(selectedSemester, () => {
  if (selectedSemester.value) {
    loadSongs()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-secondary, #fff);
  border-radius: 16px;
  width: 90%;
  max-width: 700px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color, #e5e7eb);
  color: var(--text-primary, #111827);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-filters {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.semester-select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  flex: 1;
}

.filter-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.1);
  padding: 4px;
  border-radius: 8px;
  align-self: flex-start;
}

.filter-tab {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.filter-tab.active {
  background: var(--bg-primary, #fff);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  font-weight: 500;
}

.import-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.modal-header,
.modal-filters,
.modal-footer {
  flex-shrink: 0;
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
  background: rgba(0,0,0,0.02);
  min-height: 0; /* Fix for nested flex scroll */
}

.songs-list {
  padding: 0;
}

.song-item {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
  align-items: center;
  transition: background-color 0.2s;
  cursor: pointer;
}

.song-item:hover {
  background-color: var(--bg-hover, #f9fafb);
}

.song-item.selected {
  background-color: rgba(59, 130, 246, 0.1);
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.custom-checkbox.checked {
  background-color: var(--primary-color, #3b82f6);
  border-color: var(--primary-color, #3b82f6);
}

.song-cover {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--text-secondary, #6b7280);
}

.song-status {
  margin-left: 10px;
}

.status-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.status-badge.played {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.unplayed {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.selected-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--primary-color, #3b82f6);
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary);
}

.loading-spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid var(--primary-color, #3b82f6);
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Dark mode overrides */
:root[class~="dark"] .modal-content {
  background: rgba(20, 20, 25, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

:root[class~="dark"] .modal-header,
:root[class~="dark"] .modal-filters,
:root[class~="dark"] .modal-footer,
:root[class~="dark"] .song-item {
  border-color: rgba(255, 255, 255, 0.05);
}

:root[class~="dark"] .semester-select {
  background: rgba(0,0,0,0.3);
  border-color: rgba(255,255,255,0.1);
  color: white;
}

:root[class~="dark"] .filter-tabs {
  background: rgba(255,255,255,0.05);
}

:root[class~="dark"] .filter-tab.active {
  background: rgba(255,255,255,0.1);
  color: white;
}

:root[class~="dark"] .song-item:hover {
  background: rgba(255,255,255,0.03);
}

:root[class~="dark"] .btn-secondary {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.1);
  color: white;
}

:root[class~="dark"] .text-btn {
  color: #60a5fa;
}

:root[class~="dark"] .status-badge.unplayed {
  color: #9ca3af;
}

@media (max-width: 640px) {
  .filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .filter-tabs {
    width: 100%;
    display: flex;
  }
  
  .filter-tab {
    flex: 1;
    text-align: center;
  }
  
  .modal-footer {
    flex-direction: column;
    gap: 12px;
  }
  
  .selection-info, .action-buttons {
    width: 100%;
    justify-content: space-between;
  }
}

.result-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.result-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  background: var(--bg-primary);
}

.summary-item.success .count {
  color: #10b981;
}

.summary-item.failed .count {
  color: #ef4444;
}

.summary-item .label {
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-item .count {
  font-size: 24px;
  font-weight: 700;
}

.result-details {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-primary);
}

.result-details h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.details-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 6px;
  font-size: 13px;
}

.result-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  font-size: 16px;
  font-weight: 500;
}

.action-buttons.full-width {
  width: 100%;
}

.action-buttons.full-width button {
  width: 100%;
}

:root[class~="dark"] .summary-item {
  background: rgba(255,255,255,0.03);
}

:root[class~="dark"] .detail-item {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}
</style>
