<template>
  <div class="operations-dashboard space-y-5" :data-health="overallStatus">
    <header class="ops-status-spine">
      <div class="ops-status-spine__summary">
        <span class="ops-status-spine__dot" :class="`ops-status-spine__dot--${overallStatus}`" />
        <div>
          <h2 :class="`ops-status-spine__headline ops-tone--${overallStatus}`">{{ overallStatusText }}</h2>
          <p class="ops-status-spine__meta">{{ abnormalModuleCount }} 异常 · {{ warningModuleCount }} 警告 · 运行 {{ formatDuration(systemSnapshot?.uptime) }}</p>
        </div>
      </div>
      <div class="ops-status-spine__actions">
        <span class="ops-status-spine__updated">{{ formattedLastUpdated }} · {{ autoRefreshEnabled ? `下次自动刷新 ${refreshCountdownText}` : '自动刷新已暂停' }}</span>
        <button type="button" class="auto-refresh-toggle" :aria-pressed="autoRefreshEnabled" @click="toggleAutoRefresh">
          <span :class="{ 'is-enabled': autoRefreshEnabled }" />自动刷新{{ autoRefreshEnabled ? '已开启' : '已暂停' }}
        </button>
        <CustomSelect
          v-model="autoRefreshInterval"
          :options="autoRefreshIntervalOptions"
          label-key="label"
          value-key="value"
          class-name="ops-refresh-interval w-[5.5rem]"
          :disabled="!autoRefreshEnabled"
          @change="changeAutoRefreshInterval"
        />
        <button type="button" class="refresh-button" :disabled="operationsLoading" @click="loadOperationsData()">
          <Icon name="refresh" :size="14" :class="{ 'icon-spin': operationsLoading }" />{{ operationsLoading ? '正在刷新' : locale.actions.refresh }}
        </button>
      </div>
      <i class="ops-status-spine__countdown" :style="{ width: `${refreshProgress}%` }" />
    </header>

    <div v-if="initialOperationsLoading" class="operations-loading-state" role="status" aria-live="polite">
      <span class="operations-loading-state__spinner"><Icon name="refresh" :size="16" /></span>
      <div><strong>正在读取运维数据</strong><p>正在连接监控接口，页面数据加载完成后会自动显示。</p></div>
    </div>

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
              :class="[`group-tab--${groupTabStatus(group.value)}`, { 'group-tab--active': activeGroup === group.value }]"
              :aria-selected="activeGroup === group.value"
              @click="selectMonitorGroup(group.value)"
            >
              <Icon :name="group.icon" :size="14" />
              <span>{{ group.label }}</span>
              <i class="group-tab__status" :class="`group-tab__status--${groupTabStatus(group.value)}`" />
            </button>
          </div>
        </div>
      </div>
    </nav>

    <template v-if="activeGroup === 'overview'">
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <OpsPanel class="xl:col-span-5" :title="locale.overview.sloAvailability" :subtitle="locale.overview.sloAvailabilityDetail" :status="sloAvailabilityStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.system || moduleFetchErrors.metrics" :empty="!operationsData.status && !initialOperationsLoading" :refreshable="false">
          <div class="health-layout">
            <div class="health-score-wrap">
              <div class="health-score-ring">
                <strong>{{ availabilitySli }}</strong>
                <span>{{ locale.overview.availabilitySli }}</span>
              </div>
              <p>{{ availabilitySli === '--' ? locale.noData : locale.overview.availabilitySli }}</p>
            </div>
            <div class="health-live-details">
              <div class="health-live-details__title">{{ locale.overview.healthRealtime }}</div>
              <div v-for="item in healthLiveDetails" :key="item.label" class="health-live-row">
                <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
          <p class="metric-formula">{{ locale.overview.sloFormula }}</p>
        </OpsPanel>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3">
          <div v-for="item in overviewSignals" :key="item.label" class="ops-metric-item ops-metric-item--overview">
            <div class="ops-metric-item__head"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="ops-metric-item__label">{{ item.label }}</span></div>
            <div v-if="item.memoryRows" class="ops-memory-rows">
              <div v-for="row in item.memoryRows" :key="row.label" class="ops-memory-row"><span>{{ row.label }}</span><strong>{{ row.value }}</strong></div>
            </div>
            <template v-else>
              <strong class="ops-metric-item__value" :class="{ 'metric-value--compact': item.compact }">{{ item.value }}</strong>
              <p class="ops-metric-item__detail">{{ item.detail }}</p>
            </template>
          </div>
        </div>
      </section>

      <OpsPanel :title="locale.overview.deploymentMode" :subtitle="locale.overview.deploymentModeDetail" :status="systemModuleStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.system" :empty="!systemSnapshot && !initialOperationsLoading" :refreshable="false">
        <div class="deployment-mode-grid">
          <div v-for="item in deploymentModeRows" :key="item.label" class="deployment-mode-card">
            <div class="metric-card__top"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="metric-label">{{ item.label }}</span></div>
            <strong>{{ item.value }}</strong>
            <p>{{ item.detail }}</p>
          </div>
        </div>
      </OpsPanel>

      <OpsPanel :title="locale.overview.backupStatus" :subtitle="locale.overview.backupStatusDetail" :status="backupStatusPanelStatus" :updated-at="backupUpdatedAt" :pending="initialOperationsLoading" :error="backupAccessState === 'error'" :empty="false" :refreshable="false" @refresh="loadOperationsData">
        <div v-if="backupAccessState === 'forbidden'" class="operation-log-state">
          <Icon name="warning" :size="16" />
          <span>仅超级管理员可查看备份记录。</span>
        </div>
        <div v-else-if="backupMonitorStatus?.enabled === false" class="operation-log-state">自动备份未启用。</div>
        <template v-else>
          <dl class="detail-grid">
            <div v-for="item in backupStatusFields" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
          <dl class="server-resource-list mt-3">
            <div v-for="target in backupTargetPanels" :key="target.title">
              <dt>{{ target.title }}</dt>
              <dd>
                <span>{{ target.value }}</span>
                <small v-if="target.error" class="text-rose-400">{{ target.error }}</small>
              </dd>
            </div>
          </dl>
          <p v-if="latestBackupFailureReason" class="mt-3 text-xs text-rose-400">失败原因：{{ latestBackupFailureReason }}</p>
        </template>
      </OpsPanel>

      <OpsPanel title="备份历史" subtitle="最近的自动备份执行记录" :status="backupHistoryPanelStatus" :updated-at="backupUpdatedAt" :pending="initialOperationsLoading" :error="backupAccessState === 'error'" :empty="false" :refreshable="false" @refresh="loadOperationsData">
        <div v-if="backupAccessState === 'forbidden'" class="operation-log-state">
          <Icon name="warning" :size="16" />
          <span>仅超级管理员可查看备份记录。</span>
        </div>
        <div v-else-if="!operationsData.backups.length" class="operation-log-state">暂无备份记录。</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table min-w-[920px]">
            <thead><tr><th>时间</th><th>文件名</th><th>结果</th><th>记录数</th><th>大小</th><th>触发方式</th><th>目标与失败原因</th></tr></thead>
            <tbody>
              <tr v-for="item in operationsData.backups" :key="item.id">
                <td class="whitespace-nowrap">{{ formatTimestamp(item.createdAt) }}</td>
                <td class="max-w-[220px] truncate font-mono" :title="item.filename">{{ item.filename || '--' }}</td>
                <td><span class="operation-log-result" :class="backupResultClass(item)">{{ backupResultText(item) }}</span></td>
                <td>{{ item.totalRecords ?? '--' }}</td>
                <td>{{ formatBytes(item.backupSize) }}</td>
                <td>{{ item.triggeredBy || '--' }}</td>
                <td class="max-w-[360px]" :title="backupMethodSummary(item)">{{ backupMethodSummary(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </OpsPanel>

      <OpsPanel title="自动备份配置" subtitle="当前启用状态与备份目标" :status="backupConfigPanelStatus" :updated-at="backupUpdatedAt" :pending="initialOperationsLoading" :error="backupAccessState === 'error'" :empty="false" :refreshable="false" @refresh="loadOperationsData">
        <div v-if="backupAccessState === 'forbidden'" class="operation-log-state">
          <Icon name="warning" :size="16" />
          <span>仅超级管理员可查看备份记录。</span>
        </div>
        <div v-else-if="!backupMonitorStatus" class="operation-log-state">暂无真实采集数据。</div>
        <div v-else-if="backupMonitorStatus.enabled === false" class="operation-log-state">自动备份未启用。</div>
        <dl v-else class="detail-grid">
          <div v-for="item in backupConfigFields" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
        </dl>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.overview.sourceStatus" :subtitle="locale.overview.sourceStatusDetail" :status="dependenciesModuleStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!musicSourceStatuses.some((item) => item.status !== 'unknown') && !initialOperationsLoading" :refreshable="false">
          <div class="service-list">
            <div v-for="item in overviewDependencyPreview" :key="item.label" class="service-row">
              <span class="service-row__icon"><Icon :name="item.icon" :size="15" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-zinc-300">{{ item.label }}</p>
                <p class="mt-1 text-xs text-zinc-600">{{ item.preview }}</p>
              </div>
              <span class="status-badge" :class="`status-badge--${item.status}`">{{ item.value }}</span>
            </div>
          </div>
        </OpsPanel>

        <OpsPanel :title="locale.overview.serviceDependencies" :subtitle="locale.overview.serviceDependenciesDetail" :status="overviewServiceStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.system || moduleFetchErrors.metrics" :empty="!operationsData.status && !runtimeMetrics && !initialOperationsLoading" :refreshable="false">
          <div class="service-list">
            <div v-for="item in dependencyRows" :key="item.label" class="service-row">
              <span class="service-row__icon"><Icon :name="item.icon" :size="15" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-zinc-300">{{ item.label }}</p>
                <p class="mt-1 text-xs text-zinc-600">{{ item.detail }}</p>
              </div>
              <span class="text-xs font-semibold text-zinc-600">{{ item.value }}</span>
            </div>
          </div>
        </OpsPanel>
      </section>

      <OpsPanel :title="locale.overview.alertRules" :subtitle="locale.overview.alertRulesDetail" status="unknown" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :empty="!alertRules.length && !initialOperationsLoading" :refreshable="false">
        <div class="alert-rule-list">
          <div v-for="item in alertRules" :key="item.label" class="alert-rule-row" :class="`alert-rule-row--${item.priority.toLowerCase()}`">
            <span class="alert-priority" :class="item.tone" :title="`${item.priority} 告警规则`"><Icon :name="item.priority === 'P0' ? 'alert-triangle' : item.priority === 'P1' ? 'warning' : 'info'" :size="13" /></span>
            <div class="min-w-0 flex-1"><p>{{ item.label }}</p><small>{{ item.detail }}</small></div>
            <strong class="alert-rule-level" :class="item.tone">{{ item.priority }}</strong>
          </div>
        </div>
      </OpsPanel>

      <OpsPanel :title="locale.overview.warningEvents" :subtitle="locale.overview.warningEventsDetail" :status="runtimeAlertStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :empty="!runtimeAlerts.length && !initialOperationsLoading" :refreshable="false">
        <div class="service-list">
          <div v-for="item in runtimeAlerts" :key="item.code" class="service-row"><div class="min-w-0 flex-1"><p class="text-sm font-semibold text-zinc-300">{{ item.message }}</p><p class="mt-1 text-xs text-zinc-600">{{ item.code }} · {{ item.threshold }}</p></div><span class="status-badge">{{ item.value }}</span></div>
        </div>
      </OpsPanel>

      <OpsPanel :title="locale.overview.recentErrorLogs" :subtitle="locale.overview.recentErrorLogsDetail" :status="logPanelStatus" :updated-at="logUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!recentErrorLogEntries.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
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
            <tbody><tr v-for="item in recentErrorLogEntries" :key="logKey(item)"><td>{{ formatTimestamp(item.at) }}</td><td>{{ item.source === 'sentry' ? 'Sentry' : 'HTTP' }}</td><td>{{ redactSensitiveText(item.message) }}</td><td class="font-mono">{{ item.requestId || '暂无' }}</td><td><button type="button" class="table-action" :disabled="!item.requestId" @click="openRequestDiagnosis(item.requestId)">{{ locale.debug.drilldown }}</button></td></tr></tbody>
          </table>
        </div>
      </OpsPanel>

    </template>

    <template v-else-if="activeGroup === 'performance'">
      <OpsPanel title="应用实时指标" subtitle="近 5 分钟 · 请求、运行时与实时连接" :status="performanceModuleStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeHttpMetrics && !initialOperationsLoading" :refreshable="false">
      <section class="ops-metric-grid">
        <div v-for="item in applicationMetrics" :key="item.label" class="ops-metric-item">
          <div class="ops-metric-item__head"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="ops-metric-item__label">{{ item.label }}</span></div>
          <strong class="ops-metric-item__value">{{ item.value || '--' }}</strong>
          <p class="ops-metric-item__detail">{{ item.detail }}</p>
        </div>
      </section>
      </OpsPanel>

      <section>
        <OpsPanel :title="locale.application.routePerformance" :subtitle="locale.application.routePerformanceDetail" :status="routePerformancePanelStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!routePerformanceRows.length && !initialOperationsLoading" :refreshable="false">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[1080px]">
              <thead><tr><th>{{ locale.application.method }}</th><th>{{ locale.application.route }}</th><th>{{ locale.application.qps }}</th><th>P50</th><th>P95</th><th>P99</th><th>4xx</th><th>401</th><th>403</th><th>429</th><th>5xx</th><th>{{ locale.logCenter.traceId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
              <tbody>
                <tr v-for="item in routePerformanceRows" :key="item.route"><td>{{ item.method }}</td><td>{{ item.route }}</td><td>{{ item.qps }}</td><td>{{ item.p50 }}</td><td>{{ item.p95 }}</td><td>{{ item.p99 }}</td><td>{{ item.clientErrors }}</td><td>{{ item.status401 }}</td><td>{{ item.status403 }}</td><td>{{ item.status429 }}</td><td>{{ item.serverErrors }}</td><td class="font-mono">{{ item.requestId || 'N/A' }}</td><td><button type="button" class="table-action" :disabled="!item.requestId" @click="openRequestDiagnosis(item.requestId)">{{ locale.debug.drilldown }}</button></td></tr>
              </tbody>
            </table>
          </div>
        </OpsPanel>

        <OpsPanel class="xl:col-span-4" :title="locale.application.latencyDistribution" :subtitle="locale.application.latencyDistributionDetail" :status="applicationLatencyStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeHttpMetrics && !initialOperationsLoading" :refreshable="false">
          <dl class="detail-grid detail-grid--compact">
            <div v-for="item in applicationLatencyDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
        </OpsPanel>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.application.latencyBreakdown" :subtitle="locale.application.latencyBreakdownDetail" status="unknown" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="true" :refreshable="false" />
        <OpsPanel :title="locale.application.musicApiPerformance" :subtitle="locale.application.musicApiPerformanceDetail" :status="dependenciesModuleStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!musicApiRows.some((item) => item.status !== '未探测') && !initialOperationsLoading" :refreshable="false">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[720px]">
              <thead><tr><th>{{ locale.application.route }}</th><th>{{ locale.application.source }}</th><th>自动探测</th><th>{{ locale.application.averageDuration || '平均耗时' }}</th><th>{{ locale.application.httpSuccessRate || 'HTTP 成功率' }}</th><th>{{ locale.application.semanticSuccessRate || '解析成功率' }}</th><th>{{ locale.application.timeouts }}</th></tr></thead>
              <tbody>
                <tr v-for="item in musicApiRows" :key="item.source"><td>/api/music/*</td><td>{{ item.source }}</td><td>{{ item.status }}</td><td>{{ item.averageDuration }}</td><td>{{ item.httpSuccessRate }}</td><td>{{ item.semanticSuccessRate }}</td><td>{{ item.timeouts }}</td></tr>
              </tbody>
            </table>
          </div>
        </OpsPanel>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <OpsPanel v-for="panel in applicationDetailPanels" :key="panel.title" :title="panel.title" :subtitle="panel.detail" :status="panel.status" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="panel.empty && !initialOperationsLoading" :refreshable="false">
          <dl class="server-resource-list">
            <div v-for="item in panel.items" :key="item.label || item"><dt>{{ item.label || item }}</dt><dd>{{ item.value || '--' }}</dd></div>
          </dl>
        </OpsPanel>
      </section>

    </template>

    <template v-else-if="activeGroup === 'infra'">
      <OpsPanel title="服务器摘要" subtitle="当前实例与进程概览" :status="infraCombinedStatus" :updated-at="infraCombinedUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.system || moduleFetchErrors.metrics" :empty="!systemSnapshot && !runtimeMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <dl class="detail-grid">
          <div v-for="item in serverSummaryDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
        </dl>
      </OpsPanel>

      <OpsPanel title="运行指标" subtitle="CPU、进程内存与 Node.js 运行指标" :status="infraMetricsStatus" :updated-at="infraMetricsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <dl class="detail-grid">
          <div v-for="item in serverMetrics" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value || '--' }}</dd></div>
        </dl>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article v-for="panel in infraTrendPanels" :key="panel.title" class="panel">
          <div class="panel-header"><div><h3 class="panel-title">{{ panel.title }}</h3><p class="panel-description">{{ panel.detail }}</p></div><span class="status-badge">当前 {{ panel.available && hasTimelineMetric(panel.field) ? `${formatChartValue(trendValue(runtimeTimeline[runtimeTimeline.length - 1], panel.field), panel.unit)} ${panel.unit}` : '暂无数据' }}</span></div>
          <div v-if="panel.available && hasTimelineMetric(panel.field)" class="ops-time-chart">
            <div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks(panel.field)" :key="tick">{{ tick }} {{ panel.unit }}</span></div>
            <div class="ops-time-chart__plot">
              <div class="ops-time-chart__grid"><i v-for="tick in chartTicks(panel.field)" :key="tick" /></div>
              <div class="ops-time-chart__bars"><i v-for="(point, index) in runtimeTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(trendValue(point, panel.field), panel.field)}%` }" @mouseenter="showChartTooltip(panel.field, panel.title, point, trendValue(point, panel.field), panel.unit, index, runtimeTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div>
              <i v-if="chartTooltip.visible && chartTooltip.key === panel.field" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" />
              <div v-if="chartTooltip.visible && chartTooltip.key === panel.field" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div>
            </div>
            <div class="ops-time-chart__x-axis"><span>{{ formatChartTime(runtimeTimeline[0]?.at) }}</span><span>{{ formatChartTime(runtimeTimeline[runtimeTimeline.length - 1]?.at) }}</span></div>
          </div>
          <div v-else class="ops-empty-copy">暂无历史趋势数据，当前仅展示实时值。</div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <OpsPanel class="health-score-panel xl:col-span-5" :title="locale.server.healthScore" subtitle="后端根据近 5 分钟 HTTP 可用率采集。" :status="healthScorePanelStatus" :updated-at="infraMetricsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasRuntimeHealthScore && !initialOperationsLoading" empty-text="暂无真实健康评分数据。" :refreshable="false" @refresh="loadOperationsData">
          <div class="server-health-layout">
            <aside class="server-health-score" :class="`server-health-score--${healthScoreTone}`">
              <div class="server-health-score__eyebrow">
                <span class="server-health-score__icon"><Icon name="activity" :size="16" /></span>
                <span>实时巡检</span>
              </div>
              <strong class="server-health-score__value">{{ healthScoreDisplay }}</strong>
              <span class="server-health-score__unit">综合评分 / 100</span>
              <div class="server-health-score__track" role="progressbar" aria-label="服务器健康评分" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="healthScoreProgress">
                <i :style="{ width: `${healthScoreProgress}%` }" />
              </div>
              <div class="server-health-score__scale"><span>风险</span><span>关注</span><span>健康</span></div>
              <p>{{ healthScoreSummary }}</p>
            </aside>

            <div class="server-health-inspection">
              <div class="server-health-inspection__heading">
                <div>
                  <h4>健康评分</h4>
                  <p>基于近 5 分钟 HTTP 可用率，生成当前实例的巡检结论。</p>
                </div>
                <span class="server-health-inspection__badge" :class="`server-health-inspection__badge--${healthScorePanelStatus}`">{{ healthScoreStatusLabel }}</span>
              </div>
              <dl class="server-health-details">
                <div><dt>健康等级</dt><dd>{{ healthScoreStatusLabel }}</dd></div>
                <div><dt>异常 / 警告</dt><dd>{{ abnormalModuleCount }} / {{ warningModuleCount }}</dd></div>
                <div><dt>采样时间</dt><dd>{{ infraMetricsUpdatedAt }}</dd></div>
              </dl>
              <div class="server-health-inspection__note">
                <Icon name="bell" :size="14" />
                <span>{{ healthScoreInspectionNote }}</span>
              </div>
            </div>
          </div>
        </OpsPanel>

        <OpsPanel class="xl:col-span-7" :title="locale.server.runtime" :subtitle="locale.server.runtimeEnvironmentDetail" :status="infraCombinedStatus" :updated-at="infraCombinedUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.system || moduleFetchErrors.metrics" :empty="!systemSnapshot && !runtimeMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="detail-grid">
            <div v-for="item in serverRuntimeDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
        </OpsPanel>
      </section>

      <section class="server-resource-grid">
        <OpsPanel v-for="panel in serverResourcePanels" :key="panel.title" :title="panel.title" :subtitle="panel.detail" :status="infraDetailPanelStatus(panel)" :updated-at="infraDetailPanelUpdatedAt(panel)" :pending="initialOperationsLoading" :error="infraDetailPanelError(panel)" :empty="panel.empty && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="server-resource-list">
            <div v-for="item in panel.items" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
        </OpsPanel>
      </section>

      <section class="server-resource-grid">
        <OpsPanel v-for="panel in runtimeGuardPanels" :key="panel.title" :title="panel.title" :subtitle="panel.detail" :status="infraDetailPanelStatus(panel)" :updated-at="infraDetailPanelUpdatedAt(panel)" :pending="initialOperationsLoading" :error="infraDetailPanelError(panel)" :empty="panel.empty && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="server-resource-list">
            <div v-for="item in panel.items" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
        </OpsPanel>
      </section>

      <OpsPanel :title="locale.server.restartEvents" :subtitle="locale.server.restartEventsDetail" status="unknown" :updated-at="infraMetricsUpdatedAt" :pending="initialOperationsLoading" :empty="!initialOperationsLoading" :refreshable="false" />

    </template>

    <template v-else-if="activeGroup === 'database'">
      <section class="subsection-heading">
        <div><h3>{{ locale.database.postgresql }}</h3><p>{{ locale.database.postgresqlDetail }}</p></div>
        <Icon name="database" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.server.database" subtitle="连接池当前快照" :status="databasePoolPanelStatus" :updated-at="databasePoolUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.pool" :empty="!operationsData.pool && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="detail-grid">
            <div v-for="item in databasePoolDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
        </OpsPanel>
        <OpsPanel :title="locale.server.databasePerformance" :subtitle="locale.server.databasePerformanceDetail" :status="databasePerformancePanelStatus" :updated-at="databasePerformanceUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.performance" :empty="!operationsData.performance && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="detail-grid">
            <div v-for="item in databasePerformanceSourceDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
        </OpsPanel>
      </section>

      <OpsPanel title="数据库诊断详情" subtitle="活动、锁等待、容量与慢查询采集能力" :status="databaseDiagnosticsPanelStatus" :updated-at="databaseDiagnosticsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!databaseDiagnostics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <dl class="detail-grid">
          <div v-for="item in databaseDiagnosticsDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
        </dl>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel v-for="panel in databaseTrendPanels" :key="panel.title" :title="panel.title" :subtitle="panel.detail" :status="databaseTrendStatus(panel)" :updated-at="databaseTimelineUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasDatabaseTimelineMetric(panel.field) && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false" @refresh="loadOperationsData">
          <div class="ops-time-chart">
            <div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks(panel.field, databaseTimeline)" :key="tick">{{ tick }} {{ panel.unit }}</span></div>
            <div class="ops-time-chart__plot">
              <div class="ops-time-chart__grid"><i v-for="tick in chartTicks(panel.field, databaseTimeline)" :key="tick" /></div>
              <div class="ops-time-chart__bars"><i v-for="(point, index) in databaseTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(trendValue(point, panel.field), panel.field, databaseTimeline)}%` }" @mouseenter="showChartTooltip(`database-${panel.field}`, panel.title, point, trendValue(point, panel.field), panel.unit, index, databaseTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div>
              <i v-if="chartTooltip.visible && chartTooltip.key === `database-${panel.field}`" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" />
              <div v-if="chartTooltip.visible && chartTooltip.key === `database-${panel.field}`" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div>
            </div>
            <div class="ops-time-chart__x-axis"><span>{{ formatChartTime(databaseTimeline[0]?.at) }}</span><span>{{ formatChartTime(databaseTimeline[databaseTimeline.length - 1]?.at) }}</span></div>
          </div>
        </OpsPanel>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.database.slowQueries" :subtitle="locale.database.slowQueriesDetail" :status="databaseSlowQueriesPanelStatus" :updated-at="databaseDiagnosticsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!databaseDiagnostics?.slowQueries?.available || !slowQueryRows.length" :refreshable="false" @refresh="loadOperationsData">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[1040px]">
              <thead><tr><th>{{ locale.database.queryFingerprint }}</th><th>{{ locale.database.callerRoute }}</th><th>{{ locale.database.executions }}</th><th>{{ locale.database.averageDuration }}</th><th>{{ locale.database.maximumDuration }}</th><th>{{ locale.overview.lastChecked }}</th><th>{{ locale.debug.sampleRequestId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
              <tbody>
                <tr v-for="item in slowQueryRows" :key="item.query_id"><td class="max-w-[300px] truncate font-mono">{{ item.query }}</td><td>--</td><td>{{ item.calls }}</td><td>{{ formatMilliseconds(item.average_duration_ms) }}</td><td>{{ formatMilliseconds(item.maximum_duration_ms) }}</td><td>{{ formatTimestamp(databaseDiagnostics?.collectedAt) }}</td><td>--</td><td>--</td></tr>
                <tr v-if="!slowQueryRows.length"><td colspan="8" class="empty-cell">{{ databaseDiagnostics?.slowQueries?.available === false ? 'N/A' : locale.noData }}</td></tr>
              </tbody>
            </table>
          </div>
        </OpsPanel>
      </section>

      <OpsPanel :title="locale.database.activeQueries" :subtitle="locale.database.activeQueriesDetail" :status="databaseActivityPanelStatus" :updated-at="databaseDiagnosticsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!databaseDiagnostics?.activity?.available || !activeDatabaseQueries.length" :refreshable="false" @refresh="loadOperationsData">
        <div class="overflow-x-auto">
          <table class="data-table min-w-[1080px]">
            <thead><tr><th>{{ locale.database.pid }}</th><th>{{ locale.database.query }}</th><th>{{ locale.database.duration }}</th><th>{{ locale.database.waitEvent }}</th><th>{{ locale.database.blockedBy }}</th><th>{{ locale.database.callerRoute }}</th><th>{{ locale.debug.sampleRequestId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
            <tbody>
              <tr v-for="item in activeDatabaseQueries" :key="item.pid">
                <td class="font-mono">{{ item.pid }}</td><td class="max-w-[380px] truncate font-mono">{{ item.query }}</td><td>{{ item.duration }}</td><td>{{ item.waitEvent }}</td><td>{{ item.blockedBy }}</td><td>N/A</td><td>N/A</td><td>N/A</td>
              </tr>
              <tr v-if="!activeDatabaseQueries.length"><td colspan="8" class="empty-cell">{{ databaseDiagnostics?.activity?.available === false ? 'N/A' : locale.noData }}</td></tr>
            </tbody>
          </table>
        </div>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel class="xl:col-span-2" :title="`${locale.database.tableHealth} · 容量与活跃度`" subtitle="使用 PostgreSQL 统计视图估算行数，避免对业务表执行高频 COUNT(*)。" :status="databaseTablesPanelStatus" :updated-at="databaseDiagnosticsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!databaseDiagnostics?.tables?.available || !databaseTableRows.length" :refreshable="false" @refresh="loadOperationsData">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[680px]">
              <thead><tr><th>{{ locale.server.tableName }}</th><th>{{ locale.database.rowCount }} (估算)</th><th>{{ locale.database.tableSize }}</th><th>{{ locale.database.indexSize }}</th><th>{{ locale.database.bloatRate }}</th><th>{{ locale.database.lastWrite }}</th></tr></thead>
              <tbody>
                <tr v-for="item in databaseTableRows" :key="item.table_name"><td>{{ item.table_name }}</td><td>{{ item.live_rows ?? 'N/A' }}</td><td>{{ formatBytes(item.total_bytes) }}</td><td>{{ formatBytes(item.index_bytes) }}</td><td>{{ item.dead_row_ratio != null ? formatPercent(item.dead_row_ratio) : 'N/A' }}</td><td>N/A</td></tr>
                <tr v-if="!databaseTableRows.length"><td colspan="6" class="empty-cell">{{ databaseDiagnostics?.tables?.available === false ? 'N/A' : locale.noData }}</td></tr>
              </tbody>
            </table>
          </div>
        </OpsPanel>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.database.redis }}</h3><p>{{ locale.database.redisDetail }}</p></div>
        <Icon name="server" :size="16" />
      </section>

      <OpsPanel :title="locale.cache.ready" :subtitle="locale.database.redisDetail" :status="redisPanelStatus" :updated-at="redisUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="redisPanelEmpty && !initialOperationsLoading" empty-text="Redis 未配置，暂无可采集数据。" :refreshable="false" @refresh="loadOperationsData">
        <section class="ops-metric-grid">
          <div v-for="item in cacheMetrics" :key="item.label" class="ops-metric-item">
            <div class="ops-metric-item__head"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="ops-metric-item__label">{{ item.label }}</span></div>
            <strong class="ops-metric-item__value">{{ item.value || '--' }}</strong>
            <p class="ops-metric-item__detail">{{ item.detail }}</p>
          </div>
        </section>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.cache.connection" :status="redisPanelStatus" :updated-at="redisUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="redisPanelEmpty && !initialOperationsLoading" empty-text="Redis 未配置，暂无可采集数据。" :refreshable="false" @refresh="loadOperationsData">
          <dl class="detail-grid">
            <div v-for="item in cacheDetails" :key="item"><dt>{{ item }}</dt><dd>{{ cacheDetailValue(item) }}</dd></div>
          </dl>
        </OpsPanel>
        <OpsPanel :title="locale.cache.note" :status="redisPanelStatus" :updated-at="redisUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="redisPanelEmpty && !initialOperationsLoading" empty-text="Redis 未配置，暂无可采集数据。" :refreshable="false" @refresh="loadOperationsData">
          <p class="panel-copy">{{ locale.cache.description || 'Redis 用于验证码、限流和短期状态缓存；当前页面展示连接状态、命中率、内存和淘汰等可采集指标。未配置 Redis 时不会视为系统故障。' }}</p>
        </OpsPanel>
      </section>

      <OpsPanel :title="locale.cache.usageScope" :status="redisPanelStatus" :updated-at="redisUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="redisPanelEmpty && !initialOperationsLoading" empty-text="Redis 未配置，暂无可采集数据。" :refreshable="false" @refresh="loadOperationsData">
        <div class="scope-grid">
          <div v-for="item in cacheUsageScopes" :key="item.label" class="scope-row">
            <span class="service-row__icon"><Icon :name="item.icon" :size="15" /></span>
            <div>
              <p class="text-sm font-semibold text-zinc-300">{{ item.label }}</p>
              <p class="mt-1 text-xs leading-5 text-zinc-600">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </OpsPanel>

      <OpsPanel :title="locale.cache.commandMetrics" :subtitle="locale.cache.commandMetricsDetail" :status="redisPanelStatus" :updated-at="redisUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!redisCommandMetrics.length && !initialOperationsLoading" :empty-text="redisPanelEmpty ? 'Redis 未配置，暂无可采集数据。' : '暂无真实采集数据。'" :refreshable="false" @refresh="loadOperationsData">
        <div class="overflow-x-auto">
          <table class="data-table min-w-[680px]">
            <thead><tr><th>{{ locale.cache.command }}</th><th>{{ locale.cache.calls }}</th><th>P50</th><th>P99</th><th>{{ locale.cache.commandErrors }}</th></tr></thead>
            <tbody><tr v-for="item in redisCommandMetrics" :key="item.command"><td class="font-mono">{{ item.command }}</td><td>{{ item.calls }}</td><td>{{ item.p50LatencyUs != null ? `${item.p50LatencyUs} μs` : '--' }}</td><td>{{ item.p99LatencyUs != null ? `${item.p99LatencyUs} μs` : '--' }}</td><td :class="{ 'text-rose-400': item.errors > 0 }">{{ item.errors }}</td></tr><tr v-if="!redisCommandMetrics.length"><td colspan="5" class="empty-cell">暂无真实采集数据。</td></tr></tbody>
          </table>
        </div>
      </OpsPanel>
    </template>

    <template v-else-if="activeGroup === 'business'">
      <OpsPanel title="业务黄金指标" subtitle="近 5 分钟 · 点歌与排期业务采样" :status="performanceModuleStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeBusinessMetrics || !Object.values(runtimeBusinessMetrics).some((item) => item?.calls) && !initialOperationsLoading" :refreshable="false">
      <section class="ops-metric-grid">
        <div v-for="item in businessGoldenMetrics" :key="item.label" class="ops-metric-item">
          <div class="ops-metric-item__head"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="ops-metric-item__label">{{ item.label }}</span></div>
          <strong class="ops-metric-item__value">{{ item.value || '--' }}</strong>
          <p class="ops-metric-item__detail">{{ item.detail }}</p>
        </div>
      </section>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <OpsPanel class="xl:col-span-4" :title="locale.business.queueHealth" :subtitle="locale.business.queueHealthDetail" status="unknown" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!businessQueueSnapshot && !initialOperationsLoading" :refreshable="false">
          <dl class="detail-grid">
            <div v-for="item in businessQueueMetrics" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value || '--' }}</dd></div>
          </dl>
          <p class="ops-unknown-note">未提供阈值，仅展示当前值。</p>
        </OpsPanel>

        <OpsPanel class="xl:col-span-8" :title="locale.business.requestRateTrend" subtitle="近 5 分钟请求样本" :status="performanceModuleStatus" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeTimeline.length && !initialOperationsLoading" :refreshable="false">
          <div v-if="hasTimelineMetric('requests')" class="ops-time-chart">
            <div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('requests')" :key="tick">{{ tick }} 次</span></div>
            <div class="ops-time-chart__plot">
              <div class="ops-time-chart__grid"><i v-for="tick in chartTicks('requests')" :key="tick" /></div>
              <div class="ops-time-chart__bars"><i v-for="(point, index) in runtimeTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.requests, 'requests')}%` }" @mouseenter="showChartTooltip('business-requests', '请求数', point, point.requests, '次', index, runtimeTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div>
              <i v-if="chartTooltip.visible && chartTooltip.key === 'business-requests'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" />
              <div v-if="chartTooltip.visible && chartTooltip.key === 'business-requests'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div>
            </div>
            <div class="ops-time-chart__x-axis"><span>{{ formatChartTime(runtimeTimeline[0]?.at) }}</span><span>{{ formatChartTime(runtimeTimeline[runtimeTimeline.length - 1]?.at) }}</span></div>
          </div>
          <div v-else class="ops-empty-copy">暂无历史趋势数据，当前仅展示实时值。</div>
        </OpsPanel>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <OpsPanel class="xl:col-span-7" :title="locale.business.scheduleRateTrend" :subtitle="locale.business.scheduleRateTrendDetail" :status="businessTimelinePanelStatus" :updated-at="businessTimelineUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasBusinessTimelineMetric('schedules_created') && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false">
          <div class="ops-time-chart"><div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('schedules_created', businessOperationTimeline)" :key="tick">{{ tick }} 次</span></div><div class="ops-time-chart__plot"><div class="ops-time-chart__grid"><i v-for="tick in chartTicks('schedules_created', businessOperationTimeline)" :key="tick" /></div><div class="ops-time-chart__bars"><i v-for="(point, index) in businessOperationTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.schedules_created, 'schedules_created', businessOperationTimeline)}%` }" @mouseenter="showChartTooltip('schedule-created', '新增排期', point, point.schedules_created, '次', index, businessOperationTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div><i v-if="chartTooltip.visible && chartTooltip.key === 'schedule-created'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" /><div v-if="chartTooltip.visible && chartTooltip.key === 'schedule-created'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div></div><div class="ops-time-chart__x-axis"><span>{{ formatChartTime(businessOperationTimeline[0]?.at) }}</span><span>{{ formatChartTime(businessOperationTimeline[businessOperationTimeline.length - 1]?.at) }}</span></div></div>
        </OpsPanel>

        <OpsPanel class="xl:col-span-5" :title="locale.business.capacityPlanning" :subtitle="locale.business.capacityPlanningDetail" status="unknown" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeTimeline.length && !initialOperationsLoading" :refreshable="false">
          <dl class="detail-grid">
            <div v-for="item in businessCapacityMetrics" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          </dl>
          <p class="ops-unknown-note">未提供阈值，仅展示当前值。</p>
        </OpsPanel>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <OpsPanel class="xl:col-span-8" :title="locale.business.operationOutcomes" :subtitle="locale.business.operationOutcomesDetail" :status="businessTimelinePanelStatus" :updated-at="businessTimelineUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!businessOperationTimeline.length && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false">
          <div v-if="hasBusinessTimelineMetric('schedules_played')" class="ops-time-chart"><div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('schedules_played', businessOperationTimeline)" :key="tick">{{ tick }} 次</span></div><div class="ops-time-chart__plot"><div class="ops-time-chart__grid"><i v-for="tick in chartTicks('schedules_played', businessOperationTimeline)" :key="tick" /></div><div class="ops-time-chart__bars"><i v-for="(point, index) in businessOperationTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.schedules_played, 'schedules_played', businessOperationTimeline)}%` }" @mouseenter="showChartTooltip('schedule-played', '已播排期', point, point.schedules_played, '次', index, businessOperationTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div><i v-if="chartTooltip.visible && chartTooltip.key === 'schedule-played'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" /><div v-if="chartTooltip.visible && chartTooltip.key === 'schedule-played'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div></div><div class="ops-time-chart__x-axis"><span>{{ formatChartTime(businessOperationTimeline[0]?.at) }}</span><span>{{ formatChartTime(businessOperationTimeline[businessOperationTimeline.length - 1]?.at) }}</span></div></div>
          <dl class="detail-grid"><div v-for="item in businessOutcomeTotals" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
        </OpsPanel>

      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.business.goldMetrics }}</h3><p>{{ locale.business.goldMetricsDetail }}</p></div>
        <Icon name="music" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <OpsPanel v-for="panel in businessMetricGroups" :key="panel.title" :title="panel.title" :subtitle="panel.detail" status="unknown" :updated-at="lastUpdatedRelative" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeMetrics && !initialOperationsLoading" :refreshable="false">
          <dl class="server-resource-list">
            <div v-for="item in panel.items" :key="item"><dt>{{ item }}</dt><dd>{{ businessGroupValue(item) }}</dd></div>
          </dl>
          <p class="ops-unknown-note">未提供阈值，仅展示当前值。</p>
        </OpsPanel>
      </section>
    </template>

    <template v-else-if="activeGroup === 'security'">
      <OpsPanel title="风险事件摘要" subtitle="风险事件处置统计尚无独立采集来源。" status="unknown" :updated-at="securityUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData" />

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <OpsPanel class="xl:col-span-7" title="当前活跃风险" subtitle="优先展示当前采集窗口内需要关注的认证、验证码和限流信号。" :status="securityModuleStatus" :updated-at="securityUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeHttpMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <div class="risk-distribution">
            <aside class="risk-total" :class="{ 'risk-total--active': activeRiskCount }">
              <div class="risk-total__eyebrow">
                <span class="risk-total__icon"><Icon name="warning" :size="16" /></span>
                <span>{{ activeRiskCount ? '待处理' : '当前窗口' }}</span>
              </div>
              <div class="risk-total__value"><strong>{{ activeRiskCount }}</strong><span>个风险事件</span></div>
              <p>{{ activeRiskCount ? '存在尚需关注的风险信号，建议按错误级别优先排查。' : '当前采集窗口内未发现需要处理的风险信号。' }}</p>
              <div class="risk-total__track" aria-hidden="true">
                <i class="risk-total__track-error" :style="{ width: `${securityRiskShare('error')}%` }" />
                <i class="risk-total__track-warning" :style="{ width: `${securityRiskShare('warning')}%` }" />
              </div>
              <div class="risk-total__legend">
                <span>错误 {{ securityRiskStatusTotal('error') }}</span>
                <span>警告 {{ securityRiskStatusTotal('warning') }}</span>
                <span>总量 {{ activeRiskCount }}</span>
              </div>
              <div class="risk-total__priority">
                <span>优先处置</span>
                <strong>{{ securityRiskPriorityLabel }}</strong>
                <em :class="`risk-total__priority--${securityModuleStatus}`">{{ activeRiskCount ? '存在活跃风险' : '未发现风险' }}</em>
              </div>
            </aside>

            <div class="risk-breakdown">
              <dl class="risk-summary-grid">
                <div v-for="item in securityRiskSummary" :key="item.label"><dt>{{ item.label }}</dt><dd :class="`ops-tone--${item.status}`">{{ item.value }}</dd></div>
              </dl>
              <div class="risk-levels">
                <p v-if="!prioritizedSecurityRiskRows.length" class="risk-levels__empty">未发现风险</p>
                <div v-for="item in prioritizedSecurityRiskRows" :key="item.label" class="risk-level-row">
                  <div class="risk-level-row__head">
                    <span class="risk-level-name" :class="`risk-level-name--${item.status}`">{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                  <div class="risk-level-row__track"><i :class="`risk-level-row__track--${item.status}`" :style="{ width: `${securityRiskItemShare(item)}%` }" /></div>
                </div>
              </div>
            </div>
          </div>
        </OpsPanel>

        <OpsPanel class="xl:col-span-5" title="异常行为账户" subtitle="按用户维度识别短时刷歌、刷票和投稿限额触发。" status="unknown" :updated-at="securityUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData" />
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.audit.securitySignals }}</h3><p>{{ locale.audit.securitySignalsDetail }}</p></div>
        <Icon name="warning" :size="16" />
      </section>

      <OpsPanel :title="locale.audit.securitySignals" :subtitle="locale.audit.securitySignalsDetail" :status="securitySignalsPanelStatus" :updated-at="securityUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <dl class="server-resource-list">
          <div v-for="item in prioritizedSecuritySignalMetrics" :key="item.label">
            <dt>{{ item.label }}<small class="block">{{ item.detail }}</small></dt>
            <dd>{{ securityMetricValue(item.label) }}</dd>
          </div>
        </dl>
      </OpsPanel>

      <OpsPanel :title="locale.audit.signalRate" :subtitle="locale.audit.signalRateDetail" status="unknown" :updated-at="securityUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData" />

      <OpsPanel :title="locale.audit.recentHighRiskEvents" :subtitle="locale.audit.recentHighRiskEventsDetail" :status="securityAuditPanelStatus" :updated-at="securityEventsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!highRiskSecurityEvents.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <dl class="server-resource-list"><div v-for="item in highRiskSecurityEvents.slice(0, 10)" :key="`${item.at}-${item.event}`"><dt>{{ item.event }}<small class="block">{{ item.summary }}</small></dt><dd>{{ formatTimestamp(item.at) }}</dd></div></dl>
      </OpsPanel>

      <OpsPanel :title="locale.audit.eventList" :subtitle="locale.audit.eventListDetail" :status="securityAuditPanelStatus" :updated-at="securityEventsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!securityAuditEvents.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <div class="overflow-x-auto"><table class="data-table min-w-[900px]"><thead><tr><th>时间</th><th>来源</th><th>事件</th><th>结果</th><th>IP</th><th>Request ID</th><th>摘要</th></tr></thead><tbody><tr v-for="item in securityAuditEvents.slice(0, 50)" :key="`${item.at}-${item.event}-${item.requestId || ''}`"><td>{{ formatTimestamp(item.at) }}</td><td>{{ item.source }}</td><td class="font-mono">{{ item.event }}</td><td>{{ item.severity }}</td><td class="font-mono">{{ maskIpAddress(item.ip) }}</td><td class="font-mono">{{ item.requestId || '--' }}</td><td>{{ item.summary }}</td></tr></tbody></table></div>
      </OpsPanel>

      <OpsPanel :title="locale.audit.ipBehaviorTimeline" :subtitle="locale.audit.ipBehaviorTimelineDetail" :status="ipBehaviorPanelStatus" :updated-at="securityEventsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!ipBehaviorRows.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <div class="overflow-x-auto"><table class="data-table min-w-[760px]"><thead><tr><th>IP</th><th>请求数</th><th>4xx</th><th>5xx</th><th>最近路由</th><th>首次出现</th><th>最近出现</th></tr></thead><tbody><tr v-for="item in ipBehaviorRows" :key="item.ip"><td class="font-mono">{{ maskIpAddress(item.ip) }}</td><td>{{ item.requests }}</td><td>{{ item.client_errors }}</td><td :class="{ 'text-rose-400': Number(item.server_errors) > 0 }">{{ item.server_errors }}</td><td>{{ item.last_route }}</td><td>{{ formatTimestamp(item.first_seen) }}</td><td>{{ formatTimestamp(item.last_seen) }}</td></tr></tbody></table></div>
      </OpsPanel>
    </template>

    <template v-else-if="activeGroup === 'user-activity'">
      <UserActivityPanel :refresh-token="userActivityRefreshToken" />
    </template>

    <template v-else-if="activeGroup === 'operation-logs'">
      <OpsPanel
        title="操作记录"
        subtitle="仅超级管理员可查看高风险管理操作"
        :status="operationLogsLoading || !operationLogsUpdatedAt || operationLogsForbidden ? 'unknown' : operationLogsError || operationLogsUnauthorized ? 'error' : 'ok'"
        :updated-at="operationLogsUpdatedAt ? formatTimestamp(operationLogsUpdatedAt) : '尚未读取'"
        :refreshable="!operationLogsForbidden"
        @refresh="loadOperationLogs()"
      >
        <div v-if="operationLogsLoading" class="operation-log-skeleton" aria-label="正在读取操作记录">
          <i v-for="index in 7" :key="index" />
        </div>

        <div v-else-if="operationLogsForbidden" class="operation-log-state">
          <Icon name="warning" :size="16" />
          <span>仅超级管理员可查看操作记录。</span>
        </div>

        <div v-else-if="operationLogsUnauthorized" class="operation-log-state operation-log-state--error">
          <Icon name="warning" :size="16" />
          <span>登录已失效，请重新登录。</span>
        </div>

        <div v-else-if="operationLogsError" class="operation-log-state operation-log-state--error">
          <span>{{ operationLogsError }}</span>
          <button type="button" class="filter-action" @click="loadOperationLogs()"><Icon name="refresh" :size="13" />重试</button>
        </div>

        <template v-else>
          <section class="operation-log-filters">
            <label class="filter-field">
              <span>开始时间</span>
              <input v-model="operationLogFilters.startAt" type="datetime-local">
            </label>
            <label class="filter-field">
              <span>结束时间</span>
              <input v-model="operationLogFilters.endAt" type="datetime-local">
            </label>
            <label class="filter-field">
              <span>操作者 ID</span>
              <input v-model="operationLogFilters.actorId" type="number" min="1" placeholder="全部">
            </label>
            <CustomSelect v-model="operationLogFilters.action" :options="operationLogActionOptions" placeholder="全部动作" class-name="operation-log-select" />
            <CustomSelect v-model="operationLogFilters.targetType" :options="operationLogTargetTypeOptions" placeholder="全部对象" class-name="operation-log-select" />
            <CustomSelect v-model="operationLogFilters.result" :options="operationLogResultOptions" placeholder="全部结果" class-name="operation-log-select" />
            <label class="filter-field filter-field--wide">
              <Icon name="search" :size="13" />
              <input v-model="operationLogFilters.keyword" type="search" placeholder="关键词" @keyup.enter="applyOperationLogFilters">
            </label>
            <label class="filter-field filter-field--wide">
              <span>Request ID</span>
              <input v-model="operationLogRequestId" type="search" placeholder="精确匹配" @keyup.enter="applyOperationLogFilters">
            </label>
            <button type="button" class="filter-action" @click="applyOperationLogFilters"><Icon name="search" :size="13" />查询</button>
          </section>

          <div v-if="!operationLogs.length" class="operation-log-state">暂无操作记录。</div>
          <div v-else class="overflow-x-auto">
            <table class="data-table min-w-[1120px] operation-log-table">
              <thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>结果</th><th>来源 IP</th><th>摘要</th></tr></thead>
              <tbody>
                <template v-for="item in operationLogs" :key="item.id">
                  <tr class="operation-log-row" :class="{ 'operation-log-row--expanded': expandedOperationLogId === item.id }" tabindex="0" @click="toggleOperationLogDetail(item)" @keydown.enter.prevent="toggleOperationLogDetail(item)">
                    <td class="whitespace-nowrap">{{ formatTimestamp(item.createdAt) }}</td>
                    <td><div class="operation-log-actor"><strong>{{ item.actorName || '已删除用户' }}</strong><small>{{ item.actorRole || '--' }}</small></div></td>
                    <td class="font-mono text-xs">{{ item.action }}</td>
                    <td><span class="block max-w-[190px] truncate" :title="operationLogTarget(item)">{{ operationLogTarget(item) }}</span></td>
                    <td><span class="operation-log-result" :class="`operation-log-result--${String(item.result || '').toLowerCase()}`">{{ item.result === 'SUCCESS' ? '成功' : '失败' }}</span></td>
                    <td class="font-mono">{{ item.ipAddress || '--' }}</td>
                    <td><span class="block max-w-[280px] truncate" :title="item.summary || '--'">{{ item.summary || '--' }}</span></td>
                  </tr>
                  <tr v-if="expandedOperationLogId === item.id" class="operation-log-detail-row">
                    <td colspan="7">
                      <div v-if="operationLogDetailLoading" class="operation-log-detail-state">正在读取详情...</div>
                      <div v-else-if="operationLogDetailError" class="operation-log-detail-state operation-log-detail-state--error"><span>{{ operationLogDetailError }}</span><button type="button" class="table-action" @click.stop="loadOperationLogDetail(item.id)">重试</button></div>
                      <div v-else-if="operationLogDetail" class="operation-log-detail-grid">
                        <dl><dt>完整 IP</dt><dd class="font-mono">{{ operationLogDetail.ipAddress || '--' }}</dd><dt>Request ID</dt><dd class="font-mono">{{ operationLogDetail.requestId || '--' }}</dd><dt>失败代码</dt><dd>{{ operationLogDetail.failureCode || '--' }}</dd></dl>
                        <div><strong>变更摘要</strong><pre>{{ formatOperationLogChanges(operationLogDetail.changes) }}</pre></div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <footer v-if="operationLogsPagination.totalPages > 1" class="operation-log-pagination">
            <span>第 {{ operationLogsPagination.page }} / {{ operationLogsPagination.totalPages }} 页，共 {{ operationLogsPagination.total }} 条</span>
            <div><button type="button" class="table-action" :disabled="operationLogsPagination.page <= 1" @click="changeOperationLogPage(operationLogsPagination.page - 1)">上一页</button><button type="button" class="table-action" :disabled="operationLogsPagination.page >= operationLogsPagination.totalPages" @click="changeOperationLogPage(operationLogsPagination.page + 1)">下一页</button></div>
          </footer>
        </template>
      </OpsPanel>
    </template>

    <template v-else-if="activeGroup === 'debug'">
      <OpsPanel :title="locale.debug.requestSearch" :subtitle="locale.debug.requestSearchDetail" :status="runtimeMetrics ? 'ok' : 'unknown'" :updated-at="diagnosticMetricsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="false" :refreshable="Boolean(debugRequestId) && !diagnosticLoading" @refresh="openRequestDiagnosis(debugRequestId)">
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
          <button type="submit" class="filter-action" :disabled="!debugRequestId || diagnosticLoading"><Icon name="search" :size="13" />{{ diagnosticLoading ? '正在诊断' : locale.debug.diagnose }}</button>
        </form>
      </OpsPanel>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.singleRequestTrace }}</h3><p>{{ locale.debug.singleRequestTraceDetail }}</p></div>
        <Icon name="layers" :size="16" />
      </section>

      <OpsPanel :title="locale.debug.singleRequestTrace" :subtitle="locale.debug.singleRequestTraceDetail" :status="diagnosticPanelStatus" :updated-at="diagnosticUpdatedAtText" :pending="diagnosticLoading" :error="diagnosticError" :empty="diagnosticResultEmpty && !diagnosticLoading" :refreshable="false" @refresh="openRequestDiagnosis(debugRequestId)">
        <section class="ops-metric-grid">
          <div v-for="item in requestSummaryItems" :key="item.label" class="ops-metric-item">
            <div class="ops-metric-item__head"><span class="metric-icon"><Icon :name="item.icon" :size="14" /></span><span class="ops-metric-item__label">{{ item.label }}</span></div>
            <strong class="ops-metric-item__value">{{ item.value || 'N/A' }}</strong>
            <p class="ops-metric-item__detail">{{ item.detail }}</p>
          </div>
        </section>
      </OpsPanel>

      <OpsPanel :title="locale.debug.diagnosisResult" :subtitle="locale.debug.singleRequestTraceDetail" :status="diagnosticPanelStatus" :updated-at="diagnosticUpdatedAtText" :pending="diagnosticLoading" :error="diagnosticError" :empty="diagnosticResultEmpty && !diagnosticLoading" :refreshable="false" @refresh="openRequestDiagnosis(debugRequestId)">
        <div class="diagnosis-result diagnosis-result--banner">
          <span><Icon name="activity" :size="14" />{{ locale.debug.diagnosisResult }}</span>
          <strong>{{ selectedDebugRequest ? `${selectedDebugRequest.status} ${formatMilliseconds(selectedDebugRequest.durationMs)}` : 'N/A' }}</strong>
          <button type="button" class="table-action" :disabled="!debugRequestId" @click="copyDiagnosticRequestId">复制 Request ID</button>
        </div>
        <details class="diagnostic-raw-details">
          <summary>原始 JSON / 诊断详情</summary>
          <pre>{{ diagnosticRawJson }}</pre>
        </details>
      </OpsPanel>

      <OpsPanel :title="locale.debug.traceWaterfall" :subtitle="debugRequestId ? '来自 Sentry transaction 的真实 span 层级。' : locale.debug.traceEnterRequestId" :status="tracePanelStatus" :updated-at="diagnosticUpdatedAtText" :pending="diagnosticLoading" :error="diagnosticError" :empty="!traceSpanRows.length && !diagnosticLoading" empty-text="未找到该 Request ID 对应的真实 Trace span。" :refreshable="false" @refresh="openRequestDiagnosis(debugRequestId)">
        <div class="trace-waterfall">
          <div v-for="span in traceSpanRows" :key="span.spanId" class="trace-waterfall__row">
            <div class="trace-waterfall__label" :style="{ paddingLeft: `${span.depth * 12}px` }" :title="span.description">{{ span.operation }} · {{ span.description }}</div>
            <div class="trace-waterfall__track"><span class="trace-waterfall__bar" :class="span.tone" :style="{ left: `${span.left}%`, width: `${span.width}%` }">{{ formatMilliseconds(span.durationMs) }}</span></div>
          </div>
        </div>
      </OpsPanel>

      <OpsPanel :title="locale.debug.requestLogChain" :subtitle="locale.debug.requestLogChainDetail" :status="diagnosticPanelStatus" :updated-at="diagnosticUpdatedAtText" :pending="diagnosticLoading" :error="diagnosticError" :empty="!diagnosticLogEntries.length && !diagnosticLoading" :refreshable="false" @refresh="openRequestDiagnosis(debugRequestId)">
        <div class="overflow-x-auto">
          <table class="data-table min-w-[960px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.debug.elapsed }}</th><th>{{ locale.logs.level }}</th><th>{{ locale.debug.eventName }}</th><th>{{ locale.logs.scope }}</th><th>{{ locale.debug.structuredFields }}</th></tr></thead>
            <tbody>
              <tr v-for="item in diagnosticLogEntries" :key="`${item.at}-${item.requestId}`"><td>{{ formatTimestamp(item.at) }}</td><td>{{ formatMilliseconds(item.durationMs) }}</td><td>{{ item.level }}</td><td>{{ item.route }}</td><td>server</td><td>status={{ item.status }} requestId={{ item.requestId || 'N/A' }}</td></tr>
            </tbody>
          </table>
        </div>
      </OpsPanel>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.errorAggregation }}</h3><p>{{ locale.debug.errorAggregationDetail }}</p></div>
        <Icon name="warning" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.debug.topErrors" :subtitle="locale.debug.topErrorsDetail" :status="errorAggregationPanelStatus" :updated-at="diagnosticMetricsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!recentErrorRequests.length && !sentryIssues.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[640px]">
              <thead><tr><th>{{ locale.debug.errorMessage }}</th><th>{{ locale.debug.occurrences }}</th><th>{{ locale.debug.affectedUsers }}</th><th>{{ locale.debug.sampleRequestId }}</th><th>{{ locale.debug.lastOccurred }}</th></tr></thead>
              <tbody>
                <tr v-for="item in recentErrorRequests" :key="`${item.at}-${item.requestId || item.route}`"><td>{{ item.status >= 500 ? 'HTTP server error' : 'HTTP client error' }}</td><td>1</td><td>N/A</td><td class="font-mono">{{ item.requestId || 'N/A' }}</td><td>{{ formatTimestamp(item.at) }}</td></tr>
                <tr v-for="item in sentryIssues" :key="`sentry-${item.id}`"><td>{{ item.title }}</td><td>{{ item.count }}</td><td>N/A</td><td class="font-mono">Sentry #{{ item.id }}</td><td>{{ formatTimestamp(item.lastSeen) }}</td></tr>
              </tbody>
            </table>
          </div>
        </OpsPanel>
        <OpsPanel :title="locale.debug.errorTrend" :subtitle="locale.debug.errorTrendDetail" :status="requestTrendPanelStatus" :updated-at="requestBehaviorUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasRequestBehaviorMetric('errors') && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false" @refresh="loadOperationsData">
        <div class="ops-time-chart"><div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('errors', requestBehaviorTimeline)" :key="tick">{{ tick }} 次</span></div><div class="ops-time-chart__plot"><div class="ops-time-chart__grid"><i v-for="tick in chartTicks('errors', requestBehaviorTimeline)" :key="tick" /></div><div class="ops-time-chart__bars"><i v-for="(point, index) in requestBehaviorTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.errors, 'errors', requestBehaviorTimeline)}%` }" @mouseenter="showChartTooltip('request-errors', '错误请求', point, point.errors, '次', index, requestBehaviorTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div><i v-if="chartTooltip.visible && chartTooltip.key === 'request-errors'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" /><div v-if="chartTooltip.visible && chartTooltip.key === 'request-errors'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div></div><div class="ops-time-chart__x-axis"><span>{{ formatChartTime(requestBehaviorTimeline[0]?.at) }}</span><span>{{ formatChartTime(requestBehaviorTimeline[requestBehaviorTimeline.length - 1]?.at) }}</span></div></div>
        </OpsPanel>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.slowRequestDiagnosis }}</h3><p>{{ locale.debug.slowRequestDiagnosisDetail }}</p></div>
        <Icon name="clock" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.debug.topSlowRequests" subtitle="基于当前已采集的异常与持久化请求样本，不伪造历史趋势。" :status="slowRequestsPanelStatus" :updated-at="diagnosticMetricsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!recentDiagnosticRequests.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[760px]">
              <thead><tr><th>Method</th><th>{{ locale.application.route }}</th><th>{{ locale.debug.statusCode }}</th><th>{{ locale.debug.duration }}</th><th>{{ locale.logs.time }}</th><th>{{ locale.overview.logRequestId }}</th><th>{{ locale.debug.drilldown }}</th></tr></thead>
              <tbody>
                <tr v-for="item in recentDiagnosticRequests" :key="`${item.at}-${item.requestId || item.route}`" :class="{ 'request-row--error': item.status >= 500 }"><td>{{ item.method || 'HTTP' }}</td><td>{{ item.route || '未知路由' }}</td><td>{{ item.status ?? '—' }}</td><td><span class="duration-value" :class="durationTone(item.durationMs)">{{ item.durationMs != null ? formatMilliseconds(item.durationMs) : '暂无耗时' }}</span></td><td>{{ formatTimestamp(item.at) }}</td><td class="font-mono">{{ item.requestId || '暂无' }}</td><td><button type="button" class="table-action" :disabled="!item.requestId" @click="openRequestDiagnosis(item.requestId)">{{ locale.debug.drilldown }}</button></td></tr>
              </tbody>
            </table>
          </div>
        </OpsPanel>
        <OpsPanel :title="locale.debug.durationDistribution" :subtitle="locale.debug.durationDistributionDetail" :status="performanceModuleStatus" :updated-at="diagnosticMetricsUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeHttpMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <div class="diagnostic-duration-summary"><strong>{{ runtimeHttpMetrics?.p95Ms != null ? formatMilliseconds(runtimeHttpMetrics.p95Ms) : '暂无 P95 数据' }}</strong><span>近 5 分钟 P95 响应时间</span><p>当前数据源未提供完整耗时分桶，页面不绘制伪造直方图。</p></div>
        </OpsPanel>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.debug.userPerspective }}</h3><p>{{ locale.debug.userPerspectiveDetail }}</p></div>
        <Icon name="user" :size="16" />
      </section>

      <OpsPanel :title="locale.debug.userRequestTimeline" :subtitle="locale.debug.userRequestTimelineDetail" :status="requestTrendPanelStatus" :updated-at="requestBehaviorUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasRequestBehaviorMetric('user_requests') && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false" @refresh="loadOperationsData">
        <div class="ops-time-chart"><div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('user_requests', requestBehaviorTimeline)" :key="tick">{{ tick }} 次</span></div><div class="ops-time-chart__plot"><div class="ops-time-chart__grid"><i v-for="tick in chartTicks('user_requests', requestBehaviorTimeline)" :key="tick" /></div><div class="ops-time-chart__bars"><i v-for="(point, index) in requestBehaviorTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.user_requests, 'user_requests', requestBehaviorTimeline)}%` }" @mouseenter="showChartTooltip('user-requests', '用户侧请求', point, point.user_requests, '次', index, requestBehaviorTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div><i v-if="chartTooltip.visible && chartTooltip.key === 'user-requests'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" /><div v-if="chartTooltip.visible && chartTooltip.key === 'user-requests'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div></div><div class="ops-time-chart__x-axis"><span>{{ formatChartTime(requestBehaviorTimeline[0]?.at) }}</span><span>{{ formatChartTime(requestBehaviorTimeline[requestBehaviorTimeline.length - 1]?.at) }}</span></div></div>
      </OpsPanel>
    </template>

    <template v-else-if="activeGroup === 'logs'">
      <OpsPanel :title="locale.logCenter.metricsTitle" :subtitle="locale.logCenter.metricsDetail" :status="logPanelStatus" :updated-at="logUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!logSourceEntries.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <dl class="detail-grid">
          <div v-for="item in logCenterMetrics" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
        </dl>
      </OpsPanel>

      <OpsPanel :title="locale.logCenter.structuredQuery" :subtitle="locale.logCenter.structuredQueryDetail" :status="logPanelStatus" :updated-at="logUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!runtimeMetrics && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
        <div class="log-search-grid">
          <label class="filter-field filter-field--wide"><Icon name="search" :size="13" /><input v-model.trim="logKeyword" type="text" :placeholder="locale.logCenter.keywordPlaceholder"></label>
          <label class="filter-field filter-field--wide"><Icon name="layers" :size="13" /><input v-model.trim="logRequestId" type="text" :placeholder="locale.logCenter.requestIdPlaceholder"></label>
          <button type="button" class="filter-field" disabled><span>{{ locale.logCenter.allUsers }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.logCenter.allRoutes }}</span><Icon name="chevron-down" :size="13" /></button>
          <div class="log-level-filter" aria-label="日志级别筛选">
            <button v-for="level in logLevelOptions" :key="level.value" type="button" :class="{ 'is-active': logLevelFilter === level.value, [`is-${level.value}`]: level.value !== 'all' }" @click="logLevelFilter = level.value">{{ level.label }}</button>
          </div>
          <button type="button" class="filter-field" disabled><span>{{ locale.filters.allScopes }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.logCenter.allStatusCodes }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-field" disabled><span>{{ locale.filters.lastHour }}</span><Icon name="chevron-down" :size="13" /></button>
          <button type="button" class="filter-action" @click="loadOperationsData()"><Icon name="search" :size="13" />{{ locale.logCenter.query }}</button>
        </div>
      </OpsPanel>

      <OpsPanel :title="locale.logCenter.logResults" :subtitle="`${locale.logCenter.logResultsDetail} · ${locale.logCount} ${logEntries.length}`" :status="logPanelStatus" :updated-at="logUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!logEntries.length && !initialOperationsLoading" :empty-text="logResultsEmptyText" :refreshable="false" @refresh="loadOperationsData">
        <div class="overflow-x-auto">
          <table class="data-table min-w-[1320px]">
            <thead><tr><th>{{ locale.logs.time }}</th><th>{{ locale.logs.level }}</th><th>Method</th><th>{{ locale.application.route }}</th><th>{{ locale.debug.statusCode }}</th><th>耗时</th><th>{{ locale.overview.logRequestId }}</th><th>{{ locale.logs.message }}</th><th>{{ locale.logCenter.action }}</th></tr></thead>
          <tbody>
            <tr v-for="item in logEntries" :key="logKey(item)" class="log-result-row" tabindex="0" @click="toggleLogDetails(item)" @keydown.enter.prevent="toggleLogDetails(item)"><td>{{ formatTimestamp(item.at) }}</td><td><span class="log-level" :class="`log-level--${item.level}`">{{ item.level === 'error' ? '错误' : item.level === 'warn' ? '警告' : '信息' }}</span></td><td>{{ item.method || 'HTTP' }}</td><td>{{ item.route }}</td><td>{{ item.status }}</td><td>{{ item.durationMs != null ? formatMilliseconds(item.durationMs) : '暂无数据' }}</td><td class="font-mono">{{ item.requestId || '暂无' }}</td><td><span class="block max-w-[25rem] truncate" :title="redactSensitiveText(item.message)">{{ redactSensitiveText(item.message) }}</span></td><td><button type="button" class="table-action" @click.stop="copyLogEntry(item)">{{ locale.logCenter.copy }}</button></td></tr>
            <template v-for="item in logEntries" :key="`${logKey(item)}-details`"><tr v-if="isLogExpanded(item)" class="log-detail-row"><td colspan="9"><div class="log-detail-grid"><div><strong>结构化字段</strong><dl><dt>时间</dt><dd>{{ formatTimestamp(item.at) }}</dd><dt>{{ locale.logs.scope }}</dt><dd>{{ item.source === 'sentry' ? 'Sentry' : 'HTTP' }}</dd><dt>路由</dt><dd>{{ item.route }}</dd><dt>状态码</dt><dd>{{ item.status }}</dd><dt>{{ locale.debug.occurrences }}</dt><dd>{{ item.occurrenceCount ?? 1 }}</dd><dt>耗时</dt><dd>{{ item.durationMs != null ? formatMilliseconds(item.durationMs) : '暂无数据' }}</dd><dt>Request ID</dt><dd class="font-mono">{{ item.requestId || '暂无' }}</dd></dl></div><pre>{{ formatLogDetails(item) }}</pre></div></td></tr></template>
          </tbody>
          </table>
        </div>
      </OpsPanel>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.logCenter.logContext" :subtitle="locale.logCenter.logContextDetail" :status="logContextPanelStatus" :updated-at="logUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!selectedLogEntry && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="detail-grid">
            <div v-for="item in logContextFields" :key="item"><dt>{{ item }}</dt><dd>{{ logContextValue(item) }}</dd></div>
          </dl>
        </OpsPanel>
        <OpsPanel :title="locale.logCenter.archiveSettings" :subtitle="locale.logCenter.archiveSettingsDetail" :status="logArchivePanelStatus" :updated-at="logArchiveUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasLogArchiveData && !initialOperationsLoading" empty-text="暂无真实采集数据。" :refreshable="false" @refresh="loadOperationsData">
          <dl class="detail-grid">
            <div><dt>{{ locale.logCenter.archiveSize }}</dt><dd>{{ formatBytes(logArchiveSnapshot.archiveSize) }}</dd></div>
            <div><dt>当前日志文件</dt><dd class="truncate" :title="logArchiveSnapshot.currentLogFile">{{ logArchiveSnapshot.currentLogFile }}</dd></div>
            <div><dt>日志文件数</dt><dd>{{ logArchiveSnapshot.totalLogFiles }}</dd></div>
            <div><dt>已归档文件数</dt><dd>{{ logArchiveSnapshot.archivedFiles }}</dd></div>
            <div><dt>{{ locale.logCenter.lastArchivedAt }}</dt><dd>{{ formatTimestamp(logArchiveSnapshot.lastArchivedAt) }}</dd></div>
            <div><dt>最近日志</dt><dd>{{ formatTimestamp(logArchiveSnapshot.newestLog) }}</dd></div>
            <div><dt>最早日志</dt><dd>{{ formatTimestamp(logArchiveSnapshot.oldestLog) }}</dd></div>
          </dl>
        </OpsPanel>
      </section>
    </template>

    <template v-else-if="activeGroup === 'dependencies'">
      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.healthMatrix }}</h3><p>{{ locale.dependencies.healthMatrixDetail }}</p></div>
        <Icon name="layers" :size="16" />
      </section>

      <section class="dependency-matrix">
        <OpsPanel v-for="item in dependencyHealthCards" :key="item.label" class="dependency-card" :title="item.label" :status="dependencyCardStatus(item.label)" :updated-at="dependencyUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="dependencyCardEmpty(item.label) && !initialOperationsLoading" :empty-text="dependencyCardEmptyText(item.label)" :refreshable="false" @refresh="loadOperationsData">
          <div class="dependency-card__status" :class="`dependency-card__status--${dependencyCardStatus(item.label)}`"><span>{{ locale.dependencies.currentStatus }}</span><strong>{{ dependencyStatusValue(item.label) }}</strong></div>
          <p v-if="dependencyFailureReason(item.label)" class="dependency-card__failure">最近失败：{{ dependencyFailureReason(item.label) }}</p>
          <dl class="dependency-card__metrics">
            <template v-for="group in dependencyMetricGroups(item)" :key="group.key">
              <dt class="dependency-card__group-label">{{ group.label }}</dt>
              <div v-for="detail in group.details" :key="detail"><dt>{{ detail }}</dt><dd>{{ dependencyMetricValue(item.label, detail) }}</dd></div>
            </template>
          </dl>
        </OpsPanel>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.semanticHealth }}</h3><p>{{ locale.dependencies.semanticHealthDetail }}</p></div>
        <Icon name="music" :size="16" />
      </section>

      <OpsPanel :title="locale.dependencies.semanticFailureTrend" :subtitle="locale.dependencies.semanticFailureTrendDetail" :status="dependenciesModuleStatus" :updated-at="dependencyTimelineUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasDependencyTimelineMetric('semantic_failure_rate') && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false">
        <div class="ops-time-chart">
          <div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('semantic_failure_rate', dependencyAggregateTimeline)" :key="tick">{{ tick }} %</span></div>
          <div class="ops-time-chart__plot">
            <div class="ops-time-chart__grid"><i v-for="tick in chartTicks('semantic_failure_rate', dependencyAggregateTimeline)" :key="tick" /></div>
            <div class="ops-time-chart__bars"><i v-for="(point, index) in dependencyAggregateTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.semantic_failure_rate, 'semantic_failure_rate', dependencyAggregateTimeline)}%` }" @mouseenter="showChartTooltip('dependency-semantic-failure', locale.dependencies.semanticFailureTrend, point, point.semantic_failure_rate, '%', index, dependencyAggregateTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div>
            <i v-if="chartTooltip.visible && chartTooltip.key === 'dependency-semantic-failure'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" />
            <div v-if="chartTooltip.visible && chartTooltip.key === 'dependency-semantic-failure'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div>
          </div>
          <div class="ops-time-chart__x-axis"><span>{{ formatChartTime(dependencyAggregateTimeline[0]?.at) }}</span><span>{{ formatChartTime(dependencyAggregateTimeline[dependencyAggregateTimeline.length - 1]?.at) }}</span></div>
        </div>
      </OpsPanel>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.latencyAndErrors }}</h3><p>{{ locale.dependencies.latencyAndErrorsDetail }}</p></div>
        <Icon name="activity" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.dependencies.p95Latency" :subtitle="locale.dependencies.p95LatencyDetail" status="unknown" :updated-at="dependencyUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData" />
        <OpsPanel :title="locale.dependencies.platformErrorRate" :subtitle="locale.dependencies.platformErrorRateDetail" status="unknown" :updated-at="dependencyUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel :title="locale.dependencies.callVolumeTrend" :subtitle="locale.dependencies.callVolumeTrendDetail" :status="dependenciesModuleStatus" :updated-at="dependencyTimelineUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!hasDependencyTimelineMetric('calls') && !initialOperationsLoading" empty-text="暂无历史趋势数据，当前仅展示实时值。" :refreshable="false">
          <div class="ops-time-chart">
            <div class="ops-time-chart__y-axis"><span v-for="tick in chartTicks('calls', dependencyAggregateTimeline)" :key="tick">{{ tick }} 次</span></div>
            <div class="ops-time-chart__plot">
              <div class="ops-time-chart__grid"><i v-for="tick in chartTicks('calls', dependencyAggregateTimeline)" :key="tick" /></div>
              <div class="ops-time-chart__bars"><i v-for="(point, index) in dependencyAggregateTimeline" :key="point.at" :style="{ height: `${runtimeBarHeight(point.calls, 'calls', dependencyAggregateTimeline)}%` }" @mouseenter="showChartTooltip('dependency-call-volume', locale.dependencies.callVolumeTrend, point, point.calls, '次', index, dependencyAggregateTimeline.length, $event)" @mouseleave="hideChartTooltip" /></div>
              <i v-if="chartTooltip.visible && chartTooltip.key === 'dependency-call-volume'" class="ops-time-chart__guide" :style="{ left: `${chartTooltip.barLeft}%` }" />
              <div v-if="chartTooltip.visible && chartTooltip.key === 'dependency-call-volume'" class="ops-chart-tooltip" :style="{ left: `${chartTooltip.left}%` }"><time>{{ chartTooltip.time }}</time><dl><div><dt>{{ chartTooltip.series }}</dt><dd>{{ chartTooltip.value }} {{ chartTooltip.unit }}</dd></div></dl></div>
            </div>
            <div class="ops-time-chart__x-axis"><span>{{ formatChartTime(dependencyAggregateTimeline[0]?.at) }}</span><span>{{ formatChartTime(dependencyAggregateTimeline[dependencyAggregateTimeline.length - 1]?.at) }}</span></div>
          </div>
        </OpsPanel>
        <OpsPanel title="当前调用健康度" subtitle="仅表示本实例当前采集周期的被动调用结果，不代表 24 小时可用性。" :status="dependenciesModuleStatus" :updated-at="dependencyUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="!knownMusicSourceStatuses.length && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <div class="dependency-uptime-list">
            <div v-for="row in dependencyUptimeRows" :key="row.source" class="dependency-uptime-row">
              <span class="dependency-uptime-row__label">{{ row.label }}</span>
              <div class="uptime-strip"><i v-for="(slot, index) in row.slots" :key="`${row.source}-${index}`" :class="`uptime-strip__slot uptime-strip__slot--${slot}`" tabindex="0" :data-tooltip="dependencySlotTooltip(row, index)" :title="dependencySlotTooltip(row, index)" :aria-label="dependencySlotTooltip(row, index)" /></div>
            </div>
          </div>
          <div class="uptime-strip__legend"><span>未采集调用时显示灰色</span><span>非长期可用性数据</span></div>
        </OpsPanel>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.errorCodeDrilldown }}</h3><p>{{ locale.dependencies.errorCodeDrilldownDetail }}</p></div>
        <Icon name="warning" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel v-for="panel in dependencyErrorPanels" :key="panel.title" :title="panel.title" :subtitle="panel.detail" :status="dependencySourceStatus(panel.source)" :updated-at="dependencyUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="dependencySourceEmpty(panel.source) && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <div class="error-code-layout">
            <dl class="error-code-legend"><div v-for="item in dependencyErrorCodes" :key="item"><dt>{{ item }}</dt><dd>{{ dependencyErrorCodeValue(panel.source, item) }}</dd></div></dl>
          </div>
        </OpsPanel>
      </section>

      <section class="subsection-heading">
        <div><h3>{{ locale.dependencies.fallbackAndCache }}</h3><p>{{ locale.dependencies.fallbackAndCacheDetail }}</p></div>
        <Icon name="database" :size="16" />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OpsPanel v-for="panel in dependencyProtectionPanels" :key="panel.title" :title="panel.title" :subtitle="panel.detail" :status="dependencyProtectionPanelStatus(panel)" :updated-at="dependencyUpdatedAt" :pending="initialOperationsLoading" :error="moduleFetchErrors.metrics" :empty="dependencyProtectionPanelEmpty(panel) && !initialOperationsLoading" :refreshable="false" @refresh="loadOperationsData">
          <dl class="server-resource-list"><div v-for="item in panel.items" :key="item"><dt>{{ item }}</dt><dd>{{ dependencyProtectionValue(panel.title, item) }}</dd></div></dl>
        </OpsPanel>
      </section>
    </template>

    <details v-if="monitoringReferenceRows.length" class="monitoring-reference">
      <summary><span>{{ locale.references.title }}</span><small>{{ locale.references.detail }}</small></summary>
      <div class="monitoring-reference__content overflow-x-auto">
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
    </details>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import OpsPanel from '~/components/Admin/Ops/OpsPanel.vue'
import UserActivityPanel from '~/components/Admin/UserActivityPanel.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'
import { usePlatformConfig } from '~/composables/usePlatformConfig'
import { useToast } from '~/composables/useToast'

const { admin } = useLocale()
const locale = computed(() => admin.value?.operations || {})
const { showToast } = useToast()
const { enabledPlatforms: enabledMusicPlatforms, loadPlatformConfig } = usePlatformConfig()
const publicRuntimeConfig = useRuntimeConfig().public || {}
const activeGroup = ref('overview')
const globalRequestId = ref('')
const debugRequestId = ref('')
const diagnosticLoading = ref(false)
const diagnosticError = ref(false)
const diagnosticUpdatedAt = ref(null)
const logKeyword = ref('')
const logRequestId = ref('')
const logLevelFilter = ref('all')
const expandedLogKey = ref('')
const operationLogs = ref([])
const operationLogsPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const operationLogsLoading = ref(false)
const operationLogsError = ref('')
const operationLogsForbidden = ref(false)
const operationLogsUnauthorized = ref(false)
const operationLogsUpdatedAt = ref(null)
const operationLogFilters = ref({ startAt: '', endAt: '', actorId: '', action: '', targetType: '', result: '', keyword: '' })
const operationLogRequestId = ref('')
const expandedOperationLogId = ref('')
const operationLogDetail = ref(null)
const operationLogDetailLoading = ref(false)
const operationLogDetailError = ref('')
const operationLogActionOptions = [
  { label: '全部动作', value: '' },
  { label: '用户状态变更', value: 'USER.STATUS_CHANGE' },
  { label: '用户角色变更', value: 'USER.ROLE_CHANGE' },
  { label: '管理员重置密码', value: 'ADMIN.PASSWORD_RESET' },
  { label: '创建 API Key', value: 'API_KEY.CREATE' },
  { label: '修改 API Key 权限', value: 'API_KEY.UPDATE' },
  { label: '禁用 API Key', value: 'API_KEY.DISABLE' },
  { label: '删除 API Key', value: 'API_KEY.DELETE' },
  { label: '保存系统设置', value: 'SETTINGS.SAVE' },
  { label: '更新备份配置', value: 'BACKUP_CONFIG.UPDATE' },
  { label: '导出备份', value: 'BACKUP.EXPORT' },
  { label: '上传备份', value: 'BACKUP.UPLOAD' },
  { label: '删除备份', value: 'BACKUP.DELETE' },
  { label: '恢复备份', value: 'BACKUP.RESTORE' },
  { label: '清理数据库', value: 'DB.CLEANUP' },
  { label: '重置数据库', value: 'DB.RESET' },
  { label: '修复数据库序列', value: 'DB.SEQUENCE_REPAIR' },
  { label: '强制下线会话', value: 'SESSION.REVOKE' },
  { label: '用户投稿', value: 'SONG.REQUEST_CREATE' },
  { label: '用户点赞', value: 'SONG.VOTE' },
  { label: '取消点赞', value: 'SONG.VOTE_REMOVE' },
  { label: '绑定第三方账号', value: 'ACCOUNT.BIND' },
  { label: '解绑第三方账号', value: 'ACCOUNT.UNBIND' },
  { label: '绑定 MeoW 账号', value: 'ACCOUNT.MEOW_BIND' }
]
const operationLogTargetTypeOptions = [
  { label: '全部对象', value: '' },
  { label: '用户', value: 'USER' },
  { label: '批量用户', value: 'USER_BATCH' },
  { label: 'API Key', value: 'API_KEY' },
  { label: '系统设置', value: 'SETTINGS' },
  { label: '系统设置（备份）', value: 'SYSTEM_SETTINGS' },
  { label: '备份文件', value: 'BACKUP' },
  { label: '数据库', value: 'DATABASE' },
  { label: '数据库表', value: 'DATABASE_TABLE' },
  { label: '用户会话', value: 'USER_SESSION' },
  { label: '歌曲', value: 'SONG' },
  { label: '用户身份', value: 'USER_IDENTITY' },
  { label: 'MeoW 账号', value: 'MEOW_ACCOUNT' }
]
const operationLogResultOptions = [{ label: '全部结果', value: '' }, { label: '成功', value: 'SUCCESS' }, { label: '失败', value: 'FAILURE' }]
const operationsLoading = ref(true)
const initialOperationsLoading = ref(true)
const operationsError = ref(false)
const operationsLastUpdated = ref(null)
const runtimeNow = ref(Date.now())
const operationsData = ref({ status: null, pool: null, performance: null, backups: [], metrics: null })
const autoRefreshEnabled = ref(true)
const autoRefreshInterval = ref(30_000)
const autoRefreshIntervalOptions = [
  { label: '10 秒', value: 10_000 },
  { label: '30 秒', value: 30_000 },
  { label: '60 秒', value: 60_000 },
  { label: '5 分钟', value: 300_000 }
]
const moduleFetchErrors = ref({ system: false, pool: false, performance: false, backups: false, metrics: false })
const backupAccessState = ref('idle')
const backupLastUpdated = ref(null)
const userActivityRefreshToken = ref(0)
let operationsRequestInFlight = false
let operationsLoadVersion = 0

const loadOperationsData = async () => {
  if (operationsRequestInFlight) return
  operationsRequestInFlight = true
  const loadVersion = ++operationsLoadVersion
  operationsLoading.value = true
  operationsError.value = false
  const sentryResult = $fetch('/api/admin/operations/metrics', { query: { sentryOnly: '1' } }).catch(() => null)

  try {
    const [statusResult, poolResult, performanceResult, backupResult, metricsResult] = await Promise.allSettled([
      $fetch('/api/system/status'),
      $fetch('/api/admin/database/pool-status'),
      $fetch('/api/admin/database/performance'),
      $fetch('/api/admin/backup/history'),
      $fetch('/api/admin/operations/metrics', { query: { includeSentry: '0' } })
    ])

    if (statusResult.status === 'fulfilled') operationsData.value.status = statusResult.value
    if (poolResult.status === 'fulfilled') operationsData.value.pool = poolResult.value
    if (performanceResult.status === 'fulfilled') operationsData.value.performance = performanceResult.value
    if (backupResult.status === 'fulfilled') {
      operationsData.value.backups = backupResult.value?.data || []
      backupAccessState.value = 'ok'
      backupLastUpdated.value = new Date()
    } else {
      const backupStatusCode = backupResult.reason?.statusCode || backupResult.reason?.status || backupResult.reason?.response?.status || backupResult.reason?.data?.statusCode
      operationsData.value.backups = []
      backupLastUpdated.value = null
      backupAccessState.value = Number(backupStatusCode) === 403 ? 'forbidden' : 'error'
    }
    if (metricsResult.status === 'fulfilled') {
      const metrics = metricsResult.value?.data || {}
      const currentDiagnostic = operationsData.value.metrics?.diagnostic
      const currentSentry = operationsData.value.metrics?.sentry
      operationsData.value.metrics = {
        ...metrics,
        ...(currentSentry ? { sentry: currentSentry } : {}),
        ...(currentDiagnostic?.requestId ? { diagnostic: currentDiagnostic } : {})
      }
      if (metrics.database?.pool) operationsData.value.pool = metrics.database.pool
      if (metrics.database?.performance) operationsData.value.performance = metrics.database.performance
    }

    moduleFetchErrors.value = {
      system: statusResult.status === 'rejected',
      pool: poolResult.status === 'rejected',
      performance: performanceResult.status === 'rejected',
      backups: backupResult.status === 'rejected' && backupAccessState.value !== 'forbidden',
      metrics: metricsResult.status === 'rejected'
    }

    operationsError.value = statusResult.status === 'rejected'
    operationsLastUpdated.value = new Date()
  } finally {
    operationsLoading.value = false
    initialOperationsLoading.value = false
    operationsRequestInFlight = false
    userActivityRefreshToken.value += 1
  }

  void sentryResult.then((response) => {
    if (loadVersion !== operationsLoadVersion || !response?.data?.sentry) return
    operationsData.value.metrics = { ...(operationsData.value.metrics || {}), sentry: response.data.sentry }
  })
}

const operationLogErrorMessage = (error) => {
  const message = error?.data?.message || error?.statusMessage || error?.message
  return message && !String(message).includes('FetchError') ? String(message) : '操作记录暂时无法读取。'
}
const loadOperationLogs = async (page = operationLogsPagination.value.page) => {
  operationLogsLoading.value = true
  operationLogsError.value = ''
  operationLogsForbidden.value = false
  operationLogsUnauthorized.value = false
  expandedOperationLogId.value = ''
  operationLogDetail.value = null

  const filters = operationLogFilters.value
  const query = { page, limit: operationLogsPagination.value.limit }
  const filterKeys = ['startAt', 'endAt', 'actorId', 'action', 'targetType', 'result', 'keyword']
  filterKeys.forEach((key) => {
    if (filters[key]) query[key] = filters[key]
  })
  if (operationLogRequestId.value) query.requestId = operationLogRequestId.value

  try {
    const response = await $fetch('/api/admin/operation-logs', { query })
    operationLogs.value = Array.isArray(response?.logs) ? response.logs : []
    operationLogsPagination.value = response?.pagination || { page, limit: operationLogsPagination.value.limit, total: 0, totalPages: 0 }
    operationLogsUpdatedAt.value = new Date()
  } catch (error) {
    const statusCode = error?.statusCode || error?.response?.status
    operationLogs.value = []
    if (statusCode === 403) operationLogsForbidden.value = true
    else if (statusCode === 401) operationLogsUnauthorized.value = true
    else operationLogsError.value = operationLogErrorMessage(error)
  } finally {
    operationLogsLoading.value = false
  }
}
const applyOperationLogFilters = () => loadOperationLogs(1)
const changeOperationLogPage = (page) => {
  if (page < 1 || page > operationLogsPagination.value.totalPages || operationLogsLoading.value) return
  loadOperationLogs(page)
}
const loadOperationLogDetail = async (id) => {
  operationLogDetailLoading.value = true
  operationLogDetailError.value = ''
  operationLogDetail.value = null
  try {
    const response = await $fetch(`/api/admin/operation-logs/${encodeURIComponent(id)}`)
    operationLogDetail.value = response?.log || null
  } catch (error) {
    operationLogDetailError.value = operationLogErrorMessage(error)
  } finally {
    operationLogDetailLoading.value = false
  }
}
const toggleOperationLogDetail = (item) => {
  if (expandedOperationLogId.value === item.id) {
    expandedOperationLogId.value = ''
    operationLogDetail.value = null
    return
  }
  expandedOperationLogId.value = item.id
  loadOperationLogDetail(item.id)
}
const selectMonitorGroup = (group) => {
  activeGroup.value = group
  if (group === 'operation-logs' && !operationLogsLoading.value && !operationLogsUpdatedAt.value && !operationLogsForbidden.value) loadOperationLogs(1)
}
const operationLogTarget = (item) => [item?.targetType, item?.targetLabel || item?.targetId].filter(Boolean).join(' · ') || '--'
const formatOperationLogChanges = (changes) => changes && Object.keys(changes).length
  ? redactSensitiveText(JSON.stringify(changes, null, 2))
  : '未记录变更摘要。'

let operationsRefreshTimer = null
let runtimeClockTimer = null
const startAutoRefresh = () => {
  if (operationsRefreshTimer || !autoRefreshEnabled.value || document.hidden) return
  operationsRefreshTimer = window.setInterval(() => {
    if (!document.hidden) loadOperationsData()
  }, Number(autoRefreshInterval.value))
}
const stopAutoRefresh = () => {
  if (!operationsRefreshTimer) return
  window.clearInterval(operationsRefreshTimer)
  operationsRefreshTimer = null
}
const toggleAutoRefresh = () => {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  if (autoRefreshEnabled.value) startAutoRefresh()
  else stopAutoRefresh()
}
const changeAutoRefreshInterval = () => {
  stopAutoRefresh()
  if (autoRefreshEnabled.value) startAutoRefresh()
}
const handleVisibilityChange = () => {
  if (document.hidden) stopAutoRefresh()
  else startAutoRefresh()
}
onMounted(() => {
  void loadPlatformConfig()
  loadOperationsData()
  startAutoRefresh()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  runtimeClockTimer = window.setInterval(() => { runtimeNow.value = Date.now() }, 1000)
})

onBeforeUnmount(() => {
  operationsLoadVersion += 1
  stopAutoRefresh()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (runtimeClockTimer) window.clearInterval(runtimeClockTimer)
})

const systemSnapshot = computed(() => operationsData.value.status?.system || null)
const databaseSnapshot = computed(() => operationsData.value.status?.database || null)
const latestBackup = computed(() => operationsData.value.backups?.[0] || null)
const backupRecordHasFailure = (record) => Array.isArray(record?.methods) && record.methods.some((method) => method?.error)
const backupRecordPending = (record) => !record?.success && Array.isArray(record?.methods) && record.methods.some((method) => !method?.success && !method?.error)
const backupFailureReason = (record) => Array.isArray(record?.methods)
  ? record.methods.filter((method) => method?.error).map((method) => `${method.method || '备份目标'}：${method.error}`).join('；')
  : ''
const latestBackupFailureReason = computed(() => backupFailureReason(latestBackup.value))
const backupResultText = (record) => {
  if (backupRecordHasFailure(record) && record?.success) return '部分成功'
  if (record?.success) return '成功'
  return backupRecordHasFailure(record) ? '失败' : backupRecordPending(record) ? '执行中' : '未知'
}
const backupResultClass = (record) => {
  if (backupRecordHasFailure(record)) return 'operation-log-result--failure'
  return record?.success ? 'operation-log-result--success' : ''
}
const backupMethodSummary = (record) => Array.isArray(record?.methods) && record.methods.length
  ? record.methods.map((method) => `${method.method || '备份目标'}：${method.success ? '成功' : method.error ? `失败（${method.error}）` : '执行中'}`).join('；')
  : '--'
const runtimeMetrics = computed(() => operationsData.value.metrics?.metrics || null)
const runtimeHealthScore = computed(() => runtimeMetrics.value?.healthScore || null)
const hasRuntimeHealthScore = computed(() => runtimeHealthScore.value?.value != null && Number.isFinite(Number(runtimeHealthScore.value.value)))
const healthScorePanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!hasRuntimeHealthScore.value) return 'unknown'
  return runtimeHealthScore.value?.status || 'unknown'
})
const healthScoreTone = computed(() => ({ ok: 'good', warning: 'warn', error: 'critical', unknown: 'unknown' }[runtimeHealthScore.value?.status] || 'unknown'))
const healthScoreStatusLabel = computed(() => ({ ok: '正常', warning: '需要关注', error: '异常', unknown: '未知' }[healthScorePanelStatus.value] || '未知'))
const healthScoreProgress = computed(() => hasRuntimeHealthScore.value ? Math.min(100, Math.max(0, Number(runtimeHealthScore.value.value))) : 0)
const healthScoreDisplay = computed(() => hasRuntimeHealthScore.value ? Number(runtimeHealthScore.value.value).toFixed(1).replace(/\.0$/, '') : '--')
const healthScoreSummary = computed(() => ({
  ok: '当前可用率表现稳定，建议持续关注峰值时段。',
  warning: '当前可用率存在压力，建议关注近期失败请求。',
  error: '当前可用率异常，请优先检查近期错误请求。',
  unknown: '当前缺少有效采样，暂时无法生成评分结论。'
}[healthScorePanelStatus.value] || '当前缺少有效采样，暂时无法生成评分结论。'))
const healthScoreInspectionNote = computed(() => ({
  ok: '当前未发现可用率风险，可继续关注峰值时段的请求表现。',
  warning: '检测到可用率波动，请检查近 5 分钟失败请求与上游依赖。',
  error: '检测到明确可用率风险，请立即排查错误请求及服务依赖。',
  unknown: '当前采样不足，待获得真实数据后生成巡检结论。'
}[healthScorePanelStatus.value] || '当前采样不足，待获得真实数据后生成巡检结论。'))
const runtimeHttpMetrics = computed(() => runtimeMetrics.value?.http || null)
const runtimeTimeline = computed(() => {
  const persistedTimeline = runtimeDatabaseMetrics.value?.timeline || []
  if (isServerlessRuntime.value) return runtimeMetrics.value?.timeline?.length ? runtimeMetrics.value.timeline : persistedTimeline
  return persistedTimeline.length ? persistedTimeline : (runtimeMetrics.value?.timeline || [])
})
const recentErrorRequests = computed(() => {
  const errors = [
    ...(operationsData.value.metrics?.diagnostic?.entries || []),
    ...(runtimeMetrics.value?.recentErrors || []),
    ...(runtimeDatabaseMetrics.value?.persistedRequests || [])
  ]
  if (!debugRequestId.value) return errors
  return errors.filter((item) => item.requestId === debugRequestId.value)
})
const recentDiagnosticRequests = computed(() => {
  const seen = new Set()
  return [...(runtimeDatabaseMetrics.value?.persistedRequests || []), ...(runtimeDatabaseMetrics.value?.recentLogs || []), ...(runtimeMetrics.value?.recentErrors || [])]
    .filter((item) => item && (item.durationMs != null || item.status >= 400))
    .filter((item) => {
      const key = `${item.at}-${item.requestId || item.route}-${item.durationMs || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))
    .slice(0, 20)
})
const selectedDebugRequest = computed(() => {
  if (!debugRequestId.value) return null
  return recentErrorRequests.value.find((item) => item.requestId === debugRequestId.value) || null
})
const diagnosticLogEntries = computed(() => {
  if (!diagnosticUpdatedAt.value) return []
  const entries = operationsData.value.metrics?.diagnostic?.entries || []
  if (entries.length) return entries.map((item) => ({ ...item, level: Number(item.status) >= 500 ? 'error' : 'warn' }))
  return selectedDebugRequest.value ? [selectedDebugRequest.value] : []
})
const diagnosticTrace = computed(() => operationsData.value.metrics?.diagnostic?.trace || null)
const traceSpanRows = computed(() => {
  const toMilliseconds = (value) => {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
    const parsed = Date.parse(value || '')
    return Number.isFinite(parsed) ? parsed : null
  }
  const spans = (diagnosticTrace.value?.spans || []).map((span) => ({
    ...span,
    description: redactSensitiveText(span.description || span.operation || '未命名 span'),
    startedMs: toMilliseconds(span.startedAt),
    endedMs: toMilliseconds(span.endedAt)
  })).filter((span) => span.spanId && span.startedMs != null && span.endedMs != null && span.endedMs >= span.startedMs)
  if (!spans.length) return []
  const ids = new Set(spans.map((span) => span.spanId))
  const children = new Map()
  spans.forEach((span) => {
    const parent = ids.has(span.parentSpanId) ? span.parentSpanId : null
    const list = children.get(parent) || []
    list.push(span)
    children.set(parent, list)
  })
  const ordered = []
  const append = (parentId, depth) => {
    const items = (children.get(parentId) || []).sort((left, right) => left.startedMs - right.startedMs)
    items.forEach((span) => {
      ordered.push({ ...span, depth })
      append(span.spanId, depth + 1)
    })
  }
  append(null, 0)
  const minimum = Math.min(...spans.map((span) => span.startedMs))
  const maximum = Math.max(...spans.map((span) => span.endedMs))
  const range = Math.max(1, maximum - minimum)
  return ordered.map((span) => {
    const durationMs = Math.max(0, span.endedMs - span.startedMs)
    const status = String(span.status || '').toLowerCase()
    return {
      ...span,
      durationMs,
      left: Math.max(0, (span.startedMs - minimum) / range * 100),
      width: Math.max(1, durationMs / range * 100),
      tone: status.includes('error') || status.includes('internal') ? 'trace-waterfall__bar--error' : durationMs >= 1000 ? 'trace-waterfall__bar--slow' : 'trace-waterfall__bar--ok'
    }
  })
})
const tracePanelStatus = computed(() => {
  if (diagnosticError.value) return 'error'
  if (!traceSpanRows.value.length) return 'unknown'
  return traceSpanRows.value.some((span) => span.tone === 'trace-waterfall__bar--error') ? 'error' : traceSpanRows.value.some((span) => span.tone === 'trace-waterfall__bar--slow') ? 'warning' : 'ok'
})
const diagnosticUpdatedAtText = computed(() => diagnosticUpdatedAt.value ? formatTimestamp(diagnosticUpdatedAt.value) : '尚未查询')
const diagnosticPanelStatus = computed(() => {
  if (diagnosticError.value) return 'error'
  if (!diagnosticUpdatedAt.value || !selectedDebugRequest.value) return 'unknown'
  if (Number(selectedDebugRequest.value.status) >= 500) return 'error'
  if (Number(selectedDebugRequest.value.status) >= 400 || Number(selectedDebugRequest.value.durationMs || 0) >= 500) return 'warning'
  return 'ok'
})
const diagnosticResultEmpty = computed(() => !diagnosticUpdatedAt.value || (!selectedDebugRequest.value && !diagnosticLogEntries.value.length))
const diagnosticRawJson = computed(() => redactSensitiveText(JSON.stringify({
  requestId: operationsData.value.metrics?.diagnostic?.requestId || debugRequestId.value || null,
  entries: diagnosticLogEntries.value,
  trace: diagnosticTrace.value
}, null, 2)))
const diagnosticMetricsUpdatedAt = computed(() => runtimeMetrics.value?.collectedAt ? formatTimestamp(runtimeMetrics.value.collectedAt) : locale.value.awaitingConnection)
const sentryIssues = computed(() => operationsData.value.metrics?.sentry?.issues || [])
const normalizeSentryLevel = (level) => {
  const normalized = String(level || 'error').toLowerCase()
  if (normalized === 'fatal' || normalized === 'error') return 'error'
  if (normalized === 'warning' || normalized === 'warn') return 'warn'
  return 'info'
}
const sentryLogEntries = computed(() => sentryIssues.value.map((issue) => {
  const occurrenceCount = Number(issue.count || 0)
  const title = issue.title || `Sentry Issue #${issue.id}`
  return {
    id: `sentry-${issue.id}`,
    at: issue.lastSeen || null,
    source: 'sentry',
    method: 'SENTRY',
    route: `Sentry #${issue.id}`,
    status: String(issue.level || 'error').toUpperCase(),
    durationMs: null,
    requestId: null,
    level: normalizeSentryLevel(issue.level),
    message: title,
    sentryIssueId: String(issue.id || ''),
    occurrenceCount
  }
}))
const errorAggregationPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!recentErrorRequests.value.length && !sentryIssues.value.length) return 'unknown'
  if (recentErrorRequests.value.some((item) => Number(item.status) >= 500) || sentryLogEntries.value.some((item) => item.level === 'error')) return 'error'
  return 'warning'
})
const slowRequestsPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!recentDiagnosticRequests.value.length) return 'unknown'
  const maximum = Math.max(...recentDiagnosticRequests.value.map((item) => Number(item.durationMs || 0)))
  return maximum >= 1500 ? 'error' : maximum >= 500 ? 'warning' : 'ok'
})
const logSourceEntries = computed(() => [
  ...(runtimeDatabaseMetrics.value?.recentLogs || []),
  ...(runtimeMetrics.value?.recentErrors || []),
  ...(runtimeDatabaseMetrics.value?.persistedRequests || []),
  ...sentryLogEntries.value
])
const normalizeLogEntry = (item) => {
  const status = Number(item.status)
  return {
    ...item,
    source: item.source || 'http',
    level: item.level || (status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'),
    message: item.message || item.errorMessage || (status >= 500 ? 'HTTP 服务端错误' : status >= 400 ? 'HTTP 客户端错误' : '请求完成')
  }
}
const normalizedLogEntries = computed(() => logSourceEntries.value.map(normalizeLogEntry))
const logKey = (item) => item.id || `${item.source || 'http'}-${item.at}-${item.requestId || item.route}`
const recentErrorLogEntries = computed(() => normalizedLogEntries.value
  .filter((item) => item.level === 'error' || item.level === 'warn')
  .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
  .slice(0, 10))
const logEntries = computed(() => {
  const keyword = logKeyword.value.toLowerCase()
  const requestId = logRequestId.value.toLowerCase()
  const filtered = normalizedLogEntries.value
    .filter((item) => !requestId || String(item.requestId || '').toLowerCase().includes(requestId))
    .filter((item) => !keyword || `${item.source} ${item.route} ${item.status} ${item.requestId} ${item.message} ${item.sentryIssueId || ''}`.toLowerCase().includes(keyword))
    .filter((item) => logLevelFilter.value === 'all' || item.level === logLevelFilter.value)
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
  const sentryEntries = filtered.filter((item) => item.source === 'sentry').slice(0, 10)
  const regularEntries = filtered.filter((item) => item.source !== 'sentry').slice(0, Math.max(0, 50 - sentryEntries.length))
  return [...sentryEntries, ...regularEntries]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
})
const logFiltersActive = computed(() => Boolean(logKeyword.value || logRequestId.value || logLevelFilter.value !== 'all'))
const logResultsEmptyText = computed(() => logSourceEntries.value.length && logFiltersActive.value
  ? '当前筛选范围暂无统计数据。'
  : '暂无真实采集数据。')
const logLevelOptions = [
  { value: 'all', label: '全部' },
  { value: 'error', label: '错误' },
  { value: 'warn', label: '警告' },
  { value: 'info', label: '信息' }
]
const toggleLogDetails = (item) => {
  const key = logKey(item)
  expandedLogKey.value = expandedLogKey.value === key ? '' : key
}
const isLogExpanded = (item) => expandedLogKey.value === logKey(item)
const selectedLogEntry = computed(() => logEntries.value.find((item) => isLogExpanded(item)) || null)
const logUpdatedAt = computed(() => runtimeMetrics.value?.collectedAt ? formatTimestamp(runtimeMetrics.value.collectedAt) : locale.value.awaitingConnection)
const logPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!normalizedLogEntries.value.length) return 'unknown'
  if (normalizedLogEntries.value.some((item) => item.level === 'error')) return 'error'
  if (normalizedLogEntries.value.some((item) => item.level === 'warn')) return 'warning'
  return 'ok'
})
const logContextPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!selectedLogEntry.value) return 'unknown'
  if (selectedLogEntry.value.level === 'error') return 'error'
  if (selectedLogEntry.value.level === 'warn') return 'warning'
  return 'ok'
})
const logArchiveSnapshot = computed(() => runtimeDatabaseMetrics.value?.logArchive || null)
const hasLogArchiveData = computed(() => Boolean(logArchiveSnapshot.value && (logArchiveSnapshot.value.totalLogFiles || logArchiveSnapshot.value.archivedFiles || logArchiveSnapshot.value.newestLog || logArchiveSnapshot.value.oldestLog)))
const logArchiveUpdatedAt = computed(() => logArchiveSnapshot.value?.lastArchivedAt ? formatTimestamp(logArchiveSnapshot.value.lastArchivedAt) : logUpdatedAt.value)
const logArchivePanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  return hasLogArchiveData.value ? 'ok' : 'unknown'
})
const redactSensitiveText = (value) => String(value)
  .replace(/((?:token|password|secret|authorization|cookie|api[_-]?key)"?\s*[:=]\s*"?)[^",\s}&]+/gi, '$1***')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
const formatLogDetails = (item) => redactSensitiveText(JSON.stringify(item, null, 2))
const copyLogEntry = async (item) => {
  const text = formatLogDetails(item)
  let textarea = null
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      showToast('已复制到剪贴板', 'success')
      return
    }
    textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    showToast('已复制到剪贴板', 'success')
  } catch (error) {
    console.error('复制日志失败:', error)
    showToast('复制失败', 'error')
  } finally {
    textarea?.remove()
  }
}
const copyDiagnosticRequestId = async () => {
  const requestId = String(selectedDebugRequest.value?.requestId || debugRequestId.value || '').trim()
  if (!requestId) return
  let textarea = null
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(requestId)
      showToast('已复制到剪贴板', 'success')
      return
    }
    textarea = document.createElement('textarea')
    textarea.value = requestId
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    showToast('已复制到剪贴板', 'success')
  } catch (error) {
    console.error('复制 Request ID 失败:', error)
    showToast('复制失败', 'error')
  } finally {
    textarea?.remove()
  }
}
const chartTooltip = ref({ visible: false, key: '', time: '', series: '', value: '', unit: '', left: 50, barLeft: 50 })
const runtimeBarHeight = (value, field = 'requests', points = runtimeTimeline.value) => {
  const max = Math.max(...points.map((point) => Number(point[field] || 0)), 1)
  const numericValue = Number(value || 0)
  if (numericValue <= 0) return 0
  return Math.max(4, Math.round((numericValue / max) * 100))
}
const trendValue = (point, field = 'requests') => Number(point?.[field] ?? 0)
const hasTimelineMetric = (field) => runtimeTimeline.value.some((point) => point?.[field] != null && Number.isFinite(Number(point[field])))
const chartTicks = (field, points = runtimeTimeline.value) => {
  const maximum = Math.max(...points.map((point) => Number(point?.[field] || 0)), 0)
  const isTrafficMetric = field === 'network_rx_mb' || field === 'network_tx_mb'
  const isRateMetric = String(field).includes('_rate')
  const precision = isTrafficMetric ? 2 : isRateMetric ? 1 : 0
  const top = isTrafficMetric || isRateMetric
    ? (maximum > 0 ? Number(Math.max(10 ** -precision, maximum < 1 ? Math.ceil(maximum * (10 ** precision)) / (10 ** precision) : Math.ceil(maximum)).toFixed(precision)) : 1)
    : Math.max(1, Math.ceil(maximum))
  const middle = Number((top / 2).toFixed(precision))
  return [...new Set([top, middle, 0])]
}
const formatChartTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'
const formatChartValue = (value, unit = '') => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '--'
  if (String(unit).includes('MB')) return numericValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
  if (unit === '%') return numericValue.toFixed(1).replace(/\.0$/, '')
  return String(Math.round(numericValue))
}
const showChartTooltip = (key, series, point, value, unit, index, total, event) => {
  const barElement = event?.currentTarget
  const plotElement = barElement?.closest('.ops-time-chart__plot')
  const barRect = barElement?.getBoundingClientRect?.()
  const plotRect = plotElement?.getBoundingClientRect?.()
  const left = barRect && plotRect && plotRect.width > 0
    ? ((barRect.left + barRect.width / 2 - plotRect.left) / plotRect.width) * 100
    : ((index + 0.5) / Math.max(total, 1)) * 100
  chartTooltip.value = {
    visible: true,
    key,
    time: formatChartTime(point?.at),
    series,
    value: formatChartValue(value, unit),
    unit,
    // barLeft 保持真实柱中心用于虚线对齐；left 钳制范围仅用于防止 Tooltip 溢出绘图区
    barLeft: left,
    left: Math.min(90, Math.max(10, left))
  }
}
const hideChartTooltip = () => { chartTooltip.value.visible = false }
const runtimeEventLoopMetrics = computed(() => runtimeMetrics.value?.eventLoop || null)
const runtimeGcMetrics = computed(() => runtimeMetrics.value?.gc || null)
const runtimeSsrPrewarm = computed(() => runtimeMetrics.value?.ssrPrewarm || null)
const runtimeBusinessMetrics = computed(() => runtimeMetrics.value?.business || {})
const runtimeOAuthMetrics = computed(() => runtimeMetrics.value?.oauth || null)
const runtimeNotificationMetrics = computed(() => runtimeMetrics.value?.notifications || null)
const runtimeSseMetrics = computed(() => operationsData.value.metrics?.sse || null)
const runtimeRedisMetrics = computed(() => operationsData.value.metrics?.redis || null)
const runtimeDatabaseMetrics = computed(() => operationsData.value.metrics?.database || null)
const statusRank = { unknown: 0, ok: 1, warning: 2, error: 3 }
const maxStatus = (...statuses) => statuses.reduce((current, status) => (statusRank[status] > statusRank[current] ? status : current), 'unknown')
const httpErrorRate = computed(() => {
  const http = runtimeHttpMetrics.value
  if (!http || !Number(http.recentRequests)) return null
  return Number(http.recent5xx || 0) / Number(http.recentRequests)
})
const applicationHttpStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (httpErrorRate.value == null) return 'unknown'
  if (httpErrorRate.value >= 0.05) return 'error'
  if (httpErrorRate.value >= 0.01) return 'warning'
  return 'ok'
})
const applicationLatencyStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  const p95Value = runtimeHttpMetrics.value?.p95Ms
  const p99Value = runtimeHttpMetrics.value?.p99Ms
  const p95 = Number(p95Value)
  const p99 = Number(p99Value)
  const hasP95 = p95Value != null && Number.isFinite(p95)
  const hasP99 = p99Value != null && Number.isFinite(p99)
  if (!hasP95 && !hasP99) return 'unknown'
  return (hasP95 && p95 >= 1500) || (hasP99 && p99 >= 3000) ? 'warning' : 'ok'
})
const applicationEventLoopStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  const p99Value = runtimeEventLoopMetrics.value?.p99Ms
  const p99 = Number(p99Value)
  if (p99Value == null || !Number.isFinite(p99)) return 'unknown'
  if (p99 >= 200) return 'error'
  if (p99 >= 50) return 'warning'
  return 'ok'
})
const systemModuleStatus = computed(() => {
  if (initialOperationsLoading.value || !operationsData.value.status) return 'unknown'
  return operationsData.value.status.status === 'ok' ? 'ok' : 'error'
})
const sloAvailabilityStatus = computed(() => {
  if (initialOperationsLoading.value) return 'unknown'
  if (systemModuleStatus.value === 'error' || healthScorePanelStatus.value === 'error') return 'error'
  if (systemModuleStatus.value === 'unknown' || healthScorePanelStatus.value === 'unknown') return 'unknown'
  return healthScorePanelStatus.value
})
const performanceModuleStatus = computed(() => {
  const statuses = [applicationHttpStatus.value, applicationLatencyStatus.value, applicationEventLoopStatus.value]
  const knownStatuses = statuses.filter((status) => status !== 'unknown')
  return knownStatuses.length ? maxStatus(...knownStatuses) : 'unknown'
})
const infraSystemStatus = computed(() => moduleFetchErrors.value.system ? 'error' : systemModuleStatus.value)
const infraMetricsStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!runtimeMetrics.value) return 'unknown'
  if (isServerlessRuntime.value) return performanceModuleStatus.value

  const statuses = []
  const cpuUsageValue = runtimeMetrics.value.process?.cpuUsagePercent
  const cpuUsage = Number(cpuUsageValue)
  if (cpuUsageValue != null && Number.isFinite(cpuUsage)) statuses.push(cpuUsage >= 95 ? 'error' : cpuUsage >= 80 ? 'warning' : 'ok')

  const heapUsedValue = runtimeMetrics.value.process?.memory?.heapUsed
  const heapTotalValue = runtimeMetrics.value.process?.memory?.heapTotal
  const heapUsed = Number(heapUsedValue)
  const heapTotal = Number(heapTotalValue)
  if (heapUsedValue != null && heapTotalValue != null && Number.isFinite(heapUsed) && Number.isFinite(heapTotal) && heapTotal > 0) {
    const heapRatio = heapUsed / heapTotal
    statuses.push(heapRatio >= .95 ? 'error' : heapRatio >= .85 ? 'warning' : 'ok')
  }

  const eventLoopP99Value = runtimeEventLoopMetrics.value?.p99Ms
  const eventLoopP99 = Number(eventLoopP99Value)
  if (eventLoopP99Value != null && Number.isFinite(eventLoopP99)) statuses.push(eventLoopP99 >= 200 ? 'error' : eventLoopP99 >= 50 ? 'warning' : 'ok')
  return statuses.length ? maxStatus(...statuses) : 'unknown'
})
const infraCombinedStatus = computed(() => {
  const statuses = [infraSystemStatus.value, infraMetricsStatus.value]
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('warning')) return 'warning'
  if (statuses.includes('unknown')) return 'unknown'
  return 'ok'
})
const infraSystemUpdatedAt = computed(() => formatTimestamp(systemSnapshot.value?.timestamp))
const infraMetricsUpdatedAt = computed(() => formatTimestamp(runtimeMetrics.value?.collectedAt))
const infraCombinedUpdatedAt = computed(() => `系统 ${infraSystemUpdatedAt.value} · 指标 ${infraMetricsUpdatedAt.value}`)
const infraDetailPanelStatus = (panel) => {
  const parentStatus = panel.source === 'system' ? infraSystemStatus.value : infraMetricsStatus.value
  if (parentStatus === 'error') return 'error'
  if (panel.empty) return 'unknown'
  return panel.status || parentStatus
}
const infraDetailPanelUpdatedAt = (panel) => panel.source === 'system' ? infraSystemUpdatedAt.value : infraMetricsUpdatedAt.value
const infraDetailPanelError = (panel) => panel.source === 'system' ? moduleFetchErrors.value.system : moduleFetchErrors.value.metrics
const databaseModuleStatus = computed(() => {
  if (!databaseSnapshot.value || !operationsData.value.pool) return 'unknown'
  if (!databaseSnapshot.value.connected) return 'error'
  const utilization = Number(operationsData.value.pool.utilization || 0) / 100
  const latency = Number(operationsData.value.performance?.responseTime || 0)
  if (utilization >= 0.95 || latency >= 1500) return 'error'
  if (utilization >= 0.8 || latency >= 500 || Number(databaseDiagnostics.value?.locks?.data?.length || 0) > 0) return 'warning'
  return 'ok'
})
const musicSourceKeys = ['netease', 'tencent', 'bilibili', 'migu']
const enabledMusicSourceKeys = computed(() => musicSourceKeys.filter((source) => enabledMusicPlatforms.value.includes(source)))
const musicSourceStatuses = computed(() => enabledMusicSourceKeys.value.map((source) => {
  const metric = dependencyMetrics.value[source]
  if (!metric || !Number(metric.calls)) return { source, status: 'unknown', metric: null }
  if (metric.successRate == null) return { source, status: 'unknown', metric }
  if (Number(metric.successRate) === 0 || metric.lastError || metric.error || Number(metric.timeouts || 0) > 0) return { source, status: 'error', metric }
  if (Number(metric.successRate) < 95 || Math.max(Number(metric.averageDurationMs || 0), Number(metric.p95DurationMs || 0)) >= 1500) return { source, status: 'warning', metric }
  return { source, status: 'ok', metric }
}))
const knownMusicSourceStatuses = computed(() => musicSourceStatuses.value.filter((item) => item.status !== 'unknown'))
const dependenciesModuleStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  const known = knownMusicSourceStatuses.value
  if (!known.length) return 'unknown'
  if (known.some((item) => item.status === 'error')) return 'error'
  if (known.some((item) => item.status === 'warning')) return 'warning'
  return 'ok'
})
const overviewServiceStatus = computed(() => {
  const statuses = [systemModuleStatus.value]
  if (databaseSnapshot.value) statuses.push(databaseSnapshot.value.connected ? 'ok' : 'error')
  if (runtimeRedisMetrics.value?.configured) statuses.push(runtimeRedisMetrics.value.connected ? 'ok' : 'error')
  if (musicSourceStatuses.value.some((item) => item.status !== 'unknown')) statuses.push(dependenciesModuleStatus.value)
  return maxStatus(statuses)
})
const securityModuleStatus = computed(() => {
  const http = runtimeHttpMetrics.value
  if (!http) return 'unknown'
  const oauthCalls = Number(runtimeOAuthMetrics.value?.calls || 0)
  const oauthSuccessRate = runtimeOAuthMetrics.value?.successRate
  if (Number(http.recent5xx || 0) > 0 || Number(turnstileMetrics.value?.upstreamFailures || 0) > 0 || (oauthCalls > 0 && Number(oauthSuccessRate) === 0)) return 'error'
  if (Number(http.status401 || 0) > 0 || Number(http.status403 || 0) > 0 || Number(http.status429 || 0) > 0 || Number(turnstileMetrics.value?.validationFailures || 0) > 0 || (oauthCalls > 0 && oauthSuccessRate != null && Number(oauthSuccessRate) < 100)) return 'warning'
  return 'ok'
})
const overallStatus = computed(() => {
  if (initialOperationsLoading.value || !runtimeMetrics.value || !operationsData.value.status) return 'unknown'
  const required = [systemModuleStatus.value, performanceModuleStatus.value, databaseModuleStatus.value]
  if (required.includes('unknown')) return 'unknown'
  return maxStatus(systemModuleStatus.value, performanceModuleStatus.value, databaseModuleStatus.value, dependenciesModuleStatus.value, securityModuleStatus.value)
})
const overallStatusText = computed(() => ({ ok: '系统正常', warning: '系统警告', error: '系统异常', unknown: '状态未知' }[overallStatus.value]))
const abnormalModuleCount = computed(() => [systemModuleStatus.value, performanceModuleStatus.value, databaseModuleStatus.value, dependenciesModuleStatus.value, securityModuleStatus.value].filter((status) => status === 'error').length)
const warningModuleCount = computed(() => [systemModuleStatus.value, performanceModuleStatus.value, databaseModuleStatus.value, dependenciesModuleStatus.value, securityModuleStatus.value].filter((status) => status === 'warning').length)
const lastUpdatedRelative = computed(() => {
  if (!operationsLastUpdated.value) return '页面尚未完成首次采集'
  const seconds = Math.max(0, Math.floor((runtimeNow.value - operationsLastUpdated.value.getTime()) / 1000))
  return seconds < 2 ? '页面刚刚更新' : `页面 ${seconds} 秒前更新`
})
const refreshProgress = computed(() => {
  if (!autoRefreshEnabled.value || !operationsLastUpdated.value) return 0
  return Math.max(0, 100 - ((runtimeNow.value - operationsLastUpdated.value.getTime()) / Number(autoRefreshInterval.value) * 100))
})
const refreshCountdownText = computed(() => `${Math.max(0, Math.ceil(refreshProgress.value / 100 * Number(autoRefreshInterval.value) / 1000))} 秒后`)
const databaseDiagnostics = computed(() => runtimeDatabaseMetrics.value?.diagnostics || null)
const databasePoolPanelStatus = computed(() => {
  if (moduleFetchErrors.value.pool) return 'error'
  const pool = operationsData.value.pool
  if (!pool) return 'unknown'
  const utilization = Number(pool.utilization)
  if (!Number.isFinite(utilization)) return 'unknown'
  if (utilization >= 95) return 'error'
  if (utilization >= 80) return 'warning'
  return 'ok'
})
const databasePerformancePanelStatus = computed(() => {
  if (moduleFetchErrors.value.performance) return 'error'
  const performance = operationsData.value.performance
  if (!performance) return 'unknown'
  const responseTime = Number(performance.responseTime)
  if (!Number.isFinite(responseTime)) return 'unknown'
  if (responseTime >= 1500) return 'error'
  if (responseTime >= 500) return 'warning'
  return 'ok'
})
const databaseDiagnosticsPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  const diagnostics = databaseDiagnostics.value
  if (!diagnostics) return 'unknown'
  const sources = [diagnostics.activity, diagnostics.locks, diagnostics.tables, diagnostics.size, diagnostics.slowQueries]
  if (!sources.some((source) => source?.available)) return 'unknown'
  if (Number(diagnostics.locks?.data?.length || 0) > 0) return 'warning'
  return 'ok'
})
const databaseDiagnosticSourceStatus = (source) => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!databaseDiagnostics.value?.[source]?.available) return 'unknown'
  return 'ok'
}
const databaseSlowQueriesPanelStatus = computed(() => databaseDiagnosticSourceStatus('slowQueries'))
const databaseActivityPanelStatus = computed(() => {
  const status = databaseDiagnosticSourceStatus('activity')
  if (status !== 'ok') return status
  return Number(databaseDiagnostics.value?.locks?.data?.length || 0) > 0 ? 'warning' : 'ok'
})
const databaseTablesPanelStatus = computed(() => databaseDiagnosticSourceStatus('tables'))
const databasePoolUpdatedAt = computed(() => operationsData.value.pool?.timestamp
  ? formatTimestamp(operationsData.value.pool.timestamp)
  : operationsLastUpdated.value ? `页面更新时间 ${formatTimestamp(operationsLastUpdated.value)}` : '尚未更新')
const databasePerformanceUpdatedAt = computed(() => operationsData.value.performance?.timestamp
  ? formatTimestamp(operationsData.value.performance.timestamp)
  : operationsLastUpdated.value ? `页面更新时间 ${formatTimestamp(operationsLastUpdated.value)}` : '尚未更新')
const databaseDiagnosticsUpdatedAt = computed(() => formatTimestamp(databaseDiagnostics.value?.collectedAt))
const databaseTimeline = computed(() => runtimeDatabaseMetrics.value?.timeline || [])
const databaseTimelineUpdatedAt = computed(() => databaseTimeline.value.length ? formatTimestamp(databaseTimeline.value[databaseTimeline.value.length - 1]?.at) : databaseDiagnosticsUpdatedAt.value)
const databaseTrendPanels = computed(() => [
  { title: locale.value.database?.queryTrend, detail: locale.value.database?.queryTrendDetail, field: 'database_queries', unit: '次' },
  { title: locale.value.database?.connectionTrend, detail: locale.value.database?.connectionTrendDetail, field: 'database_active_connections', unit: '连接' },
  { title: locale.value.database?.slowQueryTrend, detail: locale.value.database?.slowQueryTrendDetail, field: 'database_slow_query_count', unit: '次' }
])
const hasDatabaseTimelineMetric = (field) => databaseTimeline.value.some((point) => point?.[field] != null && Number.isFinite(Number(point[field])))
const databaseTrendStatus = (panel) => {
  if (moduleFetchErrors.value.metrics) return 'error'
  return hasDatabaseTimelineMetric(panel.field) ? 'ok' : 'unknown'
}
const securityAuditEvents = computed(() => runtimeDatabaseMetrics.value?.securityEvents || [])
const highRiskSecurityEvents = computed(() => securityAuditEvents.value.filter((item) => ['FAILURE', 'ERROR', 'WARNING'].includes(String(item.severity).toUpperCase())))
const ipBehaviorRows = computed(() => runtimeDatabaseMetrics.value?.ipBehavior || [])
const maskIpAddress = (value) => {
  const ip = String(value || '')
  if (!ip) return '--'
  if (ip.includes(':')) return `${ip.split(':').filter(Boolean).slice(0, 3).join(':')}::*`
  const parts = ip.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip
}
const securityEventsUpdatedAt = computed(() => securityAuditEvents.value.length ? formatTimestamp(securityAuditEvents.value[0]?.at) : securityUpdatedAt.value)
const securityAuditPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!securityAuditEvents.value.length) return 'unknown'
  return highRiskSecurityEvents.value.some((item) => String(item.severity).toUpperCase() === 'ERROR' || String(item.severity).toUpperCase() === 'FAILURE') ? 'error' : highRiskSecurityEvents.value.length ? 'warning' : 'ok'
})
const ipBehaviorPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!ipBehaviorRows.value.length) return 'unknown'
  if (ipBehaviorRows.value.some((item) => Number(item.server_errors) > 0)) return 'error'
  return ipBehaviorRows.value.some((item) => Number(item.client_errors) > 0) ? 'warning' : 'ok'
})
const requestBehaviorTimeline = computed(() => runtimeDatabaseMetrics.value?.requestBehaviorTimeline || [])
const requestBehaviorUpdatedAt = computed(() => requestBehaviorTimeline.value.length ? formatTimestamp(requestBehaviorTimeline.value[requestBehaviorTimeline.value.length - 1]?.at) : diagnosticMetricsUpdatedAt.value)
const hasRequestBehaviorMetric = (field) => requestBehaviorTimeline.value.some((point) => point?.[field] != null && Number.isFinite(Number(point[field])))
const requestTrendPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!requestBehaviorTimeline.value.length) return 'unknown'
  return requestBehaviorTimeline.value.some((point) => Number(point.server_errors) > 0) ? 'error' : requestBehaviorTimeline.value.some((point) => Number(point.errors) > 0) ? 'warning' : 'ok'
})
const businessOperationTimeline = computed(() => runtimeDatabaseMetrics.value?.businessTimeline || [])
const businessTimelineUpdatedAt = computed(() => businessOperationTimeline.value.length ? formatTimestamp(businessOperationTimeline.value[businessOperationTimeline.value.length - 1]?.at) : diagnosticMetricsUpdatedAt.value)
const hasBusinessTimelineMetric = (field) => businessOperationTimeline.value.some((point) => point?.[field] != null && Number.isFinite(Number(point[field])))
const businessTimelinePanelStatus = computed(() => moduleFetchErrors.value.metrics ? 'error' : businessOperationTimeline.value.length ? 'ok' : 'unknown')
const businessOutcomeTotals = computed(() => {
  const total = (field) => businessOperationTimeline.value.reduce((sum, point) => sum + Number(point?.[field] || 0), 0)
  return [
    { label: '点歌提交', value: String(total('song_requests')) },
    { label: '新增排期', value: String(total('schedules_created')) },
    { label: '已发布排期', value: String(total('schedules_published')) },
    { label: '已播排期', value: String(total('schedules_played')) },
    { label: '投票', value: String(total('votes')) }
  ]
})
const businessQueueSnapshot = computed(() => runtimeDatabaseMetrics.value?.businessQueue || null)
const apiKeyUsageSnapshot = computed(() => runtimeDatabaseMetrics.value?.apiKeyUsage || null)
const backupSnapshot = computed(() => runtimeMetrics.value?.backupSnapshot || null)
const backupMonitorStatus = computed(() => operationsData.value.metrics?.backup || null)
const latestBackupRestore = computed(() => (runtimeDatabaseMetrics.value?.recentLogs || []).find((item) => item?.route === '/api/admin/backup/restore') || null)
const backupUpdatedAt = computed(() => backupLastUpdated.value ? formatTimestamp(backupLastUpdated.value) : '尚未读取')
const backupStatusPanelStatus = computed(() => {
  if (backupAccessState.value === 'forbidden') return 'unknown'
  if (backupAccessState.value === 'error') return 'error'
  if (backupMonitorStatus.value?.enabled === false || !latestBackup.value) return 'unknown'
  if (backupRecordHasFailure(latestBackup.value)) return 'error'
  return backupRecordPending(latestBackup.value) ? 'warning' : 'ok'
})
const backupHistoryPanelStatus = computed(() => {
  if (backupAccessState.value === 'forbidden') return 'unknown'
  if (backupAccessState.value === 'error') return 'error'
  if (!operationsData.value.backups.length) return 'unknown'
  return backupRecordHasFailure(latestBackup.value) ? 'error' : backupRecordPending(latestBackup.value) ? 'warning' : 'ok'
})
const backupConfigPanelStatus = computed(() => {
  if (backupAccessState.value === 'forbidden') return 'unknown'
  if (backupAccessState.value === 'error') return 'error'
  return backupMonitorStatus.value?.enabled ? 'ok' : 'unknown'
})
const dependencyMetrics = computed(() => runtimeMetrics.value?.dependencies || {})
const dependencyMetricTimeline = computed(() => runtimeDatabaseMetrics.value?.dependencyTimeline || [])
const dependencyAggregateTimeline = computed(() => {
  const buckets = new Map()
  for (const point of dependencyMetricTimeline.value.filter((entry) => enabledMusicSourceKeys.value.includes(entry.source))) {
    const at = point?.at
    if (!at) continue
    const key = new Date(at).toISOString()
    const bucket = buckets.get(key) || { at: key, calls: 0, semanticFailures: 0 }
    bucket.calls += Number(point.calls || 0)
    bucket.semanticFailures += Number(point.semantic_failures || 0)
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
    .map((point) => ({
      at: point.at,
      calls: point.calls,
      semantic_failure_rate: point.calls ? Number((point.semanticFailures / point.calls * 100).toFixed(2)) : null
    }))
})
const hasDependencyTimelineMetric = (field) => dependencyAggregateTimeline.value.some((point) => point?.[field] != null && Number.isFinite(Number(point[field])))
const dependencyTimelineUpdatedAt = computed(() => dependencyAggregateTimeline.value.length
  ? formatTimestamp(dependencyAggregateTimeline.value[dependencyAggregateTimeline.value.length - 1].at)
  : dependencyUpdatedAt.value)
const runtimeAlerts = computed(() => runtimeMetrics.value?.alerts || [])
const runtimeAlertStatus = computed(() => {
  if (runtimeAlerts.value.some((item) => item.severity === 'critical')) return 'error'
  return runtimeAlerts.value.length ? 'warning' : 'ok'
})
const routePerformanceRows = computed(() => {
  const samples = [
    ...(runtimeMetrics.value?.recentErrors || []),
    ...(runtimeDatabaseMetrics.value?.persistedRequests || [])
  ].filter((item) => item && item.route)
  const grouped = new Map()
  for (const sample of samples) {
    const route = String(sample.route)
    const bucket = grouped.get(route) || { route, method: String(sample.method || 'HTTP'), samples: [], requestId: null }
    bucket.samples.push(sample)
    if (!bucket.requestId && sample.requestId) bucket.requestId = sample.requestId
    grouped.set(route, bucket)
  }
  const percentileValue = (values, ratio) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
    return sorted.length ? `${Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)])} ms` : 'N/A'
  }
  return [...grouped.values()].map((bucket) => {
    const statuses = bucket.samples.map((item) => Number(item.status))
    const durations = bucket.samples.map((item) => Number(item.durationMs))
    const clientErrors = statuses.filter((status) => status >= 400 && status < 500).length
    return {
      method: bucket.method,
      route: bucket.route,
      qps: 'N/A',
      p50: percentileValue(durations, 0.5),
      p95: percentileValue(durations, 0.95),
      p99: percentileValue(durations, 0.99),
      clientErrors,
      status401: statuses.filter((status) => status === 401).length,
      status403: statuses.filter((status) => status === 403).length,
      status429: statuses.filter((status) => status === 429).length,
      serverErrors: statuses.filter((status) => status >= 500).length,
      requestId: bucket.requestId
    }
  }).sort((a, b) => (b.serverErrors + b.clientErrors) - (a.serverErrors + a.clientErrors))
})
const routePerformancePanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!routePerformanceRows.value.length) return 'unknown'
  return applicationHttpStatus.value
})
const musicApiRows = computed(() => [
  { key: 'netease', source: locale.value.overview?.neteaseSource },
  { key: 'tencent', source: locale.value.overview?.tencentSource },
  { key: 'bilibili', source: locale.value.overview?.bilibiliSource },
  { key: 'migu', source: locale.value.overview?.miguSource }
].filter(({ key }) => enabledMusicSourceKeys.value.includes(key)).map(({ key, source }) => {
  const metric = dependencyMetrics.value?.[key]
  return {
    source: source || key,
    status: metric?.calls == null || metric.calls === 0 ? '未探测' : metric.successRate >= 95 ? '已连接' : metric.successRate > 0 ? '部分异常' : '不可用',
    averageDuration: metric?.p95DurationMs != null ? `${Math.round(Number(metric.p95DurationMs))} ms` : '未采集调用',
    httpSuccessRate: metric?.successRate != null ? formatPercent(metric.successRate) : 'N/A',
    semanticSuccessRate: metric?.semanticFailureRate != null ? `${(100 - Number(metric.semanticFailureRate)).toFixed(1)}%` : 'N/A',
    timeouts: metric?.timeouts != null ? String(metric.timeouts) : 'N/A'
  }
}))
const turnstileMetrics = computed(() => runtimeMetrics.value?.turnstile || null)
const formattedLastUpdated = computed(() => operationsLastUpdated.value ? operationsLastUpdated.value.toLocaleTimeString() : '--')
const collectionStatusText = computed(() => operationsLoading.value ? locale.value.awaitingConnection : operationsError.value ? locale.value.noData : '采集正常')
const availabilitySli = computed(() => {
  const total = Number(runtimeHttpMetrics.value?.recentRequests)
  const errors = Number(runtimeHttpMetrics.value?.recent5xx)
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(errors)) return '--'
  return `${Math.max(0, (1 - errors / total) * 100).toFixed(1)}%`
})
const formatBytes = (value) => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
const formatPercent = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '--'
const formatMilliseconds = (value) => Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : '--'
const formatTimestamp = (value) => value ? new Date(value).toLocaleString() : '--'
const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return '--'
  const total = Math.max(0, Math.floor(seconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return days ? `${days}天 ${hours}小时 ${minutes}分 ${secs}秒` : `${hours}小时 ${minutes}分 ${secs}秒`
}
const formatRequestRate = (count) => {
  const total = Number(runtimeHttpMetrics.value?.recentRequests)
  if (!Number.isFinite(total) || total <= 0 || count == null) return '暂无数据'
  return `${(Number(count) / total * 100).toFixed(1)}%`
}
const durationTone = (duration) => {
  const value = Number(duration || 0)
  if (value >= 1500) return 'duration-value--error'
  if (value >= 500) return 'duration-value--warning'
  return 'duration-value--ok'
}
const dependencySourceForLabel = (label) => {
  const labels = {
    [locale.value.overview?.neteaseSource]: 'netease',
    [locale.value.overview?.tencentSource]: 'tencent',
    [locale.value.overview?.bilibiliSource]: 'bilibili',
    [locale.value.overview?.miguSource]: 'migu'
  }
  return labels[label]
}
const musicSourceLabel = (source) => ({
  netease: locale.value.overview?.neteaseSource || '网易云音乐',
  tencent: locale.value.overview?.tencentSource || 'QQ 音乐',
  bilibili: locale.value.overview?.bilibiliSource || 'Bilibili',
  migu: locale.value.overview?.miguSource || '咪咕音乐'
}[source] || source)
const dependencyErrorPanelTitle = (source) => ({
  netease: locale.value.dependencies?.neteaseErrorCodes,
  tencent: locale.value.dependencies?.tencentErrorCodes,
  bilibili: locale.value.dependencies?.bilibiliErrorCodes,
  migu: locale.value.dependencies?.miguErrorCodes
}[source] || source)
const dependencyStatusValue = (label) => {
  const source = dependencySourceForLabel(label)
  if (!source) return dependencyOverviewStatusText(label)
  const metric = dependencyMetrics.value[source]
  if (!metric || !Number(metric.calls)) return '未调用'
  if (metric.successRate == null) return '未知'
  const status = dependencySourceStatus(source)
  return status === 'ok' ? '已连接' : status === 'warning' ? '需要关注' : status === 'error' ? '不可用' : '未知'
}
const dependencyCardStatus = (label) => {
  if (moduleFetchErrors.value.metrics) return 'error'
  const source = dependencySourceForLabel(label)
  if (source) return musicSourceStatuses.value.find((item) => item.source === source)?.status || 'unknown'
  if (label === locale.value.dependencies?.neonPostgresql) return databaseModuleStatus.value
  if (label === locale.value.services?.redis) return runtimeRedisMetrics.value?.configured ? (runtimeRedisMetrics.value.connected ? 'ok' : 'error') : 'unknown'
  if (label === locale.value.dependencies?.oauth) {
    if (!Number(runtimeOAuthMetrics.value?.calls || 0) || runtimeOAuthMetrics.value?.successRate == null) return 'unknown'
    return Number(runtimeOAuthMetrics.value.successRate) === 0 ? 'error' : Number(runtimeOAuthMetrics.value.successRate) < 90 ? 'warning' : 'ok'
  }
  if (label === locale.value.dependencies?.smtp) {
    const accepted = Number(runtimeNotificationMetrics.value?.smtpAccepted || 0)
    const failures = Number(runtimeNotificationMetrics.value?.smtpFailures || 0)
    if (!accepted && !failures) return 'unknown'
    if (failures && !accepted) return 'error'
    return failures ? 'warning' : 'ok'
  }
  if (label === locale.value.dependencies?.notificationService) {
    const eligible = Number(runtimeNotificationMetrics.value?.meowEligible || 0)
    const failures = Number(runtimeNotificationMetrics.value?.meowTransportFailures || 0)
    if (!eligible && !failures) return 'unknown'
    if (failures && !eligible) return 'error'
    return failures ? 'warning' : 'ok'
  }
  return 'unknown'
}
const dependencyOverviewStatusText = (label) => {
  const status = dependencyCardStatus(label)
  if (status === 'ok') return '正常'
  if (status === 'warning') return '警告'
  if (status === 'error') return '异常'
  const source = dependencySourceForLabel(label)
  if (source) {
    const metric = dependencyMetrics.value[source]
    if (!metric) return '未采集'
    if (!Number(metric.calls)) return '未调用'
    return '未知'
  }
  if (label === locale.value.services?.redis && runtimeRedisMetrics.value && !runtimeRedisMetrics.value.configured) return '未配置'
  if (label === locale.value.dependencies?.neonPostgresql && !databaseSnapshot.value) return '未采集'
  return '未知'
}
const dependencyFailureReason = (label) => {
  const metric = dependencyMetrics.value[dependencySourceForLabel(label)]
  if (metric?.lastError) return redactSensitiveText(metric.lastError).slice(0, 120)
  return Number(metric?.timeouts || 0) > 0 ? `发生 ${metric.timeouts} 次超时` : ''
}
const dependencyMetricValue = (label, detail) => {
  if (label === locale.value.dependencies?.oauth) {
    if (detail === locale.value.dependencies?.availability || detail === locale.value.dependencies?.loginSuccessRate) {
      return runtimeOAuthMetrics.value?.successRate == null ? '--' : formatPercent(runtimeOAuthMetrics.value.successRate)
    }
    return '--'
  }
  if (label === locale.value.dependencies?.neonPostgresql) {
    if (detail === locale.value.dependencies?.availability) return databaseSnapshot.value ? (databaseSnapshot.value.connected ? '正常' : '异常') : '--'
    if (detail === locale.value.dependencies?.connectionUsage) return operationsData.value.pool?.utilization == null ? '--' : formatPercent(operationsData.value.pool.utilization)
    if (detail === locale.value.dependencies?.lastSuccess) return databaseSnapshot.value?.timestamp ? formatTimestamp(databaseSnapshot.value.timestamp) : '--'
  }
  if (label === locale.value.dependencies?.neonPostgresql && detail === locale.value.dependencies?.coldStartP95) {
    const connectionInfo = databaseSnapshot.value?.connectionInfo
    return connectionInfo?.serverlessMode ? 'N/A · auto-suspend enabled' : 'N/A'
  }
  if (label === locale.value.services?.redis) {
    if (!runtimeRedisMetrics.value?.configured) return '--'
    if (detail === locale.value.dependencies?.availability) return runtimeRedisMetrics.value.connected ? '正常' : '异常'
    if (detail === locale.value.dependencies?.cacheHitRate) return runtimeRedisMetrics.value.metrics?.hitRate == null ? '--' : formatPercent(runtimeRedisMetrics.value.metrics.hitRate)
    return '--'
  }
  if (label === locale.value.dependencies?.smtp) {
    const accepted = Number(runtimeNotificationMetrics.value?.smtpAccepted || 0)
    const failures = Number(runtimeNotificationMetrics.value?.smtpFailures || 0)
    const total = accepted + failures
    if (detail === locale.value.dependencies?.availability) return total ? formatPercent(accepted / total * 100) : '--'
    if (detail === locale.value.dependencies?.smtpFailureRate) return total ? formatPercent(failures / total * 100) : '--'
    return '--'
  }
  if (label === locale.value.dependencies?.notificationService) {
    const eligible = Number(runtimeNotificationMetrics.value?.meowEligible || 0)
    const failures = Number(runtimeNotificationMetrics.value?.meowTransportFailures || 0)
    if (detail === locale.value.dependencies?.availability || detail === locale.value.dependencies?.notificationSuccessRate) {
      return eligible ? formatPercent(Math.max(0, eligible - failures) / eligible * 100) : '--'
    }
    return '--'
  }
  const metric = dependencyMetrics.value[dependencySourceForLabel(label)]
  if (!metric) return dependencySourceForLabel(label) ? '未采集调用' : '--'
  if (!Number(metric.calls)) return '未调用'
  if (detail === locale.value.dependencies?.availability || detail === locale.value.dependencies?.parseSuccessRate) return metric.successRate == null ? '--' : formatPercent(metric.successRate)
  if (detail === locale.value.dependencies?.emptyResultRate) return metric.emptyResultRate == null ? '--' : formatPercent(metric.emptyResultRate)
  if (detail === locale.value.dependencies?.semanticFailureRate) return metric.semanticFailureRate == null ? '--' : formatPercent(metric.semanticFailureRate)
  if (detail === locale.value.dependencies?.p95LatencyShort) return metric.p95DurationMs == null ? '--' : `${Math.round(Number(metric.p95DurationMs))} ms`
  return '--'
}
const dependencyUpdatedAt = computed(() => runtimeMetrics.value?.collectedAt
  ? new Date(runtimeMetrics.value.collectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  : locale.value.awaitingConnection)
const dependencySourceStatus = (source) => {
  if (moduleFetchErrors.value.metrics) return 'error'
  return musicSourceStatuses.value.find((item) => item.source === source)?.status || 'unknown'
}
const dependencySourceEmpty = (source) => {
  const metric = dependencyMetrics.value[source]
  return !metric || !Number(metric.calls) || metric.successRate == null
}
const dependencyCardEmpty = (label) => {
  const source = dependencySourceForLabel(label)
  if (source) return dependencySourceEmpty(source)
  if (label === locale.value.dependencies?.oauth) return runtimeOAuthMetrics.value?.successRate == null
  if (label === locale.value.dependencies?.neonPostgresql) return !databaseSnapshot.value
  if (label === locale.value.services?.redis) return !runtimeRedisMetrics.value?.configured
  if (label === locale.value.dependencies?.smtp) return !Number(runtimeNotificationMetrics.value?.smtpAccepted || 0) && !Number(runtimeNotificationMetrics.value?.smtpFailures || 0)
  if (label === locale.value.dependencies?.notificationService) return !Number(runtimeNotificationMetrics.value?.meowEligible || 0) && !Number(runtimeNotificationMetrics.value?.meowTransportFailures || 0)
  return true
}
const dependencyCardEmptyText = (label) => {
  const source = dependencySourceForLabel(label)
  if (source) {
    const metric = dependencyMetrics.value[source]
    return metric && !Number(metric.calls)
      ? locale.value.dependencies?.emptyNotInvoked
      : locale.value.dependencies?.emptyNotCollected
  }
  if (label === locale.value.services?.redis && runtimeRedisMetrics.value && !runtimeRedisMetrics.value.configured) {
    return locale.value.dependencies?.emptyNotConfigured
  }
  return locale.value.dependencies?.emptyNotCollected
}
const securityMetricValue = (label) => {
  if (label === locale.value.audit?.invalidTokenRequests) return runtimeHttpMetrics.value?.status401 != null ? String(runtimeHttpMetrics.value.status401) : 'N/A'
  if (label === locale.value.audit?.rateLimitTriggers) return runtimeHttpMetrics.value?.status429 != null ? String(runtimeHttpMetrics.value.status429) : 'N/A'
  if (label === locale.value.audit?.strongAuthFailures) return runtimeOAuthMetrics.value?.successRate != null ? `${(100 - runtimeOAuthMetrics.value.successRate).toFixed(1)}%` : 'N/A'
  if (!turnstileMetrics.value) return '--'
  if (label === locale.value.audit?.turnstileValidationRequests) return String(turnstileMetrics.value.calls)
  if (label === locale.value.audit?.turnstileValidationSuccessRate) return turnstileMetrics.value.calls ? `${(turnstileMetrics.value.successes / turnstileMetrics.value.calls * 100).toFixed(1)}%` : '--'
  if (label === locale.value.audit?.turnstileUpstreamFailures) return String(turnstileMetrics.value.upstreamFailures)
  if (label === locale.value.audit?.turnstileConfiguration) return '--'
  return '--'
}
const dependencyProtectionValue = (title, item) => {
  const notifications = runtimeMetrics.value?.notifications
  const cache = runtimeMetrics.value?.cache
  if (title === locale.value.dependencies?.searchCacheHitRate && cache) {
    if (item === locale.value.dependencies?.cacheHits) return String(cache.hits)
    if (item === locale.value.dependencies?.cacheMisses) return String(cache.misses)
    if (item === locale.value.dependencies?.cacheEvictions) return String(cache.evictions)
    if (item === locale.value.dependencies?.cacheResponseP95) {
      const durations = Object.values(dependencyMetrics.value).map((metric) => Number(metric?.averageDurationMs || 0)).filter(Boolean)
      return durations.length ? formatMilliseconds(Math.max(...durations)) : 'N/A'
    }
    if (item === locale.value.dependencies?.cacheHitRate) {
      const total = cache.hits + cache.misses
      return total ? `${(cache.hits / total * 100).toFixed(1)}%` : 'N/A'
    }
  }
  if (title === locale.value.dependencies?.fallbackHits) {
    if (item === locale.value.dependencies?.providerFallbacks) return String(Object.values(dependencyMetrics.value).reduce((total, metric) => total + Number(metric?.fallbacks || 0), 0))
    if (item === locale.value.dependencies?.retryAttempts) return String(Object.values(dependencyMetrics.value).reduce((total, metric) => total + Number(metric?.retries || 0), 0))
    if (item === locale.value.dependencies?.circuitBreakerOpens) return 'N/A'
    if (item === locale.value.dependencies?.cachedResponseFallbacks) return cache ? String(cache.misses) : '--'
    if ([locale.value.overview?.neteaseSource, locale.value.overview?.tencentSource, locale.value.overview?.bilibiliSource, locale.value.overview?.miguSource].includes(item)) {
      return dependencyMetricValue(item, locale.value.dependencies?.semanticFailureRate)
    }
  }
  if (title !== locale.value.dependencies?.notificationDelivery || !notifications) return '--'
  if (item === locale.value.dependencies?.smtpAcceptedRate) return String(notifications.smtpAccepted)
  if (item === locale.value.dependencies?.meowEligibleTargets) return String(notifications.meowEligible)
  if (item === locale.value.dependencies?.meowSkippedTargets) return String(notifications.meowSkipped)
  if (item === locale.value.dependencies?.meowTransportFailureRate) {
    return notifications.meowEligible ? `${(notifications.meowTransportFailures / notifications.meowEligible * 100).toFixed(1)}%` : '--'
  }
  return '--'
}

const openRequestDiagnosis = async (requestId = globalRequestId.value) => {
  const normalizedRequestId = String(requestId || '').trim()
  if (!normalizedRequestId) return
  globalRequestId.value = normalizedRequestId
  debugRequestId.value = normalizedRequestId
  activeGroup.value = 'debug'
  diagnosticLoading.value = true
  diagnosticError.value = false
  diagnosticUpdatedAt.value = null
  operationsData.value.metrics = {
    ...operationsData.value.metrics,
    diagnostic: { requestId: normalizedRequestId, entries: [] }
  }
  try {
    const response = await $fetch('/api/admin/operations/metrics', { query: { requestId: normalizedRequestId } })
    const metrics = response?.data || {}
    operationsData.value.metrics = { ...operationsData.value.metrics, diagnostic: metrics.diagnostic }
    diagnosticUpdatedAt.value = metrics.metrics?.collectedAt || null
  } catch {
    diagnosticError.value = true
  } finally {
    diagnosticLoading.value = false
  }
}

const groupTabStatus = (group) => ({
  overview: overallStatus.value,
  performance: performanceModuleStatus.value,
  database: databaseModuleStatus.value,
  dependencies: dependenciesModuleStatus.value,
  security: securityModuleStatus.value,
  infra: systemModuleStatus.value,
  'user-activity': 'unknown'
}[group] || 'unknown')

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
      { icon: 'warning', label: locale.value.groups?.security, value: 'security' },
      { icon: 'users', label: locale.value.groups?.userActivity, value: 'user-activity' }
    ]
  },
  {
    icon: 'terminal',
    label: locale.value.groups?.debugTools,
    items: [
      { icon: 'search', label: locale.value.groups?.debug, value: 'debug' },
      { icon: 'terminal', label: locale.value.groups?.logs, value: 'logs' },
      { icon: 'layers', label: locale.value.groups?.dependencies, value: 'dependencies' },
      { icon: 'terminal', label: '操作记录', value: 'operation-logs' }
    ]
  }
])

const monitoringReferenceRows = computed(() => locale.value.references?.[activeGroup.value] || [])

const overviewSignals = computed(() => [
  {
    icon: 'activity',
    label: locale.value.overview?.cpuStatus,
    detail: locale.value.overview?.cpuStatusDetail,
    value: runtimeMetrics.value?.process?.cpuUsagePercent != null ? `${formatPercent(runtimeMetrics.value.process.cpuUsagePercent)}` : '--'
  },
  {
    icon: 'monitoring',
    label: locale.value.overview?.memoryStatus,
    memoryRows: [
      { label: '常驻内存', value: runtimeMetrics.value?.process?.memory?.rss != null ? formatBytes(runtimeMetrics.value.process.memory.rss) : '--' },
      { label: '堆内存', value: runtimeMetrics.value?.process?.memory ? `${formatBytes(runtimeMetrics.value.process.memory.heapUsed)} / ${formatBytes(runtimeMetrics.value.process.memory.heapTotal)}` : systemSnapshot.value?.memory ? `${systemSnapshot.value.memory.used ?? '--'} MB / ${systemSnapshot.value.memory.total ?? '--'} MB` : '--' },
      { label: '外部内存', value: runtimeMetrics.value?.process?.memory?.external != null ? formatBytes(runtimeMetrics.value.process.memory.external) : systemSnapshot.value?.memory?.external != null ? `${systemSnapshot.value.memory.external} MB` : '--' }
    ]
  },
  {
    icon: 'database',
    label: locale.value.overview?.databaseStatus,
    detail: locale.value.overview?.databaseStatusDetail, value: databaseSnapshot.value ? (databaseSnapshot.value.connected ? '已连接' : '不可用') : '--'
  },
  {
    icon: 'server',
    label: locale.value.overview?.redisStatus,
    detail: locale.value.overview?.redisStatusDetail, value: runtimeRedisMetrics.value ? (!runtimeRedisMetrics.value.configured ? '未启用' : runtimeRedisMetrics.value.connected ? '已连接' : '不可用') : '--'
  },
  {
    icon: 'settings',
    label: locale.value.overview?.eventLoopStatus,
    detail: locale.value.overview?.eventLoopStatusDetail,
    value: runtimeEventLoopMetrics.value?.p99Ms != null ? `${Math.round(Number(runtimeEventLoopMetrics.value.p99Ms))} ms` : '--'
  },
  {
    icon: 'clock',
    label: locale.value.overview?.backgroundTaskStatus,
    detail: locale.value.overview?.backgroundTaskStatusDetail,
    value: runtimeSsrPrewarm.value?.lastResult === 'success' ? '成功' : runtimeSsrPrewarm.value?.lastResult === 'failure' ? '失败' : '--'
  }
].filter((item) => !isServerlessRuntime.value || ![locale.value.overview?.cpuStatus, locale.value.overview?.memoryStatus].includes(item.label)))

const isServerlessRuntime = computed(() => {
  const runtime = runtimeMetrics.value?.runtime || runtimeMetrics.value || {}
  const mode = String(runtime.deploymentTarget || runtime.nitroPreset || systemSnapshot.value?.nitroPreset || '').toLowerCase()
  if (publicRuntimeConfig.isNetlify) return true
  return ['vercel', 'netlify', 'edgeone', 'cloudflare', 'serverless'].some((name) => mode.includes(name))
})
const runtimeDeploymentTarget = computed(() => {
  const runtime = runtimeMetrics.value?.runtime || runtimeMetrics.value || {}
  const target = String(runtime.deploymentTarget || '').toLowerCase()
  if (target === 'vercel') return 'Vercel Serverless'
  if (target === 'netlify') return 'Netlify Serverless'
  if (target === 'edgeone') return 'EdgeOne Edge Platform'
  if (target === 'cloudflare') return 'Cloudflare Serverless'
  return runtime.nitroPreset || systemSnapshot.value?.nitroPreset || (isServerlessRuntime.value ? 'Serverless' : 'Node 服务')
})
const healthLiveDetails = computed(() => [
  { label: locale.value.overview?.sloBudget, value: '--' },
  { label: locale.value.overview?.errorBudgetBurn, value: '--' },
  { label: locale.value.overview?.collectionStatus, value: collectionStatusText.value }
])

const backupStatusFields = computed(() => [
  { label: locale.value.overview?.lastBackupAt, value: formatTimestamp(latestBackup.value?.createdAt) },
  { label: locale.value.overview?.lastBackupResult, value: latestBackup.value ? backupResultText(latestBackup.value) : '--' },
  { label: locale.value.overview?.lastBackupSize, value: formatBytes(latestBackup.value?.backupSize) },
  { label: locale.value.overview?.backupStorageUsage, value: 'N/A' },
  { label: locale.value.overview?.backupExportedTables, value: backupSnapshot.value?.exportedTables != null ? String(backupSnapshot.value.exportedTables) : '--' },
  { label: locale.value.overview?.backupSkippedTables, value: backupSnapshot.value?.skippedTables != null ? String(backupSnapshot.value.skippedTables) : '--' },
  { label: locale.value.overview?.backupIntegrityCheck, value: backupSnapshot.value?.checksum ? `SHA-256 ${backupSnapshot.value.checksum.slice(0, 12)}...` : '--' },
  { label: locale.value.overview?.lastRestoreDrill, value: latestBackupRestore.value ? formatTimestamp(latestBackupRestore.value.at) : 'N/A' },
  { label: locale.value.overview?.lastBackupScheduleAt, value: latestBackup.value ? formatTimestamp(latestBackup.value.createdAt) : '--' },
  { label: locale.value.overview?.expectedBackupInterval, value: 'N/A' },
  { label: locale.value.overview?.backupScheduleMisses, value: 'N/A' }
])

const backupTargetPanels = computed(() => [
  backupTargetPanel('S3', locale.value.overview?.backupTargetS3),
  backupTargetPanel('WebDAV', locale.value.overview?.backupTargetWebdav),
  backupTargetPanel('Telegram', locale.value.overview?.backupTargetTelegram),
  backupTargetPanel('Email', locale.value.overview?.backupTargetEmail)
])

const backupTargetPanel = (target, title) => {
  const method = latestBackup.value?.methods?.find((item) => String(item.method || '').toLowerCase().includes(target.toLowerCase()))
  return {
    title,
    value: backupTargetValue(target),
    error: method?.error || ''
  }
}

const backupTargetValue = (target) => {
  const method = latestBackup.value?.methods?.find(item => String(item.method || '').toLowerCase().includes(target.toLowerCase()))
  if (method) return method.success ? '成功' : method.error ? '失败' : '执行中'
  const targetKey = target.toLowerCase()
  return backupMonitorStatus.value?.targets?.[targetKey] ? '已配置，尚未执行' : '未启用'
}

const backupConfigFields = computed(() => [
  { label: '自动备份', value: backupMonitorStatus.value?.enabled ? '已启用' : '未启用' },
  { label: locale.value.overview?.backupTargetS3, value: backupMonitorStatus.value?.targets?.s3 ? '已启用' : '未启用' },
  { label: locale.value.overview?.backupTargetWebdav, value: backupMonitorStatus.value?.targets?.webdav ? '已启用' : '未启用' },
  { label: locale.value.overview?.backupTargetTelegram, value: backupMonitorStatus.value?.targets?.telegram ? '已启用' : '未启用' },
  { label: locale.value.overview?.backupTargetEmail, value: backupMonitorStatus.value?.targets?.email ? '已启用' : '未启用' }
])

const deploymentModeRows = computed(() => [
  { icon: 'server', label: locale.value.overview?.selfHostedRuntime, detail: locale.value.overview?.selfHostedRuntimeDetail, value: isServerlessRuntime.value ? '不适用' : systemSnapshot.value?.platform ? '已检测到' : locale.value.overview?.detectionPending },
  { icon: 'activity', label: locale.value.overview?.serverlessRuntime, detail: locale.value.overview?.serverlessRuntimeDetail, value: isServerlessRuntime.value ? `已检测到（${runtimeDeploymentTarget.value}）` : '不适用' }
])

const dependencyRows = computed(() => [
  {
    icon: 'monitoring',
    label: locale.value.services?.application,
    detail: locale.value.overview?.applicationDetail, value: '正常'
  },
  {
    icon: 'database',
    label: locale.value.services?.postgresql,
    detail: locale.value.overview?.databaseDetail, value: databaseSnapshot.value ? (databaseSnapshot.value.connected ? '已连接' : '不可用') : '--'
  },
  {
    icon: 'server',
    label: locale.value.services?.redis,
    detail: locale.value.overview?.redisDetail, value: redisStatusValue.value
  },
  {
    icon: 'activity',
    label: locale.value.server?.collectionReporting,
    detail: locale.value.overview?.collectionReportingDetail, value: collectionStatusText.value
  },
  {
    icon: 'users',
    label: locale.value.application?.sseActiveConnections || '实时连接',
    detail: locale.value.application?.sseActiveConnectionsDetail || '音乐状态 SSE 当前活跃连接数',
    value: runtimeSseMetrics.value?.music?.activeConnections != null ? String(runtimeSseMetrics.value.music.activeConnections) : '--'
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
  { icon: 'activity', label: locale.value.application?.httpQps, detail: locale.value.application?.httpQpsDetail, value: runtimeHttpMetrics.value?.requestsPerSecond != null ? String(runtimeHttpMetrics.value.requestsPerSecond) : '--' },
  { icon: 'warning', label: locale.value.application?.clientErrorRate, detail: locale.value.application?.clientErrorRateDetail, value: formatRequestRate(runtimeHttpMetrics.value?.recent4xx) },
  { icon: 'warning', label: locale.value.application?.unauthorized401, detail: 'JWT 校验失败请求数', value: runtimeHttpMetrics.value?.status401 != null ? String(runtimeHttpMetrics.value.status401) : '--' },
  { icon: 'warning', label: locale.value.application?.forbidden403, detail: '权限拒绝请求数', value: runtimeHttpMetrics.value?.status403 != null ? String(runtimeHttpMetrics.value.status403) : '--' },
  { icon: 'activity', label: locale.value.application?.rateLimited429, detail: '限流触发次数，不计入 5xx 告警', value: runtimeHttpMetrics.value?.status429 != null ? String(runtimeHttpMetrics.value.status429) : '--' },
  { icon: 'warning', label: locale.value.application?.serverErrorRate, detail: locale.value.application?.serverErrorRateDetail, value: formatRequestRate(runtimeHttpMetrics.value?.recent5xx) },
  { icon: 'clock', label: locale.value.application?.ssrRenderTime, detail: locale.value.application?.ssrRenderTimeDetail, value: runtimeSsrPrewarm.value?.lastDurationMs != null ? formatMilliseconds(runtimeSsrPrewarm.value.lastDurationMs) : '--' },
  { icon: 'activity', label: locale.value.application?.eventLoopDelay, detail: locale.value.application?.eventLoopDelayDetail, value: runtimeEventLoopMetrics.value?.p99Ms != null ? formatMilliseconds(runtimeEventLoopMetrics.value.p99Ms) : '--' },
  { icon: 'settings', label: locale.value.application?.activeHandles, detail: locale.value.application?.activeHandlesDetail, value: runtimeMetrics.value?.process?.activeHandles != null ? String(runtimeMetrics.value.process.activeHandles) : '--' },
  { icon: 'clock', label: locale.value.application?.gcPause, detail: locale.value.application?.gcPauseDetail, value: runtimeGcMetrics.value?.averagePauseMs != null ? formatMilliseconds(runtimeGcMetrics.value.averagePauseMs) : '--' },
  { icon: 'users', label: locale.value.application?.sseActiveConnections, detail: locale.value.application?.sseActiveConnectionsDetail, value: runtimeSseMetrics.value?.music?.activeConnections != null ? String(runtimeSseMetrics.value.music.activeConnections) : '--' },
  { icon: 'clock', label: locale.value.application?.sseAverageLifetime, detail: locale.value.application?.sseAverageLifetimeDetail, value: runtimeSseMetrics.value?.music?.averageLifetimeMs != null ? formatMilliseconds(runtimeSseMetrics.value.music.averageLifetimeMs) : '--' },
  { icon: 'activity', label: locale.value.application?.sseBroadcastLatency, detail: locale.value.application?.sseBroadcastLatencyDetail, value: runtimeSseMetrics.value?.music?.averageBroadcastWriteMs != null ? `${Math.round(Number(runtimeSseMetrics.value.music.averageBroadcastWriteMs))} ms` : '--' },
  { icon: 'warning', label: locale.value.application?.sseReconnectFailures, detail: locale.value.application?.sseReconnectFailuresDetail, value: runtimeSseMetrics.value?.music?.heartbeatFailures != null ? String(runtimeSseMetrics.value.music.heartbeatFailures) : '--' },
  { icon: 'settings', label: locale.value.application?.apiKeyUsage, detail: locale.value.application?.apiKeyUsageDetail, value: apiKeyUsageSnapshot.value?.calls != null ? String(apiKeyUsageSnapshot.value.calls) : '--' },
  { icon: 'warning', label: locale.value.application?.apiKeyFailureRate, detail: locale.value.application?.apiKeyFailureRateDetail, value: apiKeyUsageSnapshot.value?.failureRate != null ? formatPercent(apiKeyUsageSnapshot.value.failureRate) : '--' }
])

const applicationLatencyDetails = computed(() => [
  { label: locale.value.application?.responseP50, value: formatMilliseconds(runtimeHttpMetrics.value?.p50Ms) },
  { label: locale.value.application?.responseP95, value: formatMilliseconds(runtimeHttpMetrics.value?.p95Ms) },
  { label: locale.value.application?.responseP99, value: formatMilliseconds(runtimeHttpMetrics.value?.p99Ms) },
  { label: locale.value.application?.responseMax, value: runtimeTimeline.value.length ? formatMilliseconds(Math.max(...runtimeTimeline.value.map((item) => Number(item.max_duration_ms || item.p95Ms || 0)))) : '--' }
])

const applicationAuthenticationStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  const http = runtimeHttpMetrics.value
  const oauth = runtimeOAuthMetrics.value
  if (!http && !oauth) return 'unknown'
  const oauthCalls = Number(oauth?.calls || 0)
  const oauthSuccessRate = oauth?.successRate
  if (oauthCalls > 0 && oauthSuccessRate != null && Number(oauthSuccessRate) === 0) return 'error'
  if (Number(http?.status401 || 0) > 0 || (oauthCalls > 0 && oauthSuccessRate != null && Number(oauthSuccessRate) < 100)) return 'warning'
  if (oauthCalls > 0 && oauthSuccessRate == null) return 'unknown'
  return 'ok'
})
const applicationSseStatus = (metrics) => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!metrics) return 'unknown'
  return Number(metrics.heartbeatFailures || 0) > 0 || Number(metrics.broadcastFailures || 0) > 0 ? 'warning' : 'ok'
}

const applicationDetailPanels = computed(() => [
  {
    icon: 'success',
    title: locale.value.application?.authentication,
    detail: locale.value.application?.authenticationDetail,
    status: applicationAuthenticationStatus.value,
    empty: !runtimeHttpMetrics.value && !runtimeOAuthMetrics.value,
    items: [
      { label: locale.value.application?.jwtIssued, value: '--' },
      { label: locale.value.application?.jwtVerified, value: '--' },
      { label: locale.value.application?.invalidTokens, value: runtimeHttpMetrics.value?.status401 != null ? String(runtimeHttpMetrics.value.status401) : '--' },
      { label: locale.value.application?.oauthSuccessRate, value: runtimeOAuthMetrics.value?.successRate != null ? formatPercent(runtimeOAuthMetrics.value.successRate) : '--' }
    ]
  },
  {
    icon: 'music',
    title: locale.value.application?.musicSyncReliability,
    detail: locale.value.application?.musicSyncReliabilityDetail,
    status: applicationSseStatus(runtimeSseMetrics.value?.music),
    empty: !runtimeSseMetrics.value?.music,
    items: [
      { label: locale.value.application?.musicSyncReconnects, value: '--' },
      { label: locale.value.application?.musicSyncLatency, value: '--' },
      { label: locale.value.application?.musicSyncHeartbeatTimeouts, value: runtimeSseMetrics.value?.music?.heartbeatFailures != null ? String(runtimeSseMetrics.value.music.heartbeatFailures) : '--' },
      { label: locale.value.application?.musicSyncDeliveryFailures, value: runtimeSseMetrics.value?.music?.broadcastFailures != null ? String(runtimeSseMetrics.value.music.broadcastFailures) : '--' }
    ]
  },
  {
    icon: 'monitoring',
    title: locale.value.application?.requestLifecycle,
    detail: locale.value.application?.requestLifecycleDetail,
    status: applicationHttpStatus.value,
    empty: !runtimeHttpMetrics.value,
    items: [
      { label: locale.value.application?.requestTotal, value: runtimeHttpMetrics.value?.recentRequests != null ? String(runtimeHttpMetrics.value.recentRequests) : '--' },
      { label: locale.value.application?.clientErrorCount, value: runtimeHttpMetrics.value?.recent4xx != null ? String(runtimeHttpMetrics.value.recent4xx) : '--' },
      { label: locale.value.application?.serverErrorCount, value: runtimeHttpMetrics.value?.recent5xx != null ? String(runtimeHttpMetrics.value.recent5xx) : '--' },
      { label: locale.value.application?.ssrRenderCount, value: runtimeSsrPrewarm.value?.attempts != null ? String(runtimeSsrPrewarm.value.attempts) : '--' },
      { label: locale.value.application?.gcCount, value: runtimeGcMetrics.value?.count != null ? String(runtimeGcMetrics.value.count) : '--' }
    ]
  },
  {
    icon: 'activity',
    title: locale.value.application?.adminProgressSse,
    detail: locale.value.application?.adminProgressSseDetail,
    status: applicationSseStatus(runtimeSseMetrics.value?.progress),
    empty: !runtimeSseMetrics.value?.progress,
    items: [
      { label: locale.value.application?.adminProgressSseActiveConnections, value: runtimeSseMetrics.value?.progress?.activeConnections != null ? String(runtimeSseMetrics.value.progress.activeConnections) : '--' },
      { label: locale.value.application?.adminProgressSseHeartbeatFailures, value: runtimeSseMetrics.value?.progress?.heartbeatFailures != null ? String(runtimeSseMetrics.value.progress.heartbeatFailures) : '--' },
      { label: locale.value.application?.adminProgressSseAverageLifetime, value: formatMilliseconds(runtimeSseMetrics.value?.progress?.averageLifetimeMs) },
      { label: locale.value.application?.adminProgressSseUnclosedConnections, value: '--' }
    ]
  }
])

const serverSummaryDetails = computed(() => [
  { label: locale.value.runtime?.hostname, value: runtimeMetrics.value?.runtime?.hostname || '--' },
  { label: locale.value.runtime?.platform, value: systemSnapshot.value?.platform || '--' },
  { label: locale.value.runtime?.systemUptime, value: systemSnapshot.value?.uptime ? formatDuration(Math.max(0, Number(systemSnapshot.value.uptime) + (runtimeNow.value - Date.parse(systemSnapshot.value.timestamp || '')) / 1000)) : '--' },
  { label: locale.value.runtime?.processPid, value: runtimeMetrics.value?.runtime?.processId != null ? String(runtimeMetrics.value.runtime.processId) : '--' }
])

const serverMetrics = computed(() => (isServerlessRuntime.value ? [
  { icon: 'activity', label: '函数调用次数', detail: 'Serverless 函数调用量（当前实例可见范围）', value: runtimeMetrics.value?.http?.recentRequests != null ? String(runtimeMetrics.value.http.recentRequests) : '--' },
  { icon: 'clock', label: '函数执行时长 P95', detail: 'Serverless 函数执行长尾耗时', value: formatMilliseconds(runtimeMetrics.value?.http?.p95Ms) },
  { icon: 'refresh', label: '冷启动次数', detail: '当前实例可见的冷启动次数', value: '--' },
  { icon: 'warning', label: '内存超限错误', detail: '函数因内存限制终止的次数', value: '--' }
] : [
  {
    icon: 'activity',
    label: locale.value.metrics?.cpuUsage,
    detail: locale.value.server?.cpuUsageDetail,
    value: runtimeMetrics.value?.resources?.cpuUsagePercent != null ? formatPercent(runtimeMetrics.value.resources.cpuUsagePercent) : '--'
  },
  {
    icon: 'monitoring',
    label: locale.value.metrics?.systemMemory,
    detail: locale.value.server?.systemMemoryDetail,
    value: runtimeMetrics.value?.resources?.memoryUsedBytes != null ? `${formatBytes(runtimeMetrics.value.resources.memoryUsedBytes)} 常驻内存` : '--'
  },
  {
    icon: 'database',
    label: locale.value.metrics?.diskUsage,
    detail: locale.value.server?.diskUsageDetail,
    value: runtimeMetrics.value?.resources?.diskUsedBytes != null ? `${formatBytes(runtimeMetrics.value.resources.diskUsedBytes)} 已用` : '--'
  },
  {
    icon: 'activity',
    label: locale.value.server?.networkIngress,
    detail: locale.value.server?.networkIngressDetail,
    value: runtimeMetrics.value?.resources?.networkRxBytes != null ? `${formatBytes(runtimeMetrics.value.resources.networkRxBytes)} 累计` : '--'
  },
  {
    icon: 'activity',
    label: locale.value.server?.networkEgress,
    detail: locale.value.server?.networkEgressDetail,
    value: runtimeMetrics.value?.resources?.networkTxBytes != null ? `${formatBytes(runtimeMetrics.value.resources.networkTxBytes)} 累计` : '--'
  },
  {
    icon: 'database',
    label: locale.value.server?.diskIo,
    detail: locale.value.server?.diskIoDetail,
    value: runtimeMetrics.value?.resources?.diskTotalBytes != null ? formatBytes(runtimeMetrics.value.resources.diskTotalBytes) : '--'
  },
  {
    icon: 'refresh',
    label: locale.value.server?.containerRestarts,
    detail: locale.value.server?.containerRestartsDetail,
    value: '--'
  },
  {
    icon: 'activity',
    label: locale.value.application?.eventLoopDelay,
    detail: locale.value.application?.eventLoopDelayDetail,
    value: formatMilliseconds(runtimeEventLoopMetrics.value?.p99Ms)
  },
  {
    icon: 'clock',
    label: locale.value.application?.gcPause,
    detail: locale.value.application?.gcPauseDetail,
    value: formatMilliseconds(runtimeGcMetrics.value?.averagePauseMs)
  }
]))

const infraTrendPanels = computed(() => (isServerlessRuntime.value ? [
  { title: '函数调用量趋势', detail: '无服务器函数调用量按时间聚合。', unit: '次', field: 'requests', available: true },
  { title: '函数执行时长 P95', detail: '无服务器函数执行长尾趋势；当前实例无历史持久化时显示暂无数据。', unit: 'ms', field: 'p95Ms', available: true }
] : [
  { title: locale.value.server?.cpuTrend, detail: locale.value.server?.cpuTrendDetail, unit: '%', field: 'cpu_usage_percent', available: true },
  { title: locale.value.server?.memoryTrend, detail: locale.value.server?.memoryTrendDetail, unit: 'MB', field: 'memory_used_mb', available: true },
  { title: '磁盘使用趋势', detail: '服务器工作目录所在文件系统的已用容量。', unit: 'MB', field: 'disk_used_mb', available: true },
  { title: locale.value.server?.networkTrend, detail: 'Linux 网络接口每分钟接收流量；其他运行平台保持未采集。', unit: 'MB/分钟', field: 'network_rx_mb', available: true }
]))

const serverRuntimeDetails = computed(() => [
  { label: '部署运行模式', value: runtimeDeploymentTarget.value },
  { label: locale.value.server?.platformRelease, value: systemSnapshot.value?.platform || '--' },
  { label: locale.value.runtime?.architecture, value: systemSnapshot.value?.arch || '--' },
  { label: locale.value.runtime?.nodeVersion, value: systemSnapshot.value?.nodeVersion || '--' },
  { label: locale.value.runtime?.processUptime, value: systemSnapshot.value?.uptime ? `${Math.round(systemSnapshot.value.uptime)}s` : '--' },
  { label: locale.value.runtime?.instanceId, value: operationsData.value.status?.instance?.instanceId || '--' },
  { label: locale.value.server?.appVersion, value: runtimeMetrics.value?.runtime?.appVersion || '--' },
  { label: locale.value.server?.commitSha, value: runtimeMetrics.value?.runtime?.release || publicRuntimeConfig.sentry?.release || 'N/A' },
  { label: locale.value.server?.deployedAt, value: runtimeMetrics.value?.runtime?.startedAt ? formatTimestamp(runtimeMetrics.value.runtime.startedAt) : '--' },
  { label: locale.value.server?.collectionReporting, value: collectionStatusText.value }
])

const serverResourcePanels = computed(() => [
  {
    icon: 'activity',
    source: 'system',
    title: locale.value.server?.cpuDetails,
    detail: locale.value.server?.cpuDetailsDetail,
    empty: isServerlessRuntime.value || runtimeMetrics.value?.resources?.cpuCores == null,
    items: [
      { label: locale.value.server?.cpuModel, value: runtimeMetrics.value?.resources?.cpuModel || '--' },
      { label: locale.value.server?.cpuCores, value: runtimeMetrics.value?.resources?.cpuCores != null ? String(runtimeMetrics.value.resources.cpuCores) : '--' },
      { label: locale.value.server?.loadAverage1, value: runtimeMetrics.value?.resources?.loadAverage?.[0] != null ? String(runtimeMetrics.value.resources.loadAverage[0]) : '--' },
      { label: locale.value.server?.loadAverage5, value: runtimeMetrics.value?.resources?.loadAverage?.[1] != null ? String(runtimeMetrics.value.resources.loadAverage[1]) : '--' },
      { label: locale.value.server?.loadAverage15, value: runtimeMetrics.value?.resources?.loadAverage?.[2] != null ? String(runtimeMetrics.value.resources.loadAverage[2]) : '--' }
    ]
  },
  {
    icon: 'monitoring',
    source: 'system',
    title: locale.value.server?.systemMemoryDetails,
    detail: locale.value.server?.systemMemoryDetailsDetail,
    empty: isServerlessRuntime.value || runtimeMetrics.value?.resources?.memoryTotalBytes == null,
    items: [
      { label: locale.value.server?.systemMemoryTotal, value: formatBytes(runtimeMetrics.value?.resources?.memoryTotalBytes) },
      { label: locale.value.server?.systemMemoryUsed, value: formatBytes(runtimeMetrics.value?.resources?.memoryUsedBytes) },
      { label: locale.value.server?.systemMemoryAvailable, value: runtimeMetrics.value?.resources?.memoryTotalBytes != null && runtimeMetrics.value?.resources?.memoryUsedBytes != null ? formatBytes(Math.max(0, runtimeMetrics.value.resources.memoryTotalBytes - runtimeMetrics.value.resources.memoryUsedBytes)) : '--' }
    ]
  },
  {
    icon: 'database',
    source: 'system',
    title: locale.value.server?.diskDetails,
    detail: locale.value.server?.diskDetailsDetail,
    empty: isServerlessRuntime.value || runtimeMetrics.value?.resources?.diskTotalBytes == null,
    items: [
      { label: locale.value.server?.diskTotal, value: formatBytes(runtimeMetrics.value?.resources?.diskTotalBytes) },
      { label: locale.value.server?.diskAvailable, value: runtimeMetrics.value?.resources?.diskTotalBytes != null && runtimeMetrics.value?.resources?.diskUsedBytes != null ? formatBytes(Math.max(0, runtimeMetrics.value.resources.diskTotalBytes - runtimeMetrics.value.resources.diskUsedBytes)) : '--' },
      { label: locale.value.server?.partitionCount, value: '1（工作目录文件系统）' }
    ]
  },
  {
    icon: 'server',
    source: 'metrics',
    title: locale.value.server?.nodeProcessDetails,
    detail: locale.value.server?.nodeProcessDetailsDetail,
    empty: !runtimeMetrics.value?.process,
    items: [
      { label: 'Node 进程 CPU', value: runtimeMetrics.value?.process?.cpuUsagePercent != null ? formatPercent(runtimeMetrics.value.process.cpuUsagePercent) : '--' },
      { label: locale.value.server?.rssMemory, value: runtimeMetrics.value?.process?.memory?.rss != null ? formatBytes(runtimeMetrics.value.process.memory.rss) : '--' },
      { label: locale.value.server?.nodeHeapUtilization, value: runtimeMetrics.value?.process?.memory?.heapTotal ? formatPercent(runtimeMetrics.value.process.memory.heapUsed / runtimeMetrics.value.process.memory.heapTotal * 100) : '--' },
      { label: locale.value.server?.heapUsed, value: runtimeMetrics.value?.process?.memory?.heapUsed != null ? formatBytes(runtimeMetrics.value.process.memory.heapUsed) : '--' },
      { label: locale.value.server?.heapTotal, value: runtimeMetrics.value?.process?.memory?.heapTotal != null ? formatBytes(runtimeMetrics.value.process.memory.heapTotal) : '--' },
      { label: locale.value.server?.externalMemory, value: runtimeMetrics.value?.process?.memory?.external != null ? formatBytes(runtimeMetrics.value.process.memory.external) : '--' },
      { label: locale.value.server?.gcCount, value: runtimeGcMetrics.value?.count != null ? String(runtimeGcMetrics.value.count) : '--' },
      { label: locale.value.server?.gcPause, value: formatMilliseconds(runtimeGcMetrics.value?.averagePauseMs) },
      { label: locale.value.server?.eventLoopP99Lag, value: formatMilliseconds(runtimeEventLoopMetrics.value?.p99Ms) }
    ]
  }
])

const runtimeGuardPanels = computed(() => [
  {
    icon: 'database',
    source: 'metrics',
    title: locale.value.server?.redisRuntimeGuard,
    detail: locale.value.server?.redisRuntimeGuardDetail,
    empty: !runtimeRedisMetrics.value,
    status: !runtimeRedisMetrics.value || !runtimeRedisMetrics.value.configured ? 'unknown' : runtimeRedisMetrics.value.connected ? 'ok' : 'error',
    items: [
      { label: locale.value.server?.redisConfigured, value: runtimeRedisMetrics.value ? (runtimeRedisMetrics.value.configured ? '已配置' : '未配置') : '--' },
      { label: locale.value.server?.redisConnected, value: !runtimeRedisMetrics.value ? '--' : !runtimeRedisMetrics.value.configured ? '未启用' : runtimeRedisMetrics.value.connected ? '已连接' : '不可用' },
      { label: locale.value.server?.redisFallbackMode, value: runtimeRedisMetrics.value ? (!runtimeRedisMetrics.value.configured || !runtimeRedisMetrics.value.connected ? '已启用降级' : '未启用降级') : '--' },
      { label: locale.value.server?.redisLastError, value: runtimeRedisMetrics.value?.lastError || '--' }
    ]
  },
  {
    icon: 'activity',
    source: 'metrics',
    title: locale.value.server?.ssrWarmup,
    detail: locale.value.server?.ssrWarmupDetail,
    empty: !runtimeSsrPrewarm.value || !Number(runtimeSsrPrewarm.value.attempts),
    items: [
      { label: locale.value.server?.ssrWarmupLastResult, value: runtimeSsrPrewarm.value?.lastResult || '--' },
      { label: locale.value.server?.ssrWarmupDuration, value: formatMilliseconds(runtimeSsrPrewarm.value?.lastDurationMs) },
      { label: locale.value.server?.ssrWarmupFailures, value: runtimeSsrPrewarm.value?.failures != null ? String(runtimeSsrPrewarm.value.failures) : '--' }
    ]
  },
  {
    icon: 'monitoring',
    source: 'metrics',
    title: locale.value.server?.egressLocation,
    detail: locale.value.server?.egressLocationDetail,
    empty: true,
    items: [
      { label: locale.value.server?.egressLastLocation, value: '--' },
      { label: locale.value.server?.egressCacheAge, value: '--' },
      { label: locale.value.server?.egressLookupFailures, value: '--' }
    ]
  }
])

const databasePoolDetails = computed(() => [
  { label: locale.value.server?.poolUtilization, value: formatPercent(operationsData.value.pool?.utilization) },
  { label: locale.value.server?.poolMax, value: operationsData.value.pool?.maxConnections ?? '--' },
  { label: locale.value.server?.poolActive, value: operationsData.value.pool?.activeConnections ?? '--' },
  { label: locale.value.server?.poolTotal, value: operationsData.value.pool?.totalConnections ?? '--' },
  { label: locale.value.server?.poolAvailable, value: operationsData.value.pool ? Math.max(0, Number(operationsData.value.pool.maxConnections || 0) - Number(operationsData.value.pool.totalConnections || 0)) : '--' }
])

const databasePerformanceSourceDetails = computed(() => [
  { label: locale.value.server?.responseTime, value: operationsData.value.performance?.responseTime != null ? `${Math.round(Number(operationsData.value.performance.responseTime))} ms` : '--' },
  { label: locale.value.server?.poolActive, value: operationsData.value.performance?.activeConnections ?? '--' },
  { label: locale.value.server?.transactionsCommitted, value: operationsData.value.performance?.transactionsCommitted ?? '--' },
  { label: locale.value.server?.transactionsRolledBack, value: operationsData.value.performance?.transactionsRolledBack ?? '--' },
  { label: '累计查询调用', value: operationsData.value.performance?.queriesExecuted ?? '--' },
  { label: locale.value.database?.indexHitRatio, value: formatPercent(operationsData.value.performance?.cacheHitRatio) }
])

const databaseDiagnosticsDetails = computed(() => [
  { label: locale.value.database?.activeQueries, value: databaseDiagnostics.value?.activity?.available ? String(activeDatabaseQueries.value.length) : '--' },
  { label: locale.value.database?.poolerWaitQueue, value: databaseDiagnostics.value?.locks?.available ? String(databaseDiagnostics.value.locks.data?.length || 0) : '--' },
  { label: locale.value.database?.slowQueryCount, value: databaseDiagnostics.value?.slowQueries?.available ? String(slowQueryRows.value.length) : '--' },
  { label: locale.value.database?.databaseSize, value: databaseDiagnostics.value?.size?.available ? databaseDiagnostics.value.size.data?.[0]?.database_size || '--' : '--' },
  { label: locale.value.database?.tableScale, value: databaseDiagnostics.value?.tables?.available ? String(databaseTableRows.value.length) : '--' }
])

const databaseTableRows = computed(() => databaseDiagnostics.value?.tables?.data || [])
const slowQueryRows = computed(() => databaseDiagnostics.value?.slowQueries?.data || [])
const activeDatabaseQueries = computed(() => {
  const lockByBlockedPid = new Map((databaseDiagnostics.value?.locks?.data || []).map((item) => [String(item.blocked_pid), item.blocking_pid]))
  return (databaseDiagnostics.value?.activity?.data || []).map((item) => ({
    ...item,
    duration: item.duration == null ? '--' : String(item.duration),
    waitEvent: [item.wait_event_type, item.wait_event].filter(Boolean).join(': ') || '--',
    blockedBy: lockByBlockedPid.get(String(item.pid)) || '--'
  }))
})

const cacheMetrics = computed(() => [
  {
    icon: 'success',
    label: locale.value.cache?.ready,
    detail: locale.value.cache?.readyDetail,
    value: redisStatusValue.value
  },
  {
    icon: 'activity',
    label: locale.value.cache?.hitRatio,
    detail: locale.value.cache?.hitRatioDetail,
    value: runtimeRedisMetrics.value?.metrics?.hitRate != null ? formatPercent(runtimeRedisMetrics.value.metrics.hitRate) : '--'
  },
  { icon: 'monitoring', label: locale.value.cache?.memoryUsed, detail: locale.value.cache?.memoryUsedDetail, value: runtimeRedisMetrics.value?.metrics?.memoryUsedBytes != null ? formatBytes(runtimeRedisMetrics.value.metrics.memoryUsedBytes) : '--' },
  { icon: 'server', label: locale.value.cache?.connections, detail: locale.value.cache?.connectionsDetail, value: runtimeRedisMetrics.value?.metrics?.connectedClients != null ? String(runtimeRedisMetrics.value.metrics.connectedClients) : '--' },
  { icon: 'clock', label: locale.value.cache?.commandP99, detail: locale.value.cache?.commandP99Detail },
  { icon: 'warning', label: locale.value.cache?.evictions, detail: locale.value.cache?.evictionsDetail, value: runtimeRedisMetrics.value?.metrics?.evictedKeys != null ? String(runtimeRedisMetrics.value.metrics.evictedKeys) : '--' },
  { icon: 'warning', label: locale.value.cache?.rateLimitTriggers, detail: locale.value.cache?.rateLimitTriggersDetail, value: runtimeHttpMetrics.value?.status429 != null ? String(runtimeHttpMetrics.value.status429) : '--' },
  { icon: 'warning', label: locale.value.cache?.lastError, detail: locale.value.cache?.errorDetail, value: runtimeRedisMetrics.value?.lastError ? '连接错误' : '--' },
  { icon: 'activity', label: locale.value.cache?.memoryFragmentation, detail: locale.value.cache?.memoryFragmentationDetail, value: runtimeRedisMetrics.value?.metrics?.memoryFragmentationRatio != null ? `${Number(runtimeRedisMetrics.value.metrics.memoryFragmentationRatio).toFixed(2)}x` : '--' }
])

const redisStatusValue = computed(() => {
  if (!runtimeRedisMetrics.value) return '--'
  if (!runtimeRedisMetrics.value.configured) return '未启用'
  return runtimeRedisMetrics.value.connected ? '已连接' : '不可用'
})
const redisPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!runtimeRedisMetrics.value?.configured) return 'unknown'
  return runtimeRedisMetrics.value.connected ? 'ok' : 'error'
})
const redisPanelEmpty = computed(() => !runtimeRedisMetrics.value?.configured)
const redisUpdatedAt = computed(() => runtimeMetrics.value?.collectedAt ? formatTimestamp(runtimeMetrics.value.collectedAt) : '尚未采集')
const redisCommandMetrics = computed(() => runtimeRedisMetrics.value?.metrics?.commandMetrics || [])

const cacheDetails = computed(() => [
  locale.value.cache?.configured,
  locale.value.cache?.keyPrefix,
  locale.value.cache?.lastConnected,
  locale.value.cache?.evictionPolicy,
  locale.value.cache?.memoryFragmentation
])

const cacheDetailValue = (label) => {
  const redis = runtimeRedisMetrics.value
  if (!redis) return '--'
  const values = new Map([
    [locale.value.cache?.configured, redis.configured ? '已配置' : '未配置'],
    [locale.value.cache?.keyPrefix, redis.keyPrefix || 'N/A'],
    [locale.value.cache?.lastConnected, redis.lastConnectedAt ? formatTimestamp(redis.lastConnectedAt) : 'N/A'],
    [locale.value.cache?.evictionPolicy, redis.metrics?.evictionPolicy || 'N/A'],
    [locale.value.cache?.memoryFragmentation, redis.metrics?.memoryFragmentationRatio != null ? `${Number(redis.metrics.memoryFragmentationRatio).toFixed(2)}x` : 'N/A']
  ])
  return values.get(label) || 'N/A'
}

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
  { icon: 'music', label: locale.value.business?.songRequestSuccessRate, detail: locale.value.business?.songRequestSuccessRateDetail, value: formatPercent(runtimeBusinessMetrics.value.song_request?.successRate) },
  { icon: 'calendar', label: locale.value.business?.scheduleSaveSuccessRate, detail: locale.value.business?.scheduleSaveSuccessRateDetail, value: formatPercent(runtimeBusinessMetrics.value.schedule_save?.successRate) },
  { icon: 'activity', label: locale.value.business?.songRequestQps, detail: locale.value.business?.songRequestQpsDetail, value: runtimeBusinessMetrics.value.song_request?.requestsPerSecond != null ? String(runtimeBusinessMetrics.value.song_request.requestsPerSecond) : '--' },
  { icon: 'calendar', label: locale.value.business?.scheduleOperationQps, detail: locale.value.business?.scheduleOperationQpsDetail, value: runtimeBusinessMetrics.value.schedule_save?.requestsPerSecond != null ? String(runtimeBusinessMetrics.value.schedule_save.requestsPerSecond) : '--' }
])

const businessQueueMetrics = computed(() => [
  { label: locale.value.business?.pendingQueueLength, value: businessQueueSnapshot.value?.pendingCount != null ? String(businessQueueSnapshot.value.pendingCount) : '--' },
  { label: locale.value.business?.queueProcessingRate, value: 'N/A' },
  { label: locale.value.business?.queueOldestAge, value: businessQueueSnapshot.value?.oldestCreatedAt ? formatTimestamp(businessQueueSnapshot.value.oldestCreatedAt) : '--' },
  { label: locale.value.business?.queueBacklogGrowth, value: 'N/A' }
])

const businessCapacityMetrics = computed(() => [
  { label: locale.value.business?.peakRequestQps, value: runtimeTimeline.value.length ? String(Math.max(...runtimeTimeline.value.map((item) => Number(item.requests || 0)))) : '--' },
  { label: locale.value.business?.peakScheduleQps, value: runtimeBusinessMetrics.value.schedule_save?.requestsPerSecond != null ? String(runtimeBusinessMetrics.value.schedule_save.requestsPerSecond) : '--' },
  { label: locale.value.business?.dbPoolHeadroom, value: operationsData.value.pool?.utilization != null ? `${Math.max(0, 100 - Number(operationsData.value.pool.utilization)).toFixed(1)}%` : '--' },
  { label: locale.value.business?.serverlessConcurrencyHeadroom, value: 'N/A' }
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

const businessGroupValue = (label) => {
  const request = runtimeBusinessMetrics.value.song_request
  const schedule = runtimeBusinessMetrics.value.schedule_save
  const values = new Map([
    [locale.value.business?.requestSuccessRate, formatPercent(request?.successRate)],
    [locale.value.business?.songAndVoteRequests, request?.calls != null ? String(request.calls) : '--'],
    [locale.value.business?.scheduleOperations, schedule?.calls != null ? String(schedule.calls) : '--'],
    [locale.value.business?.musicSearchApiAvailability, dependencyMetrics.value ? `${Object.values(dependencyMetrics.value).filter((item) => item?.successRate != null && item.successRate >= 95).length}` : '--']
  ])
  return values.get(label) || 'N/A'
}

const securityUpdatedAt = computed(() => runtimeMetrics.value?.collectedAt ? formatTimestamp(runtimeMetrics.value.collectedAt) : locale.value.awaitingConnection)
const oauthFailureCount = computed(() => {
  const calls = Number(runtimeOAuthMetrics.value?.calls || 0)
  const successRate = runtimeOAuthMetrics.value?.successRate
  if (!calls || successRate == null) return 0
  return Math.max(0, Math.round(calls * (100 - Number(successRate)) / 100))
})
const activeRiskCount = computed(() => [
  runtimeHttpMetrics.value?.recent5xx,
  runtimeHttpMetrics.value?.status401,
  runtimeHttpMetrics.value?.status403,
  runtimeHttpMetrics.value?.status429,
  turnstileMetrics.value?.validationFailures,
  turnstileMetrics.value?.upstreamFailures,
  oauthFailureCount.value
].reduce((total, value) => total + Number(value || 0), 0))

const securityRiskRows = computed(() => {
  const oauthCalls = Number(runtimeOAuthMetrics.value?.calls || 0)
  const oauthSuccessRate = runtimeOAuthMetrics.value?.successRate
  const turnstileCalls = Number(turnstileMetrics.value?.calls || 0)
  return [
    { label: '5xx 服务错误', value: Number(runtimeHttpMetrics.value?.recent5xx || 0), count: Number(runtimeHttpMetrics.value?.recent5xx || 0), status: Number(runtimeHttpMetrics.value?.recent5xx || 0) > 0 ? 'error' : 'ok' },
    { label: '无效 JWT 请求', value: Number(runtimeHttpMetrics.value?.status401 || 0), count: Number(runtimeHttpMetrics.value?.status401 || 0), status: Number(runtimeHttpMetrics.value?.status401 || 0) > 0 ? 'warning' : 'ok' },
    { label: '权限拒绝请求', value: Number(runtimeHttpMetrics.value?.status403 || 0), count: Number(runtimeHttpMetrics.value?.status403 || 0), status: Number(runtimeHttpMetrics.value?.status403 || 0) > 0 ? 'warning' : 'ok' },
    { label: '429 限流触发', value: Number(runtimeHttpMetrics.value?.status429 || 0), count: Number(runtimeHttpMetrics.value?.status429 || 0), status: Number(runtimeHttpMetrics.value?.status429 || 0) > 0 ? 'warning' : 'ok' },
    { label: '验证码拦截', value: turnstileCalls ? Number(turnstileMetrics.value?.validationFailures || 0) : '--', count: turnstileCalls ? Number(turnstileMetrics.value?.validationFailures || 0) : 0, status: !turnstileCalls ? 'unknown' : Number(turnstileMetrics.value?.validationFailures || 0) > 0 ? 'warning' : 'ok' },
    { label: 'Turnstile 上游失败', value: turnstileCalls ? Number(turnstileMetrics.value?.upstreamFailures || 0) : '--', count: turnstileCalls ? Number(turnstileMetrics.value?.upstreamFailures || 0) : 0, status: !turnstileCalls ? 'unknown' : Number(turnstileMetrics.value?.upstreamFailures || 0) > 0 ? 'error' : 'ok' },
    {
      label: 'OAuth 回调失败率',
      value: oauthCalls && oauthSuccessRate != null ? `${(100 - Number(oauthSuccessRate)).toFixed(1)}%` : '--',
      count: oauthFailureCount.value,
      status: !oauthCalls || oauthSuccessRate == null ? 'unknown' : Number(oauthSuccessRate) === 0 ? 'error' : Number(oauthSuccessRate) < 100 ? 'warning' : 'ok'
    }
  ]
})
const prioritizedSecurityRiskRows = computed(() => securityRiskRows.value
  .filter((item) => item.status === 'warning' || item.status === 'error')
  .sort((left, right) => statusRank[right.status] - statusRank[left.status]))
const securityRiskStatusTotal = (status) => securityRiskRows.value
  .filter((item) => item.status === status)
  .reduce((total, item) => total + Number(item.count || 0), 0)
const securityRiskShare = (status) => activeRiskCount.value ? Math.min(100, securityRiskStatusTotal(status) / activeRiskCount.value * 100) : 0
const securityRiskItemShare = (item) => activeRiskCount.value && item.count
  ? Math.max(3, Math.min(100, Number(item.count) / activeRiskCount.value * 100))
  : 0
const securityRiskSummary = computed(() => [
  { label: '错误信号', value: securityRiskStatusTotal('error'), status: securityRiskStatusTotal('error') ? 'error' : 'unknown' },
  { label: '警告信号', value: securityRiskStatusTotal('warning'), status: securityRiskStatusTotal('warning') ? 'warning' : 'unknown' },
  { label: '风险事件', value: activeRiskCount.value, status: activeRiskCount.value ? securityModuleStatus.value : 'ok' },
  { label: '未采集项', value: securityRiskRows.value.filter((item) => item.status === 'unknown').length, status: 'unknown' }
])
const securityRiskPriorityLabel = computed(() => securityRiskStatusTotal('error') ? '错误信号' : securityRiskStatusTotal('warning') ? '警告信号' : '无需处置')

const securitySignalMetrics = computed(() => [
  { icon: 'warning', label: locale.value.audit?.invalidTokenRequests, detail: 'JWT 校验失败与过期 Token 请求数' },
  { icon: 'warning', label: locale.value.audit?.strongAuthFailures, detail: 'OAuth 回调失败率；仅在配置 OAuth 时有数据' },
  { icon: 'activity', label: locale.value.audit?.rateLimitTriggers, detail: '429 限流触发次数，不计入 5xx 故障' },
  { icon: 'success', label: locale.value.audit?.turnstileValidationRequests, detail: locale.value.audit?.turnstileValidationRequestsDetail },
  { icon: 'success', label: locale.value.audit?.turnstileValidationSuccessRate, detail: locale.value.audit?.turnstileValidationSuccessRateDetail },
  { icon: 'warning', label: locale.value.audit?.turnstileUpstreamFailures, detail: locale.value.audit?.turnstileUpstreamFailuresDetail }
])
const securitySignalStatus = (item) => {
  if (item.label === locale.value.audit?.invalidTokenRequests) return Number(runtimeHttpMetrics.value?.status401 || 0) > 0 ? 'warning' : runtimeHttpMetrics.value ? 'ok' : 'unknown'
  if (item.label === locale.value.audit?.rateLimitTriggers) return Number(runtimeHttpMetrics.value?.status429 || 0) > 0 ? 'warning' : runtimeHttpMetrics.value ? 'ok' : 'unknown'
  if (item.label === locale.value.audit?.strongAuthFailures) {
    const calls = Number(runtimeOAuthMetrics.value?.calls || 0)
    const successRate = runtimeOAuthMetrics.value?.successRate
    if (!calls || successRate == null) return 'unknown'
    if (Number(successRate) === 0) return 'error'
    return Number(successRate) < 100 ? 'warning' : 'ok'
  }
  if (!turnstileMetrics.value || !Number(turnstileMetrics.value.calls || 0)) return 'unknown'
  if (item.label === locale.value.audit?.turnstileUpstreamFailures) return Number(turnstileMetrics.value.upstreamFailures || 0) > 0 ? 'error' : 'ok'
  if (item.label === locale.value.audit?.turnstileValidationSuccessRate) {
    if (Number(turnstileMetrics.value.upstreamFailures || 0) > 0) return 'error'
    return Number(turnstileMetrics.value.validationFailures || 0) > 0 ? 'warning' : 'ok'
  }
  return 'ok'
}
const prioritizedSecuritySignalMetrics = computed(() => [...securitySignalMetrics.value].sort((left, right) => statusRank[securitySignalStatus(right)] - statusRank[securitySignalStatus(left)]))
const securitySignalsPanelStatus = computed(() => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (!runtimeMetrics.value) return 'unknown'
  const statuses = securitySignalMetrics.value.map(securitySignalStatus)
  return statuses.some((status) => status !== 'unknown') ? maxStatus(...statuses) : 'unknown'
})

const requestSummaryItems = computed(() => [
  { icon: 'warning', label: locale.value.debug?.statusCode, detail: locale.value.debug?.statusCodeDetail, value: selectedDebugRequest.value?.status ?? 'N/A' },
  { icon: 'clock', label: locale.value.debug?.duration, detail: locale.value.debug?.durationDetail, value: selectedDebugRequest.value ? formatMilliseconds(selectedDebugRequest.value.durationMs) : 'N/A' },
  { icon: 'user', label: locale.value.debug?.user, detail: locale.value.debug?.userDetail, value: 'N/A' },
  { icon: 'layers', label: locale.value.application?.route, detail: locale.value.debug?.routeDetail, value: selectedDebugRequest.value?.route || 'N/A' },
  { icon: 'clock', label: locale.value.debug?.occurredAt, detail: locale.value.debug?.occurredAtDetail, value: selectedDebugRequest.value ? formatTimestamp(selectedDebugRequest.value.at) : 'N/A' },
  { icon: 'external-link', label: locale.value.debug?.relatedLinks, detail: locale.value.debug?.relatedLinksDetail, value: selectedDebugRequest.value?.requestId || 'N/A' }
])

const logCenterMetrics = computed(() => [
  { icon: 'terminal', label: locale.value.logCenter?.totalLogs, detail: locale.value.logCenter?.totalLogsDetail, value: String(logEntries.value.length) },
  { icon: 'warning', label: locale.value.logCenter?.errorLogs, detail: locale.value.logCenter?.errorLogsDetail, value: String(logEntries.value.filter((item) => item.level === 'error').length) },
  { icon: 'warning', label: locale.value.logCenter?.warningLogs, detail: locale.value.logCenter?.warningLogsDetail, value: String(logEntries.value.filter((item) => item.level === 'warn').length) },
  { icon: 'layers', label: locale.value.logCenter?.requestTraces, detail: locale.value.logCenter?.requestTracesDetail, value: String(new Set(logEntries.value.map((item) => item.requestId).filter(Boolean)).size) }
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

const logContextValue = (label) => {
  const item = selectedLogEntry.value
  if (!item) return 'N/A'
  const values = new Map([
    [locale.value.overview?.logRequestId, item.requestId || 'N/A'],
    [locale.value.application?.route, item.route || 'N/A'],
    [locale.value.debug?.statusCode, item.status ?? 'N/A'],
    [locale.value.overview?.logHost, 'N/A'],
    [locale.value.debug?.user, 'N/A'],
    [locale.value.logCenter?.sourceIp, 'N/A'],
    [locale.value.logCenter?.traceId, 'N/A'],
    [locale.value.logCenter?.instanceId, operationsData.value.status?.instance?.instanceId || 'N/A']
  ])
  return values.get(label) || 'N/A'
}

const dependencyHealthCards = computed(() => [
  ...enabledMusicSourceKeys.value.map((source) => ({
    icon: 'music',
    label: musicSourceLabel(source),
    details: musicSourceHealthDetails.value
  })),
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

const musicSourceHealthDetails = computed(() => [
  locale.value.dependencies?.availability,
  locale.value.dependencies?.p95LatencyShort,
  locale.value.dependencies?.errorRate,
  locale.value.dependencies?.parseSuccessRate,
  locale.value.dependencies?.emptyResultRate,
  locale.value.dependencies?.semanticFailureRate,
  locale.value.dependencies?.circuitBreakerState,
  locale.value.dependencies?.lastSuccess
])

const dependencyMetricGroups = (item) => {
  const details = (item.details || []).filter(Boolean)
  if (details.length >= 8) {
    return [
      { key: 'availability', label: locale.value.dependencies?.metricGroupAvailability, details: details.slice(0, 2) },
      { key: 'quality', label: locale.value.dependencies?.metricGroupQuality, details: details.slice(2, 6) },
      { key: 'stability', label: locale.value.dependencies?.metricGroupStability, details: details.slice(6) }
    ]
  }
  return [
    { key: 'availability', label: locale.value.dependencies?.metricGroupAvailability, details: details.slice(0, 2) },
    { key: 'stability', label: locale.value.dependencies?.metricGroupStability, details: details.slice(2) }
  ].filter((group) => group.details.length)
}

const overviewDependencyPreview = computed(() => dependencyHealthCards.value.map(item => ({
  ...item,
  status: dependencyCardStatus(item.label),
  value: dependencyOverviewStatusText(item.label),
  preview: item.details.slice(0, 3).map(detail => `${detail} ${dependencyMetricValue(item.label, detail)}`).join(' · ')
})))

const dependencyErrorPanels = computed(() => enabledMusicSourceKeys.value.map((source) => ({
  source,
  title: dependencyErrorPanelTitle(source),
  detail: locale.value.dependencies?.errorCodePanelDetail
})))

const dependencyUptimeRows = computed(() => enabledMusicSourceKeys.value.map((source) => ({ source, label: musicSourceLabel(source) })).map((item) => {
  const sourceStatus = dependencySourceStatus(item.source)
  const current = sourceStatus === 'ok' ? 'up' : sourceStatus === 'warning' ? 'degraded' : sourceStatus === 'error' ? 'down' : 'unknown'
  const hourly = new Map()
  for (const point of dependencyMetricTimeline.value.filter((entry) => entry.source === item.source)) {
    const hour = Math.floor(new Date(point.at).getTime() / 3_600_000)
    const bucket = hourly.get(hour) || { calls: 0, successes: 0 }
    bucket.calls += Number(point.calls || 0)
    bucket.successes += Number(point.successes || 0)
    hourly.set(hour, bucket)
  }
  const nowHour = Math.floor(Date.now() / 3_600_000)
  const slotDetails = Array.from({ length: 24 }, (_, index) => {
    const bucket = hourly.get(nowHour - 23 + index)
    const at = new Date((nowHour - 23 + index) * 3_600_000).toISOString()
    if (!bucket?.calls) return { at, status: 'unknown', calls: null, successRate: null }
    const successRate = bucket.successes / bucket.calls * 100
    return { at, status: successRate >= 95 ? 'up' : successRate > 0 ? 'degraded' : 'down', calls: bucket.calls, successRate }
  })
  if (slotDetails[slotDetails.length - 1].status === 'unknown' && current !== 'unknown') {
    const metric = dependencyMetrics.value[item.source]
    slotDetails[slotDetails.length - 1] = {
      ...slotDetails[slotDetails.length - 1],
      status: current,
      calls: Number(metric?.calls || 0) || null,
      successRate: metric?.successRate != null ? Number(metric.successRate) : null,
      currentSample: true
    }
  }
  return { ...item, slots: slotDetails.map((detail) => detail.status), slotDetails }
}))
const dependencySlotTooltip = (row, index) => {
  const detail = row.slotDetails?.[index]
  if (!detail) return `${row.label} · 未采集`
  const status = detail.status === 'up' ? '正常' : detail.status === 'degraded' ? '需要关注' : detail.status === 'down' ? '异常' : '未采集'
  const value = detail.calls == null ? '' : `\n调用：${detail.calls} 次${detail.successRate == null ? '' : ` · 成功率：${detail.successRate.toFixed(1)}%`}`
  return `时间：${formatTimestamp(detail.at)}\n音源：${row.label}\n状态：${status}${value}`
}

const dependencyErrorCodes = computed(() => [
  locale.value.dependencies?.rateLimited,
  locale.value.dependencies?.notFound,
  locale.value.dependencies?.upstreamErrors,
  locale.value.dependencies?.timeoutErrors
])
const dependencyErrorCodeValue = (source, item) => {
  const metric = dependencyMetrics.value[source]
  if (!metric || !Number(metric.calls)) return '--'
  if (item === locale.value.dependencies?.timeoutErrors) return String(metric.timeouts || 0)
  return '--'
}

const dependencyProtectionPanels = computed(() => [
  {
    icon: 'layers',
    source: 'dependencies',
    title: locale.value.dependencies?.fallbackHits,
    detail: locale.value.dependencies?.fallbackHitsDetail,
    items: [
      locale.value.dependencies?.providerFallbacks,
      locale.value.dependencies?.retryAttempts,
      locale.value.dependencies?.circuitBreakerOpens,
      locale.value.dependencies?.cachedResponseFallbacks,
      ...enabledMusicSourceKeys.value.map((source) => musicSourceLabel(source))
    ]
  },
  {
    icon: 'database',
    source: 'cache',
    title: locale.value.dependencies?.searchCacheHitRate,
    detail: locale.value.dependencies?.searchCacheHitRateDetail,
    items: [
      locale.value.dependencies?.cacheHits,
      locale.value.dependencies?.cacheMisses,
      locale.value.dependencies?.cacheEvictions,
      locale.value.dependencies?.cacheResponseP95,
      locale.value.dependencies?.cacheHitRate
    ]
  },
  {
    icon: 'bell',
    source: 'notifications',
    title: locale.value.dependencies?.notificationDelivery,
    detail: locale.value.dependencies?.notificationDeliveryDetail,
    items: [
      locale.value.dependencies?.smtpAcceptedRate,
      locale.value.dependencies?.meowEligibleTargets,
      locale.value.dependencies?.meowSkippedTargets,
      locale.value.dependencies?.meowTransportFailureRate,
      locale.value.dependencies?.notificationQueue
    ]
  }
])
const dependencyProtectionPanelEmpty = (panel) => {
  if (panel.source === 'dependencies') return !knownMusicSourceStatuses.value.length
  if (panel.source === 'cache') return !runtimeMetrics.value?.cache
  if (panel.source === 'notifications') return !runtimeMetrics.value?.notifications
  return true
}
const dependencyProtectionPanelStatus = (panel) => {
  if (moduleFetchErrors.value.metrics) return 'error'
  if (dependencyProtectionPanelEmpty(panel)) return 'unknown'
  if (panel.source === 'dependencies') return dependenciesModuleStatus.value
  if (panel.source === 'notifications') {
    const notifications = runtimeMetrics.value.notifications
    if (Number(notifications.smtpFailures || 0) > 0 || Number(notifications.meowTransportFailures || 0) > 0) return 'error'
    if (Number(notifications.smtpAccepted || 0) > 0 || Number(notifications.meowEligible || 0) > 0) return 'ok'
  }
  return 'unknown'
}

</script>

<style scoped>
.operations-dashboard {
  --ops-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  width: 100%;
  background: #0b0e13;
  color: #e5e7eb;
  letter-spacing: 0;
}

.operations-loading-state {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4.5rem;
  padding: 1rem 1.15rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 6px;
  background: #11151b;
  color: #e5e7eb;
}
.operations-loading-state strong { font-size: 0.8rem; font-weight: 650; }
.operations-loading-state p { margin-top: 0.2rem; color: rgb(148 163 184); font-size: 0.7rem; }
.operations-loading-state__spinner { display: inline-flex; color: #22d3ee; }
.icon-spin { animation: none; }

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
  height: 1.875rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 6px;
  padding: 0 0.75rem;
  color: #e5e7eb;
  background: #0e1217;
  font-size: 0.75rem;
  font-weight: 600;
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.refresh-button:hover { border-color: rgba(56, 189, 248, 0.5); }

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-id-shortcut {
  display: flex;
  min-width: 0;
  height: 1.875rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 6px;
  padding-left: 0.65rem;
  color: #22d3ee;
  background: #0e1217;
}

.request-id-shortcut input {
  min-width: 10rem;
  flex: 1;
  border: 0;
  outline: 0;
  color: #e5e7eb;
  background: transparent;
  font-size: 0.75rem;
}

.request-id-shortcut input::placeholder {
  color: #94a3b8;
}

.request-id-shortcut button {
  height: 100%;
  border-left: 1px solid rgba(148, 163, 184, 0.12);
  padding: 0 0.7rem;
  color: #e5e7eb;
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
  border: 1px solid var(--ops-line);
  border-radius: 6px;
  background: var(--ops-panel);
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
  border-left: 1px solid var(--ops-line-strong);
}

.group-navigation__label {
  display: flex;
  width: auto;
  min-width: 6.2rem;
  min-height: 2.65rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
  border-right: 1px solid rgb(39 39 42);
  padding: 0 0.65rem;
  color: var(--ops-text-3);
  background: var(--ops-control);
  font-size: 0.625rem;
  font-weight: 700;
  white-space: nowrap;
}

.group-tabs {
  display: flex;
  flex: 0 0 auto;
  gap: 0.1rem;
}

.group-tab {
  position: relative;
  display: inline-flex;
  min-height: 2.65rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.65rem;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  transition: color 150ms ease;
}

.group-tab__status {
  width: 0.375rem;
  height: 0.375rem;
  flex: 0 0 auto;
  margin-left: 0.1rem;
  border-radius: 50%;
  background: var(--ops-unknown, #94a3b8);
}
.group-tab__status--ok { background: var(--ops-ok, #34d399); }
.group-tab__status--warning { background: var(--ops-warning, #fbbf24); }
.group-tab__status--error { background: var(--ops-error, #fb7185); }

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
  color: var(--ops-text-1);
}

.group-tab--active {
  color: var(--ops-info);
}

.group-tab--active::after {
  background: var(--ops-info);
}

.group-tab--warning:not(.group-tab--active) { color: color-mix(in srgb, var(--ops-warning) 82%, var(--ops-text-2)); }
.group-tab--error:not(.group-tab--active) { color: var(--ops-error); }

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
  box-shadow: none;
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

.metric-card:nth-child(4n + 1) { --metric-accent: #94a3b8; }
.metric-card:nth-child(4n + 2) { --metric-accent: #34d399; }
.metric-card:nth-child(4n + 3) { --metric-accent: #fbbf24; }
.metric-card:nth-child(4n) { --metric-accent: #c084fc; }
.metric-card .metric-icon { color: var(--metric-accent, #94a3b8); background: color-mix(in srgb, var(--metric-accent, #94a3b8) 12%, transparent); border-color: color-mix(in srgb, var(--metric-accent, #94a3b8) 28%, transparent); }
.metric-card .metric-value { color: color-mix(in srgb, var(--metric-accent, #94a3b8) 72%, white); }
.metric-value--compact { max-width: 100%; font-size: 0.78rem; line-height: 1.65; white-space: normal; word-break: break-word; }
.metric-card, .signal-card, .deployment-mode-card, .service-row { transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease; }
.metric-card:hover, .signal-card:hover, .deployment-mode-card:hover, .service-row:hover { border-color: rgb(96 165 250 / 0.65); background-color: rgb(39 39 42 / 0.72); box-shadow: 0 5px 16px rgb(0 0 0 / 0.16); transform: translateY(-1px); }
.metric-card:hover .metric-icon, .signal-card:hover .metric-icon { color: rgb(191 219 254); border-color: rgb(96 165 250 / 0.7); }

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
  display: grid;
  min-height: 16rem;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  padding: 0.65rem;
}

.health-score-panel {
  align-self: start;
}

:deep(.health-score-panel .ops-panel__header) {
  display: none;
}

:deep(.health-score-panel .ops-panel__body) {
  padding: 0;
}

.server-health-score {
  --health-accent: var(--ops-unknown);
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--ops-line);
  border-radius: 6px;
  padding: 1rem;
  background: #0e1217;
}

.server-health-score--good { --health-accent: var(--ops-ok); }
.server-health-score--warn { --health-accent: var(--ops-warning); }
.server-health-score--critical { --health-accent: var(--ops-error); }

.server-health-score__eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
}

.server-health-score__icon {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--health-accent);
  background: color-mix(in srgb, var(--health-accent) 10%, transparent);
}

.server-health-score__value {
  margin-top: 1.3rem;
  color: var(--ops-text-1);
  font-family: var(--ops-mono);
  font-size: 2.75rem;
  font-weight: 500;
  line-height: 1;
}

.server-health-score__unit {
  margin-top: 0.45rem;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
}

.server-health-score__track {
  height: 0.5rem;
  margin-top: 1.7rem;
  overflow: hidden;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  background: #11151b;
}

.server-health-score__track i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--health-accent);
  transition: width 0.3s ease;
}

.server-health-score__scale {
  display: flex;
  justify-content: space-between;
  margin-top: 0.55rem;
  color: var(--ops-text-2);
  font-size: 0.625rem;
}

.server-health-score > p {
  margin: 1.1rem 0 0;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
  line-height: 1.55;
}

.server-health-inspection {
  min-width: 0;
  padding: 1rem 0 0;
}

.server-health-inspection__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.server-health-inspection__heading h4 {
  margin: 0;
  color: var(--ops-text-1);
  font-size: 0.9375rem;
  font-weight: 650;
}

.server-health-inspection__heading p {
  margin: 0.45rem 0 0;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
  line-height: 1.5;
}

.server-health-inspection__badge {
  flex: 0 0 auto;
  border: 1px solid var(--ops-line);
  border-radius: 5px;
  padding: 0.3rem 0.5rem;
  color: var(--ops-unknown);
  background: #0e1217;
  font-size: 0.625rem;
  font-weight: 650;
}

.server-health-inspection__badge--ok { border-color: color-mix(in srgb, var(--ops-ok) 35%, transparent); color: var(--ops-ok); }
.server-health-inspection__badge--warning { border-color: color-mix(in srgb, var(--ops-warning) 35%, transparent); color: var(--ops-warning); }
.server-health-inspection__badge--error { border-color: color-mix(in srgb, var(--ops-error) 35%, transparent); color: var(--ops-error); }

.server-health-details {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
  margin-top: 1.25rem;
}

.server-health-details > div {
  min-width: 0;
  min-height: 4.25rem;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.7rem;
  background: #0e1217;
}

.server-health-details dt {
  color: var(--ops-text-2);
  font-size: 0.6875rem;
}

.server-health-details dd {
  margin: 0.5rem 0 0;
  overflow-wrap: anywhere;
  color: var(--ops-text-1);
  font-family: var(--ops-mono);
  font-size: 0.6875rem;
  font-weight: 700;
}

.server-health-inspection__note {
  display: flex;
  min-height: 4rem;
  align-items: center;
  gap: 0.7rem;
  margin-top: 1rem;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.75rem;
  color: var(--ops-text-1);
  background: #0e1217;
  font-size: 0.6875rem;
  line-height: 1.5;
}

.server-health-inspection__note svg {
  flex: 0 0 auto;
  color: var(--ops-text-2);
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
  border-left: 3px solid transparent;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}

.alert-rule-row {
  transition: border-color 150ms ease, background-color 150ms ease;
}

.alert-rule-row--p0 {
  border-left-color: var(--ops-error);
  background: color-mix(in srgb, var(--ops-error) 5%, transparent);
}

.alert-rule-row--p1 {
  border-left-color: var(--ops-warning);
  background: color-mix(in srgb, var(--ops-warning) 4%, transparent);
}

.alert-rule-row--p2 {
  border-left-color: rgb(250 204 21 / 0.72);
  background: rgb(250 204 21 / 0.025);
}

.alert-rule-row:hover {
  background-color: rgb(148 163 184 / 0.06);
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

.alert-rule-level {
  min-width: 2.25rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0.18rem 0.42rem;
  font-family: var(--ops-mono);
  line-height: 1;
  text-align: center;
}

.alert-rule-level.alert-priority--critical {
  color: var(--ops-error);
  border-color: color-mix(in srgb, var(--ops-error) 32%, transparent);
  background: color-mix(in srgb, var(--ops-error) 9%, transparent);
}

.alert-rule-level.alert-priority--high {
  color: var(--ops-warning);
  border-color: color-mix(in srgb, var(--ops-warning) 32%, transparent);
  background: color-mix(in srgb, var(--ops-warning) 9%, transparent);
}

.alert-rule-level.alert-priority--medium {
  color: rgb(250 204 21);
  border-color: rgb(250 204 21 / 0.28);
  background: rgb(250 204 21 / 0.07);
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

.chart-axis-label { position: absolute; left: 0.55rem; z-index: 2; color: rgb(113 113 122); font-size: 0.58rem; }
.chart-axis-label--top { top: 1.45rem; }
.chart-axis-label--bottom { bottom: 1.1rem; }
.chart-time-labels { position: absolute; right: 1rem; bottom: 0.28rem; left: 1.7rem; z-index: 2; display: flex; justify-content: space-between; color: rgb(113 113 122); font-size: 0.58rem; }

.runtime-bars {
  position: absolute;
  inset: 1rem 1rem 1.2rem;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
}

.runtime-bars i {
  position: relative;
  flex: 1;
  min-height: 0.35rem;
  border-radius: 2px 2px 0 0;
  background: var(--ops-info);
  opacity: 0.8;
  transition: height 0.45s ease, opacity 0.2s ease;
}

.runtime-bars i::after {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  z-index: 4;
  width: max-content;
  max-width: 15rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgb(82 82 91);
  border-radius: 0.35rem;
  background: rgb(24 24 27 / 0.96);
  color: rgb(228 228 231);
  content: attr(data-tooltip);
  font-size: 0.66rem;
  line-height: 1.45;
  white-space: pre-line;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 0.25rem);
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.runtime-bars i:hover::after { opacity: 1; transform: translate(-50%, 0); }


.runtime-bars--error i { background: #f87171; }
.log-result-row { cursor: pointer; transition: background 0.16s ease; }
.log-result-row:hover { background: rgb(39 39 42 / 0.55); }
.log-level { display: inline-flex; min-width: 2.6rem; justify-content: center; border-radius: 0.2rem; padding: 0.15rem 0.35rem; font-size: 0.65rem; font-weight: 650; }
.log-level--error { background: rgb(248 113 113 / 0.14); color: #fca5a5; }
.log-level--warn { background: rgb(251 191 36 / 0.14); color: #fcd34d; }
.log-level--info { background: rgb(96 165 250 / 0.14); color: #93c5fd; }
.log-detail-row td { padding: 0.85rem 1rem; background: rgb(24 24 27 / 0.72); }
.log-detail-grid { display: grid; grid-template-columns: minmax(15rem, 0.8fr) minmax(0, 1.2fr); gap: 1rem; }
.log-detail-grid strong { color: rgb(212 212 216); font-size: 0.72rem; }
.log-detail-grid dl { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: 0.35rem 0.6rem; margin-top: 0.55rem; font-size: 0.68rem; }
.log-detail-grid dt { color: rgb(113 113 122); }
.log-detail-grid dd { min-width: 0; overflow-wrap: anywhere; color: rgb(212 212 216); }
.log-detail-grid pre { max-height: 12rem; overflow: auto; margin: 0; padding: 0.75rem; border: 1px solid rgb(63 63 70); border-radius: 0.3rem; background: rgb(9 9 11 / 0.8); color: rgb(161 161 170); font: 0.67rem/1.55 ui-monospace, Consolas, monospace; white-space: pre-wrap; }

.dependency-uptime-list { display: grid; gap: 0.7rem; width: 100%; }
.dependency-uptime-row { display: grid; grid-template-columns: 7rem minmax(0, 1fr); align-items: center; gap: 0.75rem; }
.dependency-uptime-row__label { color: rgb(161 161 170); font-size: 0.72rem; font-weight: 600; }

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
  gap: 0.75rem;
}

.risk-total {
  --risk-accent: var(--ops-ok);
  display: flex;
  min-width: 0;
  flex-direction: column;
  border: 1px solid var(--ops-line);
  border-radius: 6px;
  padding: 1rem;
  background: #0e1217;
}

.risk-total--active {
  --risk-accent: var(--ops-error);
}

.risk-total__eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
}

.risk-total__icon {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--risk-accent);
  background: color-mix(in srgb, var(--risk-accent) 10%, transparent);
}

.risk-total__value {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-top: 1.4rem;
}

.risk-total__value strong {
  color: var(--ops-text-1);
  font-family: var(--ops-mono);
  font-size: 2.5rem;
  font-weight: 500;
  line-height: 1;
}

.risk-total__value span {
  color: var(--ops-text-2);
  font-size: 0.6875rem;
}

.risk-total p {
  margin: 0.8rem 0 0;
  color: var(--ops-text-2);
  font-size: 0.6875rem;
  line-height: 1.55;
}

.risk-total__track {
  display: flex;
  height: 0.5rem;
  margin-top: 1.4rem;
  overflow: hidden;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ops-unknown) 12%, transparent);
}

.risk-total__track i { display: block; height: 100%; }
.risk-total__track-error { background: var(--ops-error); }
.risk-total__track-warning { background: var(--ops-warning); }

.risk-total__legend {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.55rem;
  color: var(--ops-text-2);
  font-family: var(--ops-mono);
  font-size: 0.625rem;
}

.risk-total__priority {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.4rem 0.75rem;
  margin-top: 1.2rem;
  border-top: 1px solid var(--ops-line);
  padding-top: 1rem;
}

.risk-total__priority > span {
  grid-column: 1 / -1;
  color: var(--ops-text-2);
  font-size: 0.625rem;
}

.risk-total__priority strong {
  color: var(--ops-text-1);
  font-size: 0.75rem;
}

.risk-total__priority em {
  align-self: center;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.25rem 0.4rem;
  color: var(--ops-unknown);
  background: color-mix(in srgb, var(--ops-unknown) 8%, transparent);
  font-size: 0.625rem;
  font-style: normal;
}

.risk-total__priority .risk-total__priority--ok { border-color: color-mix(in srgb, var(--ops-ok) 30%, transparent); color: var(--ops-ok); background: color-mix(in srgb, var(--ops-ok) 8%, transparent); }
.risk-total__priority .risk-total__priority--warning { border-color: color-mix(in srgb, var(--ops-warning) 30%, transparent); color: var(--ops-warning); background: color-mix(in srgb, var(--ops-warning) 8%, transparent); }
.risk-total__priority .risk-total__priority--error { border-color: color-mix(in srgb, var(--ops-error) 30%, transparent); color: var(--ops-error); background: color-mix(in srgb, var(--ops-error) 8%, transparent); }

.risk-breakdown { min-width: 0; }

.risk-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.risk-summary-grid > div {
  min-width: 0;
  min-height: 4.2rem;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.65rem 0.75rem;
  background: #0e1217;
}

.risk-summary-grid dt {
  color: var(--ops-text-2);
  font-size: 0.6875rem;
}

.risk-summary-grid dd {
  margin: 0.45rem 0 0;
  font-family: var(--ops-mono);
  font-size: 0.8125rem;
  font-weight: 700;
}

.risk-levels {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.risk-levels__empty {
  display: flex;
  min-height: 6rem;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  color: var(--ops-text-2);
  background: #0e1217;
  font-size: 0.75rem;
}

.risk-level-row {
  min-width: 0;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.65rem 0.75rem;
  background: #0e1217;
}

.risk-level-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.risk-level-name {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.2rem 0.35rem;
  color: var(--ops-text-2);
  background: color-mix(in srgb, var(--ops-unknown) 7%, transparent);
  font-size: 0.625rem;
  font-weight: 600;
}

.risk-level-name--error { border-color: color-mix(in srgb, var(--ops-error) 30%, transparent); color: var(--ops-error); background: color-mix(in srgb, var(--ops-error) 8%, transparent); }
.risk-level-name--warning { border-color: color-mix(in srgb, var(--ops-warning) 30%, transparent); color: var(--ops-warning); background: color-mix(in srgb, var(--ops-warning) 8%, transparent); }

.risk-level-row strong {
  color: var(--ops-text-1);
  font-family: var(--ops-mono);
  font-size: 0.75rem;
}

.risk-level-row__track {
  height: 0.4rem;
  margin-top: 0.6rem;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--ops-unknown) 10%, transparent);
}

.risk-level-row__track i { display: block; height: 100%; border-radius: 3px; }
.risk-level-row__track--error { background: var(--ops-error); }
.risk-level-row__track--warning { background: var(--ops-warning); }

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
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13.5rem), 1fr));
  gap: 0.75rem;
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

.diagnostic-raw-details {
  border-top: 1px solid var(--ops-line);
  padding-top: 0.75rem;
}

.diagnostic-raw-details summary {
  color: var(--ops-text-2);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
}

.diagnostic-raw-details pre {
  max-height: 20rem;
  margin: 0.75rem 0 0;
  overflow: auto;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
  padding: 0.75rem;
  background: var(--ops-control, #0e1217);
  color: var(--ops-text-2);
  font: 0.6875rem/1.6 var(--ops-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
  min-height: 17rem;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(39 39 42);
  border-radius: 8px;
  background: rgb(24 24 27 / 0.44);
}

:deep(.dependency-card .ops-panel__header) {
  display: grid;
  min-height: 3.25rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 0.3rem;
}

:deep(.dependency-card .ops-panel__heading h3) {
  line-height: 1.35;
  overflow-wrap: normal;
  word-break: keep-all;
}

:deep(.dependency-card .ops-panel__updated) {
  font-family: var(--ops-mono);
  font-size: 0.625rem;
}

:deep(.dependency-card .ops-panel__actions) {
  justify-content: flex-start;
  padding-left: 1rem;
}

:deep(.dependency-card .ops-panel__body) {
  display: flex;
  min-height: 13.5rem;
  flex: 1;
  flex-direction: column;
  padding: 0;
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
  display: grid;
  min-height: 3.4rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  padding: 0.7rem 0.8rem;
}

.dependency-card__status span {
  color: var(--ops-text-2);
  font-size: 0.6875rem;
  font-weight: 500;
}

.dependency-card__status--ok strong { color: var(--ops-ok); }
.dependency-card__status--warning strong { color: var(--ops-warning); }
.dependency-card__status--error strong { color: var(--ops-error); }
.dependency-card__status--unknown strong { color: var(--ops-unknown); }

.dependency-card__status strong {
  color: var(--ops-text-1);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.25;
}

.dependency-status-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: rgb(82 82 91);
  box-shadow: 0 0 0 3px rgb(82 82 91 / 0.1);
}

.dependency-card dl {
  display: grid;
  margin-top: auto;
  margin-bottom: 0;
  border-top: 1px solid rgb(39 39 42 / 0.75);
}

.dependency-card dt.dependency-card__group-label {
  display: block;
  padding: 0.55rem 0.8rem 0.3rem;
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  color: var(--ops-text-3);
  font-size: 0.6rem;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.dependency-card dt.dependency-card__group-label:first-child { border-top: 0; }

.dependency-card dl > div {
  display: grid;
  min-height: 2.35rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.8rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.55);
}

.dependency-card dl > div:last-child {
  border-bottom: 0;
}

.dependency-card dt,
.dependency-card dd {
  margin: 0;
  color: var(--ops-text-2);
  font-family: inherit;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.35;
}

.dependency-card dd {
  color: var(--ops-text-1);
  font-family: var(--ops-mono);
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
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
  position: relative;
  height: 2rem;
  cursor: help;
  border-radius: 2px;
  background: rgb(63 63 70);
}
.uptime-strip__slot::after { position: absolute; bottom: calc(100% + .45rem); left: 50%; z-index: 4; width: max-content; max-width: 15rem; transform: translate(-50%, .2rem); border: 1px solid var(--ops-line); border-radius: 4px; padding: .4rem .5rem; color: var(--ops-text-1); background: var(--ops-panel); content: attr(data-tooltip); font-size: .64rem; line-height: 1.45; white-space: pre-line; pointer-events: none; opacity: 0; transition: opacity .12s ease, transform .12s ease; }
.uptime-strip__slot:hover::after, .uptime-strip__slot:focus-visible::after { transform: translate(-50%, 0); opacity: 1; }

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

.ops-empty-copy { display: flex; min-height: 4.25rem; align-items: center; justify-content: center; padding: .8rem; color: var(--ops-text-2); font-size: .72rem; text-align: center; }
.ops-empty-panel { border: 1px solid var(--ops-line); border-radius: 6px; padding: .8rem .9rem; background: var(--ops-panel); }
.ops-empty-panel h3 { margin: 0; color: var(--ops-text-1); font-size: .8rem; font-weight: 600; }
.ops-empty-panel p { margin: .25rem 0 0; color: var(--ops-text-3); font-size: .7rem; }
.ops-empty-panel .ops-empty-copy { min-height: 3rem; padding: .55rem 0 0; }

/* 运维看板统一状态令牌与顶部状态脊。 */
.operations-dashboard {
  --ops-ok: #34d399;
  --ops-warning: #fbbf24;
  --ops-error: #fb7185;
  --ops-unknown: #94a3b8;
  --ops-info: #22d3ee;
  --ops-text-1: #e5e7eb;
  --ops-text-2: #94a3b8;
  --ops-text-3: #94a3b8;
  --ops-panel: #11151b;
  --ops-line: rgba(148, 163, 184, .12);
  --ops-line-strong: rgba(34, 211, 238, .5);
  position: relative;
  color: var(--ops-text-1);
}

.ops-status-spine {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: .75rem;
  overflow: hidden;
  border: 1px solid var(--ops-line-strong);
  border-radius: 6px;
  background: var(--ops-panel);
  padding: .65rem .75rem;
}

.ops-status-spine__summary { display: flex; min-width: 0; align-items: flex-start; gap: .8rem; }
.ops-status-spine__dot { width: .65rem; height: .65rem; flex: 0 0 auto; margin-top: .55rem; border-radius: 50%; background: var(--ops-unknown); }
.ops-status-spine__dot--ok { background: var(--ops-ok); }
.ops-status-spine__dot--warning { background: var(--ops-warning); }
.ops-status-spine__dot--error { background: var(--ops-error); box-shadow: none; }
.ops-status-spine__eyebrow { margin: 0 0 .25rem; color: var(--ops-text-3); font-size: .65rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.ops-status-spine__headline { margin: 0; font-family: var(--ops-mono); font-size: 1rem; font-weight: 650; letter-spacing: 0; line-height: 1.2; }
.ops-status-spine__meta { margin: .18rem 0 0; overflow: hidden; color: var(--ops-text-2); font-family: var(--ops-mono); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.ops-status-spine__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--ops-line); border-radius: 4px; }
.ops-status-count { min-width: 0; padding: .6rem .7rem; border-right: 1px solid var(--ops-line); }
.ops-status-count:last-child { border-right: 0; }
.ops-status-count span { display: block; overflow: hidden; color: var(--ops-text-3); font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }
.ops-status-count strong { display: block; margin-top: .28rem; color: var(--ops-text-1); font-family: var(--ops-mono); font-size: .95rem; font-weight: 650; }
.ops-status-count--error strong { color: var(--ops-error); }.ops-status-count--warning strong { color: var(--ops-warning); }
.ops-status-spine__actions { display: flex; flex-wrap: wrap; align-items: center; gap: .55rem; }
.ops-status-spine__updated { color: var(--ops-text-2); font-family: var(--ops-mono); font-size: .68rem; white-space: nowrap; }
.auto-refresh-toggle { display: inline-flex; height: 1.875rem; align-items: center; gap: .45rem; border: 1px solid var(--ops-line); border-radius: 6px; padding: 0 .65rem; color: var(--ops-text-1); background: #0e1217; font-size: .7rem; cursor: pointer; }
.auto-refresh-toggle:hover { border-color: rgba(34, 211, 238, .5); }
.ops-refresh-interval { flex: 0 0 auto; }
:deep(.ops-refresh-interval > div) { height: 1.875rem; min-height: 1.875rem; border-color: var(--ops-line); border-radius: 6px; padding: 0 .55rem; background: #0e1217; }
:deep(.ops-refresh-interval > div:hover),
:deep(.ops-refresh-interval > div.bg-blue-600\/5) { border-color: rgba(34, 211, 238, .5); background: #0e1217; }
:deep(.ops-refresh-interval > div > div > span:last-child) { color: var(--ops-text-1); }
:deep(.ops-refresh-interval > div > div:last-child svg) { color: var(--ops-text-2); opacity: .9; }
:deep(.ops-refresh-interval > div:hover > div:last-child svg),
:deep(.ops-refresh-interval > div.bg-blue-600\/5 > div:last-child svg) { color: var(--ops-info); opacity: 1; }
:deep(.ops-refresh-interval > div.opacity-50) { cursor: not-allowed; border-color: var(--ops-line); }
.auto-refresh-toggle > span { width: .45rem; height: .45rem; border-radius: 50%; background: var(--ops-unknown); }.auto-refresh-toggle > span.is-enabled { background: var(--ops-info); }
.ops-status-spine__countdown { position: absolute; bottom: 0; left: 0; display: block; height: 2px; max-width: 100%; background: var(--ops-info); opacity: .85; pointer-events: none; transition: width .8s linear; }
.ops-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.ops-toolbar__hint { color: var(--ops-text-3); font-family: var(--ops-mono); font-size: .67rem; }

.ops-key-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .75rem; }
.ops-key-metric { position: relative; min-height: 6.15rem; overflow: hidden; border: 1px solid var(--ops-line); border-left: 3px solid var(--ops-unknown); border-radius: 5px; background: var(--ops-panel); padding: .8rem; }
.ops-key-metric--ok { border-left-color: var(--ops-ok); }.ops-key-metric--warning { border-left-color: var(--ops-warning); }.ops-key-metric--error { border-left-color: var(--ops-error); }
.ops-key-metric > span { display: block; color: var(--ops-text-3); font-size: .63rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.ops-key-metric strong { display: block; margin-top: .45rem; color: var(--ops-text-1); font-family: var(--ops-mono); font-size: 1.4rem; font-weight: 650; line-height: 1; }
.ops-key-metric--ok strong { color: var(--ops-ok); }.ops-key-metric--warning strong { color: var(--ops-warning); }.ops-key-metric--error strong { color: var(--ops-error); }
.ops-key-metric small { margin-left: .2rem; color: var(--ops-text-3); font-size: .62em; font-weight: 500; }
.ops-key-metric p { margin: .5rem 0 0; overflow: hidden; color: var(--ops-text-3); font-size: .64rem; text-overflow: ellipsis; white-space: nowrap; }
.ops-key-metric__meter { position: absolute; right: .8rem; bottom: .65rem; left: .8rem; height: 4px; overflow: hidden; border-radius: 2px; background: rgba(148, 163, 184, .13); }.ops-key-metric__meter b { display: block; height: 100%; background: currentColor; transition: width .35s ease; }.ops-key-metric--ok .ops-key-metric__meter { color: var(--ops-ok); }.ops-key-metric--warning .ops-key-metric__meter { color: var(--ops-warning); }.ops-key-metric--error .ops-key-metric__meter { color: var(--ops-error); }

.ops-module-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .75rem; }.ops-module-summary__value { font-family: var(--ops-mono); font-size: 1.3rem; font-weight: 650; line-height: 1.1; }.ops-module-summary p { margin: .6rem 0 0; color: var(--ops-text-3); font-size: .67rem; line-height: 1.5; }
.ops-tone--ok { color: var(--ops-ok); }.ops-tone--warning { color: var(--ops-warning); }.ops-tone--error { color: var(--ops-error); }.ops-tone--unknown { color: var(--ops-text-2); }
.ops-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .65rem; }
.ops-metric-item { display: flex; min-height: 6.2rem; flex-direction: column; gap: .45rem; border: 1px solid var(--ops-line); border-radius: 4px; padding: .8rem; background: #0e1217; }
.ops-metric-item--overview { min-height: 5.7rem; }
.ops-metric-item__head { display: flex; align-items: center; gap: .5rem; }
.ops-metric-item__label { color: var(--ops-text-3); font-size: .66rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.ops-metric-item__value { color: var(--ops-text-1); font-family: var(--ops-mono); font-size: 1.15rem; font-weight: 650; line-height: 1.15; }
.ops-metric-item__detail { margin: 0; color: var(--ops-text-3); font-size: .66rem; line-height: 1.55; }
.ops-memory-rows { display: grid; margin-top: .1rem; border-top: 1px solid rgba(148, 163, 184, .08); }
.ops-memory-row { display: flex; min-height: 1.65rem; align-items: center; justify-content: space-between; gap: .75rem; border-bottom: 1px solid rgba(148, 163, 184, .08); }
.ops-memory-row:last-child { border-bottom: 0; }
.ops-memory-row span { color: #94a3b8; font-size: .6875rem; }
.ops-memory-row strong { color: #f8fafc; font-family: var(--ops-mono); font-size: .6875rem; font-weight: 600; text-align: right; white-space: nowrap; }
.ops-unknown-note { margin: .8rem 0 0; color: var(--ops-text-3); font-size: .65rem; line-height: 1.45; }

/* 保留既有结构，统一其视觉外壳，避免各分区各自定义卡片。 */
.panel, .signal-card, .metric-card, .deployment-mode-card, .dependency-card, .server-summary-strip { border-color: var(--ops-line); border-radius: 6px; background: var(--ops-panel); box-shadow: none; }
.panel:hover, .signal-card:hover, .metric-card:hover, .deployment-mode-card:hover, .service-row:hover { border-color: var(--ops-line-strong); background: var(--ops-panel); box-shadow: none; transform: none; }
.metric-icon, .service-row__icon, .title-icon { color: var(--ops-text-3); border-color: var(--ops-line); background: transparent; }
.metric-card:nth-child(n) { --metric-accent: var(--ops-text-2); }.metric-card .metric-icon { color: var(--ops-text-3); border-color: var(--ops-line); background: transparent; }.metric-card .metric-value { color: var(--ops-text-1); }
.panel-title { color: var(--ops-text-1); }.panel-description, .metric-detail, .metric-label { color: var(--ops-text-3); }
.status-badge { border-color: var(--ops-line); color: var(--ops-text-2); background: transparent; }
.log-level-filter { display: inline-flex; height: 2.25rem; overflow: hidden; border: 1px solid var(--ops-line); border-radius: 4px; }.log-level-filter button { border: 0; border-right: 1px solid var(--ops-line); padding: 0 .5rem; color: var(--ops-text-3); background: transparent; font-size: .65rem; cursor: pointer; }.log-level-filter button:last-child { border-right: 0; }.log-level-filter button.is-active { color: var(--ops-text-1); background: rgba(148, 163, 184, .08); }.log-level-filter button.is-error.is-active { color: var(--ops-error); }.log-level-filter button.is-warn.is-active { color: var(--ops-warning); }
.log-result-row { max-height: 2.85rem; }.log-result-row td:last-child { max-width: 25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.log-result-row:has(.log-level--error) { background: color-mix(in srgb, var(--ops-error) 5%, transparent); }
.log-level--info { color: var(--ops-text-2); background: rgba(148, 163, 184, .12); }
.duration-value { display: inline-flex; border-radius: 3px; padding: .17rem .36rem; font-family: var(--ops-mono); font-size: .67rem; }.duration-value--ok { color: var(--ops-ok); background: color-mix(in srgb, var(--ops-ok) 10%, transparent); }.duration-value--warning { color: var(--ops-warning); background: color-mix(in srgb, var(--ops-warning) 10%, transparent); }.duration-value--error { color: var(--ops-error); background: color-mix(in srgb, var(--ops-error) 10%, transparent); }.request-row--error { background: color-mix(in srgb, var(--ops-error) 5%, transparent); }
.diagnostic-duration-summary { display: flex; min-height: 10rem; flex-direction: column; justify-content: center; padding: 1.25rem; }.diagnostic-duration-summary strong { color: var(--ops-text-1); font-family: var(--ops-mono); font-size: 1.7rem; }.diagnostic-duration-summary span { margin-top: .5rem; color: var(--ops-text-2); font-size: .72rem; }.diagnostic-duration-summary p { margin: 1rem 0 0; color: var(--ops-text-3); font-size: .67rem; line-height: 1.6; }
.dependency-card--ok { border-left: 3px solid var(--ops-ok); }.dependency-card--warning { border-left: 3px solid var(--ops-warning); }.dependency-card--error { border-left: 3px solid var(--ops-error); }.dependency-card--unknown { border-left: 3px solid var(--ops-unknown); }.dependency-status-dot--ok { background: var(--ops-ok); }.dependency-status-dot--warning { background: var(--ops-warning); }.dependency-status-dot--error { background: var(--ops-error); }.dependency-card__observed, .dependency-card__failure { margin: 0; padding: 0 .8rem .55rem; color: var(--ops-text-3); font-size: .62rem; }.dependency-card__failure { display: -webkit-box; overflow: hidden; color: var(--ops-error); overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }

/* 旧详情面板沿用统一数据中心外壳，不改变其内容结构。 */
.panel,
.signal-card,
.metric-card,
.deployment-mode-card,
.dependency-card,
.server-summary-strip {
  background: #11151b;
  border-color: rgba(148, 163, 184, 0.12);
  border-radius: 6px;
  box-shadow: none;
}

.panel { padding: .875rem; }
.panel-header { min-height: 3.25rem; border-bottom-color: rgba(148, 163, 184, 0.08); padding: .75rem .875rem; }
.panel-title { color: #e5e7eb; font-size: .8125rem; font-weight: 600; }
.panel-description,
.metric-detail,
.metric-label,
.empty-cell { color: #94a3b8; }
.status-badge { border-color: rgba(148, 163, 184, 0.12); border-radius: 6px; color: #94a3b8; background: #0e1217; }
.status-badge--ok { border-color: color-mix(in srgb, var(--ops-ok) 30%, transparent); color: var(--ops-ok); background: color-mix(in srgb, var(--ops-ok) 8%, #0e1217); }
.status-badge--warning { border-color: color-mix(in srgb, var(--ops-warning) 30%, transparent); color: var(--ops-warning); background: color-mix(in srgb, var(--ops-warning) 8%, #0e1217); }
.status-badge--error { border-color: color-mix(in srgb, var(--ops-error) 30%, transparent); color: var(--ops-error); background: color-mix(in srgb, var(--ops-error) 8%, #0e1217); }
.status-badge--unknown { border-color: var(--ops-line); color: var(--ops-unknown); background: #0e1217; }
.operations-loading-state,
.empty-progress,
.histogram-placeholder,
.operations-loading-state__spinner,
.icon-spin { animation: none; }
.health-score-ring,
.dependency-status-dot { box-shadow: none; }
.dependency-status-dot { width: .4375rem; height: .4375rem; }
.log-level--error { color: var(--ops-error); background: color-mix(in srgb, var(--ops-error) 10%, transparent); }
.log-level--warn { color: var(--ops-warning); background: color-mix(in srgb, var(--ops-warning) 10%, transparent); }
.uptime-strip__slot--up { background: color-mix(in srgb, var(--ops-ok) 72%, transparent); }
.uptime-strip__slot--degraded { background: color-mix(in srgb, var(--ops-warning) 72%, transparent); }
.uptime-strip__slot--down { background: color-mix(in srgb, var(--ops-error) 72%, transparent); }
.uptime-strip__slot--unknown { background: color-mix(in srgb, var(--ops-unknown) 72%, transparent); }
.diagnosis-result { border-color: var(--ops-line); color: var(--ops-text-1); background: var(--ops-control); }
.diagnosis-result span { color: var(--ops-text-2); }
.table-action,
.request-id-shortcut button,
.log-level-filter,
.log-level-filter button { border-color: rgba(148, 163, 184, 0.12); border-radius: 6px; color: #e5e7eb; background: #0e1217; }
.table-action:hover,
.request-id-shortcut:focus-within,
.log-level-filter button:hover { border-color: rgba(34, 211, 238, 0.5); }

.ops-time-chart { position: relative; min-height: 14.5rem; padding: .65rem .35rem .35rem 2.85rem; }
.ops-time-chart__y-axis { position: absolute; top: .65rem; bottom: 1.75rem; left: 0; display: flex; width: 2.45rem; flex-direction: column; justify-content: space-between; color: #94a3b8; font-family: var(--ops-mono); font-size: .6875rem; font-weight: 500; text-align: right; }
.ops-time-chart__plot { position: relative; height: 12rem; border-bottom: 1px solid rgba(148, 163, 184, .2); background: rgba(148, 163, 184, .018); }
.ops-time-chart__grid { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
.ops-time-chart__grid i { display: block; border-top: 1px dashed rgba(148, 163, 184, .13); }
.ops-time-chart__bars { position: absolute; inset: 0; display: grid; grid-auto-columns: minmax(2px, 1fr); grid-auto-flow: column; align-items: end; gap: clamp(.18rem, .6vw, .42rem); padding: 0 .35rem; }
.ops-time-chart__bars i { position: relative; display: block; width: 2px; min-height: 1px; justify-self: center; overflow: visible; border: 0; border-left: 2px solid rgba(56, 189, 248, .58); border-radius: 0; background: transparent; cursor: crosshair; transform-origin: bottom center; transition: opacity .14s ease, border-color .14s ease, transform .14s ease; }
.ops-time-chart__bars i::after { position: absolute; top: -3px; left: 50%; width: 7px; height: 7px; border: 1px solid #38bdf8; border-radius: 50%; background: #11151b; content: ''; transform: translateX(-50%); }
.ops-time-chart__bars:has(i:hover) i:not(:hover) { opacity: .38; }
.ops-time-chart__bars i:hover { z-index: 1; border-color: rgba(34, 211, 238, .95); transform: translateY(-2px) scaleX(1.04); }
.ops-time-chart__guide { position: absolute; top: 0; bottom: 0; z-index: 2; border-left: 1px dashed rgba(34, 211, 238, .72); pointer-events: none; }
.ops-chart-tooltip { position: absolute; top: .45rem; z-index: 3; min-width: 10rem; transform: translateX(-50%); border: 1px solid rgba(34, 211, 238, .28); border-radius: 6px; padding: .55rem .65rem; background: #11151b; color: #e5e7eb; box-shadow: 0 8px 20px rgba(0, 0, 0, .22); pointer-events: none; }
.ops-chart-tooltip time { display: block; margin-bottom: .35rem; color: #94a3b8; font-size: .6875rem; }
.ops-chart-tooltip dl,
.ops-chart-tooltip dl div { margin: 0; }
.ops-chart-tooltip dl div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .8rem; align-items: center; }
.ops-chart-tooltip dt { overflow: hidden; color: #94a3b8; font-size: .6875rem; text-overflow: ellipsis; white-space: nowrap; }
.ops-chart-tooltip dd { margin: 0; color: #f8fafc; font-family: var(--ops-mono); font-size: .75rem; font-weight: 700; text-align: right; white-space: nowrap; }
.ops-time-chart__x-axis { display: flex; justify-content: space-between; margin-top: .5rem; color: #94a3b8; font-family: var(--ops-mono); font-size: .6875rem; }

@media (min-width: 1024px) { .ops-status-spine { grid-template-columns: minmax(18rem, 1fr) auto; align-items: center; }.ops-status-spine__actions { justify-content: flex-end; } }
@media (prefers-reduced-motion: reduce) { .operations-dashboard *, .operations-dashboard *::before, .operations-dashboard *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }

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
    grid-template-columns: minmax(9rem, 0.8fr) minmax(0, 2fr);
  }

  .server-health-inspection {
    padding: 0.35rem 0 0 1rem;
  }

  .server-health-details {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    grid-template-columns: minmax(12rem, 0.8fr) minmax(0, 2fr);
  }

  .risk-summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
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

  .dependency-matrix { grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr)); }
}

.operation-log-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .55rem; margin-bottom: .875rem; }
.operation-log-filters .filter-field { min-width: 0; height: 1.875rem; padding: 0 .55rem; border-color: var(--ops-line); border-radius: 6px; background: #0e1217; }
.operation-log-filters .filter-field > span { flex: 0 0 auto; color: var(--ops-text-3); font-size: .65rem; }
.operation-log-filters .filter-field input { min-width: 0; color: var(--ops-text-1); font-family: var(--ops-mono); font-size: .68rem; background: transparent; }
.operation-log-filters .filter-field input::-webkit-calendar-picker-indicator { opacity: .55; }
.operation-log-filters .filter-action { height: 1.875rem; justify-content: center; border-radius: 6px; }
:deep(.operation-log-select > div) { min-height: 1.875rem; height: 1.875rem; border-color: var(--ops-line); border-radius: 6px; padding: 0 .55rem; background: #0e1217; }
:deep(.operation-log-select > div:hover), :deep(.operation-log-select > div.bg-blue-600\/5) { border-color: rgba(34, 211, 238, .5); background: #0e1217; }
:deep(.operation-log-select > div > div > span:last-child) { color: var(--ops-text-1); font-size: .68rem; }
.operation-log-state { display: flex; min-height: 8rem; align-items: center; justify-content: center; gap: .5rem; color: var(--ops-text-2); font-size: .75rem; }
.operation-log-state--error { color: var(--ops-error); }
.operation-log-skeleton { display: grid; gap: .5rem; }
.operation-log-skeleton i { display: block; height: 2.5rem; border-radius: 3px; background: rgba(148, 163, 184, .08); }
.operation-log-skeleton i:nth-child(2n) { width: 82%; }
.operation-log-row { cursor: pointer; }
.operation-log-row:hover, .operation-log-row--expanded { background: rgba(148, 163, 184, .06); }
.operation-log-actor { display: grid; gap: .15rem; }
.operation-log-actor strong { color: var(--ops-text-1); font-size: .72rem; font-weight: 600; }
.operation-log-actor small { color: var(--ops-text-3); font-family: var(--ops-mono); font-size: .62rem; }
.operation-log-result { display: inline-flex; border-radius: 3px; padding: .18rem .38rem; font-size: .65rem; font-weight: 600; }
.operation-log-result--success { color: var(--ops-ok); background: color-mix(in srgb, var(--ops-ok) 10%, transparent); }
.operation-log-result--failure { color: var(--ops-error); background: color-mix(in srgb, var(--ops-error) 10%, transparent); }
.operation-log-detail-row td { padding: 0; background: #0e1217; }
.operation-log-detail-grid { display: grid; grid-template-columns: minmax(12rem, .7fr) minmax(0, 1.3fr); gap: 1rem; padding: .8rem .95rem; border-top: 1px solid var(--ops-line); }
.operation-log-detail-grid dl { display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: start; gap: .5rem .75rem; margin: 0; }
.operation-log-detail-grid dt { color: var(--ops-text-3); font-size: .68rem; }
.operation-log-detail-grid dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: var(--ops-text-1); font-size: .7rem; }
.operation-log-detail-grid strong { color: var(--ops-text-2); font-size: .68rem; font-weight: 600; }
.operation-log-detail-grid pre { max-height: 14rem; margin: .45rem 0 0; overflow: auto; border: 1px solid var(--ops-line); border-radius: 4px; padding: .6rem; color: var(--ops-text-2); font-family: var(--ops-mono); font-size: .65rem; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.operation-log-detail-state { display: flex; min-height: 4.5rem; align-items: center; justify-content: center; gap: .55rem; color: var(--ops-text-2); font-size: .72rem; }
.operation-log-detail-state--error { color: var(--ops-error); }
.operation-log-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .65rem; margin-top: .75rem; color: var(--ops-text-3); font-family: var(--ops-mono); font-size: .68rem; }
.operation-log-pagination > div { display: flex; gap: .45rem; }
.monitoring-reference { overflow: hidden; border: 1px solid var(--ops-line); border-radius: 6px; color: var(--ops-text-2); background: var(--ops-control); }
.monitoring-reference summary { display: flex; min-height: 2.75rem; cursor: pointer; align-items: center; gap: .65rem; padding: .55rem .75rem; font-size: .75rem; }
.monitoring-reference summary::marker { color: var(--ops-text-3); }
.monitoring-reference summary span { color: var(--ops-text-1); font-weight: 600; }
.monitoring-reference summary small { color: var(--ops-text-3); font-size: .68rem; }
.monitoring-reference__content { border-top: 1px solid var(--ops-line); }
@media (min-width: 1280px) { .operation-log-filters { grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(13rem, 1.3fr) auto; }.operation-log-filters .filter-field--wide { grid-column: span 2; } }
@media (max-width: 640px) { .operation-log-detail-grid { grid-template-columns: 1fr; }.operation-log-filters .filter-field--wide { min-width: 100%; } }

/* ===== 可访问性：键盘聚焦可展开行的高亮反馈 ===== */
.log-result-row:focus-visible td, .operation-log-row:focus-visible td { background: color-mix(in srgb, var(--ops-info) 8%, transparent); }
.log-result-row:focus-visible, .operation-log-row:focus-visible { outline: none; }

/* ===== 视觉精修层：统一质感、状态氛围与反馈动效，不改结构 ===== */
/* 修复：--ops-control 被多处引用但从未定义，导航分组标签与参考表背景失效 */
.operations-dashboard {
  --ops-control: #0d1218;
  --ops-radius: 8px;
  --spine-accent: var(--ops-unknown);
}
.operations-dashboard[data-health="ok"] { --spine-accent: var(--ops-ok); }
.operations-dashboard[data-health="warning"] { --spine-accent: var(--ops-warning); }
.operations-dashboard[data-health="error"] { --spine-accent: var(--ops-error); }

@keyframes ops-spin { to { transform: rotate(360deg); } }
@keyframes ops-dot-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--spine-accent) 45%, transparent); }
  100% { box-shadow: 0 0 0 8px transparent; }
}

/* 顶部状态脊：随整体健康度着色 */
.ops-status-spine {
  border-color: color-mix(in srgb, var(--spine-accent) 34%, var(--ops-line));
  border-radius: 10px;
  background: radial-gradient(130% 130% at 0% 0%, color-mix(in srgb, var(--spine-accent) 10%, transparent), transparent 58%), var(--ops-panel);
  padding: .85rem 1rem;
}
.ops-status-spine__dot { animation: ops-dot-pulse 2.4s ease-out infinite; }
.operations-dashboard[data-health="ok"] .ops-status-spine__dot { animation: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ops-ok) 16%, transparent); }
.ops-status-spine__headline { font-family: inherit; font-size: 1.05rem; font-weight: 700; }
.ops-status-spine__countdown { background: linear-gradient(90deg, color-mix(in srgb, var(--ops-info) 25%, transparent), var(--ops-info)); box-shadow: 0 0 8px color-mix(in srgb, var(--ops-info) 55%, transparent); }

/* 刷新主按钮强调色 */
.refresh-button { border-color: color-mix(in srgb, var(--ops-info) 30%, transparent); color: var(--ops-info); background: color-mix(in srgb, var(--ops-info) 9%, #0e1217); }
.refresh-button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--ops-info) 60%, transparent); background: color-mix(in srgb, var(--ops-info) 15%, #0e1217); }
.auto-refresh-toggle > span.is-enabled { box-shadow: 0 0 6px color-mix(in srgb, var(--ops-info) 70%, transparent); }

/* 恢复加载/刷新旋转反馈（此前 animation:none 导致加载无反馈；reduced-motion 用户仍由上方媒体查询压制） */
.icon-spin,
.operations-loading-state__spinner { animation: ops-spin .9s linear infinite; }

/* 分组导航 */
.group-navigation { border-radius: var(--ops-radius); }
.group-tab--active { background: color-mix(in srgb, var(--ops-info) 8%, transparent); }
.group-tab__status--ok { box-shadow: 0 0 5px color-mix(in srgb, var(--ops-ok) 55%, transparent); }
.group-tab__status--warning { box-shadow: 0 0 5px color-mix(in srgb, var(--ops-warning) 55%, transparent); }
.group-tab__status--error { box-shadow: 0 0 5px color-mix(in srgb, var(--ops-error) 55%, transparent); }

/* 卡片质感：细腻阴影 + 顶部高光，hover 轻微浮起 */
.panel,
.signal-card,
.metric-card,
.deployment-mode-card,
.dependency-card,
.server-summary-strip,
.operations-loading-state,
.group-navigation,
.monitoring-reference,
.ops-empty-panel {
  border-color: rgba(148, 163, 184, .13);
  border-radius: var(--ops-radius);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .3), inset 0 1px 0 rgba(148, 163, 184, .05);
}
.panel:hover,
.signal-card:hover,
.metric-card:hover,
.deployment-mode-card:hover,
.service-row:hover {
  border-color: color-mix(in srgb, var(--ops-info) 32%, var(--ops-line));
  box-shadow: 0 6px 18px rgba(0, 0, 0, .32), inset 0 1px 0 rgba(148, 163, 184, .06);
  transform: translateY(-1px);
}

/* 指标小卡与内部块统一质感 */
.ops-metric-item { border-radius: var(--ops-radius); background: #0d1117; transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease; }
.ops-metric-item:hover { border-color: color-mix(in srgb, var(--ops-info) 30%, transparent); box-shadow: 0 4px 14px rgba(0, 0, 0, .3); transform: translateY(-1px); }
.server-health-details > div,
.server-health-inspection__note,
.risk-summary-grid > div,
.risk-level-row,
.risk-levels__empty,
.server-health-score,
.risk-total { border-radius: 6px; }

/* 状态徽章胶囊化 */
.status-badge { border-radius: 999px; padding: .22rem .6rem; font-weight: 650; letter-spacing: .01em; }

/* 表格行 hover 反馈 */
.data-table thead { background: rgba(148, 163, 184, .04); }
.data-table tbody tr { transition: background-color .12s ease; }
.data-table tbody tr:hover td { background: rgba(148,163,184,.04); }
.log-result-row, .operation-log-row { cursor: pointer; }

/* 图表柱子渐变填充 */
.ops-time-chart__bars i { background: transparent; }
.ops-time-chart__bars i:hover { background: transparent; }
</style>
