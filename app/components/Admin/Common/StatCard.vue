<template>
  <div :class="{ 'loading': isLoading }" class="stat-card">
    <div :class="[iconClass, { 'pulse': isLoading }]" class="stat-icon">
      <component :is="iconComponent"/>
    </div>
    <div class="stat-content">
      <div class="stat-value-container">
        <div :class="{ 'animate-count': shouldAnimate }" class="stat-value">
          {{ formattedValue }}
        </div>
        <div v-if="subtitle" class="stat-subtitle">{{ subtitle }}</div>
      </div>
      <div class="stat-label">{{ label }}</div>

      <!-- 趋势显示 -->
      <div v-if="change !== undefined" :class="changeClass" class="stat-change">
        <div class="change-icon">
          <svg v-if="change > 0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
            <polyline points="17,6 23,6 23,12"/>
          </svg>
          <svg v-else-if="change < 0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/>
            <polyline points="17,18 23,18 23,12"/>
          </svg>
          <svg v-else fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
        </div>
        <span class="change-text">{{ Math.abs(change) }}%</span>
        <span v-if="changeLabel" class="change-label">{{ changeLabel }}</span>
      </div>

      <!-- 迷你趋势图 -->
      <div v-if="trendData && trendData.length > 0" class="mini-trend">
        <svg class="trend-chart" viewBox="0 0 100 20">
          <polyline
              :points="trendPoints"
              :stroke="trendColor"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
          />
          <circle
              v-for="(point, index) in trendData"
              :key="index"
              :cx="(index / (trendData.length - 1)) * 100"
              :cy="20 - ((point - minTrend) / (maxTrend - minTrend)) * 20"
              :fill="trendColor"
              class="trend-point"
              r="1"
          />
        </svg>
      </div>
    </div>

    <!-- 加载状态覆盖层 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import {computed} from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  iconClass: {
    type: String,
    default: ''
  },
  change: {
    type: Number,
    default: undefined
  },
  changeLabel: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  trendData: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  shouldAnimate: {
    type: Boolean,
    default: true
  },
  format: {
    type: String,
    default: 'number' // 'number', 'currency', 'percentage'
  }
})

const iconComponent = computed(() => {
  const icons = {
    users: () => h('svg', {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2'}, [
      h('path', {d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'}),
      h('circle', {cx: '12', cy: '7', r: '4'})
    ]),
    songs: () => h('svg', {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2'}, [
      h('path', {d: 'M9 18V5l12-2v13'}),
      h('circle', {cx: '6', cy: '18', r: '3'}),
      h('circle', {cx: '18', cy: '16', r: '3'})
    ]),
    schedule: () => h('svg', {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2'}, [
      h('rect', {x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2'}),
      h('line', {x1: '16', y1: '2', x2: '16', y2: '6'}),
      h('line', {x1: '8', y1: '2', x2: '8', y2: '6'}),
      h('line', {x1: '3', y1: '10', x2: '21', y2: '10'})
    ]),
    votes: () => h('svg', {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2'}, [
      h('path', {d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'})
    ]),
    notifications: () => h('svg', {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2'}, [
      h('path', {d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'}),
      h('path', {d: 'M13.73 21a2 2 0 0 1-3.46 0'})
    ])
  }

  return icons[props.icon] || icons.users
})

const changeClass = computed(() => {
  if (props.change === undefined) return ''
  if (props.change > 0) return 'positive'
  if (props.change < 0) return 'negative'
  return 'neutral'
})

// 格式化数值显示
const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value

  const num = Number(props.value)
  if (isNaN(num)) return props.value

  switch (props.format) {
    case 'currency':
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY'
      }).format(num)
    case 'percentage':
      return `${num}%`
    case 'number':
    default:
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`
      } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`
      }
      return num.toLocaleString()
  }
})

// 趋势数据处理
const minTrend = computed(() => {
  if (!props.trendData || props.trendData.length === 0) return 0
  return Math.min(...props.trendData)
})

const maxTrend = computed(() => {
  if (!props.trendData || props.trendData.length === 0) return 0
  return Math.max(...props.trendData)
})

const trendPoints = computed(() => {
  if (!props.trendData || props.trendData.length === 0) return ''

  return props.trendData
      .map((point, index) => {
        const x = (index / (props.trendData.length - 1)) * 100
        const y = 20 - ((point - minTrend.value) / (maxTrend.value - minTrend.value)) * 20
        return `${x},${y}`
      })
      .join(' ')
})

const trendColor = computed(() => {
  if (!props.trendData || props.trendData.length < 2) return '#6366f1'

  const first = props.trendData[0]
  const last = props.trendData[props.trendData.length - 1]

  if (last > first) return '#10b981' // 上升趋势 - 绿色
  if (last < first) return '#ef4444' // 下降趋势 - 红色
  return '#6366f1' // 平稳趋势 - 蓝色
})
</script>

<style scoped>
.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateY(0);
}

.stat-card:hover {
  border-color: var(--card-hover-border);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}

.stat-card.loading {
  opacity: 0.8;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  transition: all 0.3s ease;
}

.stat-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.stat-card:hover .stat-icon::before {
  opacity: 1;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
  color: var(--text-primary);
  transition: all 0.3s ease;
  z-index: 1;
  position: relative;
}

.stat-icon.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

.stat-icon.primary {
  background: var(--primary-light);
  color: var(--primary);
}

.stat-icon.success {
  background: var(--success-light);
  color: var(--success);
}

.stat-icon.warning {
  background: var(--warning-light);
  color: var(--warning);
}

.stat-icon.error {
  background: var(--error-light);
  color: var(--error);
}

.stat-icon.info {
  background: var(--info-light);
  color: var(--info);
}

.stat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.stat-value-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: 1;
  transition: all 0.3s ease;
}

.stat-value.animate-count {
  animation: countUp 0.6s ease-out;
}

@keyframes countUp {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.8);
  }
  50% {
    opacity: 0.7;
    transform: translateY(-2px) scale(1.05);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.stat-subtitle {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  opacity: 0.8;
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
}

.stat-change {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 4px 8px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.stat-change:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(1.02);
}

.change-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.change-icon svg {
  width: 12px;
  height: 12px;
  transition: transform 0.2s ease;
}

.stat-change:hover .change-icon svg {
  transform: scale(1.1);
}

.change-text {
  font-weight: var(--font-semibold);
}

.change-label {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}

/* 迷你趋势图样式 */
.mini-trend {
  margin-top: var(--spacing-xs);
  height: 20px;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.stat-card:hover .mini-trend {
  opacity: 1;
}

.trend-chart {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.trend-point {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.mini-trend:hover .trend-point {
  opacity: 0.8;
}

/* 加载状态样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--primary);
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

.stat-change.positive {
  color: var(--success);
}

.stat-change.negative {
  color: var(--error);
}

.stat-change.neutral {
  color: var(--text-tertiary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stat-card {
    padding: var(--spacing-lg);
    gap: var(--spacing-md);
  }

  .stat-icon {
    width: 40px;
    height: 40px;
  }

  .stat-icon svg {
    width: 20px;
    height: 20px;
  }

  .stat-value {
    font-size: var(--text-xl);
  }

  .stat-label {
    font-size: var(--text-xs);
  }

  .stat-change {
    font-size: 10px;
  }

  .stat-change svg {
    width: 10px;
    height: 10px;
  }
}

/* 小屏幕设备进一步优化 */
@media (max-width: 480px) {
  .stat-card {
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
  }

  .stat-icon {
    width: 36px;
    height: 36px;
  }

  .stat-icon svg {
    width: 18px;
    height: 18px;
  }

  .stat-value {
    font-size: var(--text-lg);
  }
}
</style>
