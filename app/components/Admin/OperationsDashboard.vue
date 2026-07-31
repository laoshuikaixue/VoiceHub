<template>
  <div class="operations-dashboard space-y-5">
    <header class="flex flex-col gap-4 border-b border-zinc-800 pb-5 xl:flex-row xl:items-center xl:justify-between">
      <div class="min-w-0">
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Icon name="monitoring" :size="17" />
          </span>
          <h2 class="text-lg font-bold text-zinc-100">{{ locale.title }}</h2>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            {{ locale.awaitingConnection }}
          </span>
          <span class="text-zinc-700">/</span>
          <span>{{ locale.lastUpdated }} --</span>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:items-center">
        <CustomSelect
          v-model="selectedScope"
          :options="scopeOptions"
          class-name="min-w-0 sm:min-w-32"
        />
        <CustomSelect
          v-model="selectedLevel"
          :options="levelOptions"
          class-name="min-w-0 sm:min-w-32"
        />
        <CustomSelect
          v-model="selectedRange"
          :options="rangeOptions"
          class-name="min-w-0 sm:min-w-32"
        />
        <div class="flex items-center gap-2 sm:col-span-3 xl:ml-1">
          <button
            v-for="action in headerActions"
            :key="action.icon"
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
            :aria-label="action.label"
            :title="action.label"
            disabled
          >
            <Icon :name="action.icon" :size="15" />
          </button>
        </div>
      </div>
    </header>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article class="panel min-h-72 xl:col-span-5">
        <div class="flex h-full flex-col gap-8 p-5 sm:flex-row sm:items-center sm:p-6">
          <div class="flex shrink-0 flex-col items-center justify-center border-zinc-800 sm:w-44 sm:border-r sm:pr-6">
            <div class="health-ring">
              <div class="health-ring__inner">
                <strong>--</strong>
                <span>{{ locale.health.score }}</span>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
              <span>{{ locale.health.status }}</span>
              <Icon name="info" :size="12" />
            </div>
            <span class="mt-1 text-xs font-semibold text-zinc-600">{{ locale.health.waiting }}</span>
          </div>

          <div class="flex min-w-0 flex-1 flex-col self-stretch">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <span class="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                {{ locale.health.realtime }}
                <Icon name="info" :size="12" class-name="text-zinc-600" />
              </div>
              <div class="flex h-7 items-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
                <button
                  v-for="range in realtimeRanges"
                  :key="range"
                  type="button"
                  class="h-6 min-w-10 rounded-md px-2 text-[10px] font-semibold transition-colors"
                  :class="activeRealtimeRange === range ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:text-zinc-300'"
                  @click="activeRealtimeRange = range"
                >
                  {{ range }}
                </button>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-5">
              <div>
                <p class="metric-caption">{{ locale.health.current }}</p>
                <p class="mt-1 text-2xl font-bold text-zinc-100">-- <span class="metric-unit">QPS</span></p>
              </div>
              <div>
                <p class="metric-caption">{{ locale.health.current }}</p>
                <p class="mt-1 text-2xl font-bold text-zinc-100">-- <span class="metric-unit">TPS</span></p>
              </div>
              <div>
                <p class="metric-caption">{{ locale.health.peak }}</p>
                <p class="mt-1 text-sm font-semibold text-zinc-300">-- <span class="metric-unit">QPS</span></p>
                <p class="mt-1 text-sm font-semibold text-zinc-300">-- <span class="metric-unit">TPS</span></p>
              </div>
              <div>
                <p class="metric-caption">{{ locale.health.average }}</p>
                <p class="mt-1 text-sm font-semibold text-zinc-300">-- <span class="metric-unit">QPS</span></p>
                <p class="mt-1 text-sm font-semibold text-zinc-300">-- <span class="metric-unit">TPS</span></p>
              </div>
            </div>

            <div class="chart-grid mt-auto h-16">
              <div class="chart-empty">{{ locale.noData }}</div>
            </div>
          </div>
        </div>
      </article>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3">
        <article v-for="metric in metricCards" :key="metric.label" class="panel flex min-h-32 flex-col p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
              {{ metric.label }}
              <Icon name="info" :size="11" class-name="text-zinc-700" />
            </div>
            <span class="text-[10px] font-semibold text-blue-400">{{ locale.details }}</span>
          </div>
          <div class="mt-3 flex items-baseline gap-1.5">
            <strong class="text-2xl text-zinc-100">--</strong>
            <span class="metric-unit">{{ metric.unit }}</span>
          </div>
          <div class="mt-auto border-t border-zinc-800 pt-3 text-xs text-zinc-600">
            {{ metric.detail }} <span class="float-right text-zinc-400">--</span>
          </div>
        </article>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <article v-for="item in infrastructureCards" :key="item.label" class="panel min-h-24 p-4">
        <div class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <Icon :name="item.icon" :size="14" class-name="text-zinc-600" />
            {{ item.label }}
          </span>
          <Icon name="info" :size="11" class-name="text-zinc-700" />
        </div>
        <p class="mt-3 text-lg font-bold text-zinc-300">--</p>
        <p class="mt-1 truncate text-[10px] text-zinc-600">{{ item.detail }}</p>
      </article>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article class="panel xl:col-span-3">
        <PanelHeader icon="server" :title="locale.panels.dependencies" />
        <div class="divide-y divide-zinc-800/80 px-4">
          <div v-for="item in dependencies" :key="item" class="flex items-center justify-between gap-3 py-4">
            <div class="flex min-w-0 items-center gap-2.5">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700" />
              <span class="truncate text-xs font-semibold text-zinc-400">{{ item }}</span>
            </div>
            <span class="text-[10px] text-zinc-600">--</span>
          </div>
        </div>
      </article>

      <article class="panel xl:col-span-4">
        <PanelHeader icon="chart-line" :title="locale.panels.latencyTrend" />
        <div class="p-4">
          <div class="chart-grid h-64">
            <div class="chart-empty">{{ locale.noData }}</div>
          </div>
        </div>
      </article>

      <article class="panel xl:col-span-5">
        <PanelHeader icon="activity" :title="locale.panels.requestTrend">
          <div class="flex items-center gap-3 text-[10px] text-zinc-500">
            <span class="inline-flex items-center gap-1"><i class="h-1.5 w-1.5 rounded-full bg-blue-500" />QPS</span>
            <span class="inline-flex items-center gap-1"><i class="h-1.5 w-1.5 rounded-full bg-emerald-500" />TPS</span>
          </div>
        </PanelHeader>
        <div class="p-4">
          <div class="chart-grid h-64">
            <div class="chart-empty">{{ locale.noData }}</div>
          </div>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article class="panel overflow-hidden xl:col-span-8">
        <PanelHeader icon="terminal" :title="locale.panels.runtimeLogs">
          <span class="text-[10px] text-zinc-600">{{ locale.logCount }} --</span>
        </PanelHeader>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] table-fixed text-left">
            <thead class="border-b border-zinc-800 bg-zinc-950/50 text-[10px] font-semibold text-zinc-600">
              <tr>
                <th class="w-36 px-4 py-3">{{ locale.logs.time }}</th>
                <th class="w-24 px-4 py-3">{{ locale.logs.level }}</th>
                <th class="w-32 px-4 py-3">{{ locale.logs.scope }}</th>
                <th class="px-4 py-3">{{ locale.logs.message }}</th>
                <th class="w-36 px-4 py-3">{{ locale.logs.requestId }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="h-48 px-4 text-center text-xs text-zinc-600">
                  <Icon name="terminal" :size="22" class-name="mb-2 text-zinc-700" />
                  <p>{{ locale.noData }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel xl:col-span-4">
        <PanelHeader icon="layers" :title="locale.panels.dataSnapshot" />
        <div class="grid grid-cols-1 divide-y divide-zinc-800/80 px-4 sm:grid-cols-2 sm:gap-x-5 sm:divide-y-0 xl:grid-cols-1 xl:gap-x-0 xl:divide-y">
          <div v-for="item in snapshots" :key="item" class="flex items-center justify-between gap-4 py-3.5">
            <span class="text-xs text-zinc-500">{{ item }}</span>
            <span class="text-xs font-semibold text-zinc-300">--</span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'

const { admin } = useLocale()
const locale = computed(() => admin.value?.operations || {})

const selectedScope = ref('all')
const selectedLevel = ref('all')
const selectedRange = ref('1h')
const activeRealtimeRange = ref('1m')
const realtimeRanges = ['1m', '5m', '30m', '1h']

const PanelHeader = defineComponent({
  props: {
    icon: { type: String, required: true },
    title: { type: String, required: true }
  },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'flex min-h-14 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3' }, [
        h('div', { class: 'flex min-w-0 items-center gap-2' }, [
          h(Icon, { name: props.icon, size: 15, className: 'shrink-0 text-blue-400' }),
          h('h3', { class: 'truncate text-sm font-bold text-zinc-200' }, props.title),
          h(Icon, { name: 'info', size: 11, className: 'shrink-0 text-zinc-700' })
        ]),
        slots.default?.()
      ])
  }
})

const scopeOptions = computed(() => [
  { label: locale.value.filters?.allScopes, value: 'all' },
  { label: locale.value.filters?.application, value: 'application' },
  { label: locale.value.filters?.database, value: 'database' }
])

const levelOptions = computed(() => [
  { label: locale.value.filters?.allLevels, value: 'all' },
  { label: locale.value.filters?.errors, value: 'error' },
  { label: locale.value.filters?.warnings, value: 'warning' }
])

const rangeOptions = computed(() => [
  { label: locale.value.filters?.lastHour, value: '1h' },
  { label: locale.value.filters?.lastSixHours, value: '6h' },
  { label: locale.value.filters?.lastDay, value: '24h' }
])

const headerActions = computed(() => [
  { icon: 'refresh', label: locale.value.actions?.refresh },
  { icon: 'bell', label: locale.value.actions?.alertRules },
  { icon: 'settings', label: locale.value.actions?.settings },
  { icon: 'maximize-2', label: locale.value.actions?.fullscreen }
])

const metricCards = computed(() => [
  { label: locale.value.metrics?.requests, unit: '', detail: locale.value.metrics?.requestCount },
  { label: locale.value.metrics?.sla, unit: '%', detail: locale.value.metrics?.exceptions },
  { label: locale.value.metrics?.errorRate, unit: '%', detail: locale.value.metrics?.errorCount },
  { label: locale.value.metrics?.responseTime, unit: 'ms', detail: locale.value.metrics?.p95 },
  { label: locale.value.metrics?.ttft, unit: 'ms', detail: locale.value.metrics?.p99 },
  { label: locale.value.metrics?.upstreamErrors, unit: '%', detail: locale.value.metrics?.upstreamCount }
])

const infrastructureCards = computed(() => [
  { icon: 'cpu', label: locale.value.infrastructure?.cpu, detail: locale.value.infrastructure?.utilization },
  { icon: 'layers', label: locale.value.infrastructure?.memory, detail: locale.value.infrastructure?.usedTotal },
  { icon: 'database', label: locale.value.infrastructure?.database, detail: locale.value.infrastructure?.connections },
  { icon: 'server', label: locale.value.infrastructure?.redis, detail: locale.value.infrastructure?.cache },
  { icon: 'activity', label: locale.value.infrastructure?.concurrency, detail: locale.value.infrastructure?.activePeak },
  { icon: 'history', label: locale.value.infrastructure?.backgroundTasks, detail: locale.value.infrastructure?.taskSummary }
])

const dependencies = computed(() => [
  locale.value.dependencies?.postgresql,
  locale.value.dependencies?.redis,
  locale.value.dependencies?.musicSources,
  locale.value.dependencies?.smtp
])

const snapshots = computed(() => [
  locale.value.snapshots?.activeSemester,
  locale.value.snapshots?.todaySchedule,
  locale.value.snapshots?.playWindow,
  locale.value.snapshots?.requestWindow,
  locale.value.snapshots?.musicSource,
  locale.value.snapshots?.cacheState
])
</script>

<style scoped>
.operations-dashboard {
  width: 100%;
  letter-spacing: 0;
}

.panel {
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.48);
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.16);
}

.health-ring {
  display: grid;
  width: 112px;
  height: 112px;
  place-items: center;
  border: 8px solid rgb(39 39 42);
  border-top-color: rgb(59 130 246);
  border-right-color: rgb(59 130 246 / 0.55);
  border-radius: 50%;
  transform: rotate(34deg);
}

.health-ring__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: rotate(-34deg);
}

.health-ring__inner strong {
  color: rgb(244 244 245);
  font-size: 26px;
  line-height: 1;
}

.health-ring__inner span,
.metric-caption,
.metric-unit {
  color: rgb(113 113 122);
  font-size: 10px;
  font-weight: 600;
}

.chart-grid {
  position: relative;
  overflow: hidden;
  border: 1px solid rgb(39 39 42 / 0.8);
  border-radius: 6px;
  background-color: rgb(9 9 11 / 0.38);
  background-image:
    linear-gradient(rgb(63 63 70 / 0.35) 1px, transparent 1px),
    linear-gradient(90deg, rgb(63 63 70 / 0.35) 1px, transparent 1px);
  background-size: 100% 32px, 56px 100%;
}

.chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgb(82 82 91);
  font-size: 11px;
}

@media (max-width: 639px) {
  .panel {
    min-width: 0;
  }
}
</style>
