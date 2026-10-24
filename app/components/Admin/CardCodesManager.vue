<template>
  <div class="space-y-6">
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
          <button class="px-3 py-2 rounded-lg bg-bg-secondary text-text-secondary text-xs font-bold border border-border-secondary" @click="clearSelection">
            {{ locale.cancelSelection }}
          </button>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-border-secondary">
          <div v-if="loading" class="flex min-w-[880px] items-center justify-center bg-bg-primary-60 p-8 text-center text-sm text-text-tertiary">
            {{ locale.loading }}
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
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-text-secondary" @click="updateStatus([item.id], 'AVAILABLE')">{{ locale.available }}</button>
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-warning" @click="updateStatus([item.id], 'LOCKED')">{{ locale.locked }}</button>
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-success" @click="updateStatus([item.id], 'REDEEMED')">{{ locale.redeemed }}</button>
                    <button class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-error" @click="updateStatus([item.id], 'INVALID')">{{ locale.invalid }}</button>
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
              <Plus :size="14" /> {{ locale.createCardCode }}
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

    <!-- 派发点歌券 -->
    <section class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-4">
      <div>
        <h3 class="text-sm font-black text-text-primary uppercase tracking-[0.24em]">{{ locale.assignTitle }}</h3>
        <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.assignDesc }}</p>
      </div>

      <!-- 派发方式切换 -->
      <div class="flex gap-1 rounded-xl border border-border-secondary bg-bg-primary p-1">
        <button
          v-for="mode in assignModes"
          :key="mode.value"
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
          :class="assignMode === mode.value ? 'bg-primary-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'"
          @click="switchAssignMode(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>

      <!-- 方式一：选择用户（支持多选） -->
      <div v-if="assignMode === 'users'">
        <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignSelectUser }}</label>
        <div ref="recipientDropdownRef" class="relative">
          <input
            v-model="assignUserKeyword"
            type="text"
            :placeholder="locale.assignSelectUserPlaceholder"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            @focus="openRecipientDropdown"
            @input="openRecipientDropdown"
            @keydown.esc="closeRecipientDropdown"
            @keydown.enter.prevent="toggleRecipient(recipientCandidates[0])"
          >
          <div
            v-if="recipientDropdownOpen && recipientCandidates.length"
            class="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border-secondary bg-bg-secondary shadow-xl"
          >
            <button
              v-for="candidate in recipientCandidates"
              :key="candidate.id"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-tertiary-50"
              type="button"
              @click="toggleRecipient(candidate)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black"
                :class="isRecipientSelected(candidate.id) ? 'border-primary bg-primary text-text-primary' : 'border-border-tertiary'"
              >
                {{ isRecipientSelected(candidate.id) ? '✓' : '' }}
              </span>
              <span class="min-w-0 flex-1 truncate">
                {{ candidate.name || candidate.username }}
                <span class="text-text-tertiary">({{ candidate.username }})</span>
              </span>
              <span class="shrink-0 text-[10px] text-text-tertiary">
                {{ [candidate.grade, candidate.class].filter(Boolean).join(' · ') }}
              </span>
            </button>
          </div>
        </div>
        <div v-if="assignTargets.length" class="mt-2 flex flex-wrap items-center gap-2">
          <span
            v-for="target in assignTargets"
            :key="target.id"
            class="inline-flex items-center gap-1 rounded-full border border-info-20 bg-info-10 px-2.5 py-1 text-[11px] font-bold text-info"
          >
            {{ target.name || target.username }}
            <button type="button" class="text-info/70 transition-colors hover:text-info" @click="removeRecipient(target.id)">
              <X :size="12" />
            </button>
          </span>
          <button
            type="button"
            class="text-[11px] font-bold text-text-tertiary transition-colors hover:text-text-primary"
            @click="clearRecipients"
          >
            {{ locale.assignClearRecipients }}
          </button>
        </div>
      </div>

      <!-- 方式二：按标签 -->
      <div v-else-if="assignMode === 'tags'" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <label class="block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignSelectTags }}</label>
          <button
            type="button"
            class="flex items-center gap-1 text-[11px] font-bold text-primary transition-colors hover:text-primary-hover"
            @click="openTagManager"
          >
            <Tags :size="12" /> {{ locale.tagManage }}
          </button>
        </div>
        <div ref="tagDropdownRef" class="relative">
          <input
            :value="selectedTagNames.join('、')"
            type="text"
            readonly
            :placeholder="locale.assignSelectTagsPlaceholder"
            class="w-full cursor-pointer rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
            @click="tagDropdownOpen = !tagDropdownOpen"
          >
          <div
            v-if="tagDropdownOpen"
            class="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border-secondary bg-bg-secondary shadow-xl"
          >
            <button
              v-for="tag in availableTags"
              :key="tag.name"
              type="button"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-tertiary-50"
              @click="toggleTagSelection(tag.name)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black"
                :class="selectedTagNames.includes(tag.name) ? 'border-primary bg-primary text-text-primary' : 'border-border-tertiary'"
              >
                {{ selectedTagNames.includes(tag.name) ? '✓' : '' }}
              </span>
              <span class="min-w-0 flex-1 truncate">{{ tag.name }}</span>
              <span class="shrink-0 text-[10px] text-text-tertiary">{{ getLocaleMessage('assignTagUserCount', tag.userCount) }}</span>
            </button>
            <p v-if="!availableTags.length" class="px-3 py-4 text-center text-xs text-text-tertiary">
              {{ locale.tagEmptyHint }}
            </p>
          </div>
        </div>
        <div v-if="selectedTagNames.length" class="flex flex-wrap gap-2">
          <span
            v-for="name in selectedTagNames"
            :key="name"
            class="inline-flex items-center gap-1 rounded-full border border-primary-20 bg-primary-10 px-2.5 py-1 text-[11px] font-bold text-primary"
          >
            {{ name }}
            <button type="button" class="text-primary/70 transition-colors hover:text-primary" @click="toggleTagSelection(name)">
              <X :size="12" />
            </button>
          </span>
        </div>
      </div>

      <!-- 方式三：按班级 -->
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignClassGrade }}</label>
          <CustomSelect
            v-model="classGrade"
            :options="gradeOptions"
            label-key="label"
            value-key="value"
            :placeholder="locale.assignSelectGrade"
            class-name="w-full"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignClassName }}</label>
          <CustomSelect
            v-model="classClassName"
            :options="classOptions"
            label-key="label"
            value-key="value"
            :placeholder="classGrade ? locale.assignAllClasses : locale.assignSelectGradeFirst"
            class-name="w-full"
            :disabled="!classGrade"
          />
        </div>
      </div>

      <!-- 接收人预览（按标签 / 按班级） -->
      <div v-if="assignMode !== 'users'" class="rounded-xl border border-border-secondary bg-bg-primary p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold text-text-secondary">
            {{ locale.assignMatchedRecipients }}
            <span class="text-primary">{{ previewUsers.length }}</span>
            {{ locale.assignPersonUnit }}
          </p>
          <button
            v-if="previewUsers.length"
            type="button"
            class="shrink-0 text-[11px] font-bold text-primary transition-colors hover:text-primary-hover"
            @click="previewExpanded = !previewExpanded"
          >
            {{ previewExpanded ? locale.assignHideList : locale.assignViewList }}
          </button>
        </div>
        <p v-if="previewLoading" class="mt-1 text-[11px] text-text-tertiary">{{ locale.assignPreviewLoading }}</p>
        <p v-else-if="!previewUsers.length" class="mt-1 text-[11px] text-text-tertiary">
          {{ assignMode === 'tags' ? locale.assignTagNoMatch : locale.assignClassNoMatch }}
        </p>
        <p v-if="previewTruncated" class="mt-1 text-[11px] font-bold text-warning">
          {{ getLocaleMessage('assignPreviewTruncated', MAX_PREVIEW_RECIPIENTS) }}
        </p>
        <div v-if="previewExpanded && previewUsers.length" class="mt-2 max-h-40 space-y-1 overflow-y-auto">
          <p v-for="item in previewUsers" :key="item.id" class="text-[11px] leading-relaxed text-text-secondary">
            {{ item.name || item.username }}
            <span class="text-text-tertiary">({{ item.username }})</span>
            <span v-if="item.grade || item.class" class="text-text-tertiary"> · {{ [item.grade, item.class].filter(Boolean).join(' · ') }}</span>
          </p>
        </div>
      </div>

      <!-- 券来源：使用已勾选的券 / 按接收人现场生成 -->
      <div>
        <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignSource }}</label>
        <div class="flex gap-1 rounded-xl border border-border-secondary bg-bg-primary p-1">
          <button
            v-for="source in assignSources"
            :key="source.value"
            type="button"
            class="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
            :class="assignSource === source.value ? 'bg-primary-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'"
            @click="switchAssignSource(source.value)"
          >
            {{ source.label }}
          </button>
        </div>
      </div>

      <!-- 来源一：从已勾选的点歌券中派发 -->
      <div v-if="assignSource === 'selected'">
        <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignSelectCodes }}</label>
        <div class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5">
          <p class="text-sm text-text-primary">
            {{ getLocaleMessage('assignSelectedCodes', assignableSelectedIds.length) }}
          </p>
          <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.assignSelectCodesHint }}</p>
        </div>
      </div>

      <!-- 来源二：按接收人现场生成并派发 -->
      <div v-else>
        <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignCountPerUser }}</label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="assignCountPerUser"
            type="number"
            min="1"
            max="100"
            class="w-24 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
          >
          <p class="text-[11px] leading-relaxed text-text-tertiary">
            {{ getLocaleMessage('assignGenerateHint', assignCountPerUser, resolvedRecipientCount) }}
          </p>
        </div>
      </div>

      <p class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-[11px] leading-relaxed text-text-tertiary">
        <template v-if="assignSource === 'selected'">
          {{ getLocaleMessage('assignDistributionHint', assignableSelectedIds.length, resolvedRecipientCount) }}
        </template>
        <template v-else>
          {{ getLocaleMessage('assignGenerateDistributionHint', assignCountPerUser, resolvedRecipientCount) }}
        </template>
      </p>

      <div>
        <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.note }}</label>
        <input
          v-model="assignNote"
          type="text"
          :placeholder="locale.assignNotePlaceholder"
          class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
        >
      </div>

      <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-text-secondary">
        <input v-model="assignNotify" type="checkbox" class="h-4 w-4 rounded border-border-tertiary bg-bg-secondary text-primary">
        {{ locale.assignNotify }}
      </label>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="flex items-center gap-2 rounded-xl bg-primary-hover px-4 py-2 text-xs font-black text-text-primary transition-colors hover:bg-primary disabled:opacity-50"
          :disabled="assigning || !canSubmitAssign"
          @click="submitAssign"
        >
          <Send :size="14" /> {{ assigning ? locale.exporting : locale.assignSubmit }}
        </button>
        <span v-if="assignResult" class="text-xs font-bold" :class="assignResult.failedCount > 0 ? 'text-warning' : 'text-success'">
          {{ assignResult.failedCount > 0
            ? getLocaleMessage('assignPartial', assignResult.assignedCount, assignResult.failedCount)
            : getLocaleMessage('assignSuccess', assignResult.assignedCount) }}
        </span>
      </div>

      <!-- 派发结果明细 -->
      <div v-if="assignResult" class="space-y-2 rounded-xl border border-border-secondary bg-bg-primary p-3">
        <p class="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.assignResultTitle }}</p>
        <p class="text-xs font-bold text-text-primary">
          {{ getLocaleMessage('assignResultSummary', assignResult.assignedCount, assignResult.servedRecipients, assignResult.failedCount) }}
        </p>
        <p v-if="assignResult.skippedRecipients.length" class="text-[11px] leading-relaxed text-warning">
          {{ getLocaleMessage('assignSkippedRecipients', assignResult.skippedRecipients.length) }}
          {{ assignResult.skippedRecipients.map((item) => item.name || item.username).join('、') }}
        </p>
        <p v-if="assignResult.generateMode && assignResult.generatedCodes.length" class="text-[11px] leading-relaxed text-text-tertiary">
          {{ getLocaleMessage('assignGeneratedCodes', assignResult.generatedCodes.length) }}
          {{ assignResult.generatedCodes.join('、') }}
        </p>
        <p v-if="assignResult.invalidRecipients.length" class="text-[11px] leading-relaxed text-error">
          {{ locale.assignInvalidRecipients }}
          {{ assignResult.invalidRecipients.map((item) => `#${item.userId} ${item.reason}`).join('；') }}
        </p>
        <div v-if="assignResult.failures.length" class="space-y-1">
          <p v-for="(failure, index) in assignResult.failures" :key="index" class="text-[11px] leading-relaxed text-text-secondary">
            <span class="font-mono text-text-primary">{{ failure.code || `#${failure.cardCodeId}` }}</span>
            — {{ failure.reason }}
          </p>
        </div>
      </div>
    </section>

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
        {{ locale.loadingLogs }}
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
                  {{ item.assignmentFailureReason }}: {{ item.failureReason }}
                </p>
                <p v-if="item.notifyStatus === 'FAILED' && item.notifyError" class="mt-1 text-[10px] text-warning leading-relaxed">
                  {{ item.notifyError }}
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
          <select
            v-model="logFilters.source"
            class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
          >
            <option value="">{{ locale.allSources }}</option>
            <option value="ADMIN_MANUAL">{{ locale.sources?.adminManual || '手动核销' }}</option>
            <option value="SCHEDULE_AUTO">{{ locale.sources?.scheduleAuto || '排期自动' }}</option>
            <option value="SCHEDULE_REMOVE">{{ locale.sources?.scheduleRemove || '移除排期' }}</option>
          </select>
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
        {{ locale.loadingLogs }}
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

  <!-- 标签管理弹窗 -->
  <Teleport to="body">
    <div v-if="tagModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm" @click="tagModalOpen = false" />
      <div class="relative bg-panel-bg-deepest border border-panel-bg-dark rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="sticky top-0 z-10 bg-panel-bg-deepest-95 backdrop-blur-sm px-6 py-5 border-b border-panel-bg-dark flex items-center justify-between rounded-t-3xl">
          <div>
            <h3 class="text-lg font-black text-text-primary-lighter tracking-tight">{{ locale.tagManage }}</h3>
            <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.tagModalDesc }}</p>
          </div>
          <button
            class="flex items-center justify-center p-2 hover:bg-panel-bg-dark rounded-xl transition-colors text-text-tertiary hover:text-text-primary-light"
            @click="tagModalOpen = false"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="grid grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-2">
          <!-- 左：全部标签 -->
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-text-tertiary">{{ locale.tagListTitle }}</h4>
            <div v-if="!availableTags.length" class="rounded-xl border border-border-secondary bg-bg-primary p-4 text-center text-xs text-text-tertiary">
              {{ locale.tagEmptyHint }}
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="tag in availableTags"
                :key="tag.name"
                class="flex items-center gap-2 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2"
              >
                <template v-if="renamingTag && renamingTag.from === tag.name">
                  <input
                    v-model="renamingTag.to"
                    type="text"
                    class="min-w-0 flex-1 rounded-lg border border-border-secondary bg-bg-secondary px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-primary-40"
                    @keydown.enter.prevent="confirmRenameTag"
                    @keydown.esc="renamingTag = null"
                  >
                  <button type="button" class="text-[11px] font-bold text-primary hover:text-primary-hover" @click="confirmRenameTag">
                    {{ locale.tagRenameSave }}
                  </button>
                  <button type="button" class="text-[11px] font-bold text-text-tertiary hover:text-text-primary" @click="renamingTag = null">
                    {{ locale.tagRenameCancel }}
                  </button>
                </template>
                <template v-else>
                  <span class="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">{{ tag.name }}</span>
                  <span class="shrink-0 text-[10px] text-text-tertiary">{{ getLocaleMessage('assignTagUserCount', tag.userCount) }}</span>
                  <button type="button" class="shrink-0 text-[11px] font-bold text-text-secondary hover:text-primary" @click="renamingTag = { from: tag.name, to: tag.name }">
                    {{ locale.tagRename }}
                  </button>
                  <button type="button" class="shrink-0 text-[11px] font-bold text-text-secondary hover:text-error" @click="deleteTag(tag)">
                    {{ locale.tagDelete }}
                  </button>
                </template>
              </div>
            </div>
          </div>

          <!-- 右：给用户打标签 -->
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-text-tertiary">{{ locale.tagApplyTitle }}</h4>

            <div ref="tagUserDropdownRef" class="relative">
              <input
                v-model="tagUserKeyword"
                type="text"
                :placeholder="locale.assignSelectUserPlaceholder"
                class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
                @focus="openTagUserDropdown"
                @input="openTagUserDropdown"
                @keydown.esc="tagUserDropdownOpen = false"
              >
              <div
                v-if="tagUserDropdownOpen && tagUserCandidates.length"
                class="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border-secondary bg-bg-secondary shadow-xl"
              >
                <button
                  v-for="candidate in tagUserCandidates"
                  :key="candidate.id"
                  type="button"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-tertiary-50"
                  @click="toggleTagUser(candidate)"
                >
                  <span
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black"
                    :class="isTagUserSelected(candidate.id) ? 'border-primary bg-primary text-text-primary' : 'border-border-tertiary'"
                  >
                    {{ isTagUserSelected(candidate.id) ? '✓' : '' }}
                  </span>
                  <span class="min-w-0 flex-1 truncate">
                    {{ candidate.name || candidate.username }}
                    <span class="text-text-tertiary">({{ candidate.username }})</span>
                  </span>
                </button>
              </div>
            </div>

            <div v-if="tagUserSelected.length" class="flex flex-wrap items-center gap-2">
              <span
                v-for="target in tagUserSelected"
                :key="target.id"
                class="inline-flex items-center gap-1 rounded-full border border-info-20 bg-info-10 px-2.5 py-1 text-[11px] font-bold text-info"
              >
                {{ target.name || target.username }}
                <button type="button" class="text-info/70 transition-colors hover:text-info" @click="removeTagUser(target.id)">
                  <X :size="12" />
                </button>
              </span>
              <button type="button" class="text-[11px] font-bold text-text-tertiary hover:text-text-primary" @click="tagUserSelected = []">
                {{ locale.assignClearRecipients }}
              </button>
            </div>

            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.tagApplyLabel }}</label>
              <div class="flex gap-2">
                <input
                  v-model="tagApplyInput"
                  type="text"
                  :placeholder="locale.tagApplyPlaceholder"
                  class="min-w-0 flex-1 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
                  @keydown.enter.prevent="commitTagApplyInput"
                >
                <button
                  type="button"
                  class="shrink-0 rounded-xl border border-border-secondary bg-bg-secondary px-3 py-2 text-xs font-bold text-text-secondary hover:text-text-primary"
                  @click="commitTagApplyInput"
                >
                  {{ locale.tagApplyAdd }}
                </button>
              </div>
              <div v-if="tagApplyList.length" class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="name in tagApplyList"
                  :key="name"
                  class="inline-flex items-center gap-1 rounded-full border border-primary-20 bg-primary-10 px-2.5 py-1 text-[11px] font-bold text-primary"
                >
                  {{ name }}
                  <button type="button" class="text-primary/70 transition-colors hover:text-primary" @click="removeTagApplyInput(name)">
                    <X :size="12" />
                  </button>
                </span>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-xl bg-primary-hover px-4 py-2 text-xs font-black text-text-primary transition-colors hover:bg-primary disabled:opacity-50"
                :disabled="tagSubmitting || !tagUserSelected.length || !tagApplyList.length"
                @click="applyTagsToUsers('add')"
              >
                {{ locale.tagApplySubmit }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-border-secondary bg-bg-secondary px-4 py-2 text-xs font-bold text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                :disabled="tagSubmitting || !tagUserSelected.length || !tagApplyList.length"
                @click="applyTagsToUsers('remove')"
              >
                {{ locale.tagRemoveSubmit }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Copy, Download, Plus, RefreshCw, Search, Send, Tags, X } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const { msg: getLocaleMessage, nested: getNestedMessage } = useLocaleText(locale)

const codes = ref([])
const redeemLogs = ref([])
const loading = ref(false)
const logsLoading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const selectedIds = ref([])
const bulkStatus = ref('AVAILABLE')
const pagination = ref({ page: 1, limit: 10, total: 0, totalPages: 1 })
const cardStats = ref({ total: 0, available: 0, locked: 0, redeemed: 0 })

const filters = ref({ q: '', status: '' })
const logFilters = ref({ q: '', source: '', redeemer: '', startDate: '', endDate: '' })
const createMode = ref('manual')
const manualCodes = ref('')
const createNote = ref('')
const generateForm = ref({ count: 20, prefix: 'VH-', length: 10, charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' })
const lastGeneratedCodes = ref([])

// ===== 派发点歌券 =====
const MAX_PREVIEW_RECIPIENTS = 2000
const assignUserKeyword = ref('')
const assignTargets = ref([])
const assignNote = ref('')
const assignNotify = ref(true)
const assigning = ref(false)
const assignResult = ref(null)
const assignments = ref([])
const assignmentsLoading = ref(false)
const assignmentStats = ref({ total: 0, assigned: 0, used: 0, recycled: 0, failed: 0 })
const assignmentFilters = ref({ q: '', status: '' })
const assignmentPagination = ref({ page: 1, limit: 10, total: 0, totalPages: 1 })
const recipientCandidates = ref([])
const recipientDropdownOpen = ref(false)
const recipientDropdownRef = ref(null)
let recipientSearchTimer = null

// 派发方式：选择用户 / 按标签 / 按班级
const assignMode = ref('users')
const assignModes = computed(() => [
  { value: 'users', label: locale.value?.assignModeUsers || '选择用户' },
  { value: 'tags', label: locale.value?.assignModeTags || '按标签' },
  { value: 'class', label: locale.value?.assignModeClass || '按班级' }
])

// 券来源：使用已勾选的券 / 按接收人现场生成
const assignSource = ref('selected')
const assignSources = computed(() => [
  { value: 'selected', label: locale.value?.assignSourceSelected || '使用已有点歌券' },
  { value: 'generate', label: locale.value?.assignSourceGenerate || '为接收人新生成' }
])
// 每人派发张数（仅「为接收人新生成」模式生效）
const assignCountPerUser = ref(1)

// 按标签派发
const availableTags = ref([])
const selectedTagNames = ref([])
const tagDropdownOpen = ref(false)
const tagDropdownRef = ref(null)

// 按班级派发
const classGrade = ref('')
const classClassName = ref('')
const classFacets = ref({ grades: [], classes: [] })

// 接收人预览（按标签 / 按班级）
const previewUsers = ref([])
const previewLoading = ref(false)
const previewExpanded = ref(false)
const previewTruncated = ref(false)

// 标签管理弹窗
const tagModalOpen = ref(false)
const tagApplyInput = ref('')
const tagApplyList = ref([])
const renamingTag = ref(null)
const tagUserKeyword = ref('')
const tagUserCandidates = ref([])
const tagUserDropdownOpen = ref(false)
const tagUserDropdownRef = ref(null)
const tagUserSelected = ref([])
const tagSubmitting = ref(false)
let tagUserSearchTimer = null

/** 当前生效的接收人列表：选择用户模式取勾选结果，其余模式取匹配预览 */
const resolvedRecipients = computed(() => {
  if (assignMode.value === 'users') return assignTargets.value
  return previewUsers.value.map((item) => ({
    id: Number(item.id),
    name: item.name || '',
    username: item.username || ''
  }))
})

const resolvedRecipientCount = computed(() => resolvedRecipients.value.length)

const canSubmitAssign = computed(() => {
  if (resolvedRecipientCount.value <= 0) return false
  // 生成模式不依赖库存券，只需接收人与每人张数合法
  if (assignSource.value === 'generate') {
    return Number.isInteger(assignCountPerUser.value) && assignCountPerUser.value >= 1 && assignCountPerUser.value <= 100
  }
  return assignableSelectedIds.value.length > 0
})

const gradeOptions = computed(() =>
  classFacets.value.grades.map((item) => ({
    label: `${item.value}（${item.userCount}）`,
    value: item.value
  }))
)

const classOptions = computed(() => {
  const options = classFacets.value.classes
    .filter((item) => !classGrade.value || item.grade === classGrade.value)
    .map((item) => ({
      label: `${item.class}（${item.userCount}）`,
      value: item.class
    }))
  return [{ label: locale.value?.assignAllClasses || '全部班级', value: '' }, ...options]
})

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

/** 只有「可用」状态的点歌券可以派发 */
const assignableSelectedIds = computed(() =>
  selectedIds.value.filter((id) => {
    const item = codes.value.find((row) => row.id === id)
    return item && item.status === 'AVAILABLE'
  })
)

const statusFilterOptions = computed(() => [
  { label: locale.value?.allStatus || 'All Status', value: '' },
  { label: locale.value?.available || 'Available', value: 'AVAILABLE' },
  { label: locale.value?.assignedStatus || 'Assigned', value: 'ASSIGNED' },
  { label: locale.value?.lockedStatus || 'Locked', value: 'LOCKED' },
  { label: locale.value?.redeemedStatus || 'Redeemed', value: 'REDEEMED' },
  { label: locale.value?.invalidStatus || 'Invalid', value: 'INVALID' }
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

const logSourceMeta = (source) => {
  const sourceMap = {
    ADMIN_MANUAL: { label: locale.value?.sources?.adminManual || 'Manual Redeem', class: 'bg-primary-10 text-primary border border-primary-20' },
    ADMIN: { label: locale.value?.sources?.admin || 'Admin Action', class: 'bg-primary-10 text-primary border border-primary-20' },
    SCHEDULE_AUTO: { label: locale.value?.sources?.scheduleAuto || 'Schedule Auto', class: 'bg-success-10 text-success border border-success-20' },
    SCHEDULE_REMOVE: { label: locale.value?.sources?.scheduleRemove || 'Schedule Remove', class: 'bg-warning-10 text-warning border border-warning-20' },
    SCHEDULE: { label: locale.value?.sources?.schedule || 'Schedule', class: 'bg-success-10 text-success border border-success-20' },
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

/** 搜索接收人（防抖，避免逐字请求） */
const openRecipientDropdown = () => {
  recipientDropdownOpen.value = true
  if (recipientSearchTimer) clearTimeout(recipientSearchTimer)
  recipientSearchTimer = setTimeout(() => {
    fetchRecipients()
  }, 220)
}

const closeRecipientDropdown = () => {
  recipientDropdownOpen.value = false
}

const fetchRecipients = async () => {
  try {
    const query = new URLSearchParams()
    if (assignUserKeyword.value.trim()) query.set('q', assignUserKeyword.value.trim())
    const res = await $fetch(`/api/admin/card-codes/recipients?${query.toString()}`)
    recipientCandidates.value = Array.isArray(res?.data) ? res.data : []
    // 请求可能晚于用户的关闭操作返回，只有用户仍保持打开状态时才展开下拉
    if (!recipientDropdownOpen.value) return
  } catch (error) {
    console.error('搜索接收用户失败', error)
    recipientCandidates.value = []
  }
}

/** 勾选 / 取消勾选接收用户 */
const toggleRecipient = (candidate) => {
  if (!candidate) return
  const id = Number(candidate.id)
  if (assignTargets.value.some((item) => item.id === id)) {
    assignTargets.value = assignTargets.value.filter((item) => item.id !== id)
    return
  }
  if (assignTargets.value.length >= 500) {
    showToast(locale.value?.assignTooManyRecipients || '单次最多派发给 500 位用户', 'warning')
    return
  }
  assignTargets.value = [
    ...assignTargets.value,
    { id, name: candidate.name || '', username: candidate.username || '' }
  ]
}

const isRecipientSelected = (id) => assignTargets.value.some((item) => item.id === Number(id))

const removeRecipient = (id) => {
  assignTargets.value = assignTargets.value.filter((item) => item.id !== Number(id))
}

const clearRecipients = () => {
  assignTargets.value = []
}

/** 切换派发方式 */
const switchAssignMode = (mode) => {
  if (assignMode.value === mode) return
  assignMode.value = mode
  assignResult.value = null
  recipientDropdownOpen.value = false
  tagDropdownOpen.value = false
  previewExpanded.value = false
  // 切换方式后旧名单不再作废，先清空再按新条件重新匹配，避免沿用上一模式的接收人
  previewUsers.value = []
  previewTruncated.value = false
  if (mode === 'class' && !classFacets.value.grades.length) {
    fetchClassFacets()
  }
  if (mode !== 'users') {
    fetchPreviewRecipients()
  }
}

// ===== 券来源切换 =====
const switchAssignSource = (source) => {
  if (assignSource.value === source) return
  assignSource.value = source
  assignResult.value = null
  if (source === 'generate') {
    // 每人张数兜底为合法值，避免残留 0 或非法输入导致按钮不可用
    if (!Number.isInteger(assignCountPerUser.value) || assignCountPerUser.value < 1) {
      assignCountPerUser.value = 1
    }
    if (assignCountPerUser.value > 100) assignCountPerUser.value = 100
  }
}

// ===== 按标签派发 =====
const fetchTags = async () => {
  try {
    const res = await $fetch('/api/admin/users/tags')
    availableTags.value = Array.isArray(res?.data) ? res.data : []
  } catch (error) {
    console.error('获取用户标签失败', error)
    availableTags.value = []
  }
}

const toggleTagSelection = (name) => {
  if (selectedTagNames.value.includes(name)) {
    selectedTagNames.value = selectedTagNames.value.filter((item) => item !== name)
    return
  }
  selectedTagNames.value = [...selectedTagNames.value, name]
}

// ===== 按班级派发 =====
const fetchClassFacets = async () => {
  try {
    const res = await $fetch('/api/admin/card-codes/recipients?facets=1')
    classFacets.value = {
      grades: Array.isArray(res?.facets?.grades) ? res.facets.grades : [],
      classes: Array.isArray(res?.facets?.classes) ? res.facets.classes : []
    }
  } catch (error) {
    console.error('获取年级班级维度失败', error)
    classFacets.value = { grades: [], classes: [] }
  }
}

// ===== 接收人预览（按标签 / 按班级） =====
const fetchPreviewRecipients = async () => {
  if (assignMode.value === 'users') return
  previewLoading.value = true
  try {
    const query = new URLSearchParams()
    query.set('all', '1')
    if (assignMode.value === 'tags') {
      if (!selectedTagNames.value.length) {
        previewUsers.value = []
        previewTruncated.value = false
        return
      }
      query.set('tags', selectedTagNames.value.join(','))
    } else {
      if (!classGrade.value) {
        previewUsers.value = []
        previewTruncated.value = false
        return
      }
      query.set('grade', classGrade.value)
      if (classClassName.value) query.set('class', classClassName.value)
    }
    const res = await $fetch(`/api/admin/card-codes/recipients?${query.toString()}`)
    previewUsers.value = Array.isArray(res?.data) ? res.data : []
    previewTruncated.value = Boolean(res?.truncated)
  } catch (error) {
    console.error('获取匹配接收人失败', error)
    previewUsers.value = []
    previewTruncated.value = false
  } finally {
    previewLoading.value = false
  }
}

// ===== 标签管理弹窗 =====
const openTagManager = () => {
  renamingTag.value = null
  tagApplyInput.value = ''
  tagApplyList.value = []
  tagUserKeyword.value = ''
  tagUserCandidates.value = []
  tagUserSelected.value = []
  tagDropdownOpen.value = false
  tagModalOpen.value = true
  fetchTags()
}

const openTagUserDropdown = () => {
  tagUserDropdownOpen.value = true
  if (tagUserSearchTimer) clearTimeout(tagUserSearchTimer)
  tagUserSearchTimer = setTimeout(() => {
    fetchTagUsers()
  }, 220)
}

const fetchTagUsers = async () => {
  try {
    const query = new URLSearchParams()
    if (tagUserKeyword.value.trim()) query.set('q', tagUserKeyword.value.trim())
    const res = await $fetch(`/api/admin/card-codes/recipients?${query.toString()}`)
    tagUserCandidates.value = Array.isArray(res?.data) ? res.data : []
    tagUserDropdownOpen.value = true
  } catch (error) {
    console.error('搜索用户失败', error)
    tagUserCandidates.value = []
  }
}

const isTagUserSelected = (id) => tagUserSelected.value.some((item) => item.id === Number(id))

const toggleTagUser = (candidate) => {
  if (!candidate) return
  const id = Number(candidate.id)
  if (tagUserSelected.value.some((item) => item.id === id)) {
    tagUserSelected.value = tagUserSelected.value.filter((item) => item.id !== id)
    return
  }
  tagUserSelected.value = [
    ...tagUserSelected.value,
    { id, name: candidate.name || '', username: candidate.username || '' }
  ]
}

const removeTagUser = (id) => {
  tagUserSelected.value = tagUserSelected.value.filter((item) => item.id !== Number(id))
}

const commitTagApplyInput = () => {
  const name = tagApplyInput.value.trim()
  if (!name) return
  if (name.length > 20) {
    showToast(locale.value?.tagTooLong || '标签名长度不能超过 20 个字符', 'warning')
    return
  }
  if (!tagApplyList.value.includes(name)) {
    tagApplyList.value = [...tagApplyList.value, name]
  }
  tagApplyInput.value = ''
}

const removeTagApplyInput = (name) => {
  tagApplyList.value = tagApplyList.value.filter((item) => item !== name)
}

const applyTagsToUsers = async (mode) => {
  if (!tagUserSelected.value.length || !tagApplyList.value.length) return
  tagSubmitting.value = true
  try {
    const res = await $fetch('/api/admin/users/tags', {
      method: 'POST',
      body: {
        userIds: tagUserSelected.value.map((item) => item.id),
        add: mode === 'add' ? tagApplyList.value : [],
        remove: mode === 'remove' ? tagApplyList.value : []
      }
    })
    const updated = Number(res?.updatedCount || 0)
    const skipped = Array.isArray(res?.skipped) ? res.skipped : []
    showToast(
      getLocaleMessage(
        mode === 'add' ? 'tagApplyDone' : 'tagRemoveDone',
        updated,
        skipped.length
      ),
      'success'
    )
    tagApplyList.value = []
    await fetchTags()
    if (assignMode.value === 'tags') await fetchPreviewRecipients()
  } catch (error) {
    console.error('更新用户标签失败', error)
    showToast(locale.value?.tagApplyFailed || '更新用户标签失败', 'error')
  } finally {
    tagSubmitting.value = false
  }
}

const confirmRenameTag = async () => {
  const from = renamingTag.value?.from || ''
  const to = (renamingTag.value?.to || '').trim()
  if (!from || !to) return
  if (to.length > 20) {
    showToast(locale.value?.tagTooLong || '标签名长度不能超过 20 个字符', 'warning')
    return
  }
  try {
    await $fetch('/api/admin/users/tags', {
      method: 'PUT',
      body: { from, to }
    })
    showToast(locale.value?.tagRenamed || '标签已重命名', 'success')
    renamingTag.value = null
    await Promise.all([fetchTags(), assignMode.value === 'tags' ? fetchPreviewRecipients() : Promise.resolve()])
  } catch (error) {
    console.error('重命名标签失败', error)
    showToast(locale.value?.tagRenameFailed || '重命名标签失败', 'error')
  }
}

const deleteTag = async (tag) => {
  const confirmed = window.confirm(
    locale.value?.tagDeleteConfirm?.(tag.name, tag.userCount)
    || `确定删除标签「${tag.name}」吗？将从 ${tag.userCount} 位用户身上移除该标签。`
  )
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/users/tags?name=${encodeURIComponent(tag.name)}`, {
      method: 'DELETE'
    })
    showToast(locale.value?.tagDeleted || '标签已删除', 'success')
    if (selectedTagNames.value.includes(tag.name)) {
      selectedTagNames.value = selectedTagNames.value.filter((item) => item !== tag.name)
    }
    await Promise.all([fetchTags(), assignMode.value === 'tags' ? fetchPreviewRecipients() : Promise.resolve()])
  } catch (error) {
    console.error('删除标签失败', error)
    showToast(locale.value?.tagDeleteFailed || '删除标签失败', 'error')
  }
}

/** 提交派发 */
const submitAssign = async () => {
  const recipients = resolvedRecipients.value
  if (!recipients.length) {
    showToast(locale.value?.assignNoUser || '请先选择接收用户', 'warning')
    return
  }
  const useGenerate = assignSource.value === 'generate'
  if (!useGenerate && !assignableSelectedIds.value.length) {
    showToast(locale.value?.assignNoCodes || '请先勾选要派发的点歌券', 'warning')
    return
  }
  if (useGenerate && (!Number.isInteger(assignCountPerUser.value) || assignCountPerUser.value < 1)) {
    showToast(locale.value?.assignInvalidCount || '每人派发张数必须为正整数', 'warning')
    return
  }

  assigning.value = true
  assignResult.value = null
  try {
    const res = await $fetch('/api/admin/card-codes/assign', {
      method: 'POST',
      body: {
        userIds: recipients.map((item) => item.id),
        // 生成模式下不传 cardCodeIds，由后端按人数现场生成新券
        ...(useGenerate
          ? { countPerUser: assignCountPerUser.value }
          : { cardCodeIds: assignableSelectedIds.value }),
        note: assignNote.value.trim(),
        notify: assignNotify.value
      }
    })

    assignResult.value = {
      assignedCount: Number(res?.assignedCount || 0),
      failedCount: Number(res?.failedCount || 0),
      servedRecipients: Number(res?.servedRecipients || 0),
      generateMode: Boolean(res?.generateMode),
      generatedCodes: Array.isArray(res?.generatedCodes) ? res.generatedCodes : [],
      skippedRecipients: Array.isArray(res?.skippedRecipients) ? res.skippedRecipients : [],
      invalidRecipients: Array.isArray(res?.invalidRecipients) ? res.invalidRecipients : [],
      failures: Array.isArray(res?.failures) ? res.failures : []
    }

    if (assignResult.value.assignedCount > 0) {
      showToast(
        assignResult.value.failedCount > 0
          ? getLocaleMessage('assignPartial', assignResult.value.assignedCount, assignResult.value.failedCount)
          : getLocaleMessage('assignSuccess', assignResult.value.assignedCount),
        assignResult.value.failedCount > 0 ? 'warning' : 'success'
      )
    } else {
      showToast(locale.value?.assignAllFailed || '所有点歌券派发失败', 'error')
    }

    // 派发后清空选择与备注，并刷新列表、派发记录与匹配名单
    selectedIds.value = []
    assignNote.value = ''
    await Promise.all([
      fetchCodes(pagination.value.page),
      fetchAssignments(1),
      assignMode.value === 'users' ? Promise.resolve() : fetchPreviewRecipients()
    ])
  } catch (error) {
    console.error('派发点歌券失败', error)
    showToast(locale.value?.assignFailed || '派发点歌券失败', 'error')
  } finally {
    assigning.value = false
  }
}

/** 回收已派发的点歌券 */
const recycleAssignment = async (item) => {
  const code = item.codeSnapshot || ''
  const confirmed = window.confirm(
    locale.value?.assignmentRecycleConfirm?.(code) || `确定回收点歌券 ${code} 吗？`
  )
  if (!confirmed) return

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
      const reason = res?.failures?.[0]?.reason
      showToast(reason || locale.value?.recycleFailed || '回收点歌券失败', 'error')
    }
  } catch (error) {
    console.error('回收点歌券失败', error)
    showToast(locale.value?.recycleFailed || '回收点歌券失败', 'error')
  }
}

const refreshAll = async () => {
  await Promise.all([fetchCodes(), fetchRedeemLogs(), fetchAssignments(), fetchTags(), fetchClassFacets()])
}

// 标签 / 班级条件变化时刷新匹配名单
watch(selectedTagNames, () => {
  fetchPreviewRecipients()
})
watch([classGrade, classClassName], () => {
  // 年级清空时同步清空班级，避免脏条件
  if (!classGrade.value && classClassName.value) {
    classClassName.value = ''
  }
  fetchPreviewRecipients()
})

// 点击空白处收起下拉（与 CustomSelect 的行为保持一致）
const handleAssignDropdownOutside = (event) => {
  const target = event.target
  if (recipientDropdownOpen.value) {
    const container = recipientDropdownRef.value
    if (!container || !container.contains(target)) {
      recipientDropdownOpen.value = false
    }
  }
  if (tagDropdownOpen.value) {
    const container = tagDropdownRef.value
    if (!container || !container.contains(target)) {
      tagDropdownOpen.value = false
    }
  }
  if (tagUserDropdownOpen.value) {
    const container = tagUserDropdownRef.value
    if (!container || !container.contains(target)) {
      tagUserDropdownOpen.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleAssignDropdownOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleAssignDropdownOutside)
})

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
    await Promise.all([fetchCodes(), fetchRedeemLogs()])
  } catch (error) {
    console.error('更新点歌券状态失败', error)
    showToast(getNestedMessage('messages', 'updateStatusFailed'), 'error')
  } finally {
    saving.value = false
  }
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
  await updateStatus(selectedIds.value, bulkStatus.value)
  clearSelection()
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
