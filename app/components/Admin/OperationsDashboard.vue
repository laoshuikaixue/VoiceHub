<template>
  <div class="operations-dashboard space-y-5">
    <header
      class="flex flex-col gap-4 border-b border-zinc-800 pb-5 xl:flex-row xl:items-center xl:justify-between"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2.5">
          <span class="title-icon"><Icon name="monitoring" :size="17" /></span>
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
      <button type="button" class="refresh-button" disabled>
        <Icon name="refresh" :size="14" />{{ locale.actions.refresh }}
      </button>
    </header>

    <nav class="group-tabs" :aria-label="locale.title">
      <button
        v-for="group in monitorGroups"
        :key="group.value"
        type="button"
        class="group-tab"
        :class="{ 'group-tab--active': activeGroup === group.value }"
        :aria-selected="activeGroup === group.value"
        @click="activeGroup = group.value"
      >
        <Icon :name="group.icon" :size="14" />
        <span>{{ group.label }}</span>
      </button>
    </nav>

    <template v-if="activeGroup === 'overview'">
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel xl:col-span-5">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.overview.systemHealth }}</h3>
              <p class="panel-description">{{ locale.overview.systemHealthDetail }}</p>
            </div>
            <span class="status-badge">{{ locale.health.waiting }}</span>
          </div>
          <div class="health-layout">
            <div class="health-score-wrap">
              <div class="health-score-ring">
                <strong>--</strong>
                <span>{{ locale.overview.healthScore }}</span>
              </div>
              <p>{{ locale.noData }}</p>
            </div>
            <div class="health-dependencies">
              <div class="health-dependencies__title">
                <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {{ locale.overview.healthFactors }}
              </div>
              <div v-for="item in healthDependencies" :key="item.label" class="dependency-row">
                <span class="dependency-name">
                  <Icon :name="item.icon" :size="13" />{{ item.label }}
                </span>
                <span class="dependency-value">--</span>
              </div>
            </div>
          </div>
        </article>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3">
          <article v-for="item in overviewSignals" :key="item.label" class="signal-card">
            <div class="signal-card__header">
              <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
              <span class="metric-label">{{ item.label }}</span>
            </div>
            <strong class="metric-value">--</strong>
            <p class="metric-detail">{{ item.detail }}</p>
          </article>
        </div>
      </section>

      <section class="resource-strip">
        <article v-for="item in overviewResources" :key="item.label" class="resource-item">
          <div class="flex items-center gap-2 text-zinc-500">
            <Icon :name="item.icon" :size="14" />
            <span>{{ item.label }}</span>
          </div>
          <strong>--</strong>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.overview.services }}</h3>
              <p class="panel-description">{{ locale.overview.servicesDetail }}</p>
            </div>
          </div>
          <div class="service-list">
            <div v-for="item in serviceRows" :key="item.label" class="service-row">
              <span class="service-row__icon"><Icon :name="item.icon" :size="15" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-zinc-300">{{ item.label }}</p>
                <p class="mt-1 text-xs text-zinc-600">{{ item.detail }}</p>
              </div>
              <span class="text-xs font-semibold text-zinc-600">--</span>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.overview.runtimeDetails }}</h3>
              <p class="panel-description">{{ locale.overview.runtimeDetailsDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid">
            <div v-for="item in runtimeDetails" :key="item">
              <dt>{{ item }}</dt>
              <dd>--</dd>
            </div>
          </dl>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'online'">
      <section class="metric-grid">
        <article v-for="item in onlineMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top">
            <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
            <span class="metric-label">{{ item.label }}</span>
          </div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="panel-title">{{ locale.online.activitySummary }}</h3>
          </div>
          <dl class="summary-grid">
            <div v-for="item in onlineActivityDetails" :key="item">
              <dt>{{ item }}</dt>
              <dd>--</dd>
            </div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3 class="panel-title">{{ locale.online.accountSummary }}</h3>
          </div>
          <div class="status-list">
            <div v-for="item in onlineAccountDetails" :key="item">
              <div class="flex items-center justify-between gap-4">
                <span>{{ item }}</span><strong>--</strong>
              </div>
              <div class="empty-progress"><span /></div>
            </div>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="panel-title">{{ locale.online.activeRanking }}</h3>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[520px]">
              <thead>
                <tr>
                  <th class="w-44">{{ locale.online.user }}</th>
                  <th>{{ locale.online.contributions }}</th>
                  <th>{{ locale.online.likes }}</th>
                  <th>{{ locale.online.activityScore }}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="4" class="empty-cell">{{ locale.noData }}</td></tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="panel-title">{{ locale.online.recentLoginUsers }}</h3>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th class="w-40">{{ locale.online.account }}</th>
                  <th>{{ locale.online.ip }}</th>
                  <th>{{ locale.online.accountStatus }}</th>
                  <th>{{ locale.online.lastLogin }}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="4" class="empty-cell">{{ locale.noData }}</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'server'">
      <section class="metric-grid">
        <article v-for="item in serverMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top">
            <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
            <span class="metric-label">{{ item.label }}</span>
          </div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.server.runtime }}</h3></div>
          <dl class="detail-grid">
            <div v-for="item in runtimeDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.server.database }}</h3></div>
          <dl class="detail-grid">
            <div v-for="item in databaseDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.server.databasePerformance }}</h3>
            <p class="panel-description">{{ locale.server.databasePerformanceDetail }}</p>
          </div>
        </div>
        <dl class="detail-grid detail-grid--wide">
          <div v-for="item in databasePerformanceDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
        </dl>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.server.schemaStatus }}</h3>
            <p class="panel-description">{{ locale.server.schemaStatusDetail }}</p>
          </div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[560px]">
            <thead><tr><th>{{ locale.server.tableName }}</th><th>{{ locale.server.tableStatus }}</th><th>{{ locale.server.tableValue }}</th></tr></thead>
            <tbody><tr v-for="item in schemaTables" :key="item"><td>{{ item }}</td><td>--</td><td>--</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.server.memoryDetails }}</h3></div>
          <div class="status-list">
            <div v-for="item in memoryDetails" :key="item">
              <div class="flex items-center justify-between gap-4"><span>{{ item }}</span><strong>--</strong></div>
              <div class="empty-progress"><span /></div>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.server.instanceDetails }}</h3></div>
          <dl class="detail-grid detail-grid--compact">
            <div v-for="item in instanceDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'cache'">
      <section class="metric-grid">
        <article v-for="item in cacheMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top">
            <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
            <span class="metric-label">{{ item.label }}</span>
          </div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.cache.connection }}</h3></div>
          <dl class="detail-grid">
            <div v-for="item in cacheDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.cache.note }}</h3></div>
          <p class="panel-copy">{{ locale.cache.description }}</p>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header"><h3 class="panel-title">{{ locale.cache.usageScope }}</h3></div>
        <div class="scope-grid">
          <div v-for="item in cacheUsageScopes" :key="item.label" class="scope-row">
            <span class="service-row__icon"><Icon :name="item.icon" :size="15" /></span>
            <div>
              <p class="text-sm font-semibold text-zinc-300">{{ item.label }}</p>
              <p class="mt-1 text-xs leading-5 text-zinc-600">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="activeGroup === 'audit'">
      <section class="metric-grid">
        <article v-for="item in auditMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top">
            <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
            <span class="metric-label">{{ item.label }}</span>
          </div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <h3 class="panel-title">{{ locale.audit.statusLogs }}</h3>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>{{ locale.logs.time }}</th>
                <th>{{ locale.audit.account }}</th>
                <th>{{ locale.audit.statusTransition }}</th>
                <th>{{ locale.audit.operator }}</th>
                <th>{{ locale.audit.reason }}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.audit.apiAccessLogs }}</h3>
            <p class="panel-description">{{ locale.audit.apiAccessLogsDetail }}</p>
          </div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>{{ locale.logs.time }}</th>
                <th>{{ locale.audit.endpoint }}</th>
                <th>{{ locale.audit.method }}</th>
                <th>{{ locale.audit.statusCode }}</th>
                <th>{{ locale.audit.responseTime }}</th>
                <th>{{ locale.audit.ip }}</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.audit.apiLogSummary }}</h3>
            <p class="panel-description">{{ locale.audit.apiLogSummaryDetail }}</p>
          </div>
        </div>
        <dl class="detail-grid detail-grid--wide">
          <div v-for="item in apiLogDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
        </dl>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.audit.sources }}</h3></div>
          <div class="service-list">
            <div v-for="item in auditSources" :key="item" class="service-row">
              <span class="service-row__icon"><Icon name="history" :size="15" /></span>
              <span class="flex-1 text-sm font-semibold text-zinc-300">{{ item }}</span>
              <span class="text-xs text-zinc-600">--</span>
            </div>
          </div>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="panel-title">{{ locale.audit.loginRecords }}</h3>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[520px]">
              <thead>
                <tr>
                  <th>{{ locale.audit.account }}</th>
                  <th>{{ locale.audit.ip }}</th>
                  <th>{{ locale.audit.accountStatus }}</th>
                  <th>{{ locale.logs.time }}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="4" class="empty-cell">{{ locale.noData }}</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'

const { admin } = useLocale()
const locale = computed(() => admin.value?.operations || {})
const activeGroup = ref('overview')

const monitorGroups = computed(() => [
  { icon: 'monitoring', label: locale.value.groups?.overview, value: 'overview' },
  { icon: 'users', label: locale.value.groups?.onlineUsers, value: 'online' },
  { icon: 'server', label: locale.value.groups?.serverMonitoring, value: 'server' },
  { icon: 'database', label: locale.value.groups?.cacheMonitoring, value: 'cache' },
  { icon: 'warning', label: locale.value.groups?.securityAudit, value: 'audit' }
])

const healthDependencies = computed(() => [
  { icon: 'monitoring', label: locale.value.services?.application },
  { icon: 'database', label: locale.value.services?.postgresql },
  { icon: 'server', label: locale.value.services?.redis },
  { icon: 'activity', label: locale.value.server?.telemetry }
])

const overviewSignals = computed(() => [
  { icon: 'clock', label: locale.value.server?.uptime, detail: locale.value.server?.uptimeDetail },
  { icon: 'activity', label: locale.value.server?.heapUsed, detail: locale.value.server?.memoryDetail },
  { icon: 'activity', label: locale.value.server?.heapTotal, detail: locale.value.server?.memoryDetail },
  {
    icon: 'database',
    label: locale.value.server?.poolActive,
    detail: locale.value.server?.poolDetail
  },
  {
    icon: 'database',
    label: locale.value.server?.poolTotal,
    detail: locale.value.server?.poolDetail
  },
  {
    icon: 'server',
    label: locale.value.cache?.ready,
    detail: locale.value.cache?.readyDetail
  }
])

const overviewResources = computed(() => [
  { icon: 'monitoring', label: locale.value.server?.nodeVersion },
  { icon: 'terminal', label: locale.value.runtime?.platform },
  { icon: 'settings', label: locale.value.runtime?.architecture },
  { icon: 'activity', label: locale.value.server?.externalMemory },
  { icon: 'database', label: locale.value.server?.probe },
  { icon: 'server', label: locale.value.runtime?.instanceId }
])

const serviceRows = computed(() => [
  {
    icon: 'monitoring',
    label: locale.value.services?.application,
    detail: locale.value.overview?.applicationDetail
  },
  {
    icon: 'database',
    label: locale.value.services?.postgresql,
    detail: locale.value.overview?.databaseDetail
  },
  {
    icon: 'server',
    label: locale.value.services?.redis,
    detail: locale.value.overview?.redisDetail
  }
])

const runtimeDetails = computed(() => [
  locale.value.runtime?.platform,
  locale.value.runtime?.architecture,
  locale.value.runtime?.nodeVersion,
  locale.value.runtime?.instanceId,
  locale.value.server?.uptime,
  locale.value.server?.telemetry
])

const onlineMetrics = computed(() => [
  {
    icon: 'activity',
    label: locale.value.online?.recentActive,
    detail: locale.value.online?.recentActiveDetail
  },
  {
    icon: 'music',
    label: locale.value.online?.todayRequests,
    detail: locale.value.online?.todayRequestsDetail
  },
  {
    icon: 'users',
    label: locale.value.online?.activeContributors,
    detail: locale.value.online?.activeContributorsDetail
  },
  {
    icon: 'settings',
    label: locale.value.online?.totalUsers,
    detail: locale.value.online?.totalUsersDetail
  },
  {
    icon: 'activity',
    label: locale.value.online?.activeUserPercentage,
    detail: locale.value.online?.activeUserPercentageDetail
  },
  {
    icon: 'music',
    label: locale.value.online?.averageSongsPerUser,
    detail: locale.value.online?.averageSongsPerUserDetail
  },
  {
    icon: 'clock',
    label: locale.value.online?.peakHours,
    detail: locale.value.online?.peakHoursDetail
  }
])

const onlineActivityDetails = computed(() => [
  locale.value.online?.recentActive,
  locale.value.online?.todayRequests,
  locale.value.online?.activeContributors,
  locale.value.online?.peakHours
])

const onlineAccountDetails = computed(() => [
  locale.value.online?.activeAccounts,
  locale.value.online?.withdrawnAccounts,
  locale.value.online?.graduatedAccounts
])

const serverMetrics = computed(() => [
  { icon: 'clock', label: locale.value.server?.uptime, detail: locale.value.server?.uptimeDetail },
  {
    icon: 'activity',
    label: locale.value.server?.memory,
    detail: locale.value.server?.memoryDetail
  },
  {
    icon: 'monitoring',
    label: locale.value.server?.nodeVersion,
    detail: locale.value.server?.runtimeDetail
  },
  {
    icon: 'database',
    label: locale.value.server?.databasePool,
    detail: locale.value.server?.poolDetail
  },
  {
    icon: 'activity',
    label: locale.value.server?.responseTime,
    detail: locale.value.server?.databasePerformanceDetail
  },
  {
    icon: 'database',
    label: locale.value.server?.poolUtilization,
    detail: locale.value.server?.poolDetail
  },
  {
    icon: 'success',
    label: locale.value.server?.cacheHitRatio,
    detail: locale.value.server?.databasePerformanceDetail
  },
  {
    icon: 'activity',
    label: locale.value.server?.transactionsCommitted,
    detail: locale.value.server?.databasePerformanceDetail
  }
])

const databaseDetails = computed(() => [
  locale.value.server?.connection,
  locale.value.server?.responseTime,
  locale.value.server?.poolMax,
  locale.value.server?.poolActive,
  locale.value.server?.poolTotal,
  locale.value.server?.poolUtilization,
  locale.value.server?.probe
])

const databasePerformanceDetails = computed(() => [
  locale.value.server?.transactionsCommitted,
  locale.value.server?.transactionsRolledBack,
  locale.value.server?.cacheHitRatio,
  locale.value.server?.responseTime
])

const schemaTables = computed(() => [
  locale.value.server?.usersTable,
  locale.value.server?.songsTable,
  locale.value.server?.votesTable,
  locale.value.server?.scheduleTable,
  locale.value.server?.notificationsTable,
  locale.value.server?.totalUsers
])

const memoryDetails = computed(() => [
  locale.value.server?.heapUsed,
  locale.value.server?.heapTotal,
  locale.value.server?.externalMemory
])

const instanceDetails = computed(() => [
  locale.value.runtime?.platform,
  locale.value.runtime?.architecture,
  locale.value.runtime?.instanceId,
  locale.value.server?.telemetry
])

const cacheMetrics = computed(() => [
  {
    icon: 'database',
    label: locale.value.cache?.configured,
    detail: locale.value.cache?.configuredDetail
  },
  { icon: 'success', label: locale.value.cache?.ready, detail: locale.value.cache?.readyDetail },
  {
    icon: 'settings',
    label: locale.value.cache?.keyPrefix,
    detail: locale.value.cache?.prefixDetail
  },
  { icon: 'clock', label: locale.value.cache?.lastConnected, detail: locale.value.cache?.connectionDetail },
  { icon: 'warning', label: locale.value.cache?.lastError, detail: locale.value.cache?.errorDetail }
])

const cacheDetails = computed(() => [
  locale.value.cache?.keyPrefix,
  locale.value.cache?.lastConnected,
  locale.value.cache?.lastError
])

const cacheUsageScopes = computed(() => [
  {
    icon: 'activity',
    label: locale.value.cache?.shortState,
    detail: locale.value.cache?.shortStateDetail
  },
  {
    icon: 'warning',
    label: locale.value.cache?.rateLimit,
    detail: locale.value.cache?.rateLimitDetail
  },
  { icon: 'check', label: locale.value.cache?.captcha, detail: locale.value.cache?.captchaDetail },
  {
    icon: 'database',
    label: locale.value.cache?.managerCache,
    detail: locale.value.cache?.managerCacheDetail
  }
])

const auditMetrics = computed(() => [
  {
    icon: 'warning',
    label: locale.value.audit?.statusChanges,
    detail: locale.value.audit?.statusChangesDetail
  },
  {
    icon: 'history',
    label: locale.value.audit?.apiSuccessRequests,
    detail: locale.value.audit?.apiSuccessRequestsDetail
  },
  {
    icon: 'clock',
    label: locale.value.audit?.apiErrorRequests,
    detail: locale.value.audit?.apiErrorRequestsDetail
  },
  {
    icon: 'activity',
    label: locale.value.audit?.apiAverageResponse,
    detail: locale.value.audit?.apiAverageResponseDetail
  },
  {
    icon: 'clock',
    label: locale.value.audit?.apiMaxResponse,
    detail: locale.value.audit?.apiMaxResponseDetail
  }
])

const apiLogDetails = computed(() => [
  locale.value.audit?.apiRequests,
  locale.value.audit?.apiSuccessRequests,
  locale.value.audit?.apiErrorRequests,
  locale.value.audit?.apiAverageResponse,
  locale.value.audit?.apiMinResponse,
  locale.value.audit?.apiMaxResponse
])

const auditSources = computed(() => [
  locale.value.audit?.userStatus,
  locale.value.audit?.userLogin,
  locale.value.audit?.apiKeyAccess
])
</script>

<style scoped>
.operations-dashboard {
  width: 100%;
  letter-spacing: 0;
}

.title-icon,
.metric-icon,
.service-row__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: rgb(96 165 250);
  background: rgb(59 130 246 / 0.1);
}

.title-icon {
  width: 2rem;
  height: 2rem;
  border: 1px solid rgb(59 130 246 / 0.2);
  border-radius: 7px;
}

.refresh-button {
  display: inline-flex;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid rgb(39 39 42);
  border-radius: 6px;
  padding: 0 0.75rem;
  color: rgb(113 113 122);
  background: rgb(24 24 27 / 0.55);
  font-size: 0.75rem;
  font-weight: 600;
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.group-tabs {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  border-bottom: 1px solid rgb(39 39 42);
}

.group-tab {
  position: relative;
  display: inline-flex;
  min-height: 2.75rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.8rem;
  color: rgb(113 113 122);
  font-size: 0.75rem;
  font-weight: 600;
  transition: color 150ms ease;
}

.group-tab::after {
  position: absolute;
  right: 0.75rem;
  bottom: -1px;
  left: 0.75rem;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  content: '';
}

.group-tab:hover {
  color: rgb(212 212 216);
}

.group-tab--active {
  color: rgb(96 165 250);
}

.group-tab--active::after {
  background: rgb(59 130 246);
}

.panel,
.signal-card,
.metric-card,
.resource-strip {
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.44);
}

.panel,
.signal-card,
.metric-card {
  min-width: 0;
}

.panel-header {
  display: flex;
  min-height: 4rem;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42);
  padding: 1rem;
}

.panel-title {
  color: rgb(228 228 231);
  font-size: 0.875rem;
  font-weight: 700;
}

.panel-description {
  margin-top: 0.35rem;
  color: rgb(82 82 91);
  font-size: 0.6875rem;
  line-height: 1.4;
}

.status-badge {
  flex: 0 0 auto;
  border: 1px solid rgb(63 63 70);
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  color: rgb(113 113 122);
  font-size: 0.625rem;
  font-weight: 600;
}

.health-layout {
  display: flex;
  min-height: 15.5rem;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem;
}

.health-score-wrap {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.health-score-wrap > p {
  margin-top: 0.75rem;
  color: rgb(82 82 91);
  font-size: 0.6875rem;
}

.health-score-ring {
  display: flex;
  width: 7.75rem;
  height: 7.75rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 10px solid rgb(39 39 42);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(9 9 11 / 0.7);
}

.health-score-ring strong {
  color: rgb(244 244 245);
  font-size: 1.75rem;
  line-height: 1;
}

.health-score-ring span {
  margin-top: 0.45rem;
  color: rgb(113 113 122);
  font-size: 0.625rem;
  font-weight: 600;
}

.health-dependencies {
  min-width: 0;
  flex: 1;
  align-self: stretch;
  border-top: 1px solid rgb(39 39 42);
}

.health-dependencies__title {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
  color: rgb(161 161 170);
  font-size: 0.75rem;
  font-weight: 700;
}

.dependency-row {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.dependency-name {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
  color: rgb(161 161 170);
  font-size: 0.75rem;
  font-weight: 600;
}

.dependency-value {
  color: rgb(82 82 91);
  font-size: 0.75rem;
  font-weight: 700;
}

.signal-card,
.metric-card {
  display: flex;
  min-height: 8.75rem;
  flex-direction: column;
  padding: 1rem;
}

.signal-card__header,
.metric-card__top {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
}

.metric-icon,
.service-row__icon {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 6px;
}

.metric-label {
  min-width: 0;
  color: rgb(161 161 170);
  font-size: 0.75rem;
  font-weight: 600;
}

.metric-value {
  margin-top: 1rem;
  color: rgb(244 244 245);
  font-size: 1.5rem;
  line-height: 1;
}

.metric-detail {
  margin-top: auto;
  padding-top: 0.9rem;
  color: rgb(82 82 91);
  font-size: 0.6875rem;
  line-height: 1.4;
}

.resource-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
}

.resource-item {
  min-width: 0;
  min-height: 6.5rem;
  padding: 1rem;
  font-size: 0.75rem;
}

.resource-item:nth-child(odd) {
  border-right: 1px solid rgb(39 39 42 / 0.75);
}

.resource-item:nth-child(-n + 4) {
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.resource-item strong {
  display: block;
  margin-top: 1rem;
  color: rgb(228 228 231);
  font-size: 1rem;
}

.service-list {
  padding: 0 1rem;
}

.service-row {
  display: flex;
  min-height: 4.25rem;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.service-row:last-child {
  border-bottom: 0;
}

.detail-grid,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-grid > div,
.summary-grid > div {
  min-width: 0;
  min-height: 5rem;
  padding: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.detail-grid > div:nth-child(odd),
.summary-grid > div:nth-child(odd) {
  border-right: 1px solid rgb(39 39 42 / 0.75);
}

.detail-grid dt,
.summary-grid dt {
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  font-weight: 600;
}

.detail-grid dd,
.summary-grid dd {
  margin-top: 0.7rem;
  overflow: hidden;
  color: rgb(212 212 216);
  font-size: 0.875rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.summary-grid {
  grid-template-columns: minmax(0, 1fr);
}

.status-list {
  display: grid;
  gap: 1.1rem;
  padding: 1.1rem;
  color: rgb(161 161 170);
  font-size: 0.75rem;
}

.status-list strong {
  color: rgb(212 212 216);
}

.empty-progress {
  height: 3px;
  margin-top: 0.65rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(39 39 42);
}

.empty-progress span {
  display: block;
  width: 0;
  height: 100%;
  background: rgb(59 130 246);
}

.panel-copy {
  padding: 1.25rem;
  color: rgb(113 113 122);
  font-size: 0.75rem;
  line-height: 1.75;
}

.scope-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.scope-row {
  display: flex;
  min-width: 0;
  min-height: 5.5rem;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.item-count {
  flex: 0 0 auto;
  color: rgb(82 82 91);
  font-size: 0.625rem;
}

.data-table {
  width: 100%;
  table-layout: fixed;
  text-align: left;
}

.data-table thead {
  color: rgb(82 82 91);
  background: rgb(9 9 11 / 0.38);
  font-size: 0.625rem;
  font-weight: 600;
}

.data-table th {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgb(39 39 42);
}

.empty-cell {
  height: 9rem;
  padding: 0 1rem;
  color: rgb(82 82 91);
  text-align: center;
  font-size: 0.75rem;
}

@media (min-width: 640px) {
  .health-layout {
    flex-direction: row;
    align-items: center;
  }

  .health-score-wrap {
    width: 10rem;
  }

  .health-dependencies {
    border-top: 0;
    border-left: 1px solid rgb(39 39 42);
    padding-left: 1.25rem;
  }

  .resource-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .resource-item {
    border-right: 0;
    border-bottom: 0;
  }

  .resource-item:not(:nth-child(3n)) {
    border-right: 1px solid rgb(39 39 42 / 0.75);
  }

  .resource-item:nth-child(-n + 3) {
    border-bottom: 1px solid rgb(39 39 42 / 0.75);
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summary-grid > div:nth-child(odd) {
    border-right: 0;
  }

  .summary-grid > div:not(:last-child) {
    border-right: 1px solid rgb(39 39 42 / 0.75);
  }

  .scope-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scope-row:nth-child(odd) {
    border-right: 1px solid rgb(39 39 42 / 0.75);
  }
}

@media (min-width: 1280px) {
  .resource-strip {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .resource-item,
  .resource-item:nth-child(-n + 3) {
    border-bottom: 0;
  }

  .resource-item:not(:last-child) {
    border-right: 1px solid rgb(39 39 42 / 0.75);
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
