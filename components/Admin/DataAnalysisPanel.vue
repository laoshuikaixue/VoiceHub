<template>
  <div class="data-analysis-panel">
    <!-- 面板标题和学期选择器 -->
    <div class="panel-header">
      <h2>数据分析</h2>
      <div class="semester-selector">
        <label for="semester-select">选择学期:</label>
        <select 
          id="semester-select" 
          v-model="selectedSemester" 
          @change="handleSemesterChange"
          class="semester-select"
        >
          <option value="all">全部学期</option>
          <option 
            v-for="semester in availableSemesters" 
            :key="semester.id" 
            :value="semester.name"
          >
            {{ semester.name }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- 数据概览卡片 -->
    <div class="stats-grid">
      <StatCard
        label="总歌曲数"
        :value="analysisData.totalSongs"
        icon="songs"
        icon-class="primary"
      />
      
      <StatCard
        label="用户总数"
        :value="analysisData.totalUsers"
        icon="users"
        icon-class="success"
      />
      
      <StatCard
        label="排期总数"
        :value="analysisData.totalSchedules"
        icon="schedule"
        icon-class="info"
      />
      
      <StatCard
        label="点歌总数"
        :value="analysisData.totalRequests"
        icon="votes"
        icon-class="warning"
      />
    </div>
    
    <!-- 图表区域 -->
    <div class="charts-grid">
      <div class="chart-card">
        <h3>歌曲点播趋势</h3>
        <div class="chart-container">
          <div v-if="trendData.length > 0" class="chart-content">
            <div v-for="(item, index) in trendData.slice(0, 10)" :key="index" class="trend-item">
              <span class="trend-date">{{ item.date }}</span>
              <span class="trend-count">{{ item.count }} 首</span>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <p>暂无数据</p>
          </div>
        </div>
      </div>
      
      <div class="chart-card">
        <h3>热门歌曲排行</h3>
        <div class="chart-container">
          <div v-if="topSongs.length > 0" class="chart-content">
            <div v-for="(song, index) in topSongs" :key="song.id" class="song-item">
              <span class="song-rank">{{ index + 1 }}.</span>
              <span class="song-title">{{ song.title }}</span>
              <span class="song-artist">- {{ song.artist }}</span>
              <span class="song-votes">{{ song.voteCount }} 次点播</span>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <p>暂无数据</p>
          </div>
        </div>
      </div>
      
      <div class="chart-card">
        <h3>用户参与度</h3>
        <div class="chart-container">
          <div v-if="userEngagement.totalUsers !== undefined" class="chart-content">
            <div class="engagement-item">
              <span class="engagement-label">总用户数:</span>
              <span class="engagement-value">{{ userEngagement.totalUsers }}</span>
            </div>
            <div class="engagement-item">
              <span class="engagement-label">活跃用户数:</span>
              <span class="engagement-value">{{ userEngagement.activeUsers }} ({{ userEngagement.activeUserPercentage?.toFixed(2) }}%)</span>
            </div>
            <div class="engagement-item">
              <span class="engagement-label">平均每人点歌数:</span>
              <span class="engagement-value">{{ userEngagement.averageSongsPerUser }}</span>
            </div>
            <div class="engagement-item">
              <span class="engagement-label">最近一周活跃用户:</span>
              <span class="engagement-value">{{ userEngagement.recentActiveUsers }} ({{ userEngagement.recentActiveUserPercentage?.toFixed(2) }}%)</span>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <p>暂无数据</p>
          </div>
        </div>
      </div>
      
      <div class="chart-card">
        <h3>学期对比分析</h3>
        <div class="chart-container">
          <div v-if="semesterComparison.length > 0" class="chart-content">
            <div v-for="semester in semesterComparison" :key="semester.semester" class="semester-item">
              <span class="semester-name">{{ semester.semester }}</span>
              <span class="semester-stats">
                歌曲: {{ semester.totalSongs }}, 
                排期: {{ semester.totalSchedules }}, 
                点播: {{ semester.totalRequests }}
              </span>
              <span v-if="semester.isActive" class="semester-active">(当前学期)</span>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <p>暂无数据</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSemesters } from '~/composables/useSemesters'
import StatCard from './Common/StatCard.vue'

// 使用学期管理 composable
const { fetchSemesters, semesters: availableSemesters, currentSemester } = useSemesters()

// 响应式数据
const selectedSemester = ref('all')
const analysisData = ref({
  totalSongs: 0,
  totalUsers: 0,
  totalSchedules: 0,
  totalRequests: 0
})

// 图表数据
const trendData = ref([])
const topSongs = ref([])
const userEngagement = ref({})
const semesterComparison = ref([])

// 处理学期切换
const handleSemesterChange = () => {
  // 这里将根据选择的学期重新加载分析数据
  loadAnalysisData()
  loadChartData()
}

// 加载分析数据
const loadAnalysisData = async () => {
  try {
    // 构建API查询参数
    const params = new URLSearchParams()
    if (selectedSemester.value && selectedSemester.value !== 'all') {
      params.append('semester', selectedSemester.value)
    }
    
    // 调用API获取统计数据
    const response = await $fetch(`/api/admin/stats?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    // 更新分析数据
    analysisData.value = {
      totalSongs: response.totalSongs,
      totalUsers: response.totalUsers,
      totalSchedules: response.totalSchedules,
      totalRequests: response.weeklyRequests
    }
  } catch (error) {
    console.error('加载分析数据失败:', error)
  }
}

// 加载图表数据
const loadChartData = async () => {
  try {
    // 构建API查询参数
    const params = new URLSearchParams()
    if (selectedSemester.value && selectedSemester.value !== 'all') {
      params.append('semester', selectedSemester.value)
    }
    
    // 并行获取所有图表数据
    const [trends, topSongsData, engagement, comparison] = await Promise.all([
      $fetch(`/api/admin/stats/trends?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }),
      $fetch(`/api/admin/stats/top-songs?limit=10&${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }),
      $fetch(`/api/admin/stats/user-engagement?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }),
      $fetch('/api/admin/stats/semester-comparison', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
    ])
    
    // 更新图表数据
    trendData.value = trends
    topSongs.value = topSongsData
    userEngagement.value = engagement
    semesterComparison.value = comparison
  } catch (error) {
    console.error('加载图表数据失败:', error)
  }
}

// 组件挂载时初始化
onMounted(async () => {
  // 获取学期列表
  await fetchSemesters()
  
  // 设置默认学期为当前学期
  if (currentSemester.value) {
    selectedSemester.value = currentSemester.value.name
  }
  
  // 加载初始分析数据
  await loadAnalysisData()
  await loadChartData()
})
</script>

<style scoped>
.data-analysis-panel {
  padding: 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  color: #e2e8f0;
  min-height: 100vh;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.panel-header h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.semester-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.semester-selector label {
  font-weight: 500;
  color: #cbd5e1;
}

.semester-select {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.semester-select:hover {
  border-color: #4f46e5;
}

.semester-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.chart-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.chart-card:hover {
  border-color: #3a3a3a;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.chart-card h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.chart-content {
  width: 100%;
  padding: 10px;
}

.chart-placeholder {
  text-align: center;
  padding: 20px;
}

.chart-placeholder p {
  margin: 10px 0;
  color: #94a3b8;
  font-size: 16px;
}

.placeholder-subtext {
  font-size: 14px !important;
  color: #64748b !important;
}

.trend-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #2d2d2d;
}

.trend-date {
  color: #cbd5e1;
}

.trend-count {
  color: #4f46e5;
  font-weight: 500;
}

.song-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #2d2d2d;
  gap: 10px;
}

.song-rank {
  color: #4f46e5;
  font-weight: bold;
  width: 20px;
}

.song-title {
  color: #f1f5f9;
  flex: 1;
  font-weight: 500;
}

.song-artist {
  color: #94a3b8;
  font-size: 0.9em;
}

.song-votes {
  color: #f59e0b;
  font-weight: 500;
}

.engagement-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #2d2d2d;
}

.engagement-label {
  color: #cbd5e1;
}

.engagement-value {
  color: #4f46e5;
  font-weight: 500;
}

.semester-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #2d2d2d;
}

.semester-name {
  color: #f1f5f9;
  font-weight: 500;
  flex: 1;
}

.semester-stats {
  color: #94a3b8;
  font-size: 0.9em;
  flex: 2;
}

.semester-active {
  color: #10b981;
  font-weight: 500;
  font-size: 0.9em;
  flex: 1;
  text-align: right;
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>