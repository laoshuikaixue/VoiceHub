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
        <CustomSelect v-model="selectedScope" :options="scopeOptions" class-name="min-w-0 sm:min-w-32" />
        <CustomSelect v-model="selectedLevel" :options="levelOptions" class-name="min-w-0 sm:min-w-32" />
        <CustomSelect v-model="selectedRange" :options="rangeOptions" class-name="min-w-0 sm:min-w-32" />
        <button
          type="button"
          class="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-xs font-semibold text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 xl:ml-1"
          disabled
        >
          <Icon name="refresh" :size="14" />
          {{ locale.actions.refresh }}
        </button>
      </div>
    </header>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article class="panel min-h-80 xl:col-span-5">
        <div class="flex h-full flex-col gap-7 p-5 sm:flex-row sm:items-center sm:p-6">
          <div class="flex shrink-0 flex-col items-center justify-center border-zinc-800 sm:w-40 sm:border-r sm:pr-6">
            <div class="health-ring">
              <div class="health-ring__inner">
                <strong>--</strong>
                <span>{{ locale.health.server }}</span>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
              <span>{{ locale.health.status }}</span>
              <Icon name="info" :size="12" />
            </div>
            <span class="mt-1 text-xs font-semibold text-zinc-600">{{ locale.health.waiting }}</span>
          </div>

          <div class="min-w-0 flex-1 self-stretch">
            <div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <span class="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              {{ locale.health.environment }}
              <Icon name="info" :size="12" class-name="text-zinc-600" />
            </div>
            <div class="mt-6 grid grid-cols-2 gap-x-5 gap-y-5">
              <div v-for="item in runtimeSummary" :key="item">
                <p class="metric-caption">{{ item }}</p>
                <p class="mt-1 truncate text-sm font-semibold text-zinc-300">--</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3">
        <article v-for="metric in serverMetrics" :key="metric.label" class="panel flex min-h-36 flex-col p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
              <Icon :name="metric.icon" :size="14" class-name="text-zinc-600" />
              {{ metric.label }}
            </div>
            <Icon name="info" :size="11" class-name="text-zinc-700" />
          </div>
          <div class="mt-4 flex items-baseline gap-1.5">
            <strong class="truncate text-2xl text-zinc-100">--</strong>
            <span class="metric-unit">{{ metric.unit }}</span>
          </div>
          <div class="placeholder-bar mt-3"><span /></div>
          <div class="mt-auto pt-3 text-xs text-zinc-600">
            {{ metric.detail }} <span class="float-right text-zinc-400">--</span>
          </div>
        </article>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <article v-for="item in serviceCards" :key="item.label" class="panel min-h-24 p-4">
        <div class="flex items-center justify-between gap-3">
          <span class="flex min-w-0 items-center gap-2 text-xs font-semibold text-zinc-500">
            <Icon :name="item.icon" :size="14" class-name="shrink-0 text-zinc-600" />
            <span class="truncate">{{ item.label }}</span>
          </span>
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700" />
        </div>
        <p class="mt-3 text-lg font-bold text-zinc-300">--</p>
        <p class="mt-1 truncate text-[10px] text-zinc-600">{{ item.detail }}</p>
      </article>
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <article v-for="chart in trendCharts" :key="chart.title" class="panel">
        <div class="panel-header">
          <div class="flex min-w-0 items-center gap-2">
            <Icon :name="chart.icon" :size="15" class-name="shrink-0 text-blue-400" />
            <h3 class="truncate text-sm font-bold text-zinc-200">{{ chart.title }}</h3>
            <Icon name="info" :size="11" class-name="shrink-0 text-zinc-700" />
          </div>
        </div>
        <div class="p-4">
          <div class="chart-grid h-48"><div class="chart-empty">{{ locale.noData }}</div></div>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article class="panel overflow-hidden xl:col-span-7">
        <div class="panel-header">
          <div class="flex min-w-0 items-center gap-2">
            <Icon name="database" :size="15" class-name="shrink-0 text-blue-400" />
            <h3 class="truncate text-sm font-bold text-zinc-200">{{ locale.panels.diskPartitions }}</h3>
            <Icon name="info" :size="11" class-name="shrink-0 text-zinc-700" />
          </div>
          <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[680px] table-fixed text-left">
            <thead class="table-head">
              <tr>
                <th class="w-32 px-4 py-3">{{ locale.disk.mount }}</th>
                <th class="px-4 py-3">{{ locale.disk.filesystem }}</th>
                <th class="w-28 px-4 py-3">{{ locale.disk.used }}</th>
                <th class="w-28 px-4 py-3">{{ locale.disk.available }}</th>
                <th class="w-24 px-4 py-3">{{ locale.disk.usage }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="empty-table-cell">
                  <Icon name="database" :size="21" class-name="mb-2 text-zinc-700" />
                  <p>{{ locale.noData }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel overflow-hidden xl:col-span-5">
        <div class="panel-header">
          <div class="flex min-w-0 items-center gap-2">
            <Icon name="server" :size="15" class-name="shrink-0 text-blue-400" />
            <h3 class="truncate text-sm font-bold text-zinc-200">{{ locale.panels.networkInterfaces }}</h3>
            <Icon name="info" :size="11" class-name="shrink-0 text-zinc-700" />
          </div>
          <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] table-fixed text-left">
            <thead class="table-head">
              <tr>
                <th class="w-28 px-4 py-3">{{ locale.network.name }}</th>
                <th class="px-4 py-3">{{ locale.network.address }}</th>
                <th class="w-28 px-4 py-3">{{ locale.network.received }}</th>
                <th class="w-28 px-4 py-3">{{ locale.network.sent }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" class="empty-table-cell">
                  <Icon name="server" :size="21" class-name="mb-2 text-zinc-700" />
                  <p>{{ locale.noData }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article class="panel overflow-hidden xl:col-span-8">
        <div class="panel-header">
          <div class="flex min-w-0 items-center gap-2">
            <Icon name="terminal" :size="15" class-name="shrink-0 text-blue-400" />
            <h3 class="truncate text-sm font-bold text-zinc-200">{{ locale.panels.runtimeLogs }}</h3>
            <Icon name="info" :size="11" class-name="shrink-0 text-zinc-700" />
          </div>
          <span class="text-[10px] text-zinc-600">{{ locale.logCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] table-fixed text-left">
            <thead class="table-head">
              <tr>
                <th class="w-36 px-4 py-3">{{ locale.logs.time }}</th>
                <th class="w-24 px-4 py-3">{{ locale.logs.level }}</th>
                <th class="w-32 px-4 py-3">{{ locale.logs.scope }}</th>
                <th class="px-4 py-3">{{ locale.logs.message }}</th>
                <th class="w-32 px-4 py-3">{{ locale.logs.requestId }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="empty-table-cell">
                  <Icon name="terminal" :size="21" class-name="mb-2 text-zinc-700" />
                  <p>{{ locale.noData }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel xl:col-span-4">
        <div class="panel-header">
          <div class="flex min-w-0 items-center gap-2">
            <Icon name="layers" :size="15" class-name="shrink-0 text-blue-400" />
            <h3 class="truncate text-sm font-bold text-zinc-200">{{ locale.panels.businessSnapshot }}</h3>
            <Icon name="info" :size="11" class-name="shrink-0 text-zinc-700" />
          </div>
        </div>
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
import { computed, ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'

const { admin } = useLocale()
const locale = computed(() => admin.value?.operations || {})
const selectedScope = ref('all')
const selectedLevel = ref('all')
const selectedRange = ref('1h')

const scopeOptions = computed(() => [
  { label: locale.value.filters?.allScopes, value: 'all' },
  { label: locale.value.filters?.server, value: 'server' },
  { label: locale.value.filters?.services, value: 'services' },
  { label: locale.value.filters?.business, value: 'business' }
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
const runtimeSummary = computed(() => [
  locale.value.runtime?.hostname,
  locale.value.runtime?.platform,
  locale.value.runtime?.architecture,
  locale.value.runtime?.systemUptime,
  locale.value.runtime?.processPid,
  locale.value.runtime?.processUptime,
  locale.value.runtime?.nodeVersion,
  locale.value.runtime?.instanceId
])
const serverMetrics = computed(() => [
  { icon: 'activity', label: locale.value.metrics?.cpuUsage, unit: '%', detail: locale.value.metrics?.loadAverage },
  { icon: 'server', label: locale.value.metrics?.systemMemory, unit: '%', detail: locale.value.metrics?.memoryAvailable },
  { icon: 'database', label: locale.value.metrics?.diskUsage, unit: '%', detail: locale.value.metrics?.diskAvailable },
  { icon: 'monitoring', label: locale.value.metrics?.nodeHeap, unit: '%', detail: locale.value.metrics?.rssMemory },
  { icon: 'chart-line', label: locale.value.metrics?.networkInterfaces, unit: '', detail: locale.value.metrics?.networkTraffic },
  { icon: 'database', label: locale.value.metrics?.databaseConnections, unit: '', detail: locale.value.metrics?.connectionPool }
])
const serviceCards = computed(() => [
  { icon: 'monitoring', label: locale.value.services?.application, detail: locale.value.services?.nodeProcess },
  { icon: 'database', label: locale.value.services?.postgresql, detail: locale.value.services?.database },
  { icon: 'server', label: locale.value.services?.redis, detail: locale.value.services?.cache },
  { icon: 'music', label: locale.value.services?.musicSources, detail: locale.value.services?.providers },
  { icon: 'terminal', label: locale.value.services?.smtp, detail: locale.value.services?.mail },
  { icon: 'activity', label: locale.value.services?.sentry, detail: locale.value.services?.errorTracking }
])
const trendCharts = computed(() => [
  { icon: 'activity', title: locale.value.panels?.cpuTrend },
  { icon: 'chart-line', title: locale.value.panels?.memoryDiskTrend },
  { icon: 'server', title: locale.value.panels?.networkTrend }
])
const snapshots = computed(() => [
  locale.value.snapshots?.activeSemester,
  locale.value.snapshots?.todaySchedule,
  locale.value.snapshots?.todaySongs,
  locale.value.snapshots?.pendingSongs,
  locale.value.snapshots?.playWindow,
  locale.value.snapshots?.requestWindow
])
</script>

<style scoped>
.operations-dashboard { width: 100%; letter-spacing: 0; }
.panel { border: 1px solid rgb(39 39 42); border-radius: 8px; background: rgb(24 24 27 / 0.48); box-shadow: 0 12px 28px rgb(0 0 0 / 0.16); }
.panel-header { display: flex; min-height: 3.5rem; align-items: center; justify-content: space-between; gap: 0.75rem; border-bottom: 1px solid rgb(39 39 42); padding: 0.75rem 1rem; }
.empty-table-cell { height: 10rem; padding: 0 1rem; text-align: center; color: rgb(82 82 91); font-size: 0.75rem; }
.health-ring { display: grid; width: 112px; height: 112px; place-items: center; border: 8px solid rgb(39 39 42); border-top-color: rgb(59 130 246); border-right-color: rgb(59 130 246 / 0.55); border-radius: 50%; transform: rotate(34deg); }
.health-ring__inner { display: flex; flex-direction: column; align-items: center; transform: rotate(-34deg); }
.health-ring__inner strong { color: rgb(244 244 245); font-size: 26px; line-height: 1; }
.health-ring__inner span, .metric-caption, .metric-unit { color: rgb(113 113 122); font-size: 10px; font-weight: 600; }
.placeholder-bar { height: 4px; overflow: hidden; border-radius: 999px; background: rgb(39 39 42); }
.placeholder-bar span { display: block; width: 0; height: 100%; background: rgb(59 130 246); }
.chart-grid { position: relative; overflow: hidden; border: 1px solid rgb(39 39 42 / 0.8); border-radius: 6px; background-color: rgb(9 9 11 / 0.38); background-image: linear-gradient(rgb(63 63 70 / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(63 63 70 / 0.35) 1px, transparent 1px); background-size: 100% 32px, 56px 100%; }
.chart-empty { position: absolute; inset: 0; display: grid; place-items: center; color: rgb(82 82 91); font-size: 11px; }
.table-head { border-bottom: 1px solid rgb(39 39 42); background: rgb(9 9 11 / 0.5); color: rgb(82 82 91); font-size: 10px; font-weight: 600; }
</style>
