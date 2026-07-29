<template>
  <section class="border-t border-zinc-800 pt-8">
    <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <History :size="18" class="text-blue-500" />
          <h3 class="text-lg font-black text-zinc-100">{{ locale.title }}</h3>
        </div>
        <p class="mt-1 text-xs text-zinc-500">{{ locale.description }}</p>
      </div>

      <button
        type="button"
        :disabled="loading"
        class="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-zinc-800 px-4 text-xs font-bold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-wait disabled:opacity-50 md:self-auto"
        @click="refreshHistory"
      >
        <RefreshCw :size="15" :class="loading ? 'animate-spin' : ''" />
        {{ loading ? locale.refreshing : locale.refresh }}
      </button>
    </div>

    <div
      class="mt-6 inline-flex max-w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1"
      role="group"
      :aria-label="locale.statusFilter"
    >
      <button
        v-for="option in filterOptions"
        :key="option.value"
        type="button"
        :aria-pressed="statusFilter === option.value"
        class="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition-colors"
        :class="
          statusFilter === option.value
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-300'
        "
        @click="setStatusFilter(option.value)"
      >
        <component :is="option.icon" :size="14" />
        {{ option.label }}
        <span
          class="min-w-6 rounded bg-zinc-950 px-1.5 py-0.5 text-center text-[10px] text-zinc-500"
        >
          {{ option.count }}
        </span>
      </button>
    </div>

    <div
      v-if="error"
      class="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4"
      role="alert"
    >
      <div class="flex min-w-0 items-start gap-3">
        <AlertCircle :size="17" class="mt-0.5 shrink-0 text-red-400" />
        <p class="break-words text-xs font-medium text-red-300">{{ error }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs font-bold text-red-300 hover:text-red-200"
        @click="loadHistory"
      >
        {{ locale.retry }}
      </button>
    </div>

    <div
      v-if="loading && notifications.length === 0"
      class="flex min-h-56 items-center justify-center text-zinc-600"
    >
      <Loader2 :size="22" class="animate-spin" />
      <span class="ml-3 text-xs font-bold">{{ locale.loading }}</span>
    </div>

    <div
      v-else-if="notifications.length === 0"
      class="mt-6 flex min-h-56 flex-col items-center justify-center border-y border-zinc-800 text-center"
    >
      <Inbox :size="28" class="text-zinc-700" />
      <p class="mt-3 text-sm font-bold text-zinc-400">{{ locale.empty }}</p>
      <p class="mt-1 text-xs text-zinc-600">{{ locale.emptyDescription }}</p>
    </div>

    <template v-else>
      <div class="mt-6 hidden overflow-x-auto rounded-lg border border-zinc-800 md:block">
        <table class="w-full min-w-[940px] border-collapse text-left">
          <thead class="bg-zinc-900/80 text-[10px] font-black uppercase text-zinc-600">
            <tr>
              <th class="px-5 py-3">{{ locale.notification }}</th>
              <th class="px-5 py-3">{{ locale.recipient }}</th>
              <th class="px-5 py-3">{{ locale.type }}</th>
              <th class="px-5 py-3">{{ locale.status }}</th>
              <th class="px-5 py-3">{{ locale.sentAt }}</th>
              <th class="px-5 py-3">{{ locale.readAt }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/80 bg-zinc-950/40">
            <tr v-for="item in notifications" :key="item.id" class="hover:bg-zinc-900/40">
              <td class="max-w-[320px] px-5 py-4 align-top">
                <p class="truncate text-sm font-bold text-zinc-200">
                  {{ item.title || locale.untitled }}
                </p>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                  {{ item.message }}
                </p>
              </td>
              <td class="px-5 py-4 align-top">
                <p class="text-xs font-bold text-zinc-300">{{ recipientName(item) }}</p>
                <p class="mt-1 text-[10px] text-zinc-600">{{ recipientMeta(item) }}</p>
              </td>
              <td class="px-5 py-4 align-top">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold"
                  :class="
                    item.important
                      ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                  "
                >
                  <BellRing v-if="item.important" :size="12" />
                  <Bell v-else :size="12" />
                  {{ item.important ? locale.important : locale.normal }}
                </span>
              </td>
              <td class="px-5 py-4 align-top">
                <span
                  class="inline-flex items-center gap-1.5 text-xs font-bold"
                  :class="item.read ? 'text-emerald-400' : 'text-amber-300'"
                >
                  <CheckCircle2 v-if="item.read" :size="14" />
                  <Circle v-else :size="14" />
                  {{ item.read ? locale.read : locale.unread }}
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-zinc-500">
                {{ formatDateTime(item.createdAt) }}
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-zinc-500">
                {{ item.readAt ? formatDateTime(item.readAt) : locale.notRead }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6 divide-y divide-zinc-800 border-y border-zinc-800 md:hidden">
        <article v-for="item in notifications" :key="item.id" class="py-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="break-words text-sm font-bold text-zinc-200">
                {{ item.title || locale.untitled }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                {{ item.message }}
              </p>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold"
              :class="item.read ? 'text-emerald-400' : 'text-amber-300'"
            >
              <CheckCircle2 v-if="item.read" :size="14" />
              <Circle v-else :size="14" />
              {{ item.read ? locale.read : locale.unread }}
            </span>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 text-xs min-[360px]:grid-cols-2">
            <div>
              <p class="text-[10px] font-bold text-zinc-700">{{ locale.recipient }}</p>
              <p class="mt-1 text-zinc-400">{{ recipientName(item) }}</p>
              <p class="mt-0.5 text-[10px] text-zinc-600">{{ recipientMeta(item) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold text-zinc-700">{{ locale.type }}</p>
              <p class="mt-1 text-zinc-400">
                {{ item.important ? locale.important : locale.normal }}
              </p>
            </div>
            <div>
              <p class="text-[10px] font-bold text-zinc-700">{{ locale.sentAt }}</p>
              <p class="mt-1 text-zinc-400">{{ formatDateTime(item.createdAt) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold text-zinc-700">{{ locale.readAt }}</p>
              <p class="mt-1 text-zinc-400">
                {{ item.readAt ? formatDateTime(item.readAt) : locale.notRead }}
              </p>
            </div>
          </div>
        </article>
      </div>

      <Pagination
        v-model:current-page="pagination.page"
        :total-pages="pagination.totalPages"
        :total-items="pagination.total"
        :item-name="locale.itemName"
        @change="loadHistory"
      />
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  Circle,
  History,
  Inbox,
  Loader2,
  RefreshCw
} from '@lucide/vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import { useAuth } from '~/composables/useAuth'
import { useServerErrors } from '~/composables/useLocaleText'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  refreshKey: {
    type: Number,
    default: 0
  }
})

const { getAuthConfig } = useAuth()
const { localize: localizeServerError } = useServerErrors()
const { admin, currentLocale } = useLocale()
const locale = computed(() => admin.value?.notificationSender?.history || {})
const notifications = ref([])
const loading = ref(false)
const error = ref('')
const statusFilter = ref('ALL')
const stats = ref({ total: 0, read: 0, unread: 0 })
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
let requestVersion = 0

const filterOptions = computed(() => [
  { value: 'ALL', label: locale.value.all, count: stats.value.total, icon: History },
  { value: 'READ', label: locale.value.read, count: stats.value.read, icon: CheckCircle2 },
  { value: 'UNREAD', label: locale.value.unread, count: stats.value.unread, icon: Circle }
])

const loadHistory = async () => {
  const activeRequest = ++requestVersion
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/admin/notifications/history', {
      query: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        status: statusFilter.value
      },
      ...getAuthConfig()
    })

    if (activeRequest !== requestVersion) return

    notifications.value = response.notifications || []
    stats.value = response.stats || { total: 0, read: 0, unread: 0 }
    pagination.value = {
      page: Number(response.pagination?.page || 1),
      limit: Number(response.pagination?.limit || 20),
      total: Number(response.pagination?.total || 0),
      totalPages: Math.max(1, Number(response.pagination?.totalPages || 1))
    }
  } catch (fetchError) {
    if (activeRequest !== requestVersion) return
    error.value = localizeServerError(fetchError, locale.value.loadFailed)
  } finally {
    if (activeRequest === requestVersion) loading.value = false
  }
}

const setStatusFilter = (status) => {
  if (statusFilter.value === status) return
  statusFilter.value = status
  pagination.value.page = 1
  loadHistory()
}

const refreshHistory = () => {
  pagination.value.page = 1
  loadHistory()
}

const formatDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return locale.value.unknownTime

  return new Intl.DateTimeFormat(currentLocale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

const recipientName = (item) =>
  item.recipient?.name ||
  item.recipient?.username ||
  locale.value.unknownUser(item.recipient?.id || item.userId)

const recipientMeta = (item) => {
  const details = []
  if (item.recipient?.username) details.push(`@${item.recipient.username}`)
  if (item.recipient?.grade) details.push(item.recipient.grade)
  if (item.recipient?.class) details.push(item.recipient.class)
  return details.join(' · ') || locale.value.userId(item.recipient?.id || item.userId)
}

watch(
  () => props.refreshKey,
  () => refreshHistory()
)

onMounted(loadHistory)
onUnmounted(() => {
  requestVersion += 1
})
</script>
