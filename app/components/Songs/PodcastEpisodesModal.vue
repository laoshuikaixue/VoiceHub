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
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between p-8 pb-4">
            <div class="flex items-center gap-4 min-w-0">
              <div
                class="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 flex-shrink-0"
              >
                <Icon name="mic" :size="24" />
              </div>
              <h3 class="text-xl font-black text-zinc-100 tracking-tight truncate">
                {{ radioName }} - 节目列表
              </h3>
            </div>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all flex-shrink-0"
              @click="close"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
            <div
              v-if="loading"
              class="flex flex-col items-center justify-center py-20 text-zinc-500"
            >
              <Icon name="refresh" :size="48" class="animate-spin mb-4 text-blue-500" />
              <p class="font-black uppercase tracking-widest text-[10px]">加载节目中...</p>
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
                class="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black rounded-xl transition-all uppercase tracking-widest"
                @click="fetchPrograms(false)"
              >
                重试
              </button>
            </div>

            <div
              v-else-if="programs.length === 0"
              class="flex flex-col items-center justify-center py-12 text-zinc-500"
            >
              <div
                class="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-4"
              >
                <Icon name="mic" :size="32" class="opacity-20" />
              </div>
              <p class="text-sm font-bold uppercase tracking-widest">暂无节目</p>
            </div>

            <div v-else class="program-list space-y-3">
              <div
                v-for="program in programs"
                :key="program.id"
                class="group flex items-center p-4 bg-zinc-800/30 border border-zinc-800/50 rounded-3xl hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
              >
                <!-- 封面与播放叠加层 -->
                <div
                  class="relative w-14 h-14 rounded-2xl overflow-hidden bg-zinc-800 mr-4 flex-shrink-0 group/cover cursor-pointer"
                  @click.stop="playProgram(program)"
                >
                  <img
                    :src="convertToHttps(program.coverUrl || program.mainSong?.album?.picUrl)"
                    alt="cover"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  >
                  <div
                    class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity"
                  >
                    <div
                      class="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"
                    >
                      <Icon name="play" :size="16" class="text-white fill-current" />
                    </div>
                  </div>
                </div>

                <!-- 节目信息 -->
                <div class="flex-1 min-w-0">
                  <h4
                    class="font-bold text-zinc-100 truncate group-hover:text-white transition-colors"
                  >
                    {{ program.name }}
                  </h4>
                  <div
                    class="flex items-center gap-3 mt-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider"
                  >
                    <span class="flex items-center">
                      {{ formatDate(program.createTime) }}
                    </span>
                    <span class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40" />
                      {{ formatDuration(program.duration) }}
                    </span>
                    <span class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40" />
                      🎧 {{ formatCount(program.listenerCount) }}
                    </span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="ml-4 shrink-0 flex items-center gap-3">
                  <div
                    v-if="songsLoadingForSimilar"
                    class="text-[10px] font-black text-zinc-600 animate-pulse uppercase tracking-widest"
                  >
                    处理中...
                  </div>
                  <div v-else-if="getSimilarSong(program)" class="flex flex-col items-end gap-1.5">
                    <span
                      v-if="getSimilarSong(program)?.played"
                      class="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-wider"
                    >
                      已播放
                    </span>
                    <span
                      v-else-if="getSimilarSong(program)?.scheduled"
                      class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-wider"
                    >
                      已排期
                    </span>
                    <span
                      v-else
                      class="px-2 py-0.5 rounded-md bg-zinc-700/50 text-zinc-500 text-[10px] font-black uppercase tracking-wider"
                    >
                      已存在
                    </span>

                    <div class="flex gap-2">
                      <button
                        v-if="getSimilarSong(program)?.played && isSuperAdmin"
                        :disabled="submitting"
                        class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest"
                        @click.stop="selectProgram(program)"
                      >
                        {{ submitting && selectedProgramId === program.id ? '...' : '继续投稿' }}
                      </button>
                      <button
                        v-else
                        class="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 disabled:cursor-not-allowed uppercase tracking-widest"
                        :class="[
                          getSimilarSong(program)?.voted
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/50 hover:border-zinc-600'
                        ]"
                        :disabled="
                          getSimilarSong(program)?.played ||
                          getSimilarSong(program)?.scheduled ||
                          getSimilarSong(program)?.voted ||
                          submitting
                        "
                        @click.stop="handleLikeFromProgram(getSimilarSong(program))"
                      >
                        {{ getSimilarSong(program)?.voted ? '已点赞' : '点赞' }}
                      </button>
                    </div>
                  </div>
                  <button
                    v-else
                    :disabled="submitting"
                    class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black disabled:opacity-50 transition-all active:scale-95 shrink-0 uppercase tracking-widest shadow-lg shadow-blue-900/20"
                    @click="selectProgram(program)"
                  >
                    {{ submitting && selectedProgramId === program.id ? '提交中...' : '选择投稿' }}
                  </button>
                </div>
              </div>

              <div v-if="hasMore" class="pt-6 pb-2 flex justify-center">
                <button
                  :disabled="loadingMore"
                  class="px-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black disabled:opacity-50 transition-all flex items-center gap-2 uppercase tracking-widest"
                  @click="loadMore"
                >
                  <Icon v-if="loadingMore" name="loader" :size="16" class="animate-spin" />
                  {{ loadingMore ? '加载中...' : '加载更多' }}
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
import { computed, ref, watch } from 'vue'
import { useMusicSources } from '~/composables/useMusicSources'
import { useSongs } from '~/composables/useSongs'
import { useAuth } from '~/composables/useAuth'
import { useSemesters } from '~/composables/useSemesters'
import { convertToHttps } from '~/utils/url'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  show: Boolean,
  radioId: [String, Number],
  radioName: String,
  cookie: String
})

const emit = defineEmits(['close', 'submit', 'play'])

const musicSources = useMusicSources()
const songService = useSongs()
const auth = useAuth()
const isSuperAdmin = computed(() => auth.user.value?.role === 'SUPER_ADMIN')
const { currentSemester, fetchCurrentSemester } = useSemesters()

const programs = ref([])
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
const offset = ref(0)
const loadingMore = ref(false)
const submitting = ref(false)
const selectedProgramId = ref(null)
const songsLoadingForSimilar = ref(false)

// 标准化字符串
const normalizeString = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''""''、，。！？：；～·]/g, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[feat\.?|ft\.?]/gi, '')
    .trim()
}

// 检查是否已存在相似歌曲
const getSimilarSong = (program) => {
  if (!program) return null

  const tempSong = createSongObject(program)
  const title = tempSong.title
  const artist = tempSong.artist

  if (!title || !artist) return null

  const normalizedTitle = normalizeString(title)
  const normalizedArtist = normalizeString(artist)
  const currentSemesterName = currentSemester.value?.name

  // 如果没有获取到当前学期信息，暂时不进行检查，避免误报
  if (!currentSemesterName) return null

  return songService.songs.value.find((song) => {
    const songTitle = normalizeString(song.title)
    const songArtist = normalizeString(song.artist)
    const titleMatch = songTitle === normalizedTitle && songArtist === normalizedArtist

    // 必须匹配当前学期
    return titleMatch && song.semester === currentSemesterName
  })
}

const fetchPrograms = async (isLoadMore = false) => {
  if (!props.radioId) return

  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    programs.value = []
    offset.value = 0
  }

  error.value = ''

  try {
    const result = await musicSources.getDjPrograms(props.radioId, 20, offset.value, props.cookie)

    if (result.success) {
      if (isLoadMore) {
        programs.value = [...programs.value, ...result.programs]
      } else {
        programs.value = result.programs
      }

      hasMore.value = result.more
      offset.value += result.programs.length
    } else {
      error.value = result.error || '获取节目失败'
    }
  } catch (err) {
    error.value = '网络请求失败'
    console.error(err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  fetchPrograms(true)
}

const close = () => {
  emit('close')
  // 重置状态
  submitting.value = false
  selectedProgramId.value = null
}

const createSongObject = (program) => {
  // 构造提交数据
  // 使用 mainSong.id 作为唯一标识，因为 getSongUrl 需要它
  const songId = program.mainSong?.id || program.mainTrackId || program.id

  return {
    id: songId,
    title: program.name,
    artist: program.dj?.nickname || '未知主播',
    cover: program.coverUrl || program.cover,
    album: props.radioName, // 使用电台名作为专辑名
    duration: program.duration,
    musicPlatform: 'netease-podcast',
    musicId: songId.toString(),
    sourceInfo: {
      source: 'netease-backup',
      originalId: songId.toString(),
      fetchedAt: new Date(),
      type: 'voice',
      programId: program.id
    }
  }
}

const selectProgram = async (program) => {
  selectedProgramId.value = program.id
  submitting.value = true

  const song = createSongObject(program)

  emit('submit', song)
  // 不立即关闭，等待父组件处理
  // 父组件处理成功后应该关闭此弹窗
}

const handleLikeFromProgram = async (song) => {
  if (!song || song.voted) {
    return
  }

  if (song.played || song.scheduled) {
    if (window.$showNotification) {
      const message = song.played ? '已播放的歌曲不能点赞' : '已排期的歌曲不能点赞'
      window.$showNotification(message, 'warning')
    }
    return
  }

  try {
    await songService.voteSong(song.id)
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

const playProgram = (program) => {
  const song = createSongObject(program)
  // 添加播放需要的额外字段
  song.musicUrl = '' // 将由 RequestForm 处理获取
  emit('play', song)
}

watch(
  () => props.show,
  async (val) => {
    if (val) {
      // 确保当前学期已加载，用于正确检查歌曲状态
      if (!currentSemester.value) {
        await fetchCurrentSemester()
      }

      submitting.value = false
      selectedProgramId.value = null
      if (
        auth.isAuthenticated.value &&
        (!songService.songs.value || songService.songs.value.length === 0)
      ) {
        const currentSemesterName = currentSemester.value?.name
        songsLoadingForSimilar.value = true
        songService
          .fetchSongs(true, currentSemesterName)
          .catch((err) => {
            console.error('加载歌曲列表失败:', err)
          })
          .finally(() => {
            songsLoadingForSimilar.value = false
          })
      } else {
        songsLoadingForSimilar.value = false
      }
      fetchPrograms()
    } else {
      programs.value = []
      offset.value = 0
      submitting.value = false
      selectedProgramId.value = null
      songsLoadingForSimilar.value = false
    }
  }
)

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString()
}

const formatDuration = (ms) => {
  if (!ms) return '00:00'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const formatCount = (count) => {
  if (!count) return '0'
  if (count > 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  return count
}

defineExpose({
  resetSubmissionState: () => {
    submitting.value = false
    selectedProgramId.value = null
  }
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
