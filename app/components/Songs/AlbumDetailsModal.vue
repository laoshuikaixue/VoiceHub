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
          class="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-start justify-between p-8 pb-4 gap-4">
            <div class="flex items-start gap-4 min-w-0 flex-1">
              <div class="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-zinc-800 shadow-lg">
                <img
                  v-if="albumInfo && albumInfo.cover"
                  :src="convertToHttps(albumInfo.cover)"
                  :alt="albumInfo && albumInfo.name ? albumInfo.name : '专辑'"
                  class="w-full h-full object-cover"
                  referrerpolicy="no-referrer"
                >
                <div
                  v-else
                  class="w-full h-full bg-blue-600/10 flex items-center justify-center text-blue-500"
                >
                  <Icon name="disc" :size="32" />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-xl font-black text-zinc-100 tracking-tight truncate">
                  {{ albumInfo && albumInfo.name ? albumInfo.name : '专辑' }}
                </h3>
                <p class="text-xs font-bold text-zinc-400 mt-1 truncate">
                  {{ albumInfo && albumInfo.artist ? albumInfo.artist : '未知艺术家' }}
                </p>
                <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-zinc-600">
                  <span v-if="albumInfo && albumInfo.size">
                    {{ albumInfo.size }} 首
                  </span>
                  <span v-if="albumInfo && albumInfo.publishTime">
                    发行时间：{{ formatDate(albumInfo.publishTime) }}
                  </span>
                  <span v-if="albumInfo && albumInfo.company">
                    唱片公司：{{ albumInfo.company }}
                  </span>
                </div>
                <!-- 专辑描述 -->
                <p
                  v-if="albumInfo && albumInfo.description"
                  class="mt-2 text-[11px] text-zinc-500 leading-relaxed line-clamp-2 cursor-pointer hover:text-zinc-400 transition-colors"
                  title="点击查看完整介绍"
                  @click="showDescModal = true"
                >
                  {{ albumInfo.description }}
                </p>
              </div>
            </div>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all flex-shrink-0"
              @click="close"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 搜索框 -->
          <div class="px-8 pb-3">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索专辑内歌曲..."
                class="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all"
              >
              <Icon name="search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="flex-1 flex items-center justify-center py-12">
            <div class="flex flex-col items-center">
              <div class="w-12 h-12 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p class="text-sm font-bold text-zinc-500 uppercase tracking-widest">加载中...</p>
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="flex-1 flex items-center justify-center py-12">
            <div class="flex flex-col items-center text-red-500">
              <div
                class="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center mb-4"
              >
                <Icon name="alert-circle" :size="32" />
              </div>
              <p class="text-sm font-bold uppercase tracking-widest">{{ error }}</p>
            </div>
          </div>

          <!-- 歌曲列表 -->
          <div v-else class="flex-1 overflow-y-auto px-8 pt-2 pb-4 custom-scrollbar">
            <div
              v-if="filteredSongs.length === 0"
              class="flex flex-col items-center justify-center py-12 text-zinc-500"
            >
              <div
                class="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-4"
              >
                <Icon name="music" :size="32" class="opacity-20" />
              </div>
              <p class="text-sm font-bold uppercase tracking-widest">
                {{ searchQuery ? '未找到匹配的歌曲' : '暂无歌曲' }}
              </p>
            </div>

            <div v-else class="song-list space-y-1.5">
              <div
                v-for="(song, index) in filteredSongs"
                :key="song.songmid"
                class="group flex items-center p-2 sm:p-3 rounded-2xl transition-all"
                :class="[
                  isCurrentSong(song)
                    ? 'bg-blue-600/10 border border-blue-500/50'
                    : 'bg-zinc-800/30 border border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700'
                ]"
              >
                <!-- 歌曲封面 -->
                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 mr-3 bg-zinc-800">
                  <img
                    v-if="song.img"
                    :src="convertToHttps(song.img)"
                    :alt="song.name"
                    class="w-full h-full object-cover"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                  >
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-zinc-600"
                  >
                    <Icon name="music" :size="16" />
                  </div>
                </div>

                <!-- 歌曲信息 -->
                <div class="flex-1 min-w-0">
                  <h4
                    class="font-bold text-zinc-100 text-sm sm:text-base whitespace-normal sm:whitespace-nowrap sm:truncate line-clamp-2 sm:line-clamp-none group-hover:text-white transition-colors"
                  >
                    {{ song.name }}
                  </h4>
                  <div
                    class="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider"
                  >
                    <span class="truncate">{{ song.singer }}</span>
                    <span class="flex items-center shrink-0">
                      <Icon name="clock" :size="10" class="mr-1" />
                      {{ song.interval }}
                    </span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="ml-2 sm:ml-4 shrink-0 flex items-center gap-2">
                  <!-- 预听/暂停按钮 -->
                  <button
                    class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-all active:scale-95"
                    :title="isCurrentSong(song) && isPlaying ? '暂停' : '预听'"
                    @click.stop="togglePlay(song)"
                  >
                    <Icon
                      :name="isCurrentSong(song) && isPlaying ? 'pause' : 'play'"
                      :size="16"
                    />
                  </button>

                  <template v-if="getSongStatus(song).played">
                    <!-- 已播放标签 -->
                    <div
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest"
                    >
                      已播放
                    </div>
                  </template>

                  <template v-else-if="getSongStatus(song).scheduled">
                    <!-- 已排期标签 -->
                    <div
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest"
                    >
                      已排期
                    </div>
                  </template>

                  <template v-else-if="getSongStatus(song).submitted">
                    <div class="flex flex-col sm:flex-row gap-2 items-center">
                      <!-- 已投稿标签 -->
                      <div
                        class="w-full text-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-800 text-zinc-500 text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest"
                      >
                        已投稿
                      </div>

                      <!-- 点赞按钮（非自己投稿） -->
                      <button
                        v-if="!isMySong(song)"
                        :disabled="getSongStatus(song).voted || submitting"
                        :class="[
                          'w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest transition-all active:scale-95',
                          getSongStatus(song).voted
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20 cursor-not-allowed'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-500'
                        ]"
                        @click.stop="voteSong(song)"
                      >
                        <span class="flex items-center justify-center gap-1">
                          <Icon
                            name="heart"
                            :size="12"
                            :class="getSongStatus(song).voted ? 'fill-current' : ''"
                          />
                          <span>{{ getSongStatus(song).voted ? '已点赞' : '点赞' }}</span>
                        </span>
                      </button>
                    </div>
                  </template>

                  <template v-else>
                    <!-- 投稿按钮（未投稿） -->
                    <button
                      :disabled="submitting"
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black disabled:opacity-50 transition-all active:scale-95 shrink-0 uppercase tracking-widest shadow-lg shadow-blue-900/20"
                      @click.stop="selectSong(song)"
                    >
                      <span v-if="submitting && selectedSongId === song.songmid">提交中...</span>
                      <span v-else>投稿</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <!-- 专辑简介弹窗 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showDescModal"
        class="fixed inset-0 z-[200] flex items-center justify-center p-6"
        @click.self="showDescModal = false"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          class="relative w-full max-w-xl max-h-[70vh] bg-zinc-900 border border-zinc-800 rounded-2xl p-6 overflow-y-auto custom-scrollbar"
          @click.stop
        >
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-black text-zinc-100 uppercase tracking-widest">专辑简介</h4>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
              @click="showDescModal = false"
            >
              <Icon name="x" :size="16" />
            </button>
          </div>
          <p class="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
            {{ albumInfo?.description }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  show: Boolean,
  albumId: {
    type: [String, Number],
    default: null
  },
  albumName: {
    type: String,
    default: null
  },
  platform: {
    type: String,
    default: 'netease' // netease 或 tencent
  },
  submittedSongs: {
    type: Array,
    default: () => []
  },
  currentUserId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close', 'submit', 'play', 'vote'])

const { getCurrentSong, getPlayingStatus, pauseSong } = useAudioPlayer()
const currentSong = getCurrentSong()
const isPlaying = getPlayingStatus()

const loading = ref(false)
const error = ref(null)
const albumInfo = ref(null)
const songs = ref([])
const submitting = ref(false)
const selectedSongId = ref(null)
const searchQuery = ref('')
const showDescModal = ref(false)

const filteredSongs = computed(() => {
  if (!searchQuery.value.trim()) return songs.value
  const q = searchQuery.value.trim().toLowerCase()
  return songs.value.filter(s => 
    s.name.toLowerCase().includes(q) || 
    s.singer.toLowerCase().includes(q)
  )
})

// 监听显示状态和专辑ID变化，加载专辑详情
watch(
  () => [props.show, props.albumId],
  async ([show, albumId]) => {
    if (show && albumId) {
      searchQuery.value = ''
      await loadAlbumDetails()
    }
  },
  { immediate: true }
)

const loadAlbumDetails = async () => {
  if (!props.albumId) return

  loading.value = true
  error.value = null

  try {
    if (props.platform === 'netease') {
      // 使用网易云音乐 API 获取专辑详情
      const response = await $fetch('/api/api-enhanced/netease/album', {
        params: {
          id: props.albumId
        }
      })

      if (response && response.album && response.songs) {
        // 转换为统一格式
        const album = response.album
        const artistName = album.artist?.name || album.artists?.map(a => a.name).join('/') || '未知艺术家'
        
        albumInfo.value = {
          id: album.id,
          name: album.name,
          cover: album.picUrl,
          artist: artistName,
          publishTime: album.publishTime,
          description: album.description,
          company: album.company,
          size: album.size
        }

        songs.value = response.songs.map((item, i) => {
          const singerName = item.ar?.map(a => a.name).join('/') || '未知艺术家'
          const durationMs = item.dt || 0
          return {
            songmid: item.id,
            name: item.name,
            singer: singerName,
            albumName: album.name,
            albumId: album.id,
            img: item.al?.picUrl || album.picUrl,
            interval: formatTime(Math.floor(durationMs / 1000)),
            duration: durationMs / 1000,
            trackNumber: item.no || i + 1,
            source: 'netease'
          }
        })
      } else {
        throw new Error('获取专辑详情失败')
      }
    } else if (props.platform === 'tencent') {
      // QQ音乐暂不支持，提示用户
      error.value = 'QQ音乐专辑详情功能暂未实现'
    } else {
      error.value = '不支持的平台'
    }
  } catch (err) {
    console.error('加载专辑详情失败:', err)
    error.value = '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return minutes + ':' + secs.toString().padStart(2, '0')
}

const formatDate = (timestamp) => {
  if (!timestamp) return null
  const parsedTimestamp = typeof timestamp === 'string' && /^\d+$/.test(timestamp) ? parseInt(timestamp, 10) : timestamp
  const date = new Date(parsedTimestamp)
  if (isNaN(date.getTime())) return null
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

const isCurrentSong = (song) => {
  if (!currentSong.value) return false
  
  // 使用 songmid 匹配
  return String(currentSong.value.musicId) === String(song.songmid) ||
         String(currentSong.value.id) === String(song.songmid)
}

const normalizeStr = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''""''、，。！？：；～·]/g, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[feat\.?|ft\.?]/gi, '')
    .trim()
}

const getSongStatus = (song) => {
  const songNameNormalized = normalizeStr(song.name)
  const songSingerNormalized = normalizeStr(song.singer)

  const submittedSong = props.submittedSongs.find((s) => {
    if (s.musicId && (String(s.musicId) === String(song.songmid))) {
      return true
    }
    return normalizeStr(s.title) === songNameNormalized &&
           normalizeStr(s.artist) === songSingerNormalized
  })

  if (submittedSong) {
    return {
      submitted: true,
      voted: submittedSong.voted || false,
      songId: submittedSong.id,
      requesterId: submittedSong.requesterId,
      played: submittedSong.played || false,
      scheduled: submittedSong.scheduled || false
    }
  }

  return {
    submitted: false,
    voted: false,
    songId: null,
    requesterId: null,
    played: false,
    scheduled: false
  }
}

const isMySong = (song) => {
  if (!props.currentUserId) return false
  const status = getSongStatus(song)
  return status.requesterId === props.currentUserId
}

const togglePlay = (song) => {
  if (isCurrentSong(song) && isPlaying.value) {
    pauseSong()
  } else {
    playSong(song)
  }
}

const playSong = (song) => {
  // 构建所有歌曲的播放列表
  const playlist = songs.value.map(s => ({
    id: s.songmid,
    title: s.name,
    song: s.name,
    artist: s.singer,
    singer: s.singer,
    cover: s.img,
    album: s.albumName,
    albumId: s.albumId,
    duration: s.duration * 1000,
    musicPlatform: props.platform,
    musicId: s.songmid,
    sourceInfo: {
      source: props.platform === 'tencent' ? 'vkeys' : 'netease-backup',
      originalId: s.songmid,
      fetchedAt: new Date(),
      mid: s.songmid,
      strMediaMid: s.strMediaMid,
      quality: s._types,
      types: s.types
    }
  }))
  const currentIndex = playlist.findIndex(p => p.id === song.songmid)

  emit('play', { song: playlist[currentIndex], playlist, playlistIndex: currentIndex })
}

const selectSong = (song) => {
  if (submitting.value) return
  
  submitting.value = true
  selectedSongId.value = song.songmid
  
  // 转换为投稿格式
  const songData = {
    id: song.songmid,
    title: song.name,
    song: song.name,
    artist: song.singer,
    singer: song.singer,
    cover: song.img,
    album: song.albumName,
    albumId: song.albumId,
    duration: song.duration * 1000,
    musicPlatform: props.platform,
    musicId: song.songmid,
    sourceInfo: {
      source: props.platform === 'tencent' ? 'vkeys' : 'netease-backup',
      originalId: song.songmid,
      fetchedAt: new Date(),
      mid: song.songmid,
      strMediaMid: song.strMediaMid,
      quality: song._types,
      types: song.types
    }
  }
  
  emit('submit', songData)
}

const voteSong = (song) => {
  if (submitting.value) return
  
  const { songId, voted } = getSongStatus(song)
  
  if (!songId || voted) return
  
  emit('vote', { ...song, songId })
}

const close = () => {
  emit('close')
  // 重置状态
  submitting.value = false
  selectedSongId.value = null
}

// 暴露方法给父组件，用于在提交失败时重置状态
const resetSubmissionState = () => {
  submitting.value = false
  selectedSongId.value = null
}

defineExpose({
  resetSubmissionState
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
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
