<template>
  <div class="max-w-[1200px] mx-auto space-y-6 pb-20 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary font-medium">{{ locale.desc }}</p>
      </div>
      <button
        class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-quaternary hover:border-border-tertiary transition-all disabled:opacity-50"
        :disabled="loading || configLoading"
        @click="refreshAll"
      >
        <RefreshCw :size="14" :class="(loading || configLoading) ? 'animate-spin' : ''" />
        {{ locale.refresh }}
      </button>
    </div>

    <div v-if="actionError" class="flex items-start gap-3 p-4 rounded-2xl bg-error-10 border border-error-20 text-error text-xs font-medium">
      <AlertCircle :size="16" class="shrink-0 mt-0.5" />
      <span>{{ actionError }}</span>
    </div>
    <div v-if="actionNotice" class="flex items-start gap-3 p-4 rounded-2xl bg-success-10 border border-success-20 text-success text-xs font-medium">
      <CheckCircle2 :size="16" class="shrink-0 mt-0.5" />
      <span>{{ actionNotice }}</span>
    </div>

    <!-- 记录配置 -->
    <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4 space-y-4">
      <div class="space-y-1">
        <h3 class="text-sm font-bold text-text-primary">{{ locale.configTitle }}</h3>
        <p class="text-[11px] text-text-tertiary">{{ locale.configDesc }}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.colLevel }}</span>
          <CustomSelect
            v-model="config.apiLogLevel"
            :options="levelOptions"
            :disabled="!canManage || !configLoaded"
            class="w-full"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.apiRetention }}</span>
          <input
            v-model.number="config.apiLogRetentionDays"
            type="number"
            min="0"
            max="3650"
            :disabled="!canManage || !configLoaded"
            class="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border-secondary text-xs text-text-primary focus:outline-none focus:border-border-tertiary disabled:opacity-60"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.auditRetention }}</span>
          <input
            v-model.number="config.auditLogRetentionDays"
            type="number"
            min="0"
            max="3650"
            :disabled="!canManage || !configLoaded"
            class="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border-secondary text-xs text-text-primary focus:outline-none focus:border-border-tertiary disabled:opacity-60"
          >
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          v-if="canManage"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-primary text-white hover:bg-primary-hover transition-all disabled:opacity-50"
          :disabled="configSaving || !configLoaded"
          @click="saveConfig"
        >
          <Save :size="14" />
          {{ configSaving ? locale.saving : locale.saveConfig }}
        </button>

        <template v-if="canManage && cleanupConfirming">
          <span class="text-[11px] font-medium text-text-tertiary">
            {{ cleanupConfirming === 'audit' ? locale.cleanupAuditConfirm : locale.cleanupConfirm }}
          </span>
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-error-10 border border-error-20 text-error hover:bg-error-20 transition-all disabled:opacity-50"
            :disabled="cleaning"
            @click="runCleanup(cleanupConfirming)"
          >
            <Trash2 :size="14" />
            {{ cleaning ? locale.cleaning : locale.cleanupConfirmAction }}
          </button>
          <button
            class="px-3 py-2 rounded-xl text-[11px] font-bold text-text-tertiary hover:text-text-primary transition-all"
            :disabled="cleaning"
            @click="cleanupConfirming = ''"
          >
            {{ locale.cancel }}
          </button>
        </template>
        <template v-else-if="canManage">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-quaternary transition-all disabled:opacity-50"
            :disabled="cleaning"
            @click="cleanupConfirming = 'api'"
          >
            <Trash2 :size="14" />
            {{ locale.cleanup }}
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-quaternary transition-all disabled:opacity-50"
            :disabled="cleaning"
            @click="cleanupConfirming = 'audit'"
          >
            <Trash2 :size="14" />
            {{ locale.cleanupAudit }}
          </button>
        </template>

        <span class="text-[11px] text-text-disabled">{{ locale.retentionHint }}</span>
      </div>
    </section>

    <!-- 统计 -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4 space-y-1">
        <p class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.statTotal }}</p>
        <p class="text-lg font-black text-text-primary tabular-nums">{{ stats.total }}</p>
      </div>
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4 space-y-1">
        <p class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.statErrors }}</p>
        <p class="text-lg font-black text-error tabular-nums">{{ stats.errors }}</p>
      </div>
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4 space-y-1">
        <p class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.statAvg }}</p>
        <p class="text-lg font-black text-text-primary tabular-nums">{{ stats.avgResponseTime }} ms</p>
      </div>
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4 space-y-1">
        <p class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.statOldest }}</p>
        <p class="text-xs font-bold text-text-primary tabular-nums">{{ stats.oldestAt || locale.emptyValue }}</p>
        <p class="text-[10px] text-text-disabled">{{ locale.statNewest }} {{ stats.newestAt || locale.emptyValue }}</p>
      </div>
    </section>

    <!-- API 访问日志 -->
    <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            v-model="filters.endpoint"
            type="text"
            :placeholder="locale.filterEndpoint"
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border-secondary text-xs text-text-primary placeholder-text-disabled focus:outline-none focus:border-border-tertiary"
            @keyup.enter="applyFilters"
          >
        </div>
        <CustomSelect v-model="filters.method" :options="methodOptions" :placeholder="locale.filterMethod" class="w-full" />
        <input
          v-model="filters.statusCode"
          type="number"
          min="100"
          max="599"
          :placeholder="locale.filterStatus"
          class="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border-secondary text-xs text-text-primary placeholder-text-disabled focus:outline-none focus:border-border-tertiary"
        >
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            v-model="filters.search"
            type="text"
            :placeholder="locale.filterSearch"
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border-secondary text-xs text-text-primary placeholder-text-disabled focus:outline-none focus:border-border-tertiary"
            @keyup.enter="applyFilters"
          >
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.filterStartDate }}</span>
          <AppDatePicker v-model="filters.startDate" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-text-disabled">{{ locale.filterEndDate }}</span>
          <AppDatePicker v-model="filters.endDate" />
        </div>
        <div class="flex items-end gap-2 lg:col-span-2">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-primary text-white hover:bg-primary-hover transition-all disabled:opacity-50"
            :disabled="loading"
            @click="applyFilters"
          >
            <Search :size="14" />
            {{ locale.apply }}
          </button>
          <button
            class="px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-quaternary transition-all"
            @click="resetFilters"
          >
            {{ locale.reset }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-border-secondary pt-3">
        <button
          v-if="canRead"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-quaternary transition-all disabled:opacity-50"
          :disabled="exporting"
          @click="exportLogs('csv')"
        >
          <Download :size="14" />
          {{ locale.exportCsv }}
        </button>
        <button
          v-if="canRead"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-quaternary transition-all disabled:opacity-50"
          :disabled="exporting"
          @click="exportLogs('jsonl')"
        >
          <FileText :size="14" />
          {{ locale.exportRaw }}
        </button>
        <span class="text-[11px] text-text-disabled">{{ locale.exportHint }}</span>
      </div>
    </section>

    <LogTable
      :columns="accessColumns"
      :rows="logs"
      :loading="loading"
      :empty-text="locale.emptyAccess"
    >
      <template #default="{ row: log }">
        <td class="px-4 py-3 text-xs text-text-tertiary font-medium whitespace-nowrap tabular-nums">
          {{ log.createdAtDisplay }}
        </td>
        <td class="px-4 py-3 text-xs text-text-secondary max-w-[140px]">
          <span class="block truncate" :title="log.apiKeyName || log.apiKeyId || ''">
            {{ log.apiKeyName || log.apiKeyId || '-' }}
          </span>
        </td>
        <td class="px-4 py-3 text-xs text-text-primary font-mono max-w-[240px]">
          <span class="block truncate" :title="log.endpoint">{{ log.endpoint }}</span>
        </td>
        <td class="px-4 py-3 text-xs text-text-tertiary font-mono">{{ log.method }}</td>
        <td class="px-4 py-3">
          <span
            :class="[
              'inline-block px-2 py-1 rounded-full text-[10px] font-black tabular-nums border',
              log.statusCode >= 400
                ? 'bg-error-10 text-error border-error-20'
                : 'bg-success-10 text-success border-success-20'
            ]"
          >
            {{ log.statusCode }}
          </span>
        </td>
        <td class="px-4 py-3 text-xs text-text-tertiary tabular-nums">{{ log.responseTimeMs }} ms</td>
        <td class="px-4 py-3 text-xs text-text-disabled font-mono whitespace-nowrap">{{ log.ipAddress }}</td>
        <td class="px-4 py-3 text-xs text-text-tertiary max-w-[220px]">
          <span class="block truncate" :title="log.errorMessage || ''">{{ log.errorMessage || '-' }}</span>
        </td>
      </template>
    </LogTable>

    <div class="flex justify-center">
      <Pagination
        :current-page="page"
        :total-pages="totalPages"
        :total-items="total"
        :item-name="locale.items"
        @change="changePage"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  Save,
  Search,
  Trash2
} from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import LogTable from '~/components/Admin/LogTable.vue'
import { useAuth } from '~/composables/useAuth'
import { usePermissions } from '~/composables/usePermissions'
import { useLocale } from '~/utils/locale'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { formatDateTime, getBeijingTime } from '~/utils/timeUtils'
import { PRIV_LOGS } from '~/utils/admin-permissions'

const auth = useAuth()
const { can } = usePermissions()
const { admin } = useLocale()
const locale = computed(() => useSafeLocale(admin.value?.logManagement || {}))
const { localize } = useServerErrors()
const { t } = useLocaleText(locale)

const canRead = computed(() => can(PRIV_LOGS))
const canManage = computed(() => can(PRIV_LOGS))

// 配置
const config = reactive({ apiLogLevel: 'all', apiLogRetentionDays: 90, auditLogRetentionDays: 180 })
const configLoading = ref(false)
const configLoaded = ref(false)
const configSaving = ref(false)
const levelOptions = computed(() => [
  { value: 'all', label: locale.value.levelAll || '全部记录' },
  { value: 'errors', label: locale.value.levelErrors || '仅失败请求' },
  { value: 'off', label: locale.value.levelOff || '关闭记录' }
])

// 统计
const stats = reactive({ total: 0, errors: 0, avgResponseTime: 0, oldestAt: null, newestAt: null })

// 列表
const logs = ref([])
const loading = ref(false)
const exporting = ref(false)
const cleaning = ref(false)
const cleanupConfirming = ref('')
const actionError = ref('')
const actionNotice = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

const filters = reactive({
  endpoint: '',
  method: '',
  statusCode: '',
  search: '',
  startDate: '',
  endDate: ''
})

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => ({
  value: method,
  label: method
}))

const accessColumns = computed(() => [
  locale.value.colTime,
  locale.value.colKey,
  locale.value.colEndpoint,
  locale.value.colMethod,
  locale.value.colStatus,
  locale.value.colDuration,
  locale.value.colIp,
  locale.value.colError
])

const buildFilters = () => {
  const query = {}
  if (filters.endpoint.trim()) query.endpoint = filters.endpoint.trim()
  if (filters.method) query.method = filters.method
  if (filters.statusCode !== '' && filters.statusCode !== null) query.statusCode = filters.statusCode
  if (filters.search.trim()) query.search = filters.search.trim()
  if (filters.startDate) query.startDate = filters.startDate
  if (filters.endDate) query.endDate = filters.endDate
  return query
}

const loadConfig = async () => {
  configLoading.value = true
  try {
    const response = await $fetch('/api/admin/system-settings/logging', { ...auth.getAuthConfig() })
    config.apiLogLevel = response.apiLogLevel || 'all'
    config.apiLogRetentionDays = Number(response.apiLogRetentionDays ?? 90)
    config.auditLogRetentionDays = Number(response.auditLogRetentionDays ?? 180)
    configLoaded.value = true
  } catch (error) {
    actionError.value = localize(error)
  } finally {
    configLoading.value = false
  }
}

const saveConfig = async () => {
  if (!canManage.value) return
  // 输入框被清空时 Number('') 会得到 0（永久保留），必须在提交前拦截
  const apiDays = Number(config.apiLogRetentionDays)
  const auditDays = Number(config.auditLogRetentionDays)
  const validDays = (days) => Number.isInteger(days) && days >= 0 && days <= 3650
  if (config.apiLogRetentionDays === '' || config.auditLogRetentionDays === '' || !validDays(apiDays) || !validDays(auditDays)) {
    actionError.value = locale.value.retentionInvalid || '保留天数必须是 0-3650 的整数'
    return
  }
  configSaving.value = true
  actionError.value = ''
  actionNotice.value = ''
  try {
    await $fetch('/api/admin/system-settings/logging', {
      method: 'POST',
      body: {
        apiLogLevel: config.apiLogLevel,
        apiLogRetentionDays: apiDays,
        auditLogRetentionDays: auditDays
      },
      ...auth.getAuthConfig()
    })
    actionNotice.value = locale.value.saveSuccess || '日志配置已保存'
    await loadStats()
  } catch (error) {
    actionError.value = localize(error)
  } finally {
    configSaving.value = false
  }
}

const loadStats = async () => {
  try {
    const response = await $fetch('/api/admin/log-management/stats', { ...auth.getAuthConfig() })
    Object.assign(stats, response.data || {})
  } catch (error) {
    actionError.value = localize(error)
  }
}

const loadLogs = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/log-management/access', {
      query: { ...buildFilters(), page: page.value, limit: 50 },
      ...auth.getAuthConfig()
    })
    logs.value = response.logs
    total.value = response.pagination.total
    totalPages.value = response.pagination.totalPages || 1
    actionError.value = ''
  } catch (error) {
    actionError.value = localize(error)
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  page.value = 1
  loadLogs()
}

const resetFilters = () => {
  filters.endpoint = ''
  filters.method = ''
  filters.statusCode = ''
  filters.search = ''
  filters.startDate = ''
  filters.endDate = ''
  page.value = 1
  loadLogs()
}

const changePage = (newPage) => {
  page.value = newPage
  loadLogs()
}

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportLogs = async (format) => {
  if (!canRead.value || exporting.value) return
  exporting.value = true
  actionError.value = ''
  try {
    const blob = await $fetch('/api/admin/log-management/access/export', {
      query: { ...buildFilters(), format },
      responseType: 'blob',
      ...auth.getAuthConfig()
    })
    const stamp = formatDateTime(getBeijingTime(), 'YYYYMMDD-HHmmss')
    saveBlob(blob, `voicehub-api-logs-${stamp}.${format === 'jsonl' ? 'log' : 'csv'}`)
  } catch (error) {
    actionError.value = localize(error)
  } finally {
    exporting.value = false
  }
}

const runCleanup = async (type) => {
  if (!canManage.value || cleaning.value) return
  cleaning.value = true
  actionError.value = ''
  actionNotice.value = ''
  try {
    const response = await $fetch('/api/admin/log-management/cleanup', {
      method: 'POST',
      body: { type },
      ...auth.getAuthConfig()
    })
    actionNotice.value = type === 'audit'
      ? t('cleanupAuditDone', '已清理 {0} 条审计日志', response.auditDeleted)
      : t('cleanupApiDone', '已清理 {0} 条访问日志', response.apiDeleted)
    cleanupConfirming.value = ''
    if (type === 'api') await Promise.all([loadLogs(), loadStats()])
  } catch (error) {
    actionError.value = localize(error)
  } finally {
    cleaning.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([loadConfig(), loadStats(), loadLogs()])
}

onMounted(() => {
  refreshAll()
})
</script>
