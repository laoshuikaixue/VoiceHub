<template>
  <Teleport to="body">
    <Transition name="modal-animation">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-content podcast-modal">
          <div class="modal-header">
            <div class="header-left">
              <button v-if="view === 'songs'" class="back-btn" @click="backToPlaylists">
                <Icon :size="20" name="arrow-left"/>
              </button>
              <h3>{{ view === 'playlists' ? '选择歌单' : selectedPlaylist?.name || '歌单详情' }}</h3>
            </div>
            <button class="close-btn" @click="close">&times;</button>
          </div>

          <div class="modal-body">
            <div v-if="loading" class="loading-state">
              <div class="loading-spinner"></div>
              <p>处理中...</p>
            </div>

            <div v-else-if="error" class="error-state">
              <p>{{ error }}</p>
              <button class="retry-btn" @click="retry">重试</button>
            </div>

            <!-- 歌单列表视图 -->
            <div v-else-if="view === 'playlists'" class="programs-list">
              <div v-if="playlists.length === 0" class="empty-state">
                <p>暂无歌单</p>
              </div>
              <div v-for="playlist in playlists" v-else :key="playlist.id" class="program-item playlist-item"
                   @click="selectPlaylist(playlist)">
                <div class="program-cover">
                  <img :src="convertToHttps(playlist.coverImgUrl)" alt="cover" loading="lazy"/>
                </div>
                <div class="program-info">
                  <h4 :title="playlist.name" class="program-title">{{ playlist.name }}</h4>
                  <div class="program-meta">
                    <span class="program-count">{{ playlist.trackCount }}首</span>
                    <span class="program-creator">by {{ playlist.creator?.nickname }}</span>
                  </div>
                </div>
                <div class="program-action">
                  <Icon :size="20" color="#6b7280" name="chevron-right"/>
                </div>
              </div>
            </div>

            <!-- 歌曲列表视图 -->
            <div v-else class="programs-list">
              <div v-if="songs.length === 0" class="empty-state">
                <p>歌单为空</p>
              </div>
              <div v-for="song in songs" v-else :key="song.id" class="program-item">
                <div class="program-cover">
                  <img :src="convertToHttps(song.al?.picUrl)" alt="cover" loading="lazy"/>
                  <div class="play-overlay" @click.stop="playSong(song)">
                    <div class="play-button-bg">
                      <Icon :size="16" color="white" name="play"/>
                    </div>
                  </div>
                </div>
                <div class="program-info">
                  <h4 :title="song.name" class="program-title">{{ song.name }}</h4>
                  <div class="program-meta">
                    <span class="program-artist">{{ song.ar?.map(a => a.name).join('/') }}</span>
                    <span v-if="song.al?.name" class="program-album"> - {{ song.al.name }}</span>
                  </div>
                </div>
                <div class="program-action">
                  <div v-if="songsLoadingForSimilar" class="similar-song-info">
                    <span class="similar-text">处理中...</span>
                  </div>
                  <div v-else-if="getSimilarSong(song)" class="similar-song-info">
                    <span v-if="getSimilarSong(song)?.played" class="similar-text status-played">歌曲已播放</span>
                    <span v-else-if="getSimilarSong(song)?.scheduled"
                          class="similar-text status-scheduled">歌曲已排期</span>
                    <span v-else class="similar-text">歌曲已存在</span>

                    <div class="similar-actions">
                      <button
                          v-if="getSimilarSong(song)?.played && isSuperAdmin"
                          :disabled="submitting"
                          class="select-btn"
                          @click.stop="selectSong(song)"
                      >
                        {{ submitting && selectedSongId === song.id ? '处理中...' : '继续投稿' }}
                      </button>
                      <button
                          v-else
                          :class="{
                          'like-btn': true,
                          'disabled': getSimilarSong(song)?.played || getSimilarSong(song)?.scheduled || getSimilarSong(song)?.voted || submitting
                        }"
                          :disabled="getSimilarSong(song)?.played || getSimilarSong(song)?.scheduled || getSimilarSong(song)?.voted || submitting"
                          :title="
                          getSimilarSong(song)?.played
                            ? '已播放的歌曲不能点赞'
                            : getSimilarSong(song)?.scheduled
                              ? '已排期的歌曲不能点赞'
                              : getSimilarSong(song)?.voted
                                ? '已点赞'
                                : '点赞'
                        "
                          @click.stop="getSimilarSong(song)?.played || getSimilarSong(song)?.scheduled ? null : handleLike(getSimilarSong(song))"
                      >
                        {{
                          getSimilarSong(song)?.played
                              ? '已播放'
                              : getSimilarSong(song)?.scheduled
                                  ? '已排期'
                                  : getSimilarSong(song)?.voted
                                      ? '已点赞'
                                      : '点赞'
                        }}
                      </button>
                    </div>
                  </div>
                  <button
                      v-else
                      :disabled="submitting || songsLoadingForSimilar"
                      class="select-btn"
                      @click.stop="selectSong(song)"
                  >
                    {{ submitting && selectedSongId === song.id ? '处理中...' : '选择投稿' }}
                  </button>
                </div>
              </div>

              <!-- Load More Button -->
              <div v-if="hasMore" class="load-more-container">
                <button :disabled="moreLoading" class="load-more-btn" @click="loadMore">
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
import {computed, ref, watch} from 'vue'
import {getPlaylistTracks, getUserPlaylists} from '~/utils/neteaseApi'
import {convertToHttps} from '~/utils/url'
import Icon from '../UI/Icon.vue'
import {useSongs} from '~/composables/useSongs'
import {useAuth} from '~/composables/useAuth'
import {useSemesters} from '~/composables/useSemesters'

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

// Pagination state
const limit = ref(100)
const offset = ref(0)
const hasMore = ref(true)
const moreLoading = ref(false)

const songService = useSongs()
const auth = useAuth()
const {currentSemester} = useSemesters()
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

  return songService.songs.value.find(song => {
    const songTitle = normalizeString(song.title)
    const songArtist = normalizeString(song.artist)
    const titleMatch = songTitle === normalizedTitle && songArtist === normalizedArtist

    if (currentSemesterName) {
      return titleMatch && song.semester === currentSemesterName
    }
    return titleMatch
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
    // Current offset logic:
    // First load: offset=0, limit=100. Next load: offset=100, limit=100
    // Note: The API offset parameter works as page offset if we follow the documentation logic?
    // "You pass limit=50&offset=0 you get 1-50. You pass limit=50&offset=50 you get 51-100"
    // So my offset variable should track the number of songs loaded so far.

    const {code, body, message} = await getPlaylistTracks(playlistId, limit.value, offset.value, props.cookie)
    if (code === 200 && body && body.songs) {
      if (isLoadMore) {
        songs.value = [...songs.value, ...body.songs]
      } else {
        songs.value = body.songs
      }

      // Update offset for next call
      offset.value += body.songs.length

      // Check if we have more songs
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
    // Retry loading songs from scratch
    fetchPlaylistSongs(selectedPlaylist.value.id)
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    view.value = 'playlists'
    playlists.value = []
    songs.value = []
    selectedPlaylist.value = null
    offset.value = 0
    hasMore.value = true
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-secondary, #fff);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color, #e5e7eb);
  color: var(--text-primary, #111827);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #6b7280);
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #111827);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary, #111827);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.programs-list {
  padding: 10px 0;
}

.program-item {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
  align-items: center;
  transition: background-color 0.2s;
}

.playlist-item {
  cursor: pointer;
}

.program-item:hover {
  background-color: var(--bg-hover, #f9fafb);
}

.program-cover {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--bg-hover, #f3f4f6);
}

.program-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 6px;
  cursor: pointer;
}

.program-cover:hover .play-overlay {
  opacity: 1;
}

.play-button-bg {
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.program-info {
  flex: 1;
  min-width: 0;
}

.program-title {
  margin: 0 0 4px;
  font-size: 0.95rem;
  color: var(--text-primary, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.program-meta {
  display: flex;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary, #6b7280);
  align-items: center;
}

.program-action {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 40px;
}

.select-btn {
  padding: 6px 16px;
  background-color: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}

.select-btn:hover {
  opacity: 0.9;
}

.select-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary, #6b7280);
}

.loading-spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid var(--primary-color, #3b82f6);
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.retry-btn {
  margin-top: 10px;
  padding: 6px 12px;
  background-color: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.similar-song-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
  margin-right: 8px;
}

.similar-text {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
}

.similar-text.status-played {
  color: #ef4444;
  font-weight: 600;
}

.similar-text.status-scheduled {
  color: #f59e0b;
  font-weight: 600;
}

.similar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}

.like-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  font-size: 12px;
  cursor: pointer;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
  white-space: nowrap;
}

.like-btn.disabled {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  box-shadow: none;
  opacity: 0.7;
  cursor: not-allowed;
}

/* Dark mode overrides - updated to match new style */
:root[class~="dark"] .modal-content {
  background: rgba(20, 20, 25, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  backdrop-filter: blur(8px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

:root[class~="dark"] .modal-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
}

:root[class~="dark"] .program-item {
  border-color: rgba(255, 255, 255, 0.05);
}

:root[class~="dark"] .program-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

:root[class~="dark"] .modal-header h3,
:root[class~="dark"] .program-title {
  color: #ffffff;
}

:root[class~="dark"] .close-btn {
  color: rgba(255, 255, 255, 0.4);
}

:root[class~="dark"] .close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

:root[class~="dark"] .program-meta {
  color: rgba(255, 255, 255, 0.5);
}

:root[class~="dark"] .back-btn {
  color: rgba(255, 255, 255, 0.4);
}

:root[class~="dark"] .back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.load-more-btn {
  padding: 8px 24px;
  background-color: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #111827);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background-color: var(--border-color, #e5e7eb);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

:root[class~="dark"] .load-more-btn {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

:root[class~="dark"] .load-more-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
