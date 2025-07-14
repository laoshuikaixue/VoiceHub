<template>
  <div class="song-list">
    <div v-if="loading" class="loading">
      加载中...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else-if="songs.length === 0" class="empty">
      暂无歌曲，马上去点歌吧！
    </div>
    
    <div v-else class="songs-container">
      <div class="filter-controls">
        <button :class="{ active: filterBy === 'all' }" @click="filterBy = 'all'">
          全部歌曲
        </button>
        <button :class="{ active: filterBy === 'mine' }" @click="filterBy = 'mine'">
          我的投稿
        </button>
      </div>
      
      <div class="sort-controls">
        <button :class="{ active: sortBy === 'popularity' }" @click="sortBy = 'popularity'">
          按热度排序
        </button>
        <div class="date-sort-container">
          <button :class="{ active: sortBy === 'date' }" @click="sortBy = 'date'">
            按时间排序
          </button>
          <button 
            v-if="sortBy === 'date'" 
            class="sort-order-toggle" 
            @click="toggleSortOrder"
            :title="sortOrder === 'desc' ? '当前：最新在前' : '当前：最早在前'"
          >
            <span v-if="sortOrder === 'desc'">↓</span>
            <span v-else>↑</span>
          </button>
        </div>
        <button @click="$emit('refresh')" class="refresh-button" title="刷新歌曲列表">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      
      <div class="songs-grid">
        <div 
          v-for="song in paginatedSongs" 
          :key="song.id" 
          class="song-card"
          :class="{ 'played': song.played }"
        >
          <div class="song-info">
            <div class="song-title-row">
              <h3 class="song-title">{{ song.title }} - {{ song.artist }}</h3>
              <div class="votes">
                <span class="vote-count">{{ song.voteCount }}</span>
                <button 
                  class="vote-button"
                  @click="handleVote(song)"
                  :disabled="song.voted || song.played || voteInProgress"
                >
                  {{ song.voted ? '已投' : '投票' }}
                </button>
              </div>
            </div>
            
            <div class="song-meta">
              <span class="requester">投稿人：{{ song.requester }}</span>
              <span class="request-time">投稿时间：{{ song.requestedAt || formatDate(song.createdAt) }}</span>
              <span class="song-status">{{ getSongStatus(song) }}</span>
            </div>
            
            <!-- 用户操作按钮 -->
            <div v-if="isMySong(song) && !song.played" class="user-actions">
              <button 
                class="withdraw-button"
                @click="handleWithdraw(song)"
                :disabled="actionInProgress || song.scheduled"
                :title="song.scheduled ? '已排期的歌曲不能撤回' : ''"
              >
                撤回投稿
              </button>
              <span v-if="song.scheduled" class="scheduled-tag">已排期</span>
            </div>
            
            <!-- 管理员操作按钮 -->
            <div v-if="isAdmin && !song.played" class="admin-actions">
              <button 
                class="admin-action delete-button"
                @click="handleDelete(song)"
                :disabled="actionInProgress"
              >
                删除歌曲
              </button>
              <button 
                class="admin-action mark-played"
                @click="handleMarkPlayed(song)"
                :disabled="actionInProgress"
              >
                标记为已播放
              </button>
            </div>
            
            <!-- 管理员撤回已播放歌曲按钮 -->
            <div v-if="isAdmin && song.played" class="admin-actions">
              <button 
                class="admin-action unmark-played"
                @click="handleUnmarkPlayed(song)"
                :disabled="actionInProgress"
              >
                撤回已播放
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 分页控件 - 仅在非移动端显示 -->
      <div v-if="!isMobile && totalPages > 1" class="pagination">
        <button 
          @click="goToPage(currentPage - 1)" 
          :disabled="currentPage === 1"
          class="page-button"
        >
          上一页
        </button>
        
        <div class="page-numbers">
          <button 
            v-for="page in displayedPageNumbers" 
            :key="page"
            @click="goToPage(page)"
            :class="['page-number', { active: currentPage === page }]"
          >
            {{ page }}
          </button>
        </div>
        
        <button 
          @click="goToPage(currentPage + 1)" 
          :disabled="currentPage === totalPages"
          class="page-button"
        >
          下一页
        </button>
        
        <div class="page-info">
          {{ currentPage }} / {{ totalPages }} 页 (共 {{ filteredSongs.length }} 首歌曲)
        </div>
      </div>
      
      <!-- 确认对话框 -->
      <div v-if="confirmDialog.show" class="confirm-dialog-backdrop" @click.self="cancelConfirm">
        <div class="confirm-dialog">
          <div class="confirm-dialog-header">
            <h3>{{ confirmDialog.title }}</h3>
          </div>
          <div class="confirm-dialog-content">
            {{ confirmDialog.message }}
          </div>
          <div class="confirm-dialog-actions">
            <button 
              @click="cancelConfirm" 
              class="confirm-dialog-btn confirm-dialog-cancel"
            >
              取消
            </button>
            <button 
              @click="confirmAction" 
              class="confirm-dialog-btn confirm-dialog-confirm"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'

const props = defineProps({
  songs: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['vote', 'withdraw', 'delete', 'markPlayed', 'unmarkPlayed', 'refresh'])
const voteInProgress = ref(false)
const actionInProgress = ref(false)
const sortBy = ref('popularity')
const sortOrder = ref('desc') // 'desc' for newest first, 'asc' for oldest first
const filterBy = ref('all')
const auth = useAuth()

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10首歌曲
const isMobile = ref(false)

// 检测设备是否为移动设备
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// 组件挂载和卸载时添加/移除窗口大小变化监听
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 确认对话框
const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  action: null,
  data: null
})

// 格式化日期为 X年X月X日 H:M
const formatDate = (dateString) => {
  if (!dateString) return '未知时间'
  const date = new Date(dateString)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 获取歌曲状态
const getSongStatus = (song) => {
  if (song.played) {
    return '已播放'
  } else if (song.scheduled) {
    return '待播放'
  } else {
    return '待入选'
  }
}

// 检查是否是用户自己的投稿
const isMySong = (song) => {
  return auth.user.value && song.requesterId === auth.user.value.id
}

// Toggle sort order between ascending and descending
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

// 按照选择的方式过滤和排序歌曲
const filteredSongs = computed(() => {
  let result = [...props.songs]
  
  // 先过滤
  if (filterBy.value === 'mine' && auth.user.value) {
    result = result.filter(song => song.requesterId === auth.user.value.id)
  }
  
  // 再排序
  if (sortBy.value === 'popularity') {
    return result.sort((a, b) => b.voteCount - a.voteCount)
  } else {
    // 按时间排序，考虑排序方向
    if (sortOrder.value === 'desc') {
      // 降序 - 最新的在前面
      return result.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } else {
      // 升序 - 最早的在前面
      return result.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    }
  }
})

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(filteredSongs.value.length / pageSize.value)
})

// 当前页显示的歌曲
const paginatedSongs = computed(() => {
  // 移动端不分页，显示所有歌曲
  if (isMobile.value) {
    return filteredSongs.value
  }
  
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredSongs.value.slice(start, end)
})

// 计算要显示的页码
const displayedPageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  
  if (total <= 7) {
    // 如果总页数小于等于7，显示所有页码
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  
  // 否则，显示当前页附近的页码和首尾页码
  if (current <= 4) {
    // 当前页靠近开头
    return [1, 2, 3, 4, 5, '...', total]
  } else if (current >= total - 3) {
    // 当前页靠近结尾
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  } else {
    // 当前页在中间
    return [1, '...', current - 1, current, current + 1, '...', total]
  }
})

// 跳转到指定页
const goToPage = (page) => {
  if (typeof page === 'number' && page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 监听过滤和排序变化，重置页码
watch([filterBy, sortBy, sortOrder], () => {
  currentPage.value = 1
})

// 监听歌曲列表变化，重置页码
watch(() => props.songs, () => {
  currentPage.value = 1
}, { deep: true })

// 用户操作：投票
const handleVote = async (song) => {
  if (voteInProgress.value) return
  
  voteInProgress.value = true
  try {
    await emit('vote', song)
  } finally {
    voteInProgress.value = false
  }
}

// 用户操作：撤回投稿
const handleWithdraw = (song) => {
  confirmDialog.value = {
    show: true,
    title: '撤回投稿',
    message: `确定要撤回《${song.title}》的投稿吗？此操作不可恢复。`,
    action: 'withdraw',
    data: song
  }
}

// 管理员操作：删除歌曲
const handleDelete = (song) => {
  confirmDialog.value = {
    show: true,
    title: '删除歌曲',
    message: `确定要删除《${song.title}》吗？此操作不可恢复。`,
    action: 'delete',
    data: song
  }
}

// 管理员操作：标记为已播放
const handleMarkPlayed = (song) => {
  confirmDialog.value = {
    show: true,
    title: '标记为已播放',
    message: `确定要将《${song.title}》标记为已播放吗？`,
    action: 'markPlayed',
    data: song
  }
}

// 管理员操作：撤回已播放状态
const handleUnmarkPlayed = (song) => {
  confirmDialog.value = {
    show: true,
    title: '撤回已播放状态',
    message: `确定要撤回《${song.title}》的已播放状态吗？`,
    action: 'unmarkPlayed',
    data: song
  }
}

// 确认操作
const confirmAction = async () => {
  if (actionInProgress.value) return
  
  actionInProgress.value = true
  try {
    const { action, data } = confirmDialog.value
    
    if (action === 'withdraw') {
      await emit('withdraw', data)
    } else if (action === 'delete') {
      await emit('delete', data)
    } else if (action === 'markPlayed') {
      await emit('markPlayed', data)
    } else if (action === 'unmarkPlayed') {
      await emit('unmarkPlayed', data)
    }
    
    // 关闭对话框
    confirmDialog.value.show = false
  } finally {
    actionInProgress.value = false
  }
}

// 取消确认
const cancelConfirm = () => {
  confirmDialog.value.show = false
}
</script>

<style scoped>
.song-list {
  width: 100%;
}

.loading, .error, .empty {
  padding: 2rem;
  text-align: center;
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.4);
  margin: 1rem 0;
  color: var(--light);
}

.error {
  color: var(--danger);
}

.empty {
  color: var(--gray);
}

.filter-controls {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
}

.filter-controls button {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.375rem;
  cursor: pointer;
  color: var(--gray);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.filter-controls button:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.filter-controls button:hover:before {
  width: 150%;
  height: 150%;
}

.filter-controls button.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.sort-controls {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.sort-controls button {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.375rem;
  cursor: pointer;
  color: var(--gray);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.sort-controls button:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.sort-controls button:hover:before {
  width: 150%;
  height: 150%;
}

.sort-controls button.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.date-sort-container {
  display: flex;
  align-items: center;
  position: relative;
}

.sort-order-toggle {
  margin-left: 0.25rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
  padding: 0 !important;
}

.sort-order-toggle:hover {
  background: rgba(99, 102, 241, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(99, 102, 241, 0.2);
}

.refresh-button {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0 !important;
}

.refresh-button:hover {
  background: rgba(16, 185, 129, 0.2);
  transform: rotate(30deg);
  box-shadow: 0 2px 5px rgba(16, 185, 129, 0.2);
}

.songs-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  width: 100%; /* 确保宽度一致 */
}

.song-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
  transition: all 0.3s ease;
  width: 100%; /* 确保宽度一致 */
  box-sizing: border-box; /* 确保内边距不会增加元素总宽度 */
}

.song-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.3);
}

.song-card.played {
  opacity: 0.7;
}

.song-info {
  width: 100%;
}

.song-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.song-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.song-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--gray-light);
  margin-top: 0.5rem;
}

.requester, .request-time, .song-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.request-time {
  color: var(--secondary);
}

.votes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vote-count {
  font-size: 1rem;
  font-weight: bold;
  color: var(--primary);
}

.vote-button {
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.vote-button:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
  z-index: 0;
}

.vote-button:hover:not([disabled]):before {
  width: 150%;
  height: 150%;
}

.vote-button:hover:not([disabled]) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.2);
}

.vote-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 用户操作按钮 */
.user-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.withdraw-button {
  padding: 0.35rem 0.75rem;
  border: 1px solid rgba(231, 76, 60, 0.3);
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.withdraw-button:hover:not([disabled]) {
  background: rgba(231, 76, 60, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(231, 76, 60, 0.2);
}

.withdraw-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.scheduled-tag {
  margin-left: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: bold;
}

/* 管理员操作按钮 */
.admin-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.admin-action {
  padding: 0.35rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.6);
  color: var(--light);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.admin-action:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
  z-index: 0;
}

.admin-action:hover:before {
  width: 150%;
  height: 150%;
}

.admin-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.admin-action.mark-played {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.3);
  color: var(--success);
}

.admin-action.mark-played:hover {
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.2);
}

.admin-action.delete-button {
  background: rgba(231, 76, 60, 0.2);
  border-color: rgba(231, 76, 60, 0.3);
  color: #e74c3c;
}

.admin-action.delete-button:hover {
  box-shadow: 0 4px 8px rgba(231, 76, 60, 0.2);
}

.admin-action.unmark-played {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  color: var(--primary);
}

.admin-action.unmark-played:hover {
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
}

.admin-action[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 分页控件样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.page-button, .page-number {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.4);
  color: var(--gray);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.page-button:hover:not([disabled]), .page-number:hover:not([disabled]) {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.page-button:disabled, .page-number[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  color: var(--gray);
}

.page-number.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.page-info {
  font-size: 0.875rem;
  color: var(--gray);
  margin-left: 1rem;
}

/* 确认对话框样式 */
.confirm-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.confirm-dialog-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--light);
  margin: 0;
}

.confirm-dialog-content {
  padding: 1.5rem 1rem;
  color: var(--light);
}

.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
  gap: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.confirm-dialog-cancel {
  background: rgba(149, 165, 166, 0.2);
  color: var(--light);
  border: 1px solid rgba(149, 165, 166, 0.3);
}

.confirm-dialog-cancel:hover {
  background: rgba(149, 165, 166, 0.3);
}

.confirm-dialog-confirm {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.confirm-dialog-confirm:hover {
  background: rgba(231, 76, 60, 0.3);
}

@media (max-width: 639px) {
  .song-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .song-title {
    max-width: 100%;
  }
  
  .votes {
    width: 100%;
    justify-content: space-between;
  }
}
</style> 