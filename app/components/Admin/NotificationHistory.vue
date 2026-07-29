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
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead class="bg-zinc-900/80 text-[10px] font-black uppercase text-zinc-600">
            <tr>
              <th class="px-5 py-3">{{ locale.notification }}</th>
              <th class="px-5 py-3">{{ locale.type }}</th>
              <th class="px-5 py-3">{{ locale.recipientCountLabel }}</th>
              <th class="px-5 py-3">{{ locale.sentAt }}</th>
              <th class="px-5 py-3 text-right">{{ locale.actions }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/80 bg-zinc-950/40">
            <tr v-for="item in notifications" :key="item.batchId" class="hover:bg-zinc-900/40">
              <td class="max-w-[380px] px-5 py-4 align-top">
                <p class="truncate text-sm font-bold text-zinc-200">
                  {{ item.title || locale.untitled }}
                </p>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                  {{ item.message }}
                </p>
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
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-zinc-400">
                {{ locale.recipientCount(item.recipientCount) }}
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-zinc-500">
                {{ formatDateTime(item.createdAt) }}
              </td>
              <td class="px-5 py-4 text-right align-top">
                <button
                  type="button"
                  class="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-300 transition-colors hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
                  @click="openDetails(item)"
                >
                  <Eye :size="14" />
                  {{ locale.viewDetails }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6 divide-y divide-zinc-800 border-y border-zinc-800 md:hidden">
        <article v-for="item in notifications" :key="item.batchId" class="py-5">
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
              class="shrink-0 text-[10px] font-bold"
              :class="item.important ? 'text-amber-300' : 'text-zinc-500'"
            >
              {{ item.important ? locale.important : locale.normal }}
            </span>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
            <span class="inline-flex items-center gap-1.5">
              <Users :size="14" />
              {{ locale.recipientCount(item.recipientCount) }}
            </span>
            <span>{{ formatDateTime(item.createdAt) }}</span>
          </div>

          <button
            type="button"
            class="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300 transition-colors hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
            @click="openDetails(item)"
          >
            <Eye :size="14" />
            {{ locale.viewDetails }}
          </button>
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

    <Teleport to="body">
      <div
        v-if="selectedBatch"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-detail-title"
        @click.self="closeDetails"
        @keydown.esc="closeDetails"
      >
        <div
          class="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl sm:max-h-[calc(100vh-3rem)]"
        >
          <header class="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
            <div class="min-w-0">
              <p class="text-[10px] font-black uppercase text-blue-400">{{ locale.detailsEyebrow }}</p>
              <h2 id="notification-detail-title" class="mt-1 break-words text-lg font-black text-zinc-100">
                {{ selectedBatch.title || locale.untitled }}
              </h2>
              <p class="mt-1 text-xs text-zinc-500">
                {{ formatDateTime(selectedBatch.createdAt) }}
              </p>
            </div>
            <button
              ref="closeButton"
              type="button"
              class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              :title="locale.close"
              :aria-label="locale.close"
              @click="closeDetails"
            >
              <X :size="19" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <p class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
              {{ selectedBatch.message }}
            </p>

            <div
              class="mt-5 inline-flex max-w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1"
              role="group"
              :aria-label="locale.statusFilter"
            >
              <button
                v-for="option in detailFilterOptions"
                :key="option.value"
                type="button"
                :aria-pressed="detailStatus === option.value"
                class="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition-colors"
                :class="
                  detailStatus === option.value
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                "
                @click="setDetailStatus(option.value)"
              >
                <component :is="option.icon" :size="14" />
                {{ option.label }}
                <span class="min-w-6 rounded bg-zinc-950 px-1.5 py-0.5 text-center text-[10px] text-zinc-500">
                  {{ option.count }}
                </span>
              </button>
            </div>

            <div
              v-if="detailError"
              class="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4"
              role="alert"
            >
              <p class="break-words text-xs font-medium text-red-300">{{ detailError }}</p>
              <button type="button" class="shrink-0 text-xs font-bold text-red-300" @click="loadDetails">
                {{ locale.retry }}
              </button>
            </div>

            <div v-if="detailLoading" class="flex min-h-48 items-center justify-center text-zinc-600">
              <Loader2 :size="22" class="animate-spin" />
              <span class="ml-3 text-xs font-bold">{{ locale.detailsLoading }}</span>
            </div>

            <div
              v-else-if="recipients.length === 0"
              class="mt-5 flex min-h-48 items-center justify-center border-y border-zinc-800 text-xs text-zinc-600"
            >
              {{ locale.noRecipients }}
            </div>

            <template v-else>
              <div class="mt-5 hidden overflow-x-auto rounded-lg border border-zinc-800 sm:block">
                <table class="w-full min-w-[620px] border-collapse text-left">
                  <thead class="bg-zinc-900/80 text-[10px] font-black uppercase text-zinc-600">
                    <tr>
                      <th class="px-4 py-3">{{ locale.recipient }}</th>
                      <th class="px-4 py-3">{{ locale.status }}</th>
                      <th class="px-4 py-3">{{ locale.readAt }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-800/80">
                    <tr v-for="item in recipients" :key="item.id">
                      <td class="px-4 py-3">
                        <p class="text-xs font-bold text-zinc-300">{{ recipientName(item) }}</p>
                        <p class="mt-1 text-[10px] text-zinc-600">{{ recipientMeta(item) }}</p>
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex items-center gap-1.5 text-xs font-bold"
                          :class="item.read ? 'text-emerald-400' : 'text-amber-300'"
                        >
                          <CheckCircle2 v-if="item.read" :size="14" />
                          <Circle v-else :size="14" />
                          {{ item.read ? locale.read : locale.unread }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                        {{ item.readAt ? formatDateTime(item.readAt) : locale.notRead }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="mt-5 divide-y divide-zinc-800 border-y border-zinc-800 sm:hidden">
                <article v-for="item in recipients" :key="item.id" class="py-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="break-words text-xs font-bold text-zinc-300">{{ recipientName(item) }}</p>
                      <p class="mt-1 break-words text-[10px] text-zinc-600">{{ recipientMeta(item) }}</p>
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
                  <p class="mt-3 text-[10px] text-zinc-600">
                    {{ locale.readAt }}：{{ item.readAt ? formatDateTime(item.readAt) : locale.notRead }}
                  </p>
                </article>
              </div>

              <Pagination
                v-model:current-page="detailPagination.page"
                :total-pages="detailPagination.totalPages"
                :total-items="detailPagination.total"
                :item-name="locale.recipientItemName"
                @change="loadDetails"
              />
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  Circle,
  Eye,
  History,
  Inbox,
  Loader2,
  RefreshCw,
  Users,
  X
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
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const selectedBatch = ref(null)
const recipients = ref([])
const detailLoading = ref(false)
const detailError = ref('')
const detailStatus = ref('ALL')
const detailStats = ref({ total: 0, read: 0, unread: 0 })
const detailPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const closeButton = ref(null)
let requestVersion = 0
let detailRequestVersion = 0
let previousFocus = null
let previousBodyOverflow = ''

const detailFilterOptions = computed(() => [
  { value: 'ALL', label: locale.value.all, count: detailStats.value.total, icon: Users },
  { value: 'READ', label: locale.value.read, count: detailStats.value.read, icon: CheckCircle2 },
  { value: 'UNREAD', label: locale.value.unread, count: detailStats.value.unread, icon: Circle }
])

const loadHistory = async () => {
  const activeRequest = ++requestVersion
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/admin/notifications/history', {
      query: {
        page: pagination.value.page,
        limit: pagination.value.limit
      },
      ...getAuthConfig()
    })

    if (activeRequest !== requestVersion) return

    notifications.value = response.notifications || []
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

const refreshHistory = () => {
  pagination.value.page = 1
  loadHistory()
}

const loadDetails = async () => {
  if (!selectedBatch.value?.batchId) return

  const activeRequest = ++detailRequestVersion
  detailLoading.value = true
  detailError.value = ''

  try {
    const response = await $fetch(
      `/api/admin/notifications/history/${encodeURIComponent(selectedBatch.value.batchId)}`,
      {
        query: {
          page: detailPagination.value.page,
          limit: detailPagination.value.limit,
          status: detailStatus.value
        },
        ...getAuthConfig()
      }
    )

    if (activeRequest !== detailRequestVersion) return

    selectedBatch.value = {
      ...selectedBatch.value,
      ...(response.notification || {})
    }
    recipients.value = response.recipients || []
    detailStats.value = response.stats || { total: 0, read: 0, unread: 0 }
    detailPagination.value = {
      page: Number(response.pagination?.page || 1),
      limit: Number(response.pagination?.limit || 20),
      total: Number(response.pagination?.total || 0),
      totalPages: Math.max(1, Number(response.pagination?.totalPages || 1))
    }
  } catch (fetchError) {
    if (activeRequest !== detailRequestVersion) return
    detailError.value = localizeServerError(fetchError, locale.value.detailsLoadFailed)
  } finally {
    if (activeRequest === detailRequestVersion) detailLoading.value = false
  }
}

const openDetails = async (item) => {
  selectedBatch.value = item
  recipients.value = []
  detailStatus.value = 'ALL'
  detailStats.value = { total: 0, read: 0, unread: 0 }
  detailPagination.value = { page: 1, limit: 20, total: 0, totalPages: 1 }
  previousFocus = document.activeElement
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  closeButton.value?.focus()
  loadDetails()
}

const closeDetails = () => {
  detailRequestVersion += 1
  selectedBatch.value = null
  recipients.value = []
  detailError.value = ''
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => previousFocus?.focus?.())
}

const setDetailStatus = (status) => {
  if (detailStatus.value === status) return
  detailStatus.value = status
  detailPagination.value.page = 1
  loadDetails()
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
  locale.value.unknownUser(item.recipient?.id)

const recipientMeta = (item) => {
  const details = []
  if (item.recipient?.username) details.push(`@${item.recipient.username}`)
  if (item.recipient?.grade) details.push(item.recipient.grade)
  if (item.recipient?.class) details.push(item.recipient.class)
  return details.join(' · ') || locale.value.userId(item.recipient?.id)
}

watch(
  () => props.refreshKey,
  () => refreshHistory()
)

onMounted(loadHistory)
onUnmounted(() => {
  requestVersion += 1
  detailRequestVersion += 1
  if (selectedBatch.value) document.body.style.overflow = previousBodyOverflow
})
</script>
