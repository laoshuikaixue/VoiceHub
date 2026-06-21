<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 class="text-lg font-black">点歌券管理</h2>
        <p class="text-xs text-zinc-500 mt-1 font-medium">
          管理点歌券的创建、筛选、批量核销、导入导出和备注信息
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-bold hover:border-zinc-700 transition-all"
          @click="refreshAll"
        >
          <RefreshCw :size="14" /> 刷新
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-bold hover:border-zinc-700 transition-all"
          :disabled="exporting"
          @click="exportCodes"
        >
          <Download :size="14" /> {{ exporting ? '导出中...' : exportButtonText }}
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
                placeholder="搜索点歌券、备注"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40 transition-all"
                @keyup.enter="fetchCodes(1)"
              >
            </div>

            <CustomSelect
              v-model="filters.status"
              label="状态"
              :options="statusFilterOptions"
              label-key="label"
              value-key="value"
              placeholder="全部状态"
              class-name="min-w-[160px] sm:w-40"
              @change="fetchCodes(1)"
            />
          </div>

          <button
            class="text-xs font-bold text-zinc-500 hover:text-zinc-200 transition-colors"
            @click="resetFilters"
          >
            清空筛选
          </button>
        </div>

        <div v-if="selectedIds.length" class="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <span class="text-xs font-black text-blue-400">已选择 {{ selectedIds.length }} 项</span>
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
            执行批量操作
          </button>
          <button class="px-3 py-2 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold border border-zinc-800" @click="clearSelection">
            取消选择
          </button>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-zinc-800">
          <div v-if="loading" class="flex min-w-[880px] items-center justify-center bg-zinc-950/60 p-8 text-center text-sm text-zinc-500">
            加载点歌券中...
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
                <th class="px-3 py-3 w-64">点歌券</th>
                <th class="px-3 py-3 w-28">状态</th>
                <th class="px-3 py-3 w-60">备注</th>
                <th class="px-3 py-3 w-40">时间</th>
                <th class="px-3 py-3 w-44">操作</th>
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
                    <button class="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors" title="复制点歌券" @click="copyCode(item.code)">
                      <Copy :size="14" />
                    </button>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">
                  <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.2em]', statusMeta(item.status).class]">
                    {{ statusMeta(item.status).label }}
                  </span>
                  <p v-if="item.lockedAt || item.redeemedAt" class="mt-1 text-[10px] text-zinc-500 leading-relaxed">
                    <span v-if="item.lockedAt">锁定：{{ formatDate(item.lockedAt) }}</span>
                    <span v-if="item.redeemedAt">{{ item.lockedAt ? ' · ' : '' }}核销：{{ formatDate(item.redeemedAt) }}</span>
                  </p>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="space-y-2">
                    <textarea
                      v-model="item.noteDraft"
                      rows="2"
                      placeholder="备注"
                      class="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
                    />
                    <button class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 hover:text-blue-300 transition-colors" @click="saveNote(item)">
                      保存备注
                    </button>
                  </div>
                </td>
                <td class="px-3 py-3 align-top text-[11px] text-zinc-500 leading-relaxed">
                  <p>创建：{{ formatDate(item.createdAt) }}</p>
                  <p>更新：{{ formatDate(item.updatedAt) }}</p>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex flex-wrap gap-2">
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300" @click="updateStatus([item.id], 'AVAILABLE')">可用</button>
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-amber-300" @click="updateStatus([item.id], 'LOCKED')">锁定</button>
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300" @click="updateStatus([item.id], 'REDEEMED')">核销</button>
                    <button class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-red-300" @click="updateStatus([item.id], 'INVALID')">作废</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!codes.length">
                <td colspan="7" class="px-3 py-10 text-center text-sm text-zinc-500">没有找到符合条件的点歌券</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-model:current-page="pagination.page"
          :total-pages="pagination.totalPages"
          :total-items="pagination.total"
          item-name="张点歌券"
          @change="fetchCodes"
        />
      </section>

      <section class="space-y-4">
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-black text-zinc-100">批量创建 / 导入</h3>
              <p class="mt-1 text-[11px] text-zinc-500">支持手动粘贴、分隔导入，也支持自动生成点歌券</p>
            </div>
            <div class="inline-flex shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              <button
                :class="['min-w-[72px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors', createMode === 'manual' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500']"
                @click="createMode = 'manual'"
              >
                手动导入
              </button>
              <button
                :class="['min-w-[72px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors', createMode === 'generate' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500']"
                @click="createMode = 'generate'"
              >
                自动生成
              </button>
            </div>
          </div>

          <div v-if="createMode === 'manual'" class="space-y-3">
            <textarea
              v-model="manualCodes"
              rows="4"
              placeholder="输入单个点歌券，或使用逗号/换行/空格分隔多个点歌券"
              class="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
            />
          </div>

          <div v-else class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">生成数量</label>
              <input v-model.number="generateForm.count" type="number" min="1" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">前缀</label>
              <input v-model="generateForm.prefix" type="text" placeholder="例如 VH-" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">随机长度</label>
              <input v-model.number="generateForm.length" type="number" min="4" max="32" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">字符集</label>
              <input v-model="generateForm.charset" type="text" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40">
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">备注</label>
            <input v-model="createNote" type="text" placeholder="可选：批量备注" class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40">
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              class="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
              :disabled="saving"
              @click="createCodes"
            >
              <Plus :size="14" /> 创建点歌券
            </button>
            <button class="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-zinc-300" @click="fillDemoCodes">
              填充示例
            </button>
          </div>

          <div
            v-if="createMode === 'generate' && lastGeneratedCodes.length"
            class="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-black text-zinc-100">本次生成 {{ lastGeneratedCodes.length }} 张点歌券</p>
                <p class="mt-1 text-[11px] text-zinc-500">仅保留最近一次自动生成结果，方便发放前复制。</p>
              </div>
              <button
                class="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 transition-colors"
                @click="copyLastGeneratedCodes"
              >
                <Copy :size="14" /> 一键复制
              </button>
            </div>
            <div class="max-h-32 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
              <p v-for="code in lastGeneratedCodes" :key="code" class="break-all">{{ code }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-[0.24em]">快速说明</h3>
          <ul class="space-y-2 text-[12px] leading-relaxed text-zinc-500">
            <li>· 支持按状态和关键词筛选，搜索范围包含点歌券和备注。</li>
            <li>· 支持单条和批量状态切换，方便锁定、核销或作废。</li>
            <li>· 备注可直接就地编辑，适合记录发放对象、批次来源等信息。</li>
            <li>· 导出会按当前筛选条件生成完整 CSV；勾选点歌券后会优先导出勾选项。</li>
          </ul>
        </div>
      </section>
    </div>

    <section class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-[0.24em]">兑换日志</h3>
          <p class="mt-1 text-[11px] text-zinc-500">记录点歌券被哪个账号兑换、兑换时间、来源与关联歌曲</p>
        </div>
        <button
          class="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300"
          @click="fetchRedeemLogs"
        >
          刷新日志
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">关键词</label>
          <input
            v-model="logFilters.q"
            type="text"
            placeholder="点歌券 / 账号 / 歌曲 / 来源"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
            @keyup.enter="fetchRedeemLogs"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">来源</label>
          <select
            v-model="logFilters.source"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40"
          >
            <option value="">全部来源</option>
            <option value="ADMIN_MANUAL">手动核销</option>
            <option value="SCHEDULE_AUTO">排期自动</option>
            <option value="SCHEDULE_REMOVE">移除排期</option>
          </select>
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">兑换账号</label>
          <input
            v-model="logFilters.redeemer"
            type="text"
            placeholder="用户名 / 昵称"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/40"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">起始日期</label>
          <input
            v-model="logFilters.startDate"
            type="date"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/40"
          >
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">结束日期</label>
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
          查询日志
        </button>
        <button
          class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-zinc-300"
          @click="resetLogFilters"
        >
          清空条件
        </button>
      </div>

      <div v-if="logsLoading" class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
        加载兑换日志中...
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-zinc-800">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-zinc-950/80 text-zinc-500">
            <tr>
              <th class="px-3 py-3 w-20">日志ID</th>
              <th class="px-3 py-3">点歌券</th>
              <th class="px-3 py-3 w-28">来源</th>
              <th class="px-3 py-3 w-56">兑换账号</th>
              <th class="px-3 py-3 w-40">兑换时间</th>
              <th class="px-3 py-3">关联歌曲</th>
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
                {{ item.redeemer?.name || '未知用户' }}
                <span class="text-zinc-500">({{ item.redeemer?.username || 'unknown' }})</span>
              </td>
              <td class="px-3 py-3 text-zinc-400">{{ formatDate(item.redeemedAt) }}</td>
              <td class="px-3 py-3 text-zinc-300">
                <span v-if="item.song">{{ item.song.title }}<span class="text-zinc-500">{{ item.song.artist ? ` · ${item.song.artist}` : '' }}</span></span>
                <span v-else class="text-zinc-500">—</span>
              </td>
            </tr>
            <tr v-if="!redeemLogs.length">
              <td colspan="6" class="px-3 py-8 text-center text-sm text-zinc-500">暂无兑换日志</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Copy, Download, Plus, RefreshCw, Search } from 'lucide-vue-next'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import { useToast } from '~/composables/useToast'

const { showToast } = useToast()

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

const statusFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '可用', value: 'AVAILABLE' },
  { label: '已锁定', value: 'LOCKED' },
  { label: '已核销', value: 'REDEEMED' },
  { label: '已作废', value: 'INVALID' }
]

const bulkStatusOptions = [
  { label: '设为可用', value: 'AVAILABLE' },
  { label: '设为锁定', value: 'LOCKED' },
  { label: '设为核销', value: 'REDEEMED' },
  { label: '设为作废', value: 'INVALID' }
]

const statusMap = {
  AVAILABLE: { label: '可用', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
  LOCKED: { label: '锁定', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
  REDEEMED: { label: '核销', class: 'bg-blue-500/10 text-blue-300 border border-blue-500/20' },
  INVALID: { label: '作废', class: 'bg-red-500/10 text-red-300 border border-red-500/20' }
}

const statusMeta = (status) => statusMap[status] || { label: status || '未知', class: 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20' }

const logSourceMap = {
  ADMIN_MANUAL: { label: '手动核销', class: 'bg-blue-500/10 text-blue-300 border border-blue-500/20' },
  ADMIN: { label: '管理员操作', class: 'bg-blue-500/10 text-blue-300 border border-blue-500/20' },
  SCHEDULE_AUTO: { label: '排期自动', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
  SCHEDULE_REMOVE: { label: '移除排期', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
  SCHEDULE: { label: '排期', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
  WITHDRAW: { label: '撤回', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
  UNKNOWN: { label: '未知', class: 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20' }
}

const logSourceMeta = (source) => logSourceMap[source] || logSourceMap.UNKNOWN

const stats = computed(() => {
  const total = cardStats.value.total
  const available = cardStats.value.available
  const locked = cardStats.value.locked
  const redeemed = cardStats.value.redeemed

  return [
    { label: '总数', value: total, hint: '全部', badgeClass: 'bg-zinc-800 text-zinc-200' },
    { label: '可用', value: available, hint: '未使用', badgeClass: 'bg-emerald-500/10 text-emerald-300' },
    { label: '锁定', value: locked, hint: '待核销', badgeClass: 'bg-amber-500/10 text-amber-300' },
    { label: '核销', value: redeemed, hint: '已完成', badgeClass: 'bg-blue-500/10 text-blue-300' }
  ]
})

const allVisibleSelected = computed(() => codes.value.length > 0 && codes.value.every((item) => selectedIds.value.includes(item.id)))
const someVisibleSelected = computed(() => codes.value.some((item) => selectedIds.value.includes(item.id)))
const exportButtonText = computed(() => (selectedIds.value.length ? `导出已选 ${selectedIds.value.length} 项` : '导出筛选结果'))

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
    showToast('获取点歌券失败', 'error')
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
    showToast('获取点歌券兑换日志失败', 'error')
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
    showToast('点歌券已复制', 'success')
  } catch (error) {
    console.error('复制失败', error)
    showToast('复制失败，请手动复制', 'error')
  }
}

const copyLastGeneratedCodes = async () => {
  if (!lastGeneratedCodes.value.length) {
    showToast('暂无可复制的本次生成点歌券', 'warning')
    return
  }

  try {
    await navigator.clipboard.writeText(lastGeneratedCodes.value.join('\n'))
    showToast(`已复制 ${lastGeneratedCodes.value.length} 张点歌券`, 'success')
  } catch (error) {
    console.error('批量复制点歌券失败', error)
    showToast('复制失败，请手动复制', 'error')
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
      let message = '导出点歌券失败'
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
    showToast(selectedIds.value.length ? '已导出勾选点歌券' : '已导出筛选结果', 'success')
  } catch (error) {
    console.error('导出点歌券失败', error)
    showToast(error?.message || '导出点歌券失败', 'error')
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

    showToast('状态已更新', 'success')
    await Promise.all([fetchCodes(), fetchRedeemLogs()])
  } catch (error) {
    console.error('更新点歌券状态失败', error)
    showToast('更新点歌券状态失败', 'error')
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
    showToast('备注已保存', 'success')
    item.note = item.noteDraft || null
  } catch (error) {
    console.error('保存备注失败', error)
    showToast('保存备注失败', 'error')
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
        showToast('请先输入点歌券', 'warning')
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
    showToast(skipped ? `创建完成，成功 ${inserted} 条，跳过 ${skipped} 条重复项` : `创建成功，共 ${inserted} 条`, 'success')
    manualCodes.value = ''
    createNote.value = ''
    await fetchCodes()
  } catch (error) {
    console.error('创建点歌券失败', error)
    showToast(error?.data?.message || error?.message || '创建点歌券失败', 'error')
  } finally {
    saving.value = false
  }
}

const createFormCount = computed(() => generateForm.value.count)

const fillDemoCodes = () => {
  createMode.value = 'manual'
  manualCodes.value = ['DEMO-2026-A001', 'DEMO-2026-A002', 'DEMO-2026-A003'].join('\n')
  createNote.value = '示例点歌券'
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
