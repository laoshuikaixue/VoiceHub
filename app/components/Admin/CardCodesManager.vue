<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 class="text-lg font-black">{{ locale.title }}</h2>
        <p class="text-xs text-zinc-500 mt-1 font-medium">
          {{ locale.desc }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-bold hover:border-zinc-700 transition-all"
          @click="refreshAll"
        >
          <RefreshCw :size="14" /> {{ locale.refresh }}
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-bold hover:border-zinc-700 transition-all"
          :disabled="exporting"
          @click="exportCodes"
        >
          <Download :size="14" /> {{ exporting ? locale.exporting : exportButtonText }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div v-for="item in stats" :key="item.label" class="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{{ item.label }}</p>
        <div class="mt-2 flex items-end justify-between gap-2">
          <span class="text-2xl font-black text-zinc-100">{{ item.value }}</span>
          <span :class="['text-[10px] font-bold px-2 py-1 rounded-full', item.badgeClass]">{{ item.hint }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <section class="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-1 flex-col sm:flex-row gap-3">
            <div class="relative flex-1">
              <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                v-model="filters.q"
                type="text"
                :placeholder="locale.searchPlaceholder"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40 transition-all"
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
            class="text-xs font-bold text-zinc-500 hover:text-zinc-200 transition-colors"
            @click="resetFilters"
          >
            {{ locale.clearFilters }}
          </button>
        </div>

        <div v-if="selectedIds.length" class="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <span class="text-xs font-black text-blue-400">{{ getLocaleMessage('selectedItems', selectedIds.length) }}</span>
          <CustomSelect
            v-model="bulkStatus"
            :options="bulkStatusOptions"
            label-key="label"
            value-key="value"
            class-name="w-32"
          />
          <button
            class="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors"
            :disabled="saving"
            @click="applyBulkStatus"
          >
            {{ locale.applyBulk }}
          </button>
          <button class="px-3 py-2 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold border border-zinc-800" @click="clearSelection">
            {{ locale.cancelSelection }}
          </button>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-zinc-800">
          <div v-if="loading" class="flex min-w-[880px] items-center justify-center bg-zinc-950/60 p-8 text-center text-sm text-zinc-500">
            {{ locale.loading }}
          </div>

          <table v-else class="min-w-[880px] table-fixed text-left text-sm">
            <thead class="bg-zinc-950/80 text-zinc-500">
              <tr>
                <th class="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-blue-500"
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
              <tr v-for="item in codes" :key="item.id" class="border-t border-zinc-800/80 hover:bg-zinc-950/70 transition-colors">
                <td class="px-3 py-3 align-top">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-blue-500"
                    :checked="selectedIds.includes(item.id)"
                    @change="toggleSelect(item.id)"
                  >
                </td>
                <td class="px-3 py-3 align-top text-zinc-500">{{ item.id }}</td>
                <td class="px-3 py-3 align-top font-mono text-zinc-100">
                  <div class="flex max-w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <span class="block min-w-0 flex-1 truncate text-xs tracking-[0.08em]" :title="item.code">{{ item.code }}</span>
                    <button class="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors" :title="locale.copy" @click="copyCode(item.code)">
                      <Copy :size="14" />
                    </button>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">
                  <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.2em]', statusMeta(item.status).class]">
                    {{ statusMeta(item.status).label }}
                  </span>
                  <p v-if="item.lockedAt || item.redeemedAt" class="mt-1 text-[10px] text-zinc-500 leading-relaxed">
                    <span v-if="item.lockedAt">{{ getLocaleMessage('lockedAt', formatDate(item.lockedAt)) }}</span>
                    <span v-if="item.redeemedAt">{{ item.lockedAt ? ' · ' : '' }}{{ getLocaleMessage('redeemedAt', formatDate(item.redeemedAt)) }}</span>
                  </p>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="space-y-2">
                    <textarea
                      v-model="item.noteDraft"
                      rows="2"
                      :placeholder="locale.note"
                      class="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
                    />
                    <button class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 hover:text-blue-300 transition-colors" @click="saveNote(item)">
                      {{ locale.saveNote }}
                    </button>
                  </div>
                </td>
                <td class="px-3 py-3 align-top text-[11px] text-zinc-500 leading-relaxed">
                  <p>{{ getLocaleMessage('createdAt', formatDate(item.createdAt)) }}</p>
                  <p>{{ getLocaleMessage('updatedAt', formatDate(item.updatedAt)) }}</p>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex flex-wrap gap-2">
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300" @click="updateStatus([item.id], 'AVAILABLE')">{{ locale.available }}</button>
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-amber-300" @click="updateStatus([item.id], 'LOCKED')">{{ locale.locked }}</button>
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300" @click="updateStatus([item.id], 'REDEEMED')">{{ locale.redeemed }}</button>
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-red-300" @click="updateStatus([item.id], 'INVALID')">{{ locale.invalid }}</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!codes.length">
                <td colspan="7" class="px-3 py-10 text-center text-sm text-zinc-500">{{ locale.empty }}</td>
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
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-black text-zinc-100">{{ locale.createTitle }}</h3>
              <p class="mt-1 text-[11px] text-zinc-500">{{ locale.createDesc }}</p>
            </div>
            <div class="inline-flex shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              <button
                :class="['min-w-[72px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors', createMode === 'manual' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500']"
                @click="createMode = 'manual'"
              >
                {{ locale.manualImport }}
              </button>
              <button
                :class="['min-w-[72px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors', createMode === 'generate' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500']"
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
              class="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
            />
          </div>

          <div v-else class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.generateCount }}</label>
              <input v-model.number="generateForm.count" type="number" min="1" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.prefix }}</label>
              <input v-model="generateForm.prefix" type="text" :placeholder="locale.prefixPlaceholder" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.randomLength }}</label>
              <input v-model.number="generateForm.length" type="number" min="4" max="32" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.charset }}</label>
              <input v-model="generateForm.charset" type="text" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.note }}</label>
            <input v-model="createNote" type="text" :placeholder="locale.bulkNotePlaceholder" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40">
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              class="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
              :disabled="saving"
              @click="createCodes"
            >
              <Plus :size="14" /> {{ locale.createCardCode }}
            </button>
            <button class="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-zinc-300" @click="fillDemoCodes">
              {{ locale.fillDemo }}
            </button>
          </div>

          <div
            v-if="createMode === 'generate' && lastGeneratedCodes.length"
            class="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-black text-zinc-100">{{ getLocaleMessage('lastGeneratedTitle', lastGeneratedCodes.length) }}</p>
                <p class="mt-1 text-[11px] text-zinc-500">{{ locale.lastGeneratedDesc }}</p>
              </div>
              <button
                class="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 transition-colors"
                @click="copyLastGeneratedCodes"
              >
                <Copy :size="14" /> {{ locale.copyAll }}
              </button>
            </div>
            <div class="max-h-32 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
              <p v-for="code in lastGeneratedCodes" :key="code" class="break-all">{{ code }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-[0.24em]">{{ locale.quickTipsTitle }}</h3>
          <ul class="space-y-2 text-[12px] leading-relaxed text-zinc-500">
            <li v-for="tip in locale.quickTips" :key="tip">· {{ tip }}</li>
          </ul>
        </div>
      </section>
    </div>

    <section class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-[0.24em]">{{ locale.redeemLogsTitle }}</h3>
          <p class="mt-1 text-[11px] text-zinc-500">{{ locale.redeemLogsDesc }}</p>
        </div>
        <button
          class="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300"
          @click="fetchRedeemLogs"
        >
          {{ locale.refreshLogs }}
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.keyword }}</label>
          <input
            v-model="logFilters.q"
            type="text"
            :placeholder="locale.logSearchPlaceholder"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
            @keyup.enter="fetchRedeemLogs"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.source }}</label>
          <select
            v-model="logFilters.source"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40"
          >
            <option value="">{{ locale.allSources }}</option>
            <option value="ADMIN_MANUAL">{{ locale.sources?.adminManual || '手动核销' }}</option>
            <option value="SCHEDULE_AUTO">{{ locale.sources?.scheduleAuto || '排期自动' }}</option>
            <option value="SCHEDULE_REMOVE">{{ locale.sources?.scheduleRemove || '移除排期' }}</option>
          </select>
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.redeemer }}</label>
          <input
            v-model="logFilters.redeemer"
            type="text"
            :placeholder="locale.redeemerPlaceholder"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.startDate }}</label>
          <input
            v-model="logFilters.startDate"
            type="date"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{{ locale.endDate }}</label>
          <input
            v-model="logFilters.endDate"
            type="date"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40"
          >
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500 transition-colors"
          @click="fetchRedeemLogs"
        >
          {{ locale.queryLogs }}
        </button>
        <button
          class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-zinc-300"
          @click="resetLogFilters"
        >
          {{ locale.clearConditions }}
        </button>
      </div>

      <div v-if="logsLoading" class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
        {{ locale.loadingLogs }}
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-zinc-800">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-zinc-950/80 text-zinc-500">
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
              class="border-t border-zinc-800/80 hover:bg-zinc-950/70 transition-colors"
            >
              <td class="px-3 py-3 text-zinc-500">{{ item.id }}</td>
              <td class="px-3 py-3 font-mono text-zinc-200 break-all">{{ item.code || item.codeSnapshot }}</td>
              <td class="px-3 py-3">
                <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.2em]', logSourceMeta(item.source).class]">
                  {{ logSourceMeta(item.source).label }}
                </span>
              </td>
              <td class="px-3 py-3 text-zinc-300">
                {{ item.redeemer?.name || locale.unknownUser }}
                <span class="text-zinc-500">({{ item.redeemer?.username || 'unknown' }})</span>
              </td>
              <td class="px-3 py-3 text-zinc-400">{{ formatDate(item.redeemedAt) }}</td>
              <td class="px-3 py-3 text-zinc-300">
                <span v-if="item.song">{{ item.song.title }}<span class="text-zinc-500">{{ item.song.artist ? ` · ${item.song.artist}` : '' }}</span></span>
                <span v-else class="text-zinc-500">—</span>
              </td>
            </tr>
            <tr v-if="!redeemLogs.length">
              <td colspan="6" class="px-3 py-8 text-center text-sm text-zinc-500">{{ locale.noRedeemLogs }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Copy, Download, Plus, RefreshCw, Search } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const formatString = (value, args) => {
  if (typeof value !== 'string') return value
  return value.replace(/{(\d+)}/g, (match, index) =>
    args[index] !== undefined ? String(args[index]) : match
  )
}
const getLocaleMessage = (key, ...args) => {
  const message = locale.value?.[key]
  if (typeof message === 'function') return message(...args)
  return formatString(message, args) || ''
}
const getNestedMessage = (section, key, ...args) => {
  const message = locale.value?.[section]?.[key]
  if (typeof message === 'function') return message(...args)
  return formatString(message, args) || ''
}

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

const statusFilterOptions = computed(() => [
  { label: locale.value?.allStatus || 'All Status', value: '' },
  { label: locale.value?.available || 'Available', value: 'AVAILABLE' },
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
    AVAILABLE: { label: locale.value?.available || 'Available', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
    LOCKED: { label: locale.value?.locked || 'Locked', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
    REDEEMED: { label: locale.value?.redeemed || 'Redeemed', class: 'bg-blue-500/10 text-blue-300 border border-blue-500/20' },
    INVALID: { label: locale.value?.invalid || 'Invalid', class: 'bg-red-500/10 text-red-300 border border-red-500/20' }
  }
  return statusMap[status] || { label: status || locale.value?.unknown || 'Unknown', class: 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20' }
}

const logSourceMeta = (source) => {
  const sourceMap = {
    ADMIN_MANUAL: { label: locale.value?.sources?.adminManual || 'Manual Redeem', class: 'bg-blue-500/10 text-blue-300 border border-blue-500/20' },
    ADMIN: { label: locale.value?.sources?.admin || 'Admin Action', class: 'bg-blue-500/10 text-blue-300 border border-blue-500/20' },
    SCHEDULE_AUTO: { label: locale.value?.sources?.scheduleAuto || 'Schedule Auto', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
    SCHEDULE_REMOVE: { label: locale.value?.sources?.scheduleRemove || 'Schedule Remove', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
    SCHEDULE: { label: locale.value?.sources?.schedule || 'Schedule', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
    WITHDRAW: { label: locale.value?.sources?.withdraw || 'Withdraw', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
    UNKNOWN: { label: locale.value?.unknown || 'Unknown', class: 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20' }
  }
  return sourceMap[source] || sourceMap.UNKNOWN
}

const stats = computed(() => {
  const total = cardStats.value?.total ?? 0
  const available = cardStats.value?.available ?? 0
  const locked = cardStats.value?.locked ?? 0
  const redeemed = cardStats.value?.redeemed ?? 0

  return [
    { label: locale.value?.stats?.total || 'Total', value: total, hint: locale.value?.stats?.all || 'All', badgeClass: 'bg-zinc-800 text-zinc-200' },
    { label: locale.value?.stats?.available || 'Available', value: available, hint: locale.value?.stats?.unused || 'Unused', badgeClass: 'bg-emerald-500/10 text-emerald-300' },
    { label: locale.value?.stats?.locked || 'Locked', value: locked, hint: locale.value?.stats?.pendingRedeem || 'Pending redeem', badgeClass: 'bg-amber-500/10 text-amber-300' },
    { label: locale.value?.stats?.redeemed || 'Redeemed', value: redeemed, hint: locale.value?.stats?.completed || 'Completed', badgeClass: 'bg-blue-500/10 text-blue-300' }
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

const refreshAll = async () => {
  await Promise.all([fetchCodes(), fetchRedeemLogs()])
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
  scrollbar-color: #3f3f46 transparent;
}

textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 9999px;
}
</style>
