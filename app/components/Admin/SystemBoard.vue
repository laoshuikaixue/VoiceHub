<template>
  <div class="max-w-[1200px] mx-auto space-y-8 pb-20 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary font-medium">{{ locale.desc }}</p>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-[11px] text-text-disabled font-medium">
          {{ locale.lastUpdated(lastRefreshText) }}
        </span>
        <button
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all',
            autoRefresh
              ? 'bg-primary-10 text-primary border-primary-20'
              : 'bg-bg-primary-40 text-text-tertiary border-border-secondary hover:text-text-primary'
          ]"
          @click="toggleAutoRefresh"
        >
          <Timer :size="14" />
          {{ locale.autoRefresh }}
        </button>
        <button
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-primary-40 border border-border-secondary text-text-tertiary hover:text-text-primary hover:border-border-tertiary transition-all disabled:opacity-50"
          :disabled="loading"
          @click="loadAll"
        >
          <RefreshCw :size="14" :class="loading ? 'animate-spin' : ''" />
          {{ locale.refresh }}
        </button>
      </div>
    </div>

    <div v-if="loadError" class="flex items-start gap-3 p-4 rounded-2xl bg-error-10 border border-error-20 text-error text-xs font-medium">
      <AlertCircle :size="16" class="shrink-0 mt-0.5" />
      <span>{{ loadError }}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 进程运行状态 -->
      <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-5">
        <header class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <Cpu :size="16" class="text-primary" /> {{ locale.processTitle }}
          </h3>
          <span
            :class="[
              'px-2.5 py-1 text-[10px] font-black uppercase rounded-full border',
              processState.ok
                ? 'bg-success-10 text-success border-success-20'
                : 'bg-warning-10 text-warning border-warning-20'
            ]"
          >
            {{ processState.text }}
          </span>
        </header>

        <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
          <div v-for="(row, index) in processRows" :key="index" class="min-w-0">
            <dt class="text-[10px] font-semibold uppercase tracking-wider text-text-disabled">{{ row.label }}</dt>
            <dd class="text-xs font-bold text-text-primary truncate" :title="row.value">{{ row.value }}</dd>
          </div>
        </dl>

        <div class="space-y-2 pt-2 border-t border-border-secondary">
          <div v-for="(item, index) in memoryRows" :key="index" class="flex items-center justify-between">
            <span class="text-[11px] text-text-tertiary font-medium">{{ item.label }}</span>
            <span class="text-[11px] font-bold text-text-primary">{{ item.value }}</span>
          </div>
        </div>
      </section>

      <!-- 数据库状态 -->
      <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-5">
        <header class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <Database :size="16" class="text-success" /> {{ locale.databaseTitle }}
          </h3>
          <span
            :class="[
              'px-2.5 py-1 text-[10px] font-black uppercase rounded-full border',
              database?.connected
                ? 'bg-success-10 text-success border-success-20'
                : 'bg-error-10 text-error border-error-20'
            ]"
          >
            {{ database?.connected ? locale.connected : locale.disconnected }}
          </span>
        </header>

        <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
          <div v-for="(row, index) in databaseRows" :key="index" class="min-w-0">
            <dt class="text-[10px] font-semibold uppercase tracking-wider text-text-disabled">{{ row.label }}</dt>
            <dd class="text-xs font-bold text-text-primary truncate" :title="row.value">{{ row.value }}</dd>
          </div>
        </dl>

        <div v-if="database?.pool" class="space-y-1.5 pt-2 border-t border-border-secondary">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-text-tertiary font-medium">{{ locale.poolUsage }}</span>
            <span class="font-bold text-text-primary">
              {{ locale.poolValue(database.pool.totalConnections, database.pool.maxConnections) }}
            </span>
          </div>
          <div class="h-1.5 rounded-full bg-bg-quaternary overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="poolUtilization > 80 ? 'bg-error' : 'bg-primary'"
              :style="{ width: `${Math.min(poolUtilization, 100)}%` }"
            />
          </div>
        </div>

        <p v-if="database?.error" class="text-[11px] text-error break-all leading-relaxed">
          {{ database.error }}
        </p>
      </section>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 表规模 -->
      <section class="lg:col-span-5 bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-4">
        <header class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <Table2 :size="16" class="text-warning" /> {{ locale.tablesTitle }}
          </h3>
          <span class="text-[11px] text-text-tertiary font-medium">
            {{ locale.tablesTotal(snapshot?.tables?.totalTables ?? 0, snapshot?.tables?.totalRows ?? 0) }}
          </span>
        </header>

        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            v-model="tableKeyword"
            type="text"
            :placeholder="locale.tablesSearch"
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-primary-40 border border-border-secondary text-xs text-text-primary placeholder-text-disabled focus:outline-none focus:border-border-tertiary"
          >
        </div>

        <div class="max-h-[320px] overflow-y-auto custom-scrollbar divide-y divide-border-secondary">
          <div v-if="!filteredTables.length" class="py-8 text-center text-xs text-text-disabled">
            {{ locale.tablesEmpty }}
          </div>
          <div
            v-for="table in filteredTables"
            :key="table.name"
            class="flex items-center justify-between py-2"
          >
            <span class="text-xs text-text-tertiary font-medium truncate" :title="table.name">{{ table.name }}</span>
            <span class="text-xs font-bold text-text-primary tabular-nums">{{ formatRows(table.rows) }}</span>
          </div>
        </div>
        <p class="text-[10px] text-text-disabled leading-relaxed">{{ locale.tablesHint }}</p>
      </section>

      <!-- 生效配置 -->
      <section class="lg:col-span-7 bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-4">
        <header class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <SlidersHorizontal :size="16" class="text-info" /> {{ locale.settingsTitle }}
          </h3>
          <span class="text-[11px] text-text-tertiary font-medium">
            {{ locale.settingsReadAt(snapshot?.system?.serverTimeAt || '-') }}
          </span>
        </header>

        <div v-if="!settings" class="py-8 text-center text-xs text-text-disabled">
          {{ locale.settingsEmpty }}
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
          <div
            v-for="(item, index) in settingRows"
            :key="index"
            class="flex items-center justify-between gap-2 py-1.5 min-w-0 border-b border-border-secondary last:border-0"
          >
            <span class="text-[11px] text-text-tertiary font-medium min-w-0 truncate" :title="item.label">{{ item.label }}</span>
            <span
              :class="[
                'text-[11px] font-bold text-right shrink-0 max-w-[60%] truncate',
                item.kind === 'on'
                  ? 'text-success'
                  : item.kind === 'off'
                    ? 'text-text-disabled'
                    : 'text-text-primary'
              ]"
              :title="item.value"
            >
              {{ item.value }}
            </span>
          </div>
        </div>
      </section>
    </div>

    <!-- 运行事件 -->
    <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <Activity :size="16" class="text-error" /> {{ locale.eventsTitle }}
          </h3>
          <span v-if="runtimeMeta" class="text-[10px] text-text-disabled font-medium">
            {{ locale.bufferUsage(runtimeMeta.size, runtimeMeta.bufferSize) }}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="w-[130px]">
            <CustomSelect v-model="eventLevel" :options="levelOptions" />
          </div>
          <div class="w-[150px]">
            <CustomSelect v-model="eventSource" :options="sourceOptions" />
          </div>
          <button
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-primary-40 border border-error-20 text-error hover:bg-error hover:text-text-primary transition-all disabled:opacity-50"
            :disabled="clearing"
            @click="clearRuntimeEvents"
          >
            <Trash2 :size="14" />
            {{ clearing ? locale.eventsClearing : locale.eventsClear }}
          </button>
        </div>
      </header>

      <p class="text-[10px] text-text-disabled leading-relaxed">{{ locale.eventsHint }}</p>
      <p v-if="eventsTruncated" class="text-[10px] text-warning font-medium leading-relaxed">
        {{ locale.eventsTruncated(eventQuery.limit) }}
      </p>

      <div class="max-h-[460px] overflow-y-auto custom-scrollbar space-y-1">
        <div v-if="!events.length && !eventsLoading" class="py-10 text-center text-xs text-text-disabled">
          {{ locale.eventsEmpty }}
        </div>
        <article
          v-for="item in events"
          :key="item.id"
          class="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-bg-primary-40 border border-border-secondary"
        >
          <span
            :class="[
              'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
              item.level === 'error' ? 'bg-error' : item.level === 'warn' ? 'bg-warning' : 'bg-success'
            ]"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[10px] font-mono text-text-disabled shrink-0">{{ item.at }}</span>
              <span class="text-[10px] font-black uppercase tracking-wider text-text-tertiary">
                {{ sourceLabel(item) }}
              </span>
              <span class="text-xs text-text-primary break-all leading-relaxed">{{ localizeEventMessage(item) }}</span>
            </div>
            <p v-if="item.detail" class="mt-1 text-[11px] text-text-tertiary break-all leading-relaxed">
              {{ item.detail }}
            </p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Activity,
  AlertCircle,
  Cpu,
  Database,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  Timer,
  Trash2
} from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import packageJson from '~~/package.json'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const REFRESH_INTERVAL_MS = 10_000

const auth = useAuth()
const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => useSafeLocale(admin.value?.systemBoard || {}))
const { localize } = useServerErrors()

const snapshot = ref(null)
const events = ref([])
const eventsTruncated = ref(false)
const runtimeMeta = ref(null)
const loading = ref(false)
const eventsLoading = ref(false)
const clearing = ref(false)
const snapshotError = ref('')
const eventsError = ref('')
const autoRefresh = ref(false)
const tableKeyword = ref('')
const eventLevel = ref('all')
const eventSource = ref('all')

const system = computed(() => snapshot.value?.system || null)
const database = computed(() => snapshot.value?.database || null)
const settings = computed(() => snapshot.value?.settings || null)
const lastRefreshText = computed(() => system.value?.serverTimeAt || '-')

const processState = computed(() => {
  if (snapshot.value) return { text: locale.value.running, ok: true }
  if (loading.value) return { text: locale.value.loadingLabel, ok: false }
  return { text: locale.value.unavailable, ok: false }
})

// 两条加载链路各自记录错误，避免慢的那条失败后被快的那条成功覆盖
const loadError = computed(() => [snapshotError.value, eventsError.value].filter(Boolean).join('；'))

const formatNumber = (value) => (Number.isFinite(value) ? value.toLocaleString() : '-')

const formatUptime = (seconds) => {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total < 0) return '-'
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (d > 0) return locale.value.uptimeDHM(d, h, m)
  if (h > 0) return locale.value.uptimeHM(h, m)
  return locale.value.uptimeM(m)
}

const yesNo = (value) => (value ? locale.value.on : locale.value.off)

const processRows = computed(() => {
  const current = system.value
  if (!current) return []
  return [
    { label: locale.value.uptime, value: formatUptime(current.uptimeSeconds) },
    { label: locale.value.startedAt, value: current.startedAt },
    { label: locale.value.nodeVersion, value: current.nodeVersion },
    { label: locale.value.platform, value: `${current.platform} / ${current.arch}` },
    { label: locale.value.appVersion, value: `v${packageJson.version}` },
    { label: locale.value.pid, value: String(current.pid) },
    { label: locale.value.env, value: current.env },
    { label: locale.value.telemetry, value: current.telemetryEnabled ? locale.value.on : locale.value.off },
    { label: locale.value.serverTime, value: current.serverTimeAt },
    { label: locale.value.instanceId, value: current.instanceId || '-' }
  ]
})

const memoryRows = computed(() => {
  const memory = system.value?.memory
  if (!memory) return []
  return [
    { label: locale.value.memRss, value: `${memory.rss} MB` },
    { label: locale.value.memHeapUsed, value: `${memory.heapUsed} MB` },
    { label: locale.value.memHeapTotal, value: `${memory.heapTotal} MB` },
    { label: locale.value.memExternal, value: `${memory.external} MB` }
  ]
})

// 服务端 statusLabel 是固定枚举英文值，映射到词典后再展示
const connectionStatusText = computed(() => {
  const map = {
    connected: locale.value.connected,
    disconnected: locale.value.disconnected,
    cached: locale.value.statusCached,
    error: locale.value.disconnected
  }
  return map[database.value?.statusLabel] || '-'
})

const databaseRows = computed(() => {
  if (!database.value) return []
  return [
    {
      label: locale.value.latency,
      value: database.value.latencyMs >= 0 ? `${database.value.latencyMs} ms` : '-'
    },
    { label: locale.value.dbStatus, value: connectionStatusText.value },
    { label: locale.value.dbSize, value: database.value.databaseSize || '-' },
    {
      label: locale.value.poolActive,
      value: database.value.pool ? String(database.value.pool.activeConnections) : '-'
    }
  ]
})

const poolUtilization = computed(() => Number(database.value?.pool?.utilization) || 0)

const filteredTables = computed(() => {
  const keyword = tableKeyword.value.trim().toLowerCase()
  const list = snapshot.value?.tables?.list || []
  if (!keyword) return list
  return list.filter((item) => item.name.toLowerCase().includes(keyword))
})

const formatRows = (value) => formatNumber(Number(value) || 0)

const settingRows = computed(() => {
  const current = settings.value
  if (!current) return []

  const boolRow = (label, value) => ({
    label,
    value: yesNo(value),
    kind: value ? 'on' : 'off'
  })
  const textRow = (label, value) => ({ label, value: value ?? '-', kind: 'text' })

  const limitText = (enabled, daily, weekly, monthly) => {
    if (!enabled) return locale.value.off
    return `D${daily ?? '-'} / W${weekly ?? '-'} / M${monthly ?? '-'}`
  }


  return [
    textRow(locale.value.semesterLabel, current.currentSemester),
    textRow(locale.value.siteTitleLabel, current.siteTitle),
    textRow(locale.value.platformsLabel, (current.enabledPlatforms || []).join(', ') || '-'),
    textRow(locale.value.themeLabel, current.defaultTheme),
    textRow(
      locale.value.playTimesLabel,
      locale.value.countPair(current.playTimeEnabled, current.playTimeTotal)
    ),
    textRow(
      locale.value.requestTimesLabel,
      locale.value.countPair(current.requestTimeEnabled, current.requestTimeTotal)
    ),
    textRow(locale.value.userLimitLabel, limitText(current.enableSubmissionLimit, current.dailySubmissionLimit, current.weeklySubmissionLimit, current.monthlySubmissionLimit)),
    textRow(locale.value.globalLimitLabel, limitText(current.enableGlobalSubmissionLimit, current.globalDailySubmissionLimit, current.globalWeeklySubmissionLimit, current.globalMonthlySubmissionLimit)),
    boolRow(locale.value.allowRegisterLabel, current.allowRegister),
    boolRow(locale.value.registerApprovalLabel, current.registerRequiresApproval),
    boolRow(locale.value.captchaLabel, current.captchaEnabled),
    boolRow(locale.value.smtpLabel, current.smtpEnabled),
    textRow(locale.value.astrbotLabel, current.astrbotEnabled ? current.astrbotPushMode : locale.value.off),
    boolRow(locale.value.autoBackupLabel, current.autoBackupEnabled),
    boolRow(locale.value.blockAllRequestsLabel, current.forceBlockAllRequests),
    boolRow(locale.value.requestTimeLimitLabel, current.enableRequestTimeLimitation),
    boolRow(locale.value.replayLabel, current.enableReplayRequests),
    boolRow(locale.value.collaborationLabel, current.enableCollaborativeSubmission),
    boolRow(locale.value.cardCodeLabel, current.enableCardCodeRequests),
    boolRow(locale.value.cardCodeRequiredLabel, current.requireCardCodeForRequests),
    boolRow(locale.value.hideStudentInfoLabel, current.hideStudentInfo)
  ]
})

const levelOptions = computed(() => [
  { label: locale.value.levelAll, value: 'all' },
  { label: locale.value.levelError, value: 'error' },
  { label: locale.value.levelWarn, value: 'warn' },
  { label: locale.value.levelInfo, value: 'info' }
])

const sourceOptions = computed(() => [
  { label: locale.value.sourceAll, value: 'all' },
  { label: locale.value.sourceRuntime, value: 'runtime' },
  { label: locale.value.sourceApiError, value: 'apiError' },
  { label: locale.value.sourcePasswordAudit, value: 'passwordAudit' }
])

const sourceLabel = (item) => {
  const map = {
    runtime: locale.value.sourceRuntime,
    apiError: locale.value.sourceApiError,
    passwordAudit: locale.value.sourcePasswordAudit
  }
  const base = map[item.source] || item.source
  // 口令审计的动作已在消息内本地化展示，标签不再拼接原始动作标识
  if (item.source === 'passwordAudit') return base
  return item.sourceLabel ? `${base} · ${item.sourceLabel}` : base
}

// 服务端事件消息可能是 code + params，这里做本地化映射
const localizeEventMessage = (item) => {
  const message = item.message
  // passwordAudit.<action> → "用户 #<userId>：<动作描述>"，userId 从 detail JSON 解析
  if (message.startsWith('passwordAudit.')) {
    const action = message.slice('passwordAudit.'.length)
    const actions = locale.value.passwordAuditActions || {}
    const label = String(actions[action] || action)
    let userId = ''
    try {
      userId = JSON.parse(item.detail || '{}').userId ?? ''
    } catch {
      // detail 非法时退化为不带用户编号
    }
    return userId ? String(locale.value.passwordAuditUser(userId, label)) : label
  }
  // JSON payload from recordRuntimeEvent
  try {
    const parsed = JSON.parse(message)
    if (parsed.code === 'bufferCleared') {
      return locale.value.bufferCleared(parsed.count ?? 0)
    }
    if (parsed.code === 'serverStarted') {
      return locale.value.serverStarted
    }
    if (parsed.code === 'dbHealthRecovered') {
      return locale.value.dbHealthRecovered
    }
  } catch {
    // not JSON, fall through to raw message
  }
  return message
}

const eventQuery = computed(() => {
  const query = { limit: 200 }
  if (eventLevel.value !== 'all') query.level = eventLevel.value
  if (eventSource.value !== 'all') query.source = eventSource.value
  return query
})

// 筛选切换与自动刷新并发时响应可能乱序，用序号丢弃过期响应
let snapshotSeq = 0
let eventsSeq = 0

// silent：自动刷新走静默模式，不触发整页 loading，避免「最后刷新」时间戳停在首次加载
const loadSnapshot = async ({ silent = false } = {}) => {
  const seq = ++snapshotSeq
  if (!silent) loading.value = true
  try {
    const response = await $fetch('/api/admin/system-board', { ...auth.getAuthConfig() })
    if (seq !== snapshotSeq) return
    snapshot.value = response.data
    snapshotError.value = ''
  } catch (error) {
    if (seq !== snapshotSeq) return
    snapshotError.value = localize(error)
  } finally {
    if (!silent && seq === snapshotSeq) loading.value = false
  }
}

const loadEvents = async () => {
  const seq = ++eventsSeq
  eventsLoading.value = true
  try {
    const response = await $fetch('/api/admin/system-board/events', {
      query: eventQuery.value,
      ...auth.getAuthConfig()
    })
    if (seq !== eventsSeq) return
    events.value = response.data.events
    eventsTruncated.value = Boolean(response.data.truncated)
    runtimeMeta.value = response.data.runtimeMeta
    eventsError.value = ''
  } catch (error) {
    if (seq !== eventsSeq) return
    eventsError.value = localize(error)
  } finally {
    if (seq === eventsSeq) eventsLoading.value = false
  }
}

const loadAll = async () => {
  await Promise.all([loadSnapshot(), loadEvents()])
}

const clearRuntimeEvents = async () => {
  clearing.value = true
  try {
    await $fetch('/api/admin/system-board/runtime-clear', {
      method: 'POST',
      ...auth.getAuthConfig()
    })
    showToast(locale.value.eventsCleared, 'success')
    await loadEvents()
  } catch (error) {
    showToast(localize(error), 'error')
  } finally {
    clearing.value = false
  }
}

let timer = null

const stopAutoRefresh = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
}

watch(autoRefresh, (enabled) => {
  stopAutoRefresh()
  if (enabled) {
    timer = setInterval(() => {
      // 页面不可见时跳过本轮轮询，避免后台标签页持续查库
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      loadSnapshot({ silent: true })
      loadEvents()
    }, REFRESH_INTERVAL_MS)
  }
})

watch(eventQuery, loadEvents)

onMounted(loadAll)
onUnmounted(stopAutoRefresh)
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}
</style>
