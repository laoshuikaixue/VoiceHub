<template>
  <div class="quota-display" :class="{ compact }">
    <!-- 管理员免额度提示 -->
    <div v-if="isAdmin" class="admin-badge">
      <Crown :size="14" />
      <span>{{ locale.adminUnlimited }}</span>
    </div>

    <!-- 额度未启用 -->
    <div v-else-if="!quota?.enabled" class="disabled-hint">
      <Info :size="14" />
      <span>{{ locale.quotaDisabled }}</span>
    </div>

    <!-- 正常额度显示 -->
    <div v-else class="quota-content">
      <!-- 周期额度进度条 -->
      <div class="quota-row">
        <div class="quota-label-row">
          <span class="quota-label">
            <RefreshCw :size="12" class="quota-icon periodic" />
            {{ locale.periodicQuota }}
          </span>
          <span class="quota-value">
            <span class="value-number">{{ quota.periodicBalance }}</span>
            <span v-if="periodAmount > 0" class="value-max">/ {{ periodAmount }}</span>
          </span>
        </div>
        <div v-if="periodAmount > 0" class="progress-track">
          <div
            class="progress-fill periodic"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <!-- 永久额度 -->
      <div class="quota-row">
        <div class="quota-label-row">
          <span class="quota-label">
            <Infinity :size="12" class="quota-icon permanent" />
            {{ locale.permanentQuota }}
          </span>
          <span class="quota-value">
            <span class="value-number permanent">{{ quota.permanentBalance }}</span>
          </span>
        </div>
      </div>

      <!-- 总计 -->
      <div class="quota-total">
        <span class="total-label">{{ locale.totalQuota }}</span>
        <span class="total-value">{{ quota.totalBalance }}</span>
      </div>

      <!-- 下次刷新时间 -->
      <div v-if="quota.nextRefreshAt" class="refresh-info">
        <Clock :size="11" />
        <span>{{ locale.nextRefresh }} {{ formatRefreshTime(quota.nextRefreshAt) }}</span>
      </div>

      <!-- 卡券绕过提示 -->
      <div v-if="cardCodeActive" class="bypass-badge">
        <Ticket :size="12" />
        <span>{{ locale.cardCodeBypassesLimit }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Clock, Crown, Infinity, Info, RefreshCw, Ticket } from '@lucide/vue'
import { useLocale } from '~/utils/locale'

const { pages } = useLocale()
const locale = computed(() => pages.value?.songQuotaDisplay || {})

const props = defineProps({
  quota: {
    type: Object,
    default: null
  },
  periodAmount: {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cardCodeActive: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const progressPercent = computed(() => {
  if (!props.quota || props.periodAmount <= 0) return 0
  const used = props.periodAmount - props.quota.periodicBalance
  return Math.max(0, Math.min(100, (used / props.periodAmount) * 100))
})

const formatRefreshTime = (isoString) => {
  if (!isoString) return '—'
  try {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch {
    return String(isoString)
  }
}
</script>

<style scoped>
.quota-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.quota-display.compact {
  gap: 6px;
  font-size: 11px;
}

.admin-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--warning-10, rgba(234, 179, 8, 0.1));
  color: var(--warning);
  font-weight: 600;
  font-size: 11px;
}

.disabled-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-tertiary, rgba(128, 128, 128, 0.08));
  color: var(--text-tertiary);
  font-size: 11px;
}

.quota-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quota-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quota-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quota-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.quota-icon {
  flex-shrink: 0;
}

.quota-icon.periodic {
  color: var(--success);
}

.quota-icon.permanent {
  color: var(--primary);
}

.quota-value {
  display: flex;
  align-items: center;
  gap: 2px;
}

.value-number {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary);
}

.compact .value-number {
  font-size: 12px;
}

.value-number.permanent {
  color: var(--primary);
}

.value-max {
  color: var(--text-tertiary);
  font-size: 11px;
}

.progress-track {
  height: 4px;
  border-radius: 4px;
  background: var(--bg-tertiary, rgba(128, 128, 128, 0.12));
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.progress-fill.periodic {
  background: var(--success);
}

.quota-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  border-top: 1px solid var(--border-secondary, rgba(128, 128, 128, 0.12));
  margin-top: 2px;
}

.total-label {
  color: var(--text-tertiary);
  font-weight: 500;
}

.total-value {
  color: var(--text-primary);
  font-weight: 800;
  font-size: 14px;
}

.compact .total-value {
  font-size: 13px;
}

.refresh-info {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.bypass-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--primary-10, rgba(99, 102, 241, 0.1));
  color: var(--primary);
  font-size: 10px;
  font-weight: 600;
}
</style>