<template>
  <div class="space-y-6">
    <ConfirmDialog
      :show="statusConfirmOpen"
      :title="locale.statusChangeTitle"
      :message="statusConfirmMessage"
      :loading="saving"
      type="warning"
      :confirm-text="locale.statusChangeConfirm"
      :cancel-text="locale.statusChangeCancel"
      @confirm="confirmStatusUpdate"
      @close="closeStatusConfirm"
    />

    <ConfirmDialog
      :show="genericConfirm.open"
      :title="genericConfirm.title"
      :message="genericConfirm.message"
      type="warning"
      @confirm="runGenericConfirm"
      @close="closeGenericConfirm"
    />

    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 class="text-lg font-black">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1 font-medium">
          {{ locale.desc }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-secondary bg-bg-secondary text-text-secondary text-xs font-bold hover:border-border-tertiary transition-all"
          @click="refreshAll"
        >
          <RefreshCw :size="14" /> {{ locale.refresh }}
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-secondary bg-bg-secondary text-text-secondary text-xs font-bold hover:border-border-tertiary transition-all"
          :disabled="exporting"
          @click="exportCodes"
        >
          <Download :size="14" /> {{ exporting ? locale.exporting : exportButtonText }}
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-secondary bg-bg-secondary text-text-secondary text-xs font-bold hover:border-border-tertiary transition-all"
          @click="openDispatchFromSelection"
        >
          <Send :size="14" /> {{ locale.dispatchCoupon || '派发点歌券' }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div v-for="item in stats" :key="item.label" class="rounded-2xl border border-border-secondary bg-bg-secondary-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.24em] text-text-tertiary">{{ item.label }}</p>
        <div class="mt-2 flex items-end justify-between gap-2">
          <span class="text-2xl font-black text-text-primary">{{ item.value }}</span>
          <span :class="['text-[10px] font-bold px-2 py-1 rounded-full', item.badgeClass]">{{ item.hint }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <section class="min-w-0 rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-1 flex-col sm:flex-row gap-3">
            <div class="relative flex-1">
              <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
              <input
                v-model="filters.q"
                type="text"
                :placeholder="locale.searchPlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40 transition-all"
                @keyup.enter="fetchCodes(1)"
              >
            </div>

            <CustomSelect
              v-model="filters.status"
              :label="locale.status"
              :options="statusFilterOptions"
              label-key="label"
              value-key="value"
              :placeholder="locale.allStatus"
              class-name="min-w-[160px] sm:w-40"
              @change="fetchCodes(1)"
            />
          </div>

          <button
            class="text-xs font-bold text-text-tertiary hover:text-text-primary transition-colors"
            @click="resetFilters"
          >
            {{ locale.clearFilters }}
          </button>
        </div>

        <div v-if="selectedIds.length" class="flex flex-wrap items-center gap-2 rounded-xl border border-primary-20 bg-primary-5 p-3">
          <span class="text-xs font-black text-primary">{{ getLocaleMessage('selectedItems', selectedIds.length) }}</span>
          <CustomSelect
            v-model="bulkStatus"
            :options="bulkStatusOptions"
            label-key="label"
            value-key="value"
            class-name="w-32"
          />
          <button
            class="px-3 py-2 rounded-lg bg-primary-hover text-text-primary text-xs font-bold hover:bg-primary transition-colors"
            :disabled="saving"
            @click="applyBulkStatus"
          >
            {{ locale.applyBulk }}
          </button>
          <button
            class="px-3 py-2 rounded-lg bg-primary text-text-primary text-xs font-bold hover:bg-primary-hover transition-colors"
            @click="openDispatchFromSelection"
          >
            {{ locale.dispatchSelected }}
          </button>
          <button class="px-3 py-2 rounded-lg bg-bg-secondary text-text-secondary text-xs font-bold border border-border-secondary" @click="clearSelection">
            {{ locale.cancelSelection }}
          </button>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-border-secondary">
          <div v-if="loading" class="flex min-w-[880px] items-center justify-center bg-bg-primary-60 p-8 text-center text-sm text-text-tertiary">
            <AppSpinner :size="22" />
            <span class="ml-2">{{ locale.loading }}</span>
          </div>

          <table v-else class="min-w-[880px] table-fixed text-left text-sm">
            <thead class="bg-bg-primary-80 text-text-tertiary">
              <tr>
                <th class="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-border-tertiary bg-bg-secondary text-primary"
                    :checked="allVisibleSelected"
                    :indeterminate="someVisibleSelected && !allVisibleSelected"
                    @change="toggleSelectAll"
                  >
                </th>
                <th class="px-3 py-3 w-16">ID</th>
                <th class="px-3 py-3 w-64">{{ locale.cardCode }}</th>
                <th class="px-3 py-3 w-28">{{ locale.status }}</th>
                <th class="px-3 py-3 w-60">{{ locale.note }}</th>
                <th class="px-3 py-3 w-40">{{ locale.time }}</th>
                <th class="px-3 py-3 w-44">{{ locale.actions }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in codes" :key="item.id" class="border-t border-border-secondary-80 hover:bg-bg-primary-70 transition-colors">
                <td class="px-3 py-3 align-top">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-border-tertiary bg-bg-secondary text-primary"
                    :checked="selectedIds.includes(item.id)"
                    @change="toggleSelect(item.id)"
                  >
                </td>
                <td class="px-3 py-3 align-top text-text-tertiary">{{ item.id }}</td>
                <td class="px-3 py-3 align-top font-mono text-text-primary">
                  <div class="flex max-w-full items-center gap-2 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2">
                    <span class="block min-w-0 flex-1 truncate text-xs tracking-[0.08em]" :title="item.code">{{ item.code }}</span>
                    <button class="shrink-0 text-text-tertiary hover:text-text-primary transition-colors" :title="locale.copy" @click="copyCode(item.code)">
                      <Copy :size="14" />
                    </button>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">
                  <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.2em]', statusMeta(item.status).class]">
                    {{ statusMeta(item.status).label }}
                  </span>
                  <p v-if="item.lockedAt || item.redeemedAt" class="mt-1 text-[10px] text-text-tertiary leading-relaxed">
                    <span v-if="item.lockedAt">{{ getLocaleMessage('lockedAt', formatDate(item.lockedAt)) }}</span>
                    <span v-if="item.redeemedAt">{{ item.lockedAt ? ' · ' : '' }}{{ getLocaleMessage('redeemedAt', formatDate(item.redeemedAt)) }}</span>
                  </p>
                  <p v-if="item.assignedTo" class="mt-1 text-[10px] text-info leading-relaxed">
                    {{ locale.assignmentAssignee }}: {{ item.assigneeName || item.assigneeUsername || item.assignedTo }}
                    <span v-if="item.assignedAt" class="block text-text-tertiary">{{ formatDate(item.assignedAt) }}</span>
                  </p>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="space-y-2">
                    <textarea
                      v-model="item.noteDraft"
                      rows="2"
                      :placeholder="locale.note"
                      class="w-full resize-none rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
                    />
                    <button class="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-primary transition-colors" @click="saveNote(item)">
                      {{ locale.saveNote }}
                    </button>
                  </div>
                </td>
                <td class="px-3 py-3 align-top text-[11px] text-text-tertiary leading-relaxed">
                  <p>{{ getLocaleMessage('createdAt', formatDate(item.createdAt)) }}</p>
                  <p>{{ getLocaleMessage('updatedAt', formatDate(item.updatedAt)) }}</p>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex flex-wrap gap-2">
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-text-secondary disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving" @click="requestStatusUpdate([item.id], 'AVAILABLE')">{{ locale.available }}</button>
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-warning disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving" @click="requestStatusUpdate([item.id], 'LOCKED')">{{ locale.locked }}</button>
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-success disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving" @click="requestStatusUpdate([item.id], 'REDEEMED')">{{ locale.redeemed }}</button>
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-error disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving" @click="requestStatusUpdate([item.id], 'INVALID')">{{ locale.invalid }}</button>
                    <!-- 禁用态的按钮不会派发鼠标事件，title 挂在外层 span 才能可靠悬停显示 -->
                    <span
                      :title="item.status === 'AVAILABLE' ? (locale.dispatchRowHint || '派发这张点歌券给指定用户') : dispatchDisabledReason(item)"
                    >
                      <button
                        class="rounded-lg border border-primary-30 bg-primary-10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-colors hover:border-primary-50 hover:bg-primary-20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-primary-30 disabled:hover:bg-primary-10"
                        :disabled="item.status !== 'AVAILABLE'"
                        @click="openDispatchForCode(item)"
                      >
                        {{ locale.dispatch }}
                      </button>
                    </span>
                  </div>
                </td>
              </tr>
              <tr v-if="!codes.length">
                <td colspan="7" class="px-3 py-10 text-center text-sm text-text-tertiary">{{ locale.empty }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-model:current-page="pagination.page"
          :total-pages="pagination.totalPages"
          :total-items="pagination.total"
          :item-name="locale.itemName"
          @change="fetchCodes"
        />
      </section>

      <section class="space-y-4">
        <div class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-4 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-black text-text-primary">{{ locale.createTitle }}</h3>
              <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.createDesc }}</p>
            </div>
            <div class="inline-flex shrink-0 rounded-xl border border-border-secondary bg-bg-primary p-1">
              <button
                :class="['min-w-[72px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors', createMode === 'manual' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary']"
                @click="createMode = 'manual'"
              >
                {{ locale.manualImport }}
              </button>
              <button
                :class="['min-w-[72px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors', createMode === 'generate' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary']"
                @click="createMode = 'generate'"
              >
                {{ locale.autoGenerate }}
              </button>
            </div>
          </div>

          <div v-if="createMode === 'manual'" class="space-y-3">
            <textarea
              v-model="manualCodes"
              rows="4"
              :placeholder="locale.manualPlaceholder"
              class="w-full resize-none rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            />
          </div>

          <div v-else class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.generateCount }}</label>
              <input v-model.number="generateForm.count" type="number" min="1" class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary-40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.prefix }}</label>
              <input v-model="generateForm.prefix" type="text" :placeholder="locale.prefixPlaceholder" class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary-40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.randomLength }}</label>
              <input v-model.number="generateForm.length" type="number" min="4" max="32" class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary-40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.charset }}</label>
              <input v-model="generateForm.charset" type="text" class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary-40">
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.note }}</label>
            <input v-model="createNote" type="text" :placeholder="locale.bulkNotePlaceholder" class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40">
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              class="flex items-center gap-2 rounded-xl bg-primary-hover px-3.5 py-2 text-xs font-black text-text-primary hover:bg-primary transition-colors disabled:opacity-50"
              :disabled="saving"
              @click="createCodes"
            >
              <AppSpinner v-if="saving" :size="14" color="white" />
              <Plus v-else :size="14" /> {{ locale.createCardCode }}
            </button>
            <button class="rounded-xl border border-border-secondary bg-bg-primary px-3.5 py-2 text-xs font-bold text-text-secondary" @click="fillDemoCodes">
              {{ locale.fillDemo }}
            </button>
          </div>

          <div
            v-if="createMode === 'generate' && lastGeneratedCodes.length"
            class="rounded-2xl border border-border-secondary bg-bg-primary-60 p-3 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-black text-text-primary">{{ getLocaleMessage('lastGeneratedTitle', lastGeneratedCodes.length) }}</p>
                <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.lastGeneratedDesc }}</p>
              </div>
              <button
                class="flex items-center gap-2 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary hover:border-border-tertiary hover:text-text-primary transition-colors"
                @click="copyLastGeneratedCodes"
              >
                <Copy :size="14" /> {{ locale.copyAll }}
              </button>
            </div>
            <div class="max-h-32 overflow-y-auto rounded-xl border border-border-secondary bg-bg-primary p-3 font-mono text-xs leading-relaxed text-text-primary">
              <p v-for="code in lastGeneratedCodes" :key="code" class="break-all">{{ code }}</p>
            </div>
          </div>
        </div>

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


    <!-- 派发记录 -->
    <section class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-black text-text-primary uppercase tracking-[0.24em]">{{ locale.assignmentsTitle }}</h3>
          <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.assignmentsDesc }}</p>
        </div>
        <button
          class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary"
          @click="fetchAssignments"
        >
          {{ locale.refreshLogs }}
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <div class="xl:col-span-2">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.keyword }}</label>
          <input
            v-model="assignmentFilters.q"
            type="text"
            :placeholder="locale.assignmentFilterPlaceholder"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            @keyup.enter="fetchAssignments(1)"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignmentStatus }}</label>
          <CustomSelect
            v-model="assignmentFilters.status"
            :options="assignmentStatusOptions"
            label-key="label"
            value-key="value"
            :placeholder="locale.allAssignmentStatuses"
            class-name="w-full"
            @change="fetchAssignments(1)"
          />
        </div>
        <div class="flex items-end gap-2">
          <button
            class="rounded-xl bg-primary-hover px-4 py-2.5 text-xs font-black text-text-primary hover:bg-primary transition-colors"
            @click="fetchAssignments(1)"
          >
            {{ locale.queryLogs }}
          </button>
          <button
            class="rounded-xl border border-border-secondary bg-bg-primary px-4 py-2.5 text-xs font-bold text-text-secondary"
            @click="resetAssignmentFilters"
          >
            {{ locale.clearConditions }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span
          v-for="chip in assignmentStatsChips"
          :key="chip.key"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.2em]"
          :class="chip.class"
        >
          {{ chip.label }}
          <span class="text-[11px]">{{ chip.value }}</span>
        </span>
      </div>

      <div v-if="assignmentsLoading" class="rounded-xl border border-border-secondary bg-bg-primary-60 p-6 text-center text-sm text-text-tertiary">
        <AppSpinner :size="20" />
        <span class="ml-2">{{ locale.loadingLogs }}</span>
      </div>

      <div v-else class="overflow-x-auto rounded-2xl border border-border-secondary">
        <table class="min-w-[900px] text-left text-sm">
          <thead class="bg-bg-primary-80 text-text-tertiary">
            <tr>
              <th class="px-3 py-3 w-20">{{ locale.logId }}</th>
              <th class="px-3 py-3">{{ locale.cardCode }}</th>
              <th class="px-3 py-3 w-32">{{ locale.assignmentStatus }}</th>
              <th class="px-3 py-3 w-40">{{ locale.assignmentAssignee }}</th>
              <th class="px-3 py-3 w-40">{{ locale.assignmentDispatcher }}</th>
              <th class="px-3 py-3 w-40">{{ locale.assignmentAssignedAt }}</th>
              <th class="px-3 py-3 w-32">{{ locale.actions }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in assignments"
              :key="item.id"
              class="border-t border-border-secondary-80 hover:bg-bg-primary-70 transition-colors"
            >
              <td class="px-3 py-3 text-text-tertiary">{{ item.id }}</td>
              <td class="px-3 py-3 font-mono text-text-primary break-all">{{ item.codeSnapshot }}</td>
              <td class="px-3 py-3">
                <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.2em]', assignmentStatusMeta(item.status).class]">
                  {{ assignmentStatusMeta(item.status).label }}
                </span>
                <p v-if="item.failureReason" class="mt-1 text-[10px] text-error leading-relaxed">
                  {{ locale.assignmentFailureReason }}: {{ localizeAssignmentFailure(item) }}
                </p>
                <p v-if="item.notifyStatus === 'FAILED' && item.notifyError" class="mt-1 text-[10px] text-warning leading-relaxed">
                  {{ locale.notifyFailedButAssigned }}
                </p>
              </td>
              <td class="px-3 py-3 text-text-secondary">
                {{ item.userNameSnapshot || locale.unknownUser }}
              </td>
              <td class="px-3 py-3 text-text-secondary">
                {{ item.assignedByName || locale.unknownUser }}
              </td>
              <td class="px-3 py-3 text-text-tertiary">{{ formatDate(item.assignedAt) }}</td>
              <td class="px-3 py-3">
                <button
                  v-if="item.status === 'ASSIGNED'"
                  class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-warning"
                  @click="recycleAssignment(item)"
                >
                  {{ locale.assignmentRecycle }}
                </button>
                <span v-else class="text-[11px] text-text-disabled">—</span>
              </td>
            </tr>
            <tr v-if="!assignments.length">
              <td colspan="7" class="px-3 py-8 text-center text-sm text-text-tertiary">{{ locale.assignmentNoRecords }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-model:current-page="assignmentPagination.page"
        :total-pages="assignmentPagination.totalPages"
        :total-items="assignmentPagination.total"
        item-name="条派发记录"
        @change="fetchAssignments"
      />
    </section>

    <section class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-black text-text-primary uppercase tracking-[0.24em]">{{ locale.redeemLogsTitle }}</h3>
          <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.redeemLogsDesc }}</p>
        </div>
        <button
          class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary"
          @click="fetchRedeemLogs"
        >
          {{ locale.refreshLogs }}
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.keyword }}</label>
          <input
            v-model="logFilters.q"
            type="text"
            :placeholder="locale.logSearchPlaceholder"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            @keyup.enter="fetchRedeemLogs"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.source }}</label>
          <CustomSelect
            v-model="logFilters.source"
            :options="logSourceOptions"
            label-key="label"
            value-key="value"
            :placeholder="locale.allSources"
            class-name="w-full"
          />
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.redeemer }}</label>
          <input
            v-model="logFilters.redeemer"
            type="text"
            :placeholder="locale.redeemerPlaceholder"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.startDate }}</label>
          <AppDatePicker
            v-model="logFilters.startDate"
            size="md"
            rounded="xl"
            class-name="w-full"
          />
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.endDate }}</label>
          <AppDatePicker
            v-model="logFilters.endDate"
            size="md"
            rounded="xl"
            class-name="w-full"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-xl bg-primary-hover px-4 py-2 text-xs font-black text-text-primary hover:bg-primary transition-colors"
          @click="fetchRedeemLogs"
        >
          {{ locale.queryLogs }}
        </button>
        <button
          class="rounded-xl border border-border-secondary bg-bg-primary px-4 py-2 text-xs font-bold text-text-secondary"
          @click="resetLogFilters"
        >
          {{ locale.clearConditions }}
        </button>
      </div>

      <div v-if="logsLoading" class="rounded-xl border border-border-secondary bg-bg-primary-60 p-6 text-center text-sm text-text-tertiary">
        <AppSpinner :size="20" />
        <span class="ml-2">{{ locale.loadingLogs }}</span>
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-border-secondary">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-bg-primary-80 text-text-tertiary">
            <tr>
              <th class="px-3 py-3 w-20">{{ locale.logId }}</th>
              <th class="px-3 py-3">{{ locale.cardCode }}</th>
              <th class="px-3 py-3 w-28">{{ locale.source }}</th>
              <th class="px-3 py-3 w-56">{{ locale.redeemer }}</th>
              <th class="px-3 py-3 w-40">{{ locale.redeemedTime }}</th>
              <th class="px-3 py-3">{{ locale.relatedSong }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in redeemLogs"
              :key="item.id"
              class="border-t border-border-secondary-80 hover:bg-bg-primary-70 transition-colors"
            >
              <td class="px-3 py-3 text-text-tertiary">{{ item.id }}</td>
              <td class="px-3 py-3 font-mono text-text-primary break-all">{{ item.code || item.codeSnapshot }}</td>
              <td class="px-3 py-3">
                <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.2em]', logSourceMeta(item.source).class]">
                  {{ logSourceMeta(item.source).label }}
                </span>
              </td>
              <td class="px-3 py-3 text-text-secondary">
                {{ item.redeemer?.name || locale.unknownUser }}
                <span class="text-text-tertiary">({{ item.redeemer?.username || 'unknown' }})</span>
              </td>
              <td class="px-3 py-3 text-text-tertiary">{{ formatDate(item.redeemedAt) }}</td>
              <td class="px-3 py-3 text-text-secondary">
                <span v-if="item.song">{{ item.song.title }}<span class="text-text-tertiary">{{ item.song.artist ? ` · ${item.song.artist}` : '' }}</span></span>
                <span v-else class="text-text-tertiary">—</span>
              </td>
            </tr>
            <tr v-if="!redeemLogs.length">
              <td colspan="6" class="px-3 py-8 text-center text-sm text-text-tertiary">{{ locale.noRedeemLogs }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>

  <!-- 派发点歌券弹窗（集成到券列表的「派发」入口） -->
  <CardCodeDispatchModal
    v-model="dispatchOpen"
    :coupons="dispatchCoupons"
    :notice="dispatchNotice"
    @dispatched="onDispatched"
  />

</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Copy, Download, Plus, RefreshCw, Search, Send } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import CardCodeDispatchModal from '~/components/Admin/CardCodeDispatchModal.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { formatDateTime, parseUtcTimestamp } from '~/utils/timeUtils'

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const { msg: getLocaleMessage, nested: getNestedMessage } = useLocaleText(locale)
const { localize: localizeServerError } = useServerErrors()
const localizeAssignmentFailure = (item) => localizeServerError(
  { data: item?.error },
  locale.value.assignFailed
)

const codes = ref([])
const redeemLogs = ref([])
const loading = ref(false)
const logsLoading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const selectedIds = ref([])
const dispatchOpen = ref(false)
const dispatchCoupons = ref([])
const dispatchNotice = ref('')
const bulkStatus = ref('AVAILABLE')
const statusConfirmOpen = ref(false)
const statusConfirmIds = ref([])
const statusConfirmTarget = ref('')
const pagination = ref({ page: 1, limit: 10, total: 0, totalPages: 1 })
const cardStats = ref({ total: 0, available: 0, locked: 0, redeemed: 0 })

const filters = ref({ q: '', status: '' })
const logFilters = ref({ q: '', source: '', redeemer: '', startDate: '', endDate: '' })
const createMode = ref('manual')
const manualCodes = ref('')
const createNote = ref('')
const generateForm = ref({ count: 20, prefix: 'VH-', length: 10, charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' })
const lastGeneratedCodes = ref([])

const assignments = ref([])
const assignmentsLoading = ref(false)
const assignmentStats = ref({ total: 0, assigned: 0, used: 0, recycled: 0, failed: 0 })
const assignmentFilters = ref({ q: '', status: '' })
const assignmentPagination = ref({ page: 1, limit: 10, total: 0, totalPages: 1 })

const assignmentStatusOptions = computed(() => [
  { label: locale.value?.allAssignmentStatuses || 'All Statuses', value: '' },
  { label: locale.value?.assignmentStatusAssigned || 'Assigned', value: 'ASSIGNED' },
  { label: locale.value?.assignmentStatusUsed || 'Used', value: 'USED' },
  { label: locale.value?.assignmentStatusRecycled || 'Recycled', value: 'RECYCLED' },
  { label: locale.value?.assignmentStatusFailed || 'Failed', value: 'FAILED' }
])

const assignmentStatusMeta = (status) => {
  const statusMap = {
    ASSIGNED: { label: locale.value?.assignmentStatusAssigned || 'Assigned', class: 'bg-info-10 text-info border border-info-20' },
    USED: { label: locale.value?.assignmentStatusUsed || 'Used', class: 'bg-primary-10 text-primary border border-primary-20' },
    RECYCLED: { label: locale.value?.assignmentStatusRecycled || 'Recycled', class: 'bg-bg-quaternary-10 text-text-secondary border border-border-tertiary-20' },
    FAILED: { label: locale.value?.assignmentStatusFailed || 'Failed', class: 'bg-error-10 text-error border border-error-20' }
  }
  return statusMap[status] || { label: status || locale.value?.unknown || 'Unknown', class: 'bg-bg-quaternary-10 text-text-secondary border border-border-tertiary-20' }
}

const assignmentStatsChips = computed(() => [
  { key: 'total', label: locale.value?.assignmentStatTotal || 'Total', value: assignmentStats.value.total, class: 'bg-bg-tertiary text-text-primary' },
  { key: 'assigned', label: locale.value?.assignmentStatusAssigned || 'Assigned', value: assignmentStats.value.assigned, class: 'bg-info-10 text-info border border-info-20' },
  { key: 'used', label: locale.value?.assignmentStatusUsed || 'Used', value: assignmentStats.value.used, class: 'bg-primary-10 text-primary border border-primary-20' },
  { key: 'recycled', label: locale.value?.assignmentStatusRecycled || 'Recycled', value: assignmentStats.value.recycled, class: 'bg-bg-quaternary-10 text-text-secondary border border-border-tertiary-20' },
  { key: 'failed', label: locale.value?.assignmentStatusFailed || 'Failed', value: assignmentStats.value.failed, class: 'bg-error-10 text-error border border-error-20' }
])

/** 勾选的可用点歌券 */
const selectedAvailableCodes = computed(() =>
  selectedIds.value
    .map((id) => codes.value.find((row) => row.id === id))
    .filter((item) => item && item.status === 'AVAILABLE')
    .map((item) => ({ id: item.id, code: item.code, status: item.status }))
)

/** 派发按钮禁用原因 */
const dispatchDisabledReason = (item) => {
  const statusLabel = {
    ASSIGNED: locale.value?.assigned || '已派发',
    LOCKED: locale.value?.locked || '锁定',
    REDEEMED: locale.value?.redeemed || '核销',
    INVALID: locale.value?.invalid || '作废'
  }[item?.status] || locale.value?.assigned || '已派发'
  const template = locale.value?.dispatchRowDisabledHint
    || '该券当前为「{status}」状态，不可直接派发；请先将其恢复为「可用」'
  return String(template).replace('{status}', statusLabel)
}

/** 预选可用点歌券 */
const openDispatchFromSelection = () => {
  dispatchCoupons.value = selectedAvailableCodes.value
  dispatchNotice.value = selectedAvailableCodes.value.length
    ? ''
    : (locale.value?.dispatchNoAvailableHint || '未勾选「可用」状态的点歌券，可在下方列表中直接勾选')
  dispatchOpen.value = true
}

/** 派发指定可用点歌券 */
const openDispatchForCode = (item) => {
  if (!item) return
  if (item.status !== 'AVAILABLE') {
    showToast(dispatchDisabledReason(item), 'warning')
    return
  }
  dispatchCoupons.value = [{ id: item.id, code: item.code, status: item.status }]
  dispatchNotice.value = ''
  dispatchOpen.value = true
}

/** 派发完成后：刷新列表与派发记录，并清空勾选 */
const onDispatched = async () => {
  selectedIds.value = []
  await Promise.all([fetchCodes(pagination.value.page), fetchAssignments(1)])
}

const statusFilterOptions = computed(() => [
  { label: locale.value?.allStatus || 'All Status', value: '' },
  { label: locale.value?.available || 'Available', value: 'AVAILABLE' },
  { label: locale.value?.assignedStatus || 'Assigned', value: 'ASSIGNED' },
  { label: locale.value?.lockedStatus || 'Locked', value: 'LOCKED' },
  { label: locale.value?.redeemedStatus || 'Redeemed', value: 'REDEEMED' },
  { label: locale.value?.invalidStatus || 'Invalid', value: 'INVALID' }
])

const logSourceOptions = computed(() => [
  { label: locale.value?.allSources || 'All Sources', value: '' },
  { label: locale.value?.sources?.adminManual || 'Manual Redeem', value: 'ADMIN_MANUAL' },
  { label: locale.value?.sources?.openApiManual || 'Open API Redeem', value: 'OPEN_API_MANUAL' },
  { label: locale.value?.sources?.scheduleAuto || 'Schedule Auto', value: 'SCHEDULE_AUTO' },
  { label: locale.value?.sources?.songPlayed || 'Played Redeem', value: 'SONG_PLAYED' },
  { label: locale.value?.sources?.scheduleRemove || 'Schedule Remove', value: 'SCHEDULE_REMOVE' },
  { label: locale.value?.sources?.playbackCancel || 'Playback Cancel', value: 'PLAYBACK_CANCEL' },
  { label: locale.value?.sources?.withdraw || 'Withdraw', value: 'WITHDRAW' }
])

const bulkStatusOptions = computed(() => [
  { label: locale.value?.setAvailable || 'Set Available', value: 'AVAILABLE' },
  { label: locale.value?.setLocked || 'Set Locked', value: 'LOCKED' },
  { label: locale.value?.setRedeemed || 'Set Redeemed', value: 'REDEEMED' },
  { label: locale.value?.setInvalid || 'Set Invalid', value: 'INVALID' }
])

const statusMeta = (status) => {
  const statusMap = {
    AVAILABLE: { label: locale.value?.available || 'Available', class: 'bg-success-10 text-success border border-success-20' },
    ASSIGNED: { label: locale.value?.assigned || 'Assigned', class: 'bg-info-10 text-info border border-info-20' },
    LOCKED: { label: locale.value?.locked || 'Locked', class: 'bg-warning-10 text-warning border border-warning-20' },
    REDEEMED: { label: locale.value?.redeemed || 'Redeemed', class: 'bg-primary-10 text-primary border border-primary-20' },
    INVALID: { label: locale.value?.invalid || 'Invalid', class: 'bg-error-10 text-error border border-error-20' }
  }
  return statusMap[status] || { label: status || locale.value?.unknown || 'Unknown', class: 'bg-bg-quaternary-10 text-text-secondary border border-border-tertiary-20' }
}

const statusConfirmMessage = computed(() => {
  if (!statusConfirmIds.value.length) return ''
  const label = statusMeta(statusConfirmTarget.value).label
  const base = locale.value?.statusChangeMessage?.(statusConfirmIds.value.length, label)
    || `Set ${statusConfirmIds.value.length} request card(s) to "${label}"?`
  const unbindCount = codes.value.filter(
    (item) => statusConfirmIds.value.includes(item.id) && (item.assignedTo || item.status === 'ASSIGNED')
  ).length
  return unbindCount
    ? `${base}\n${locale.value?.statusChangeUnbindHint || 'Dispatched cards will be unbound.'}`
    : base
})

const logSourceMeta = (source) => {
  // 服务端可写入的 source 值见 cardCodeLifecycleService 与手动/开放 API 核销入口，
  // 映射必须覆盖全部取值，否则兑换日志会回落成「未知」
  const sourceMap = {
    ADMIN_MANUAL: { label: locale.value?.sources?.adminManual || 'Manual Redeem', class: 'bg-primary-10 text-primary border border-primary-20' },
    ADMIN: { label: locale.value?.sources?.admin || 'Admin Action', class: 'bg-primary-10 text-primary border border-primary-20' },
    OPEN_API_MANUAL: { label: locale.value?.sources?.openApiManual || 'Open API Redeem', class: 'bg-primary-10 text-primary border border-primary-20' },
    SCHEDULE_AUTO: { label: locale.value?.sources?.scheduleAuto || 'Schedule Auto', class: 'bg-success-10 text-success border border-success-20' },
    SONG_PLAYED: { label: locale.value?.sources?.songPlayed || 'Played Redeem', class: 'bg-success-10 text-success border border-success-20' },
    SCHEDULE_REMOVE: { label: locale.value?.sources?.scheduleRemove || 'Schedule Remove', class: 'bg-warning-10 text-warning border border-warning-20' },
    SCHEDULE: { label: locale.value?.sources?.schedule || 'Schedule', class: 'bg-success-10 text-success border border-success-20' },
    PLAYBACK_CANCEL: { label: locale.value?.sources?.playbackCancel || 'Playback Cancel', class: 'bg-info-10 text-info border border-info-20' },
    WITHDRAW: { label: locale.value?.sources?.withdraw || 'Withdraw', class: 'bg-warning-10 text-warning border border-warning-20' },
    UNKNOWN: { label: locale.value?.unknown || 'Unknown', class: 'bg-bg-quaternary-10 text-text-secondary border border-border-tertiary-20' }
  }
  return sourceMap[source] || sourceMap.UNKNOWN
}

const stats = computed(() => {
  const total = cardStats.value?.total ?? 0
  const available = cardStats.value?.available ?? 0
  const assigned = cardStats.value?.assigned ?? 0
  const locked = cardStats.value?.locked ?? 0
  const redeemed = cardStats.value?.redeemed ?? 0

  return [
    { label: locale.value?.stats?.total || 'Total', value: total, hint: locale.value?.stats?.all || 'All', badgeClass: 'bg-bg-tertiary text-text-primary' },
    { label: locale.value?.stats?.available || 'Available', value: available, hint: locale.value?.stats?.unused || 'Unused', badgeClass: 'bg-success-10 text-success' },
    { label: locale.value?.stats?.assigned || 'Assigned', value: assigned, hint: locale.value?.stats?.assignedHint || 'Dispatched', badgeClass: 'bg-info-10 text-info border border-info-20' },
    { label: locale.value?.stats?.locked || 'Locked', value: locked, hint: locale.value?.stats?.pendingRedeem || 'Pending redeem', badgeClass: 'bg-warning-10 text-warning' },
    { label: locale.value?.stats?.redeemed || 'Redeemed', value: redeemed, hint: locale.value?.stats?.completed || 'Completed', badgeClass: 'bg-primary-10 text-primary' }
  ]
})

const allVisibleSelected = computed(() => codes.value.length > 0 && codes.value.every((item) => selectedIds.value.includes(item.id)))
const someVisibleSelected = computed(() => codes.value.some((item) => selectedIds.value.includes(item.id)))
const exportButtonText = computed(() => (selectedIds.value.length ? getLocaleMessage('exportSelected', selectedIds.value.length) : getLocaleMessage('exportFiltered')))

const queryString = computed(() => {
  const query = new URLSearchParams()
  if (filters.value.q.trim()) query.set('q', filters.value.q.trim())
  if (filters.value.status) query.set('status', filters.value.status)
  query.set('page', String(pagination.value.page))
  query.set('limit', String(pagination.value.limit))
  return query.toString()
})

const normalizeRows = (rows) => rows.map((row) => {
  const existing = codes.value.find((item) => item.id === row.id)
  const hasUnsavedNote = existing && existing.noteDraft !== (existing.note || '')
  return {
    ...row,
    noteDraft: hasUnsavedNote ? existing.noteDraft : (row.note || '')
  }
})

const fetchCodes = async (page = pagination.value.page) => {
  const nextPage = Number(page)
  pagination.value.page = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  loading.value = true
  try {
    const res = await $fetch(`/api/admin/card-codes?${queryString.value}`)
    if (res?.success) {
      codes.value = normalizeRows(res.data || [])
      pagination.value = {
        ...pagination.value,
        ...(res.pagination || {}),
        totalPages: Math.max(1, Number(res.pagination?.totalPages || 1))
      }
      cardStats.value = {
        total: Number(res.stats?.total || 0),
        available: Number(res.stats?.available || 0),
        assigned: Number(res.stats?.assigned || 0),
        locked: Number(res.stats?.locked || 0),
        redeemed: Number(res.stats?.redeemed || 0)
      }
    }
  } catch (error) {
    console.error('获取点歌券失败', error)
    showToast(getNestedMessage('messages', 'fetchFailed'), 'error')
  } finally {
    loading.value = false
  }
}

const fetchRedeemLogs = async () => {
  logsLoading.value = true
  try {
    const query = new URLSearchParams()
    query.set('limit', '80')
    if (logFilters.value.q.trim()) query.set('q', logFilters.value.q.trim())
    if (logFilters.value.source) query.set('source', logFilters.value.source)
    if (logFilters.value.redeemer.trim()) query.set('redeemer', logFilters.value.redeemer.trim())
    if (logFilters.value.startDate) query.set('startDate', logFilters.value.startDate)
    if (logFilters.value.endDate) query.set('endDate', logFilters.value.endDate)

    const res = await $fetch(`/api/admin/card-codes/redeem-logs?${query.toString()}`)
    if (res?.success) {
      redeemLogs.value = Array.isArray(res.data) ? res.data : []
    }
  } catch (error) {
    console.error('获取点歌券兑换日志失败', error)
    showToast(getNestedMessage('messages', 'fetchLogsFailed'), 'error')
  } finally {
    logsLoading.value = false
  }
}

const resetLogFilters = async () => {
  logFilters.value = { q: '', source: '', redeemer: '', startDate: '', endDate: '' }
  await fetchRedeemLogs()
}

// ===== 派发相关 =====
const fetchAssignments = async (page = assignmentPagination.value.page) => {
  const nextPage = Number(page)
  assignmentPagination.value.page = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  assignmentsLoading.value = true
  try {
    const query = new URLSearchParams()
    query.set('page', String(assignmentPagination.value.page))
    query.set('limit', String(assignmentPagination.value.limit))
    if (assignmentFilters.value.q.trim()) query.set('q', assignmentFilters.value.q.trim())
    if (assignmentFilters.value.status) query.set('status', assignmentFilters.value.status)

    const res = await $fetch(`/api/admin/card-codes/assignments?${query.toString()}`)
    if (res?.success) {
      assignments.value = Array.isArray(res.data) ? res.data : []
      assignmentStats.value = {
        total: Number(res.stats?.total || 0),
        assigned: Number(res.stats?.assigned || 0),
        used: Number(res.stats?.used || 0),
        recycled: Number(res.stats?.recycled || 0),
        failed: Number(res.stats?.failed || 0)
      }
      assignmentPagination.value = {
        ...assignmentPagination.value,
        ...(res.pagination || {}),
        totalPages: Math.max(1, Number(res.pagination?.totalPages || 1))
      }
    }
  } catch (error) {
    console.error('获取派发记录失败', error)
    showToast(getNestedMessage('messages2', 'fetchAssignmentsFailed'), 'error')
  } finally {
    assignmentsLoading.value = false
  }
}

const resetAssignmentFilters = async () => {
  assignmentFilters.value = { q: '', status: '' }
  await fetchAssignments(1)
}



/** 二级确认统一走系统内置弹窗，不使用浏览器原生 confirm */
const genericConfirm = ref({ open: false, title: '', message: '', action: null })

const askConfirm = (message, action, title = '') => {
  genericConfirm.value = { open: true, title, message, action }
}

const closeGenericConfirm = () => {
  genericConfirm.value = { open: false, title: '', message: '', action: null }
}

const runGenericConfirm = async () => {
  const { action } = genericConfirm.value
  closeGenericConfirm()
  await action?.()
}

/** 回收已派发的点歌券 */
const recycleAssignment = (item) => {
  const code = item.codeSnapshot || ''
  askConfirm(
    locale.value?.assignmentRecycleConfirm?.(code) || `确定回收点歌券 ${code} 吗？`,
    () => performRecycle(item)
  )
}

const performRecycle = async (item) => {
  try {
    const res = await $fetch('/api/admin/card-codes/recycle', {
      method: 'POST',
      body: { assignmentIds: [item.id], reason: '' }
    })
    const count = Number(res?.recycledCount || 0)
    if (count > 0) {
      showToast(locale.value?.recycleSuccess?.(count) || `成功回收 ${count} 张点歌券`, 'success')
      await Promise.all([fetchCodes(pagination.value.page), fetchAssignments(assignmentPagination.value.page)])
    } else {
      const failure = res?.failures?.[0]
      showToast(localizeServerError(
        { data: failure?.error },
        locale.value.recycleFailed
      ), 'error')
    }
  } catch (error) {
    console.error('回收点歌券失败', error)
    showToast(localizeServerError(error, locale.value.recycleFailed), 'error')
  }
}

const refreshAll = async () => {
  await Promise.all([fetchCodes(), fetchRedeemLogs(), fetchAssignments()])
}

const resetFilters = async () => {
  filters.value = { q: '', status: '' }
  await fetchCodes(1)
}

const clearSelection = () => {
  selectedIds.value = []
}

const toggleSelect = (id) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((itemId) => itemId !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

const toggleSelectAll = () => {
  if (allVisibleSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !codes.value.some((item) => item.id === id))
    return
  }
  const next = new Set(selectedIds.value)
  codes.value.forEach((item) => next.add(item.id))
  selectedIds.value = [...next]
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    const date = parseUtcTimestamp(value)
    return Number.isNaN(date.getTime()) ? '—' : formatDateTime(date, 'YYYY/MM/DD HH:mm')
  } catch {
    return '—'
  }
}

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    showToast(getNestedMessage('messages', 'copied'), 'success')
  } catch (error) {
    console.error('复制失败', error)
    showToast(getNestedMessage('messages', 'copyFailed'), 'error')
  }
}

const copyLastGeneratedCodes = async () => {
  if (!lastGeneratedCodes.value.length) {
    showToast(getNestedMessage('messages', 'noGeneratedToCopy'), 'warning')
    return
  }

  try {
    await navigator.clipboard.writeText(lastGeneratedCodes.value.join('\n'))
    showToast(getNestedMessage('messages', 'copiedGenerated', lastGeneratedCodes.value.length), 'success')
  } catch (error) {
    console.error('批量复制点歌券失败', error)
    showToast(getNestedMessage('messages', 'copyFailed'), 'error')
  }
}

const buildExportQuery = () => {
  const query = new URLSearchParams()
  if (selectedIds.value.length) {
    query.set('ids', selectedIds.value.join(','))
    return query
  }
  if (filters.value.q.trim()) query.set('q', filters.value.q.trim())
  if (filters.value.status) query.set('status', filters.value.status)
  return query
}

const exportCodes = async () => {
  exporting.value = true
  try {
    const query = buildExportQuery()
    const response = await fetch(`/api/admin/card-codes/export?${query.toString()}`, {
      credentials: 'same-origin'
    })
    if (!response.ok) {
      let message = getNestedMessage('messages', 'exportFailed')
      try {
        const errorBody = await response.json()
        message = errorBody?.message || errorBody?.statusMessage || message
      } catch {
        // CSV 接口错误响应不一定是 JSON。
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `card-codes-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast(selectedIds.value.length ? getNestedMessage('messages', 'exportSelectedSuccess') : getNestedMessage('messages', 'exportFilteredSuccess'), 'success')
  } catch (error) {
    console.error('导出点歌券失败', error)
    showToast(error?.message || getNestedMessage('messages', 'exportFailed'), 'error')
  } finally {
    exporting.value = false
  }
}

const requestStatusUpdate = (ids, status) => {
  const normalized = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  if (!normalized.length || saving.value) return
  statusConfirmIds.value = normalized
  statusConfirmTarget.value = status
  statusConfirmOpen.value = true
}

const closeStatusConfirm = () => {
  if (saving.value) return
  statusConfirmOpen.value = false
  statusConfirmIds.value = []
  statusConfirmTarget.value = ''
}

const updateStatus = async (ids, status) => {
  saving.value = true
  try {
    if (Array.isArray(ids) && ids.length === 1) {
      // 单条更新走新的 PUT 接口，便于更精细的审计
      const id = ids[0]
      await $fetch(`/api/admin/card-codes/${id}`, {
        method: 'PUT',
        body: { status }
      })
    } else {
      await $fetch('/api/admin/card-codes/update', {
        method: 'POST',
        body: { ids, status }
      })
    }

    showToast(getNestedMessage('messages', 'statusUpdated'), 'success')
    await Promise.all([fetchCodes(), fetchRedeemLogs(), fetchAssignments()])
    return true
  } catch (error) {
    console.error('更新点歌券状态失败', error)
    showToast(localizeServerError(error, getNestedMessage('messages', 'updateStatusFailed')), 'error')
    return false
  } finally {
    saving.value = false
  }
}

const confirmStatusUpdate = async () => {
  if (saving.value || !statusConfirmIds.value.length || !statusConfirmTarget.value) return
  const ids = [...statusConfirmIds.value]
  const success = await updateStatus(ids, statusConfirmTarget.value)
  if (success && ids.every((id) => selectedIds.value.includes(id))) clearSelection()
  statusConfirmOpen.value = false
  statusConfirmIds.value = []
  statusConfirmTarget.value = ''
}

const saveNote = async (item) => {
  saving.value = true
  try {
    await $fetch('/api/admin/card-codes/update', {
      method: 'POST',
      body: { id: item.id, note: item.noteDraft }
    })
    showToast(getNestedMessage('messages', 'noteSaved'), 'success')
    item.note = item.noteDraft || null
  } catch (error) {
    console.error('保存备注失败', error)
    showToast(getNestedMessage('messages', 'saveNoteFailed'), 'error')
  } finally {
    saving.value = false
  }
}

const applyBulkStatus = async () => {
  if (!selectedIds.value.length) return
  requestStatusUpdate(selectedIds.value, bulkStatus.value)
}

const createCodes = async () => {
  saving.value = true
  try {
    let body = { note: createNote.value.trim() }

    if (createMode.value === 'manual') {
      const list = manualCodes.value
        .split(/[，,\n\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
      if (!list.length) {
        showToast(getNestedMessage('messages', 'inputRequired'), 'warning')
        return
      }
      body = { ...body, codes: [...new Set(list)] }
    } else {
      body = {
        ...body,
        count: Math.max(1, Number(createFormCount.value)),
        prefix: generateForm.value.prefix,
        length: Math.max(4, Number(generateForm.value.length)),
        charset: generateForm.value.charset
      }
    }

    const res = await $fetch('/api/admin/card-codes/create', {
      method: 'POST',
      body
    })

    const inserted = Array.isArray(res?.data) ? res.data.length : 0
    const skipped = Number(res?.skipped || 0)
    lastGeneratedCodes.value = createMode.value === 'generate'
      ? (Array.isArray(res?.data) ? res.data.map((item) => item.code).filter(Boolean) : [])
      : []
    showToast(skipped ? getNestedMessage('messages', 'createDone', inserted, skipped) : getNestedMessage('messages', 'createSuccess', inserted), 'success')
    manualCodes.value = ''
    createNote.value = ''
    await fetchCodes()
  } catch (error) {
    console.error('创建点歌券失败', error)
    showToast(error?.data?.message || error?.message || getNestedMessage('messages', 'createFailed'), 'error')
  } finally {
    saving.value = false
  }
}

const createFormCount = computed(() => generateForm.value.count)

const fillDemoCodes = () => {
  createMode.value = 'manual'
  manualCodes.value = ['DEMO-2026-A001', 'DEMO-2026-A002', 'DEMO-2026-A003'].join('\n')
  createNote.value = getLocaleMessage('demoNote')
}

onMounted(refreshAll)
</script>

<style scoped>
textarea {
  scrollbar-width: thin;
  scrollbar-color: var(--panel-bg-hover) transparent;
}

textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-thumb {
  background: var(--panel-bg-hover);
  border-radius: 9999px;
}
</style>
