<template>
  <div class="song-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-section">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索歌曲标题、艺术家或投稿人..."
            class="search-input"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="clear-search-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="filter-section">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">全部状态</option>
          <option value="pending">待排期</option>
          <option value="scheduled">已排期</option>
          <option value="played">已播放</option>
        </select>
        
        <select v-model="sortOption" class="filter-select">
          <option value="time-desc">最新投稿</option>
          <option value="time-asc">最早投稿</option>
          <option value="votes-desc">热度最高</option>
          <option value="votes-asc">热度最低</option>
          <option value="title-asc">标题A-Z</option>
          <option value="title-desc">标题Z-A</option>
        </select>
      </div>
      
      <div class="action-section">
        <button
          @click="refreshSongs"
          class="refresh-btn"
          :disabled="loading"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,4 23,10 17,10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          刷新
        </button>
        
        <button
          v-if="selectedSongs.length > 0"
          @click="batchDelete"
          class="batch-delete-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
          </svg>
          删除选中 ({{ selectedSongs.length }})
        </button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">总计:</span>
        <span class="stat-value">{{ filteredSongs.length }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已播放:</span>
        <span class="stat-value">{{ playedCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">待播放:</span>
        <span class="stat-value">{{ pendingCount }}</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">正在加载歌曲...</div>
    </div>

    <!-- 歌曲列表 -->
    <div v-else class="song-list">
      <div v-if="filteredSongs.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12h8"/>
        </svg>
        <div class="empty-text">
          {{ searchQuery ? '没有找到匹配的歌曲' : '暂无歌曲数据' }}
        </div>
      </div>
      
      <div v-else class="song-table">
        <!-- 表头 -->
        <div class="table-header">
          <div class="header-cell checkbox-cell">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
              class="checkbox"
            />
          </div>
          <div class="header-cell song-info-cell">歌曲信息</div>
          <div class="header-cell submitter-cell">投稿人</div>
          <div class="header-cell stats-cell">统计</div>
          <div class="header-cell status-cell">状态</div>
          <div class="header-cell actions-cell">操作</div>
        </div>
        
        <!-- 歌曲行 -->
        <div
          v-for="song in paginatedSongs"
          :key="song.id"
          :class="['song-row', { selected: selectedSongs.includes(song.id) }]"
        >
          <div class="cell checkbox-cell">
            <input
              type="checkbox"
              :checked="selectedSongs.includes(song.id)"
              @change="toggleSelectSong(song.id)"
              class="checkbox"
            />
          </div>
          
          <div class="cell song-info-cell">
            <div class="song-info">
              <div class="song-title">{{ song.title }}</div>
              <div class="song-artist">{{ song.artist }}</div>
              <div class="song-meta">
                <span class="song-time">{{ formatDate(song.createdAt) }}</span>
                <span v-if="song.url" class="song-url">有音频</span>
              </div>
            </div>
          </div>
          
          <div class="cell submitter-cell">
            <div class="submitter-info">
              <div class="submitter-name">{{ song.requester || '未知' }}</div>
              <div v-if="song.user" class="submitter-username">@{{ song.user.username }}</div>
            </div>
          </div>
          
          <div class="cell stats-cell">
            <div class="song-stats">
              <div class="stat-item clickable" @click="showVoters(song.id)" :title="song.voteCount > 0 ? '点击查看投票人员' : '暂无投票'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {{ song.voteCount || 0 }}
              </div>
            </div>
          </div>
          
          <div class="cell status-cell">
            <span :class="['status-badge', getStatusClass(song)]">
              {{ getStatusText(song) }}
            </span>
          </div>
          
          <div class="cell actions-cell">
            <div class="action-buttons">
              <button
                v-if="!song.played"
                @click="markAsPlayed(song.id)"
                class="action-btn played-btn"
                title="标记为已播放"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              </button>
              
              <button
                v-else
                @click="markAsUnplayed(song.id)"
                class="action-btn unplayed-btn"
                title="标记为未播放"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
              
              <button
                @click="deleteSong(song.id)"
                class="action-btn delete-btn"
                title="删除歌曲"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          @click="currentPage = 1"
          :disabled="currentPage === 1"
          class="page-btn"
        >
          首页
        </button>
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="page-btn"
        >
          上一页
        </button>
        
        <div class="page-info">
          第 {{ currentPage }} 页，共 {{ totalPages }} 页
        </div>
        
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="page-btn"
        >
          下一页
        </button>
        <button
          @click="currentPage = totalPages"
          :disabled="currentPage === totalPages"
          class="page-btn"
        >
          末页
        </button>
      </div>
    </div>
  </div>

  <!-- 确认删除对话框 -->
  <ConfirmDialog
    :show="showDeleteDialog"
    :title="deleteDialogTitle"
    :message="deleteDialogMessage"
    type="danger"
    confirm-text="删除"
    cancel-text="取消"
    :loading="loading"
    @confirm="confirmDelete"
    @close="showDeleteDialog = false"
  />

  <!-- 投票人员弹窗 -->
  <VotersModal
    :show="showVotersModal"
    :song-id="selectedSongId"
    @close="closeVotersModal"
  />
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import VotersModal from '~/components/Admin/VotersModal.vue'
import { useSongs } from '~/composables/useSongs'
import { useAdmin } from '~/composables/useAdmin'
import { useAuth } from '~/composables/useAuth'

// 响应式数据
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('all')
const sortOption = ref('time-desc')
const selectedSongs = ref([])
const currentPage = ref(1)
const pageSize = ref(20)

// 删除对话框相关
const showDeleteDialog = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteAction = ref(null)

// 投票人员弹窗相关
const showVotersModal = ref(false)
const selectedSongId = ref(null)

// 数据
const songs = ref([])

// 服务
let songsService = null
let adminService = null
let auth = null

// 计算属性
const filteredSongs = computed(() => {
  if (!songs.value) return []
  
  let filtered = [...songs.value]
  
  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(song =>
      song.title?.toLowerCase().includes(query) ||
      song.artist?.toLowerCase().includes(query) ||
      song.requester?.toLowerCase().includes(query)
    )
  }
  
  // 状态过滤
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(song => {
      switch (statusFilter.value) {
        case 'pending':
          // 待排期：未播放且未排期
          return !song.played && !song.scheduled
        case 'scheduled':
          // 已排期：未播放但已排期
          return !song.played && song.scheduled
        case 'played':
          // 已播放
          return song.played
        default:
          return true
      }
    })
  }
  
  // 排序
  filtered.sort((a, b) => {
    switch (sortOption.value) {
      case 'time-desc':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      case 'time-asc':
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      case 'votes-desc':
        return (b.voteCount || 0) - (a.voteCount || 0)
      case 'votes-asc':
        return (a.voteCount || 0) - (b.voteCount || 0)
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '')
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '')
      default:
        return 0
    }
  })
  
  return filtered
})

const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredSongs.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredSongs.value.length / pageSize.value)
})

const playedCount = computed(() => {
  return songs.value.filter(song => song.played).length
})

const pendingCount = computed(() => {
  return songs.value.filter(song => !song.played).length
})

const isAllSelected = computed(() => {
  return paginatedSongs.value.length > 0 &&
         paginatedSongs.value.every(song => selectedSongs.value.includes(song.id))
})

// 方法
const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

const getStatusClass = (song) => {
  if (song.played) return 'played'
  return 'pending'
}

const getStatusText = (song) => {
  if (song.played) return '已播放'
  return '待播放'
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSongs.value = selectedSongs.value.filter(id =>
      !paginatedSongs.value.some(song => song.id === id)
    )
  } else {
    const newSelections = paginatedSongs.value
      .map(song => song.id)
      .filter(id => !selectedSongs.value.includes(id))
    selectedSongs.value.push(...newSelections)
  }
}

const toggleSelectSong = (songId) => {
  const index = selectedSongs.value.indexOf(songId)
  if (index > -1) {
    selectedSongs.value.splice(index, 1)
  } else {
    selectedSongs.value.push(songId)
  }
}

const refreshSongs = async () => {
  loading.value = true
  try {
    await songsService.fetchSongs()
    songs.value = songsService.songs.value || []
    selectedSongs.value = []
  } catch (error) {
    console.error('刷新歌曲失败:', error)
  } finally {
    loading.value = false
  }
}

const markAsPlayed = async (songId) => {
  try {
    await songsService.markPlayed(songId)
    await refreshSongs()
  } catch (error) {
    console.error('标记已播放失败:', error)
    if (window.$showNotification) {
      window.$showNotification('标记失败: ' + error.message, 'error')
    }
  }
}

const markAsUnplayed = async (songId) => {
  try {
    await songsService.unmarkPlayed(songId)
    await refreshSongs()
  } catch (error) {
    console.error('标记未播放失败:', error)
    if (window.$showNotification) {
      window.$showNotification('标记失败: ' + error.message, 'error')
    }
  }
}

const deleteSong = async (songId) => {
  const song = songs.value.find(s => s.id === songId)
  if (!song) return

  deleteDialogTitle.value = '删除歌曲'
  deleteDialogMessage.value = `确定要删除歌曲 "${song.title}" 吗？此操作不可撤销。`
  deleteAction.value = async () => {
    try {
      await adminService.deleteSong(songId)
      await refreshSongs()

      // 从选中列表中移除
      const index = selectedSongs.value.indexOf(songId)
      if (index > -1) {
        selectedSongs.value.splice(index, 1)
      }

      if (window.$showNotification) {
        window.$showNotification('歌曲删除成功', 'success')
      }
    } catch (error) {
      console.error('删除歌曲失败:', error)
      if (window.$showNotification) {
        window.$showNotification('删除失败: ' + error.message, 'error')
      }
    }
  }
  showDeleteDialog.value = true
}

const batchDelete = async () => {
  if (selectedSongs.value.length === 0) return

  deleteDialogTitle.value = '批量删除歌曲'
  deleteDialogMessage.value = `确定要删除选中的 ${selectedSongs.value.length} 首歌曲吗？此操作不可撤销。`
  deleteAction.value = async () => {
    try {
      loading.value = true

      for (const songId of selectedSongs.value) {
        await adminService.deleteSong(songId)
      }

      await refreshSongs()
      selectedSongs.value = []

      if (window.$showNotification) {
        window.$showNotification('批量删除成功', 'success')
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      if (window.$showNotification) {
        window.$showNotification('批量删除失败: ' + error.message, 'error')
      }
    } finally {
      loading.value = false
    }
  }
  showDeleteDialog.value = true
}

// 显示投票人员弹窗
const showVoters = (songId) => {
  selectedSongId.value = songId
  showVotersModal.value = true
}

// 关闭投票人员弹窗
const closeVotersModal = () => {
  showVotersModal.value = false
  selectedSongId.value = null
}

// 确认删除
const confirmDelete = async () => {
  if (deleteAction.value) {
    await deleteAction.value()
  }
  showDeleteDialog.value = false
  deleteAction.value = null
}

// 监听器
watch([searchQuery, statusFilter, sortOption], () => {
  currentPage.value = 1
})

// 生命周期
onMounted(async () => {
  songsService = useSongs()
  adminService = useAdmin()
  auth = useAuth()

  await refreshSongs()
})
</script>

<style scoped>
.song-management {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  color: #e2e8f0;
  min-height: 100vh;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  flex-wrap: wrap;
}

.toolbar h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

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
  left: 16px;
  width: 20px;
  height: 20px;
  color: #666666;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: #666666;
}

.clear-search-btn {
  position: absolute;
  right: 12px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: #666666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.clear-search-btn svg {
  width: 16px;
  height: 16px;
}

.filter-section {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 12px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

.action-section {
  display: flex;
  gap: 12px;
}

.refresh-btn,
.batch-delete-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.refresh-btn {
  background: #667eea;
  color: #ffffff;
}

.refresh-btn:hover:not(:disabled) {
  background: #5a67d8;
}

.refresh-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

.batch-delete-btn {
  background: #ef4444;
  color: #ffffff;
}

.batch-delete-btn:hover {
  background: #dc2626;
}

.refresh-btn svg,
.batch-delete-btn svg {
  width: 16px;
  height: 16px;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  gap: 32px;
  padding: 16px 20px;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #2a2a2a;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  color: #888888;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #2a2a2a;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #888888;
  font-size: 14px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  color: #444444;
}

.empty-text {
  color: #666666;
  font-size: 16px;
  text-align: center;
}

/* 歌曲表格 */
.song-table {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 50px 1fr 150px 100px 100px 120px;
  gap: 16px;
  padding: 16px 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}

.header-cell {
  font-size: 14px;
  font-weight: 600;
  color: #cccccc;
  display: flex;
  align-items: center;
}

.song-row {
  display: grid;
  grid-template-columns: 50px 1fr 150px 100px 100px 120px;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a2a;
  transition: all 0.2s ease;
}

.song-row:hover {
  background: #1f1f1f;
}

.song-row.selected {
  background: rgba(102, 126, 234, 0.1);
  border-color: #667eea;
}

.song-row:last-child {
  border-bottom: none;
}

.cell {
  display: flex;
  align-items: center;
}

.checkbox-cell {
  justify-content: center;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
}

.song-artist {
  font-size: 14px;
  color: #cccccc;
}

.song-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.song-time {
  font-size: 12px;
  color: #888888;
}

.song-url {
  font-size: 12px;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.submitter-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.submitter-name {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.submitter-username {
  font-size: 12px;
  color: #888888;
}

.song-stats {
  display: flex;
  align-items: center;
  gap: 4px;
}

.song-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #888888;
}

.song-stats .stat-item.clickable {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.song-stats .stat-item.clickable:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.song-stats .stat-item.clickable:hover svg {
  color: #ef4444;
}

.song-stats svg {
  width: 14px;
  height: 14px;
  color: #ef4444;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.status-badge.pending {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.status-badge.played {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.played-btn {
  background: #10b981;
  color: #ffffff;
}

.played-btn:hover {
  background: #059669;
}

.unplayed-btn {
  background: #f59e0b;
  color: #ffffff;
}

.unplayed-btn:hover {
  background: #d97706;
}

.delete-btn {
  background: #ef4444;
  color: #ffffff;
}

.delete-btn:hover {
  background: #dc2626;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
}

.page-btn {
  padding: 8px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #cccccc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: #3a3a3a;
  color: #ffffff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #888888;
  margin: 0 16px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .search-section {
    min-width: auto;
  }

  .filter-section,
  .action-section {
    justify-content: flex-start;
  }

  .table-header,
  .song-row {
    grid-template-columns: 50px 1fr 120px 80px 80px 100px;
    gap: 12px;
    padding: 12px 16px;
  }
}

@media (max-width: 768px) {
  .song-management {
    padding: 16px;
  }

  .stats-bar {
    flex-direction: column;
    gap: 12px;
  }

  .table-header,
  .song-row {
    grid-template-columns: 40px 1fr 60px 80px;
    gap: 8px;
    padding: 12px;
  }

  .submitter-cell,
  .stats-cell {
    display: none;
  }

  .song-meta {
    flex-direction: column;
    gap: 4px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
  }

  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
