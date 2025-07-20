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
          >
            <div class="song-info">
              <div class="song-title">{{ song.title }}</div>
              <div class="song-meta">
                <span class="song-artist">{{ song.artist }}</span>
                <span class="song-submitter">投稿: {{ song.requester }}</span>
                <span
                  v-if="song.preferredPlayTimeId && getPlayTimeName(song.preferredPlayTimeId)"
                  class="preferred-playtime"
                >
                  期望时段: {{ getPlayTimeName(song.preferredPlayTimeId) }}
                </span>
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
      </div>

      <!-- 排期列表 -->
      <div class="sequence-panel">
        <div class="panel-header">
          <h3>播放顺序</h3>
          <div class="sequence-actions">
            <button 
              @click="saveSequence" 
              class="save-btn" 
              :disabled="!hasChanges"
            >
              保存排期
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
              :class="['scheduled-song', { 'drag-over': dragOverIndex === index }]"
              draggable="true"
              @dragstart="dragScheduleStart($event, schedule)"
              @dragend="dragEnd"
              @dragover.prevent
              @dragenter.prevent="handleDragEnter($event, index)"
              @dragleave="handleDragLeave"
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
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
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

// 响应式数据
const selectedDate = ref(new Date().toISOString().split('T')[0])
const loading = ref(false)
const songSortOption = ref('votes-desc')
const hasChanges = ref(false)

// 拖拽状态
const isDraggableOver = ref(false)
const isSequenceOver = ref(false)
const dragOverIndex = ref(-1)
const draggedSchedule = ref(null)

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

// 播出时段相关
const playTimes = ref([])
const playTimeEnabled = ref(false)
const selectedPlayTime = ref('')

// 服务
let songsService = null
let adminService = null
let auth = null

// 生成日期列表
const availableDates = computed(() => {
  const dates = []
  const today = new Date()

  // 生成前7天到后7天的日期（共15天）
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

// 过滤未排期歌曲
const filteredUnscheduledSongs = computed(() => {
  if (!songs.value) return []
  
  const unscheduledSongs = songs.value.filter(song =>
    !song.played && !scheduledSongIds.value.has(song.id)
  )
  
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

  await loadData()

  // 添加滚轮事件监听
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

// 监听日期变化
watch(selectedDate, async () => {
  await loadData()
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    await songsService.fetchSongs()
    await songsService.fetchPublicSchedules()
    await loadPlayTimes()

    songs.value = songsService.songs.value
    publicSchedules.value = songsService.publicSchedules.value

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

// 更新本地排期数据
const updateLocalScheduledSongs = () => {
  let todaySchedules = publicSchedules.value.filter(s => {
    if (!s.playDate) return false
    const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
    return scheduleDateStr === selectedDate.value
  })

  // 如果选择了特定播出时段，进行过滤
  if (selectedPlayTime.value) {
    todaySchedules = todaySchedules.filter(s =>
      s.playTimeId === parseInt(selectedPlayTime.value)
    )
  }

  localScheduledSongs.value = todaySchedules.map(s => ({ ...s }))

  scheduledSongIds.value = new Set(
    publicSchedules.value
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

      const dateOnly = new Date(selectedDate.value)
      dateOnly.setHours(0, 0, 0, 0)

      const newSchedule = {
        id: Date.now(),
        song: song,
        playDate: dateOnly,
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

      const dateOnly = new Date(selectedDate.value)
      dateOnly.setHours(0, 0, 0, 0)

      const newSchedule = {
        id: Date.now(),
        song: song,
        playDate: dateOnly,
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

const removeFromSequence = (index) => {
  const schedule = localScheduledSongs.value[index]
  if (!schedule) return

  if (confirm(`确定要移除歌曲 "${schedule.song.title}" 的排期吗？`)) {
    scheduledSongIds.value.delete(schedule.song.id)
    localScheduledSongs.value.splice(index, 1)

    localScheduledSongs.value.forEach((item, idx) => {
      item.sequence = idx + 1
    })

    hasChanges.value = true
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
          'Content-Type': 'application/json',
          ...auth.getAuthHeader().headers
        },
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
  if (!confirm('确定要将所有排期歌曲标记为已播放吗？')) return

  try {
    loading.value = true

    for (const schedule of localScheduledSongs.value) {
      if (schedule.song && !schedule.song.played) {
        await songsService.markPlayed(schedule.song.id)
      }
    }

    await loadData()

    if (window.$showNotification) {
      window.$showNotification('所有歌曲已标记为已播放', 'success')
    }
  } catch (error) {
    console.error('标记已播放失败:', error)
    if (window.$showNotification) {
      window.$showNotification('标记已播放失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
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
</script>

<style scoped>
.schedule-manager {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: var(--card-bg);
  border-radius: var(--radius-xl);
  border: 1px solid var(--card-border);
  width: 100%;
  max-width: none;
  min-width: 0;
  box-sizing: border-box;
}

/* 日期选择器 */
.date-selector-container {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #1a1a1a;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #2a2a2a;
}

/* 播出时段选择器 */
.playtime-selector-container {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  padding: 16px;
  margin-bottom: 24px;
}

.playtime-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.playtime-label {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  white-space: nowrap;
}

.playtime-select {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: white;
  padding: 8px 12px;
  font-size: 14px;
  min-width: 200px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.playtime-select:hover {
  border-color: #4a4a4a;
  background: #333333;
}

.playtime-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.date-nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #cccccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.date-nav-btn:hover:not(:disabled) {
  background: #3a3a3a;
  color: #ffffff;
}

.date-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-nav-btn svg {
  width: 20px;
  height: 20px;
}

.date-selector {
  flex: 1;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 4px 0;
}

.date-selector::-webkit-scrollbar {
  display: none;
}

.date-btn {
  min-width: 60px;
  padding: 12px 8px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #cccccc;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.date-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
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
  font-size: 16px;
  font-weight: 600;
}

.date-month {
  font-size: 12px;
  opacity: 0.8;
}

.date-weekday {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
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

/* 排期内容 */
.schedule-content {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(300px, 1fr);
  gap: 24px;
  min-height: 600px;
  width: 100%;
  box-sizing: border-box;
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
}

.panel-header {
  padding: 20px 24px;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
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
}

.save-btn,
.mark-played-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.save-btn {
  background: #667eea;
  color: #ffffff;
}

.save-btn:hover:not(:disabled) {
  background: #5a67d8;
}

.save-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

.mark-played-btn {
  background: #10b981;
  color: #ffffff;
}

.mark-played-btn:hover:not(:disabled) {
  background: #059669;
}

.mark-played-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

/* 拖拽区域 */
.draggable-songs,
.sequence-list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  min-height: 400px;
}

.draggable-songs.drag-over,
.sequence-list.drag-over {
  background: rgba(102, 126, 234, 0.1);
  border: 2px dashed #667eea;
}

/* 歌曲项 */
.draggable-song,
.scheduled-song {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: grab;
  transition: all 0.2s ease;
}

.draggable-song:hover,
.scheduled-song:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.draggable-song.dragging,
.scheduled-song.dragging {
  opacity: 0.5;
  transform: rotate(5deg);
}

.scheduled-song.drag-over {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.song-info,
.scheduled-song-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.song-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
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

.song-submitter {
  font-size: 14px;
  color: #888888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.preferred-playtime {
  font-size: 12px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  align-self: flex-start;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #667eea;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.song-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remove-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #ef4444;
  border: none;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: #dc2626;
}

.remove-btn svg {
  width: 16px;
  height: 16px;
}

/* 空状态 */
.empty-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666666;
  font-size: 14px;
  text-align: center;
  border: 2px dashed #3a3a3a;
  border-radius: 8px;
  margin: 20px 0;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .schedule-content {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .sequence-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 900px) {
  .schedule-manager {
    padding: 16px;
  }

  .schedule-content {
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .schedule-manager {
    padding: 16px;
  }

  .date-selector-container {
    padding: 12px;
  }

  .date-nav-btn {
    width: 36px;
    height: 36px;
  }

  .date-btn {
    min-width: 50px;
    padding: 8px 6px;
  }

  .draggable-song,
  .scheduled-song {
    padding: 12px;
  }

  .song-meta {
    flex-direction: column;
    gap: 4px;
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
</style>
