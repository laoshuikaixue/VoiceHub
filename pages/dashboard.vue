<template>
  <div>
  <ClientOnly>
    <div class="dashboard">
      <div class="dashboard-header glass">
          <div class="header-left">
            <NuxtLink to="/" class="logo-link">
              <h2 class="logo">VoiceHub</h2>
            </NuxtLink>
        <h1>后台管理系统</h1>
          </div>
        <div class="user-info">
          <span>欢迎, {{ currentUser?.name || '管理员' }}</span>
          <button @click="handleLogout" class="logout-btn">注销</button>
        </div>
      </div>
      
      <div class="dashboard-tabs">
        <button 
          :class="['tab-btn', { active: activeTab === 'schedule' }]" 
          @click="activeTab = 'schedule'"
        >
          排期管理
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'songs' }]" 
          @click="activeTab = 'songs'"
        >
          歌曲管理
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'users' }]" 
          @click="activeTab = 'users'"
        >
          用户管理
        </button>
      </div>
      
      <div class="dashboard-content">
        <!-- 歌曲列表 -->
        <div v-if="activeTab === 'songs'" class="section songs-section glass">
          <h2>歌曲列表</h2>
          
          <SongList 
            :songs="songs" 
            :loading="songLoading" 
            :error="songError"
            :is-admin="isAdminUser"
            @vote="handleVote"
            @withdraw="handleWithdraw"
            @delete="handleDelete"
            @markPlayed="handleMarkPlayed"
            @unmarkPlayed="handleUnmarkPlayed"
            @refresh="refreshSongs"
          />
        </div>
        
        <!-- 排期管理 -->
        <div v-if="activeTab === 'schedule'" class="section schedule-section glass">
          <h2>排期管理</h2>
          <div class="schedule-manager">
            <!-- 水平滚动日期选择器 -->
            <div class="date-selector-container">
              <button 
                class="date-nav-btn prev-btn" 
                @click="scrollDates('left')"
                :disabled="isFirstDateVisible"
              >
                &lt;
              </button>
              <div class="date-selector" ref="dateSelector">
                <button 
                  v-for="date in availableDates" 
                  :key="date"
                  :class="['date-btn', { active: selectedDate === date }]"
                  @click="selectedDate = date"
                >
                  {{ formatDateShort(date) }}
                </button>
              </div>
              <button 
                class="date-nav-btn next-btn" 
                @click="scrollDates('right')"
                :disabled="isLastDateVisible"
              >
                &gt;
              </button>
            </div>
            
            <div class="schedule-container">
              <div class="song-list-panel">
                <h3>待排歌曲</h3>
                  
                  <!-- 添加排序选项 -->
                  <div class="sort-options">
                    <label>排序方式:</label>
                    <select v-model="songSortOption" class="sort-select">
                      <option value="time-desc">最新投稿</option>
                      <option value="time-asc">最早投稿</option>
                      <option value="votes-desc">热度最高</option>
                      <option value="votes-asc">热度最低</option>
                    </select>
                  </div>
                  
                <div 
                  :class="['draggable-songs', { 'drag-over': isDraggableOver }]"
                  @dragover.prevent="handleDraggableDragOver($event)"
                  @dragenter.prevent="isDraggableOver = true"
                  @dragleave="handleDraggableDragLeave($event)"
                  @drop.stop.prevent="handleReturnToDraggable($event)"
                >
                  <div 
                    v-for="song in filteredUnscheduledSongs" 
                    :key="song.id"
                    class="draggable-song"
                    draggable="true"
                    @dragstart="dragStart($event, song)"
                    @dragend="dragEnd($event)"
                  >
                    <div class="song-info">
                      <div class="song-title">{{ song.title }}</div>
                        <div class="song-meta">
                          <span class="song-artist">{{ song.artist }}</span>
                          <span class="song-submitter">投稿人: {{ song.requester }}</span>
                        </div>
                        <div class="song-stats">
                          <span class="votes-count">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            {{ song.voteCount || 0 }}
                          </span>
                          <span class="time-info">{{ formatDate(song.createdAt) }}</span>
                        </div>
                    </div>
                    <div class="drag-handle">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="8" cy="8" r="1.5"></circle>
                        <circle cx="16" cy="8" r="1.5"></circle>
                        <circle cx="8" cy="16" r="1.5"></circle>
                        <circle cx="16" cy="16" r="1.5"></circle>
                      </svg>
                    </div>
                  </div>
                  <div v-if="filteredUnscheduledSongs.length === 0" class="empty-message">
                    没有待排歌曲
                  </div>
                </div>
              </div>
              
              <div class="sequence-panel">
                <h3>播放顺序</h3>
                <div 
                  ref="sequenceList"
                  :class="['sequence-list', { 'drag-over': isSequenceOver }]"
                  @dragover.prevent="handleDragOver($event)"
                  @dragenter.prevent="isSequenceOver = true"
                  @dragleave="handleSequenceDragLeave($event)"
                  @drop.stop.prevent="dropToSequence($event)"
                >
                  <div v-if="localScheduledSongs.length === 0" class="empty-message">
                    将歌曲拖到此处安排播放顺序
                  </div>
                  <div 
                    v-for="(schedule, index) in localScheduledSongs" 
                    :key="schedule.id"
                    :class="['scheduled-song', { 'drag-over': dragOverIndex === index }]"
                    draggable="true"
                    @dragstart="dragScheduleStart($event, schedule)"
                    @dragend="dragEnd($event)"
                    @dragover.prevent
                    @dragenter.prevent="handleDragEnter($event, index)"
                    @dragleave="handleDragLeave($event)"
                    @drop.stop.prevent="dropReorder($event, index)"
                  >
                    <div class="order-number">{{ index + 1 }}</div>
                    <div class="scheduled-song-info">
                      <div class="song-title">{{ schedule.song.title }}</div>
                      <div class="song-artist">{{ schedule.song.artist }}</div>
                    </div>
                    <div class="song-actions">
                      <button 
                        @click="removeFromSequence(index)" 
                        class="remove-btn"
                        title="移除排期"
                      >
                        ×
                      </button>
                      <div class="drag-handle">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="8" cy="8" r="1.5"></circle>
                          <circle cx="16" cy="8" r="1.5"></circle>
                          <circle cx="8" cy="16" r="1.5"></circle>
                          <circle cx="16" cy="16" r="1.5"></circle>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="sequence-actions">
                  <button @click="saveSequence" class="save-btn" :disabled="!hasChanges">
                    保存顺序
                  </button>
                  <button @click="markAllAsPlayed" class="mark-played-btn" :disabled="localScheduledSongs.length === 0">
                    全部标记为已播放
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 用户管理 -->
        <div v-if="activeTab === 'users'" class="section users-section glass">
          <UserManager />
        </div>
      </div>
      
        <!-- 确认对话框组件 -->
        <div v-if="confirmDialog.show" class="confirm-dialog-backdrop">
          <div class="confirm-dialog">
            <div class="confirm-dialog-header">
              <h3>{{ confirmDialog.title }}</h3>
            </div>
            <div class="confirm-dialog-content">
              {{ confirmDialog.message }}
            </div>
            <div class="confirm-dialog-actions">
              <button 
                @click="handleConfirmCancel" 
                class="confirm-dialog-btn confirm-dialog-cancel"
              >
                取消
              </button>
              <button 
                @click="handleConfirmConfirm" 
                class="confirm-dialog-btn confirm-dialog-confirm"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
    
    <!-- 将通知组件移到ClientOnly外部 -->
    <Teleport to="body">
      <Transition-group 
        tag="div" 
        name="notification" 
        class="notifications-container"
      >
        <div 
          v-for="notification in notifications" 
          :key="notification.id" 
          :class="['notification', `notification-${notification.type}`, { 'visible': notification.visible }]"
        >
          <div class="notification-icon">
            <svg v-if="notification.type === 'success'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <svg v-else-if="notification.type === 'error'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <svg v-else-if="notification.type === 'warning'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div class="notification-content">{{ notification.message }}</div>
        </div>
      </Transition-group>
    </Teleport>
          </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import SongList from '~/components/Songs/SongList.vue'
import UserManager from '~/components/Admin/UserManager.vue'

const router = useRouter()
const currentUser = ref(null)
const isAuthenticated = ref(false)
const isAdminUser = ref(false)

// 激活的标签
const activeTab = ref('schedule')

// 客户端安全数据
let auth = null
let songsService = null
let adminService = null

const songs = ref([])
const publicSchedules = ref([])
const songLoading = ref(false)
const songError = ref('')

// DOM引用
const dateSelector = ref(null)
const sequenceList = ref(null)

// 排期相关
const selectedDate = ref(new Date().toISOString().split('T')[0])
const currentDate = new Date().toISOString().split('T')[0]
const hasChanges = ref(false)
const originalOrder = ref([])
const draggedSchedule = ref(null)
const isFirstDateVisible = ref(true)
const isLastDateVisible = ref(true)
const dragOverIndex = ref(-1)
const isDraggableOver = ref(false)
const isSequenceOver = ref(false)

// 歌曲排序选项
const songSortOption = ref('time-desc')

// 本地排期数据（用于拖拽排序，不立即保存到数据库）
const localScheduledSongs = ref([])
const scheduledSongIds = ref(new Set())

// 已移除的歌曲ID列表
const removedSongIds = ref([])

// 生成未来7天的日期
const availableDates = computed(() => {
  const dates = []
  const today = new Date()
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }
  
  return dates
})

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '未知时间'
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60))
    if (diffHours < 1) {
      const diffMinutes = Math.floor((now - date) / (1000 * 60))
      return diffMinutes <= 1 ? '刚刚' : `${diffMinutes}分钟前`
    }
    return `${diffHours}小时前`
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
  }
}

// 验证登录状态
onMounted(async () => {
  auth = useAuth()
  isAuthenticated.value = auth.isAuthenticated.value
  isAdminUser.value = auth.isAdmin.value
  currentUser.value = auth.user.value
  
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  
  if (!isAdminUser.value) {
    router.push('/')
    return
  }
  
  // 初始化服务
  songsService = useSongs()
  adminService = useAdmin()
  
  // 使用引用保存服务状态
  songs.value = songsService.songs.value
  publicSchedules.value = songsService.publicSchedules.value
  songLoading.value = songsService.loading.value
  songError.value = songsService.error.value
  
  // 加载数据
  await songsService.fetchSongs()
  await songsService.fetchPublicSchedules()
  
  // 更新本地引用
  songs.value = songsService.songs.value
  publicSchedules.value = songsService.publicSchedules.value
  
  // 初始化本地排期数据
  updateLocalScheduledSongs()
  
  // 初始化日期选择器滚动状态
  nextTick(() => {
    updateScrollButtonState()
    
    // 确保空排期列表也能接收拖拽
    if (sequenceList.value) {
      // 使用事件委托，确保只有在列表为空时才处理
      sequenceList.value.addEventListener('dragover', (e) => {
        // 只有当列表为空或者直接拖到列表上时才处理
        if (localScheduledSongs.value.length === 0 || e.target === sequenceList.value) {
          e.preventDefault()
          isSequenceOver.value = true
        }
      })
      
      sequenceList.value.addEventListener('drop', (e) => {
        // 只有当列表为空或者直接拖到列表上时才处理
        if ((localScheduledSongs.value.length === 0 || e.target === sequenceList.value) && 
            !e.target.closest('.scheduled-song')) {
          e.preventDefault()
          e.stopPropagation() // 阻止事件冒泡，防止重复处理
          dropToSequence(e)
        }
      })
    }
  })
})

// 监听日期变化，重新加载排期
watch(selectedDate, async () => {
  await songsService.fetchPublicSchedules()
  publicSchedules.value = songsService.publicSchedules.value
  updateLocalScheduledSongs()
  hasChanges.value = false
})

// 更新本地排期数据
const updateLocalScheduledSongs = () => {
  const datePrefix = selectedDate.value
  
  const dateSchedules = publicSchedules.value.filter(schedule => {
    if (!schedule.playDate) return false
    
    const scheduleDateStr = new Date(schedule.playDate).toISOString().split('T')[0]
    return scheduleDateStr === datePrefix
  }).sort((a, b) => {
    // 按播放顺序排序
    return a.sequence - b.sequence
  })
  
  localScheduledSongs.value = [...dateSchedules]
  originalOrder.value = [...dateSchedules].map(s => s.id)
  
  // 更新已排期歌曲ID集合 - 收集所有日期的排期歌曲
  scheduledSongIds.value = new Set(
    publicSchedules.value
      .filter(s => s.song)
      .map(s => s.song.id)
  )
}

// 未排期的歌曲（经过过滤，不显示已排到当日的歌曲）
const filteredUnscheduledSongs = computed(() => {
  if (!songs.value) return []
  
  // 找出未播放且未排期的歌曲
  const unscheduledSongs = songs.value.filter(song => 
    !song.played && !scheduledSongIds.value.has(song.id)
  )
  
  // 根据选择的排序选项进行排序
  return [...unscheduledSongs].sort((a, b) => {
    switch (songSortOption.value) {
      case 'time-desc':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      case 'time-asc':
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      case 'votes-desc':
        return (b.voteCount || 0) - (a.voteCount || 0)
      case 'votes-asc':
        return (a.voteCount || 0) - (b.voteCount || 0)
      default:
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    }
  })
})

// 检查顺序是否有变化
const checkForChanges = () => {
  const currentOrder = localScheduledSongs.value.map(s => s.id)
  hasChanges.value = JSON.stringify(currentOrder) !== JSON.stringify(originalOrder.value)
}

// 处理拖拽开始（从左侧拖到右侧）
const dragStart = (event, song) => {
  // 设置拖拽数据
  event.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'new-song',
    songId: song.id
  }))
  
  // 添加拖拽效果
  if (event.target.classList) {
    setTimeout(() => {
      event.target.classList.add('dragging')
    }, 0)
  }
}

// 处理排期拖拽开始（右侧内部排序）
const dragScheduleStart = (event, schedule) => {
  // 设置拖拽数据
  event.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'reorder-schedule',
    scheduleId: schedule.id
  }))
  
  draggedSchedule.value = { ...schedule }
  
  // 添加拖拽效果
  if (event.target.classList) {
    setTimeout(() => {
      event.target.classList.add('dragging')
    }, 0)
  }
}

// 处理拖拽结束
const dragEnd = (event) => {
  // 移除拖拽效果
  if (event.target.classList) {
    event.target.classList.remove('dragging')
  }
  
  // 重置所有拖拽状态
  dragOverIndex.value = -1
  isDraggableOver.value = false
  isSequenceOver.value = false
  
  // 确保清除拖拽状态
  setTimeout(() => {
    draggedSchedule.value = null
  }, 50)
}

// 处理拖拽经过
const handleDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  isSequenceOver.value = true
}

// 处理拖拽进入
const handleDragEnter = (event, index) => {
  event.preventDefault()
  dragOverIndex.value = index
}

// 处理拖拽离开
const handleDragLeave = (event) => {
  // 确保只有当真正离开元素时才重置
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    dragOverIndex.value = -1
  }
}

// 处理左侧拖拽区域的拖拽经过
const handleDraggableDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  isDraggableOver.value = true
}

// 处理左侧拖拽区域的拖拽离开
const handleDraggableDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    isDraggableOver.value = false
  }
}

// 处理右侧拖拽区域的拖拽离开
const handleSequenceDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    isSequenceOver.value = false
  }
}

// 处理放置到排期列表（从左侧拖到右侧）
const dropToSequence = async (event) => {
  event.preventDefault()
  dragOverIndex.value = -1
  isSequenceOver.value = false
  
  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) {
      return
    }
    
    const dragData = JSON.parse(data)
    
    if (dragData.type === 'new-song') {
      // 从左侧拖到右侧的新歌曲
      const songId = parseInt(dragData.songId)
      if (!songId) {
        return
      }
      
      const song = songs.value.find(s => s.id === songId)
      if (!song) {
        return
      }
      
      // 检查歌曲是否已经在排期列表中
      const existingIndex = localScheduledSongs.value.findIndex(s => s.song.id === songId)
      if (existingIndex !== -1) {
        return
      }
      
      // 创建日期对象并设置为当天0点，只保存日期不保存时间
      const dateOnly = new Date(selectedDate.value)
      dateOnly.setHours(0, 0, 0, 0)
      
      // 创建新的排期对象（本地）
      const newSchedule = {
        id: Date.now(), // 临时ID
        song: song,
        playDate: dateOnly,
        sequence: localScheduledSongs.value.length + 1,
        isNew: true // 标记为新创建的
      }
      
      // 将歌曲ID添加到已排期集合，使其在左侧列表中隐藏
      scheduledSongIds.value.add(songId)
      
      // 添加到本地排期列表
      localScheduledSongs.value.push(newSchedule)
      hasChanges.value = true
    }
  } catch (err) {
    // 错误处理
  }
}

// 处理重新排序（右侧内部）
const dropReorder = async (event, dropIndex) => {
  event.preventDefault()
  dragOverIndex.value = -1
  
  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) {
      return
    }
    
    const dragData = JSON.parse(data)
    
    if (dragData.type === 'reorder-schedule' && draggedSchedule.value) {
      const scheduleId = parseInt(dragData.scheduleId)
      
      if (!scheduleId) {
        return
      }
      
      const draggedIndex = localScheduledSongs.value.findIndex(s => s.id === scheduleId)
      
      if (draggedIndex === -1) {
        return
      }
      
      if (draggedIndex === dropIndex) {
        return
      }
      
      // 重新排序本地数据
      
      // 创建一个新数组进行操作
      const newOrder = [...localScheduledSongs.value]
      const draggedItem = newOrder.splice(draggedIndex, 1)[0]
      newOrder.splice(dropIndex, 0, draggedItem)
      
      // 更新序号
      newOrder.forEach((item, index) => {
        item.sequence = index + 1
      })
      
      // 确保更新本地数据 - 使用新的引用触发响应式更新
      localScheduledSongs.value = newOrder
      
      // 强制重新渲染
      nextTick(() => {
        hasChanges.value = true
      })
    } else if (dragData.type === 'new-song') {
      // 这是从左侧拖到右侧的新歌曲，但是放在了特定位置
      const songId = parseInt(dragData.songId)
      if (!songId) {
        return
      }
      
      const song = songs.value.find(s => s.id === songId)
      if (!song) {
        return
      }
      
      // 检查歌曲是否已经在排期列表中
      const existingIndex = localScheduledSongs.value.findIndex(s => s.song.id === songId)
      if (existingIndex !== -1) {
        return
      }
      
      // 创建日期对象并设置为当天0点，只保存日期不保存时间
      const dateOnly = new Date(selectedDate.value)
      dateOnly.setHours(0, 0, 0, 0)
      
      // 创建新的排期对象（本地）
      const newSchedule = {
        id: Date.now(), // 临时ID
        song: song,
        playDate: dateOnly,
        sequence: dropIndex + 1,
        isNew: true // 标记为新创建的
      }
      
      // 将歌曲ID添加到已排期集合，使其在左侧列表中隐藏
      scheduledSongIds.value.add(songId)
      
      // 添加到本地排期列表的特定位置
      const newOrder = [...localScheduledSongs.value]
      newOrder.splice(dropIndex, 0, newSchedule)
      
      // 更新序号
      newOrder.forEach((item, index) => {
        item.sequence = index + 1
      })
      
      // 更新本地排期列表
      localScheduledSongs.value = newOrder
      hasChanges.value = true
    }
  } catch (err) {
    // 错误处理
  }
  
  draggedSchedule.value = null
}

// 处理拖回左侧列表
const handleReturnToDraggable = (event) => {
  event.preventDefault()
  isDraggableOver.value = false
  
  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) {
      return
    }
    
    const dragData = JSON.parse(data)
    
    if (dragData.type === 'reorder-schedule') {
      const scheduleId = parseInt(dragData.scheduleId)
      if (!scheduleId) return
      
      const scheduleIndex = localScheduledSongs.value.findIndex(s => s.id === scheduleId)
      if (scheduleIndex === -1) return
      
      const schedule = localScheduledSongs.value[scheduleIndex]
      
      // 从已排期ID集合中移除，使歌曲重新出现在左侧列表
      scheduledSongIds.value.delete(schedule.song.id)
      
      // 记录被移除的歌曲ID，确保保存时处理
      if (!removedSongIds.value.includes(schedule.song.id)) {
        removedSongIds.value.push(schedule.song.id)
      }
      
      // 从排期列表中移除
      localScheduledSongs.value.splice(scheduleIndex, 1)
      
      // 重新编号
      localScheduledSongs.value.forEach((item, idx) => {
        item.sequence = idx + 1
      })
      
      hasChanges.value = true
    }
  } catch (err) {
    // 错误处理
  }
}

// 格式化日期（短格式）
const formatDateShort = (dateStr) => {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekday = weekdays[date.getDay()]
  
  return `${month}/${day} ${weekday}`
}

// 添加自定义通知系统
const notifications = ref([])
let notificationId = 0

// 显示通知
const showNotification = (message, type = 'info', duration = 3000) => {
  const id = ++notificationId
  notifications.value.push({
    id,
    message,
    type, // 'info', 'success', 'warning', 'error'
    visible: true
  })
  
  // 自动关闭
  setTimeout(() => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value[index].visible = false
      setTimeout(() => {
        notifications.value = notifications.value.filter(n => n.id !== id)
      }, 300) // 等待淡出动画完成
    }
  }, duration)
}

// 确认对话框状态
const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  onConfirm: () => {},
  onCancel: () => {}
})

// 显示确认对话框
const showConfirmDialog = (title, message, onConfirm, onCancel) => {
  confirmDialog.value.show = true
  confirmDialog.value.title = title
  confirmDialog.value.message = message
  confirmDialog.value.onConfirm = onConfirm
  confirmDialog.value.onCancel = onCancel
}

// 处理确认对话框确认
const handleConfirmConfirm = () => {
  confirmDialog.value.onConfirm()
  confirmDialog.value.show = false
}

// 处理确认对话框取消
const handleConfirmCancel = () => {
  confirmDialog.value.onCancel()
  confirmDialog.value.show = false
}

// 从排期列表中移除
const removeFromSequence = (index) => {
  const schedule = localScheduledSongs.value[index]
  if (!schedule) {
    return
  }
  
  // 使用自定义确认对话框替代浏览器默认的confirm
  showConfirmDialog(
    `移除歌曲 "${schedule.song.title}" 的排期`,
    `确定要移除歌曲 "${schedule.song.title}" 的排期吗？`,
    () => {
      // 从已排期ID集合中移除，使歌曲重新出现在左侧列表
      scheduledSongIds.value.delete(schedule.song.id)
      
      // 记录被移除的歌曲ID，确保保存时处理
      if (!removedSongIds.value.includes(schedule.song.id)) {
        removedSongIds.value.push(schedule.song.id)
      }
      
      // 从本地列表中移除
      localScheduledSongs.value.splice(index, 1)
      
      // 重新编号
      localScheduledSongs.value.forEach((item, idx) => {
        item.sequence = idx + 1
      })
      
      hasChanges.value = true
      
      // 显示成功通知
      showNotification(`已移除歌曲 "${schedule.song.title}" 的排期`, 'success')
    },
    () => {
      // 取消操作
    }
  )
}

// 保存顺序
const saveSequence = async () => {
  try {
    // 显示加载通知
    showNotification('正在保存排期...', 'info')
    
    // 处理已移除的歌曲，确保从数据库中删除它们的排期
    for (const songId of removedSongIds.value) {
      try {
        // 查找该歌曲的所有排期
        const songSchedules = publicSchedules.value.filter(s => s.song && s.song.id === songId)
        
        for (const schedule of songSchedules) {
          await fetch(`/api/admin/schedule/remove`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...auth.getAuthHeader().headers
            },
            body: JSON.stringify({ scheduleId: schedule.id })
          })
        }
      } catch (err) {
        // 错误处理
      }
    }
    
    // 先删除当天所有排期
    const todaySchedules = publicSchedules.value.filter(s => {
      if (!s.playDate) return false
      const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
      return scheduleDateStr === selectedDate.value
    })
    
    for (const schedule of todaySchedules) {
      try {
        await fetch(`/api/admin/schedule/remove`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...auth.getAuthHeader().headers
          },
          body: JSON.stringify({ scheduleId: schedule.id })
        })
      } catch (err) {
        // 错误处理
      }
    }
    
    // 等待一小段时间确保删除操作完成
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 创建新的排期，确保按顺序创建
    for (let i = 0; i < localScheduledSongs.value.length; i++) {
      const schedule = localScheduledSongs.value[i]
      try {
        // 使用直接fetch调用确保数据正确传递
        const result = await fetch('/api/admin/schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...auth.getAuthHeader().headers
          },
          body: JSON.stringify({
            songId: schedule.song.id,
            playDate: new Date(selectedDate.value).toISOString().split('T')[0], // 只保存日期
            sequence: i + 1 // 使用索引+1作为序号
          })
        })
        
        if (!result.ok) {
          const errorData = await result.json()
          throw new Error(errorData.message || '创建排期失败')
        }
      } catch (err) {
        throw err
      }
    }
    
    // 清空已移除歌曲ID列表
    removedSongIds.value = []
    
    // 重新加载数据
    await songsService.fetchPublicSchedules()
    publicSchedules.value = songsService.publicSchedules.value
    updateLocalScheduledSongs()
    hasChanges.value = false
    
    // 显示成功通知
    showNotification('播放顺序已保存', 'success')
  } catch (err) {
    // 显示错误通知
    showNotification('保存顺序失败: ' + (err.message || '未知错误'), 'error')
  }
}

// 处理注销
const handleLogout = () => {
  if (auth) {
    auth.logout()
  }
}

// 滚动日期选择器
const scrollDates = (direction) => {
  if (!dateSelector.value) return
  
  const scrollAmount = direction === 'left' ? -200 : 200
  dateSelector.value.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  
  // 更新按钮状态
  setTimeout(updateScrollButtonState, 300)
}

// 更新滚动按钮状态
const updateScrollButtonState = () => {
  if (!dateSelector.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = dateSelector.value
  isFirstDateVisible.value = scrollLeft <= 10
  isLastDateVisible.value = scrollWidth - (scrollLeft + clientWidth) <= 10
}

// 处理投票
const handleVote = async (song) => {
  try {
    // 检查是否已经投过票
    if (song.voted) {
      showNotification(`您已经为歌曲《${song.title}》投过票了`, 'info')
      return
    }
    
    try {
      const result = await songsService.voteSong(song.id)
      if (result) {
        showNotification('投票成功！', 'success')
        // 手动刷新歌曲列表以获取最新状态，但不影响当前视图
        setTimeout(() => {
          songsService.fetchSongs().then(data => {
            songs.value = songsService.songs.value
          }).catch(err => {
            console.error('刷新歌曲列表失败', err)
          })
        }, 500)
      }
    } catch (apiErr) {
      // 处理API错误，显示通知而不是替换界面
      const errorMsg = apiErr.data?.message || apiErr.message || '投票失败'
      
      // 如果是已投票错误，显示特定通知
      if (errorMsg.includes('已经为这首歌投过票')) {
        showNotification(`您已经为歌曲《${song.title}》投过票了`, 'info')
      } else {
        showNotification(errorMsg, 'error')
      }
    }
  } catch (err) {
    // 这里处理其他非API错误
    showNotification(err.message || '投票失败', 'error')
  }
}

// 处理撤回投稿
const handleWithdraw = async (song) => {
  try {
    const result = await songsService.withdrawSong(song.id)
    if (result) {
      showNotification('歌曲已成功撤回！', 'success')
      await songsService.fetchSongs()
      songs.value = songsService.songs.value
    }
  } catch (err) {
    showNotification(err.message || '撤回失败', 'error')
  }
}

// 处理删除歌曲
const handleDelete = async (song) => {
  try {
    const result = await songsService.deleteSong(song.id)
    if (result) {
      showNotification('歌曲已成功删除！', 'success')
      await songsService.fetchSongs()
      songs.value = songsService.songs.value
    }
  } catch (err) {
    showNotification(err.message || '删除失败', 'error')
  }
}

// 处理标记为已播放
const handleMarkPlayed = async (song) => {
  try {
    const result = await songsService.markPlayed(song.id)
    if (result) {
      showNotification('歌曲已标记为已播放！', 'success')
      await songsService.fetchSongs()
      songs.value = songsService.songs.value
    }
  } catch (err) {
    showNotification(err.message || '操作失败', 'error')
  }
}

// 标记所有歌曲为已播放
const markAllAsPlayed = async () => {
  try {
    // 显示加载通知
    showNotification('正在标记所有歌曲为已播放...', 'info')
    
    // 先保存当前排期
    if (hasChanges.value) {
      await saveSequence()
    }
    
    // 获取当前日期的所有排期歌曲
    const todaySchedules = publicSchedules.value.filter(s => {
      if (!s.playDate) return false
      const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
      return scheduleDateStr === selectedDate.value
    })
    
    // 标记所有歌曲为已播放
    for (const schedule of todaySchedules) {
      if (schedule.song && !schedule.song.played) {
        try {
          await songsService.markPlayed(schedule.song.id)
        } catch (err) {
          console.error(`标记歌曲 ${schedule.song.title} 失败:`, err)
        }
      }
    }
    
    // 重新加载数据
    await songsService.fetchSongs()
    songs.value = songsService.songs.value
    
    // 显示成功通知
    showNotification('所有歌曲已标记为已播放', 'success')
  } catch (err) {
    // 显示错误通知
    showNotification('标记所有歌曲为已播放失败: ' + (err.message || '未知错误'), 'error')
  }
}

// 刷新歌曲列表
const refreshSongs = async () => {
  try {
    showNotification('正在刷新歌曲列表...', 'info')
    await songsService.fetchSongs()
    songs.value = songsService.songs.value
    showNotification('歌曲列表已刷新', 'success')
  } catch (err) {
    showNotification('刷新歌曲列表失败', 'error')
  }
}

// 处理撤回已播放状态
const handleUnmarkPlayed = async (song) => {
  try {
    const result = await songsService.unmarkPlayed(song.id)
    if (result) {
      showNotification('歌曲已成功撤回已播放状态！', 'success')
      await songsService.fetchSongs()
      songs.value = songsService.songs.value
    }
  } catch (err) {
    showNotification(err.message || '操作失败', 'error')
  }
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-link {
  text-decoration: none;
  color: var(--light);
  font-size: 1.5rem;
  font-weight: bold;
  transition: color 0.3s ease;
}

.logo-link:hover {
  color: var(--primary);
}

.logo {
  margin: 0;
  padding: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--light);
  transition: color 0.3s ease;
}

.logo:hover {
  color: var(--primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background-color: var(--danger);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background-color: #c0392b;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.dashboard-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  color: var(--gray);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.tab-btn:hover:not(.active) {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.tab-btn.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  font-weight: 600;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

.section {
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.section:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.section h2 {
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--light);
}

/* 排期管理样式 */
.schedule-manager {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 水平日期选择器 */
.date-selector-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  position: relative;
}

.date-selector {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  scroll-behavior: smooth;
  flex: 1;
  padding: 0.5rem 0;
}

.date-selector::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.date-btn {
  padding: 0.5rem 1rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  color: var(--gray);
  white-space: nowrap;
  margin-right: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 90px;
  text-align: center;
}

.date-btn:hover {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.date-btn.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  font-weight: 500;
}

.date-nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.date-nav-btn:hover:not([disabled]) {
  background: rgba(30, 41, 59, 0.8);
  transform: translateY(-1px);
}

.date-nav-btn[disabled] {
  opacity: 0.3;
  cursor: not-allowed;
}

.schedule-container {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  height: 500px; /* 保持一个足够的高度 */
}

.song-list-panel, .sequence-panel {
  background: rgba(15, 23, 42, 0.4);
  border-radius: 0.5rem;
  padding: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.song-list-panel h3, .sequence-panel h3 {
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.draggable-songs, .sequence-list {
  overflow-y: auto;
  flex: 1;
  padding: 0.75rem;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  min-height: 200px;
  transition: all 0.3s ease;
}

.draggable-songs:empty, .sequence-list:empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray);
  font-style: italic;
}

.sequence-list.drag-over, .draggable-songs.drag-over {
  background: rgba(99, 102, 241, 0.05);
  border-color: var(--primary);
  box-shadow: inset 0 0 10px rgba(99, 102, 241, 0.2);
}

.draggable-song {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
  cursor: grab;
  transition: all 0.2s ease;
  user-select: none;
  animation: fadeIn 0.3s ease-out;
  position: relative;
  z-index: 1;
}

.draggable-song:hover {
  transform: translateY(-2px);
  background: rgba(30, 41, 59, 0.8);
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.drag-handle {
  color: var(--gray);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
}

.drag-handle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--light);
}

.scheduled-song {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
  cursor: grab;
  transition: all 0.3s ease;
  user-select: none;
  animation: fadeIn 0.3s ease-out;
  position: relative;
  z-index: 1;
}

.scheduled-song:hover {
  transform: translateY(-2px);
  background: rgba(30, 41, 59, 0.8);
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.scheduled-song.drag-over {
  border: 2px dashed var(--primary);
  background: rgba(99, 102, 241, 0.1);
  transform: scale(1.02);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
  position: relative;
  animation: pulse 1s infinite;
}

.scheduled-song.drag-over::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid var(--primary);
  opacity: 0.8;
}

.scheduled-song.dragging {
  opacity: 0.5;
  transform: scale(1.05);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  background: rgba(99, 102, 241, 0.2);
  border: 1px dashed var(--primary);
}

.draggable-song.dragging {
  opacity: 0.5;
  transform: scale(1.05);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  background: rgba(99, 102, 241, 0.2);
  border: 1px dashed var(--primary);
}

.sequence-list .scheduled-song[draggable=true]:active {
  transform: scale(1.02);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  opacity: 0.8;
}

.sequence-list .scheduled-song:nth-child(even) {
  animation-duration: 0.4s;
}

/* 拖拽经过效果 */
.sequence-panel .scheduled-song {
  position: relative;
}

.sequence-list .scheduled-song:nth-child(n+1) {
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, background-color 0.3s ease;
}

/* 拖拽时的动画和样式 */
@keyframes wiggle {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.5); }
  50% { box-shadow: 0 0 15px rgba(99, 102, 241, 0.8); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); border-color: rgba(99, 102, 241, 0.5); }
  50% { transform: scale(1.02); border-color: rgba(99, 102, 241, 1); }
}

.sequence-list .scheduled-song:active {
  animation: wiggle 0.5s ease-in-out;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.draggable-song:active,
.scheduled-song:active {
  cursor: grabbing;
  animation: wiggle 0.5s ease-in-out;
}

.order-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 50%;
  margin-right: 0.75rem;
  font-weight: bold;
  color: var(--primary);
  transition: all 0.2s ease;
}

.scheduled-song-info {
  flex: 1;
}

.song-title {
  font-weight: 500;
  color: var(--light);
}

.song-artist {
  font-size: 0.875rem;
  color: var(--gray);
}

.song-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--gray);
  margin-top: 0.25rem;
}

.song-submitter {
  font-style: italic;
}

.song-stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--gray);
  margin-top: 0.25rem;
}

.votes-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--primary);
}

.time-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--gray);
}

.song-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.remove-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--danger);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  transform: scale(1.1);
}

.empty-message {
  padding: 2rem;
  text-align: center;
  color: var(--gray);
  font-style: italic;
}

.sequence-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.save-btn {
  padding: 0.5rem 1.5rem;
  background-color: var(--primary);
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.save-btn:hover:not([disabled]) {
  background-color: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
}

.save-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.mark-played-btn {
  padding: 0.5rem 1.5rem;
  background-color: var(--primary);
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mark-played-btn:hover:not([disabled]) {
  background-color: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
}

.mark-played-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 自定义通知样式 */
.notifications-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999; /* 使用极高的z-index值 */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 300px;
  pointer-events: none; /* 允许点击通知下方的元素 */
}

.notification {
  background: rgba(15, 23, 42, 0.98); /* 几乎不透明的背景 */
  border-left: 4px solid var(--primary);
  border-radius: 0.375rem;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1); /* 增强阴影 */
  transform: translateX(100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  pointer-events: auto; /* 恢复通知本身的点击事件 */
  isolation: isolate; /* 创建新的层叠上下文 */
  will-change: transform, opacity; /* 优化动画性能 */
}

.notification.visible {
  transform: translateX(0);
  opacity: 1;
}

.notification-icon {
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  font-size: 0.875rem;
  color: var(--light);
}

.notification-success {
  border-color: #10b981;
}

.notification-success .notification-icon {
  color: #10b981;
}

.notification-error {
  border-color: #ef4444;
}

.notification-error .notification-icon {
  color: #ef4444;
}

.notification-warning {
  border-color: #f59e0b;
}

.notification-warning .notification-icon {
  color: #f59e0b;
}

.notification-info {
  border-color: #3b82f6;
}

.notification-info .notification-icon {
  color: #3b82f6;
}

/* 通知动画 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.notification-enter-from,
.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 确认对话框样式 */
.confirm-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200; /* 确保低于通知的z-index */
  animation: fadeIn 0.2s ease-out;
}

.confirm-dialog {
  background: rgba(30, 41, 59, 0.95);
  border-radius: 0.5rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: dialogEnter 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

@keyframes dialogEnter {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.confirm-dialog-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-header h3 {
  margin: 0;
  color: var(--light);
  font-size: 1.25rem;
}

.confirm-dialog-content {
  padding: 1.5rem 1rem;
  color: var(--gray);
}

.confirm-dialog-actions {
  padding: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-dialog-cancel {
  background: rgba(30, 41, 59, 0.6);
  color: var(--gray);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-cancel:hover {
  background: rgba(30, 41, 59, 0.8);
}

.confirm-dialog-confirm {
  background: var(--primary);
  color: white;
  border: none;
}

.confirm-dialog-confirm:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
}

/* 排序选项样式 */
.sort-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 0 0.5rem;
}

.sort-options label {
  font-size: 0.875rem;
  color: var(--gray);
}

.sort-select {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  color: var(--light);
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.sort-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}

.sort-select option {
  background: rgba(15, 23, 42, 0.95);
  color: var(--light);
}

/* 响应式布局 */
@media (min-width: 768px) {
  .dashboard-content {
    grid-template-columns: 1fr 1fr;
  }
  
  .songs-section, .schedule-section, .users-section {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .dashboard {
    padding: 1rem;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .dashboard-tabs {
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }
  
  .schedule-container {
    grid-template-columns: 1fr;
    height: auto; /* 在移动端自动高度 */
    gap: 2rem; /* 增加垂直间距 */
  }

  .song-list-panel, .sequence-panel {
    min-height: 300px; /* 给拖拽区域一个最小高度 */
  }
  
  .notifications-container {
    width: 90%;
    right: 5%;
  }
}
</style> 