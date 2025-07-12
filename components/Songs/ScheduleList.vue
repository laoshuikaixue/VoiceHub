<template>
  <div class="schedule-list">
    <div class="schedule-header flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">播出排期</h2>
      
      <div v-if="!loading && Object.keys(safeGroupedSchedules).length" class="date-nav flex items-center gap-2">
        <button 
          @click="previousDate" 
          class="nav-button"
          :disabled="currentDateIndex <= 0"
        >
          &lt;
        </button>
        <span class="date-display">{{ currentDateFormatted }}</span>
        <button 
          @click="nextDate" 
          class="nav-button"
          :disabled="currentDateIndex >= availableDates.length - 1"
        >
          &gt;
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      加载中...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else-if="!schedules || schedules.length === 0" class="empty">
      <div class="icon mb-4">🎵</div>
      <p>暂无排期信息</p>
      <p class="text-sm text-gray">点歌后等待管理员安排播出时间</p>
    </div>
    
    <div v-else-if="currentDateSchedules.length === 0" class="empty">
      <div class="icon mb-4">📅</div>
      <p>当前日期暂无排期</p>
      <div class="mt-4">
        <button @click="resetDate" class="btn btn-outline">查看全部日期</button>
      </div>
    </div>
    
    <div v-else class="schedule-items">
      <div 
        v-for="schedule in currentDateSchedules" 
        :key="schedule.id" 
        class="schedule-card"
      >
        <div class="schedule-title-row">
          <h3 class="song-title">{{ schedule.song.title }} - {{ schedule.song.artist }}</h3>
          <div class="votes">
            <span class="vote-count">{{ schedule.song.voteCount }}</span>
            <span class="vote-label">热度</span>
          </div>
        </div>
        
        <div class="schedule-meta">
          <span class="requester">由 {{ schedule.song.requester }} 点播</span>
          <span class="play-time">{{ formatPlayTime(schedule.playDate) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  schedules: {
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
  }
})

// 确保schedules不为null
const safeSchedules = computed(() => props.schedules || [])

// 按日期分组排期
const safeGroupedSchedules = computed(() => {
  const groups = {}
  
  if (!safeSchedules.value || !safeSchedules.value.length) {
    return {}
  }
  
  safeSchedules.value.forEach(schedule => {
    if (!schedule || !schedule.playDate) return
    
    const date = new Date(schedule.playDate).toISOString().split('T')[0]
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(schedule)
  })
  
  // 按日期排序
  const sortedGroups = {}
  Object.keys(groups).sort().forEach(date => {
    sortedGroups[date] = groups[date]
  })
  
  return sortedGroups
})

// 日期导航
const availableDates = computed(() => {
  return Object.keys(safeGroupedSchedules.value).sort()
})

const currentDateIndex = ref(0)

// 当前显示的日期
const currentDate = computed(() => {
  if (availableDates.value.length === 0) return ''
  return availableDates.value[currentDateIndex.value]
})

// 格式化当前日期
const currentDateFormatted = computed(() => {
  if (!currentDate.value) return '无日期'
  return formatDate(currentDate.value)
})

// 当前日期的排期
const currentDateSchedules = computed(() => {
  if (!currentDate.value) return []
  return safeGroupedSchedules.value[currentDate.value] || []
})

// 上一个日期
const previousDate = () => {
  if (currentDateIndex.value > 0) {
    currentDateIndex.value--
  }
}

// 下一个日期
const nextDate = () => {
  if (currentDateIndex.value < availableDates.value.length - 1) {
    currentDateIndex.value++
  }
}

// 重置日期到第一天
const resetDate = () => {
  currentDateIndex.value = 0
}

// 格式化日期
const formatDate = (dateStr) => {
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]
    
    return `${year}年${month}月${day}日 ${weekday}`
  } catch (e) {
    console.error('日期格式化错误:', e)
    return dateStr
  }
}

// 格式化播放时间
const formatPlayTime = (dateStr) => {
  try {
    // 不再显示具体时间，只显示"已排期"
    return "已排期"
  } catch (e) {
    console.error('时间格式化错误:', e)
    return '时间未定'
  }
}
</script>

<style scoped>
.schedule-list {
  width: 100%;
}

.schedule-header {
  margin-bottom: 1rem;
}

.schedule-header h2 {
  margin: 0;
  color: var(--light);
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--gray);
  transition: all 0.3s ease;
}

.nav-button:hover:not([disabled]) {
  background: rgba(255, 255, 255, 0.1);
}

.nav-button[disabled] {
  opacity: 0.3;
  cursor: not-allowed;
}

.date-display {
  min-width: 180px;
  text-align: center;
  font-weight: 600;
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

.schedule-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.schedule-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
  transition: all 0.3s ease;
}

.schedule-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.3);
}

.schedule-title-row {
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

.schedule-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--gray);
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

.vote-label {
  font-size: 0.75rem;
  color: var(--gray);
}

.icon {
  font-size: 2rem;
}

@media (max-width: 639px) {
  .schedule-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .date-nav {
    width: 100%;
    justify-content: space-between;
  }
  
  .schedule-title-row {
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