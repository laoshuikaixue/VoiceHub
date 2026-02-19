<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click.self="close"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        >
          <!-- 结果展示视图 -->
          <div
            v-if="importResult"
            class="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-500"
          >
            <div class="p-8 pb-4 flex items-center justify-between border-b border-zinc-800/50">
              <div>
                <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500"
                  >
                    <Icon name="success" :size="20" />
                  </div>
                  导入结果
                </h3>
                <p class="text-xs text-zinc-500 mt-1 ml-13">歌曲导入操作已完成</p>
              </div>
              <button
                class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
                @click="close"
              >
                <Icon name="x" :size="20" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div class="grid grid-cols-2 gap-4">
                <div
                  class="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex flex-col items-center gap-2"
                >
                  <span class="text-[10px] font-black text-emerald-500 uppercase tracking-widest"
                    >成功导入</span
                  >
                  <span class="text-4xl font-black text-emerald-400">{{
                    importResult.success
                  }}</span>
                </div>
                <div
                  class="p-6 bg-red-500/5 border border-red-500/20 rounded-3xl flex flex-col items-center gap-2"
                >
                  <span class="text-[10px] font-black text-red-500 uppercase tracking-widest"
                    >失败/跳过</span
                  >
                  <span class="text-4xl font-black text-red-400">{{ importResult.failed }}</span>
                </div>
              </div>

              <div v-if="importResult.details && importResult.details.length > 0" class="space-y-4">
                <div
                  class="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                >
                  <Icon name="info" :size="12" />
                  详细处理记录
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div
                    v-for="(detail, index) in importResult.details"
                    :key="index"
                    class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 font-medium"
                  >
                    {{ detail }}
                  </div>
                </div>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center py-10 text-emerald-500/50"
              >
                <Icon name="success" :size="48" class="mb-4" />
                <p class="text-sm font-bold uppercase tracking-widest">全部歌曲导入成功！</p>
              </div>
            </div>

            <div class="p-8 pt-4 border-t border-zinc-800/50 bg-zinc-900/50">
              <button
                class="w-full px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest shadow-lg active:scale-95"
                @click="close"
              >
                完成并返回
              </button>
            </div>
          </div>

          <!-- 正常导入视图 -->
          <div v-else class="flex flex-col flex-1 overflow-hidden">
            <div class="p-8 pb-4 flex items-center justify-between border-b border-zinc-800/50">
              <div>
                <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
                  >
                    <Icon name="download" :size="20" />
                  </div>
                  从历史学期导入
                </h3>
                <p class="text-xs text-zinc-500 mt-1 ml-13">选择以往学期的歌曲并导入到当前学期</p>
              </div>
              <button
                class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
                @click="close"
              >
                <Icon name="x" :size="20" />
              </button>
            </div>

            <div class="p-8 py-6 space-y-6 border-b border-zinc-800/50">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >选择学期</label
                  >
                  <CustomSelect
                    v-model="selectedSemester"
                    :options="semesterList"
                    label-key="name"
                    value-key="name"
                    placeholder="请选择目标学期"
                    class="w-full"
                  />
                </div>

                <div class="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    v-for="type in ['unplayed', 'played', 'all']"
                    :key="type"
                    type="button"
                    :class="[
                      'flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all',
                      filterType === type
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-zinc-500 hover:text-zinc-300'
                    ]"
                    @click="filterType = type"
                  >
                    {{ getFilterLabel(type) }}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar bg-zinc-950/30">
              <div
                v-if="loadingSemesters || loadingSongs"
                class="flex flex-col items-center justify-center py-20 text-zinc-500"
              >
                <Icon name="refresh" :size="32" class="animate-spin mb-4 text-blue-500" />
                <div class="text-[10px] font-black uppercase tracking-widest">正在加载歌曲...</div>
              </div>

              <div
                v-else-if="error"
                class="flex flex-col items-center justify-center py-20 text-center px-8"
              >
                <div
                  class="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4"
                >
                  <Icon name="alert-triangle" :size="32" />
                </div>
                <p class="text-sm text-zinc-400 mb-6">{{ error }}</p>
                <button
                  class="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black rounded-xl transition-all uppercase tracking-widest"
                  @click="loadSongs"
                >
                  重试加载
                </button>
              </div>

              <div
                v-else-if="!selectedSemester"
                class="flex flex-col items-center justify-center py-20 text-zinc-600"
              >
                <Icon name="list" :size="48" class="mb-4 opacity-20" />
                <p class="text-sm font-bold uppercase tracking-widest">请先选择一个学期</p>
              </div>

              <div
                v-else-if="filteredSongs.length === 0"
                class="flex flex-col items-center justify-center py-20 text-zinc-600"
              >
                <Icon name="search" :size="48" class="mb-4 opacity-20" />
                <p class="text-sm font-bold uppercase tracking-widest">没有找到符合条件的歌曲</p>
              </div>

              <div v-else class="grid grid-cols-1 gap-2">
                <div
                  v-for="song in filteredSongs"
                  :key="song.id"
                  class="group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border"
                  :class="[
                    isSelected(song.id)
                      ? 'bg-blue-600/10 border-blue-500/30 shadow-lg'
                      : 'bg-zinc-900 border-transparent hover:border-zinc-800'
                  ]"
                  @click="toggleSelection(song.id)"
                >
                  <div
                    class="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all"
                    :class="[
                      isSelected(song.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-zinc-800 text-transparent'
                    ]"
                  >
                    <Icon name="check" :size="14" />
                  </div>

                  <div
                    class="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 shadow-md"
                  >
                    <img
                      :src="convertToHttps(song.cover)"
                      alt="cover"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    >
                  </div>

                  <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-black text-zinc-100 truncate mb-0.5">
                      {{ song.title }}
                    </h4>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-zinc-500 truncate">{{ song.artist }}</span>
                      <span class="text-[10px] text-zinc-700 font-bold">•</span>
                      <span class="text-[10px] text-zinc-600 truncate">{{ song.requester }}</span>
                    </div>
                  </div>

                  <div
                    :class="[
                      'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border',
                      song.played
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                    ]"
                  >
                    {{ song.played ? '已收录' : '未收录' }}
                  </div>
                </div>
              </div>
            </div>

            <div
              class="p-8 border-t border-zinc-800/50 bg-zinc-900/50 flex flex-col md:flex-row gap-4 items-center justify-between"
            >
              <div class="flex items-center gap-4 w-full md:w-auto">
                <button
                  type="button"
                  class="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                  @click="toggleSelectAll"
                >
                  {{ isAllSelected ? '取消全选' : '选择当前全部' }}
                </button>
                <div class="h-4 w-px bg-zinc-800 hidden md:block" />
                <span class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  已选择 <span class="text-blue-500">{{ selectedSongIds.size }}</span> 首歌曲
                </span>
              </div>

              <div class="flex gap-3 w-full md:w-auto">
                <button
                  type="button"
                  class="flex-1 md:flex-none px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                  @click="close"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="flex-[2] md:flex-none px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/20 active:scale-95"
                  :disabled="selectedSongIds.size === 0 || importing"
                  @click="handleImport"
                >
                  <Icon v-if="importing" name="refresh" :size="16" class="animate-spin" />
                  <Icon v-else name="download" :size="16" />
                  {{ importing ? '正在导入...' : '确认导入' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { convertToHttps } from '~/utils/url'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'import-success'])

const semesterList = ref([])
const selectedSemester = ref('')
const songs = ref([])
const loadingSemesters = ref(false)
const loadingSongs = ref(false)
const error = ref('')
const filterType = ref('unplayed') // '未收录', '已收录', '全部'
const selectedSongIds = ref(new Set())
const importing = ref(false)
const importResult = ref(null)

const getFilterLabel = (type) => {
  const map = {
    unplayed: '未被收录',
    played: '被收录',
    all: '全部'
  }
  return map[type]
}

const filteredSongs = computed(() => {
  if (!songs.value) return []
  return songs.value.filter((song) => {
    if (filterType.value === 'all') return true
    if (filterType.value === 'played') return song.played
    if (filterType.value === 'unplayed') return !song.played
    return true
  })
})

const isAllSelected = computed(() => {
  return (
    filteredSongs.value.length > 0 &&
    filteredSongs.value.every((s) => selectedSongIds.value.has(s.id))
  )
})

const isSelected = (id) => selectedSongIds.value.has(id)

const toggleSelection = (id) => {
  if (selectedSongIds.value.has(id)) {
    selectedSongIds.value.delete(id)
  } else {
    selectedSongIds.value.add(id)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消全选可见项
    filteredSongs.value.forEach((s) => selectedSongIds.value.delete(s.id))
  } else {
    // 全选可见项
    filteredSongs.value.forEach((s) => selectedSongIds.value.add(s.id))
  }
}

const fetchSemesters = async () => {
  loadingSemesters.value = true
  try {
    const res = await $fetch('/api/semesters/options')
    if (res.success) {
      // 彻底过滤掉当前活跃学期，只显示往期学期供导入
      semesterList.value = res.data.filter(
        (sem) => sem.isActive === false || sem.isActive === 0 || sem.isActive === '0'
      )
      // 不自动选择，强制用户手动选择
    }
  } catch (e) {
    console.error('获取学期列表失败', e)
    error.value = '加载学期列表失败'
  } finally {
    loadingSemesters.value = false
  }
}

const loadSongs = async () => {
  if (!selectedSemester.value) return

  loadingSongs.value = true
  error.value = ''
  songs.value = []
  selectedSongIds.value.clear()

  try {
    const res = await $fetch('/api/songs', {
      params: {
        semester: selectedSemester.value,
        scope: 'mine',
        bypass_cache: 'true' // 确保获取最新数据
      }
    })

    if (res.success) {
      songs.value = res.data.songs
    }
  } catch (e) {
    console.error('获取歌曲失败', e)
    error.value = '加载歌曲列表失败'
  } finally {
    loadingSongs.value = false
  }
}

const handleImport = async () => {
  if (selectedSongIds.value.size === 0) return

  importing.value = true
  try {
    const res = await $fetch('/api/songs/import', {
      method: 'POST',
      body: {
        songIds: Array.from(selectedSongIds.value)
      }
    })

    if (res.success) {
      if (res.results) {
        importResult.value = res.results
      } else {
        // 如果结果结构不同，进行降级处理
        importResult.value = {
          success: res.count,
          failed: 0,
          details: []
        }
      }
      emit('import-success')
      // 不关闭弹窗，显示结果视图
    }
  } catch (e) {
    console.error('导入失败', e)
    if (window.$showNotification) {
      window.$showNotification(e.message || '导入失败', 'error')
    }
  } finally {
    importing.value = false
  }
}

const close = () => {
  emit('close')
  importResult.value = null
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      importResult.value = null // 重置结果
      if (semesterList.value.length === 0) {
        fetchSemesters()
      }
      // 重置状态
      selectedSongIds.value.clear()
      filterType.value = 'unplayed'
    }
  }
)

watch(selectedSemester, () => {
  if (selectedSemester.value) {
    loadSongs()
  }
})
</script>

<style scoped></style>
