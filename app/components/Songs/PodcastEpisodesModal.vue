<template>
  <Teleport to="body">
    <Transition name="modal-animation">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-content podcast-modal">
          <div class="modal-header">
            <h3>{{ radioName }} - 节目列表</h3>
            <button class="close-btn" @click="close">&times;</button>
          </div>

          <div class="modal-body">
            <div v-if="loading" class="loading-state">
              <div class="loading-spinner"></div>
              <p>加载节目中...</p>
            </div>

            <div v-else-if="error" class="error-state">
              <p>{{ error }}</p>
              <button class="retry-btn" @click="fetchPrograms(false)">重试</button>
            </div>

            <div v-else-if="programs.length === 0" class="empty-state">
              <p>暂无节目</p>
            </div>

            <div v-else class="programs-list">
              <div v-for="program in programs" :key="program.id" class="program-item">
                <div class="program-cover">
                  <img :src="convertToHttps(program.coverUrl || program.mainSong?.album?.picUrl)" alt="cover"
                       loading="lazy"/>
                  <div class="play-overlay" @click.stop="playProgram(program)">
                    <div class="play-button-bg">
                      <Icon :size="16" color="white" name="play"/>
                    </div>
                  </div>
                </div>
                <div class="program-info">
                  <h4 :title="program.name" class="program-title">{{ program.name }}</h4>
                  <div class="program-meta">
                    <span class="program-date">{{ formatDate(program.createTime) }}</span>
                    <span class="program-duration">{{ formatDuration(program.duration) }}</span>
                    <span class="program-listener">🎧 {{ formatCount(program.listenerCount) }}</span>
                  </div>
                </div>
                <div class="program-action">
                  <div v-if="songsLoadingForSimilar" class="similar-song-info">
                    <span class="similar-text">处理中...</span>
                  </div>
                  <div v-else-if="getSimilarSong(program)" class="similar-song-info">
                    <span v-if="getSimilarSong(program)?.played" class="similar-text status-played">歌曲已播放</span>
                    <span v-else-if="getSimilarSong(program)?.scheduled"
                          class="similar-text status-scheduled">歌曲已排期</span>
                    <span v-else class="similar-text">歌曲已存在</span>

                    <div class="similar-actions">
                      <button
                          v-if="getSimilarSong(program)?.played && isSuperAdmin"
                          :disabled="submitting"
                          class="select-btn"
                          @click.stop="selectProgram(program)"
                      >
                        {{ submitting && selectedProgramId === program.id ? '提交中...' : '继续投稿' }}
                      </button>
                      <button
                          v-else
                          :class="{
                          'like-btn': true,
                          'disabled': getSimilarSong(program)?.played || getSimilarSong(program)?.scheduled || getSimilarSong(program)?.voted || submitting
                        }"
                          :disabled="getSimilarSong(program)?.played || getSimilarSong(program)?.scheduled || getSimilarSong(program)?.voted || submitting"
                          :title="
                          getSimilarSong(program)?.played
                            ? '已播放的歌曲不能点赞'
                            : getSimilarSong(program)?.scheduled
                              ? '已排期的歌曲不能点赞'
                              : getSimilarSong(program)?.voted
                                ? '已点赞'
                                : '点赞'
                        "
                          @click.stop="getSimilarSong(program)?.played || getSimilarSong(program)?.scheduled ? null : handleLikeFromProgram(getSimilarSong(program))"
                      >
                        {{
                          getSimilarSong(program)?.played
                              ? '已播放'
                              : getSimilarSong(program)?.scheduled
                                  ? '已排期'
                                  : getSimilarSong(program)?.voted
                                      ? '已点赞'
                                      : '点赞'
                        }}
                      </button>
                    </div>
                  </div>
                  <button
                      v-else
                      :disabled="submitting"
                      class="select-btn"
                      @click="selectProgram(program)"
                  >
                    {{ submitting && selectedProgramId === program.id ? '提交中...' : '选择投稿' }}
                  </button>
                </div>
              </div>

              <div v-if="hasMore" class="load-more">
                <button :disabled="loadingMore" class="load-more-btn" @click="loadMore">
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
import {computed, ref, watch} from 'vue'
import {useMusicSources} from '~/composables/useMusicSources'
import {useSongs} from '~/composables/useSongs'
import {useAuth} from '~/composables/useAuth'
import {useSemesters} from '~/composables/useSemesters'
import {convertToHttps} from '~/utils/url'
import Icon from '../UI/Icon.vue'

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
const {currentSemester} = useSemesters()

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
  // Reset state
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

watch(() => props.show, (val) => {
  if (val) {
    submitting.value = false
    selectedProgramId.value = null
    if (auth.isAuthenticated.value && (!songService.songs.value || songService.songs.value.length === 0)) {
      const currentSemesterName = currentSemester.value?.name
      songsLoadingForSimilar.value = true
      songService.fetchSongs(true, currentSemesterName)
          .catch(err => {
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
})

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

.program-item:hover {
  background-color: var(--bg-hover, #f9fafb);
}

.program-cover {
  position: relative;
  cursor: pointer;
}

.program-cover img {
  width: 50px;
  height: 50px;
  border-radius: 6px;
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
  gap: 12px;
  font-size: 0.8rem;
  color: var(--text-secondary, #6b7280);
}

.program-action {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
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

.load-more {
  text-align: center;
  padding: 16px;
}

.load-more-btn {
  padding: 8px 16px;
  background: none;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
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

/* Similar Song Info Styles */
.similar-song-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
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

/* Modal Animation */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: opacity 0.3s ease;
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
}

.modal-animation-enter-active .modal-content,
.modal-animation-leave-active .modal-content {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-animation-enter-from .modal-content,
.modal-animation-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}

/* Dark mode overrides (assuming class 'dark' on html/body) - updated to match new style */
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
