<template>
  <div class="space-y-6">
    <!-- 头部 -->
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 class="text-lg font-black">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1 font-medium">{{ locale.desc }}</p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-secondary bg-bg-secondary text-text-secondary text-xs font-bold hover:border-border-tertiary transition-all"
        @click="refreshAll"
      >
        <RefreshCw :size="14" /> {{ locale.refresh }}
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div v-for="item in stats" :key="item.label" class="rounded-2xl border border-border-secondary bg-bg-secondary-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.24em] text-text-tertiary">{{ item.label }}</p>
        <div class="mt-2 flex items-end justify-between gap-2">
          <span class="text-2xl font-black text-text-primary">{{ item.value }}</span>
          <span :class="['text-[10px] font-bold px-2 py-1 rounded-full', item.badgeClass]">{{ item.hint }}</span>
        </div>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="relative flex-1 max-w-md">
        <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="locale.searchPlaceholder"
          class="w-full bg-bg-primary border border-border-secondary rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40 transition-all"
          @keyup.enter="fetchAccounts(1)"
        >
      </div>
      <div class="flex items-center gap-2">
        <CustomSelect
          v-model="selectedUserId"
          :label="locale.selectUser"
          :options="userOptions"
          label-key="label"
          value-key="value"
          :placeholder="locale.selectUserPlaceholder"
          class-name="min-w-[200px]"
          @change="onUserSelected"
        />
      </div>
    </div>

    <!-- 主内容区：账户列表 + 额度详情 -->
    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
      <!-- 账户列表 -->
      <section class="min-w-0 rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-text-primary">{{ locale.accountList }}</h3>
          <span class="text-[10px] text-text-tertiary font-medium">{{ pagination.total }} {{ locale.totalAccounts }}</span>
        </div>

        <div v-if="loading" class="flex items-center justify-center py-8 text-sm text-text-tertiary">
          <AppSpinner :size="24" :border-width="2" />
          <span class="ml-2">{{ locale.loading }}</span>
        </div>

        <div v-else class="overflow-x-auto rounded-2xl border border-border-secondary">
          <table class="min-w-[700px] w-full text-left text-sm">
            <thead class="bg-bg-primary-80 text-text-tertiary">
              <tr>
                <th class="px-3 py-3 w-16">{{ locale.userId }}</th>
                <th class="px-3 py-3">{{ locale.userName }}</th>
                <th class="px-3 py-3 w-20">{{ locale.periodic }}</th>
                <th class="px-3 py-3 w-20">{{ locale.permanent }}</th>
                <th class="px-3 py-3 w-16">{{ locale.total }}</th>
                <th class="px-3 py-3 w-36">{{ locale.periodKey }}</th>
                <th class="px-3 py-3 w-28">{{ locale.actions }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in accounts" :key="item.userId" class="border-t border-border-secondary-80 hover:bg-bg-primary-70 transition-colors" :class="{ 'bg-primary-5': selectedUserId === item.userId }">
                <td class="px-3 py-3 text-text-tertiary font-mono">{{ item.userId }}</td>
                <td class="px-3 py-3">
                  <div class="flex flex-col">
                    <span class="text-text-primary font-medium">{{ item.name }}</span>
                    <span class="text-[10px] text-text-tertiary">{{ item.username }}</span>
                  </div>
                </td>
                <td class="px-3 py-3 font-mono font-bold" :class="item.periodicBalance > 0 ? 'text-success' : 'text-text-tertiary'">{{ item.periodicBalance }}</td>
                <td class="px-3 py-3 font-mono font-bold" :class="item.permanentBalance > 0 ? 'text-primary' : 'text-text-tertiary'">{{ item.permanentBalance }}</td>
                <td class="px-3 py-3 font-mono font-bold text-text-primary">{{ (item.periodicBalance || 0) + (item.permanentBalance || 0) }}</td>
                <td class="px-3 py-3 text-[11px] text-text-tertiary font-mono">{{ item.periodKey || '—' }}</td>
                <td class="px-3 py-3">
                  <button
                    class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary-10 transition-colors"
                    @click="selectAccount(item)"
                  >
                    {{ locale.detail }}
                  </button>
                </td>
              </tr>
              <tr v-if="!accounts.length">
                <td colspan="7" class="px-3 py-10 text-center text-sm text-text-tertiary">{{ locale.emptyAccounts }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-model:current-page="pagination.page"
          :total-pages="pagination.totalPages"
          :total-items="pagination.total"
          :item-name="locale.itemName"
          @change="fetchAccounts"
        />
      </section>

      <!-- 右侧：额度详情与调整 -->
      <section class="space-y-4">
        <!-- 额度详情 -->
        <div v-if="selectedAccount" class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-text-primary">{{ locale.accountDetail }}</h3>
            <button
              class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
              @click="clearSelection"
            >
              {{ locale.clearSelection }}
            </button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between py-2 border-b border-border-secondary-80">
              <span class="text-xs text-text-tertiary">{{ locale.userName }}</span>
              <span class="text-xs font-bold text-text-primary">{{ selectedAccount.name }} ({{ selectedAccount.username }})</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-border-secondary-80">
              <span class="text-xs text-text-tertiary">{{ locale.gradeClass }}</span>
              <span class="text-xs text-text-primary">{{ selectedAccount.grade || '—' }}{{ selectedAccount.class ? `/${selectedAccount.class}` : '' }}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-border-secondary-80">
              <span class="text-xs text-text-tertiary">{{ locale.periodicBalance }}</span>
              <span class="text-xs font-bold text-success">{{ selectedAccount.periodicBalance }}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-border-secondary-80">
              <span class="text-xs text-text-tertiary">{{ locale.permanentBalance }}</span>
              <span class="text-xs font-bold text-primary">{{ selectedAccount.permanentBalance }}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-border-secondary-80">
              <span class="text-xs text-text-tertiary">{{ locale.totalBalance }}</span>
              <span class="text-xs font-bold text-text-primary">{{ (selectedAccount.periodicBalance || 0) + (selectedAccount.permanentBalance || 0) }}</span>
            </div>
            <div class="flex items-center justify-between py-2">
              <span class="text-xs text-text-tertiary">{{ locale.periodKey }}</span>
              <span class="text-xs font-mono text-text-primary">{{ selectedAccount.periodKey || '—' }}</span>
            </div>
          </div>

          <!-- 额度调整 -->
          <div class="border-t border-border-secondary pt-4 space-y-3">
            <h4 class="text-xs font-black text-text-primary uppercase tracking-[0.2em]">{{ locale.adjustQuota }}</h4>

            <div class="flex gap-2">
              <CustomSelect
                v-model="adjustForm.operation"
                :options="operationOptions"
                label-key="label"
                value-key="value"
                class-name="flex-1"
              />
              <input
                v-model.number="adjustForm.amount"
                type="number"
                min="1"
                max="1000000"
                :placeholder="locale.amount"
                class="w-24 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary-40"
              >
            </div>

            <div class="space-y-2">
              <input
                v-model="adjustForm.requestId"
                type="text"
                :placeholder="locale.requestIdPlaceholder"
                class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
              >
              <input
                v-model="adjustForm.publicDescription"
                type="text"
                :placeholder="locale.publicDescPlaceholder"
                class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
              >
              <input
                v-model="adjustForm.internalNote"
                type="text"
                :placeholder="locale.internalNotePlaceholder"
                class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
              >
            </div>

            <button
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-hover px-3.5 py-2.5 text-xs font-black text-text-primary hover:bg-primary transition-colors disabled:opacity-50"
              :disabled="saving || !adjustForm.operation || !adjustForm.amount || !adjustForm.requestId"
              @click="submitAdjustment"
            >
              <Loader2 v-if="saving" :size="14" class="animate-spin" />
              <Save v-else :size="14" />
              {{ saving ? locale.saving : locale.submitAdjust }}
            </button>
          </div>
        </div>

        <!-- 默认提示 -->
        <div v-else class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-6 text-center">
          <p class="text-sm text-text-tertiary">{{ locale.selectAccountHint }}</p>
        </div>

        <!-- 快捷操作提示 -->
        <div class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-4 space-y-3">
          <h3 class="text-sm font-black text-text-primary uppercase tracking-[0.24em]">{{ locale.quickTipsTitle }}</h3>
          <ul class="space-y-2 text-[12px] leading-relaxed text-text-tertiary">
            <li v-for="tip in locale.quickTips" :key="tip" class="flex items-start gap-2">
              <span class="shrink-0 text-text-disabled">·</span>
              <span>{{ tip }}</span>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- 额度流水 -->
    <section class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-black text-text-primary uppercase tracking-[0.24em]">{{ locale.transactionHistory }}</h3>
          <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.transactionDesc }}</p>
        </div>
        <button
          class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary"
          @click="refreshTransactions"
        >
          {{ locale.refreshLogs }}
        </button>
      </div>

      <!-- 流水筛选 -->
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.transactionUser }}</label>
          <input
            v-model="txFilters.userId"
            type="number"
            :placeholder="locale.transactionUserPlaceholder"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            @keyup.enter="fetchTransactions(1)"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.quotaType }}</label>
          <CustomSelect
            v-model="txFilters.quotaType"
            :options="quotaTypeFilterOptions"
            label-key="label"
            value-key="value"
            class-name="w-full"
            @change="fetchTransactions(1)"
          />
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.source }}</label>
          <CustomSelect
            v-model="txFilters.source"
            :options="sourceFilterOptions"
            label-key="label"
            value-key="value"
            class-name="w-full"
            @change="fetchTransactions(1)"
          />
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.startDate }}</label>
          <input
            v-model="txFilters.from"
            type="date"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.endDate }}</label>
          <input
            v-model="txFilters.to"
            type="date"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
          >
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-xl bg-primary-hover px-4 py-2 text-xs font-black text-text-primary hover:bg-primary transition-colors"
          @click="fetchTransactions(1)"
        >
          {{ locale.queryLogs }}
        </button>
        <button
          class="rounded-xl border border-border-secondary bg-bg-primary px-4 py-2 text-xs font-bold text-text-secondary"
          @click="resetTxFilters"
        >
          {{ locale.clearConditions }}
        </button>
      </div>

      <div v-if="txLoading" class="rounded-xl border border-border-secondary bg-bg-primary-60 p-6 text-center text-sm text-text-tertiary">
        {{ locale.loadingLogs }}
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-border-secondary">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-bg-primary-80 text-text-tertiary">
            <tr>
              <th class="px-3 py-3 w-16">ID</th>
              <th class="px-3 py-3 w-36">{{ locale.transactionUser }}</th>
              <th class="px-3 py-3 w-20">{{ locale.quotaType }}</th>
              <th class="px-3 py-3 w-28">{{ locale.source }}</th>
              <th class="px-3 py-3 w-16">{{ locale.delta }}</th>
              <th class="px-3 py-3 w-16">{{ locale.balanceAfter }}</th>
              <th class="px-3 py-3 w-28">{{ locale.createdAt }}</th>
              <th class="px-3 py-3">{{ locale.publicDescription }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in transactions"
              :key="item.id"
              class="border-t border-border-secondary-80 hover:bg-bg-primary-70 transition-colors"
            >
              <td class="px-3 py-3 text-text-tertiary font-mono">{{ item.id }}</td>
              <td class="px-3 py-3 text-text-secondary">
                <span class="text-text-primary">{{ item.user?.name }}</span>
                <span class="text-text-tertiary">({{ item.user?.username }})</span>
              </td>
              <td class="px-3 py-3">
                <span :class="['inline-flex items-center rounded-full px-2 py-1 text-[10px] font-black', quotaTypeMeta(item.quotaType).class]">
                  {{ quotaTypeMeta(item.quotaType).label }}
                </span>
              </td>
              <td class="px-3 py-3">
                <span class="text-[11px] text-text-tertiary">{{ sourceLabel(item.source) }}</span>
              </td>
              <td class="px-3 py-3 font-mono font-bold" :class="item.delta > 0 ? 'text-success' : item.delta < 0 ? 'text-error' : 'text-text-tertiary'">
                {{ item.delta > 0 ? `+${item.delta}` : item.delta }}
              </td>
              <td class="px-3 py-3 font-mono text-text-primary">{{ item.balanceAfter }}</td>
              <td class="px-3 py-3 text-[11px] text-text-tertiary">{{ formatDate(item.createdAt) }}</td>
              <td class="px-3 py-3 text-[11px] text-text-tertiary max-w-[200px] truncate" :title="item.publicDescription || ''">
                {{ item.publicDescription || '—' }}
              </td>
            </tr>
            <tr v-if="!transactions.length">
              <td colspan="8" class="px-3 py-8 text-center text-sm text-text-tertiary">{{ locale.noTransactions }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-if="transactions.length"
        v-model:current-page="txPagination.page"
        :total-pages="txPagination.totalPages"
        :total-items="txPagination.total"
        :item-name="locale.txItemName"
        @change="fetchTransactions"
      />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Loader2, RefreshCw, Save, Search } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.songQuotaManager || {})
const { msg: getLocaleMessage, nested: getNestedMessage } = useLocaleText(locale)

const accounts = ref([])
const transactions = ref([])
const loading = ref(false)
const txLoading = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const selectedUserId = ref(null)
const selectedAccount = ref(null)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const txPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })

const adjustForm = ref({
  operation: 'INCREMENT',
  amount: 1,
  requestId: '',
  publicDescription: '',
  internalNote: ''
})

const txFilters = ref({
  userId: '',
  quotaType: '',
  source: '',
  from: '',
  to: ''
})

const userOptions = computed(() => {
  return accounts.value.map((a) => ({
    label: `#${a.userId} ${a.name} (${a.username})`,
    value: a.userId
  }))
})

const operationOptions = computed(() => [
  { label: locale.value?.operationIncrement || '增加', value: 'INCREMENT' },
  { label: locale.value?.operationDecrement || '减少', value: 'DECREMENT' },
  { label: locale.value?.operationSet || '设定', value: 'SET' }
])

const quotaTypeFilterOptions = computed(() => [
  { label: locale.value?.allTypes || '全部', value: '' },
  { label: 'PERIODIC', value: 'PERIODIC' },
  { label: 'PERMANENT', value: 'PERMANENT' }
])

const sourceFilterOptions = computed(() => [
  { label: locale.value?.allSources || '全部来源', value: '' },
  { label: 'PERIOD_GRANT', value: 'PERIOD_GRANT' },
  { label: 'PERIOD_EXPIRED', value: 'PERIOD_EXPIRED' },
  { label: 'ADMIN_ADJUST', value: 'ADMIN_ADJUST' },
  { label: 'ADMIN_BULK_ADJUST', value: 'ADMIN_BULK_ADJUST' },
  { label: 'SONG_REQUEST', value: 'SONG_REQUEST' },
  { label: 'SONG_WITHDRAW_RETURN', value: 'SONG_WITHDRAW_RETURN' },
  { label: 'SONG_WITHDRAW_EXPIRED', value: 'SONG_WITHDRAW_EXPIRED' },
  { label: 'LEGACY_CARD_CONVERT', value: 'LEGACY_CARD_CONVERT' }
])

const quotaTypeMeta = (type) => {
  if (type === 'PERIODIC') return { label: locale.value?.periodicLabel || 'PERIODIC', class: 'bg-success-10 text-success border border-success-20' }
  if (type === 'PERMANENT') return { label: locale.value?.permanentLabel || 'PERMANENT', class: 'bg-primary-10 text-primary border border-primary-20' }
  return { label: type || '—', class: 'bg-bg-quaternary-10 text-text-secondary border border-border-tertiary-20' }
}

const sourceLabel = (source) => {
  const labels = {
    PERIOD_GRANT: locale.value?.sourceLabels?.periodGrant || '周期发放',
    PERIOD_EXPIRED: locale.value?.sourceLabels?.periodExpired || '周期过期',
    ADMIN_ADJUST: locale.value?.sourceLabels?.adminAdjust || '管理员调整',
    ADMIN_BULK_ADJUST: locale.value?.sourceLabels?.adminBulkAdjust || '管理员批量调整',
    OPEN_API_ADJUST: locale.value?.sourceLabels?.openApiAdjust || 'Open API 调整',
    SONG_REQUEST: locale.value?.sourceLabels?.songRequest || '点歌消费',
    SONG_WITHDRAW_RETURN: locale.value?.sourceLabels?.withdrawReturn || '撤回返还',
    SONG_WITHDRAW_EXPIRED: locale.value?.sourceLabels?.withdrawExpired || '撤回过期',
    LEGACY_CARD_CONVERT: locale.value?.sourceLabels?.legacyCardConvert || '旧券兑换'
  }
  return labels[source] || source || '—'
}

const stats = computed(() => {
  const total = accounts.value.length
  const withQuota = accounts.value.filter((a) => (a.periodicBalance || 0) + (a.permanentBalance || 0) > 0).length
  return [
    { label: locale.value?.stats?.totalAccounts || '账户总数', value: total, hint: locale.value?.stats?.all || '全部', badgeClass: 'bg-bg-tertiary text-text-primary' },
    { label: locale.value?.stats?.withQuota || '有额度', value: withQuota, hint: locale.value?.stats?.active || '活跃', badgeClass: 'bg-success-10 text-success' },
    { label: locale.value?.stats?.periodicTotal || '周期总额度', value: accounts.value.reduce((s, a) => s + (a.periodicBalance || 0), 0), hint: locale.value?.stats?.currentPeriod || '当前周期', badgeClass: 'bg-warning-10 text-warning' },
    { label: locale.value?.stats?.permanentTotal || '永久总额度', value: accounts.value.reduce((s, a) => s + (a.permanentBalance || 0), 0), hint: locale.value?.stats?.total || '累计', badgeClass: 'bg-primary-10 text-primary' }
  ]
})

const queryString = computed(() => {
  const query = new URLSearchParams()
  if (searchQuery.value.trim()) query.set('search', searchQuery.value.trim())
  query.set('page', String(pagination.value.page))
  query.set('limit', String(pagination.value.limit))
  return query.toString()
})

const txQueryString = computed(() => {
  const query = new URLSearchParams()
  query.set('page', String(txPagination.value.page))
  query.set('limit', String(txPagination.value.limit))
  if (txFilters.value.userId) query.set('userId', txFilters.value.userId)
  if (txFilters.value.quotaType) query.set('quotaType', txFilters.value.quotaType)
  if (txFilters.value.source) query.set('source', txFilters.value.source)
  if (txFilters.value.from) query.set('from', new Date(txFilters.value.from).toISOString())
  if (txFilters.value.to) query.set('to', new Date(txFilters.value.to + 'T23:59:59.999+08:00').toISOString())
  return query.toString()
})

const fetchAccounts = async (page = pagination.value.page) => {
  const nextPage = Number(page)
  pagination.value.page = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  loading.value = true
  try {
    const res = await $fetch(`/api/admin/song-quotas?${queryString.value}`)
    if (res) {
      accounts.value = (res.items || []).map((item) => ({
        ...item,
        periodicBalance: Number(item.periodicBalance ?? 0),
        permanentBalance: Number(item.permanentBalance ?? 0)
      }))
      pagination.value = {
        ...pagination.value,
        ...(res.pagination || {}),
        totalPages: Math.max(1, Number(res.pagination?.totalPages || 1))
      }
    }
  } catch (error) {
    console.error('获取额度账户列表失败', error)
    showToast(getNestedMessage('messages', 'fetchFailed'), 'error')
  } finally {
    loading.value = false
  }
}

const fetchTransactions = async (page = txPagination.value.page) => {
  const nextPage = Number(page)
  txPagination.value.page = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  txLoading.value = true
  try {
    const res = await $fetch(`/api/admin/song-quotas/transactions?${txQueryString.value}`)
    if (res) {
      transactions.value = res.items || []
      txPagination.value = {
        ...txPagination.value,
        ...(res.pagination || {}),
        totalPages: Math.max(1, Number(res.pagination?.totalPages || 1))
      }
    }
  } catch (error) {
    console.error('获取额度流水失败', error)
    showToast(getNestedMessage('messages', 'fetchLogsFailed'), 'error')
  } finally {
    txLoading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([fetchAccounts(), fetchTransactions()])
}

const refreshTransactions = () => fetchTransactions(1)

const selectAccount = (item) => {
  selectedUserId.value = item.userId
  selectedAccount.value = item
  adjustForm.value.requestId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const onUserSelected = () => {
  if (!selectedUserId.value) {
    clearSelection()
    return
  }
  const item = accounts.value.find((a) => a.userId === selectedUserId.value)
  if (item) {
    selectAccount(item)
  }
}

const clearSelection = () => {
  selectedUserId.value = null
  selectedAccount.value = null
  adjustForm.value = { operation: 'INCREMENT', amount: 1, requestId: '', publicDescription: '', internalNote: '' }
}

const submitAdjustment = async () => {
  if (!selectedAccount.value || !adjustForm.value.operation || !adjustForm.value.amount || !adjustForm.value.requestId) return
  saving.value = true
  try {
    const res = await $fetch('/api/admin/song-quotas/adjust', {
      method: 'POST',
      body: {
        userId: selectedAccount.value.userId,
        operation: adjustForm.value.operation,
        amount: adjustForm.value.amount,
        requestId: adjustForm.value.requestId,
        publicDescription: adjustForm.value.publicDescription.trim() || undefined,
        internalNote: adjustForm.value.internalNote.trim() || undefined
      }
    })
    showToast(getNestedMessage('messages', 'adjustSuccess'), 'success')
    clearSelection()
    await Promise.all([fetchAccounts(), fetchTransactions()])
  } catch (error) {
    console.error('调整额度失败', error)
    showToast(error?.data?.message || error?.message || getNestedMessage('messages', 'adjustFailed'), 'error')
  } finally {
    saving.value = false
  }
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

const resetTxFilters = () => {
  txFilters.value = { userId: '', quotaType: '', source: '', from: '', to: '' }
  fetchTransactions(1)
}

onMounted(refreshAll)
</script>

<style scoped>
/* table 样式继承自全局 */
</style>