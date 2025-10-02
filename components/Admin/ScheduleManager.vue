<template>
  <div class="schedule-manager">
    <!-- 日期选择器 -->
    <div class="date-selector-container">
      <button
        class="date-nav-btn prev-btn"
        @click="scrollDates('left')"
        :disabled="isFirstDateVisible"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
      </button>
      
      <div ref="dateSelector" class="date-selector">
        <button
          v-for="date in availableDates"
          :key="date.value"
          :class="['date-btn', { active: selectedDate === date.value, today: date.isToday }]"
          @click="selectedDate = date.value"
        >
          <div class="date-day">{{ date.day }}</div>
          <div class="date-month">{{ date.month }}</div>
          <div class="date-weekday">{{ date.weekday }}</div>
        </button>
      </div>
      
      <button
        class="date-nav-btn next-btn"
        @click="scrollDates('right')"
        :disabled="isLastDateVisible"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9,18 15,12 9,6"/>
        </svg>
      </button>
      
      <!-- 手动日期选择器 -->
      <div class="manual-date-selector">
        <button class="manual-date-btn" @click="showManualDatePicker = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          选择日期
        </button>
      </div>
    </div>

    <!-- 手动日期选择弹窗 -->
    <div v-if="showManualDatePicker" class="manual-date-modal">
      <div class="manual-date-overlay" @click="showManualDatePicker = false"></div>
      <div class="manual-date-content">
        <div class="manual-date-header">
          <h3>选择日期</h3>
          <button class="close-btn" @click="showManualDatePicker = false">×</button>
        </div>
        <div class="manual-date-body">
          <input
            type="date"
            v-model="manualSelectedDate"
            class="manual-date-input"
          />
          <div class="manual-date-actions">
            <button class="cancel-btn" @click="showManualDatePicker = false">取消</button>
            <button class="confirm-btn" @click="confirmManualDate">确认</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 播出时段选择器 -->
    <div v-if="playTimeEnabled" class="playtime-selector-container">
      <div class="playtime-selector">
        <label class="playtime-label">播出时段：</label>
        <select v-model="selectedPlayTime" class="playtime-select">
          <option value="">未选择时段</option>
          <option
            v-for="playTime in playTimes"
            :key="playTime.id"
            :value="playTime.id"
          >
            {{ playTime.name }}
            <template v-if="playTime.startTime || playTime.endTime">
              ({{ formatPlayTimeRange(playTime) }})
            </template>
          </option>
        </select>
      </div>
    </div>

    <!-- 触控拖拽帮助提示 -->
    <div v-if="showTouchHint" class="touch-drag-hint show">
      {{ touchHintText }}
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">正在加载排期...</div>
    </div>

    <!-- 排期内容 -->
    <div v-else class="schedule-content">
      <!-- 待排歌曲列表 -->
      <div class="song-list-panel">
        <div class="panel-header">
          <h3>待排歌曲</h3>
          <div class="header-controls">
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
            <div class="semester-selector">
              <label class="semester-label">学期：</label>
              <select v-model="selectedSemester" @change="onSemesterChange" class="semester-select">
                <option
                  v-for="semester in availableSemesters"
                  :key="semester.id"
                  :value="semester.name"
                >
                  {{ semester.name }}
                </option>
              </select>
            </div>
            <div class="sort-options">
              <label>排序:</label>
              <select v-model="songSortOption" class="sort-select">
                <option value="time-desc">最新投稿</option>
                <option value="time-asc">最早投稿</option>
                <option value="votes-desc">热度最高</option>
                <option value="votes-asc">热度最低</option>
              </select>
            </div>
          </div>
        </div>

        <div
          :class="['draggable-songs', { 'drag-over': isDraggableOver }]"
          @dragover.prevent="handleDraggableDragOver"
          @dragenter.prevent="isDraggableOver = true"
          @dragleave="handleDraggableDragLeave"
          @drop.stop.prevent="handleReturnToDraggable"
        >
          <div
            v-for="song in filteredUnscheduledSongs"
            :key="song.id"
            class="draggable-song"
            draggable="true"
            @dragstart="dragStart($event, song)"
            @dragend="dragEnd"
            @touchstart="handleTouchStart($event, song, 'song')"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div class="song-info">
              <div class="song-main">
                <div class="song-title">{{ song.title }}</div>
                <div class="song-meta">
                  <span class="song-artist">{{ song.artist }}</span>
                </div>
                <div class="song-stats">
                  <span class="votes-count">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    {{ song.voteCount || 0 }}
                  </span>
                  <span class="time-info">{{ formatDate(song.createdAt) }}</span>
                </div>
              </div>
              <div class="song-side">
                <span class="song-submitter">投稿: {{ song.requester }}</span>
                <span
                  v-if="song.preferredPlayTimeId && getPlayTimeName(song.preferredPlayTimeId)"
                  class="preferred-playtime"
                >
                  期望时段: {{ getPlayTimeName(song.preferredPlayTimeId) }}
                </span>
              </div>
            </div>
            <div class="drag-handle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="8" cy="8" r="1.5"/>
                <circle cx="16" cy="8" r="1.5"/>
                <circle cx="8" cy="16" r="1.5"/>
                <circle cx="16" cy="16" r="1.5"/>
              </svg>
            </div>
          </div>
          
          <div v-if="filteredUnscheduledSongs.length === 0" class="empty-message">
            没有待排歌曲
          </div>
        </div>
        
        <!-- 分页控件 -->
        <div v-if="totalPages > 1" class="pagination-container">
          <div class="pagination-info">
            共 {{ allUnscheduledSongs.length }} 首歌曲，第 {{ currentPage }} / {{ totalPages }} 页
          </div>
          <div class="pagination-controls">
            <button 
              class="pagination-btn" 
              :disabled="currentPage === 1"
              @click="prevPage"
            >
              上一页
            </button>
            
            <div class="page-numbers">
              <button
                v-for="page in Math.min(5, totalPages)"
                :key="page"
                :class="['page-number', { active: page === currentPage }]"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
              
              <span v-if="totalPages > 5" class="page-ellipsis">...</span>
              
              <button
                v-if="totalPages > 5 && currentPage < totalPages - 2"
                :class="['page-number', { active: totalPages === currentPage }]"
                @click="goToPage(totalPages)"
              >
                {{ totalPages }}
              </button>
            </div>
            
            <button 
              class="pagination-btn" 
              :disabled="currentPage === totalPages"
              @click="nextPage"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <!-- 排期列表 -->
      <div class="sequence-panel">
        <div class="panel-header">
          <h3>播放顺序</h3>
          <div class="sequence-actions">
            <!-- 草稿保存按钮 -->
            <button 
              @click="saveDraft" 
              class="draft-btn" 
              :disabled="!hasChanges || localScheduledSongs.length === 0"
            >
              保存草稿
            </button>
            <!-- 发布按钮 -->
            <button 
              @click="publishSchedule" 
              class="publish-btn" 
              :disabled="!canPublish"
            >
              发布排期
            </button>
            <!-- 保存并发布 -->
            <button 
              @click="saveSequence" 
              class="save-btn" 
              :disabled="!hasChanges && localScheduledSongs.length > 0"
            >
              保存并发布
            </button>
            <button 
              @click="openDownloadDialog" 
              class="download-btn" 
              :disabled="localScheduledSongs.length === 0"
            >
              下载歌曲
            </button>
            <button 
              @click="markAllAsPlayed" 
              class="mark-played-btn" 
              :disabled="localScheduledSongs.length === 0"
            >
              全部已播放
            </button>
          </div>
        </div>

        <div
          ref="sequenceList"
          :class="['sequence-list', { 'drag-over': isSequenceOver }]"
          @dragover.prevent="handleDragOver"
          @dragenter.prevent="isSequenceOver = true"
          @dragleave="handleSequenceDragLeave"
          @drop.stop.prevent="dropToSequence"
        >
          <div v-if="localScheduledSongs.length === 0" class="empty-message">
            将歌曲拖到此处安排播放顺序
          </div>

          <TransitionGroup
            name="schedule-list"
            tag="div"
            class="schedule-transition-group"
          >
            <div
              v-for="(schedule, index) in localScheduledSongs"
              :key="schedule.id"
              :class="['scheduled-song', { 'drag-over': dragOverIndex === index, 'is-draft': schedule.isDraft }]"
              :data-schedule-id="schedule.id"
              draggable="true"
              @dragstart="dragScheduleStart($event, schedule)"
              @dragend="dragEnd"
              @dragover.prevent
              @dragenter.prevent="handleDragEnter($event, index)"
              @dragleave="handleDragLeave"
              @drop.stop.prevent="dropReorder($event, index)"
              @touchstart="handleTouchStart($event, schedule, 'schedule')"
              @touchmove="handleTouchMove"
              @touchend="handleTouchEnd"
            >
            <div class="order-number">{{ index + 1 }}</div>
            <div class="scheduled-song-info">
              <div class="song-main">
                <div class="song-title">
                  {{ schedule.song.title }}
                  <span v-if="schedule.isDraft" class="draft-badge">草稿</span>
                </div>
                <div class="song-artist">{{ schedule.song.artist }}</div>
                <div class="song-requester">投稿人: {{ schedule.song.requester }}</div>
              </div>
            </div>
            <div class="song-actions">
              <!-- 草稿状态显示发布按钮 -->
              <button 
                v-if="schedule.isDraft" 
                @click="publishSingleDraft(schedule)" 
                class="publish-single-btn"
                title="发布此草稿"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21 5,3"/>
                </svg>
              </button>
              <div class="drag-handle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="8" cy="8" r="1.5"/>
                  <circle cx="16" cy="8" r="1.5"/>
                  <circle cx="8" cy="16" r="1.5"/>
                  <circle cx="16" cy="16" r="1.5"/>
                </svg>
              </div>
            </div>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>

  <!-- 确认对话框 -->
  <ConfirmDialog
    :show="showConfirmDialog"
    :title="confirmDialogTitle"
    :message="confirmDialogMessage"
    :type="confirmDialogType"
    :confirm-text="confirmDialogConfirmText"
    cancel-text="取消"
    :loading="loading"
    @confirm="handleConfirm"
    @close="showConfirmDialog = false"
  />

  <!-- 下载对话框 -->
  <SongDownloadDialog
    :show="showDownloadDialog"
    :songs="localScheduledSongs"
    @close="showDownloadDialog = false"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import SongDownloadDialog from './SongDownloadDialog.vue'
import ConfirmDialog from '../UI/ConfirmDialog.vue'

// 响应式数据
const selectedDate = ref(new Date().toISOString().split('T')[0])
const loading = ref(false)
const songSortOption = ref('votes-desc')
const hasChanges = ref(false)
const searchQuery = ref('')

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogType = ref('warning')
const confirmDialogConfirmText = ref('确认')
const confirmAction = ref(null)

// 下载相关
const showDownloadDialog = ref(false)

// 拖拽状态
const isDraggableOver = ref(false)
const isSequenceOver = ref(false)
const dragOverIndex = ref(-1)
const draggedSchedule = ref(null)

// 触摸拖拽状态
const touchDragData = ref(null)
const touchStartPos = ref({ x: 0, y: 0 })
const touchCurrentPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const isLongPressing = ref(false)
const dragElement = ref(null)
const longPressTimer = ref(null)
const touchStartTime = ref(0)

// 触控拖拽配置
const TOUCH_CONFIG = {
  LONG_PRESS_DURATION: 500, // 长按识别时间（毫秒）
  DRAG_THRESHOLD: 15, // 拖拽触发阈值（像素）
  VIBRATION_DURATION: 50, // 震动时长（毫秒）
  SCROLL_THRESHOLD: 10 // 滚动阈值（像素）
}

// 触控帮助提示
const showTouchHint = ref(false)
const touchHintText = ref('')
const touchHintTimer = ref(null)

// DOM引用
const dateSelector = ref(null)
const sequenceList = ref(null)

// 滚动状态
const isFirstDateVisible = ref(true)
const isLastDateVisible = ref(true)

// 数据
const songs = ref([])
const publicSchedules = ref([])
const localScheduledSongs = ref([])
const scheduledSongIds = ref(new Set())

// 计算是否有未发布的草稿
const hasUnpublishedDrafts = computed(() => {
  return localScheduledSongs.value.some(schedule => schedule.isDraft)
})

// 计算是否有变化或有未发布的草稿
const canPublish = computed(() => {
  return (hasChanges.value && localScheduledSongs.value.length > 0) || hasUnpublishedDrafts.value
})

// 草稿相关数据
const drafts = ref([])
const isDraftMode = ref(false)

// 播出时段相关
const playTimes = ref([])
const playTimeEnabled = ref(false)
const selectedPlayTime = ref('')

// 学期相关
const availableSemesters = ref([])
const selectedSemester = ref('')

// 手动日期选择
const showManualDatePicker = ref(false)
const manualSelectedDate = ref('')

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)

// 服务
let songsService = null
let adminService = null
let auth = null
let semesterService = null

// 生成日期列表（固定14天）
const availableDates = computed(() => {
  const dates = []
  const today = new Date()

  // 生成前7天到后7天的日期
  for (let i = -7; i <= 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    const dateStr = date.toISOString().split('T')[0]
    const isToday = i === 0
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]

    dates.push({
      value: dateStr,
      day: date.getDate().toString().padStart(2, '0'),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      weekday,
      isToday
    })
  }

  return dates
})

// 过滤未排期歌曲（所有）
const allUnscheduledSongs = computed(() => {
  if (!songs.value) return []
  
  let unscheduledSongs = songs.value.filter(song =>
    !song.played && !scheduledSongIds.value.has(song.id)
  )
  
  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    unscheduledSongs = unscheduledSongs.filter(song => {
      const title = (song.title || '').toLowerCase()
      const artist = (song.artist || '').toLowerCase()
      const requester = (song.requester || '').toLowerCase()
      
      return title.includes(query) || 
             artist.includes(query) || 
             requester.includes(query)
    })
  }
  
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
        return 0
    }
  })
})

// 分页后的未排期歌曲
const filteredUnscheduledSongs = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  return allUnscheduledSongs.value.slice(startIndex, endIndex)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(allUnscheduledSongs.value.length / pageSize.value)
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

// 处理日期选择器滚轮事件
const handleDateSelectorWheel = (event) => {
  event.preventDefault()

  const scrollAmount = 200
  const currentScroll = dateSelector.value.scrollLeft

  if (event.deltaY > 0) {
    // 向下滚动，向右移动
    dateSelector.value.scrollTo({
      left: currentScroll + scrollAmount,
      behavior: 'smooth'
    })
  } else {
    // 向上滚动，向左移动
    dateSelector.value.scrollTo({
      left: currentScroll - scrollAmount,
      behavior: 'smooth'
    })
  }

  setTimeout(() => {
    updateScrollButtonState()
  }, 300)
}

// 初始化
onMounted(async () => {
  songsService = useSongs()
  adminService = useAdmin()
  auth = useAuth()
  semesterService = useSemesters()

  // 先加载学期数据，然后加载其他数据
  await loadSemesters()
  await loadData()

  // 添加事件监听器
  nextTick(() => {
    if (dateSelector.value) {
      dateSelector.value.addEventListener('wheel', handleDateSelectorWheel, { passive: false })
    }
    updateScrollButtonState()
  })
})

// 清理事件监听器
onUnmounted(() => {
  if (dateSelector.value) {
    dateSelector.value.removeEventListener('wheel', handleDateSelectorWheel)
  }
})

// 确认手动日期选择
const confirmManualDate = () => {
  if (manualSelectedDate.value) {
    selectedDate.value = manualSelectedDate.value
    showManualDatePicker.value = false
  }
}

// 分页控制方法
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// 监听日期变化
watch(selectedDate, async () => {
  await loadData()
})

// 监听排序选项变化，重置分页
watch(songSortOption, () => {
  currentPage.value = 1
})

// 监听搜索查询变化，重置分页
watch(searchQuery, () => {
  currentPage.value = 1
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    // 使用选中的学期过滤歌曲，如果选择"全部"则不传递学期参数
    const semester = selectedSemester.value === '全部' ? undefined : selectedSemester.value
    
    // 并行加载数据
    await Promise.all([
      songsService.fetchSongs(false, semester, false, true),
      songsService.fetchPublicSchedules(false, semester, false, true),
      loadPlayTimes(),
      loadDrafts() // 加载草稿列表
    ])

    songs.value = songsService.songs.value
    publicSchedules.value = songsService.publicSchedules.value

    // 在草稿加载完成后再更新本地排期数据
    updateLocalScheduledSongs()
    hasChanges.value = false
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载播出时段
const loadPlayTimes = async () => {
  try {
    const response = await $fetch('/api/play-times')
    playTimeEnabled.value = response.enabled
    playTimes.value = response.playTimes || []
  } catch (error) {
    console.error('加载播出时段失败:', error)
    playTimeEnabled.value = false
    playTimes.value = []
  }
}

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  const start = playTime.startTime || '00:00'
  const end = playTime.endTime || '23:59'

  if (playTime.startTime && playTime.endTime) {
    return `${start} - ${end}`
  } else if (playTime.startTime) {
    return `${start} 开始`
  } else if (playTime.endTime) {
    return `${end} 结束`
  }

  return '全天'
}

// 获取播出时段名称
const getPlayTimeName = (playTimeId) => {
  if (!playTimeId || !playTimes.value) return ''
  const playTime = playTimes.value.find(pt => pt.id === playTimeId)
  return playTime ? playTime.name : ''
}

// 加载学期列表
const loadSemesters = async () => {
  try {
    await semesterService.fetchSemesters()
    await semesterService.fetchCurrentSemester()
    
    // 构建学期列表，包含"全部"选项和各个学期
    const semesterList = [
      { id: 'all', name: '全部', isCurrent: false }
    ]
    
    // 添加当前学期（如果存在）
    if (semesterService.currentSemester.value) {
      semesterList.push({
        id: semesterService.currentSemester.value.id || 'current',
        name: semesterService.currentSemester.value.name,
        isCurrent: true
      })
    }
    
    // 添加其他学期
    if (semesterService.semesters.value) {
      semesterService.semesters.value.forEach(semester => {
        if (!semesterService.currentSemester.value || semester.name !== semesterService.currentSemester.value.name) {
          semesterList.push({
            id: semester.id,
            name: semester.name,
            isCurrent: false
          })
        }
      })
    }
    
    availableSemesters.value = semesterList
    
    // 默认选择当前学期（如果存在），否则选择"全部"
    if (semesterService.currentSemester.value) {
      selectedSemester.value = semesterService.currentSemester.value.name
    } else if (semesterList.length > 0) {
      selectedSemester.value = semesterList[0].name
    }
  } catch (error) {
    console.error('获取学期列表失败:', error)
  }
}

// 学期切换处理
const onSemesterChange = async () => {
  // 学期切换后重新加载数据
  await loadData()
}

// 更新本地排期数据（包括草稿）
const updateLocalScheduledSongs = () => {
  console.log('更新本地排期数据 - 当前日期:', selectedDate.value)
  console.log('公开排期数量:', publicSchedules.value.length)
  console.log('草稿数量:', drafts.value.length)
  
  // 获取已发布的排期
  let todaySchedules = publicSchedules.value.filter(s => {
    if (!s.playDate) return false
    const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
    return scheduleDateStr === selectedDate.value
  })

  // 获取草稿排期
  let todayDrafts = drafts.value.filter(draft => {
    if (!draft.playDate) return false
    const draftDateStr = new Date(draft.playDate).toISOString().split('T')[0]
    return draftDateStr === selectedDate.value
  })
  
  console.log('当天已发布排期:', todaySchedules.length)
  console.log('当天草稿排期:', todayDrafts.length)

  // 合并已发布和草稿排期
  let allSchedules = [...todaySchedules, ...todayDrafts]

  // 如果选择了特定播出时段，进行过滤
  if (selectedPlayTime.value) {
    allSchedules = allSchedules.filter(s =>
      s.playTimeId === parseInt(selectedPlayTime.value)
    )
  }

  // 按 sequence 字段排序
  allSchedules.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))

  localScheduledSongs.value = allSchedules.map(s => ({ ...s }))
  
  console.log('最终显示排期数量:', localScheduledSongs.value.length)

  // 更新已排期歌曲ID集合（包括草稿）
  scheduledSongIds.value = new Set(
    [...publicSchedules.value, ...drafts.value]
      .filter(s => s.song && s.song.id)
      .map(s => s.song.id)
  )
}

// 监听播出时段选择变化
watch(selectedPlayTime, () => {
  updateLocalScheduledSongs()
})

// 拖拽方法
const dragStart = (event, song) => {
  event.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'add-to-schedule',
    songId: song.id
  }))

  setTimeout(() => {
    event.target.classList.add('dragging')
  }, 0)
}

const dragScheduleStart = (event, schedule) => {
  event.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'reorder-schedule',
    scheduleId: schedule.id
  }))

  draggedSchedule.value = { ...schedule }

  setTimeout(() => {
    event.target.classList.add('dragging')
  }, 0)
}

const dragEnd = (event) => {
  event.target.classList.remove('dragging')
  dragOverIndex.value = -1
  isSequenceOver.value = false
  isDraggableOver.value = false
}

const handleDragOver = (event) => {
  event.preventDefault()
  isSequenceOver.value = true
}

const handleDragEnter = (event, index) => {
  dragOverIndex.value = index
}

const handleDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    dragOverIndex.value = -1
  }
}

const handleSequenceDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    isSequenceOver.value = false
  }
}

const handleDraggableDragOver = (event) => {
  event.preventDefault()
  isDraggableOver.value = true
}

const handleDraggableDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    isDraggableOver.value = false
  }
}

const dropToSequence = async (event) => {
  event.preventDefault()
  dragOverIndex.value = -1
  isSequenceOver.value = false

  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return

    const dragData = JSON.parse(data)

    if (dragData.type === 'add-to-schedule') {
      const songId = parseInt(dragData.songId)
      const song = songs.value.find(s => s.id === songId)
      if (!song) return

      const existingIndex = localScheduledSongs.value.findIndex(s => s.song.id === songId)
      if (existingIndex !== -1) return

      const newSchedule = {
        id: Date.now(),
        song: song,
        playDate: selectedDate.value, // 直接使用日期字符串
        sequence: localScheduledSongs.value.length + 1,
        isNew: true,
        isLocalOnly: true
      }

      scheduledSongIds.value.add(songId)
      localScheduledSongs.value.push(newSchedule)
      hasChanges.value = true
    }
  } catch (err) {
    console.error('处理拖放失败:', err)
  }
}

const dropReorder = async (event, dropIndex) => {
  event.preventDefault()
  dragOverIndex.value = -1

  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return

    const dragData = JSON.parse(data)

    if (dragData.type === 'reorder-schedule' && draggedSchedule.value) {
      const scheduleId = parseInt(dragData.scheduleId)
      const draggedIndex = localScheduledSongs.value.findIndex(s => s.id === scheduleId)

      if (draggedIndex === -1 || draggedIndex === dropIndex) return

      const newOrder = [...localScheduledSongs.value]
      const [draggedItem] = newOrder.splice(draggedIndex, 1)
      newOrder.splice(dropIndex, 0, draggedItem)

      newOrder.forEach((item, index) => {
        item.sequence = index + 1
      })

      localScheduledSongs.value = newOrder
      hasChanges.value = true
    } else if (dragData.type === 'add-to-schedule') {
      // 处理从左侧拖到特定位置
      const songId = parseInt(dragData.songId)
      const song = songs.value.find(s => s.id === songId)
      if (!song) return

      const existingIndex = localScheduledSongs.value.findIndex(s => s.song.id === songId)
      if (existingIndex !== -1) return

      const newSchedule = {
        id: Date.now(),
        song: song,
        playDate: selectedDate.value, // 直接使用日期字符串
        sequence: dropIndex + 1,
        isNew: true
      }

      scheduledSongIds.value.add(songId)

      const newOrder = [...localScheduledSongs.value]
      newOrder.splice(dropIndex, 0, newSchedule)

      newOrder.forEach((item, index) => {
        item.sequence = index + 1
      })

      localScheduledSongs.value = newOrder
      hasChanges.value = true
    }
  } catch (err) {
    console.error('处理重排序失败:', err)
  }

  draggedSchedule.value = null
}

// 草稿相关方法

// 加载草稿列表（使用新的综合API）
const loadDrafts = async () => {
  try {
    const response = await $fetch('/api/admin/schedule/full', {
      ...auth.getAuthConfig(),
      query: {
        includeDrafts: 'only'  // 只获取草稿
      }
    })
    
    drafts.value = response.data?.schedules || []
    console.log('加载草稿列表:', drafts.value.length)
  } catch (error) {
    console.error('加载草稿列表失败:', error)
    // 如果加载失败，设置为空数组避免错误
    drafts.value = []
  }
}

// 加载完整的排期数据（包括草稿）
const loadFullScheduleData = async (date = null, playTimeId = null, includeDrafts = 'true') => {
  try {
    const query = {}
    if (date) query.date = date
    if (playTimeId) query.playTimeId = playTimeId
    query.includeDrafts = includeDrafts
    
    const response = await $fetch('/api/admin/schedule/full', {
      ...auth.getAuthConfig(),
      query
    })
    
    return response.data || { schedules: [], summary: {} }
  } catch (error) {
    console.error('加载完整排期数据失败:', error)
    return { schedules: [], summary: {} }
  }
}

// 刷新草稿列表
const refreshDrafts = async () => {
  await loadDrafts()
  updateLocalScheduledSongs() // 更新播放顺序列表
}

// 保存草稿（无需确认）
const saveDraft = async () => {
  loading.value = true
  
  try {
    // 删除当天指定播出时段的所有排期和草稿
    const existingSchedules = [...publicSchedules.value, ...drafts.value].filter(s => {
      if (!s.playDate) return false
      const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
      const isTargetDate = scheduleDateStr === selectedDate.value
      
      if (selectedPlayTime.value) {
        return isTargetDate && s.playTimeId === parseInt(selectedPlayTime.value)
      }
      return isTargetDate
    })
    
    // 删除现有的排期和草稿
    for (const schedule of existingSchedules) {
      try {
        await $fetch(`/api/admin/schedule/remove`, {
          method: 'POST',
          body: { scheduleId: schedule.id },
          ...auth.getAuthConfig()
        })
      } catch (deleteError) {
        console.warn('删除排期失败:', deleteError)
      }
    }
    
    // 如果有歌曲，创建草稿排期
    if (localScheduledSongs.value.length > 0) {
      for (let i = 0; i < localScheduledSongs.value.length; i++) {
        const song = localScheduledSongs.value[i]
        
        try {
          await $fetch('/api/admin/schedule/draft', {
            method: 'POST',
            body: {
              songId: song.song.id,
              playDate: selectedDate.value, // 直接传递日期字符串
              sequence: i + 1,
              playTimeId: selectedPlayTime.value ? parseInt(selectedPlayTime.value) : null
            },
            ...auth.getAuthConfig()
          })
        } catch (error) {
          console.error(`创建草稿排期失败 (歌曲: ${song.song.title}):`, error)
          throw error
        }
      }
    }
    
    hasChanges.value = false
    await loadData() // 重新加载数据
    
    // 确保草稿显示在播放顺序中
    updateLocalScheduledSongs()
    
    if (window.$showNotification) {
      if (localScheduledSongs.value.length > 0) {
        window.$showNotification('排期草稿保存成功！', 'success')
      } else {
        window.$showNotification('所有草稿已删除！', 'success')
      }
    }
  } catch (error) {
    console.error('保存草稿失败:', error)
    if (window.$showNotification) {
      window.$showNotification('保存草稿失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 发布排期（需要确认）
const publishSchedule = async () => {
  if (localScheduledSongs.value.length === 0) return
  
  try {
    confirmDialogTitle.value = '发布排期'
    confirmDialogMessage.value = '确定要发布当前排期吗？发布后将立即公示并发送通知。'
    confirmDialogType.value = 'warning'
    confirmDialogConfirmText.value = '发布排期'
    confirmAction.value = async () => {
      await publishScheduleConfirmed()
    }
    showConfirmDialog.value = true
  } catch (error) {
    console.error('发布排期失败:', error)
  }
}

// 确认发布排期
const publishScheduleConfirmed = async () => {
  loading.value = true
  
  try {
    // 删除当天指定播出时段的所有排期和草稿
    const existingSchedules = [...publicSchedules.value, ...drafts.value].filter(s => {
      if (!s.playDate) return false
      const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
      const isTargetDate = scheduleDateStr === selectedDate.value
      
      if (selectedPlayTime.value) {
        return isTargetDate && s.playTimeId === parseInt(selectedPlayTime.value)
      }
      return isTargetDate
    })
    
    // 删除现有的排期和草稿
    for (const schedule of existingSchedules) {
      try {
        await $fetch(`/api/admin/schedule/remove`, {
          method: 'POST',
          body: { scheduleId: schedule.id },
          ...auth.getAuthConfig()
        })
      } catch (deleteError) {
        console.warn('删除排期失败:', deleteError)
      }
    }
    
    // 直接发布排期（不是草稿）
    for (let i = 0; i < localScheduledSongs.value.length; i++) {
      const song = localScheduledSongs.value[i]
      
      try {
        await $fetch('/api/admin/schedule', {
          method: 'POST',
          body: {
            songId: song.song.id,
            playDate: selectedDate.value, // 直接传递日期字符串
            sequence: i + 1,
            playTimeId: selectedPlayTime.value ? parseInt(selectedPlayTime.value) : null,
            isDraft: false // 直接发布
          },
          ...auth.getAuthConfig()
        })
      } catch (error) {
        console.error(`发布排期失败 (歌曲: ${song.song.title}):`, error)
        throw error
      }
    }
    
    hasChanges.value = false
    await loadData() // 重新加载数据
    
    // 确保界面更新
    updateLocalScheduledSongs()
    
    if (window.$showNotification) {
      window.$showNotification('排期发布成功，通知已发送！', 'success')
    }
  } catch (error) {
    console.error('发布排期失败:', error)
    if (window.$showNotification) {
      window.$showNotification('发布排期失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 发布单个草稿（需要确认）
const publishSingleDraft = async (draft) => {
  try {
    confirmDialogTitle.value = '发布草稿'
    confirmDialogMessage.value = `确定要发布草稿《${draft.song.title}》吗？发布后将立即公示并发送通知。`
    confirmDialogType.value = 'warning'
    confirmDialogConfirmText.value = '发布'
    confirmAction.value = async () => {
      await publishSingleDraftConfirmed(draft)
    }
    showConfirmDialog.value = true
  } catch (error) {
    console.error('发布单个草稿失败:', error)
  }
}

// 确认发布单个草稿
const publishSingleDraftConfirmed = async (draft) => {
  loading.value = true
  
  try {
    await $fetch('/api/admin/schedule/publish', {
      method: 'POST',
      body: { scheduleId: draft.id },
      ...auth.getAuthConfig()
    })
    
    await loadData() // 重新加载数据
    
    // 确保界面更新
    updateLocalScheduledSongs()
    
    if (window.$showNotification) {
      window.$showNotification(`草稿《${draft.song.title}》发布成功，通知已发送！`, 'success')
    }
  } catch (error) {
    console.error('发布单个草稿失败:', error)
    if (window.$showNotification) {
      window.$showNotification('发布草稿失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 发布草稿
const publishDraft = async (draft) => {
  try {
    confirmDialogTitle.value = '发布草稿'
    confirmDialogMessage.value = `确定要发布草稿《${draft.song.title}》吗？发布后将立即公示并发送通知。`
    confirmDialogType.value = 'warning'
    confirmDialogConfirmText.value = '发布'
    confirmAction.value = async () => {
      await publishDraftConfirmed(draft)
    }
    showConfirmDialog.value = true
  } catch (error) {
    console.error('发布草稿失败:', error)
  }
}

// 确认发布草稿
const publishDraftConfirmed = async (draft) => {
  loading.value = true
  
  try {
    await $fetch('/api/admin/schedule/publish', {
      method: 'POST',
      body: { scheduleId: draft.id },
      ...auth.getAuthConfig()
    })
    
    await loadData() // 重新加载数据
    await loadDrafts() // 刷新草稿列表
    
    if (window.$showNotification) {
      window.$showNotification(`草稿《${draft.song.title}》发布成功，通知已发送！`, 'success')
    }
  } catch (error) {
    console.error('发布草稿失败:', error)
    if (window.$showNotification) {
      window.$showNotification('发布草稿失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 删除草稿
const deleteDraft = async (draft) => {
  try {
    confirmDialogTitle.value = '删除草稿'
    confirmDialogMessage.value = `确定要删除草稿《${draft.song.title}》吗？此操作不可恢复。`
    confirmDialogType.value = 'danger'
    confirmDialogConfirmText.value = '删除'
    confirmAction.value = async () => {
      await deleteDraftConfirmed(draft)
    }
    showConfirmDialog.value = true
  } catch (error) {
    console.error('删除草稿失败:', error)
  }
}

// 确认删除草稿
const deleteDraftConfirmed = async (draft) => {
  loading.value = true
  
  try {
    await $fetch('/api/admin/schedule/remove', {
      method: 'POST',
      body: { scheduleId: draft.id },
      ...auth.getAuthConfig()
    })
    
    await loadDrafts() // 刷新草稿列表
    
    if (window.$showNotification) {
      window.$showNotification(`草稿《${draft.song.title}》已删除`, 'success')
    }
  } catch (error) {
    console.error('删除草稿失败:', error) 
    if (window.$showNotification) {
      window.$showNotification('删除草稿失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 触摸拖拽方法
const handleTouchStart = (event, item, type) => {
  if (window.innerWidth > 768) return // 只在移动端启用触摸拖拽

  const touch = event.touches[0]
  touchStartPos.value = { x: touch.clientX, y: touch.clientY }
  touchCurrentPos.value = { x: touch.clientX, y: touch.clientY }
  touchStartTime.value = Date.now()
  touchDragData.value = { item, type }
  
  // 重置状态
  isDragging.value = false
  isLongPressing.value = false
  
  // 清除之前的长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
  }
  
  // 设置长按识别定时器
  longPressTimer.value = setTimeout(() => {
    if (!isDragging.value && touchDragData.value) {
      isLongPressing.value = true
      
      // 触发震动反馈（如果设备支持）
      if (navigator.vibrate) {
        navigator.vibrate(TOUCH_CONFIG.VIBRATION_DURATION)
      }
      
      // 显示长按提示
      showTouchDragHint('已识别长按，现在可以拖拽歌曲', 2000)
      
      // 添加长按视觉反馈
      const target = event.target.closest('.draggable-song, .scheduled-song')
      if (target) {
        target.classList.add('long-pressing')
        dragElement.value = target
      }
    }
  }, TOUCH_CONFIG.LONG_PRESS_DURATION)
  
  // 只在必要时防止默认行为
  // event.preventDefault()
}

const handleTouchMove = (event) => {
  if (!touchDragData.value || window.innerWidth > 768) return

  const touch = event.touches[0]
  touchCurrentPos.value = { x: touch.clientX, y: touch.clientY }
  
  const deltaX = Math.abs(touch.clientX - touchStartPos.value.x)
  const deltaY = Math.abs(touch.clientY - touchStartPos.value.y)
  const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  // 如果移动距离较小，可能是滚动操作，不触发拖拽
  if (totalDelta < TOUCH_CONFIG.SCROLL_THRESHOLD) {
    return
  }
  
  // 清除长按定时器（用户开始移动）
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // 只有在长按识别后或移动距离超过阈值时才开始拖拽
  if (!isDragging.value && (isLongPressing.value || totalDelta > TOUCH_CONFIG.DRAG_THRESHOLD)) {
    isDragging.value = true

    // 显示拖拽提示
    showTouchDragHint('正在拖拽，移动到目标位置后松开', 2000)

    // 创建拖拽元素
    const target = event.target.closest('.draggable-song, .scheduled-song')
    if (target) {
      target.classList.remove('long-pressing')
      target.classList.add('dragging', 'touch-dragging')
      dragElement.value = target
      
      // 触发拖拽开始震动
      if (navigator.vibrate) {
        navigator.vibrate(TOUCH_CONFIG.VIBRATION_DURATION)
      }
    }
  }
  
  // 更新拖拽位置指示
  if (isDragging.value) {
    updateDragPosition(touch.clientX, touch.clientY)
    event.preventDefault()
  }
}

// 更新拖拽位置指示
const updateDragPosition = (x, y) => {
  const elementBelow = document.elementFromPoint(x, y)
  if (!elementBelow) return
  
  // 清除之前的高亮
  document.querySelectorAll('.drag-target-highlight').forEach(el => {
    el.classList.remove('drag-target-highlight')
  })
  
  // 高亮当前目标区域
  const sequenceList = elementBelow.closest('.sequence-list')
  const scheduledSong = elementBelow.closest('.scheduled-song')
  const draggableSongs = elementBelow.closest('.draggable-songs')
  
  if (sequenceList) {
    sequenceList.classList.add('drag-target-highlight')
  } else if (scheduledSong) {
    scheduledSong.classList.add('drag-target-highlight')
  } else if (draggableSongs) {
    draggableSongs.classList.add('drag-target-highlight')
  }
}

// 清除拖拽位置指示
const clearDragPosition = () => {
  document.querySelectorAll('.drag-target-highlight').forEach(el => {
    el.classList.remove('drag-target-highlight')
  })
}

// 清理触控拖拽状态
const cleanupTouchDrag = () => {
  if (dragElement.value) {
    dragElement.value.classList.remove('dragging', 'touch-dragging', 'long-pressing')
    dragElement.value = null
  }
  
  // 重置状态
  isDragging.value = false
  isLongPressing.value = false
  touchDragData.value = null
  dragOverIndex.value = -1
  isSequenceOver.value = false
  isDraggableOver.value = false
  
  // 清除位置指示
  clearDragPosition()
}

// 显示触控帮助提示
const showTouchDragHint = (message, duration = 3000) => {
  if (window.innerWidth > 768) return // 只在移动端显示
  
  touchHintText.value = message
  showTouchHint.value = true
  
  // 清除之前的定时器
  if (touchHintTimer.value) {
    clearTimeout(touchHintTimer.value)
  }
  
  // 设置自动隐藏
  touchHintTimer.value = setTimeout(() => {
    showTouchHint.value = false
  }, duration)
}

// 隐藏触控帮助提示
const hideTouchDragHint = () => {
  showTouchHint.value = false
  if (touchHintTimer.value) {
    clearTimeout(touchHintTimer.value)
    touchHintTimer.value = null
  }
}

const handleTouchEnd = (event) => {
  if (!touchDragData.value || window.innerWidth > 768) return

  // 清除长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  if (isDragging.value) {
    const touch = event.changedTouches[0]
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)

    if (elementBelow) {
      // 检查是否拖拽到序列列表
      const sequenceList = elementBelow.closest('.sequence-list')
      const scheduledSong = elementBelow.closest('.scheduled-song')
      const draggableSongs = elementBelow.closest('.draggable-songs')

      if (touchDragData.value.type === 'song' && sequenceList) {
        // 从左侧拖拽到右侧
        handleTouchDropToSequence(scheduledSong)
        // 成功拖拽震动反馈
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
      } else if (touchDragData.value.type === 'schedule' && scheduledSong) {
        // 在右侧重新排序
        handleTouchReorder(scheduledSong)
        // 成功拖拽震动反馈
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
      } else if (touchDragData.value.type === 'schedule' && draggableSongs) {
        // 从右侧拖拽回左侧
        handleTouchReturnToDraggable()
        // 成功拖拽震动反馈
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
      }
    }
  }

  // 清理拖拽状态
  cleanupTouchDrag()
}

const handleTouchDropToSequence = async (targetElement) => {
  const song = touchDragData.value.item
  const existingIndex = localScheduledSongs.value.findIndex(s => s.song.id === song.id)
  if (existingIndex !== -1) return

  let insertIndex = localScheduledSongs.value.length

  if (targetElement) {
    const scheduleId = parseInt(targetElement.dataset.scheduleId)
    const targetIndex = localScheduledSongs.value.findIndex(s => s.id === scheduleId)
    if (targetIndex !== -1) {
      insertIndex = targetIndex
    }
  }

  try {
    const response = await $fetch('/api/admin/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      ...useAuth().getAuthConfig(),
      body: JSON.stringify({
        songId: song.id,
        date: selectedDate.value,
        playTimeId: selectedPlayTime.value || null,
        sequence: insertIndex + 1
      })
    })

    localScheduledSongs.value.splice(insertIndex, 0, response)
    updateSequenceNumbers()
    hasChanges.value = true
  } catch (error) {
    console.error('添加排期失败:', error)
  }
}

const handleTouchReorder = async (targetElement) => {
  const draggedSchedule = touchDragData.value.item
  const scheduleId = parseInt(targetElement.dataset.scheduleId)
  const draggedIndex = localScheduledSongs.value.findIndex(s => s.id === draggedSchedule.id)
  const dropIndex = localScheduledSongs.value.findIndex(s => s.id === scheduleId)

  if (draggedIndex === -1 || dropIndex === -1 || draggedIndex === dropIndex) return

  const newOrder = [...localScheduledSongs.value]
  const [draggedItem] = newOrder.splice(draggedIndex, 1)
  newOrder.splice(dropIndex, 0, draggedItem)

  newOrder.forEach((item, index) => {
    item.sequence = index + 1
  })

  localScheduledSongs.value = newOrder
  hasChanges.value = true
}

const handleTouchReturnToDraggable = async () => {
  const schedule = touchDragData.value.item
  const scheduleIndex = localScheduledSongs.value.findIndex(s => s.id === schedule.id)
  if (scheduleIndex === -1) return

  try {
    await $fetch(`/api/admin/schedule/${schedule.id}`, {
      method: 'DELETE',
      ...useAuth().getAuthConfig()
    })

    localScheduledSongs.value.splice(scheduleIndex, 1)
    updateSequenceNumbers()
    hasChanges.value = true
  } catch (error) {
    console.error('删除排期失败:', error)
  }
}

const handleReturnToDraggable = async (event) => {
  event.preventDefault()
  isDraggableOver.value = false

  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return

    const dragData = JSON.parse(data)

    if (dragData.type === 'reorder-schedule') {
      const scheduleId = parseInt(dragData.scheduleId)
      const scheduleIndex = localScheduledSongs.value.findIndex(s => s.id === scheduleId)
      if (scheduleIndex === -1) return

      const schedule = localScheduledSongs.value[scheduleIndex]

      scheduledSongIds.value.delete(schedule.song.id)
      localScheduledSongs.value.splice(scheduleIndex, 1)

      localScheduledSongs.value.forEach((item, idx) => {
        item.sequence = idx + 1
      })

      hasChanges.value = true
    }
  } catch (err) {
    console.error('处理返回失败:', err)
  }
}



const saveSequence = async () => {
  try {
    loading.value = true

    // 删除当天指定播出时段的所有排期
    const existingSchedules = publicSchedules.value.filter(s => {
      if (!s.playDate) return false
      const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
      const matchesDate = scheduleDateStr === selectedDate.value

      // 如果选择了特定播出时段，只删除该时段的排期
      if (selectedPlayTime.value) {
        return matchesDate && s.playTimeId === parseInt(selectedPlayTime.value)
      }

      // 如果没有选择播出时段，删除所有未指定时段的排期
      return matchesDate && !s.playTimeId
    })

    for (const schedule of existingSchedules) {
      await adminService.removeSchedule(schedule.id)
    }

    // 创建新排期
    for (let i = 0; i < localScheduledSongs.value.length; i++) {
      const schedule = localScheduledSongs.value[i]

      await $fetch('/api/admin/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        ...auth.getAuthConfig(),
        body: JSON.stringify({
          songId: schedule.song.id,
          playDate: selectedDate.value,
          sequence: i + 1,
          playTimeId: selectedPlayTime.value ? parseInt(selectedPlayTime.value) : null
        })
      })
    }

    await loadData()
    hasChanges.value = false

    if (window.$showNotification) {
      window.$showNotification('排期保存成功', 'success')
    }
  } catch (error) {
    console.error('保存排期失败:', error)
    if (window.$showNotification) {
      window.$showNotification('保存排期失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

const markAllAsPlayed = async () => {
  // 检查是否有可标记的歌曲
  const unplayedSongs = localScheduledSongs.value.filter(schedule => 
    schedule.song && !schedule.song.played
  )
  
  if (unplayedSongs.length === 0) {
    if (window.$showNotification) {
      window.$showNotification('没有需要标记的歌曲', 'info')
    }
    return
  }
  
  confirmDialogTitle.value = '标记已播放'
  confirmDialogMessage.value = `确定要将 ${unplayedSongs.length} 首排期歌曲标记为已播放吗？`
  confirmDialogType.value = 'info'
  confirmDialogConfirmText.value = '标记'
  confirmAction.value = async () => {
    let successCount = 0
    let failedCount = 0
    const errors = []
    
    try {
      loading.value = true
      console.log(`开始标记 ${unplayedSongs.length} 首歌曲为已播放`)

      // 检查songsService是否已初始化
      if (!songsService || !songsService.markPlayed) {
        throw new Error('歌曲服务未正确初始化')
      }

      // 逐个标记歌曲
      for (const schedule of unplayedSongs) {
        try {
          console.log(`标记歌曲: ${schedule.song.title} (ID: ${schedule.song.id})`)
          await songsService.markPlayed(schedule.song.id)
          successCount++
        } catch (error) {
          console.error(`标记歌曲失败 (ID: ${schedule.song.id}):`, error)
          failedCount++
          errors.push(`${schedule.song.title}: ${error.message}`)
        }
      }

      // 重新加载数据以更新界面
      console.log('重新加载数据以更新界面状态')
      await loadData()

      // 显示结果通知
      if (failedCount === 0) {
        if (window.$showNotification) {
          window.$showNotification(`成功标记 ${successCount} 首歌曲为已播放`, 'success')
        }
        console.log(`所有歌曲标记成功，共 ${successCount} 首`)
      } else {
        const message = `标记完成：成功 ${successCount} 首，失败 ${failedCount} 首`
        if (window.$showNotification) {
          window.$showNotification(message, failedCount > successCount ? 'error' : 'warning')
        }
        console.warn(message, '失败详情:', errors)
      }
    } catch (error) {
      console.error('批量标记已播放操作失败:', error)
      if (window.$showNotification) {
        window.$showNotification('标记已播放失败: ' + error.message, 'error')
      }
    } finally {
      loading.value = false
    }
  }
  showConfirmDialog.value = true
}

// 处理确认操作
const handleConfirm = async () => {
  if (confirmAction.value) {
    await confirmAction.value()
  }
  showConfirmDialog.value = false
  confirmAction.value = null
}

// 日期滚动
const scrollDates = (direction) => {
  if (!dateSelector.value) return

  const scrollAmount = 200
  const currentScroll = dateSelector.value.scrollLeft

  if (direction === 'left') {
    dateSelector.value.scrollTo({
      left: currentScroll - scrollAmount,
      behavior: 'smooth'
    })
  } else {
    dateSelector.value.scrollTo({
      left: currentScroll + scrollAmount,
      behavior: 'smooth'
    })
  }

  setTimeout(() => {
    updateScrollButtonState()
  }, 300)
}

const updateScrollButtonState = () => {
  if (!dateSelector.value) return

  const { scrollLeft, scrollWidth, clientWidth } = dateSelector.value
  isFirstDateVisible.value = scrollLeft <= 0
  isLastDateVisible.value = scrollLeft >= scrollWidth - clientWidth - 1
}

// 打开下载对话框
const openDownloadDialog = () => {
  showDownloadDialog.value = true
}

// 检查是否为移动设备
const isMobileDevice = () => {
  return window.innerWidth <= 768 || 'ontouchstart' in window
}

// 组件挂载时显示触控使用指南
onMounted(() => {
  // 延迟显示，确保组件完全加载
  setTimeout(() => {
    if (isMobileDevice()) {
      showTouchDragHint('长按歌曲卡片开始拖拽，或直接拖拽移动', 4000)
    }
  }, 1000)
})
</script>

<style scoped>
.schedule-manager {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: #e2e8f0;
}

/* 日期选择器 */
.date-selector-container {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  margin-bottom: 24px;
}

/* 播出时段选择器 */
.playtime-selector-container {
  background: linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.playtime-selector {
  display: flex;
  align-items: center;
  gap: 16px;
}

.playtime-label {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  white-space: nowrap;
  font-size: 15px;
}

.playtime-select {
  background: rgba(30, 30, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: white;
  padding: 10px 14px;
  font-size: 14px;
  min-width: 220px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.playtime-select:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(30, 30, 30, 0.9);
}

.playtime-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}



.date-nav-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.8) 0%, rgba(35, 35, 35, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.date-nav-btn:hover:not(:disabled) {
  background: #3a3a3a;
  color: #ffffff;
}

.date-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.date-nav-btn svg {
  width: 22px;
  height: 22px;
}

.date-selector {
  flex: 1;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 6px 0;
}

.date-selector::-webkit-scrollbar {
  display: none;
}

.date-btn {
  min-width: 70px;
  padding: 14px 10px;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.8) 0%, rgba(35, 35, 35, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.date-btn::before {
  display: none;
}

.date-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.date-btn:hover::before {
  display: none;
}

.date-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: #ffffff;
}

.date-btn.today {
  border-color: #10b981;
}

.date-day {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.date-month {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 500;
}

.date-weekday {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { 
    transform: rotate(0deg);
  }
  100% { 
    transform: rotate(360deg);
  }
}

.loading-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  font-weight: 500;
  text-align: center;
}

/* 排期内容 */
.schedule-content {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 24px;
  min-height: 700px;
  width: 100%;
  box-sizing: border-box;
  align-items: start;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .schedule-content {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
}

@media (max-width: 1200px) {
  .schedule-content {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.song-list-panel,
.sequence-panel {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.song-list-panel:hover,
.sequence-panel:hover {
  border-color: #3a3a3a;
}

.panel-header {
  padding: 24px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.panel-header h3 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.search-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: #888888;
  pointer-events: none;
  z-index: 1;
}

.search-input {
  padding: 10px 40px 10px 36px;
  background: rgba(30, 30, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  width: 320px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  background: rgba(30, 30, 30, 0.9);
}

.search-input::placeholder {
  color: #666666;
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #888888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  color: #ffffff;
  background: #3a3a3a;
}

.clear-search-btn svg {
  width: 14px;
  height: 14px;
}

.semester-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.semester-label {
  font-size: 14px;
  color: #888888;
  white-space: nowrap;
}

.semester-select {
  padding: 8px 14px;
  background: rgba(30, 30, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  min-width: 160px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.semester-select:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(30, 30, 30, 0.9);
}

.semester-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-options label {
  font-size: 14px;
  color: #888888;
}

.sort-select {
  padding: 6px 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
}

.sequence-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.save-btn,
.mark-played-btn,
.download-btn,
.draft-btn,
.publish-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.save-btn::before,
.mark-played-btn::before,
.download-btn::before,
.draft-btn::before,
.publish-btn::before {
  display: none;
}

.save-btn {
  background: #667eea;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.save-btn:hover:not(:disabled) {
  background: #5a67d8;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.mark-played-btn {
  background: #10b981;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
}

.mark-played-btn:hover:not(:disabled) {
  background: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.download-btn {
  background: #f59e0b;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
}

.download-btn:hover:not(:disabled) {
  background: #d97706;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.draft-btn {
  background: #fbbf24;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
}

.draft-btn:hover:not(:disabled) {
  background: #f59e0b;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.publish-btn {
  background: #10b981;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
}

.publish-btn:hover:not(:disabled) {
  background: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.save-btn:disabled,
.mark-played-btn:disabled,
.download-btn:disabled,
.draft-btn:disabled,
.publish-btn:disabled {
  background: rgba(60, 60, 60, 0.5);
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 拖拽区域 */
.draggable-songs,
.sequence-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-height: 450px;
  position: relative;
}

.draggable-songs.drag-over,
.sequence-list.drag-over {
  background: rgba(102, 126, 234, 0.1);
  border: 2px dashed #667eea;
  border-radius: 12px;
}

/* 歌曲项 */
.draggable-song,
.scheduled-song {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  margin-bottom: 12px;
  cursor: grab;
  transition: all 0.2s ease;
}

.draggable-song::before,
.scheduled-song::before {
  display: none;
}

.draggable-song:hover,
.scheduled-song:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.draggable-song:hover::before,
.scheduled-song:hover::before {
  display: none;
}

.draggable-song.dragging,
.scheduled-song.dragging {
  opacity: 0.6;
  transform: scale(1.02);
}

.scheduled-song.drag-over {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.15);
}

.song-info,
.scheduled-song-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.song-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.song-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  text-align: right;
  min-height: 60px;
}

.song-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  min-width: 0;
  overflow: hidden;
}

.song-artist {
  font-size: 14px;
  color: #cccccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.song-requester {
  font-size: 12px;
  color: #888888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.song-submitter {
  font-size: 12px;
  color: #888888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.preferred-playtime {
  font-size: 11px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.15);
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  border: 1px solid rgba(102, 126, 234, 0.3);
}

.song-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.votes-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #888888;
}

.votes-count svg {
  width: 14px;
  height: 14px;
}

.time-info {
  font-size: 12px;
  color: #666666;
}

.drag-handle {
  width: 24px;
  height: 24px;
  color: #666666;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drag-handle:hover {
  color: #888888;
}

.drag-handle svg {
  width: 16px;
  height: 16px;
}

/* 排期项特有样式 */
.order-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #667eea;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.order-number::before {
  display: none;
}

.scheduled-song:hover .order-number::before {
  display: none;
}

.song-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}



/* 手动日期选择器 */
.manual-date-selector {
  margin-left: 12px;
}

.manual-date-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #3a3a3a;
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manual-date-btn:hover {
  background: #4a4a4a;
  border-color: #667eea;
}

.manual-date-btn svg {
  width: 16px;
  height: 16px;
}

/* 手动日期选择弹窗 */
.manual-date-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manual-date-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.manual-date-content {
  position: relative;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  min-width: 320px;
  max-width: 90vw;
}

.manual-date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #3a3a3a;
}

.manual-date-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #888888;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.manual-date-body {
  padding: 24px;
}

.manual-date-input {
  width: 100%;
  padding: 12px 16px;
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 16px;
  margin-bottom: 20px;
  transition: all 0.2s ease;
}

.manual-date-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.manual-date-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-btn,
.confirm-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: #3a3a3a;
  color: #ffffff;
}

.cancel-btn:hover {
  background: #4a4a4a;
}

.confirm-btn {
  background: #667eea;
  color: #ffffff;
}

.confirm-btn:hover {
  background: #5a67d8;
}

/* 空状态 */
.empty-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
  text-align: center;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  margin: 20px 0;
  background: rgba(255, 255, 255, 0.02);
}

.empty-message::before {
  display: none;
}

/* 分页控件 */
.pagination-container {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.6) 0%, rgba(35, 35, 35, 0.6) 100%);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.pagination-info {
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin-bottom: 16px;
  font-weight: 500;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.pagination-btn {
  padding: 10px 18px;
  background: linear-gradient(135deg, rgba(60, 60, 60, 0.8) 0%, rgba(45, 45, 45, 0.8) 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.pagination-btn:hover:not(:disabled) {
  background: #4a4a4a;
  border-color: rgba(255, 255, 255, 0.2);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-number {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(60, 60, 60, 0.8) 0%, rgba(45, 45, 45, 0.8) 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.page-number:hover {
  background: #4a4a4a;
  border-color: rgba(255, 255, 255, 0.2);
}

.page-number.active {
  background: #667eea;
  border-color: #667eea;
  color: #ffffff;
}

.page-ellipsis {
  color: rgba(255, 255, 255, 0.4);
  padding: 0 8px;
  font-size: 14px;
  font-weight: 600;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .schedule-content {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .search-input {
    width: 280px;
  }

  .panel-header h3 {
    font-size: 22px;
  }
}

@media (max-width: 1200px) {
  .schedule-content {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 24px;
  }

  .header-controls {
    width: 100%;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 12px;
  }

  .sequence-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pagination-controls {
    flex-direction: column;
    gap: 12px;
  }

  .page-numbers {
    order: -1;
  }
}

@media (max-width: 900px) {
  .schedule-content {
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .date-selector-container {
    padding: 16px;
    border-radius: 12px;
  }

  .date-nav-btn {
    width: 40px;
    height: 40px;
  }

  .date-btn {
    min-width: 60px;
    padding: 12px 8px;
  }

  .panel-header {
    padding: 16px 20px;
  }

  .panel-header h3 {
    font-size: 20px;
  }

  .header-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px;
  }

  .search-input {
    width: 100%;
  }

  .draggable-songs,
  .sequence-list {
    padding: 16px;
    min-height: 350px;
  }

  .draggable-song,
  .scheduled-song {
    padding: 16px;
    gap: 12px;
  }

  .song-meta {
    flex-direction: column;
    gap: 6px;
  }

  .sequence-actions {
    gap: 8px;
    padding: 6px 8px;
  }

  .save-btn,
  .mark-played-btn,
  .download-btn,
  .draft-btn,
  .publish-btn {
    padding: 8px 14px;
    font-size: 13px;
  }

  .pagination-container {
    padding: 16px;
  }

  .pagination-info {
    font-size: 13px;
    margin-bottom: 12px;
  }

  .pagination-btn {
    padding: 8px 14px;
    font-size: 13px;
  }

  .page-number {
    width: 36px;
    height: 36px;
    font-size: 13px;
  }
}

/* 草稿相关样式 */
.scheduled-song.is-draft {
  border-left: 4px solid #fbbf24;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);
  position: relative;
  overflow: hidden;
}

.scheduled-song.is-draft::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 20px 20px 0;
  border-color: transparent #fbbf24 transparent transparent;
}

.draft-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  margin-left: 10px;
  background: #fbbf24;
  color: #1a1a1a;
  font-size: 11px;
  font-weight: 700;
  border-radius: 16px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.publish-single-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #10b981;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 10px;
}

.publish-single-btn::before {
  display: none;
}

.publish-single-btn:hover {
  background: #059669;
}

.publish-single-btn:hover::before {
  display: none;
}

.publish-single-btn svg {
  width: 18px;
  height: 18px;
}

.drafts-panel {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
}

.drafts-panel .panel-header {
  background: #2a2a2a;
  padding: 16px 20px;
  border-bottom: 1px solid #3a3a3a;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drafts-panel .panel-header h3 {
  color: #ffd700; /* 金色，表示草稿状态 */
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #3a3a3a;
  color: #ffffff;
  border: 1px solid #4a4a4a;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: #4a4a4a;
  border-color: #5a5a5a;
}

.refresh-btn svg {
  width: 16px;
  height: 16px;
}

.drafts-list {
  padding: 16px;
}

.draft-item {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.2s ease;
}

.draft-item:hover {
  border-color: #ffd700;
  background: #2d2d2d;
}

.draft-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.draft-song {
  flex: 1;
}

.draft-song .song-title {
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.draft-song .song-artist {
  color: #cccccc;
  font-size: 14px;
  margin-bottom: 8px;
}

.draft-song .song-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #999999;
}

.draft-song .song-meta span {
  white-space: nowrap;
}

.draft-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.publish-draft-btn {
  padding: 8px 16px;
  background: #10b981;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.publish-draft-btn:hover {
  background: #059669;
  transform: translateY(-1px);
}

.delete-draft-btn {
  padding: 8px 16px;
  background: #ef4444;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-draft-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

/* 新增的按钮样式 */
.draft-btn {
  background: #fbbf24;
  color: #1a1a1a;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.draft-btn:hover:not(:disabled) {
  background: #f59e0b;
  transform: translateY(-1px);
}

.draft-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.publish-btn {
  background: #10b981;
  color: #ffffff;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.publish-btn:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 在移动端调整草稿列表 */
@media (max-width: 768px) {
  .draft-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .draft-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .draft-song .song-meta {
    gap: 8px;
  }
}

/* 排期列表过渡动画 */
.schedule-transition-group {
  position: relative;
}

.schedule-list-move,
.schedule-list-enter-active,
.schedule-list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.schedule-list-enter-from {
  opacity: 0;
  transform: translateX(-30px) scale(0.95);
}

.schedule-list-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.schedule-list-leave-active {
  position: absolute;
  width: 100%;
}

/* 拖拽状态动画 */
.scheduled-song {
  transition: all 0.2s ease;
}

.scheduled-song.drag-over {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
  border-color: #667eea;
}

.scheduled-song:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.dragging {
  opacity: 0.7;
  transform: rotate(2deg) scale(1.02);
  z-index: 1000;
}

/* 移动端触摸拖拽优化 */
@media (max-width: 768px) {
  .draggable-song,
  .scheduled-song {
    touch-action: none; /* 防止滚动干扰拖拽 */
    user-select: none;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  .drag-handle {
    width: 32px;
    height: 32px;
    touch-action: none;
  }

  .drag-handle svg {
    width: 20px;
    height: 20px;
  }

  /* 长按识别视觉反馈 */
  .draggable-song.long-pressing,
  .scheduled-song.long-pressing {
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    animation: pulse-glow 1s ease-in-out infinite alternate;
  }

  @keyframes pulse-glow {
    0% {
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    }
    100% {
      box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
    }
  }

  /* 触控拖拽时的视觉反馈 */
  .draggable-song.touch-dragging,
  .scheduled-song.touch-dragging {
    opacity: 0.9;
    transform: scale(1.08) rotate(1deg);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    border: 2px solid #667eea;
    background: rgba(102, 126, 234, 0.15);
  }

  /* 传统拖拽时的视觉反馈 */
  .draggable-song.dragging:not(.touch-dragging),
  .scheduled-song.dragging:not(.touch-dragging) {
    opacity: 0.8;
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }

  /* 拖拽目标高亮 */
  .drag-target-highlight {
    background: rgba(102, 126, 234, 0.2) !important;
    border: 2px dashed #667eea !important;
    animation: target-pulse 0.8s ease-in-out infinite alternate;
  }

  @keyframes target-pulse {
    0% {
      background: rgba(102, 126, 234, 0.15) !important;
    }
    100% {
      background: rgba(102, 126, 234, 0.25) !important;
    }
  }

  /* 拖拽区域高亮 */
  .draggable-songs.drag-over,
  .sequence-list.drag-over {
    background: rgba(102, 126, 234, 0.15);
    border: 2px dashed #667eea;
  }

  .scheduled-song.drag-over {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.15);
    transform: translateY(-3px);
  }

  /* 触控拖拽帮助提示 */
  .touch-drag-hint {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 2000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .touch-drag-hint.show {
    opacity: 1;
  }
}
</style>
