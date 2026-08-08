<template>
  <section class="border-t border-panel-bg-dark pt-8">
    <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <History :size="18" class="text-primary" />
          <h3 class="text-lg font-black text-text-primary-lighter">{{ locale.title }}</h3>
        </div>
        <p class="mt-1 text-xs text-text-tertiary">{{ locale.description }}</p>
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

    <div class="mt-5 rounded-lg border border-panel-bg-dark bg-panel-bg-deepest-30 p-3">
      <div
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_170px_190px_170px_auto]"
      >
        <div class="relative sm:col-span-2 xl:col-span-1">
          <Search
            :size="15"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled"
          />
          <input
            v-model="filters.keyword"
            type="search"
            maxlength="100"
            class="min-h-11 w-full rounded-lg border border-panel-bg-dark bg-panel-bg-darkest pl-9 pr-3 text-xs text-text-primary-light outline-none transition-colors placeholder:text-text-disabled focus:border-primary-40"
            :placeholder="locale.searchPlaceholder"
            :aria-label="locale.searchPlaceholder"
            @input="scheduleHistorySearch"
            @keydown.enter.prevent="applyHistoryFilters"
          >
        </div>

        <CustomSelect
          v-model="filters.type"
          :label="locale.typeFilter"
          :options="typeFilterOptions"
          class-name="w-full"
          @change="applyHistoryFilters"
        />

        <CustomSelect
          v-model="filters.sender"
          :label="locale.senderFilter"
          :options="senderFilterOptions"
          class-name="w-full"
          @change="applyHistoryFilters"
        />

        <CustomSelect
          v-model="filters.sortOrder"
          :label="locale.sentAtSort"
          :options="sortOptions"
          class-name="w-full"
          @change="applyHistoryFilters"
        />

        <button
          type="button"
          :disabled="!hasActiveFilters || loading"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-panel-bg-dark px-4 text-xs font-bold text-text-tertiary transition-colors hover:border-panel-bg-hover hover:text-text-primary-light disabled:cursor-not-allowed disabled:opacity-40"
          @click="clearHistoryFilters"
        >
          <X :size="14" />
          {{ locale.clearFilters }}
        </button>
      </div>
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
      v-if="loading && notifications.length === 0"
      class="flex min-h-56 items-center justify-center text-text-disabled"
    >
      <Loader2 :size="22" class="animate-spin" />
      <span class="ml-3 text-xs font-bold">{{ locale.loading }}</span>
    </div>

    <div
      v-else-if="notifications.length === 0"
      class="mt-6 flex min-h-56 flex-col items-center justify-center border-y border-panel-bg-dark text-center"
    >
      <Inbox :size="28" class="text-text-disabled" />
      <p class="mt-3 text-sm font-bold text-text-muted">
        {{ hasActiveFilters ? locale.filteredEmpty : locale.empty }}
      </p>
      <p class="mt-1 text-xs text-text-disabled">
        {{ hasActiveFilters ? locale.filteredEmptyDescription : locale.emptyDescription }}
      </p>
    </div>

    <template v-else>
      <div class="mt-6 hidden overflow-x-auto rounded-lg border border-panel-bg-dark md:block">
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead class="bg-panel-bg-deepest-80 text-[10px] font-black uppercase text-text-disabled">
            <tr>
              <th class="px-5 py-3">{{ locale.notification }}</th>
              <th class="px-5 py-3">{{ locale.type }}</th>
              <th class="px-5 py-3">{{ locale.sender }}</th>
              <th class="px-5 py-3">{{ locale.recipientCountLabel }}</th>
              <th class="px-5 py-3">{{ locale.sentAt }}</th>
              <th class="px-5 py-3 text-right">{{ locale.actions }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-panel-bg-dark-80 bg-panel-bg-darkest-40">
            <tr v-for="item in notifications" :key="item.batchId" class="hover:bg-panel-bg-deepest-40">
              <td class="max-w-[380px] px-5 py-4 align-top">
                <p class="truncate text-sm font-bold text-text-primary-light">
                  {{ item.title || locale.untitled }}
                </p>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-text-disabled">
                  {{ item.message }}
                </p>
              </td>
              <td class="px-5 py-4 align-top">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold"
                  :class="
                    item.important
                      ? 'border-warning-20 bg-warning-10 text-warning-light'
                      : 'border-panel-bg-hover bg-panel-bg-deepest text-text-tertiary'
                  "
                >
                  <Icon :name="item.important ? 'bell-ring' : 'bell'" :size="12" />
                  {{ item.important ? locale.important : locale.normal }}
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-text-muted">
                {{ senderName(item) }}
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-text-muted">
                {{ locale.recipientCount(item.recipientCount) }}
              </td>
              <td class="whitespace-nowrap px-5 py-4 align-top text-xs text-text-tertiary">
                {{ formatDateTime(item.createdAt) }}
              </td>
              <td class="px-5 py-4 text-right align-top">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-lg border border-panel-bg-hover text-text-muted transition-colors hover:border-primary-50 hover:bg-primary-10 hover:text-primary-light"
                    :title="locale.viewDetails"
                    :aria-label="locale.viewDetails"
                    @click="openDetails(item)"
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
        <article v-for="item in notifications" :key="item.batchId" class="py-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="break-words text-sm font-bold text-text-primary-light">
                {{ item.title || locale.untitled }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-text-disabled">
                {{ item.message }}
              </p>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold"
              :class="item.important ? 'text-warning-light' : 'text-text-tertiary'"
            >
              <Icon :name="item.important ? 'bell-ring' : 'bell'" :size="12" />
              {{ item.important ? locale.important : locale.normal }}
            </span>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
            <span class="inline-flex items-center gap-1.5">
              <Users :size="14" />
              {{ locale.recipientCount(item.recipientCount) }}
            </span>
            <span>{{ locale.sender }}：{{ senderName(item) }}</span>
            <span>{{ formatDateTime(item.createdAt) }}</span>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-panel-bg-hover text-xs font-bold text-text-secondary transition-colors hover:border-primary-50 hover:bg-primary-10 hover:text-primary-light"
              @click="openDetails(item)"
            >
              <Eye :size="14" />
              {{ locale.view }}
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
        :item-name="locale.itemName"
        @change="loadHistory"
      />
    </template>

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
          v-if="selectedBatch"
          class="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-panel-bg-darkest-80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-detail-title"
          @click.self="closeDetails"
          @keydown.esc="closeDetails"
        >
          <div
            class="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-panel-bg-dark bg-panel-bg-deepest shadow-2xl"
          >
            <header
              class="flex shrink-0 items-start justify-between gap-4 border-b border-panel-bg-dark-50 px-5 py-5 sm:px-8 sm:py-6"
            >
              <div class="min-w-0">
                <p class="text-[10px] font-black uppercase text-primary">
                  {{ locale.detailsEyebrow }}
                </p>
                <h2
                  id="notification-detail-title"
                  class="mt-1 break-words text-lg font-black text-text-primary-lighter"
                >
                  {{ selectedBatch.title || locale.untitled }}
                </h2>
                <p class="mt-1 text-xs text-text-tertiary">
                  {{ formatDateTime(selectedBatch.createdAt) }}
                </p>
                <p class="mt-1 text-xs text-text-tertiary">
                  {{ locale.sender }}：{{ senderName(selectedBatch) }}
                </p>
              </div>
              <button
                ref="closeButton"
                type="button"
                class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-panel-bg-dark hover:text-text-primary-lighter"
                :title="locale.close"
                :aria-label="locale.close"
                @click="closeDetails"
              >
                <X :size="19" />
              </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:p-8">
              <p class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-text-tertiary">
                {{ selectedBatch.message }}
              </p>

              <div
                class="mt-5 inline-flex max-w-full overflow-x-auto rounded-lg border border-panel-bg-dark bg-panel-bg-darkest p-1"
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
                      ? 'bg-panel-bg-dark text-text-primary-lighter'
                      : 'text-text-tertiary hover:text-text-secondary'
                  "
                  @click="setDetailStatus(option.value)"
                >
                  <component :is="option.icon" :size="14" />
                  {{ option.label }}
                  <span
                    class="min-w-6 rounded bg-panel-bg-deepest px-1.5 py-0.5 text-center text-[10px] text-text-muted"
                  >
                    {{ option.count }}
                  </span>
                </button>
              </div>

              <div
                v-if="detailError"
                class="mt-5 flex items-start justify-between gap-4 rounded-lg border border-error-20 bg-error-5 p-4"
                role="alert"
              >
                <p class="break-words text-xs font-medium text-error-light">{{ detailError }}</p>
                <button
                  type="button"
                  class="shrink-0 text-xs font-bold text-error-light"
                  @click="loadDetails"
                >
                  {{ locale.retry }}
                </button>
              </div>

              <div
                v-if="detailLoading"
                class="flex min-h-48 items-center justify-center text-text-disabled"
              >
                <Loader2 :size="22" class="animate-spin" />
                <span class="ml-3 text-xs font-bold">{{ locale.detailsLoading }}</span>
              </div>

              <div
                v-else-if="recipients.length === 0"
                class="mt-5 flex min-h-48 items-center justify-center border-y border-panel-bg-dark text-xs text-text-disabled"
              >
                {{ locale.noRecipients }}
              </div>

              <template v-else>
                <div class="mt-5 hidden overflow-x-auto rounded-lg border border-panel-bg-dark sm:block">
                  <table class="w-full min-w-[620px] border-collapse text-left">
                    <thead class="bg-panel-bg-darkest-60 text-[10px] font-black uppercase text-text-tertiary">
                      <tr>
                        <th class="px-4 py-3">{{ locale.recipient }}</th>
                        <th class="px-4 py-3">{{ locale.status }}</th>
                        <th class="px-4 py-3">{{ locale.readAt }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-panel-bg-dark-80">
                      <tr v-for="item in recipients" :key="item.id">
                        <td class="px-4 py-3">
                          <p class="text-xs font-bold text-text-secondary">{{ recipientName(item) }}</p>
                          <p class="mt-1 text-[10px] text-text-disabled">{{ recipientMeta(item) }}</p>
                        </td>
                        <td class="px-4 py-3">
                          <span
                            class="inline-flex items-center gap-1.5 text-xs font-bold"
                            :class="item.read ? 'text-success' : 'text-warning-light'"
                          >
                            <CheckCircle2 v-if="item.read" :size="14" />
                            <Circle v-else :size="14" />
                            {{ item.read ? locale.read : locale.unread }}
                          </span>
                        </td>
                        <td class="whitespace-nowrap px-4 py-3 text-xs text-text-tertiary">
                          {{ item.readAt ? formatDateTime(item.readAt) : locale.notRead }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="mt-5 divide-y divide-panel-bg-dark border-y border-panel-bg-dark sm:hidden">
                  <article v-for="item in recipients" :key="item.id" class="py-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="break-words text-xs font-bold text-text-secondary">
                          {{ recipientName(item) }}
                        </p>
                        <p class="mt-1 break-words text-[10px] text-text-disabled">
                          {{ recipientMeta(item) }}
                        </p>
                      </div>
                      <span
                        class="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold"
                        :class="item.read ? 'text-success' : 'text-warning-light'"
                      >
                        <CheckCircle2 v-if="item.read" :size="14" />
                        <Circle v-else :size="14" />
                        {{ item.read ? locale.read : locale.unread }}
                      </span>
                    </div>
                    <p class="mt-3 text-[10px] text-text-disabled">
                      {{ locale.readAt }}：{{
                        item.readAt ? formatDateTime(item.readAt) : locale.notRead
                      }}
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
      </Transition>
    </Teleport>

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
          v-if="editingBatch"
          class="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-panel-bg-darkest-80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-edit-title"
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
                <h2 id="notification-edit-title" class="mt-1 text-lg font-black text-text-primary-lighter">
                  {{ locale.editNotification }}
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
                  for="notification-edit-name"
                  class="mb-2 block text-xs font-bold text-text-secondary"
                >
                  {{ locale.editTitle }}
                </label>
                <input
                  id="notification-edit-name"
                  ref="editTitleInput"
                  v-model="editForm.title"
                  type="text"
                  maxlength="200"
                  class="min-h-11 w-full rounded-lg border border-panel-bg-dark bg-panel-bg-darkest px-4 text-sm text-text-primary-light outline-none transition-colors placeholder:text-text-disabled focus:border-primary-40"
                  :placeholder="locale.editTitlePlaceholder"
                >
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between gap-3">
                  <label for="notification-edit-content" class="text-xs font-bold text-text-secondary">
                    {{ locale.editContent }}
                  </label>
                  <span class="text-[10px] font-bold text-text-disabled">Markdown</span>
                </div>
                <textarea
                  id="notification-edit-content"
                  v-model="editForm.content"
                  maxlength="20000"
                  rows="10"
                  class="w-full resize-y rounded-lg border border-panel-bg-dark bg-panel-bg-darkest px-4 py-4 text-sm leading-relaxed text-text-primary-light outline-none transition-colors placeholder:text-text-disabled focus:border-primary-40"
                  :placeholder="locale.editContentPlaceholder"
                />
              </div>

              <label class="flex cursor-pointer items-start gap-3 border-y border-panel-bg-dark py-4">
                <input
                  v-model="editForm.important"
                  type="checkbox"
                  class="mt-0.5 size-4 shrink-0 accent-amber-500"
                >
                <span>
                  <span class="block text-xs font-bold text-text-primary-light">{{
                    locale.editImportant
                  }}</span>
                  <span class="mt-1 block text-[10px] leading-relaxed text-text-tertiary">
                    {{ locale.editImportantDescription }}
                  </span>
                </span>
              </label>

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
      :show="Boolean(deletingBatch)"
      :title="locale.deleteNotification"
      :message="
        deletingBatch ? locale.deleteConfirmation(deletingBatch.title || locale.untitled) : ''
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
  CheckCircle2,
  Circle,
  Eye,
  History,
  Inbox,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  X
} from '@lucide/vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
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
const notifications = ref([])
const senders = ref([])
const loading = ref(false)
const error = ref('')
const filters = ref({ keyword: '', type: 'ALL', sender: '', sortOrder: 'DESC' })
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const selectedBatch = ref(null)
const recipients = ref([])
const detailLoading = ref(false)
const detailError = ref('')
const detailStatus = ref('ALL')
const detailStats = ref({ total: 0, read: 0, unread: 0 })
const detailPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const closeButton = ref(null)
const editingBatch = ref(null)
const editForm = ref({ title: '', content: '', important: false })
const editSaving = ref(false)
const editError = ref('')
const editTitleInput = ref(null)
const deletingBatch = ref(null)
const deleteLoading = ref(false)
let requestVersion = 0
let detailRequestVersion = 0
let searchTimer = null
let previousFocus = null
let previousBodyOverflow = ''

const detailFilterOptions = computed(() => [
  { value: 'ALL', label: locale.value.all, count: detailStats.value.total, icon: Users },
  { value: 'READ', label: locale.value.read, count: detailStats.value.read, icon: CheckCircle2 },
  { value: 'UNREAD', label: locale.value.unread, count: detailStats.value.unread, icon: Circle }
])

const typeFilterOptions = computed(() => [
  { value: 'ALL', label: locale.value.allTypes },
  { value: 'NORMAL', label: locale.value.normal },
  { value: 'IMPORTANT', label: locale.value.important }
])

const senderFilterOptions = computed(() => [
  { value: '', label: locale.value.allSenders },
  ...senders.value.map((sender) => ({
    value: String(sender.id),
    label:
      sender.name?.trim() || sender.username?.trim() || locale.value.unknownUser(sender.id)
  }))
])

const sortOptions = computed(() => [
  { value: 'DESC', label: locale.value.newestFirst },
  { value: 'ASC', label: locale.value.oldestFirst }
])

const hasActiveFilters = computed(
  () =>
    Boolean(filters.value.keyword.trim()) ||
    filters.value.type !== 'ALL' ||
    Boolean(filters.value.sender)
)

const loadHistory = async () => {
  const activeRequest = ++requestVersion
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/admin/notifications/history', {
      query: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        keyword: filters.value.keyword.trim(),
        type: filters.value.type,
        sender: filters.value.sender,
        sortOrder: filters.value.sortOrder
      },
      ...getAuthConfig()
    })

    if (activeRequest !== requestVersion) return

    notifications.value = response.notifications || []
    senders.value = response.senders || []
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

const applyHistoryFilters = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  pagination.value.page = 1
  notifications.value = []
  loadHistory()
}

const scheduleHistorySearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(applyHistoryFilters, 300)
}

const clearHistoryFilters = () => {
  filters.value = {
    keyword: '',
    type: 'ALL',
    sender: '',
    sortOrder: filters.value.sortOrder
  }
  applyHistoryFilters()
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

const openEdit = async (item) => {
  editingBatch.value = item
  editForm.value = {
    title: item.title || '',
    content: item.message || '',
    important: Boolean(item.important)
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
  editingBatch.value = null
  editError.value = ''
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => previousFocus?.focus?.())
}

const saveEdit = async () => {
  if (!editingBatch.value?.batchId || editSaving.value) return

  const title = editForm.value.title.trim()
  const content = editForm.value.content.trim()
  if (!title || !content) {
    editError.value = locale.value.titleContentRequired
    return
  }
  if (title.length > 200) {
    editError.value = locale.value.titleTooLong(200)
    return
  }
  if (content.length > 20000) {
    editError.value = locale.value.contentTooLong(20000)
    return
  }

  editSaving.value = true
  editError.value = ''
  let saved = false

  try {
    await $fetch(
      `/api/admin/notifications/history/${encodeURIComponent(editingBatch.value.batchId)}`,
      {
        method: 'PUT',
        body: {
          title,
          content,
          important: editForm.value.important
        },
        ...getAuthConfig()
      }
    )

    await loadHistory()
    saved = true
    showToast(locale.value.updateSuccess, 'success')
  } catch (saveError) {
    editError.value = localizeServerError(saveError, locale.value.updateFailed)
  } finally {
    editSaving.value = false
  }

  if (saved) closeEdit()
}

const requestDelete = (item) => {
  deletingBatch.value = item
}

const cancelDelete = () => {
  if (deleteLoading.value) return
  deletingBatch.value = null
}

const handleDeleteDialogVisibility = (show) => {
  if (!show) cancelDelete()
}

const confirmDelete = async () => {
  if (!deletingBatch.value?.batchId || deleteLoading.value) return

  deleteLoading.value = true
  const shouldGoToPreviousPage = notifications.value.length === 1 && pagination.value.page > 1

  try {
    await $fetch(
      `/api/admin/notifications/history/${encodeURIComponent(deletingBatch.value.batchId)}`,
      {
        method: 'DELETE',
        ...getAuthConfig()
      }
    )
    deletingBatch.value = null
    if (shouldGoToPreviousPage) pagination.value.page -= 1
    await loadHistory()
    showToast(locale.value.deleteSuccess, 'success')
  } catch (deleteError) {
    showToast(localizeServerError(deleteError, locale.value.deleteFailed), 'error')
  } finally {
    deleteLoading.value = false
  }
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
  item.recipient?.name || item.recipient?.username || locale.value.unknownUser(item.recipient?.id)

const recipientMeta = (item) => {
  const details = []
  if (item.recipient?.username) details.push(`@${item.recipient.username}`)
  if (item.recipient?.grade) details.push(item.recipient.grade)
  if (item.recipient?.class) details.push(item.recipient.class)
  return details.join(' · ') || locale.value.userId(item.recipient?.id)
}

const senderName = (item) =>
  item?.sender?.name?.trim() || item?.sender?.username?.trim() || locale.value.systemSender

watch(
  () => props.refreshKey,
  () => refreshHistory()
)

onMounted(loadHistory)
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  requestVersion += 1
  detailRequestVersion += 1
  if (selectedBatch.value || editingBatch.value) {
    document.body.style.overflow = previousBodyOverflow
  }
})
</script>
