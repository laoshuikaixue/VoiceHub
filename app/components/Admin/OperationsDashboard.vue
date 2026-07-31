<template>
  <div class="operations-dashboard space-y-5">
    <header
      class="flex flex-col gap-4 border-b border-zinc-800 pb-5 xl:flex-row xl:items-center xl:justify-between"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2.5">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400"
            ><Icon name="monitoring" :size="17"
          /></span>
          <h2 class="text-lg font-bold text-zinc-100">{{ locale.title }}</h2>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span class="inline-flex items-center gap-1.5"
            ><span class="h-1.5 w-1.5 rounded-full bg-zinc-600" />{{
              locale.awaitingConnection
            }}</span
          ><span class="text-zinc-700">/</span><span>{{ locale.lastUpdated }} --</span>
        </div>
      </div>
      <button
        type="button"
        class="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-xs font-semibold text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled
      >
        <Icon name="refresh" :size="14" />{{ locale.actions.refresh }}
      </button>
    </header>

    <nav class="group-tabs" aria-label="Operations monitor sections">
      <button
        v-for="group in monitorGroups"
        :key="group.value"
        type="button"
        class="group-tab"
        :class="{ 'group-tab--active': activeGroup === group.value }"
        @click="activeGroup = group.value"
      >
        <Icon :name="group.icon" :size="14" /><span>{{ group.label }}</span>
      </button>
    </nav>

    <template v-if="activeGroup === 'overview'">
      <section class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article v-for="item in overviewStatus" :key="item.label" class="panel p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="metric-caption">{{ item.label }}</span
            ><span class="h-1.5 w-1.5 rounded-full bg-zinc-700" />
          </div>
          <p class="mt-3 text-sm font-semibold text-zinc-300">--</p>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in overviewMetrics" :key="item.label" class="panel min-h-32 p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-xs font-semibold text-zinc-500"
              ><Icon :name="item.icon" :size="14" class-name="text-zinc-600" />{{
                item.label
              }}</span
            ><Icon name="info" :size="11" class-name="text-zinc-700" />
          </div>
          <strong class="mt-4 block text-2xl text-zinc-100">--</strong>
          <p class="mt-3 text-xs text-zinc-600">{{ item.detail }}</p>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article class="panel min-h-72 xl:col-span-5">
          <div class="flex h-full flex-col gap-7 p-5 sm:flex-row sm:items-center sm:p-6">
            <div
              class="flex shrink-0 flex-col items-center justify-center border-zinc-800 sm:w-40 sm:border-r sm:pr-6"
            >
              <div class="health-ring">
                <div class="health-ring__inner">
                  <strong>--</strong><span>{{ locale.overview.health }}</span>
                </div>
              </div>
              <div class="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
                <span>{{ locale.overview.healthStatus }}</span
                ><Icon name="info" :size="12" />
              </div>
              <span class="mt-1 text-xs font-semibold text-zinc-600">{{ locale.noData }}</span>
            </div>
            <div class="min-w-0 flex-1 self-stretch">
              <div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <span class="h-2 w-2 rounded-full bg-blue-500" />{{ locale.overview.health
                }}<Icon name="info" :size="12" class-name="text-zinc-600" />
              </div>
              <div class="mt-5 grid grid-cols-2 gap-x-5 gap-y-5">
                <div v-for="item in runtimeSummary" :key="item">
                  <p class="metric-caption">{{ item }}</p>
                  <p class="mt-1 truncate text-sm font-semibold text-zinc-300">--</p>
                </div>
              </div>
            </div>
          </div>
        </article>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3">
          <article
            v-for="item in overviewSignalCards"
            :key="item.label"
            class="panel min-h-32 flex flex-col p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-xs font-semibold text-zinc-500"
                ><Icon :name="item.icon" :size="14" class-name="text-zinc-600" />{{
                  item.label
                }}</span
              ><Icon name="info" :size="11" class-name="text-zinc-700" />
            </div>
            <strong class="mt-4 text-2xl text-zinc-100">--</strong>
            <div class="placeholder-bar mt-3"><span /></div>
            <p class="mt-auto pt-3 text-xs text-zinc-600">{{ item.detail }}</p>
          </article>
        </div>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.overview.snapshot }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <div
              v-for="item in businessSnapshot"
              :key="item"
              class="rounded-md border border-zinc-800 p-3"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.overview.services }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <div
              v-for="item in serviceCards"
              :key="item.label"
              class="rounded-md border border-zinc-800 p-3"
            >
              <div class="flex items-center gap-2 text-xs text-zinc-500">
                <Icon :name="item.icon" :size="13" class-name="text-zinc-600" />{{ item.label }}
              </div>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.overview.recentUsers }}</h3>
            <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[560px] table-fixed text-left">
              <thead class="table-head">
                <tr>
                  <th class="w-40 px-4 py-3">{{ locale.online.account }}</th>
                  <th class="w-36 px-4 py-3">{{ locale.online.name }}</th>
                  <th class="w-32 px-4 py-3">{{ locale.online.ip }}</th>
                  <th class="px-4 py-3">{{ locale.online.lastLogin }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="empty-table-cell">
                    <Icon name="users" :size="21" class-name="mb-2 text-zinc-700" />
                    <p>{{ locale.noData }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.overview.recentLogins }}</h3>
            <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[560px] table-fixed text-left">
              <thead class="table-head">
                <tr>
                  <th class="w-40 px-4 py-3">{{ locale.audit.account }}</th>
                  <th class="w-28 px-4 py-3">{{ locale.audit.ip }}</th>
                  <th class="w-28 px-4 py-3">{{ locale.audit.accountStatus }}</th>
                  <th class="px-4 py-3">{{ locale.logs.time }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="empty-table-cell">
                    <Icon name="history" :size="21" class-name="mb-2 text-zinc-700" />
                    <p>{{ locale.noData }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'online'">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in onlineMetrics" :key="item.label" class="panel min-h-36 p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-xs font-semibold text-zinc-500"
              ><Icon :name="item.icon" :size="14" class-name="text-zinc-600" />{{
                item.label
              }}</span
            ><Icon name="info" :size="11" class-name="text-zinc-700" />
          </div>
          <strong class="mt-4 block text-2xl text-zinc-100">--</strong>
          <div class="placeholder-bar mt-3"><span /></div>
          <p class="mt-3 text-xs text-zinc-600">{{ item.detail }}</p>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.online.activitySummary }}</h3>
          </div>
          <div class="grid grid-cols-3 gap-3 p-4">
            <div
              v-for="item in onlineActivityDetails"
              :key="item"
              class="rounded-md border border-zinc-800 p-4"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-lg font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.online.accountSummary }}</h3>
          </div>
          <div class="grid grid-cols-3 gap-3 p-4">
            <div
              v-for="item in onlineAccountDetails"
              :key="item"
              class="rounded-md border border-zinc-800 p-4"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-lg font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.online.activeRanking }}</h3>
            <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[520px] table-fixed text-left">
              <thead class="table-head">
                <tr>
                  <th class="w-44 px-4 py-3">{{ locale.online.user }}</th>
                  <th class="w-24 px-4 py-3">{{ locale.online.contributions }}</th>
                  <th class="w-24 px-4 py-3">{{ locale.online.likes }}</th>
                  <th class="px-4 py-3">{{ locale.online.activityScore }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="empty-table-cell">
                    <Icon name="users" :size="21" class-name="mb-2 text-zinc-700" />
                    <p>{{ locale.noData }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.online.recentLoginUsers }}</h3>
            <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[560px] table-fixed text-left">
              <thead class="table-head">
                <tr>
                  <th class="w-40 px-4 py-3">{{ locale.online.account }}</th>
                  <th class="w-32 px-4 py-3">{{ locale.online.ip }}</th>
                  <th class="w-28 px-4 py-3">{{ locale.online.accountStatus }}</th>
                  <th class="px-4 py-3">{{ locale.online.lastLogin }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="empty-table-cell">
                    <Icon name="history" :size="21" class-name="mb-2 text-zinc-700" />
                    <p>{{ locale.noData }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'server'">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in serverMetrics"
          :key="item.label"
          class="panel min-h-36 flex flex-col p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-xs font-semibold text-zinc-500"
              ><Icon :name="item.icon" :size="14" class-name="text-zinc-600" />{{
                item.label
              }}</span
            ><Icon name="info" :size="11" class-name="text-zinc-700" />
          </div>
          <strong class="mt-4 text-2xl text-zinc-100">--</strong>
          <p class="mt-auto pt-3 text-xs text-zinc-600">{{ item.detail }}</p>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.server.runtime }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div
              v-for="item in runtimeSummary"
              :key="item"
              class="rounded-md border border-zinc-800 p-3"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.server.database }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4">
            <div
              v-for="item in databaseDetails"
              :key="item"
              class="rounded-md border border-zinc-800 p-3"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.server.memoryDetails }}</h3>
          </div>
          <div class="grid grid-cols-3 gap-3 p-4">
            <div
              v-for="item in memoryDetails"
              :key="item"
              class="rounded-md border border-zinc-800 p-4"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.server.instanceDetails }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4">
            <div
              v-for="item in instanceDetails"
              :key="item"
              class="rounded-md border border-zinc-800 p-4"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="activeGroup === 'cache'">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in cacheMetrics"
          :key="item.label"
          class="panel min-h-36 flex flex-col p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-xs font-semibold text-zinc-500"
              ><Icon :name="item.icon" :size="14" class-name="text-zinc-600" />{{
                item.label
              }}</span
            ><Icon name="info" :size="11" class-name="text-zinc-700" />
          </div>
          <strong class="mt-4 text-2xl text-zinc-100">--</strong>
          <p class="mt-auto pt-3 text-xs text-zinc-600">{{ item.detail }}</p>
        </article>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.cache.connection }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4">
            <div
              v-for="item in cacheDetails"
              :key="item"
              class="rounded-md border border-zinc-800 p-4"
            >
              <p class="metric-caption">{{ item }}</p>
              <p class="mt-2 text-sm font-semibold text-zinc-300">--</p>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.cache.note }}</h3>
          </div>
          <div class="p-4 text-sm leading-6 text-zinc-500">{{ locale.cache.description }}</div>
        </article>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h3 class="text-sm font-bold text-zinc-200">{{ locale.cache.usageScope }}</h3>
        </div>
        <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="item in cacheUsageScopes"
            :key="item.label"
            class="rounded-md border border-zinc-800 p-4"
          >
            <div class="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <Icon :name="item.icon" :size="14" class-name="text-zinc-600" />{{ item.label }}
            </div>
            <p class="mt-2 text-xs leading-5 text-zinc-600">{{ item.detail }}</p>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="activeGroup === 'audit'">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in auditMetrics" :key="item.label" class="panel min-h-32 p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-semibold text-zinc-500">{{ item.label }}</span
            ><Icon :name="item.icon" :size="15" class-name="text-zinc-600" />
          </div>
          <strong class="mt-4 block text-2xl text-zinc-100">--</strong>
          <p class="mt-3 text-xs text-zinc-600">{{ item.detail }}</p>
        </article>
      </section>
      <section class="panel overflow-hidden">
        <div class="panel-header">
          <h3 class="text-sm font-bold text-zinc-200">{{ locale.audit.statusLogs }}</h3>
          <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] table-fixed text-left">
            <thead class="table-head">
              <tr>
                <th class="w-36 px-4 py-3">{{ locale.logs.time }}</th>
                <th class="w-40 px-4 py-3">{{ locale.audit.account }}</th>
                <th class="w-36 px-4 py-3">{{ locale.audit.statusTransition }}</th>
                <th class="w-32 px-4 py-3">{{ locale.audit.operator }}</th>
                <th class="px-4 py-3">{{ locale.audit.reason }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="empty-table-cell">
                  <Icon name="warning" :size="21" class-name="mb-2 text-zinc-700" />
                  <p>{{ locale.noData }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="panel">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.audit.sources }}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4">
            <div
              v-for="item in auditSources"
              :key="item"
              class="rounded-md border border-zinc-800 p-4"
            >
              <p class="text-xs font-semibold text-zinc-400">{{ item }}</p>
              <p class="mt-2 text-xs text-zinc-600">{{ locale.noData }}</p>
            </div>
          </div>
        </article>
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.audit.loginRecords }}</h3>
            <span class="text-[10px] text-zinc-600">{{ locale.itemCount }} --</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[520px] table-fixed text-left">
              <thead class="table-head">
                <tr>
                  <th class="w-40 px-4 py-3">{{ locale.audit.account }}</th>
                  <th class="w-32 px-4 py-3">{{ locale.audit.ip }}</th>
                  <th class="w-28 px-4 py-3">{{ locale.audit.accountStatus }}</th>
                  <th class="px-4 py-3">{{ locale.logs.time }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="empty-table-cell">
                    <Icon name="history" :size="21" class-name="mb-2 text-zinc-700" />
                    <p>{{ locale.noData }}</p>
                  </td>
                </tr>
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
const overviewStatus = computed(() =>
  [
    locale.value.overview?.security,
    locale.value.overview?.healthStatus,
    locale.value.overview?.cacheStatus
  ].map((label) => ({ label }))
)
const overviewMetrics = computed(() => [
  {
    icon: 'activity',
    label: locale.value.overview?.recentActive,
    detail: locale.value.overview?.recentActiveSummary
  },
  {
    icon: 'users',
    label: locale.value.overview?.totalUsers,
    detail: locale.value.overview?.totalUsersSummary
  },
  {
    icon: 'music',
    label: locale.value.overview?.todayRequests,
    detail: locale.value.overview?.todayRequestsSummary
  },
  {
    icon: 'settings',
    label: locale.value.overview?.database,
    detail: locale.value.overview?.databaseSummary
  }
])
const overviewSignalCards = computed(() => [
  {
    icon: 'activity',
    label: locale.value.overview?.recentActive,
    detail: locale.value.overview?.recentActiveSummary
  },
  {
    icon: 'users',
    label: locale.value.overview?.totalUsers,
    detail: locale.value.overview?.totalUsersSummary
  },
  {
    icon: 'music',
    label: locale.value.overview?.todayRequests,
    detail: locale.value.overview?.todayRequestsSummary
  },
  {
    icon: 'database',
    label: locale.value.overview?.database,
    detail: locale.value.overview?.databaseSummary
  },
  { icon: 'server', label: locale.value.services?.redis, detail: locale.value.cache?.readyDetail },
  {
    icon: 'warning',
    label: locale.value.audit?.statusChanges,
    detail: locale.value.audit?.statusChangesDetail
  }
])
const businessSnapshot = computed(() => [
  locale.value.snapshots?.activeSemester,
  locale.value.snapshots?.todaySchedule,
  locale.value.snapshots?.todaySongs,
  locale.value.snapshots?.pendingSongs,
  locale.value.snapshots?.playWindow,
  locale.value.snapshots?.requestWindow
])
const runtimeSummary = computed(() => [
  locale.value.runtime?.hostname,
  locale.value.runtime?.platform,
  locale.value.runtime?.nodeVersion,
  locale.value.runtime?.instanceId
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
  }
])
const databaseDetails = computed(() => [
  locale.value.server?.connection,
  locale.value.server?.poolActive,
  locale.value.server?.poolIdle,
  locale.value.server?.probe
])
const serviceCards = computed(() => [
  { icon: 'monitoring', label: locale.value.services?.application },
  { icon: 'database', label: locale.value.services?.postgresql },
  { icon: 'server', label: locale.value.services?.redis },
  { icon: 'music', label: locale.value.services?.musicSources },
  { icon: 'terminal', label: locale.value.services?.smtp },
  { icon: 'activity', label: locale.value.services?.sentry }
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
  }
])
const onlineActivityDetails = computed(() => [
  locale.value.online?.recentActive,
  locale.value.online?.todayRequests,
  locale.value.online?.activeContributors
])
const onlineAccountDetails = computed(() => [
  locale.value.online?.activeAccounts,
  locale.value.online?.withdrawnAccounts,
  locale.value.online?.graduatedAccounts
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
  { icon: 'clock', label: locale.value.cache?.ttl, detail: locale.value.cache?.ttlDetail }
])
const cacheDetails = computed(() => [
  locale.value.cache?.endpoint,
  locale.value.cache?.keyPrefix,
  locale.value.cache?.databaseCache,
  locale.value.cache?.databaseCacheTtl
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
const auditMetrics = computed(() => [
  {
    icon: 'warning',
    label: locale.value.audit?.statusChanges,
    detail: locale.value.audit?.statusChangesDetail
  },
  {
    icon: 'history',
    label: locale.value.audit?.passwordEvents,
    detail: locale.value.audit?.passwordEventsDetail
  },
  {
    icon: 'clock',
    label: locale.value.audit?.apiRequests,
    detail: locale.value.audit?.apiRequestsDetail
  },
  {
    icon: 'success',
    label: locale.value.audit?.loggedInAccounts,
    detail: locale.value.audit?.loggedInAccountsDetail
  }
])
const auditSources = computed(() => [
  locale.value.audit?.userStatus,
  locale.value.audit?.passwordSecurity,
  locale.value.audit?.userLogin,
  locale.value.audit?.apiKeyAccess
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
.group-tabs {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  border-bottom: 1px solid rgb(39 39 42);
  padding-bottom: 0.5rem;
}
.group-tab {
  display: inline-flex;
  min-height: 2.25rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.5rem;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: rgb(113 113 122);
  font-size: 0.75rem;
  font-weight: 600;
  transition:
    color 150ms,
    background-color 150ms;
}
.group-tab:hover {
  background: rgb(39 39 42 / 0.55);
  color: rgb(212 212 216);
}
.group-tab--active {
  background: rgb(59 130 246 / 0.12);
  color: rgb(96 165 250);
}
.panel-header {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(39 39 42);
  padding: 0.75rem 1rem;
}
.empty-table-cell {
  height: 10rem;
  padding: 0 1rem;
  text-align: center;
  color: rgb(82 82 91);
  font-size: 0.75rem;
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
.health-ring__inner span {
  margin-top: 0.35rem;
  color: rgb(113 113 122);
  font-size: 10px;
  font-weight: 600;
}
.metric-caption {
  color: rgb(113 113 122);
  font-size: 10px;
  font-weight: 600;
}
.placeholder-bar {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(39 39 42);
}
.placeholder-bar span {
  display: block;
  width: 0;
  height: 100%;
  background: rgb(59 130 246);
}
.table-head {
  border-bottom: 1px solid rgb(39 39 42);
  background: rgb(9 9 11 / 0.5);
  color: rgb(82 82 91);
  font-size: 10px;
  font-weight: 600;
}
</style>
