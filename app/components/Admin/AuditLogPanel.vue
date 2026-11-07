<template>
  <div class="max-w-[1200px] mx-auto space-y-6 pb-20 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary font-medium">{{ locale.desc }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-primary-40 border border-border-secondary text-text-tertiary hover:text-text-primary hover:border-border-tertiary transition-all disabled:opacity-50"
          :disabled="exporting"
          @click="exportLogs('csv')"
        >
          <Download :size="14" />
          {{ locale.exportCsv }}
        </button>
        <button
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-primary-40 border border-border-secondary text-text-tertiary hover:text-text-primary hover:border-border-tertiary transition-all disabled:opacity-50"
          :disabled="exporting"
          @click="exportLogs('jsonl')"
        >
          <FileText :size="14" />
          {{ locale.exportRaw }}
        </button>
        <button
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-primary-40 border border-border-secondary text-text-tertiary hover:text-text-primary hover:border-border-tertiary transition-all disabled:opacity-50"
          :disabled="loading"
          @click="loadLogs"
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

    <!-- 筛选栏 -->
    <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CustomSelect
          v-model="filters.action"
          :options="actionOptions"
          :placeholder="locale.filterAction"
          class="w-full"
        />
        <CustomSelect
          v-model="filters.targetType"
          :options="targetTypeOptions"
          :placeholder="locale.filterTargetType"
          class="w-full"
        />
        <CustomSelect
          v-model="filters.result"
          :options="resultOptions"
          :placeholder="locale.filterResult"
          class="w-full"
        />
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            v-model="filters.actorName"
            type="text"
            :placeholder="locale.filterActor"
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-primary-40 border border-border-secondary text-xs text-text-primary placeholder-text-disabled focus:outline-none focus:border-border-tertiary"
            @keyup.enter="applyFilters"
          >
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-text-disabled">{{ locale.filterStartDate }}</span>
          <AppDatePicker v-model="filters.startDate" :label="locale.filterStartDate" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-text-disabled">{{ locale.filterEndDate }}</span>
          <AppDatePicker v-model="filters.endDate" :label="locale.filterEndDate" />
        </div>
        <div class="flex items-end gap-2">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-primary text-white hover:bg-primary-hover transition-all disabled:opacity-50"
            :disabled="loading"
            @click="applyFilters"
          >
            <Search :size="14" />
            {{ locale.apply }}
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-bg-primary-40 border border-border-secondary text-text-tertiary hover:text-text-primary transition-all"
            @click="resetFilters"
          >
            {{ locale.reset }}
          </button>
        </div>
      </div>
    </section>

    <!-- 审计记录表格 -->
    <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-border-secondary text-[10px] font-bold uppercase tracking-wider text-text-disabled">
              <th class="px-4 py-3">{{ locale.colTime }}</th>
              <th class="px-4 py-3">{{ locale.colAction }}</th>
              <th class="px-4 py-3">{{ locale.colActor }}</th>
              <th class="px-4 py-3">{{ locale.colTarget }}</th>
              <th class="px-4 py-3">{{ locale.colSummary }}</th>
              <th class="px-4 py-3">{{ locale.colResult }}</th>
              <th class="px-4 py-3">{{ locale.colIp }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !logs.length" class="border-b border-border-secondary">
              <td :colspan="7" class="px-4 py-12 text-center">
                <AppSpinner :size="28" />
              </td>
            </tr>
            <tr v-else-if="!logs.length" class="border-b border-border-secondary">
              <td :colspan="7" class="px-4 py-12 text-center text-xs text-text-disabled">
                {{ locale.empty }}
              </td>
            </tr>
            <tr
              v-for="log in logs"
              :key="log.id"
              class="border-b border-border-secondary last:border-0 hover:bg-bg-tertiary-30 transition-colors"
            >
              <td class="px-4 py-3 text-xs text-text-tertiary font-medium whitespace-nowrap tabular-nums">
                {{ log.createdAtDisplay }}
              </td>
              <td class="px-4 py-3">
                <span class="inline-block px-2 py-1 rounded-lg bg-bg-tertiary-40 border border-border-secondary text-[11px] font-mono text-text-primary">
                  {{ log.action }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-text-primary font-medium">
                {{ log.actorName || locale.system }}
              </td>
              <td class="px-4 py-3 text-xs text-text-tertiary">
                <template v-if="log.targetType">
                  <span class="text-text-secondary font-medium">{{ log.targetType }}</span>
                  <span v-if="log.targetId" class="text-text-disabled ml-1">#{{ log.targetId }}</span>
                </template>
                <span v-else>-</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-tertiary max-w-[280px]">
                <span class="block truncate" :title="log.summary || ''">{{ log.summary || '-' }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase border',
                    log.result === 'SUCCESS'
                      ? 'bg-success-10 text-success border-success-20'
                      : 'bg-error-10 text-error border-error-20'
                  ]"
                >
                  {{ log.result === 'SUCCESS' ? locale.success : locale.failure }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-text-disabled font-mono whitespace-nowrap">
                {{ log.ipAddress || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 分页 -->
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
import { AlertCircle, Download, FileText, RefreshCw, Search } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useAuth } from '~/composables/useAuth'
import { useLocale } from '~/utils/locale'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { useServerErrors } from '~/composables/useLocaleText'
import { formatDateTime, getBeijingTime } from '~/utils/timeUtils'

const auth = useAuth()
const { admin } = useLocale()
const locale = computed(() => useSafeLocale(admin.value?.auditLog || {}))
const { localize } = useServerErrors()

const logs = ref([])
const loading = ref(false)
const loadError = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
const actionOptions = ref([])
const targetTypeOptions = ref([])

const filters = reactive({
  action: '',
  targetType: '',
  result: '',
  actorName: '',
  startDate: '',
  endDate: ''
})

const resultOptions = [
  { value: 'SUCCESS', label: locale.value.success || '成功' },
  { value: 'FAILURE', label: locale.value.failure || '失败' }
]

const buildQuery = () => {
  const query = { page: page.value, limit: 50 }
  if (filters.action) query.action = filters.action
  if (filters.targetType) query.targetType = filters.targetType
  if (filters.result) query.result = filters.result
  if (filters.actorName.trim()) query.actorName = filters.actorName.trim()
  if (filters.startDate) query.startDate = filters.startDate
  if (filters.endDate) query.endDate = filters.endDate
  return query
}

const loadLogs = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/audit-logs', {
      query: buildQuery(),
      ...auth.getAuthConfig()
    })
    logs.value = response.logs
    total.value = response.pagination.total
    totalPages.value = response.pagination.totalPages || 1
    loadError.value = ''
  } catch (error) {
    loadError.value = localize(error)
  } finally {
    loading.value = false
  }
}

const loadOptions = async () => {
  try {
    const response = await $fetch('/api/admin/audit-logs/stats', { ...auth.getAuthConfig() })
    actionOptions.value = (response.data.byAction || []).map((item) => ({
      value: item.action,
      label: item.action
    }))
    targetTypeOptions.value = (response.data.byTargetType || [])
      .filter((item) => item.targetType)
      .map((item) => ({ value: item.targetType, label: item.targetType }))
  } catch {
    // 统计加载失败不阻塞列表
  }
}

const applyFilters = () => {
  page.value = 1
  loadLogs()
}

const resetFilters = () => {
  filters.action = ''
  filters.targetType = ''
  filters.result = ''
  filters.actorName = ''
  filters.startDate = ''
  filters.endDate = ''
  page.value = 1
  loadLogs()
}

const changePage = (newPage) => {
  page.value = newPage
  loadLogs()
}

const exporting = ref(false)

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
  if (exporting.value) return
  exporting.value = true
  try {
    const { page: _page, limit: _limit, ...filterQuery } = buildQuery()
    const blob = await $fetch('/api/admin/audit-logs/export', {
      query: { ...filterQuery, format },
      responseType: 'blob',
      ...auth.getAuthConfig()
    })
    const stamp = formatDateTime(getBeijingTime(), 'YYYYMMDD-HHmmss')
    saveBlob(blob, `voicehub-audit-logs-${stamp}.${format === 'jsonl' ? 'log' : 'csv'}`)
  } catch (error) {
    loadError.value = localize(error)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadLogs()
  loadOptions()
})
</script>
