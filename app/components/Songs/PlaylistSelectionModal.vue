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
      <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" @click.self="close">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

        <div class="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" @click.stop>
          <!-- 头部 -->
          <div class="flex items-center justify-between p-8 pb-4">
            <div class="flex items-center gap-4">
              <button
                  v-if="view === 'songs'"
                  class="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                  @click="backToPlaylists"
              >
                <Icon name="arrow-left" :size="20" />
              </button>
              <h3 class="text-xl font-black text-zinc-100 tracking-tight truncate max-w-[300px] sm:max-w-md">
                {{ view === 'playlists' ? '选择歌单' : selectedPlaylist?.name || '歌单详情' }}
              </h3>
            </div>
            <button
                class="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                @click="close"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
            <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Icon name="loader" :size="48" class="mb-4 animate-spin text-zinc-400" />
              <p class="font-medium">处理中...</p>
            </div>

            <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-center px-8">
              <div class="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                <Icon name="alert-circle" :size="32" class="text-red-500" />
              </div>
              <p class="text-zinc-400 font-medium mb-6">{{ error }}</p>
              <button
                  class="px-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black transition-all active:scale-95 uppercase tracking-widest"
                  @click="retry"
              >
                重试
              </button>
            </div>

            <!-- 歌单列表视图 -->
            <div v-else-if="view === 'playlists'" class="playlist-list space-y-3">
              <div v-if="playlists.length === 0" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                <div class="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-4">
                  <Icon name="music" :size="32" class="opacity-20" />
                </div>
                <p class="font-medium">暂无歌单</p>
              </div>

              <div
                  v-for="playlist in playlists"
                  v-else
                  :key="playlist.id"
                  class="group flex items-center p-4 bg-zinc-800/30 border border-zinc-800/50 rounded-3xl hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer"
                  @click="selectPlaylist(playlist)"
              >
                <div class="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-800 mr-4 flex-shrink-0">
                  <img :src="convertToHttps(playlist.coverImgUrl)" alt="cover" class="w-full h-full object-cover" loading="lazy" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-zinc-100 truncate group-hover:text-white transition-colors">
                    {{ playlist.name }}
                  </h4>
                  <div class="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40"></span>
                      {{ playlist.trackCount }}首
                    </span>
                    <span class="flex items-center truncate">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40"></span>
                      by {{ playlist.creator?.nickname }}
                    </span>
                  </div>
                </div>
                <div class="ml-4 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  <Icon name="chevron-right" :size="24" />
                </div>
              </div>
            </div>

            <!-- 歌曲列表视图 -->
            <div v-else class="song-list space-y-3">
              <div v-if="songs.length === 0" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                <div class="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-4">
                  <Icon name="music" :size="32" class="opacity-20" />
                </div>
                <p class="font-medium">歌单为空</p>
              </div>

              <div
                  v-for="song in songs"
                  v-else
                  :key="song.id"
                  class="group flex items-center p-4 bg-zinc-800/30 border border-zinc-800/50 rounded-3xl hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
              >
                <!-- 封面与播放叠加层 -->
                <div class="relative w-14 h-14 rounded-2xl overflow-hidden bg-zinc-800 mr-4 flex-shrink-0 group/cover cursor-pointer" @click="playSong(song)">
                  <img :src="convertToHttps(song.al?.picUrl)" alt="cover" class="w-full h-full object-cover" loading="lazy" />
                  <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                    <div class="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Icon name="play" :size="16" class="text-white fill-current" />
                    </div>
                  </div>
                </div>

                <!-- 歌曲信息 -->
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-zinc-100 truncate group-hover:text-white transition-colors">
                    {{ song.name }}
                  </h4>
                  <div class="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 truncate">
                    <span class="truncate">{{ song.ar?.map(a => a.name).join('/') }}</span>
                    <span v-if="song.al?.name" class="opacity-40 shrink-0">·</span>
                    <span v-if="song.al?.name" class="truncate opacity-60">{{ song.al.name }}</span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="ml-4 shrink-0 flex items-center gap-3">
                  <div v-if="songsLoadingForSimilar" class="text-xs font-bold text-zinc-600 animate-pulse">
                    处理中...
                  </div>
                  <div v-else-if="getSimilarSong(song)" class="flex flex-col items-end gap-1.5">
                    <span
                        v-if="getSimilarSong(song)?.played"
                        class="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-wider"
                    >
                      已播放
                    </span>
                    <span
                        v-else-if="getSimilarSong(song)?.scheduled"
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
                          v-if="getSimilarSong(song)?.played && isSuperAdmin"
                          :disabled="submitting"
                          class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest"
                          @click.stop="selectSong(song)"
                      >
                        {{ submitting && selectedSongId === song.id ? '...' : '继续投稿' }}
                      </button>
                      <button
                          v-else
                          class="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 disabled:cursor-not-allowed uppercase tracking-widest"
                          :class="[
                            getSimilarSong(song)?.voted
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/50 hover:border-zinc-600'
                          ]"
                          :disabled="getSimilarSong(song)?.played || getSimilarSong(song)?.scheduled || getSimilarSong(song)?.voted || submitting"
                          @click.stop="handleLike(getSimilarSong(song))"
                      >
                        {{ getSimilarSong(song)?.voted ? '已点赞' : '点赞' }}
                      </button>
                    </div>
                  </div>
                  <button
                      v-else
                      :disabled="submitting || songsLoadingForSimilar"
                      class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black disabled:opacity-50 transition-all active:scale-95 shrink-0 uppercase tracking-widest shadow-lg shadow-blue-900/20"
                      @click.stop="selectSong(song)"
                  >
                    {{ submitting && selectedSongId === song.id ? '提交中...' : '选择投稿' }}
                  </button>
                </div>
              </div>

              <!-- 加载更多按钮 -->
              <div v-if="hasMore" class="pt-6 pb-2 flex justify-center">
                <button
                    :disabled="moreLoading"
                    class="px-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black disabled:opacity-50 transition-all flex items-center gap-2 uppercase tracking-widest"
                    @click="loadMore"
                >
                  <Icon v-if="moreLoading" name="loader" :size="16" class="animate-spin" />
                  {{ moreLoading ? '加载中...' : '加载更多' }}
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
import { getPlaylistTracks, getUserPlaylists } from '~/utils/neteaseApi'
import { convertToHttps } from '~/utils/url'
import Icon from '../UI/Icon.vue'
import { useSongs } from '~/composables/useSongs'
import { useAuth } from '~/composables/useAuth'
import { useSemesters } from '~/composables/useSemesters'

const props = defineProps({
  show: Boolean,
  cookie: String,
  uid: [String, Number]
})

const emit = defineEmits(['close', 'submit', 'play'])

const view = ref('playlists') // 'playlists' | 'songs'
const playlists = ref([])
const songs = ref([])
const selectedPlaylist = ref(null)
const loading = ref(false)
const songsLoadingForSimilar = ref(false)
const error = ref('')
const submitting = ref(false)
const selectedSongId = ref(null)

// 分页状态
const limit = ref(100)
const offset = ref(0)
const hasMore = ref(true)
const moreLoading = ref(false)

const songService = useSongs()
const auth = useAuth()
const {currentSemester, fetchCurrentSemester} = useSemesters()
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
  const artist = songData.ar?.map(a => a.name).join('/')

  if (!title || !artist) return null

  const normalizedTitle = normalizeString(title)
  const normalizedArtist = normalizeString(artist)
  const currentSemesterName = currentSemester.value?.name

  // 如果没有获取到当前学期信息，暂时不进行检查，避免误报
  if (!currentSemesterName) return null

  return songService.songs.value.find(song => {
    const songTitle = normalizeString(song.title)
    const songArtist = normalizeString(song.artist)
    const titleMatch = songTitle === normalizedTitle && songArtist === normalizedArtist

    // 必须匹配当前学期
    return titleMatch && song.semester === currentSemesterName
  })
}

const fetchUserPlaylists = async () => {
  if (!props.cookie || !props.uid) return

  loading.value = true
  error.value = ''

  try {
    const {code, body, message} = await getUserPlaylists(props.uid, props.cookie)
    if (code === 200 && body && body.playlist) {
      playlists.value = body.playlist
    } else {
      error.value = message || '获取歌单列表失败'
    }
  } catch (err) {
    error.value = '网络请求失败'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const fetchPlaylistSongs = async (playlistId, isLoadMore = false) => {
  if (!props.cookie) return

  if (isLoadMore) {
    moreLoading.value = true
  } else {
    loading.value = true
    songs.value = []
    offset.value = 0
    hasMore.value = true
  }

  error.value = ''

  try {
    // 当前偏移逻辑:
    // 首次加载: offset=0, limit=100. 下次加载: offset=100, limit=100
    // 注意: API 偏移参数如果遵循文档逻辑，应作为页面偏移?
    // "传递 limit=50&offset=0 得到 1-50。传递 limit=50&offset=50 得到 51-100"
    // 所以 offset 变量应该跟踪目前为止加载的歌曲数量。

    const {code, body, message} = await getPlaylistTracks(playlistId, limit.value, offset.value, props.cookie)
    if (code === 200 && body && body.songs) {
      if (isLoadMore) {
        songs.value = [...songs.value, ...body.songs]
      } else {
        songs.value = body.songs
      }

      // 为下次调用更新偏移
      offset.value += body.songs.length

      // 检查是否还有更多歌曲
      if (body.songs.length < limit.value) {
        hasMore.value = false
      }
    } else {
      error.value = message || '获取歌单歌曲失败'
    }
  } catch (err) {
    error.value = '网络请求失败'
    console.error(err)
  } finally {
    loading.value = false
    moreLoading.value = false
  }
}

const loadMore = () => {
  if (selectedPlaylist.value) {
    fetchPlaylistSongs(selectedPlaylist.value.id, true)
  }
}

const selectPlaylist = (playlist) => {
  selectedPlaylist.value = playlist
  view.value = 'songs'
  fetchPlaylistSongs(playlist.id)
}

const backToPlaylists = () => {
  view.value = 'playlists'
  selectedPlaylist.value = null
  songs.value = []
  offset.value = 0
  hasMore.value = true
  error.value = ''
}

const retry = () => {
  if (view.value === 'playlists') {
    fetchUserPlaylists()
  } else if (selectedPlaylist.value) {
    // 重新从头加载歌曲
    fetchPlaylistSongs(selectedPlaylist.value.id)
  }
}

watch(() => props.show, async (newVal) => {
  if (newVal) {
    view.value = 'playlists'
    playlists.value = []
    songs.value = []
    selectedPlaylist.value = null
    offset.value = 0
    hasMore.value = true
    
    // 确保当前学期已加载，用于正确检查歌曲状态
    if (!currentSemester.value) {
      await fetchCurrentSemester()
    }
    
    fetchUserPlaylists()

    // 加载歌曲列表以便检查相似歌曲
    if (auth.isAuthenticated.value && (!songService.songs.value || songService.songs.value.length === 0)) {
      songsLoadingForSimilar.value = true
      const currentSemesterName = currentSemester.value?.name
      songService.fetchSongs(true, currentSemesterName)
          .catch(err => {
            console.error('加载歌曲列表失败:', err)
          })
          .finally(() => {
            songsLoadingForSimilar.value = false
          })
    }
  } else {
    // 重置状态
    submitting.value = false
    selectedSongId.value = null
  }
})

watch(() => props.uid, (newVal) => {
  if (props.show && newVal) {
    fetchUserPlaylists()
  }
})

const handleLike = async (song) => {
  if (!song || song.voted) return

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
  emit('play', {
    id: songData.id,
    title: songData.name,
    artist: songData.ar?.map(a => a.name).join('/'),
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
    artist: songData.ar?.map(a => a.name).join('/'),
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
