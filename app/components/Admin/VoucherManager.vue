<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">点歌券管理</h2>
        <p class="text-xs text-zinc-500 mt-1">
          生成、查询、禁用点歌券，并管理补交任务状态
        </p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all"
        @click="refreshAll"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': loadingCodes || loadingTasks }" /> 刷新数据
      </button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
        <h3 class="text-sm font-black text-zinc-100 tracking-widest uppercase">生成点歌券</h3>
        <div class="flex flex-col md:flex-row gap-3 items-end">
          <div class="w-full md:w-44">
            <label class="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1.5"
              >数量</label
            >
            <input
              v-model.number="generateCount"
              type="number"
              min="1"
              max="500"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
            >
          </div>
          <button
            class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all"
            :disabled="generating"
            @click="generateCodes"
          >
            {{ generating ? '生成中...' : '生成并入库' }}
          </button>
        </div>
        <p class="text-[11px] text-zinc-500">
          新生成的原始卡密只会在这里显示一次，请及时保存。
        </p>
      </div>

      <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-black text-zinc-100 tracking-widest uppercase">本次生成结果</h3>
          <button
            class="px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] font-black rounded-lg transition-all disabled:opacity-50"
            :disabled="generatedCodes.length === 0"
            @click="copyGeneratedCodes"
          >
            <Copy :size="12" class="inline mr-1" /> 复制
          </button>
        </div>
        <textarea
          :value="generatedCodes.join('\n')"
          readonly
          class="w-full min-h-32 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none"
          placeholder="生成后的点歌券会显示在这里"
        />
      </div>
    </div>

    <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 class="text-sm font-black text-zinc-100 tracking-widest uppercase">点歌券列表</h3>
        <span class="text-[10px] text-zinc-600 uppercase tracking-widest"
          >共 {{ codesPagination.total }} 条</span
        >
      </div>

      <div class="flex flex-col lg:flex-row gap-3">
        <input
          v-model="codeFilters.search"
          type="text"
          placeholder="搜索尾号 / 使用人"
          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
          @input="debouncedLoadCodes"
        >
        <select
          v-model="codeFilters.status"
          class="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
          @change="handleCodeFilterChange"
        >
          <option value="ALL">全部状态</option>
          <option value="ACTIVE">可用</option>
          <option value="USED">已使用</option>
          <option value="DISABLED">已禁用</option>
          <option value="EXPIRED">已过期</option>
        </select>
      </div>

      <div class="overflow-x-auto border border-zinc-800/70 rounded-xl">
        <table class="w-full min-w-[920px]">
          <thead class="bg-zinc-950/90">
            <tr class="text-left text-[10px] text-zinc-500 uppercase tracking-widest">
              <th class="px-3 py-3">尾号</th>
              <th class="px-3 py-3">状态</th>
              <th class="px-3 py-3">使用人</th>
              <th class="px-3 py-3">使用时间</th>
              <th class="px-3 py-3">创建时间</th>
              <th class="px-3 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingCodes">
              <td colspan="6" class="px-3 py-8 text-center text-xs text-zinc-500">加载中...</td>
            </tr>
            <tr v-else-if="codes.length === 0">
              <td colspan="6" class="px-3 py-8 text-center text-xs text-zinc-500">暂无数据</td>
            </tr>
            <tr
              v-for="item in codes"
              v-else
              :key="item.id"
              class="border-t border-zinc-800/70 text-xs text-zinc-300"
            >
              <td class="px-3 py-3 font-mono">****{{ item.codeTail }}</td>
              <td class="px-3 py-3">
                <span :class="statusClass(item.status)">{{ statusText(item.status) }}</span>
              </td>
              <td class="px-3 py-3">{{ item.usedByName || item.usedByUsername || '-' }}</td>
              <td class="px-3 py-3 text-zinc-500">{{ formatDate(item.usedAt) }}</td>
              <td class="px-3 py-3 text-zinc-500">{{ formatDate(item.createdAt) }}</td>
              <td class="px-3 py-3 text-right">
                <button
                  v-if="item.status === 'ACTIVE'"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-lg hover:bg-red-500/20 transition-all"
                  @click="disableCode(item)"
                >
                  <Ban :size="12" /> 禁用
                </button>
                <span v-else class="text-[10px] text-zinc-600">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-model:current-page="codesPagination.page"
        :total-pages="codesPagination.totalPages"
        :total-items="codesPagination.total"
        item-name="个点歌券"
        @change="loadCodes"
      />
    </div>

    <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 class="text-sm font-black text-zinc-100 tracking-widest uppercase">补交任务管理</h3>
        <span class="text-[10px] text-zinc-600 uppercase tracking-widest"
          >共 {{ taskPagination.total }} 条</span
        >
      </div>

      <div class="flex flex-col lg:flex-row gap-3">
        <input
          v-model="taskFilters.search"
          type="text"
          placeholder="搜索歌曲 / 用户 / 卡密尾号"
          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
          @input="debouncedLoadTasks"
        >
        <select
          v-model="taskFilters.status"
          class="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
          @change="handleTaskFilterChange"
        >
          <option value="ALL">全部状态</option>
          <option value="PENDING">待补交</option>
          <option value="REDEEMED">已补交</option>
          <option value="EXPIRED">已超时</option>
          <option value="CANCELLED">已取消</option>
        </select>
      </div>

      <div class="overflow-x-auto border border-zinc-800/70 rounded-xl">
        <table class="w-full min-w-[1060px]">
          <thead class="bg-zinc-950/90">
            <tr class="text-left text-[10px] text-zinc-500 uppercase tracking-widest">
              <th class="px-3 py-3">歌曲</th>
              <th class="px-3 py-3">用户</th>
              <th class="px-3 py-3">状态</th>
              <th class="px-3 py-3">截止时间</th>
              <th class="px-3 py-3">兑换时间</th>
              <th class="px-3 py-3">兑换卡密</th>
              <th class="px-3 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingTasks">
              <td colspan="7" class="px-3 py-8 text-center text-xs text-zinc-500">加载中...</td>
            </tr>
            <tr v-else-if="tasks.length === 0">
              <td colspan="7" class="px-3 py-8 text-center text-xs text-zinc-500">暂无数据</td>
            </tr>
            <tr
              v-for="item in tasks"
              v-else
              :key="item.id"
              class="border-t border-zinc-800/70 text-xs text-zinc-300"
            >
              <td class="px-3 py-3">
                <div class="font-bold text-zinc-200">{{ item.songTitle }}</div>
                <div class="text-zinc-500">{{ item.songArtist }}</div>
              </td>
              <td class="px-3 py-3">
                <div>{{ item.userName || '-' }}</div>
                <div class="text-zinc-500">{{ item.username }}</div>
              </td>
              <td class="px-3 py-3">
                <span :class="statusClass(item.status)">{{ statusText(item.status) }}</span>
              </td>
              <td class="px-3 py-3 text-zinc-500">{{ formatDate(item.redeemDeadlineAt) }}</td>
              <td class="px-3 py-3 text-zinc-500">{{ formatDate(item.redeemedAt) }}</td>
              <td class="px-3 py-3 font-mono">{{ item.voucherCodeTail ? `****${item.voucherCodeTail}` : '-' }}</td>
              <td class="px-3 py-3 text-right">
                <button
                  v-if="item.status === 'PENDING' || item.status === 'EXPIRED'"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black rounded-lg hover:bg-amber-500/20 transition-all"
                  @click="cancelTask(item)"
                >
                  取消任务
                </button>
                <span v-else class="text-[10px] text-zinc-600">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-model:current-page="taskPagination.page"
        :total-pages="taskPagination.totalPages"
        :total-items="taskPagination.total"
        item-name="条任务"
        @change="loadTasks"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Ban, Copy, RefreshCw } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const toast = useToast()

const generating = ref(false)
const loadingCodes = ref(false)
const loadingTasks = ref(false)

const generateCount = ref(20)
const generatedCodes = ref([])

const codes = ref([])
const tasks = ref([])

const codeFilters = reactive({
  search: '',
  status: 'ALL'
})

const taskFilters = reactive({
  search: '',
  status: 'ALL'
})

const codesPagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
})

const taskPagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
})

let codeSearchTimer = null
let taskSearchTimer = null

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date)
}

const statusText = (status) => {
  const map = {
    ACTIVE: '可用',
    USED: '已使用',
    DISABLED: '已禁用',
    EXPIRED: '已过期',
    PENDING: '待补交',
    REDEEMED: '已补交',
    CANCELLED: '已取消'
  }
  return map[status] || status
}

const statusClass = (status) => {
  if (status === 'ACTIVE' || status === 'REDEEMED') {
    return 'inline-flex px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black'
  }
  if (status === 'PENDING') {
    return 'inline-flex px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black'
  }
  if (status === 'EXPIRED' || status === 'DISABLED') {
    return 'inline-flex px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black'
  }
  return 'inline-flex px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-black'
}

const loadCodes = async () => {
  loadingCodes.value = true
  try {
    const result = await $fetch('/api/admin/vouchers/codes', {
      method: 'GET',
      query: {
        page: codesPagination.page,
        limit: codesPagination.limit,
        search: codeFilters.search,
        status: codeFilters.status
      }
    })

    codes.value = result?.data?.items || []
    const pagination = result?.data?.pagination || {}
    codesPagination.total = pagination.total || 0
    codesPagination.totalPages = pagination.totalPages || 1
  } catch (error) {
    console.error('加载点歌券失败:', error)
    toast.error(error?.data?.message || error?.message || '加载点歌券失败')
  } finally {
    loadingCodes.value = false
  }
}

const loadTasks = async () => {
  loadingTasks.value = true
  try {
    const result = await $fetch('/api/admin/vouchers/tasks', {
      method: 'GET',
      query: {
        page: taskPagination.page,
        limit: taskPagination.limit,
        search: taskFilters.search,
        status: taskFilters.status
      }
    })

    tasks.value = result?.data?.items || []
    const pagination = result?.data?.pagination || {}
    taskPagination.total = pagination.total || 0
    taskPagination.totalPages = pagination.totalPages || 1
  } catch (error) {
    console.error('加载补交任务失败:', error)
    toast.error(error?.data?.message || error?.message || '加载补交任务失败')
  } finally {
    loadingTasks.value = false
  }
}

const generateCodes = async () => {
  const count = Number(generateCount.value)
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    toast.warning('生成数量必须在 1 到 500 之间')
    return
  }

  generating.value = true
  try {
    const result = await $fetch('/api/admin/vouchers/codes/generate', {
      method: 'POST',
      body: { count }
    })

    generatedCodes.value = result?.data?.codes || []
    toast.success(result?.message || '点歌券生成成功')
    await loadCodes()
  } catch (error) {
    console.error('生成点歌券失败:', error)
    toast.error(error?.data?.message || error?.message || '生成点歌券失败')
  } finally {
    generating.value = false
  }
}

const copyGeneratedCodes = async () => {
  if (!generatedCodes.value.length) return

  try {
    await navigator.clipboard.writeText(generatedCodes.value.join('\n'))
    toast.success('已复制到剪贴板')
  } catch (error) {
    console.error('复制失败:', error)
    toast.error('复制失败，请手动复制')
  }
}

const disableCode = async (item) => {
  const ok = window.confirm(`确定禁用尾号 ${item.codeTail} 的点歌券吗？`)
  if (!ok) return

  try {
    await $fetch(`/api/admin/vouchers/codes/${item.id}/disable`, {
      method: 'POST'
    })
    toast.success('点歌券已禁用')
    await loadCodes()
  } catch (error) {
    console.error('禁用点歌券失败:', error)
    toast.error(error?.data?.message || error?.message || '禁用点歌券失败')
  }
}

const cancelTask = async (item) => {
  const ok = window.confirm(`确定取消任务 ${item.id} 吗？`)
  if (!ok) return

  try {
    const result = await $fetch(`/api/admin/vouchers/tasks/${item.id}/cancel`, {
      method: 'POST'
    })
    toast.success(result?.message || '任务已取消')
    await loadTasks()
  } catch (error) {
    console.error('取消任务失败:', error)
    toast.error(error?.data?.message || error?.message || '取消任务失败')
  }
}

const handleCodeFilterChange = async () => {
  codesPagination.page = 1
  await loadCodes()
}

const handleTaskFilterChange = async () => {
  taskPagination.page = 1
  await loadTasks()
}

const debouncedLoadCodes = () => {
  if (codeSearchTimer) clearTimeout(codeSearchTimer)
  codeSearchTimer = setTimeout(async () => {
    codesPagination.page = 1
    await loadCodes()
  }, 300)
}

const debouncedLoadTasks = () => {
  if (taskSearchTimer) clearTimeout(taskSearchTimer)
  taskSearchTimer = setTimeout(async () => {
    taskPagination.page = 1
    await loadTasks()
  }, 300)
}

const refreshAll = async () => {
  await Promise.all([loadCodes(), loadTasks()])
}

onMounted(async () => {
  await refreshAll()
})
</script>
