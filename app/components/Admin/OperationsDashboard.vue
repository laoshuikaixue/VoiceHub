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
            <div class="health-live-details">
              <div class="health-live-details__title">{{ locale.overview.healthRealtime }}</div>
              <div v-for="item in healthLiveDetails" :key="item" class="health-live-row">
                <span>{{ item }}</span><strong>--</strong>
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

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.overview.sourceStatus }}</h3>
              <p class="panel-description">{{ locale.overview.sourceStatusDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="service-list">
            <div v-for="item in sourceRows" :key="item.label" class="service-row">
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
              <h3 class="panel-title">{{ locale.overview.serviceDependencies }}</h3>
              <p class="panel-description">{{ locale.overview.serviceDependenciesDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="service-list">
            <div v-for="item in dependencyRows" :key="item.label" class="service-row">
              <span class="service-row__icon"><Icon :name="item.icon" :size="15" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-zinc-300">{{ item.label }}</p>
                <p class="mt-1 text-xs text-zinc-600">{{ item.detail }}</p>
              </div>
              <span class="text-xs font-semibold text-zinc-600">--</span>
            </div>
          </div>
        </article>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.overview.warningEvents }}</h3>
            <p class="panel-description">{{ locale.overview.warningEventsDetail }}</p>
          </div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="overview-event-filters">
          <button type="button" class="filter-field" disabled><span>{{ locale.overview.lastTwentyFourHours }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.overview.allAlertLevels }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.overview.allAlertStatuses }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-action" disabled><Icon name="refresh" :size="13" />{{ locale.actions.refresh }}</button>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[1120px]">
            <thead>
              <tr>
                <th>{{ locale.logs.time }}</th>
                <th>{{ locale.logs.level }}</th>
                <th>{{ locale.overview.alertStatus }}</th>
                <th>{{ locale.overview.alertSource }}</th>
                <th>{{ locale.overview.alertContent }}</th>
                <th>{{ locale.overview.recoveryDuration }}</th>
                <th>{{ locale.overview.alertMetric }}</th>
                <th>{{ locale.overview.alertAction }}</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="8" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.overview.systemLogs }}</h3>
            <p class="panel-description">{{ locale.overview.systemLogsDetail }}</p>
          </div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="log-config">
          <div class="log-config__title">{{ locale.overview.logArchiveSettings }}</div>
          <div class="log-config__fields">
            <label class="filter-field"><span>{{ locale.overview.logLevel }}</span><Icon name="chevron-down" :size="13" /></label>
            <label class="filter-field"><span>{{ locale.overview.logScope }}</span><Icon name="chevron-down" :size="13" /></label>
            <label class="filter-field"><span>{{ locale.overview.logSampleRate }}</span><strong>--</strong></label>
            <label class="filter-field"><span>{{ locale.overview.logRetentionDays }}</span><strong>--</strong></label>
            <button type="button" class="filter-action" disabled><Icon name="settings" :size="13" />{{ locale.overview.saveLogSettings }}</button>
          </div>
        </div>
        <div class="overview-log-filters">
          <label class="filter-field filter-field--wide"><Icon name="search" :size="13" /><input type="text" :placeholder="locale.overview.logKeyword" disabled /></label>
          <label class="filter-field"><span>{{ locale.overview.logTimeRange }}</span><Icon name="chevron-down" :size="13" /></label>
          <label class="filter-field"><span>{{ locale.overview.logLevel }}</span><Icon name="chevron-down" :size="13" /></label>
          <label class="filter-field"><span>{{ locale.overview.logScope }}</span><Icon name="chevron-down" :size="13" /></label>
          <button type="button" class="filter-action" disabled><Icon name="search" :size="13" />{{ locale.overview.queryLogs }}</button>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[980px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.overview.logHost }}</th><th>{{ locale.logs.level }}</th><th>{{ locale.logs.scope }}</th><th>{{ locale.logs.message }}</th><th>{{ locale.overview.logRequestId }}</th></tr></thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
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
      <section class="server-summary-strip">
        <div v-for="item in serverSummaryDetails" :key="item"><span>{{ item }}</span><strong>--</strong></div>
      </section>

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

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel xl:col-span-5">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.server.healthScore }}</h3>
              <p class="panel-description">{{ locale.server.healthScoreDetail }}</p>
            </div>
            <span class="status-badge">{{ locale.health.waiting }}</span>
          </div>
          <div class="server-health-layout">
            <div class="health-score-ring"><strong>--</strong><span>{{ locale.overview.healthScore }}</span></div>
            <dl class="server-health-details">
              <div v-for="item in serverHealthDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
            </dl>
          </div>
        </article>

        <article class="panel xl:col-span-7">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.server.runtime }}</h3>
              <p class="panel-description">{{ locale.server.runtimeEnvironmentDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid">
            <div v-for="item in serverRuntimeDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>

      <section class="server-resource-grid">
        <article v-for="panel in serverResourcePanels" :key="panel.title" class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ panel.title }}</h3>
              <p class="panel-description">{{ panel.detail }}</p>
            </div>
            <span class="metric-icon"><Icon :name="panel.icon" :size="14" /></span>
          </div>
          <dl class="server-resource-list">
            <div v-for="item in panel.items" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.server.diskPartitions }}</h3>
              <p class="panel-description">{{ locale.server.diskPartitionsDetail }}</p>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[620px]">
              <thead><tr><th>{{ locale.disk.mount }}</th><th>{{ locale.disk.filesystem }}</th><th>{{ locale.disk.used }}</th><th>{{ locale.disk.available }}</th><th>{{ locale.disk.usage }}</th></tr></thead>
              <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>

        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.server.networkInterfaces }}</h3>
              <p class="panel-description">{{ locale.server.networkInterfacesDetail }}</p>
            </div>
            <span class="item-count">{{ locale.server.externalAddressCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[620px]">
              <thead><tr><th>{{ locale.network.name }}</th><th>{{ locale.network.address }}</th><th>{{ locale.server.addressFamily }}</th><th>{{ locale.server.addressScope }}</th></tr></thead>
              <tbody><tr><td colspan="4" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><h3 class="panel-title">{{ locale.server.database }}</h3></div>
          <dl class="detail-grid">
            <div v-for="item in databaseDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.server.databasePerformance }}</h3>
              <p class="panel-description">{{ locale.server.databasePerformanceDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid">
            <div v-for="item in databasePerformanceDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
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

    <template v-else-if="activeGroup === 'analytics'">
      <section class="metric-grid">
        <article v-for="item in analysisMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top">
            <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
            <span class="metric-label">{{ item.label }}</span>
          </div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel xl:col-span-4">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.analytics.engagementDistribution }}</h3>
              <p class="panel-description">{{ locale.analytics.engagementDistributionDetail }}</p>
            </div>
          </div>
          <div class="analysis-donut-wrap">
            <div class="analysis-donut"><strong>--</strong><span>{{ locale.analytics.totalUsers }}</span></div>
          </div>
          <div class="analysis-legend">
            <div v-for="item in analysisEngagementSegments" :key="item.label">
              <span><i :class="item.tone" />{{ item.label }}</span><strong>--</strong>
            </div>
          </div>
        </article>

        <article class="panel xl:col-span-8">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.analytics.requestTrend }}</h3>
              <p class="panel-description">{{ locale.analytics.requestTrendDetail }}</p>
            </div>
            <span class="item-count">{{ locale.analytics.lastThirtyDays }}</span>
          </div>
          <div class="analysis-chart-placeholder">
            <div class="analysis-chart-grid"><i v-for="index in 5" :key="index" /></div>
            <span>{{ locale.noData }}</span>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel overflow-hidden xl:col-span-7">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.analytics.semesterComparison }}</h3>
              <p class="panel-description">{{ locale.analytics.semesterComparisonDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[660px]">
              <thead><tr><th>{{ locale.analytics.semester }}</th><th>{{ locale.analytics.totalSongs }}</th><th>{{ locale.analytics.scheduledSongs }}</th><th>{{ locale.analytics.votedSongs }}</th><th>{{ locale.analytics.semesterStatus }}</th></tr></thead>
              <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>

        <article class="panel xl:col-span-5">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.analytics.engagementSummary }}</h3>
              <p class="panel-description">{{ locale.analytics.engagementSummaryDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid">
            <div v-for="item in analysisEngagementDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel overflow-hidden xl:col-span-8">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.analytics.topSongs }}</h3>
              <p class="panel-description">{{ locale.analytics.topSongsDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[680px]">
              <thead><tr><th>{{ locale.analytics.rank }}</th><th>{{ locale.analytics.song }}</th><th>{{ locale.analytics.artist }}</th><th>{{ locale.analytics.requester }}</th><th>{{ locale.analytics.votesOrReplays }}</th></tr></thead>
              <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>

        <article class="panel xl:col-span-4">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.analytics.peakHours }}</h3>
              <p class="panel-description">{{ locale.analytics.peakHoursDetail }}</p>
            </div>
          </div>
          <div class="peak-list">
            <div v-for="item in analysisPeakHours" :key="item">
              <span><Icon name="clock" :size="13" />{{ item }}</span><strong>--</strong>
            </div>
          </div>
        </article>
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

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel xl:col-span-7">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.audit.pendingRiskDistribution }}</h3>
              <p class="panel-description">{{ locale.audit.pendingRiskDistributionDetail }}</p>
            </div>
            <span class="risk-badge">{{ locale.audit.pending }}</span>
          </div>
          <div class="risk-distribution">
            <div class="risk-total">
              <span class="risk-total__icon"><Icon name="warning" :size="18" /></span>
              <strong>--</strong>
              <p>{{ locale.audit.unresolvedEvents }}</p>
            </div>
            <div class="risk-levels">
              <div v-for="item in riskLevels" :key="item.label" class="risk-level-row">
                <span class="risk-level-name"><i :class="item.tone" />{{ item.label }}</span>
                <strong>--</strong>
              </div>
            </div>
          </div>
        </article>

        <article class="panel overflow-hidden xl:col-span-5">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.audit.highRiskIps }}</h3>
              <p class="panel-description">{{ locale.audit.highRiskIpsDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[480px]">
              <thead><tr><th>{{ locale.audit.sourceIp }}</th><th>{{ locale.audit.triggerCount }}</th><th>{{ locale.audit.riskScore }}</th><th>{{ locale.audit.lastTriggered }}</th></tr></thead>
              <tbody><tr><td colspan="4" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.audit.recentHighRiskEvents }}</h3>
            <p class="panel-description">{{ locale.audit.recentHighRiskEventsDetail }}</p>
          </div>
          <span class="risk-badge">{{ locale.audit.highRisk }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[760px]">
            <thead><tr><th>{{ locale.audit.eventTitle }}</th><th>{{ locale.audit.riskLevel }}</th><th>{{ locale.audit.riskScore }}</th><th>{{ locale.audit.sourceIp }}</th><th>{{ locale.audit.triggerCount }}</th><th>{{ locale.audit.lastTriggered }}</th></tr></thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="panel audit-events overflow-hidden">
        <div class="panel-header audit-events__header">
          <div>
            <h3 class="panel-title">{{ locale.audit.eventList }}</h3>
            <p class="panel-description">{{ locale.audit.eventListDetail }}</p>
          </div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="audit-filters">
          <label class="filter-field filter-field--wide">
            <Icon name="search" :size="13" />
            <input type="text" :placeholder="locale.audit.keywordFilter" disabled />
          </label>
          <button type="button" class="filter-field" disabled><span>{{ locale.audit.allRiskLevels }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.audit.allHandlingStatuses }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-action" disabled><Icon name="search" :size="13" />{{ locale.audit.query }}</button>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[1120px]">
            <thead>
              <tr>
                <th>{{ locale.audit.eventId }}</th>
                <th>{{ locale.audit.eventTitle }}</th>
                <th>{{ locale.audit.riskLevel }}</th>
                <th>{{ locale.audit.handlingStatus }}</th>
                <th>{{ locale.audit.riskScore }}</th>
                <th>{{ locale.audit.relatedUser }}</th>
                <th>{{ locale.audit.sourceIp }}</th>
                <th>{{ locale.audit.triggerCount }}</th>
                <th>{{ locale.audit.lastTriggered }}</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="9" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
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
  { icon: 'chart-line', label: locale.value.groups?.analyticsDashboard, value: 'analytics' },
  { icon: 'users', label: locale.value.groups?.onlineUsers, value: 'online' },
  { icon: 'server', label: locale.value.groups?.serverMonitoring, value: 'server' },
  { icon: 'database', label: locale.value.groups?.cacheMonitoring, value: 'cache' },
  { icon: 'warning', label: locale.value.groups?.securityAudit, value: 'audit' }
])

const overviewSignals = computed(() => [
  {
    icon: 'activity',
    label: locale.value.overview?.cpuStatus,
    detail: locale.value.overview?.cpuStatusDetail
  },
  {
    icon: 'monitoring',
    label: locale.value.overview?.memoryStatus,
    detail: locale.value.overview?.memoryStatusDetail
  },
  {
    icon: 'database',
    label: locale.value.overview?.databaseStatus,
    detail: locale.value.overview?.databaseStatusDetail
  },
  {
    icon: 'server',
    label: locale.value.overview?.redisStatus,
    detail: locale.value.overview?.redisStatusDetail
  },
  {
    icon: 'settings',
    label: locale.value.overview?.coroutineStatus,
    detail: locale.value.overview?.coroutineStatusDetail
  },
  {
    icon: 'clock',
    label: locale.value.overview?.backgroundTaskStatus,
    detail: locale.value.overview?.backgroundTaskStatusDetail
  }
])

const healthLiveDetails = computed(() => [
  locale.value.overview?.healthLevel,
  locale.value.overview?.alertCount,
  locale.value.overview?.lastChecked
])

const sourceRows = computed(() => [
  {
    icon: 'music',
    label: locale.value.overview?.neteaseSource,
    detail: locale.value.overview?.sourceCheckDetail
  },
  {
    icon: 'music',
    label: locale.value.overview?.tencentSource,
    detail: locale.value.overview?.sourceCheckDetail
  },
  {
    icon: 'music',
    label: locale.value.overview?.bilibiliSource,
    detail: locale.value.overview?.sourceCheckDetail
  }
])

const dependencyRows = computed(() => [
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
  },
  {
    icon: 'activity',
    label: locale.value.server?.telemetry,
    detail: locale.value.overview?.telemetryDetail
  }
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

const serverSummaryDetails = computed(() => [
  locale.value.runtime?.hostname,
  locale.value.runtime?.platform,
  locale.value.runtime?.systemUptime,
  locale.value.runtime?.processPid
])

const serverMetrics = computed(() => [
  {
    icon: 'activity',
    label: locale.value.metrics?.cpuUsage,
    detail: locale.value.server?.cpuUsageDetail
  },
  {
    icon: 'monitoring',
    label: locale.value.metrics?.systemMemory,
    detail: locale.value.server?.systemMemoryDetail
  },
  {
    icon: 'database',
    label: locale.value.metrics?.diskUsage,
    detail: locale.value.server?.diskUsageDetail
  },
  {
    icon: 'server',
    label: locale.value.metrics?.networkInterfaces,
    detail: locale.value.server?.networkInterfacesMetricDetail
  }
])

const serverHealthDetails = computed(() => [
  locale.value.server?.healthLevel,
  locale.value.server?.alertCount,
  locale.value.server?.collectedAt
])

const serverRuntimeDetails = computed(() => [
  locale.value.server?.platformRelease,
  locale.value.runtime?.architecture,
  locale.value.runtime?.nodeVersion,
  locale.value.runtime?.processUptime,
  locale.value.runtime?.instanceId,
  locale.value.server?.telemetry
])

const serverResourcePanels = computed(() => [
  {
    icon: 'activity',
    title: locale.value.server?.cpuDetails,
    detail: locale.value.server?.cpuDetailsDetail,
    items: [
      locale.value.server?.cpuModel,
      locale.value.server?.cpuCores,
      locale.value.server?.loadAverage1,
      locale.value.server?.loadAverage5,
      locale.value.server?.loadAverage15
    ]
  },
  {
    icon: 'monitoring',
    title: locale.value.server?.systemMemoryDetails,
    detail: locale.value.server?.systemMemoryDetailsDetail,
    items: [
      locale.value.server?.systemMemoryTotal,
      locale.value.server?.systemMemoryUsed,
      locale.value.server?.systemMemoryAvailable
    ]
  },
  {
    icon: 'database',
    title: locale.value.server?.diskDetails,
    detail: locale.value.server?.diskDetailsDetail,
    items: [
      locale.value.server?.diskTotal,
      locale.value.server?.diskAvailable,
      locale.value.server?.partitionCount
    ]
  },
  {
    icon: 'server',
    title: locale.value.server?.nodeProcessDetails,
    detail: locale.value.server?.nodeProcessDetailsDetail,
    items: [
      locale.value.server?.rssMemory,
      locale.value.server?.nodeHeapUtilization,
      locale.value.server?.heapUsed,
      locale.value.server?.heapTotal,
      locale.value.server?.externalMemory
    ]
  }
])

const databaseDetails = computed(() => [
  locale.value.server?.connection,
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

const analysisMetrics = computed(() => [
  {
    icon: 'users',
    label: locale.value.analytics?.totalUsers,
    detail: locale.value.analytics?.totalUsersDetail
  },
  {
    icon: 'music',
    label: locale.value.analytics?.totalSongs,
    detail: locale.value.analytics?.totalSongsDetail
  },
  {
    icon: 'calendar',
    label: locale.value.analytics?.totalSchedules,
    detail: locale.value.analytics?.totalSchedulesDetail
  },
  {
    icon: 'heart',
    label: locale.value.analytics?.weeklyRequests,
    detail: locale.value.analytics?.weeklyRequestsDetail
  }
])

const analysisEngagementSegments = computed(() => [
  { label: locale.value.analytics?.activeContributors, tone: 'analysis-tone--active' },
  { label: locale.value.analytics?.recentActiveUsers, tone: 'analysis-tone--recent' },
  { label: locale.value.analytics?.inactiveUsers, tone: 'analysis-tone--inactive' }
])

const analysisEngagementDetails = computed(() => [
  locale.value.analytics?.activeContributors,
  locale.value.analytics?.recentActiveUsers,
  locale.value.analytics?.activeUserPercentage,
  locale.value.analytics?.recentActivePercentage
])

const analysisPeakHours = computed(() => [
  locale.value.analytics?.firstPeak,
  locale.value.analytics?.secondPeak,
  locale.value.analytics?.thirdPeak
])

const auditMetrics = computed(() => [
  {
    icon: 'warning',
    label: locale.value.audit?.unresolvedEvents,
    detail: locale.value.audit?.unresolvedEventsDetail
  },
  {
    icon: 'warning',
    label: locale.value.audit?.criticalPending,
    detail: locale.value.audit?.criticalPendingDetail
  },
  {
    icon: 'clock',
    label: locale.value.audit?.newToday,
    detail: locale.value.audit?.newTodayDetail
  },
  {
    icon: 'success',
    label: locale.value.audit?.resolvedToday,
    detail: locale.value.audit?.resolvedTodayDetail
  }
])

const riskLevels = computed(() => [
  { label: locale.value.audit?.critical, tone: 'risk-tone--critical' },
  { label: locale.value.audit?.high, tone: 'risk-tone--high' },
  { label: locale.value.audit?.medium, tone: 'risk-tone--medium' },
  { label: locale.value.audit?.low, tone: 'risk-tone--low' }
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
.server-summary-strip {
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.44);
}

.panel,
.signal-card,
.metric-card,
.server-summary-strip {
  min-width: 0;
}

.server-summary-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
}

.server-summary-strip > div {
  min-width: 0;
  min-height: 5rem;
  padding: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.server-summary-strip > div:nth-child(odd) {
  border-right: 1px solid rgb(39 39 42 / 0.75);
}

.server-summary-strip > div:nth-child(n + 3) {
  border-bottom: 0;
}

.server-summary-strip span,
.server-summary-strip strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-summary-strip span {
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  font-weight: 600;
}

.server-summary-strip strong {
  margin-top: 0.75rem;
  color: rgb(228 228 231);
  font-size: 0.875rem;
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

.health-live-details {
  min-width: 0;
  width: 100%;
  flex: 1;
  align-self: stretch;
  border-top: 1px solid rgb(39 39 42);
}

.health-live-details__title {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  color: rgb(161 161 170);
  font-size: 0.75rem;
  font-weight: 700;
}

.health-live-row {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.health-live-row span {
  color: rgb(113 113 122);
  font-size: 0.6875rem;
}

.health-live-row strong {
  color: rgb(212 212 216);
  font-size: 0.75rem;
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

.server-health-layout {
  display: flex;
  min-height: 15rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 1.25rem;
}

.server-health-details {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr);
}

.server-health-details > div {
  min-width: 0;
  padding: 0.8rem 0;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.server-health-details dt {
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  font-weight: 600;
}

.server-health-details dd {
  margin-top: 0.45rem;
  color: rgb(212 212 216);
  font-size: 0.75rem;
  font-weight: 700;
}

.server-resource-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.server-resource-list {
  padding: 0 1rem;
}

.server-resource-list > div {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.server-resource-list > div:last-child {
  border-bottom: 0;
}

.server-resource-list dt {
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  font-weight: 600;
}

.server-resource-list dd {
  color: rgb(212 212 216);
  font-size: 0.75rem;
  font-weight: 700;
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

.analysis-donut-wrap {
  display: flex;
  min-height: 14rem;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.analysis-donut {
  display: flex;
  width: 9.5rem;
  height: 9.5rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1.1rem solid rgb(39 39 42);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(9 9 11 / 0.7);
}

.analysis-donut strong {
  color: rgb(244 244 245);
  font-size: 1.5rem;
  line-height: 1;
}

.analysis-donut span {
  margin-top: 0.5rem;
  color: rgb(113 113 122);
  font-size: 0.625rem;
  font-weight: 600;
}

.analysis-legend {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-top: 1px solid rgb(39 39 42);
}

.analysis-legend > div {
  display: flex;
  min-width: 0;
  min-height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.analysis-legend span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  color: rgb(113 113 122);
  font-size: 0.6875rem;
}

.analysis-legend i {
  width: 0.45rem;
  height: 0.45rem;
  flex: 0 0 auto;
  border-radius: 50%;
}

.analysis-legend strong {
  color: rgb(212 212 216);
  font-size: 0.75rem;
}

.analysis-tone--active {
  background: rgb(59 130 246);
}

.analysis-tone--recent {
  background: rgb(16 185 129);
}

.analysis-tone--inactive {
  background: rgb(113 113 122);
}

.analysis-chart-placeholder {
  position: relative;
  display: flex;
  min-height: 18rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 1.5rem;
}

.analysis-chart-placeholder > span {
  position: relative;
  z-index: 1;
  color: rgb(82 82 91);
  font-size: 0.75rem;
}

.analysis-chart-grid {
  position: absolute;
  inset: 1.5rem;
  display: grid;
  grid-template-rows: repeat(5, minmax(0, 1fr));
}

.analysis-chart-grid i {
  border-bottom: 1px dashed rgb(39 39 42 / 0.8);
}

.peak-list {
  padding: 0 1rem;
}

.peak-list > div {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.peak-list > div:last-child {
  border-bottom: 0;
}

.peak-list span {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: rgb(161 161 170);
  font-size: 0.75rem;
  font-weight: 600;
}

.peak-list strong {
  color: rgb(212 212 216);
  font-size: 0.75rem;
}

.item-count {
  flex: 0 0 auto;
  color: rgb(82 82 91);
  font-size: 0.625rem;
}

.risk-badge {
  flex: 0 0 auto;
  border: 1px solid rgb(239 68 68 / 0.24);
  border-radius: 5px;
  padding: 0.25rem 0.5rem;
  color: rgb(248 113 113);
  background: rgb(239 68 68 / 0.08);
  font-size: 0.625rem;
  font-weight: 700;
}

.risk-distribution {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.risk-total {
  display: flex;
  min-height: 11rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
  padding: 1.25rem;
  text-align: center;
}

.risk-total__icon {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: rgb(248 113 113);
  background: rgb(239 68 68 / 0.1);
}

.risk-total strong {
  margin-top: 1rem;
  color: rgb(244 244 245);
  font-size: 1.75rem;
  line-height: 1;
}

.risk-total p {
  margin-top: 0.65rem;
  color: rgb(113 113 122);
  font-size: 0.6875rem;
}

.risk-levels {
  padding: 0 1rem;
}

.risk-level-row {
  display: flex;
  min-height: 3.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.risk-level-row:last-child {
  border-bottom: 0;
}

.risk-level-name {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: rgb(161 161 170);
  font-size: 0.75rem;
  font-weight: 600;
}

.risk-level-name i {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
}

.risk-level-row strong {
  color: rgb(212 212 216);
  font-size: 0.75rem;
}

.risk-tone--critical {
  background: rgb(239 68 68);
}

.risk-tone--high {
  background: rgb(249 115 22);
}

.risk-tone--medium {
  background: rgb(234 179 8);
}

.risk-tone--low {
  background: rgb(16 185 129);
}

.audit-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  border-bottom: 1px solid rgb(39 39 42);
  padding: 1rem;
  background: rgb(9 9 11 / 0.2);
}

.overview-event-filters,
.overview-log-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  border-bottom: 1px solid rgb(39 39 42);
  padding: 1rem;
  background: rgb(9 9 11 / 0.2);
}

.log-config {
  border-bottom: 1px solid rgb(39 39 42);
  padding: 1rem;
  background: rgb(9 9 11 / 0.2);
}

.log-config__title {
  margin-bottom: 0.75rem;
  color: rgb(161 161 170);
  font-size: 0.6875rem;
  font-weight: 700;
}

.log-config__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}

.filter-field,
.filter-action {
  display: flex;
  min-width: 0;
  height: 2.25rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgb(39 39 42);
  border-radius: 6px;
  padding: 0 0.75rem;
  color: rgb(113 113 122);
  background: rgb(24 24 27 / 0.6);
  font-size: 0.6875rem;
}

.filter-field {
  justify-content: space-between;
}

.filter-field--wide {
  justify-content: flex-start;
}

.filter-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: rgb(161 161 170);
  background: transparent;
  font: inherit;
}

.filter-field input::placeholder {
  color: rgb(113 113 122);
  opacity: 1;
}

.filter-field:disabled,
.filter-field input:disabled {
  cursor: not-allowed;
}

.filter-action {
  justify-content: center;
  color: rgb(96 165 250);
  border-color: rgb(59 130 246 / 0.24);
  background: rgb(59 130 246 / 0.08);
  font-weight: 700;
}

.filter-action:disabled {
  cursor: not-allowed;
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

  .health-live-details {
    border-top: 0;
    border-left: 1px solid rgb(39 39 42);
    padding-left: 1.25rem;
  }

  .server-health-layout {
    flex-direction: row;
  }

  .server-health-details {
    flex: 1;
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

  .analysis-legend {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .analysis-legend > div {
    border-right: 1px solid rgb(39 39 42 / 0.75);
    border-bottom: 0;
  }

  .analysis-legend > div:last-child {
    border-right: 0;
  }

  .server-resource-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .risk-distribution {
    grid-template-columns: 11rem minmax(0, 1fr);
  }

  .risk-total {
    border-right: 1px solid rgb(39 39 42 / 0.75);
    border-bottom: 0;
  }

  .audit-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-event-filters,
  .overview-log-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .log-config__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .server-summary-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .server-summary-strip > div {
    border-bottom: 0;
  }

  .server-summary-strip > div:not(:last-child) {
    border-right: 1px solid rgb(39 39 42 / 0.75);
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .server-resource-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .audit-filters {
    grid-template-columns: minmax(15rem, 2fr) minmax(10rem, 1fr) minmax(10rem, 1fr) auto;
  }

  .overview-event-filters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .overview-log-filters {
    grid-template-columns: minmax(15rem, 2fr) repeat(3, minmax(10rem, 1fr)) auto;
  }

  .log-config__fields {
    grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  }
}
</style>
