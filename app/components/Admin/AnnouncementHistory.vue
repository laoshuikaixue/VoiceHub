<template>
  <section class="border-t border-panel-bg-dark pt-8">
    <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <History :size="18" class="text-primary" />
          <h3 class="text-lg font-black text-text-primary-lighter">
            {{ locale.announcementHistoryTitle }}
          </h3>
        </div>
        <p class="mt-1 text-xs text-text-tertiary">{{ locale.announcementHistoryDescription }}</p>
        <p v-if="pagination.total" class="mt-1 text-[10px] font-bold text-text-disabled">
          {{ locale.announcementTotal?.(pagination.total) }}
        </p>
      </div>

      <button
        type="button"
        :disabled="loading"
        class="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-panel-bg-dark px-4 text-xs font-bold text-text-muted transition-colors hover:border-panel-bg-hover hover:text-text-primary-lighter disabled:cursor-wait disabled:opacity-50 md:self-auto"
        @click="refreshHistory"
      >
        <RefreshCw :size="15" :class="loading ? 'animate-spin' : ''" />
        {{ loading ? locale.refreshing : locale.refresh }}
      </button>
    </div>

    <div
      v-if="error"
      class="mt-5 flex items-start justify-between gap-4 rounded-lg border border-error-20 bg-error-5 p-4"
      role="alert"
    >
      <div class="flex min-w-0 items-start gap-3">
        <AlertCircle :size="17" class="mt-0.5 shrink-0 text-error" />
        <p class="break-words text-xs font-medium text-error-light">{{ error }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs font-bold text-error-light hover:text-error-light"
        @click="loadHistory"
      >
        {{ locale.retry }}
      </button>
    </div>

    <div
      v-if="loading && announcements.length === 0"
      class="flex min-h-56 items-center justify-center text-text-disabled"
    >
      <Loader2 :size="22" class="animate-spin" />
      <span class="ml-3 text-xs font-bold">{{ locale.loading }}</span>
    </div>

    <div
      v-else-if="announcements.length === 0"
      class="mt-6 flex min-h-56 flex-col items-center justify-center border-y border-panel-bg-dark text-center"
    >
      <Inbox :size="28" class="text-text-disabled" />
      <p class="mt-3 text-sm font-bold text-text-muted">{{ locale.announcementEmpty }}</p>
      <p class="mt-1 text-xs text-text-disabled">
        {{ locale.announcementEmptyDescription }}
      </p>
    </div>

    <template v-else>
      <div class="mt-6 hidden overflow-x-auto rounded-lg border border-panel-bg-dark md:block">
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead class="bg-panel-bg-deepest-80 text-[10px] font-black uppercase text-text-disabled">
            <tr>
              <th class="px-5 py-3">{{ locale.announcementColumn }}</th>
              <th class="px-5 py-3">{{ locale.displayModeLabel }}</th>
              <th class="px-5 py-3">{{ locale.sender }}</th>
              <th class="px-5 py-3">{{ locale.sentAt }}</th>
              <th class="px-5 py-3 text-right">{{ locale.actions }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-panel-bg-dark-80 bg-panel-bg-darkest-40">
            <tr v-for="item in announcements" :key="item.id" class="hover:bg-panel-bg-deepest-40">
              <td class="max-w-[420px] px-5 py-4 align-top">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-bold text-text-primary-light">
                    {{ item.title || locale.announcementUntitled }}
                  </p>
                  <span
                    v-if="item.isActive"
                    class="inline-flex shrink-0 items-center gap-1 rounded-md border border-success-20 bg-success-10 px-1.5 py-0.5 text-[10px] font-bold text-success-light"
                  >
                    <Radio :size="10" />
                    {{ locale.activeLabel }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-text-disabled">
                  {{ plainText(item.content) }}
                </p>
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md border border-panel-bg-hover bg-panel-bg-deepest px-2 py-1 text-[10px] font-bold text-text-tertiary"
                >
                  <MoveHorizontal v-if="item.displayMode === 'scroll'" :size="12" />
                  <AlignLeft v-else :size="12" />
                  {{
                    item.displayMode === 'scroll'
                      ? locale.displayModes?.scroll || '滚动'
                      : locale.displayModes?.static || '静态'
                  }}
                </span>
                <span
                  v-if="item.displayMode === 'scroll'"
                  class="ml-2 text-[10px] text-text-disabled"
                >
                  {{ speedLabel(item.scrollSpeed) }}
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-text-muted">
                {{ senderName(item) }}
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-text-tertiary">
                {{ formatDateTime(item.createdAt) }}
              </td>
              <td class="px-5 py-4 text-right align-top">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-lg border border-panel-bg-hover text-text-muted transition-colors hover:border-primary-50 hover:bg-primary-10 hover:text-primary-light"
                    :title="locale.previewAction"
                    :aria-label="locale.previewAction"
                    @click="openPreview(item)"
                  >
                    <Eye :size="15" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-lg border border-panel-bg-hover text-text-muted transition-colors hover:border-success-50 hover:bg-success-10 hover:text-success-light"
                    :title="locale.edit"
                    :aria-label="locale.edit"
                    @click="openEdit(item)"
                  >
                    <Pencil :size="15" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-lg border border-panel-bg-hover text-text-muted transition-colors hover:border-error-50 hover:bg-error-10 hover:text-error-light"
                    :title="locale.delete"
                    :aria-label="locale.delete"
                    @click="requestDelete(item)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6 divide-y divide-panel-bg-dark border-y border-panel-bg-dark md:hidden">
        <article v-for="item in announcements" :key="item.id" class="py-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="break-words text-sm font-bold text-text-primary-light">
                {{ item.title || locale.announcementUntitled }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-text-disabled">
                {{ plainText(item.content) }}
              </p>
            </div>
            <span
              v-if="item.isActive"
              class="inline-flex shrink-0 items-center gap-1 rounded-md border border-success-20 bg-success-10 px-1.5 py-0.5 text-[10px] font-bold text-success-light"
            >
              <Radio :size="10" />
              {{ locale.activeLabel }}
            </span>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
            <span class="inline-flex items-center gap-1.5">
              <MoveHorizontal v-if="item.displayMode === 'scroll'" :size="14" />
              <AlignLeft v-else :size="14" />
              {{
                item.displayMode === 'scroll'
                  ? locale.displayModes?.scroll || '滚动'
                  : locale.displayModes?.static || '静态'
              }}
              <span v-if="item.displayMode === 'scroll'" class="text-text-disabled">
                · {{ speedLabel(item.scrollSpeed) }}
              </span>
            </span>
            <span>{{ locale.sender }}：{{ senderName(item) }}</span>
            <span>{{ formatDateTime(item.createdAt) }}</span>
            <span
              v-if="item.broadcastToGroups"
              class="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary-light"
            >
              <Megaphone :size="12" />
              {{ locale.groupForwarded }}
            </span>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-panel-bg-hover text-xs font-bold text-text-secondary transition-colors hover:border-primary-50 hover:bg-primary-10 hover:text-primary-light"
              @click="openPreview(item)"
            >
              <Eye :size="14" />
              {{ locale.previewAction }}
            </button>
            <button
              type="button"
              class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-panel-bg-hover text-xs font-bold text-text-secondary transition-colors hover:border-success-50 hover:bg-success-10 hover:text-success-light"
              @click="openEdit(item)"
            >
              <Pencil :size="14" />
              {{ locale.edit }}
            </button>
            <button
              type="button"
              class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-panel-bg-hover text-xs font-bold text-text-secondary transition-colors hover:border-error-50 hover:bg-error-10 hover:text-error-light"
              @click="requestDelete(item)"
            >
              <Trash2 :size="14" />
              {{ locale.delete }}
            </button>
          </div>
        </article>
      </div>

      <Pagination
        v-model:current-page="pagination.page"
        :total-pages="pagination.totalPages"
        :total-items="pagination.total"
        :item-name="locale.announcementItemName"
        @change="loadHistory"
      />
    </template>

    <!-- 预览：与首页公告栏一致的展示效果 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="previewItem"
          class="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-panel-bg-darkest-80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-preview-title"
          @click.self="closePreview"
          @keydown.esc="closePreview"
        >
          <div
            class="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-panel-bg-dark bg-panel-bg-deepest shadow-2xl"
          >
            <header
              class="flex shrink-0 items-start justify-between gap-4 border-b border-panel-bg-dark-50 px-5 py-5 sm:px-8 sm:py-6"
            >
              <div class="min-w-0">
                <p class="text-[10px] font-black uppercase text-primary">
                  {{ locale.previewEyebrow }}
                </p>
                <h2
                  id="announcement-preview-title"
                  class="mt-1 break-words text-lg font-black text-text-primary-lighter"
                >
                  {{ previewItem.title || locale.announcementUntitled }}
                </h2>
                <p class="mt-1 text-xs text-text-tertiary">
                  {{ formatDateTime(previewItem.createdAt) }}
                </p>
                <p class="mt-1 text-xs text-text-tertiary">
                  {{ locale.sender }}：{{ senderName(previewItem) }}
                </p>
              </div>
              <button
                ref="closeButton"
                type="button"
                class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-panel-bg-dark hover:text-text-primary-lighter"
                :title="locale.close"
                :aria-label="locale.close"
                @click="closePreview"
              >
                <X :size="19" />
              </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:p-8">
              <div class="announcement-card">
                <div class="announcement-card-icon">
                  <Icon name="bell-ring" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <p
                    v-if="previewItem.title && previewItem.displayMode !== 'scroll'"
                    class="announcement-card-title"
                  >
                    {{ previewItem.title }}
                  </p>
                  <div
                    class="markdown-body announcement-card-text"
                    :class="previewItem.displayMode === 'scroll' ? 'is-inline' : ''"
                  >
                    <span
                      v-if="previewItem.title && previewItem.displayMode === 'scroll'"
                      class="announcement-card-inline-title"
                    >
                      {{ previewItem.title }}
                    </span>
                    <div v-html="renderMarkdown(previewItem.content || '')" />
                  </div>
                </div>
              </div>

              <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
                <span class="inline-flex items-center gap-1.5">
                  <MoveHorizontal v-if="previewItem.displayMode === 'scroll'" :size="14" />
                  <AlignLeft v-else :size="14" />
                  {{
                    previewItem.displayMode === 'scroll'
                      ? locale.displayModes?.scroll || '滚动'
                      : locale.displayModes?.static || '静态'
                  }}
                  <span v-if="previewItem.displayMode === 'scroll'" class="text-text-disabled">
                    · {{ speedLabel(previewItem.scrollSpeed) }}
                  </span>
                </span>
                <span
                  v-if="previewItem.broadcastToGroups"
                  class="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary-light"
                >
                  <Megaphone :size="12" />
                  {{ locale.groupForwarded }}
                </span>
                <span
                  v-if="previewItem.isActive"
                  class="inline-flex items-center gap-1.5 text-[10px] font-bold text-success-light"
                >
                  <Radio :size="12" />
                  {{ locale.activeLabel }}
                </span>
              </div>

              <p class="mt-4 text-[10px] leading-relaxed text-text-disabled">
                {{ locale.previewFooterHint }}
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 编辑：修改后会同步更新首页公告栏（当这条记录正在展示时） -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="editingItem"
          class="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-panel-bg-darkest-80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-edit-title"
          @click.self="closeEdit"
          @keydown.esc="closeEdit"
        >
          <form
            class="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-panel-bg-dark bg-panel-bg-deepest shadow-2xl"
            @submit.prevent="saveEdit"
          >
            <header
              class="flex shrink-0 items-center justify-between gap-4 border-b border-panel-bg-dark-50 px-5 py-5 sm:px-8 sm:py-6"
            >
              <div>
                <p class="text-[10px] font-black uppercase text-success">
                  {{ locale.editEyebrow }}
                </p>
                <h2
                  id="announcement-edit-title"
                  class="mt-1 text-lg font-black text-text-primary-lighter"
                >
                  {{ locale.editAnnouncement }}
                </h2>
              </div>
              <button
                type="button"
                class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-panel-bg-dark hover:text-text-primary-lighter disabled:cursor-wait disabled:opacity-50"
                :disabled="editSaving"
                :title="locale.close"
                :aria-label="locale.close"
                @click="closeEdit"
              >
                <X :size="19" />
              </button>
            </header>

            <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:p-8">
              <div>
                <label
                  for="announcement-edit-name"
                  class="mb-2 block text-xs font-bold text-text-secondary"
                >
                  {{ locale.editAnnouncementTitleLabel }}
                </label>
                <input
                  id="announcement-edit-name"
                  ref="editTitleInput"
                  v-model="editForm.title"
                  type="text"
                  maxlength="120"
                  class="min-h-11 w-full rounded-lg border border-panel-bg-dark bg-panel-bg-darkest px-4 text-sm text-text-primary-light outline-none transition-colors placeholder:text-text-disabled focus:border-primary-40"
                  :placeholder="locale.editAnnouncementTitlePlaceholder"
                >
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between gap-3">
                  <label
                    for="announcement-edit-content"
                    class="text-xs font-bold text-text-secondary"
                  >
                    {{ locale.editAnnouncementContent }}
                  </label>
                  <span class="text-[10px] font-bold text-text-disabled">Markdown</span>
                </div>
                <textarea
                  id="announcement-edit-content"
                  v-model="editForm.content"
                  maxlength="20000"
                  rows="10"
                  class="w-full resize-y rounded-lg border border-panel-bg-dark bg-panel-bg-darkest px-4 py-4 text-sm leading-relaxed text-text-primary-light outline-none transition-colors placeholder:text-text-disabled focus:border-primary-40"
                  :placeholder="locale.editAnnouncementContentPlaceholder"
                />
              </div>

              <div>
                <p class="mb-2 text-xs font-bold text-text-secondary">
                  {{ locale.displayModeLabel }}
                </p>
                <div class="inline-flex max-w-full items-center gap-1 rounded-lg border border-panel-bg-dark bg-panel-bg-darkest p-1">
                  <button
                    v-for="option in displayModeOptions"
                    :key="option.value"
                    type="button"
                    class="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-bold transition-colors"
                    :class="
                      editForm.displayMode === option.value
                        ? 'bg-panel-bg-dark text-text-primary-lighter'
                        : 'text-text-tertiary hover:text-text-secondary'
                    "
                    @click="editForm.displayMode = option.value"
                  >
                    <component :is="option.icon" :size="14" />
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div v-if="editForm.displayMode === 'scroll'">
                <div class="mb-2 flex items-center justify-between gap-3">
                  <span class="text-xs font-bold text-text-secondary">{{ locale.scrollSpeed }}</span>
                  <span class="text-xs font-bold text-primary">
                    {{ speedLabel(editForm.scrollSpeed) }}
                  </span>
                </div>
                <input
                  v-model.number="editForm.scrollSpeed"
                  type="range"
                  min="8"
                  max="120"
                  step="1"
                  class="w-full accent-primary"
                  :aria-label="locale.scrollSpeed"
                >
                <p class="mt-2 text-[10px] leading-relaxed text-text-disabled">
                  {{ locale.scrollSpeedHint }}
                </p>
              </div>

              <div v-if="editForm.content.trim()">
                <p class="mb-2 text-xs font-bold text-text-secondary">{{ locale.preview }}</p>
                <div
                  class="markdown-body max-h-56 overflow-y-auto border-y border-panel-bg-dark py-4 text-xs text-text-muted"
                  v-html="renderMarkdown(editForm.content)"
                />
              </div>

              <div
                v-if="editError"
                class="rounded-lg border border-error-20 bg-error-5 p-3 text-xs font-medium text-error-light"
                role="alert"
              >
                {{ editError }}
              </div>
            </div>

            <footer
              class="flex shrink-0 flex-col-reverse gap-3 border-t border-panel-bg-dark-50 bg-panel-bg-deepest-50 px-5 py-5 sm:flex-row sm:justify-end sm:px-8 sm:py-6"
            >
              <button
                type="button"
                :disabled="editSaving"
                class="min-h-10 px-6 text-xs font-bold text-text-tertiary transition-colors hover:text-text-secondary disabled:cursor-wait disabled:opacity-50"
                @click="closeEdit"
              >
                {{ locale.cancel }}
              </button>
              <button
                type="submit"
                :disabled="editSaving"
                class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-xs font-black text-white transition-colors hover:bg-primary disabled:cursor-wait disabled:opacity-50"
              >
                <Loader2 v-if="editSaving" :size="15" class="animate-spin" />
                <Save v-else :size="15" />
                {{ editSaving ? locale.saving : locale.save }}
              </button>
            </footer>
          </form>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      :show="Boolean(deletingItem)"
      :title="locale.deleteAnnouncement"
      :message="
        deletingItem
          ? locale.deleteAnnouncementConfirmation(
              deletingItem.title || locale.announcementUntitled,
              Boolean(deletingItem.isActive)
            )
          : ''
      "
      :confirm-text="locale.confirmDelete"
      :cancel-text="locale.cancel"
      :loading="deleteLoading"
      :close-on-overlay="!deleteLoading"
      type="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
      @update:show="handleDeleteDialogVisibility"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertCircle,
  AlignLeft,
  Eye,
  History,
  Inbox,
  Loader2,
  Megaphone,
  MoveHorizontal,
  Pencil,
  Radio,
  RefreshCw,
  Save,
  Trash2,
  X
} from '@lucide/vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import Icon from '~/components/UI/Icon.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import { useAuth } from '~/composables/useAuth'
import { useServerErrors } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'
import { renderMarkdown } from '~/utils/markdown'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  refreshKey: {
    type: Number,
    default: 0
  }
})

const { getAuthConfig } = useAuth()
const { localize: localizeServerError } = useServerErrors()
const { showToast } = useToast()
const { admin, currentLocale } = useLocale()
const locale = computed(() => admin.value?.notificationSender?.history || {})
const announcements = ref([])
const loading = ref(false)
const error = ref('')
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const previewItem = ref(null)
const closeButton = ref(null)
const editingItem = ref(null)
const editForm = ref({ title: '', content: '', displayMode: 'static', scrollSpeed: 30 })
const editSaving = ref(false)
const editError = ref('')
const editTitleInput = ref(null)
const deletingItem = ref(null)
const deleteLoading = ref(false)
let requestVersion = 0
let previousFocus = null
let previousBodyOverflow = ''

const displayModeOptions = computed(() => [
  { value: 'static', label: locale.value.displayModes?.static || '', icon: AlignLeft },
  { value: 'scroll', label: locale.value.displayModes?.scroll || '', icon: MoveHorizontal }
])

const loadHistory = async () => {
  const activeRequest = ++requestVersion
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/admin/notifications/announcement-history', {
      query: {
        page: pagination.value.page,
        limit: pagination.value.limit
      },
      ...getAuthConfig()
    })

    if (activeRequest !== requestVersion) return

    announcements.value = response.announcements || []
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

const openPreview = async (item) => {
  previewItem.value = item
  previousFocus = document.activeElement
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  closeButton.value?.focus()
}

const closePreview = () => {
  previewItem.value = null
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => previousFocus?.focus?.())
}

const openEdit = async (item) => {
  editingItem.value = item
  editForm.value = {
    title: item.title || '',
    content: item.content || '',
    displayMode: item.displayMode === 'scroll' ? 'scroll' : 'static',
    scrollSpeed: Number(item.scrollSpeed) || 30
  }
  editError.value = ''
  previousFocus = document.activeElement
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  editTitleInput.value?.focus()
}

const closeEdit = () => {
  if (editSaving.value) return
  editingItem.value = null
  editError.value = ''
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => previousFocus?.focus?.())
}

const saveEdit = async () => {
  if (!editingItem.value?.id || editSaving.value) return

  const title = editForm.value.title.trim()
  const content = editForm.value.content.trim()
  if (!content) {
    editError.value = locale.value.announcementContentRequired
    return
  }
  if (title.length > 120) {
    editError.value = locale.value.announcementTitleTooLong(120)
    return
  }
  if (content.length > 20000) {
    editError.value = locale.value.announcementContentTooLong(20000)
    return
  }

  editSaving.value = true
  editError.value = ''
  let saved = false

  try {
    await $fetch(
      `/api/admin/notifications/announcement-history/${encodeURIComponent(editingItem.value.id)}`,
      {
        method: 'PUT',
        body: {
          title,
          content,
          displayMode: editForm.value.displayMode,
          scrollSpeed: editForm.value.scrollSpeed
        },
        ...getAuthConfig()
      }
    )

    await loadHistory()
    saved = true
    showToast(locale.value.announcementUpdateSuccess, 'success')
  } catch (saveError) {
    editError.value = localizeServerError(saveError, locale.value.announcementUpdateFailed)
  } finally {
    editSaving.value = false
  }

  if (saved) closeEdit()
}

const requestDelete = (item) => {
  deletingItem.value = item
}

const cancelDelete = () => {
  if (deleteLoading.value) return
  deletingItem.value = null
}

const handleDeleteDialogVisibility = (show) => {
  if (!show) cancelDelete()
}

const confirmDelete = async () => {
  if (!deletingItem.value?.id || deleteLoading.value) return

  deleteLoading.value = true
  const shouldGoToPreviousPage = announcements.value.length === 1 && pagination.value.page > 1

  try {
    await $fetch(
      `/api/admin/notifications/announcement-history/${encodeURIComponent(deletingItem.value.id)}`,
      {
        method: 'DELETE',
        ...getAuthConfig()
      }
    )
    deletingItem.value = null
    if (shouldGoToPreviousPage) pagination.value.page -= 1
    await loadHistory()
    showToast(locale.value.announcementDeleteSuccess, 'success')
  } catch (deleteError) {
    showToast(localizeServerError(deleteError, locale.value.announcementDeleteFailed), 'error')
  } finally {
    deleteLoading.value = false
  }
}

const speedLabel = (seconds) => {
  const formatter = locale.value.scrollSpeedValue
  return typeof formatter === 'function' ? formatter(seconds) : `${seconds}s`
}

const plainText = (value) =>
  String(value || '')
    .replace(/[#>*_`~\-]/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

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

const senderName = (item) =>
  item?.senderName?.trim() || item?.senderUsername?.trim() || locale.value.systemSender

watch(
  () => props.refreshKey,
  () => refreshHistory()
)

onMounted(loadHistory)
onUnmounted(() => {
  requestVersion += 1
  if (previewItem.value || editingItem.value) {
    document.body.style.overflow = previousBodyOverflow
  }
})
</script>

<style scoped>
/* 预览弹窗里的公告卡：复原首页公告栏视觉 */
.announcement-card {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  background: var(--primary-light, rgba(59, 130, 246, 0.1));
  border: 1px solid var(--primary-border, rgba(59, 130, 246, 0.25));
  border-radius: 10px;
  padding: 0.75rem 1rem;
}
.announcement-card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 2px;
  color: var(--primary);
}
.announcement-card-title {
  margin: 0 0 2px;
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.4;
  color: var(--primary);
}
.announcement-card-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-primary);
}
.announcement-card-inline-title {
  margin-right: 0.5rem;
  font-weight: 800;
  color: var(--primary);
}
/* 滚动模式在首页是一行跑马灯，预览时同样压成单行更贴近实际效果 */
.announcement-card-text.is-inline :deep(*) {
  display: inline;
  margin: 0;
  padding: 0;
  font-size: inherit;
  line-height: inherit;
}
.announcement-card-text.is-inline :deep(li:not(:first-child))::before {
  content: ' · ';
}
</style>
