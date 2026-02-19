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
          <!-- 头部 -->
          <div class="p-8 pb-4 flex items-center justify-between border-b border-zinc-800/50">
            <div>
              <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
                >
                  <Icon name="history" :size="20" />
                </div>
                最近播放 - 歌曲
              </h3>
              <p class="text-xs text-zinc-500 mt-1 ml-13">查看并快速投稿您最近在网易云播放的歌曲</p>
            </div>
            <button
              class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
              @click="close"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div
              v-if="loading"
              class="flex flex-col items-center justify-center py-20 text-zinc-500"
            >
              <Icon name="refresh" :size="32" class="animate-spin mb-4 text-blue-500" />
              <div class="text-[10px] font-black uppercase tracking-widest">
                正在获取播放记录...
              </div>
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
                @click="fetchRecentSongs"
              >
                重试加载
              </button>
            </div>

            <div
              v-else-if="songs.length === 0"
              class="flex flex-col items-center justify-center py-20 text-zinc-600"
            >
              <Icon name="music" :size="48" class="mb-4 opacity-20" />
              <p class="text-sm font-bold uppercase tracking-widest">暂无最近播放记录</p>
            </div>

            <div v-else class="recent-song-list space-y-2">
              <div
                v-for="item in songs"
                :key="item.resourceId"
                class="group flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-800/50 transition-all border border-transparent hover:border-zinc-800"
              >
                <div
                  class="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-300"
                >
                  <img
                    :src="convertToHttps(item.data?.al?.picUrl)"
                    alt="cover"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  >
                  <div
                    class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    @click.stop="playSong(item.data)"
                  >
                    <div
                      class="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30"
                    >
                      <Icon name="play" :size="14" class="fill-current" />
                    </div>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <h4
                    :title="item.data?.name"
                    class="text-sm font-black text-zinc-100 truncate mb-1"
                  >
                    {{ item.data?.name }}
                  </h4>
                  <div class="flex items-center gap-3">
                    <span class="text-[10px] text-zinc-500 font-medium whitespace-nowrap">{{
                      formatTime(item.playTime)
                    }}</span>
                    <span
                      class="text-[10px] text-zinc-600 truncate font-bold uppercase tracking-tighter"
                      >{{ item.data?.ar?.map((a) => a.name).join('/') }}</span
                    >
                  </div>
                </div>

                <div class="flex flex-col items-end gap-2">
                  <div
                    v-if="songsLoadingForSimilar"
                    class="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 rounded-lg"
                  >
                    <Icon name="refresh" :size="10" class="animate-spin text-zinc-500" />
                    <span class="text-[10px] text-zinc-500 font-black uppercase">检查中</span>
                  </div>
                  <template v-else-if="getSimilarSong(item.data)">
                    <div
                      :class="[
                        'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border',
                        getSimilarSong(item.data)?.played
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : getSimilarSong(item.data)?.scheduled
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      ]"
                    >
                      {{
                        getSimilarSong(item.data)?.played
                          ? '已播放'
                          : getSimilarSong(item.data)?.scheduled
                            ? '已排期'
                            : '已在列表中'
                      }}
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        v-if="getSimilarSong(item.data)?.played && isSuperAdmin"
                        :disabled="submitting"
                        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-widest disabled:opacity-50"
                        @click="selectSong(item.data)"
                      >
                        {{
                          submitting && selectedSongId === item.data?.id ? '处理中...' : '继续投稿'
                        }}
                      </button>
                      <button
                        v-else
                        :disabled="
                          getSimilarSong(item.data)?.played ||
                          getSimilarSong(item.data)?.scheduled ||
                          getSimilarSong(item.data)?.voted ||
                          submitting
                        "
                        class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 text-zinc-400 disabled:text-zinc-700 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center gap-1.5"
                        @click="
                          getSimilarSong(item.data)?.played || getSimilarSong(item.data)?.scheduled
                            ? null
                            : handleLike(getSimilarSong(item.data))
                        "
                      >
                        <Icon
                          name="heart"
                          :size="10"
                          :class="[
                            getSimilarSong(item.data)?.voted ? 'text-red-500 fill-current' : ''
                          ]"
                        />
                        {{ getSimilarSong(item.data)?.voted ? '已点赞' : '点赞' }}
                      </button>
                    </div>
                  </template>
                  <button
                    v-else
                    :disabled="submitting || songsLoadingForSimilar"
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-900/20"
                    @click="selectSong(item.data)"
                  >
                    {{
                      submitting && selectedSongId === item.data?.id ? '正在提交...' : '选择投稿'
                    }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部栏 -->
          <div
            class="p-6 border-t border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between"
          >
            <div
              class="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest"
            >
              <Icon name="info" :size="12" />
              数据来自网易云音乐播放记录
            </div>
            <button
              class="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-xl transition-all uppercase tracking-widest"
              @click="close"
            >
              关闭窗口
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getRecentSongs } from '~/utils/neteaseApi'
import { convertToHttps } from '~/utils/url'
import Icon from '~/components/UI/Icon.vue'
import { useSongs } from '~/composables/useSongs'
import { useAuth } from '~/composables/useAuth'
import { useSemesters } from '~/composables/useSemesters'

const props = defineProps({
  show: Boolean,
  cookie: String
})

const emit = defineEmits(['close', 'submit', 'play'])

const songs = ref([])
const loading = ref(false)
const songsLoadingForSimilar = ref(false)
const error = ref('')
const submitting = ref(false)
const selectedSongId = ref(null)

const songService = useSongs()
const auth = useAuth()
const { currentSemester, fetchCurrentSemester } = useSemesters()
const isSuperAdmin = computed(() => auth.user.value?.role === 'SUPER_ADMIN')

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
const getSimilarSong = (songData) => {
  if (!songData) return null

  const title = songData.name
  const artist = songData.ar?.map((a) => a.name).join('/')

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

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const fetchRecentSongs = async () => {
  if (!props.cookie) return

  loading.value = true
  error.value = ''

  try {
    const { code, body, message } = await getRecentSongs(100, props.cookie)
    if (code === 200 && body && body.list) {
      songs.value = body.list.filter((item) => item.resourceType === 'SONG' && item.data)
    } else {
      error.value = message || '获取最近播放失败'
    }
  } catch (err) {
    error.value = '网络请求失败'
    console.error(err)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  async (newVal) => {
    if (newVal) {
      // 确保当前学期已加载，用于正确检查歌曲状态
      if (!currentSemester.value) {
        await fetchCurrentSemester()
      }

      fetchRecentSongs()
      // 加载歌曲列表以便检查相似歌曲
      if (
        auth.isAuthenticated.value &&
        (!songService.songs.value || songService.songs.value.length === 0)
      ) {
        songsLoadingForSimilar.value = true
        const currentSemesterName = currentSemester.value?.name
        songService
          .fetchSongs(true, currentSemesterName)
          .catch((err) => {
            console.error('加载歌曲列表失败:', err)
          })
          .finally(() => {
            songsLoadingForSimilar.value = false
          })
      }
    } else {
      songs.value = []
      submitting.value = false
      selectedSongId.value = null
    }
  }
)

const handleLike = async (song) => {
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

const playSong = (songData) => {
  // 简单的播放预览，如果需要完整播放器支持可能需要更多字段
  // 这里暂时只发射事件，由父组件决定如何播放
  // 实际上 RequestForm 可能会调用全局播放器
  // 但这里为了简化，我们暂时构造一个简单的对象
  emit('play', {
    id: songData.id,
    title: songData.name,
    artist: songData.ar?.map((a) => a.name).join('/'),
    cover: songData.al?.picUrl,
    musicPlatform: 'netease',
    musicId: songData.id.toString(),
    sourceInfo: {
      source: 'netease-backup',
      type: 'song'
    }
  })
}

const selectSong = (songData) => {
  selectedSongId.value = songData.id
  submitting.value = true

  const song = {
    id: songData.id,
    title: songData.name,
    artist: songData.ar?.map((a) => a.name).join('/'),
    cover: songData.al?.picUrl,
    album: songData.al?.name,
    duration: songData.dt,
    musicPlatform: 'netease',
    musicId: songData.id.toString(),
    sourceInfo: {
      source: 'netease-backup',
      type: 'song'
    }
  }

  emit('submit', song)
  // 不立即关闭，由父组件控制
}

const close = () => {
  emit('close')
}

defineExpose({
  resetSubmissionState: () => {
    submitting.value = false
    selectedSongId.value = null
  }
})
</script>

<style scoped>
/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #718096;
}
</style>
