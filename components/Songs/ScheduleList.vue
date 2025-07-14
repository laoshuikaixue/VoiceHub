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
        <div class="date-display" @click="showDatePicker = true">
          {{ currentDateFormatted }}
          <span class="date-picker-icon">▼</span>
        </div>
        <button 
          @click="nextDate" 
          class="nav-button"
          :disabled="currentDateIndex >= availableDates.length - 1"
        >
          &gt;
        </button>
      </div>
    </div>
    
    <!-- 日期选择器弹窗 -->
    <div v-if="showDatePicker" class="date-picker-overlay" @click.self="showDatePicker = false">
      <div class="date-picker-container">
        <div class="date-picker-header">
          <h3>选择日期</h3>
          <button @click="showDatePicker = false" class="close-btn">×</button>
        </div>
        <div class="date-picker-content">
          <div 
            v-for="(date, index) in availableDates" 
            :key="date"
            :class="['date-option', { active: currentDateIndex === index }]"
            @click="selectDate(index)"
          >
            {{ formatDate(date) }}
          </div>
        </div>
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
      <!-- 按播出时段分组显示 -->
      <template v-if="schedulesByPlayTime && Object.keys(schedulesByPlayTime).length > 0">
        <div v-for="(schedules, playTimeId) in schedulesByPlayTime" :key="playTimeId" class="playtime-group">
          <div class="playtime-header" v-if="shouldShowPlayTimeHeader(playTimeId)">
            <h4 v-if="playTimeId === 'null'">未指定时段</h4>
            <h4 v-else-if="getPlayTimeById(playTimeId)">
              {{ getPlayTimeById(playTimeId).name }}
              <span class="playtime-time" v-if="getPlayTimeById(playTimeId).startTime || getPlayTimeById(playTimeId).endTime">
                ({{ formatPlayTimeRange(getPlayTimeById(playTimeId)) }})
              </span>
            </h4>
          </div>
          
          <div 
            v-for="schedule in schedules" 
            :key="schedule.id" 
            class="schedule-card"
            :class="{ 'played': schedule.song.played }"
          >
            <div class="schedule-title-row">
              <h3 class="song-title">{{ schedule.song.title }} - {{ schedule.song.artist }}</h3>
              <div class="votes">
                <span class="vote-count">{{ schedule.song.voteCount }}</span>
                <span class="vote-label">热度</span>
              </div>
            </div>
            
            <div class="schedule-meta">
              <span class="requester">投稿人：{{ schedule.song.requester }}</span>
              <span class="play-time" :class="{ 'played-status': schedule.song.played }">
                {{ formatPlayTime(schedule) }}
              </span>
            </div>
          </div>
        </div>
      </template>
      
      <!-- 不分组显示（兼容旧版） -->
      <template v-else>
        <div 
          v-for="schedule in currentDateSchedules" 
          :key="schedule.id" 
          class="schedule-card"
          :class="{ 'played': schedule.song.played }"
        >
          <div class="schedule-title-row">
            <h3 class="song-title">{{ schedule.song.title }} - {{ schedule.song.artist }}</h3>
            <div class="votes">
              <span class="vote-count">{{ schedule.song.voteCount }}</span>
              <span class="vote-label">热度</span>
            </div>
          </div>
          
          <div class="schedule-meta">
            <span class="requester">投稿人：{{ schedule.song.requester }}</span>
            <span v-if="schedule.playTime" class="play-time">
              {{ formatPlayTimeRange(schedule.playTime) }}
            </span>
            <span class="play-time" :class="{ 'played-status': schedule.song.played }">
              {{ formatPlayTime(schedule) }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useSongs } from '~/composables/useSongs'

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

// 获取播放时段启用状态
const { playTimeEnabled } = useSongs()

// 确保schedules不为null
const safeSchedules = computed(() => props.schedules || [])

// 日期选择器状态
const showDatePicker = ref(false)

// 按日期分组排期
const safeGroupedSchedules = computed(() => {
  const groups = {}
  
  if (!safeSchedules.value || !safeSchedules.value.length) {
    return {}
  }
  
  safeSchedules.value.forEach(schedule => {
    if (!schedule || !schedule.playDate) return
    
    try {
      // 使用UTC时间处理日期
      const scheduleDate = new Date(schedule.playDate)
      const date = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`
      
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(schedule)
    } catch (err) {
      console.error('处理排期日期失败:', err, schedule)
    }
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

// 选择特定日期
const selectDate = (index) => {
  currentDateIndex.value = index
  showDatePicker.value = false
}

// 重置日期到第一天
const resetDate = () => {
  currentDateIndex.value = 0
}

// 格式化日期
const formatDate = (dateStr) => {
  try {
    // 解析日期字符串
    const parts = dateStr.split('-')
    if (parts.length !== 3) {
      throw new Error('无效的日期格式')
    }
    
    const year = parseInt(parts[0])
    const month = parseInt(parts[1])
    const day = parseInt(parts[2])
    
    // 创建日期对象
    const date = new Date(year, month - 1, day)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期')
    }
    
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]
    
    return `${year}年${month}月${day}日 ${weekday}`
  } catch (e) {
    console.error('日期格式化错误:', e, dateStr)
    return dateStr || '未知日期'
  }
}

// 格式化播放时间
const formatPlayTime = (schedule) => {
  try {
    // 根据歌曲播放状态显示不同文本
    if (schedule.song && schedule.song.played) {
      return "已播放"
    } else {
      return "已排期"
    }
  } catch (e) {
    console.error('时间格式化错误:', e)
    return '时间未定'
  }
}

// 按播出时段分组的排期
const schedulesByPlayTime = computed(() => {
  if (!currentDateSchedules.value || currentDateSchedules.value.length === 0) {
    return null;
  }
  
  const grouped = {};
  
  // 先对排期按时段和序号排序
  const sortedSchedules = [...currentDateSchedules.value].sort((a, b) => {
    // 先按时段分组，确保转换为字符串
    const playTimeIdA = a.playTimeId !== null && a.playTimeId !== undefined ? String(a.playTimeId) : 'null';
    const playTimeIdB = b.playTimeId !== null && b.playTimeId !== undefined ? String(b.playTimeId) : 'null';
    
    if (playTimeIdA !== playTimeIdB) {
      // 未指定时段排在最后
      if (playTimeIdA === 'null') return 1;
      if (playTimeIdB === 'null') return -1;
      // 使用数字比较而不是字符串比较
      return parseInt(playTimeIdA) - parseInt(playTimeIdB);
    }
    
    // 时段相同则按序号排序
    return a.sequence - b.sequence;
  });
  
  // 分组
  for (const schedule of sortedSchedules) {
    // 确保正确处理播放时段ID
    const playTimeId = schedule.playTimeId !== null && schedule.playTimeId !== undefined ? String(schedule.playTimeId) : 'null';
    
    if (!grouped[playTimeId]) {
      grouped[playTimeId] = [];
    }
    
    grouped[playTimeId].push(schedule);
  }
  
  return grouped;
});

// 根据ID获取播出时段信息
const getPlayTimeById = (id) => {
  if (id === 'null') return null;
  
  try {
    const numId = parseInt(id);
    if (isNaN(numId)) return null;
    
    // 从排期中查找
    for (const schedule of currentDateSchedules.value) {
      // 确保正确比较
      if (schedule.playTimeId === numId && schedule.playTime) {
        return schedule.playTime;
      }
    }
  } catch (err) {
    console.error('解析播放时段ID失败:', err);
  }
  
  return null;
};

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return '';
  
  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`;
  } else if (playTime.startTime) {
    return `${playTime.startTime} 开始`;
  } else if (playTime.endTime) {
    return `${playTime.endTime} 结束`;
  }
  
  return '不限时间';
};

// 判断是否显示播放时段标题
const shouldShowPlayTimeHeader = (playTimeId) => {
  // 如果播放时段功能未启用且是未指定时段，则不显示
  if (!playTimeEnabled.value && playTimeId === 'null') {
    return false;
  }
  return true; // 显示其他所有时段
};
</script>

<style scoped>
.schedule-list {
  width: 100%;
  position: relative;
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
  padding: 0.5rem 1rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.date-display:hover {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.date-picker-icon {
  font-size: 0.75rem;
  opacity: 0.6;
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

.empty .icon {
  font-size: 3rem;
  opacity: 0.5;
}

.schedule-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  width: 100%; /* 确保宽度一致 */
}

.schedule-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
  transition: all 0.3s ease;
  width: 100%; /* 确保宽度一致 */
  box-sizing: border-box; /* 确保内边距不会增加元素总宽度 */
}

.schedule-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.3);
}

.schedule-card.played {
  border-color: rgba(16, 185, 129, 0.3);
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

.played-status {
  color: var(--success);
}

/* 日期选择器样式 */
.date-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-picker-container {
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.date-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.date-picker-header h3 {
  margin: 0;
  color: var(--light);
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--gray);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.3s ease;
}

.close-btn:hover {
  color: var(--light);
}

.date-picker-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0.5rem;
}

.date-option {
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.date-option:hover {
  background: rgba(30, 41, 59, 0.6);
  transform: translateY(-1px);
}

.date-option.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: var(--primary);
  color: var(--primary);
}

.playtime-group {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.playtime-header h4 {
  margin: 0 0 0.5rem 0;
  color: var(--light);
  font-size: 1rem;
  font-weight: 500;
}

.playtime-time {
  font-size: 0.75rem;
  color: var(--gray);
  margin-left: 0.5rem;
}

@media (max-width: 639px) {
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
    justify-content: flex-end;
  }
}
</style> 