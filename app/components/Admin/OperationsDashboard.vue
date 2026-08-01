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
      <div class="header-actions">
        <form class="request-id-shortcut" @submit.prevent="openRequestDiagnosis()">
          <Icon name="search" :size="14" />
          <input
            v-model.trim="globalRequestId"
            type="text"
            :aria-label="locale.requestIdQuick"
            :placeholder="locale.requestIdQuickPlaceholder"
          >
          <button type="submit" :disabled="!globalRequestId">
            {{ locale.goToDiagnosis }}
          </button>
        </form>
        <button type="button" class="refresh-button" disabled>
          <Icon name="refresh" :size="14" />{{ locale.actions.refresh }}
        </button>
      </div>
    </header>

    <nav class="group-navigation" :aria-label="locale.title">
      <div class="group-navigation__scroll">
        <div v-for="section in monitorSections" :key="section.label" class="group-navigation__section">
          <span class="group-navigation__label"><Icon :name="section.icon" :size="13" />{{ section.label }}</span>
          <div class="group-tabs">
            <button
              v-for="group in section.items"
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
          </div>
        </div>
      </div>
    </nav>

    <template v-if="activeGroup === 'overview'">
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel xl:col-span-5">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.overview.sloAvailability }}</h3>
              <p class="panel-description">{{ locale.overview.sloAvailabilityDetail }}</p>
            </div>
            <span class="status-badge">{{ locale.health.waiting }}</span>
          </div>
          <div class="health-layout">
            <div class="health-score-wrap">
              <div class="health-score-ring">
                <strong>--</strong>
                <span>{{ locale.overview.availabilitySli }}</span>
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
          <p class="metric-formula">{{ locale.overview.sloFormula }}</p>
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

      <section class="panel">
        <div class="panel-header">
          <div><h3 class="panel-title">{{ locale.overview.deploymentMode }}</h3><p class="panel-description">{{ locale.overview.deploymentModeDetail }}</p></div>
          <span class="status-badge">{{ locale.overview.detectionPending }}</span>
        </div>
        <div class="deployment-mode-grid">
          <div v-for="item in deploymentModeRows" :key="item.label" class="deployment-mode-card">
            <div class="metric-card__top"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="metric-label">{{ item.label }}</span></div>
            <strong>{{ locale.overview.detectionPending }}</strong>
            <p>{{ item.detail }}</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div><h3 class="panel-title">{{ locale.overview.backupStatus }}</h3><p class="panel-description">{{ locale.overview.backupStatusDetail }}</p></div>
          <span class="status-badge">{{ locale.overview.referenceOnly }}</span>
        </div>
        <dl class="detail-grid">
          <div v-for="item in backupStatusFields" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
        </dl>
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
            <div class="service-row">
              <span class="service-row__icon"><Icon name="layers" :size="15" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-zinc-300">{{ locale.overview.externalDependencySummary }}</p>
                <p class="mt-1 text-xs text-zinc-600">{{ locale.overview.externalDependencySummaryDetail }}</p>
              </div>
              <span class="status-badge">--</span>
              <button type="button" class="panel-link" @click="activeGroup = 'dependencies'">{{ locale.overview.viewDependencyDetails }}</button>
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

      <section class="panel">
        <div class="panel-header">
          <div><h3 class="panel-title">{{ locale.overview.alertRules }}</h3><p class="panel-description">{{ locale.overview.alertRulesDetail }}</p></div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="alert-rule-list">
          <div v-for="item in alertRules" :key="item.label">
            <span class="alert-priority" :class="item.tone">{{ item.priority }}</span>
            <div class="min-w-0 flex-1"><p>{{ item.label }}</p><small>{{ item.detail }}</small></div>
            <strong>--</strong>
          </div>
        </div>
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
                <th>{{ locale.debug.drilldown }}</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="9" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.overview.recentErrorLogs }}</h3>
            <p class="panel-description">{{ locale.overview.recentErrorLogsDetail }}</p>
          </div>
          <button type="button" class="panel-link" @click="activeGroup = 'logs'">
            {{ locale.overview.viewAllLogs }}
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[860px]">
            <thead>
              <tr>
                <th>{{ locale.logs.time }}</th>
                <th>{{ locale.logs.scope }}</th>
                <th>{{ locale.logs.message }}</th>
                <th>{{ locale.overview.logRequestId }}</th>
                <th>{{ locale.debug.drilldown }}</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

    </template>

    <template v-else-if="activeGroup === 'performance'">
      <section class="metric-grid">
        <article v-for="item in applicationMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top">
            <span class="metric-icon"><Icon :name="item.icon" :size="14" /></span>
            <span class="metric-label">{{ item.label }}</span>
          </div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.application.routePerformance }}</h3>
              <p class="panel-description">{{ locale.application.routePerformanceDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[1080px]">
              <thead><tr><th>{{ locale.application.method }}</th><th>{{ locale.application.route }}</th><th>{{ locale.application.qps }}</th><th>P50</th><th>P95</th><th>P99</th><th>4xx</th><th>401</th><th>429</th><th>5xx</th><th>{{ locale.logCenter.traceId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
              <tbody><tr><td colspan="12" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>

        <article class="panel xl:col-span-4">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.application.latencyDistribution }}</h3>
              <p class="panel-description">{{ locale.application.latencyDistributionDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid detail-grid--compact">
            <div v-for="item in applicationLatencyDetails" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.application.latencyBreakdown }}</h3><p class="panel-description">{{ locale.application.latencyBreakdownDetail }}</p></div><span class="status-badge">P95</span></div>
          <dl class="detail-grid">
            <div v-for="item in applicationLatencyBreakdown" :key="item.label"><dt>{{ item.label }}</dt><dd>--</dd></div>
          </dl>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.application.musicApiPerformance }}</h3><p class="panel-description">{{ locale.application.musicApiPerformanceDetail }}</p></div><span class="item-count">{{ locale.itemCount }} --</span></div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[720px]">
              <thead><tr><th>{{ locale.application.route }}</th><th>{{ locale.application.source }}</th><th>P95</th><th>{{ locale.application.successRate }}</th><th>{{ locale.application.timeouts }}</th></tr></thead>
              <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article v-for="panel in applicationDetailPanels" :key="panel.title" class="panel">
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

    </template>

    <template v-else-if="activeGroup === 'infra'">
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

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article v-for="panel in infraTrendPanels" :key="panel.title" class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ panel.title }}</h3><p class="panel-description">{{ panel.detail }}</p></div><span class="status-badge">1h</span></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 8" :key="index" /></div><span>{{ locale.noData }}</span></div>
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

      <section class="panel overflow-hidden">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.server.restartEvents }}</h3><p class="panel-description">{{ locale.server.restartEventsDetail }}</p></div><span class="item-count">{{ locale.itemCount }} --</span></div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[820px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.server.restartReason }}</th><th>{{ locale.server.exitCode }}</th><th>{{ locale.server.oomKilled }}</th><th>{{ locale.overview.logRequestId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

    </template>

    <template v-else-if="activeGroup === 'database'">
      <section class="subsection-heading">
        <div><h3>{{ locale.database.postgresql }}</h3><p>{{ locale.database.postgresqlDetail }}</p></div>
        <Icon name="database" :size="16" />
      </section>

      <section class="metric-grid">
        <article v-for="item in databaseMetrics" :key="item.label" class="metric-card">
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

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.database.queryTrend }}</h3><p class="panel-description">{{ locale.database.queryTrendDetail }}</p></div><span class="status-badge">1h</span></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 8" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.database.connectionTrend }}</h3><p class="panel-description">{{ locale.database.connectionTrendDetail }}</p></div><span class="status-badge">1h</span></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 8" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.database.slowQueryTrend }}</h3><p class="panel-description">{{ locale.database.slowQueryTrendDetail }}</p></div><span class="status-badge">1h</span></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 5" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div><h3 class="panel-title">{{ locale.database.slowQueries }}</h3><p class="panel-description">{{ locale.database.slowQueriesDetail }}</p></div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[1040px]">
              <thead><tr><th>{{ locale.database.queryFingerprint }}</th><th>{{ locale.database.callerRoute }}</th><th>{{ locale.database.executions }}</th><th>{{ locale.database.averageDuration }}</th><th>{{ locale.database.maximumDuration }}</th><th>{{ locale.overview.lastChecked }}</th><th>{{ locale.debug.sampleRequestId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
              <tbody><tr><td colspan="8" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.database.activeQueries }}</h3><p class="panel-description">{{ locale.database.activeQueriesDetail }}</p></div><span class="risk-badge">{{ locale.database.liveSnapshot }}</span></div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[1080px]">
            <thead><tr><th>{{ locale.database.pid }}</th><th>{{ locale.database.query }}</th><th>{{ locale.database.duration }}</th><th>{{ locale.database.waitEvent }}</th><th>{{ locale.database.blockedBy }}</th><th>{{ locale.database.callerRoute }}</th><th>{{ locale.debug.sampleRequestId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
            <tbody><tr><td colspan="8" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.database.tableHealth }}</h3>
              <p class="panel-description">{{ locale.database.tableHealthDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[480px]">
              <thead><tr><th>{{ locale.server.tableName }}</th><th>{{ locale.server.tableStatus }}</th><th>{{ locale.database.lastChecked }}</th></tr></thead>
              <tbody><tr v-for="item in schemaHealthTables" :key="item"><td>{{ item }}</td><td>--</td><td>--</td></tr></tbody>
            </table>
          </div>
        </article>

        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.database.tableScale }}</h3>
              <p class="panel-description">{{ locale.database.tableScaleDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[680px]">
              <thead><tr><th>{{ locale.server.tableName }}</th><th>{{ locale.database.rowCount }}</th><th>{{ locale.database.tableSize }}</th><th>{{ locale.database.indexSize }}</th><th>{{ locale.database.bloatRate }}</th><th>{{ locale.database.lastWrite }}</th></tr></thead>
              <tbody><tr v-for="item in schemaScaleTables" :key="item"><td>{{ item }}</td><td>--</td><td>--</td><td>--</td><td>--</td><td>--</td></tr></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.database.redis }}</h3><p>{{ locale.database.redisDetail }}</p></div>
        <Icon name="server" :size="16" />
      </section>

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

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div><h3 class="panel-title">{{ locale.cache.commandMetrics }}</h3><p class="panel-description">{{ locale.cache.commandMetricsDetail }}</p></div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[680px]">
            <thead><tr><th>{{ locale.cache.command }}</th><th>{{ locale.cache.calls }}</th><th>P50</th><th>P99</th><th>{{ locale.cache.commandErrors }}</th></tr></thead>
            <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else-if="activeGroup === 'business'">
      <section class="metric-grid">
        <article v-for="item in businessGoldenMetrics" :key="item.label" class="metric-card">
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
              <h3 class="panel-title">{{ locale.business.queueHealth }}</h3>
              <p class="panel-description">{{ locale.business.queueHealthDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid">
            <div v-for="item in businessQueueMetrics" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>

        <article class="panel xl:col-span-8">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.business.requestRateTrend }}</h3>
              <p class="panel-description">{{ locale.business.requestRateTrendDetail }}</p>
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
              <h3 class="panel-title">{{ locale.business.scheduleRateTrend }}</h3>
              <p class="panel-description">{{ locale.business.scheduleRateTrendDetail }}</p>
            </div>
            <span class="item-count">{{ locale.analytics.lastThirtyDays }}</span>
          </div>
          <div class="analysis-chart-placeholder">
            <div class="analysis-chart-grid"><i v-for="index in 5" :key="index" /></div>
            <span>{{ locale.noData }}</span>
          </div>
        </article>

        <article class="panel xl:col-span-5">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.business.capacityPlanning }}</h3>
              <p class="panel-description">{{ locale.business.capacityPlanningDetail }}</p>
            </div>
          </div>
          <dl class="detail-grid">
            <div v-for="item in businessCapacityMetrics" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel overflow-hidden xl:col-span-8">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">{{ locale.business.operationOutcomes }}</h3>
              <p class="panel-description">{{ locale.business.operationOutcomesDetail }}</p>
            </div>
            <span class="item-count">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[680px]">
              <thead><tr><th>{{ locale.business.operation }}</th><th>{{ locale.business.qps }}</th><th>{{ locale.business.successRate }}</th><th>P95</th><th>{{ locale.business.impact }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
              <tbody><tr><td colspan="6" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>

      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.business.goldMetrics }}</h3><p>{{ locale.business.goldMetricsDetail }}</p></div>
        <Icon name="music" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article v-for="panel in businessMetricGroups" :key="panel.title" class="panel">
          <div class="panel-header">
            <div><h3 class="panel-title">{{ panel.title }}</h3><p class="panel-description">{{ panel.detail }}</p></div>
            <span class="metric-icon"><Icon :name="panel.icon" :size="14" /></span>
          </div>
          <dl class="server-resource-list">
            <div v-for="item in panel.items" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'security'">
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
          <p class="panel-copy mt-4">{{ locale.audit.riskScoreFormula }}</p>
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
            <table class="data-table min-w-[620px]">
              <thead><tr><th>{{ locale.audit.sourceIp }}</th><th>{{ locale.audit.triggerCount }}</th><th>{{ locale.audit.riskScore }}</th><th>{{ locale.audit.lastTriggered }}</th><th>{{ locale.audit.securityAction }}</th></tr></thead>
              <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.audit.securitySignals }}</h3><p>{{ locale.audit.securitySignalsDetail }}</p></div>
        <Icon name="warning" :size="16" />
      </section>

      <section class="metric-grid">
        <article v-for="item in securitySignalMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="metric-label">{{ item.label }}</span></div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.audit.signalRate }}</h3><p class="panel-description">{{ locale.audit.signalRateDetail }}</p></div><span class="status-badge">1h</span></div>
        <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 10" :key="index" /></div><span>{{ locale.noData }}</span></div>
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
          <table class="data-table min-w-[880px]">
            <thead><tr><th>{{ locale.audit.eventTitle }}</th><th>{{ locale.audit.riskLevel }}</th><th>{{ locale.audit.riskScore }}</th><th>{{ locale.audit.sourceIp }}</th><th>{{ locale.audit.triggerCount }}</th><th>{{ locale.audit.lastTriggered }}</th><th>{{ locale.audit.securityAction }}</th></tr></thead>
            <tbody><tr><td colspan="7" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
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
            <input type="text" :placeholder="locale.audit.keywordFilter" disabled>
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
                <th>{{ locale.audit.securityAction }}</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="10" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.audit.ipBehaviorTimeline }}</h3><p class="panel-description">{{ locale.audit.ipBehaviorTimelineDetail }}</p></div><span class="item-count">{{ locale.itemCount }} --</span></div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[920px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.audit.sourceIp }}</th><th>{{ locale.audit.matchedRule }}</th><th>{{ locale.audit.relatedUser }}</th><th>{{ locale.overview.logRequestId }}</th><th>{{ locale.audit.securityAction }}</th></tr></thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else-if="activeGroup === 'debug'">
      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ locale.debug.requestSearch }}</h3>
            <p class="panel-description">{{ locale.debug.requestSearchDetail }}</p>
          </div>
          <span class="status-badge">{{ locale.debug.allPanelsLinked }}</span>
        </div>
        <form class="diagnostic-search-grid" @submit.prevent="openRequestDiagnosis(debugRequestId)">
          <label class="filter-field filter-field--wide">
            <Icon name="search" :size="13" />
            <input v-model.trim="debugRequestId" type="text" :placeholder="locale.debug.requestIdPlaceholder">
          </label>
          <button type="button" class="filter-field" disabled><span>{{ locale.debug.allUsers }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.debug.allRoutes }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.debug.serverErrors }}</span><Icon name="chevron-down" :size="13" /></button>
          <label class="filter-field"><span>{{ locale.debug.minimumDuration }}</span><strong>--</strong></label>
          <button type="button" class="filter-field" disabled><span>{{ locale.filters.lastHour }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="submit" class="filter-action" :disabled="!debugRequestId"><Icon name="search" :size="13" />{{ locale.debug.diagnose }}</button>
        </form>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.singleRequestTrace }}</h3><p>{{ locale.debug.singleRequestTraceDetail }}</p></div>
        <Icon name="layers" :size="16" />
      </section>

      <section class="diagnostic-summary-grid">
        <article v-for="item in requestSummaryItems" :key="item.label" class="metric-card diagnostic-summary-card">
          <div class="metric-card__top"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="metric-label">{{ item.label }}</span></div>
          <strong class="metric-value">--</strong>
          <p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <div class="diagnosis-result diagnosis-result--banner">
        <span><Icon name="activity" :size="14" />{{ locale.debug.diagnosisResult }}</span><strong>--</strong>
      </div>

      <section class="panel">
        <div class="panel-header">
          <div><h3 class="panel-title">{{ locale.debug.traceWaterfall }}</h3><p class="panel-description">{{ locale.debug.traceWaterfallDetail }}</p></div>
          <span class="status-badge">{{ locale.debug.traceWaterfallMode }}</span>
        </div>
        <div v-if="traceSpans.length" class="trace-waterfall">
          <div v-for="span in traceSpans" :key="span.id" class="trace-waterfall__row" :style="{ paddingLeft: `${span.depth * 14}px` }">
            <span class="trace-waterfall__label">{{ span.module }}</span>
            <div class="trace-waterfall__track">
              <div class="trace-waterfall__bar" :class="`trace-waterfall__bar--${span.status}`" :style="waterfallBarStyle(span)">
                <span>{{ span.durationMs }}ms</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="trace-waterfall__empty">
          <Icon name="activity" :size="16" />
          <p>{{ debugRequestId ? locale.debug.traceNotCollected : locale.debug.traceEnterRequestId }}</p>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header">
          <div><h3 class="panel-title">{{ locale.debug.requestLogChain }}</h3><p class="panel-description">{{ locale.debug.requestLogChainDetail }}</p></div>
          <span class="item-count">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[960px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.debug.elapsed }}</th><th>{{ locale.logs.level }}</th><th>{{ locale.debug.eventName }}</th><th>{{ locale.logs.scope }}</th><th>{{ locale.debug.structuredFields }}</th></tr></thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.debug.enterRequestId }} <DrilldownLink :label="locale.debug.openLogCenter" @activate="activeGroup = 'logs'" /></td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.errorAggregation }}</h3><p>{{ locale.debug.errorAggregationDetail }}</p></div>
        <Icon name="warning" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.debug.topErrors }}</h3><p class="panel-description">{{ locale.debug.topErrorsDetail }}</p></div><span class="item-count">Top 10</span></div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[640px]">
              <thead><tr><th>{{ locale.debug.errorMessage }}</th><th>{{ locale.debug.occurrences }}</th><th>{{ locale.debug.affectedUsers }}</th><th>{{ locale.debug.sampleRequestId }}</th><th>{{ locale.debug.lastOccurred }}</th></tr></thead>
              <tbody><tr><td colspan="5" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.debug.errorTrend }}</h3><p class="panel-description">{{ locale.debug.errorTrendDetail }}</p></div></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 5" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.slowRequestDiagnosis }}</h3><p>{{ locale.debug.slowRequestDiagnosisDetail }}</p></div>
        <Icon name="clock" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.debug.topSlowRequests }}</h3><p class="panel-description">{{ locale.debug.topSlowRequestsDetail }}</p></div><span class="item-count">Top 20</span></div>
          <div class="overflow-x-auto">
            <table class="data-table min-w-[680px]">
              <thead><tr><th>{{ locale.application.method }}</th><th>{{ locale.application.route }}</th><th>{{ locale.debug.duration }}</th><th>{{ locale.logs.time }}</th><th>{{ locale.debug.user }}</th><th>{{ locale.logCenter.traceId }}</th><th>{{ locale.debug.statusCode }}</th></tr></thead>
              <tbody><tr><td colspan="7" class="empty-cell">{{ locale.noData }}</td></tr></tbody>
            </table>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.debug.durationDistribution }}</h3><p class="panel-description">{{ locale.debug.durationDistributionDetail }}</p></div></div>
          <div class="histogram-placeholder"><i v-for="index in 12" :key="index" :style="{ height: `${18 + (index % 5) * 12}%` }" /><span>{{ locale.noData }}</span></div>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.userPerspective }}</h3><p>{{ locale.debug.userPerspectiveDetail }}</p></div>
        <Icon name="user" :size="16" />
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.debug.userRequestTimeline }}</h3><p class="panel-description">{{ locale.debug.userRequestTimelineDetail }}</p></div><span class="item-count">{{ locale.itemCount }} --</span></div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[820px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.application.route }}</th><th>{{ locale.debug.statusCode }}</th><th>{{ locale.debug.duration }}</th><th>{{ locale.overview.logRequestId }}</th><th>{{ locale.debug.eventName }}</th></tr></thead>
            <tbody><tr><td colspan="6" class="empty-cell">{{ locale.debug.selectUser }}</td></tr></tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else-if="activeGroup === 'logs'">
      <section class="metric-grid">
        <article v-for="item in logCenterMetrics" :key="item.label" class="metric-card">
          <div class="metric-card__top"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="metric-label">{{ item.label }}</span></div>
          <strong class="metric-value">--</strong><p class="metric-detail">{{ item.detail }}</p>
        </article>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.logCenter.structuredQuery }}</h3><p class="panel-description">{{ locale.logCenter.structuredQueryDetail }}</p></div><span class="status-badge">{{ locale.logCenter.fullTextSearch }}</span></div>
        <div class="log-search-grid">
          <label class="filter-field filter-field--wide"><Icon name="search" :size="13" /><input type="text" :placeholder="locale.logCenter.keywordPlaceholder" disabled></label>
          <label class="filter-field filter-field--wide"><Icon name="layers" :size="13" /><input type="text" :placeholder="locale.logCenter.requestIdPlaceholder" disabled></label>
          <button type="button" class="filter-field" disabled><span>{{ locale.logCenter.allUsers }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.logCenter.allRoutes }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.filters.allLevels }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.filters.allScopes }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.logCenter.allStatusCodes }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.filters.lastHour }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-action" disabled><Icon name="search" :size="13" />{{ locale.logCenter.query }}</button>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="panel-header"><div><h3 class="panel-title">{{ locale.logCenter.logResults }}</h3><p class="panel-description">{{ locale.logCenter.logResultsDetail }}</p></div><span class="item-count">{{ locale.logCount }} --</span></div>
        <div class="overflow-x-auto">
          <table class="data-table min-w-[1260px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.logs.level }}</th><th>{{ locale.logs.scope }}</th><th>{{ locale.application.route }}</th><th>{{ locale.debug.statusCode }}</th><th>{{ locale.debug.user }}</th><th>{{ locale.overview.logRequestId }}</th><th>{{ locale.overview.logHost }}</th><th>{{ locale.logs.message }}</th></tr></thead>
          <tbody><tr><td colspan="9" class="empty-cell">{{ locale.noData }} <DrilldownLink :label="locale.goToDiagnosis" @activate="activeGroup = 'debug'" /></td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.logCenter.logContext }}</h3><p class="panel-description">{{ locale.logCenter.logContextDetail }}</p></div></div>
          <dl class="detail-grid">
            <div v-for="item in logContextFields" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.logCenter.archiveSettings }}</h3><p class="panel-description">{{ locale.logCenter.archiveSettingsDetail }}</p></div></div>
          <dl class="detail-grid">
            <div v-for="item in logArchiveFields" :key="item"><dt>{{ item }}</dt><dd>--</dd></div>
          </dl>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'dependencies'">
      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.healthMatrix }}</h3><p>{{ locale.dependencies.healthMatrixDetail }}</p></div>
        <Icon name="layers" :size="16" />
      </section>

      <section class="dependency-matrix">
        <article v-for="item in dependencyHealthCards" :key="item.label" class="dependency-card">
          <div class="dependency-card__header"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span>{{ item.label }}</span></div>
          <div class="dependency-card__status"><i class="dependency-status-dot" /><strong>--</strong></div>
          <dl><div v-for="detail in item.details" :key="detail"><dt>{{ detail }}</dt><dd>--</dd></div></dl>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.latencyAndErrors }}</h3><p>{{ locale.dependencies.latencyAndErrorsDetail }}</p></div>
        <Icon name="activity" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.dependencies.p95Latency }}</h3><p class="panel-description">{{ locale.dependencies.p95LatencyDetail }}</p></div><span class="risk-badge">{{ locale.dependencies.latencyThreshold }}</span></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 5" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.dependencies.platformErrorRate }}</h3><p class="panel-description">{{ locale.dependencies.platformErrorRateDetail }}</p></div></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 5" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.dependencies.callVolumeTrend }}</h3><p class="panel-description">{{ locale.dependencies.callVolumeTrendDetail }}</p></div><span class="status-badge">1h</span></div>
          <div class="analysis-chart-placeholder"><div class="analysis-chart-grid"><i v-for="index in 8" :key="index" /></div><span>{{ locale.noData }}</span></div>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ locale.dependencies.uptimeStrip }}</h3><p class="panel-description">{{ locale.dependencies.uptimeStripDetail }}</p></div><span class="status-badge">24h</span></div>
          <div class="uptime-strip"><i v-for="(slot, index) in dependencyUptimeSlots" :key="index" :class="`uptime-strip__slot uptime-strip__slot--${slot}`" /></div>
          <div class="uptime-strip__legend"><span>{{ locale.dependencies.uptimeUnavailable }}</span><span>{{ locale.dependencies.uptimeWindow }}</span></div>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.errorCodeDrilldown }}</h3><p>{{ locale.dependencies.errorCodeDrilldownDetail }}</p></div>
        <Icon name="warning" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article v-for="panel in dependencyErrorPanels" :key="panel.title" class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ panel.title }}</h3><p class="panel-description">{{ panel.detail }}</p></div></div>
          <div class="error-code-layout">
            <div class="error-code-chart"><span>{{ locale.noData }}</span></div>
            <dl class="error-code-legend"><div v-for="item in dependencyErrorCodes" :key="item"><dt>{{ item }}</dt><dd>--</dd></div></dl>
          </div>
        </article>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.fallbackAndCache }}</h3><p>{{ locale.dependencies.fallbackAndCacheDetail }}</p></div>
        <Icon name="database" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article v-for="panel in dependencyProtectionPanels" :key="panel.title" class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ panel.title }}</h3><p class="panel-description">{{ panel.detail }}</p></div><span class="metric-icon"><Icon :name="panel.icon" :size="14" /></span></div>
          <dl class="server-resource-list"><div v-for="item in panel.items" :key="item"><dt>{{ item }}</dt><dd>--</dd></div></dl>
        </article>
      </section>
    </template>

    <section v-if="monitoringReferenceRows.length" class="panel overflow-hidden">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">{{ locale.references.title }}</h3>
          <p class="panel-description">{{ locale.references.detail }}</p>
        </div>
        <span class="status-badge">{{ locale.references.referenceOnly }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table min-w-[980px]">
          <thead>
            <tr>
              <th>{{ locale.references.metric }}</th>
              <th>{{ locale.references.threshold }}</th>
              <th>{{ locale.references.collection }}</th>
              <th>{{ locale.references.description }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in monitoringReferenceRows" :key="item.metric">
              <td>{{ item.metric }}</td>
              <td>{{ item.threshold }}</td>
              <td>{{ item.collection }}</td>
              <td>{{ item.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import DrilldownLink from '~/components/Admin/DrilldownLink.vue'
import { useLocale } from '~/utils/locale'

const { admin } = useLocale()
const locale = computed(() => admin.value?.operations || {})
const activeGroup = ref('overview')
const globalRequestId = ref('')
const debugRequestId = ref('')
const traceSpans = computed(() => [])

const waterfallBarStyle = (span) => {
  const totalDuration = traceSpans.value.reduce((total, item) => Math.max(total, item.offsetMs + item.durationMs), 0)
  if (!totalDuration) return {}
  return {
    left: `${(span.offsetMs / totalDuration) * 100}%`,
    width: `${Math.max((span.durationMs / totalDuration) * 100, 0.6)}%`
  }
}

const openRequestDiagnosis = (requestId = globalRequestId.value) => {
  const normalizedRequestId = String(requestId || '').trim()
  if (!normalizedRequestId) return
  globalRequestId.value = normalizedRequestId
  debugRequestId.value = normalizedRequestId
  activeGroup.value = 'debug'
}

const monitorSections = computed(() => [
  {
    icon: 'monitoring',
    label: locale.value.groups?.monitoring,
    items: [
      { icon: 'monitoring', label: locale.value.groups?.overview, value: 'overview' },
      { icon: 'activity', label: locale.value.groups?.performance, value: 'performance' },
      { icon: 'music', label: locale.value.groups?.business, value: 'business' },
      { icon: 'database', label: locale.value.groups?.database, value: 'database' },
      { icon: 'server', label: locale.value.groups?.infra, value: 'infra' },
      { icon: 'warning', label: locale.value.groups?.security, value: 'security' }
    ]
  },
  {
    icon: 'terminal',
    label: locale.value.groups?.debugTools,
    items: [
      { icon: 'search', label: locale.value.groups?.debug, value: 'debug' },
      { icon: 'terminal', label: locale.value.groups?.logs, value: 'logs' },
      { icon: 'layers', label: locale.value.groups?.dependencies, value: 'dependencies' }
    ]
  }
])

const monitoringReferenceRows = computed(() => locale.value.references?.[activeGroup.value] || [])

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
    label: locale.value.overview?.eventLoopStatus,
    detail: locale.value.overview?.eventLoopStatusDetail
  },
  {
    icon: 'clock',
    label: locale.value.overview?.backgroundTaskStatus,
    detail: locale.value.overview?.backgroundTaskStatusDetail
  }
])

const healthLiveDetails = computed(() => [
  locale.value.overview?.sloBudget,
  locale.value.overview?.errorBudgetBurn,
  locale.value.overview?.collectionStatus
])

const backupStatusFields = computed(() => [
  locale.value.overview?.lastBackupAt,
  locale.value.overview?.lastBackupResult,
  locale.value.overview?.lastBackupSize,
  locale.value.overview?.backupStorageUsage
])

const deploymentModeRows = computed(() => [
  { icon: 'server', label: locale.value.overview?.selfHostedRuntime, detail: locale.value.overview?.selfHostedRuntimeDetail },
  { icon: 'activity', label: locale.value.overview?.serverlessRuntime, detail: locale.value.overview?.serverlessRuntimeDetail }
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
    label: locale.value.server?.collectionReporting,
    detail: locale.value.overview?.collectionReportingDetail
  }
])

const alertRules = computed(() => [
  { priority: 'P0', tone: 'alert-priority--critical', label: locale.value.overview?.ruleApiAvailability, detail: locale.value.overview?.ruleApiAvailabilityDetail },
  { priority: 'P0', tone: 'alert-priority--critical', label: locale.value.overview?.ruleDatabaseConnections, detail: locale.value.overview?.ruleDatabaseConnectionsDetail },
  { priority: 'P0', tone: 'alert-priority--critical', label: locale.value.overview?.ruleSongSuccess, detail: locale.value.overview?.ruleSongSuccessDetail },
  { priority: 'P1', tone: 'alert-priority--high', label: locale.value.overview?.ruleResponseP95, detail: locale.value.overview?.ruleResponseP95Detail },
  { priority: 'P1', tone: 'alert-priority--high', label: locale.value.overview?.ruleColdStarts, detail: locale.value.overview?.ruleColdStartsDetail },
  { priority: 'P2', tone: 'alert-priority--medium', label: locale.value.overview?.ruleNodeMemory, detail: locale.value.overview?.ruleNodeMemoryDetail },
  { priority: 'P2', tone: 'alert-priority--medium', label: locale.value.overview?.ruleMusicSources, detail: locale.value.overview?.ruleMusicSourcesDetail }
])

const applicationMetrics = computed(() => [
  { icon: 'activity', label: locale.value.application?.httpQps, detail: locale.value.application?.httpQpsDetail },
  { icon: 'warning', label: locale.value.application?.clientErrorRate, detail: locale.value.application?.clientErrorRateDetail },
  { icon: 'warning', label: locale.value.application?.serverErrorRate, detail: locale.value.application?.serverErrorRateDetail },
  { icon: 'clock', label: locale.value.application?.ssrRenderTime, detail: locale.value.application?.ssrRenderTimeDetail },
  { icon: 'activity', label: locale.value.application?.eventLoopDelay, detail: locale.value.application?.eventLoopDelayDetail },
  { icon: 'settings', label: locale.value.application?.activeHandles, detail: locale.value.application?.activeHandlesDetail },
  { icon: 'clock', label: locale.value.application?.gcPause, detail: locale.value.application?.gcPauseDetail },
  { icon: 'users', label: locale.value.application?.wsActiveConnections, detail: locale.value.application?.wsActiveConnectionsDetail },
  { icon: 'clock', label: locale.value.application?.wsAverageLifetime, detail: locale.value.application?.wsAverageLifetimeDetail },
  { icon: 'activity', label: locale.value.application?.wsBroadcastLatency, detail: locale.value.application?.wsBroadcastLatencyDetail },
  { icon: 'warning', label: locale.value.application?.wsReconnectFailures, detail: locale.value.application?.wsReconnectFailuresDetail },
  { icon: 'settings', label: locale.value.application?.apiKeyUsage, detail: locale.value.application?.apiKeyUsageDetail },
  { icon: 'warning', label: locale.value.application?.apiKeyFailureRate, detail: locale.value.application?.apiKeyFailureRateDetail }
])

const applicationLatencyBreakdown = computed(() => [
  { label: locale.value.application?.middlewareDuration },
  { label: locale.value.application?.drizzleDuration },
  { label: locale.value.application?.externalApiDuration },
  { label: locale.value.application?.businessDuration }
])

const applicationLatencyDetails = computed(() => [
  locale.value.application?.responseP50,
  locale.value.application?.responseP95,
  locale.value.application?.responseP99,
  locale.value.application?.responseMax
])

const applicationDetailPanels = computed(() => [
  {
    icon: 'success',
    title: locale.value.application?.authentication,
    detail: locale.value.application?.authenticationDetail,
    items: [
      locale.value.application?.jwtIssued,
      locale.value.application?.jwtVerified,
      locale.value.application?.invalidTokens,
      locale.value.application?.oauthSuccessRate
    ]
  },
  {
    icon: 'music',
    title: locale.value.application?.musicSyncReliability,
    detail: locale.value.application?.musicSyncReliabilityDetail,
    items: [
      locale.value.application?.musicSyncReconnects,
      locale.value.application?.musicSyncLatency,
      locale.value.application?.musicSyncHeartbeatTimeouts,
      locale.value.application?.musicSyncDeliveryFailures
    ]
  },
  {
    icon: 'monitoring',
    title: locale.value.application?.requestLifecycle,
    detail: locale.value.application?.requestLifecycleDetail,
    items: [
      locale.value.application?.requestTotal,
      locale.value.application?.clientErrorCount,
      locale.value.application?.serverErrorCount,
      locale.value.application?.ssrRenderCount,
      locale.value.application?.gcCount
    ]
  }
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
    icon: 'activity',
    label: locale.value.server?.networkIngress,
    detail: locale.value.server?.networkIngressDetail
  },
  {
    icon: 'activity',
    label: locale.value.server?.networkEgress,
    detail: locale.value.server?.networkEgressDetail
  },
  {
    icon: 'database',
    label: locale.value.server?.diskIo,
    detail: locale.value.server?.diskIoDetail
  },
  {
    icon: 'refresh',
    label: locale.value.server?.containerRestarts,
    detail: locale.value.server?.containerRestartsDetail
  }
])

const serverHealthDetails = computed(() => [
  locale.value.server?.healthLevel,
  locale.value.server?.alertCount,
  locale.value.server?.collectedAt
])

const infraTrendPanels = computed(() => [
  { title: locale.value.server?.cpuTrend, detail: locale.value.server?.cpuTrendDetail },
  { title: locale.value.server?.memoryTrend, detail: locale.value.server?.memoryTrendDetail },
  { title: locale.value.server?.diskIoTrend, detail: locale.value.server?.diskIoTrendDetail },
  { title: locale.value.server?.networkTrend, detail: locale.value.server?.networkTrendDetail }
])

const serverRuntimeDetails = computed(() => [
  locale.value.server?.platformRelease,
  locale.value.runtime?.architecture,
  locale.value.runtime?.nodeVersion,
  locale.value.runtime?.processUptime,
  locale.value.runtime?.instanceId,
  locale.value.server?.appVersion,
  locale.value.server?.commitSha,
  locale.value.server?.deployedAt,
  locale.value.server?.collectionReporting
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
      locale.value.server?.externalMemory,
      locale.value.server?.gcCount,
      locale.value.server?.gcPause,
      locale.value.server?.eventLoopP99Lag
    ]
  }
])

const databaseMetrics = computed(() => [
  { icon: 'success', label: locale.value.database?.connectionStatus, detail: locale.value.database?.connectionStatusDetail },
  { icon: 'database', label: locale.value.server?.poolUtilization, detail: locale.value.database?.poolUtilizationDetail },
  { icon: 'activity', label: locale.value.database?.queryQps, detail: locale.value.database?.queryQpsDetail },
  { icon: 'clock', label: locale.value.database?.slowQueryCount, detail: locale.value.database?.slowQueryCountDetail },
  { icon: 'warning', label: locale.value.database?.rollbackRate, detail: locale.value.database?.rollbackRateDetail },
  { icon: 'success', label: locale.value.server?.cacheHitRatio, detail: locale.value.database?.cacheHitRatioDetail },
  { icon: 'database', label: locale.value.database?.databaseSize, detail: locale.value.database?.databaseSizeDetail },
  { icon: 'clock', label: locale.value.database?.replicaLag, detail: locale.value.database?.replicaLagDetail },
  { icon: 'clock', label: locale.value.database?.poolerWaitQueue, detail: locale.value.database?.poolerWaitQueueDetail },
  { icon: 'activity', label: locale.value.database?.neonColdStart, detail: locale.value.database?.neonColdStartDetail }
])

const databaseDetails = computed(() => [
  locale.value.server?.poolMax,
  locale.value.server?.poolActive,
  locale.value.server?.poolTotal,
  locale.value.server?.poolAvailable,
  locale.value.server?.probe,
  locale.value.database?.poolerWaitQueue,
  locale.value.database?.neonColdStart
])

const databasePerformanceDetails = computed(() => [
  locale.value.server?.responseTime,
  locale.value.server?.transactionsCommitted,
  locale.value.server?.transactionsRolledBack,
  locale.value.database?.indexHitRatio,
  locale.value.database?.tableBloat,
  locale.value.database?.poolWaitTime,
  locale.value.database?.databaseGrowthRate
])

const schemaHealthTables = computed(() => [
  locale.value.server?.usersTable,
  locale.value.server?.songsTable,
  locale.value.server?.votesTable,
  locale.value.server?.scheduleTable,
  locale.value.server?.notificationsTable
])

const schemaScaleTables = computed(() => [
  locale.value.server?.usersTable,
  locale.value.server?.songsTable,
  locale.value.server?.votesTable,
  locale.value.server?.scheduleTable,
  locale.value.server?.notificationsTable
])

const cacheMetrics = computed(() => [
  {
    icon: 'success',
    label: locale.value.cache?.ready,
    detail: locale.value.cache?.readyDetail
  },
  {
    icon: 'activity',
    label: locale.value.cache?.hitRatio,
    detail: locale.value.cache?.hitRatioDetail
  },
  { icon: 'monitoring', label: locale.value.cache?.memoryUsed, detail: locale.value.cache?.memoryUsedDetail },
  { icon: 'server', label: locale.value.cache?.connections, detail: locale.value.cache?.connectionsDetail },
  { icon: 'clock', label: locale.value.cache?.commandP99, detail: locale.value.cache?.commandP99Detail },
  { icon: 'warning', label: locale.value.cache?.evictions, detail: locale.value.cache?.evictionsDetail },
  { icon: 'warning', label: locale.value.cache?.rateLimitTriggers, detail: locale.value.cache?.rateLimitTriggersDetail },
  { icon: 'warning', label: locale.value.cache?.lastError, detail: locale.value.cache?.errorDetail },
  { icon: 'activity', label: locale.value.cache?.memoryFragmentation, detail: locale.value.cache?.memoryFragmentationDetail }
])

const cacheDetails = computed(() => [
  locale.value.cache?.configured,
  locale.value.cache?.keyPrefix,
  locale.value.cache?.lastConnected,
  locale.value.cache?.evictionPolicy,
  locale.value.cache?.memoryFragmentation
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

const businessGoldenMetrics = computed(() => [
  { icon: 'music', label: locale.value.business?.songRequestSuccessRate, detail: locale.value.business?.songRequestSuccessRateDetail },
  { icon: 'calendar', label: locale.value.business?.scheduleSaveSuccessRate, detail: locale.value.business?.scheduleSaveSuccessRateDetail },
  { icon: 'activity', label: locale.value.business?.songRequestQps, detail: locale.value.business?.songRequestQpsDetail },
  { icon: 'calendar', label: locale.value.business?.scheduleOperationQps, detail: locale.value.business?.scheduleOperationQpsDetail }
])

const businessQueueMetrics = computed(() => [
  locale.value.business?.pendingQueueLength,
  locale.value.business?.queueProcessingRate,
  locale.value.business?.queueOldestAge,
  locale.value.business?.queueBacklogGrowth
])

const businessCapacityMetrics = computed(() => [
  locale.value.business?.peakRequestQps,
  locale.value.business?.peakScheduleQps,
  locale.value.business?.dbPoolHeadroom,
  locale.value.business?.serverlessConcurrencyHeadroom
])

const businessMetricGroups = computed(() => [
  {
    icon: 'music',
    title: locale.value.business?.requestWorkflow,
    detail: locale.value.business?.requestWorkflowDetail,
    items: [
      locale.value.business?.songAndVoteRequests,
      locale.value.business?.requestSuccessRate,
      locale.value.business?.scheduleOperations,
      locale.value.business?.quotaTriggers,
      locale.value.business?.dedupHits,
      locale.value.business?.replayRequests
    ]
  },
  {
    icon: 'activity',
    title: locale.value.business?.mediaPipeline,
    detail: locale.value.business?.mediaPipelineDetail,
    items: [
      locale.value.business?.musicSearchApiAvailability,
      locale.value.business?.playUrlFailures,
      locale.value.business?.qualitySwitches,
      locale.value.business?.downloadCountAndBytes
    ]
  },
  {
    icon: 'bell',
    title: locale.value.business?.growthAndDelivery,
    detail: locale.value.business?.growthAndDeliveryDetail,
    items: [
      locale.value.business?.notificationPushes,
      locale.value.business?.notificationDeliveryRate,
      locale.value.business?.dailyActiveUsers,
      locale.value.business?.newUsers
    ]
  }
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

const securitySignalMetrics = computed(() => [
  { icon: 'warning', label: locale.value.audit?.loginFailures, detail: locale.value.audit?.loginFailuresDetail },
  { icon: 'warning', label: locale.value.audit?.accountLockouts, detail: locale.value.audit?.accountLockoutsDetail },
  { icon: 'warning', label: locale.value.audit?.strongAuthFailures, detail: locale.value.audit?.strongAuthFailuresDetail },
  { icon: 'warning', label: locale.value.audit?.invalidTokenRequests, detail: locale.value.audit?.invalidTokenRequestsDetail },
  { icon: 'activity', label: locale.value.audit?.rateLimitTriggers, detail: locale.value.audit?.rateLimitTriggersDetail },
  { icon: 'warning', label: locale.value.audit?.blacklistHits, detail: locale.value.audit?.blacklistHitsDetail }
])

const requestSummaryItems = computed(() => [
  { icon: 'warning', label: locale.value.debug?.statusCode, detail: locale.value.debug?.statusCodeDetail },
  { icon: 'clock', label: locale.value.debug?.duration, detail: locale.value.debug?.durationDetail },
  { icon: 'user', label: locale.value.debug?.user, detail: locale.value.debug?.userDetail },
  { icon: 'layers', label: locale.value.application?.route, detail: locale.value.debug?.routeDetail },
  { icon: 'clock', label: locale.value.debug?.occurredAt, detail: locale.value.debug?.occurredAtDetail },
  { icon: 'external-link', label: locale.value.debug?.relatedLinks, detail: locale.value.debug?.relatedLinksDetail }
])

const logCenterMetrics = computed(() => [
  { icon: 'terminal', label: locale.value.logCenter?.totalLogs, detail: locale.value.logCenter?.totalLogsDetail },
  { icon: 'warning', label: locale.value.logCenter?.errorLogs, detail: locale.value.logCenter?.errorLogsDetail },
  { icon: 'warning', label: locale.value.logCenter?.warningLogs, detail: locale.value.logCenter?.warningLogsDetail },
  { icon: 'layers', label: locale.value.logCenter?.requestTraces, detail: locale.value.logCenter?.requestTracesDetail }
])

const logContextFields = computed(() => [
  locale.value.overview?.logRequestId,
  locale.value.logCenter?.traceId,
  locale.value.logCenter?.instanceId,
  locale.value.overview?.logHost,
  locale.value.application?.route,
  locale.value.debug?.user,
  locale.value.debug?.statusCode,
  locale.value.logCenter?.sourceIp
])

const logArchiveFields = computed(() => [
  locale.value.overview?.logLevel,
  locale.value.overview?.logScope,
  locale.value.overview?.logSampleRate,
  locale.value.overview?.logRetentionDays,
  locale.value.logCenter?.archiveSize,
  locale.value.logCenter?.lastArchivedAt
])

const dependencyHealthCards = computed(() => [
  {
    icon: 'music',
    label: locale.value.overview?.neteaseSource,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.p95LatencyShort, locale.value.dependencies?.errorRate, locale.value.dependencies?.circuitBreakerState, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'music',
    label: locale.value.overview?.tencentSource,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.p95LatencyShort, locale.value.dependencies?.errorRate, locale.value.dependencies?.circuitBreakerState, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'music',
    label: locale.value.overview?.bilibiliSource,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.p95LatencyShort, locale.value.dependencies?.errorRate, locale.value.dependencies?.circuitBreakerState, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'music',
    label: locale.value.overview?.miguSource,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.p95LatencyShort, locale.value.dependencies?.errorRate, locale.value.dependencies?.circuitBreakerState, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'success',
    label: locale.value.dependencies?.oauth,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.loginSuccessRate, locale.value.dependencies?.circuitBreakerState, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'database',
    label: locale.value.dependencies?.neonPostgresql,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.connectionUsage, locale.value.dependencies?.coldStartP95, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'server',
    label: locale.value.services?.redis,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.cacheHitRate, locale.value.dependencies?.circuitBreakerState, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'bell',
    label: locale.value.dependencies?.smtp,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.smtpFailureRate, locale.value.dependencies?.p95LatencyShort, locale.value.dependencies?.lastSuccess]
  },
  {
    icon: 'bell-ring',
    label: locale.value.dependencies?.notificationService,
    details: [locale.value.dependencies?.availability, locale.value.dependencies?.notificationSuccessRate, locale.value.dependencies?.notificationQueue, locale.value.dependencies?.lastSuccess]
  }
])

const dependencyErrorPanels = computed(() => [
  {
    title: locale.value.dependencies?.neteaseErrorCodes,
    detail: locale.value.dependencies?.errorCodePanelDetail
  },
  {
    title: locale.value.dependencies?.tencentErrorCodes,
    detail: locale.value.dependencies?.errorCodePanelDetail
  },
  {
    title: locale.value.dependencies?.bilibiliErrorCodes,
    detail: locale.value.dependencies?.errorCodePanelDetail
  }
])

const dependencyUptimeSlots = computed(() => Array.from({ length: 24 }, () => 'unknown'))

const dependencyErrorCodes = computed(() => [
  locale.value.dependencies?.rateLimited,
  locale.value.dependencies?.notFound,
  locale.value.dependencies?.upstreamErrors,
  locale.value.dependencies?.timeoutErrors
])

const dependencyProtectionPanels = computed(() => [
  {
    icon: 'layers',
    title: locale.value.dependencies?.fallbackHits,
    detail: locale.value.dependencies?.fallbackHitsDetail,
    items: [
      locale.value.dependencies?.providerFallbacks,
      locale.value.dependencies?.retryAttempts,
      locale.value.dependencies?.circuitBreakerOpens,
      locale.value.dependencies?.cachedResponseFallbacks
    ]
  },
  {
    icon: 'database',
    title: locale.value.dependencies?.searchCacheHitRate,
    detail: locale.value.dependencies?.searchCacheHitRateDetail,
    items: [
      locale.value.dependencies?.cacheHits,
      locale.value.dependencies?.cacheMisses,
      locale.value.dependencies?.cacheEvictions,
      locale.value.dependencies?.cacheResponseP95
    ]
  },
  {
    icon: 'bell',
    title: locale.value.dependencies?.notificationDelivery,
    detail: locale.value.dependencies?.notificationDeliveryDetail,
    items: [
      locale.value.dependencies?.smtpHealth,
      locale.value.dependencies?.smtpFailureRate,
      locale.value.dependencies?.notificationSuccessRate,
      locale.value.dependencies?.notificationQueue
    ]
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

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-id-shortcut {
  display: flex;
  min-width: 0;
  height: 2.25rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgb(63 63 70);
  border-radius: 6px;
  padding-left: 0.65rem;
  color: rgb(96 165 250);
  background: rgb(9 9 11 / 0.55);
}

.request-id-shortcut input {
  min-width: 10rem;
  flex: 1;
  border: 0;
  outline: 0;
  color: rgb(228 228 231);
  background: transparent;
  font-size: 0.75rem;
}

.request-id-shortcut input::placeholder {
  color: rgb(82 82 91);
}

.request-id-shortcut button {
  height: 100%;
  border-left: 1px solid rgb(63 63 70);
  padding: 0 0.7rem;
  color: rgb(147 197 253);
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
}

.request-id-shortcut button:disabled {
  cursor: not-allowed;
  color: rgb(82 82 91);
}

.panel-link {
  flex: 0 0 auto;
  color: rgb(96 165 250);
  font-size: 0.6875rem;
  font-weight: 600;
}

.panel-link:hover {
  color: rgb(147 197 253);
}

.group-navigation {
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.3);
}

.group-navigation__scroll {
  display: flex;
  width: max-content;
  min-width: 100%;
}

.group-navigation__section {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
}

.group-navigation__section + .group-navigation__section {
  border-left: 1px solid rgb(63 63 70);
}

.group-navigation__label {
  display: flex;
  width: 5.5rem;
  min-height: 2.9rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
  border-right: 1px solid rgb(39 39 42);
  padding: 0 0.8rem;
  color: rgb(82 82 91);
  background: rgb(9 9 11 / 0.45);
  font-size: 0.625rem;
  font-weight: 700;
}

.group-tabs {
  display: flex;
  flex: 0 0 auto;
  gap: 0.25rem;
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
  white-space: nowrap;
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
.deployment-mode-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem;
}

.panel {
  overflow: hidden;
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.44);
}

.deployment-mode-card {
  min-width: 0;
  border: 1px solid rgb(39 39 42 / 0.8);
  border-radius: 6px;
  padding: 0.85rem;
  background: rgb(24 24 27 / 0.38);
}

.deployment-mode-card strong {
  display: block;
  margin-top: 0.8rem;
  color: rgb(212 212 216);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.deployment-mode-card p {
  margin-top: 0.35rem;
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  line-height: 1.55;
}

.source-inline-metrics {
  display: none;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem 0.75rem;
  color: rgb(113 113 122);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
}

.source-inline-metrics span {
  white-space: nowrap;
}

.source-inline-metrics strong {
  color: rgb(161 161 170);
  font-weight: 700;
}

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

.subsection-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42);
  padding: 0.25rem 0 0.85rem;
  color: rgb(96 165 250);
}

.subsection-heading h3 {
  color: rgb(228 228 231);
  font-size: 0.875rem;
  font-weight: 700;
}

.subsection-heading p {
  margin-top: 0.3rem;
  color: rgb(82 82 91);
  font-size: 0.6875rem;
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

.metric-formula {
  border-top: 1px solid rgb(39 39 42 / 0.75);
  padding: 0.75rem 1rem;
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  line-height: 1.5;
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

.alert-rule-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.alert-rule-list > div {
  display: flex;
  min-width: 0;
  min-height: 4.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.alert-rule-list p {
  color: rgb(212 212 216);
  font-size: 0.75rem;
  font-weight: 700;
}

.alert-rule-list small {
  display: block;
  margin-top: 0.3rem;
  color: rgb(82 82 91);
  font-size: 0.625rem;
}

.alert-rule-list strong {
  flex: 0 0 auto;
  color: rgb(82 82 91);
  font-size: 0.6875rem;
}

.alert-priority {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 5px;
  font-size: 0.625rem;
  font-weight: 800;
}

.alert-priority--critical {
  color: rgb(248 113 113);
  border-color: rgb(239 68 68 / 0.24);
  background: rgb(239 68 68 / 0.08);
}

.alert-priority--high {
  color: rgb(251 146 60);
  border-color: rgb(249 115 22 / 0.24);
  background: rgb(249 115 22 / 0.08);
}

.alert-priority--medium {
  color: rgb(250 204 21);
  border-color: rgb(234 179 8 / 0.24);
  background: rgb(234 179 8 / 0.08);
}

.alert-priority--low {
  color: rgb(52 211 153);
  border-color: rgb(16 185 129 / 0.24);
  background: rgb(16 185 129 / 0.08);
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
  font-family: inherit;
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

.data-table td {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.7);
  color: rgb(161 161 170);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.data-table tbody tr:last-child td {
  border-bottom: 0;
}

.diagnostic-search-grid,
.log-search-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  padding: 1rem;
  background: rgb(9 9 11 / 0.2);
}

.diagnostic-summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.dependency-matrix {
  display: grid;
  grid-auto-columns: minmax(10rem, 1fr);
  grid-auto-flow: column;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.diagnostic-summary-card {
  min-height: 9.5rem;
}

.trace-waterfall {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.trace-waterfall__row {
  display: grid;
  grid-template-columns: minmax(7rem, 0.35fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.trace-waterfall__label {
  overflow: hidden;
  color: rgb(161 161 170);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-waterfall__track {
  position: relative;
  height: 1.5rem;
  overflow: hidden;
  border-radius: 3px;
  background: repeating-linear-gradient(90deg, rgb(39 39 42 / 0.5) 0, rgb(39 39 42 / 0.5) 1px, transparent 1px, transparent 20%);
}

.trace-waterfall__bar {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  display: flex;
  min-width: 1.5rem;
  align-items: center;
  overflow: hidden;
  border-radius: 3px;
  padding: 0 0.35rem;
  color: rgb(255 255 255 / 0.92);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.trace-waterfall__bar--ok { background: rgb(16 185 129 / 0.72); }
.trace-waterfall__bar--slow { background: rgb(234 179 8 / 0.78); }
.trace-waterfall__bar--error { background: rgb(239 68 68 / 0.78); }

.trace-waterfall__empty {
  display: flex;
  min-height: 10rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: rgb(82 82 91);
  text-align: center;
}

.trace-waterfall__empty p {
  max-width: 30rem;
  font-size: 0.75rem;
  line-height: 1.65;
}

.diagnosis-result {
  display: flex;
  min-height: 3.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid rgb(39 39 42);
  padding: 0.85rem 1rem;
  background: rgb(59 130 246 / 0.04);
}

.diagnosis-result--banner {
  margin-bottom: 1rem;
  border: 1px solid rgb(59 130 246 / 0.18);
  border-radius: 6px;
}

.diagnosis-result span {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: rgb(96 165 250);
  font-size: 0.6875rem;
  font-weight: 700;
}

.diagnosis-result strong {
  color: rgb(161 161 170);
  font-size: 0.75rem;
}

.histogram-placeholder {
  position: relative;
  display: flex;
  min-height: 18rem;
  align-items: flex-end;
  justify-content: center;
  gap: 0.45rem;
  overflow: hidden;
  padding: 3rem 1.5rem 1.5rem;
}

.histogram-placeholder i {
  width: min(1.5rem, 6%);
  min-height: 1rem;
  border: 1px solid rgb(59 130 246 / 0.18);
  border-radius: 3px 3px 0 0;
  background: rgb(59 130 246 / 0.08);
}

.histogram-placeholder span {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(82 82 91);
  font-size: 0.75rem;
}

.dependency-card {
  display: flex;
  min-width: 0;
  min-height: 12rem;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.44);
}

.dependency-card__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1rem 0;
  color: rgb(212 212 216);
  font-size: 0.75rem;
  font-weight: 700;
}

.dependency-card__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.1rem 1rem;
}

.dependency-card__status strong {
  color: rgb(244 244 245);
  font-size: 1.5rem;
}

.dependency-status-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: rgb(82 82 91);
  box-shadow: 0 0 0 3px rgb(82 82 91 / 0.1);
}

.dependency-card dl {
  margin-top: auto;
  border-top: 1px solid rgb(39 39 42 / 0.75);
}

.dependency-card dl > div {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.55);
}

.dependency-card dl > div:last-child {
  border-bottom: 0;
}

.dependency-card dt,
.dependency-card dd {
  color: rgb(113 113 122);
  font-size: 0.625rem;
  font-weight: 600;
}

.dependency-card dd {
  color: rgb(161 161 170);
}

.error-code-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.uptime-strip {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 0.2rem;
  padding: 2rem 1rem 0.75rem;
}

.uptime-strip__slot {
  height: 2rem;
  border-radius: 2px;
  background: rgb(63 63 70);
}

.uptime-strip__slot--up { background: rgb(16 185 129 / 0.72); }
.uptime-strip__slot--degraded { background: rgb(234 179 8 / 0.72); }
.uptime-strip__slot--down { background: rgb(239 68 68 / 0.72); }
.uptime-strip__slot--unknown { background: rgb(63 63 70 / 0.72); }

.uptime-strip__legend {
  display: flex;
  justify-content: space-between;
  padding: 0 1rem 1rem;
  color: rgb(82 82 91);
  font-size: 0.625rem;
}

.error-code-chart {
  position: relative;
  display: flex;
  min-height: 12rem;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
  color: rgb(82 82 91);
  font-size: 0.75rem;
}

.error-code-chart::before {
  position: absolute;
  right: 1.5rem;
  bottom: 1.5rem;
  left: 1.5rem;
  height: 55%;
  border-bottom: 2px solid rgb(59 130 246 / 0.12);
  background: repeating-linear-gradient(to right, rgb(59 130 246 / 0.08) 0 12%, transparent 12% 18%);
  content: '';
}

.error-code-chart span {
  position: relative;
  z-index: 1;
}

.error-code-legend {
  padding: 0 1rem;
}

.error-code-legend > div {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.65);
}

.error-code-legend > div:last-child {
  border-bottom: 0;
}

.error-code-legend dt,
.error-code-legend dd {
  color: rgb(113 113 122);
  font-size: 0.6875rem;
  font-weight: 600;
}

.error-code-legend dd {
  color: rgb(161 161 170);
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

  .deployment-mode-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .source-inline-metrics {
    display: flex;
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

  .alert-rule-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .alert-rule-list > div:nth-child(odd) {
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

  .diagnostic-search-grid,
  .log-search-grid,
  .diagnostic-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .error-code-layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(12rem, 0.85fr);
  }

  .error-code-chart {
    border-right: 1px solid rgb(39 39 42 / 0.75);
    border-bottom: 0;
  }
}

@media (min-width: 1280px) {
  .header-actions {
    flex-direction: row;
    align-items: center;
  }

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

  .diagnostic-search-grid {
    grid-template-columns: minmax(14rem, 2fr) repeat(5, minmax(8rem, 1fr)) auto;
  }

  .log-search-grid {
    grid-template-columns: repeat(4, minmax(10rem, 1fr)) auto;
  }

  .diagnostic-summary-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .dependency-matrix {
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: row;
    grid-template-columns: repeat(9, minmax(0, 1fr));
  }
}
</style>
