<template>
  <div class="stat-card">
    <div class="stat-icon" :class="iconClass">
      <component :is="iconComponent" />
    </div>
    <div class="stat-content">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
      <div v-if="change !== undefined" class="stat-change" :class="changeClass">
        <svg v-if="change > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
          <polyline points="17,6 23,6 23,12"/>
        </svg>
        <svg v-else-if="change < 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/>
          <polyline points="17,18 23,18 23,12"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ Math.abs(change) }}%
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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
  }
})

const iconComponent = computed(() => {
  const icons = {
    users: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '12', cy: '7', r: '4' })
    ]),
    songs: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M9 18V5l12-2v13' }),
      h('circle', { cx: '6', cy: '18', r: '3' }),
      h('circle', { cx: '18', cy: '16', r: '3' })
    ]),
    schedule: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
      h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
      h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
      h('line', { x1: '3', y1: '10', x2: '21', y2: '10' })
    ]),
    votes: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' })
    ]),
    notifications: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
      h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
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
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}

.stat-card:hover {
  border-color: var(--card-hover-border);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
  color: var(--text-primary);
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
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: 1;
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
}

.stat-change svg {
  width: 12px;
  height: 12px;
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
