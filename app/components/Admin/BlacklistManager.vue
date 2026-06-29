<template>
  <div
    class="max-w-[1400px] mx-auto space-y-8 pb-20 px-2 animate-in fade-in slide-in-from-bottom-4 duration-700"
  >
    <!-- 页面标题 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
          {{ locale.title }}
        </h2>
        <p class="text-xs text-zinc-500 mt-1 font-medium">
          {{ locale.desc }}
        </p>
      </div>
    </div>

    <!-- 添加黑名单项表单 -->
    <section class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 shadow-xl">
      <h3 class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-6 px-1">
        {{ locale.addTitle }}
      </h3>
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-end">
        <div class="xl:col-span-2 space-y-2">
          <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
            >{{ locale.type }}</label
          >
          <div class="flex p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
            <button
              class="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[11px] font-bold transition-all"
              :class="newItem.type === 'SONG' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-600'"
              @click="newItem.type = 'SONG'"
            >
              <Music :size="12" /> {{ locale.song }}
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[11px] font-bold transition-all"
              :class="newItem.type === 'KEYWORD' ? 'bg-zinc-800 text-purple-400' : 'text-zinc-600'"
              @click="newItem.type = 'KEYWORD'"
            >
              <Type :size="12" /> {{ locale.keyword }}
            </button>
          </div>
        </div>

        <div class="xl:col-span-4 space-y-2">
          <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">
            {{ newItem.type === 'SONG' ? locale.songLabel : locale.keywordLabel }}
          </label>
          <input
            v-model="newItem.value"
            type="text"
            :placeholder="
              newItem.type === 'SONG' ? locale.songPlaceholder : locale.keywordPlaceholder
            "
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 placeholder:text-zinc-700 transition-all"
          >
        </div>

        <div class="xl:col-span-4 space-y-2">
          <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
            >{{ locale.reason }}</label
          >
          <input
            v-model="newItem.reason"
            type="text"
            :placeholder="locale.reasonPlaceholder"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 placeholder:text-zinc-700 transition-all"
          >
        </div>

        <div class="xl:col-span-2">
          <button
            :disabled="!newItem.value || loading"
            class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            @click="addBlacklistItem"
          >
            <Plus v-if="!loading" :size="16" />
            <div
              v-else
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            />
            {{ loading ? locale.processing : locale.addButton }}
          </button>
        </div>
      </div>
    </section>

    <!-- 筛选和搜索 -->
    <div
      class="bg-zinc-900/20 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center"
    >
      <div class="flex-1 relative w-full">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" :size="18" />
        <input
          v-model="filters.search"
          type="text"
          :placeholder="locale.searchPlaceholder"
          class="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg pl-12 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 placeholder:text-zinc-700 transition-all"
          @input="debounceSearch"
        >
      </div>
      <div class="flex gap-3 w-full md:w-auto">
        <CustomSelect
          :label="locale.typeFilter"
          :value="typeFilterLabel"
          :options="[locale.allTypes, locale.song, locale.keyword]"
          class="flex-1 md:w-48"
          @change="handleTypeFilterChange"
        />
        <button
          class="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-600 hover:text-blue-400 transition-all active:scale-95"
          @click="loadBlacklist"
        >
          <Filter :size="18" />
        </button>
      </div>
    </div>

    <!-- 黑名单列表 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between px-2">
        <h4 class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
          {{ locale.listTitle(pagination.total) }}
        </h4>
      </div>

      <div class="grid grid-cols-1 gap-3">
        <TransitionGroup
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-200 ease-in absolute w-full"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            v-for="item in blacklist"
            :key="item.id"
            class="group flex flex-col lg:flex-row lg:items-center gap-6 p-6 bg-zinc-900/30 border rounded-xl transition-all hover:border-zinc-700"
            :class="[item.isActive ? 'border-zinc-800' : 'border-zinc-800/40 opacity-60']"
          >
            <div class="flex-1 flex items-start gap-5">
              <div
                class="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border transition-all"
                :class="[
                  item.type === 'SONG'
                    ? 'bg-blue-600/10 text-blue-500 border-blue-500/20 shadow-lg shadow-blue-900/5'
                    : 'bg-purple-600/10 text-purple-500 border-purple-500/20 shadow-lg shadow-purple-900/5'
                ]"
              >
                <Music v-if="item.type === 'SONG'" :size="22" />
                <Type v-else :size="22" />
              </div>

              <div class="space-y-1.5 min-w-0">
                <div class="flex items-center gap-3">
                  <span
                    class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border"
                    :class="[
                      item.type === 'SONG'
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
                        : 'bg-purple-600/10 text-purple-400 border-purple-500/20'
                    ]"
                  >
                    {{ item.type === 'SONG' ? locale.song : locale.keyword }}
                  </span>
                  <h5 class="text-base font-black text-zinc-100 truncate tracking-tight">
                    {{ item.value }}
                  </h5>
                </div>

                <div class="flex flex-wrap items-center gap-4">
                  <div class="flex items-center gap-2 text-zinc-500 font-bold text-[11px]">
                    <MessageSquare :size="12" class="text-zinc-700" />
                    {{ locale.reasonPrefix }} {{ item.reason || locale.noReason }}
                  </div>
                  <div
                    class="flex items-center gap-2 text-zinc-600 font-bold text-[10px] uppercase tracking-tighter"
                  >
                    <Clock :size="11" class="text-zinc-800" />
                    {{ locale.createdAt }} {{ formatDate(item.createdAt) }}
                  </div>
                </div>
              </div>
            </div>

            <div
              class="flex items-center justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-zinc-800/50"
            >
              <button
                :disabled="loading"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                :class="[
                  item.isActive
                    ? 'bg-zinc-800 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/5 hover:border-amber-500/10 border border-transparent'
                    : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                ]"
                @click="toggleItemStatus(item)"
              >
                <Power :size="12" />
                {{ item.isActive ? locale.disable : locale.enable }}
              </button>
              <button
                :disabled="loading"
                class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-700 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-95"
                @click="deleteItem(item)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </TransitionGroup>

        <!-- 加载状态 -->
        <div
          v-if="loading && blacklist.length === 0"
          class="py-20 flex flex-col items-center justify-center space-y-4"
        >
          <div
            class="w-12 h-12 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"
          />
          <p class="text-zinc-500 text-xs font-bold uppercase tracking-widest">{{ locale.loading }}</p>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="blacklist.length === 0"
          class="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-zinc-900/10 border border-zinc-800/40 border-dashed rounded-xl"
        >
          <div
            class="w-16 h-16 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-800 shadow-xl"
          >
            <Ban :size="32" />
          </div>
          <div class="space-y-1 px-4">
            <h6 class="text-sm font-bold text-zinc-600">{{ locale.emptyTitle }}</h6>
            <p class="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
              {{ locale.emptyDesc }}
            </p>
          </div>
        </div>
      </div>

      <!-- 分页控制 -->
      <div v-if="pagination.pages > 1" class="flex items-center justify-center gap-4 mt-8">
        <button
          :disabled="pagination.page <= 1 || loading"
          class="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          @click="changePage(pagination.page - 1)"
        >
          <ChevronLeft :size="20" />
        </button>
        <div
          class="px-6 py-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-[11px] font-black text-zinc-400 uppercase tracking-widest"
        >
          {{ locale.pagination(pagination.page, pagination.pages) }}
        </div>
        <button
          :disabled="pagination.page >= pagination.pages || loading"
          class="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          @click="changePage(pagination.page + 1)"
        >
          <ChevronRight :size="20" />
        </button>
      </div>
    </div>

    <!-- 删除确认模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDeleteDialog"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
      >
        <div
          class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
          @click.stop
        >
          <div class="flex flex-col items-center py-8 space-y-6 text-center px-8">
            <div
              class="w-16 h-16 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center border border-red-500/20 shadow-2xl shadow-red-900/10"
            >
              <Trash2 :size="28" />
            </div>
            <div class="space-y-2">
              <h4 class="text-lg font-bold text-zinc-100">{{ locale.removeTitle }}</h4>
              <p class="text-xs text-zinc-500 leading-relaxed">
                {{ locale.removeMessage(deleteTargetItem?.value || '') }}
              </p>
            </div>
            <div class="flex gap-3 w-full pt-4">
              <button
                class="flex-1 px-4 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest"
                @click="showDeleteDialog = false"
              >
                {{ locale.cancel }}
              </button>
              <button
                :disabled="loading"
                class="flex-1 px-4 py-4 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded-lg shadow-xl shadow-red-900/20 transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50"
                @click="confirmDelete"
              >
                {{ loading ? locale.deleting : locale.confirmRemove }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import {
  ShieldAlert,
  Music,
  Type,
  Plus,
  Search,
  Filter,
  MessageSquare,
  Clock,
  Power,
  Trash2,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'

const { showToast: showNotification } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.blacklist || {})

const blacklist = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

// 删除对话框相关
const showDeleteDialog = ref(false)
const deleteTargetItem = ref(null)

const newItem = reactive({
  type: 'SONG',
  value: '',
  reason: ''
})

const filters = reactive({
  type: '',
  search: ''
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})

const typeFilterLabel = computed(() => {
  if (filters.type === 'SONG') return locale.value.song
  if (filters.type === 'KEYWORD') return locale.value.keyword
  return locale.value.allTypes
})

let searchTimeout = null

// 加载黑名单
const loadBlacklist = async () => {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      ...(filters.type && { type: filters.type }),
      ...(filters.search && { search: filters.search })
    })

    const response = await $fetch(`/api/admin/blacklist?${params}`, {
      ...useAuth().getAuthConfig()
    })

    blacklist.value = response.blacklist
    Object.assign(pagination, response.pagination)
  } catch (err) {
    const fetchFailed = locale.value?.fetchFailed || 'Failed to load blacklist'
    error.value = fetchFailed
    console.error('获取黑名单失败:', err)
    showNotification(`${fetchFailed}: ${err.data?.message || err.message}`, 'error')
  } finally {
    loading.value = false
  }
}

// 处理类型筛选变更
const handleTypeFilterChange = (label) => {
  if (label === locale.value.song) filters.type = 'SONG'
  else if (label === locale.value.keyword) filters.type = 'KEYWORD'
  else filters.type = ''

  pagination.page = 1
  loadBlacklist()
}

// 添加黑名单项
const addBlacklistItem = async () => {
  if (!newItem.value.trim()) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch('/api/admin/blacklist', {
      method: 'POST',
      body: {
        type: newItem.type,
        value: newItem.value.trim(),
        reason: newItem.reason.trim() || null
      },
      ...useAuth().getAuthConfig()
    })

    showNotification(locale.value.addSuccess, 'success')

    // 重置表单
    newItem.value = ''
    newItem.reason = ''

    // 重新加载列表
    pagination.page = 1
    await loadBlacklist()
  } catch (err) {
    error.value = err.data?.message || locale.value.addFailed
    console.error('添加黑名单项失败:', err)
    showNotification(locale.value.addFailedPrefix + error.value, 'error')
  } finally {
    loading.value = false
  }
}

// 切换项目状态
const toggleItemStatus = async (item) => {
  loading.value = true
  error.value = ''

  try {
    await $fetch(`/api/admin/blacklist/${item.id}`, {
      method: 'PATCH',
      body: {
        isActive: !item.isActive
      },
      ...useAuth().getAuthConfig()
    })

    item.isActive = !item.isActive
    showNotification(locale.value.statusSuccess(item.isActive), 'success')
  } catch (err) {
    error.value = locale.value.updateFailed
    console.error('更新状态失败:', err)
    showNotification(locale.value.updateFailed, 'error')
  } finally {
    loading.value = false
  }
}

// 删除项目
const deleteItem = (item) => {
  deleteTargetItem.value = item
  showDeleteDialog.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteTargetItem.value) return

  loading.value = true
  error.value = ''

  try {
    await $fetch(`/api/admin/blacklist/${deleteTargetItem.value.id}`, {
      method: 'DELETE',
      ...useAuth().getAuthConfig()
    })

    showNotification(locale.value.deleteSuccess, 'success')
    await loadBlacklist()
  } catch (err) {
    error.value = locale.value.deleteFailed
    console.error('删除失败:', err)
    showNotification(`${locale.value.deleteFailed}: ${err.message}`, 'error')
  } finally {
    loading.value = false
    showDeleteDialog.value = false
    deleteTargetItem.value = null
  }
}

// 搜索防抖
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.page = 1
    loadBlacklist()
  }, 500)
}

// 切换页面
const changePage = (page) => {
  pagination.page = page
  loadBlacklist()
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

onMounted(() => {
  loadBlacklist()
})
</script>

<style scoped>
.animate-in {
  animation-duration: 0.5s;
  animation-fill-mode: both;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* 隐藏滚动条但保持功能 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
</style>
