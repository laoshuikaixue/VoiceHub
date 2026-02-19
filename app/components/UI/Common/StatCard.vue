<template>
  <div
    class="relative overflow-hidden p-6 bg-zinc-900 border border-zinc-800 rounded-xl group hover:border-blue-500/30 transition-all duration-300 shadow-xl shadow-black/20"
    :class="{ 'opacity-60 grayscale cursor-wait': isLoading }"
  >
    <!-- 背景装饰 -->
    <div
      class="absolute -right-4 -top-4 w-24 h-24 bg-blue-600/5 blur-3xl rounded-full group-hover:bg-blue-600/10 transition-colors"
    />

    <div class="flex items-start justify-between relative z-10">
      <div class="space-y-4 flex-1">
        <div class="flex items-center gap-2">
          <div
            class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 group-hover:border-blue-500/30 group-hover:bg-blue-600/5 transition-all duration-300"
            :class="iconClass"
          >
            <component
              :is="iconComponent"
              :size="18"
              class="text-zinc-400 group-hover:text-blue-400 transition-colors"
            />
          </div>
          <span
            class="text-[10px] font-black text-zinc-600 uppercase tracking-widest group-hover:text-zinc-500 transition-colors"
            >{{ label }}</span
          >
        </div>

        <div class="space-y-1">
          <div class="flex items-baseline gap-2">
            <h3 class="text-3xl font-black text-zinc-100 tracking-tight">
              {{ formattedValue }}
            </h3>
            <div
              v-if="change !== undefined"
              :class="changeClass"
              class="flex items-center gap-0.5 text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md border"
            >
              <TrendingUp v-if="change > 0" :size="10" />
              <TrendingDown v-else-if="change < 0" :size="10" />
              <Minus v-else :size="10" />
              <span>{{ Math.abs(change) }}%</span>
            </div>
          </div>
          <p
            v-if="subtitle"
            class="text-[10px] font-bold text-zinc-600 group-hover:text-zinc-500 transition-colors"
          >
            {{ subtitle }}
          </p>
        </div>
      </div>

      <!-- 迷你趋势图 -->
      <div v-if="trendData && trendData.length > 0" class="w-24 h-12 self-end mb-1">
        <svg class="w-full h-full drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" viewBox="0 0 100 20">
          <polyline
            :points="trendPoints"
            :stroke="trendColor"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            class="transition-all duration-500"
          />
        </svg>
      </div>
    </div>

    <!-- 加载动画 -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-zinc-900/40 backdrop-blur-[1px]"
    >
      <div
        class="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Users,
  Music,
  Calendar,
  Heart,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  ShieldCheck,
  Mail,
  Zap,
  Clock,
  BarChart3,
  MessageSquare
} from 'lucide-vue-next'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  iconClass: { type: String, default: '' },
  change: { type: Number, default: undefined },
  changeLabel: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  trendData: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  shouldAnimate: { type: Boolean, default: true },
  format: { type: String, default: 'number' } // 'number', 'currency', 'percentage'
})

const iconComponent = computed(() => {
  const icons = {
    users: Users,
    songs: Music,
    schedule: Calendar,
    votes: Heart,
    notifications: Bell,
    database: Database,
    security: ShieldCheck,
    email: Mail,
    performance: Zap,
    time: Clock,
    chart: BarChart3,
    messages: MessageSquare
  }
  return icons[props.icon] || icons.users
})

const changeClass = computed(() => {
  if (props.change === undefined) return ''
  if (props.change > 0) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  if (props.change < 0) return 'bg-red-500/10 text-red-500 border-red-500/20'
  return 'bg-zinc-800 text-zinc-500 border-zinc-700'
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  const num = Number(props.value)
  if (isNaN(num)) return props.value

  switch (props.format) {
    case 'currency':
      return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(num)
    case 'percentage':
      return `${num}%`
    case 'number':
    default:
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
      return num.toLocaleString()
  }
})

const minTrend = computed(() => Math.min(...(props.trendData || [0])))
const maxTrend = computed(() => Math.max(...(props.trendData || [1])))

const trendPoints = computed(() => {
  if (!props.trendData || props.trendData.length < 2) return ''
  const range = maxTrend.value - minTrend.value || 1
  return props.trendData
    .map((point, index) => {
      const x = (index / (props.trendData.length - 1)) * 100
      const y = 18 - ((point - minTrend.value) / range) * 16
      return `${x},${y}`
    })
    .join(' ')
})

const trendColor = computed(() => {
  if (!props.trendData || props.trendData.length < 2) {
    if (props.change > 0) return '#10b981' // emerald-500
    if (props.change < 0) return '#ef4444' // red-500
    return '#3b82f6' // blue-500
  }

  const first = props.trendData[0]
  const last = props.trendData[props.trendData.length - 1]

  if (last > first) return '#10b981' // emerald-500
  if (last < first) return '#ef4444' // red-500
  return '#3b82f6' // blue-500
})
</script>

<style scoped></style>
