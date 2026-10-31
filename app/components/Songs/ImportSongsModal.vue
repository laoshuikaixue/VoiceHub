<template>
  <AppModal
    :description="importResult ? locale.resultDesc : locale.desc"
    :show="show"
    :title="importResult ? locale.resultTitle : locale.title"
    size="xl"
    @close="close"
  >
    <template #icon>
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        :class="importResult ? 'bg-success-10 text-success' : 'bg-primary-hover-10 text-primary'"
      >
        <Icon :name="importResult ? 'success' : 'download'" :size="18" />
      </span>
    </template>

    <div v-if="importResult" class="space-y-8">

              <div class="grid grid-cols-2 gap-4">
                <div
                  class="p-6 bg-success-5 border border-success-20 rounded-2xl flex flex-col items-center gap-2"
                >
                  <span class="text-xs font-bold text-success uppercase tracking-wider"
                    >{{ locale.successCount }}</span
                  >
                  <span class="text-4xl font-bold text-success">{{
                    importResult.success
                  }}</span>
                </div>
                <div
                  class="p-6 bg-error-5 border border-error-20 rounded-2xl flex flex-col items-center gap-2"
                >
                  <span class="text-xs font-bold text-error uppercase tracking-wider"
                    >{{ locale.failedCount }}</span
                  >
                  <span class="text-4xl font-bold text-error">{{ importResult.failed }}</span>
                </div>
              </div>

              <div v-if="importResult.details && importResult.details.length > 0" class="space-y-4">
                <div
                  class="flex items-center gap-2 text-xs font-bold text-text-tertiary uppercase tracking-wider ml-1"
                >
                  <Icon name="info" :size="12" />
                  {{ locale.details }}
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div
                    v-for="(detail, index) in importResult.details"
                    :key="index"
                    class="p-3 bg-bg-primary border border-border-secondary rounded-xl text-xs text-text-tertiary font-medium"
                  >
                    {{ detail }}
                  </div>
                </div>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center py-10 text-success-50"
              >
                <Icon name="success" :size="48" class="mb-4" />
                <p class="text-sm font-bold uppercase tracking-wider">{{ locale.allSuccess }}</p>
              </div>
    </div>
    <div v-else class="space-y-6">

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div class="space-y-2">
                  <label class="text-xs font-bold text-text-tertiary uppercase tracking-wider ml-1"
                    >{{ locale.selectSemester }}</label
                  >
                  <CustomSelect
                    v-model="selectedSemester"
                    :options="semesterList"
                    label-key="name"
                    value-key="name"
                    :placeholder="locale.semesterPlaceholder"
                    class="w-full"
                  />
                </div>

                <div class="flex bg-bg-primary p-1 rounded-xl border border-border-secondary">
                  <button
                    v-for="type in ['unplayed', 'played', 'all']"
                    :key="type"
                    type="button"
                    :class="[
                      'flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
                      filterType === type
                        ? 'bg-primary-hover text-text-primary shadow-lg'
                        : 'text-text-tertiary hover:text-text-secondary'
                    ]"
                    @click="filterType = type"
                  >
                    {{ getFilterLabel(type) }}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar bg-bg-primary-30">
              <div
                v-if="loadingSemesters || loadingSongs"
                class="flex flex-col items-center justify-center py-20 text-text-tertiary"
              >
                <Icon name="refresh" :size="32" class="animate-spin mb-4 text-primary" />
                <div class="text-xs font-bold uppercase tracking-wider">{{ locale.loadingSongs }}</div>
              </div>

              <div
                v-else-if="error"
                class="flex flex-col items-center justify-center py-20 text-center px-8"
              >
                <div
                  class="w-16 h-16 rounded-2xl bg-error-10 flex items-center justify-center text-error mb-4"
                >
                  <Icon name="alert-triangle" :size="32" />
                </div>
                <p class="text-sm text-text-tertiary mb-6">{{ error }}</p>
                <button
                  class="px-6 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-primary text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
                  @click="loadSongs"
                >
                  {{ locale.retry }}
                </button>
              </div>

              <div
                v-else-if="!selectedSemester"
                class="flex flex-col items-center justify-center py-20 text-text-disabled"
              >
                <Icon name="list" :size="48" class="mb-4 opacity-20" />
                <p class="text-sm font-bold uppercase tracking-wider">{{ locale.selectSemesterFirst }}</p>
              </div>

              <div
                v-else-if="filteredSongs.length === 0"
                class="flex flex-col items-center justify-center py-20 text-text-disabled"
              >
                <Icon name="search" :size="48" class="mb-4 opacity-20" />
                <p class="text-sm font-bold uppercase tracking-wider">{{ locale.noSongs }}</p>
              </div>

              <div v-else class="grid grid-cols-1 gap-2">
                <div
                  v-for="song in filteredSongs"
                  :key="song.id"
                  class="group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border"
                  :class="[
                    isSelected(song.id)
                      ? 'bg-primary-hover-10 border-primary-30 shadow-lg'
                      : 'bg-bg-secondary border-transparent hover:border-border-secondary'
                  ]"
                  @click="toggleSelection(song.id)"
                >
                  <div
                    class="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all"
                    :class="[
                      isSelected(song.id)
                        ? 'bg-primary-hover border-primary text-text-primary'
                        : 'border-border-secondary text-transparent'
                    ]"
                  >
                    <Icon name="check" :size="14" />
                  </div>

                  <div
                    class="w-12 h-12 rounded-xl overflow-hidden bg-bg-tertiary flex-shrink-0 shadow-md"
                  >
                    <img
                      :src="getCoverThumbUrl(song.cover)"
                      alt="cover"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-bold text-text-primary truncate mb-0.5">
                      {{ song.title }}
                    </h4>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-text-tertiary truncate">{{ song.artist }}</span>
                      <span class="text-xs text-text-secondary font-bold">•</span>
                      <span class="text-xs text-text-disabled truncate">{{ song.requester }}</span>
                    </div>
                  </div>

                  <div
                    :class="[
                      'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-tighter border',
                      song.played
                        ? 'bg-success-10 text-success border-success-20'
                        : 'bg-bg-tertiary text-text-tertiary border-border-tertiary'
                    ]"
                  >
                    {{ song.played ? locale.collected : locale.notCollected }}
                  </div>
                </div>
              </div>
            </div>

            <div
    </div>

    <template #footer>
      <div v-if="importResult">

              <button
                class="w-full px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-2xl transition-all uppercase tracking-wider shadow-lg active:scale-95"
                @click="close"
              >
                {{ locale.done }}
              </button>
      </div>
      <div v-else class="flex flex-col items-center justify-between gap-4 md:flex-row">

              <div class="flex items-center gap-4 w-full md:w-auto">
                <button
                  type="button"
                  class="text-xs font-bold text-primary hover:text-primary uppercase tracking-wider transition-colors"
                  @click="toggleSelectAll"
                >
                  {{ isAllSelected ? locale.cancelSelectAll : locale.selectAll }}
                </button>
                <div class="h-4 w-px bg-bg-tertiary hidden md:block" />
                <span class="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                  {{ formatLocale(locale.selectedSongs, selectedSongIds.size) }}
                </span>
              </div>

              <div class="flex gap-3 w-full md:w-auto">
                <button
                  type="button"
                  class="flex-1 md:flex-none px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-2xl transition-all uppercase tracking-wider"
                  @click="close"
                >
                  {{ requestLocale.cancel || '取消' }}
                </button>
                <button
                  type="button"
                  class="flex-[2] md:flex-none px-8 py-4 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-2xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[var(--primary-glow)] active:scale-95"
                  :disabled="selectedSongIds.size === 0 || importing"
                  @click="handleImport"
                >
                  <Icon v-if="importing" name="refresh" :size="16" class="animate-spin" />
                  <Icon v-else name="download" :size="16" />
                  {{ importing ? (locale.importing || '正在导入...') : (locale.confirmImport || '确认导入') }}
                </button>
              </div>
            </div>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getCoverThumbUrl } from '~/utils/url'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'import-success'])
const { songs: songsLocale } = useLocale()
const requestLocale = computed(() => songsLocale.value?.requestForm || {})
const locale = computed(() => requestLocale.value?.importSongsModal || {})

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
    unplayed: locale.value.unplayed,
    played: locale.value.played,
    all: locale.value.all
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
    error.value = locale.value.loadSemestersFailed
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
        scope: 'mine'
      }
    })

    if (res.success) {
      songs.value = res.data.songs
    }
  } catch (e) {
    console.error('获取歌曲失败', e)
    error.value = locale.value.loadSongsFailed
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
      window.$showNotification(e.message || locale.value.importFailed, 'error')
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
