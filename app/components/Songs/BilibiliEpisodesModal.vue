<template>
  <AppModal
    :show="show"
    :title="video?.title || ''"
    size="xl" :description="locale.uploader + (video?.artist || '')"
    @close="close"
  >
    <template #icon>
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-hover-10 text-primary">
        <Icon name="play" :size="18" />
      </span>
    </template>


            <div
              v-if="episodes.length === 0"
              class="flex flex-col items-center justify-center py-12 text-text-tertiary"
            >
              <div
                class="w-16 h-16 rounded-2xl bg-bg-tertiary-50 flex items-center justify-center mb-4"
              >
                <Icon name="play" :size="32" class="opacity-20" />
              </div>
              <p class="text-sm font-bold uppercase tracking-wider">{{ locale.empty }}</p>
            </div>

            <div v-else class="program-list space-y-3">
              <div
                v-for="episode in episodes"
                :key="episode.cid"
                class="group flex items-center p-3 sm:p-4 rounded-2xl transition-all"
                :class="[
                  isCurrentEpisode(episode)
                    ? 'bg-primary-hover-10 border border-primary-50'
                    : 'bg-bg-tertiary-30 border border-border-secondary-50 hover:bg-bg-tertiary-50 hover:border-border-tertiary'
                ]"
              >
                <!-- 剧集编号 -->
                <div
                  class="w-8 h-8 sm:w-12 sm:h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-tertiary font-bold text-xs sm:text-sm flex-shrink-0 mr-3 sm:mr-4 group-hover:text-text-secondary transition-colors"
                >
                  P{{ episode.page }}
                </div>

                <!-- 剧集信息 -->
                <div class="flex-1 min-w-0">
                  <h4
                    class="font-bold text-text-primary text-sm sm:text-base whitespace-normal sm:whitespace-nowrap sm:truncate line-clamp-2 sm:line-clamp-none group-hover:text-text-primary transition-colors"
                  >
                    {{ episode.part }}
                  </h4>
                  <div
                    class="flex items-center gap-3 mt-1 text-xs text-text-tertiary font-bold uppercase tracking-wider"
                  >
                    <span class="flex items-center">
                      <Icon name="clock" :size="10" class="mr-1" />
                      {{ formatDuration(episode.duration) }}
                    </span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="ml-2 sm:ml-4 shrink-0 flex items-center gap-2 sm:gap-3">
                  <!-- 预听/暂停按钮 -->
                  <button
                    class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-bg-tertiary text-text-tertiary hover:bg-bg-quaternary hover:text-text-primary transition-all active:scale-95"
                    :title="isCurrentEpisode(episode) && isPlaying ? locale.pause : locale.preview"
                    @click.stop="togglePlay(episode)"
                  >
                    <Icon
                      :name="isCurrentEpisode(episode) && isPlaying ? 'pause' : 'play'"
                      :size="16"
                    />
                  </button>

                  <template v-if="getEpisodeStatus(episode).played">
                    <button
                      v-if="allowPlayedResubmit"
                      :disabled="submitting"
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-primary-hover hover:bg-primary text-text-primary text-xs sm:text-xs font-bold disabled:opacity-50 transition-all active:scale-95 shrink-0 uppercase tracking-wider shadow-lg shadow-[var(--primary-glow)]"
                      @click.stop="selectEpisode(episode)"
                    >
                      <span v-if="submitting && selectedEpisodeCid === episode.cid">{{ locale.submitting }}</span>
                      <span v-else><span class="hidden sm:inline">{{ locale.select }}</span>{{ locale.submit }}</span>
                    </button>
                    <!-- 已播放标签 -->
                    <div
                      v-else
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-success-10 text-success border border-success-20 text-xs sm:text-xs font-bold shrink-0 uppercase tracking-wider"
                    >
                      {{ locale.played }}
                    </div>
                  </template>

                  <template v-else-if="getEpisodeStatus(episode).scheduled">
                    <!-- 已排期标签 -->
                    <div
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-warning-10 text-warning border border-warning-20 text-xs sm:text-xs font-bold shrink-0 uppercase tracking-wider"
                    >
                      {{ locale.scheduled }}
                    </div>
                  </template>

                  <template v-else-if="getEpisodeStatus(episode).submitted">
                    <div class="flex flex-col gap-2 items-center">
                      <!-- 已投稿标签 -->
                      <div
                        class="w-full text-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-bg-tertiary text-text-tertiary text-xs sm:text-xs font-bold shrink-0 uppercase tracking-wider"
                      >
                        {{ locale.submitted }}
                      </div>

                      <!-- 点赞按钮（非自己投稿） -->
                      <button
                        v-if="!isMyEpisode(episode)"
                        :disabled="getEpisodeStatus(episode).voted || submitting"
                        :class="[
                          'w-full px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-xs font-bold shrink-0 uppercase tracking-wider transition-all active:scale-95',
                          getEpisodeStatus(episode).voted
                            ? 'bg-error-10 text-error border border-error-20 cursor-not-allowed'
                            : 'bg-bg-tertiary hover:bg-bg-quaternary text-text-tertiary hover:text-error'
                        ]"
                        @click.stop="voteEpisode(episode)"
                      >
                        <span class="flex items-center justify-center gap-1">
                          <Icon
                            name="heart"
                            :size="12"
                            :class="getEpisodeStatus(episode).voted ? 'fill-current' : ''"
                          />
                          <span>{{ getEpisodeStatus(episode).voted ? locale.liked : locale.like }}</span>
                        </span>
                      </button>
                    </div>
                  </template>

                  <template v-else>
                    <!-- 选择投稿按钮（未投稿） -->
                    <button
                      :disabled="submitting"
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-primary-hover hover:bg-primary text-text-primary text-xs sm:text-xs font-bold disabled:opacity-50 transition-all active:scale-95 shrink-0 uppercase tracking-wider shadow-lg shadow-[var(--primary-glow)]"
                      @click.stop="selectEpisode(episode)"
                    >
                      <span v-if="submitting && selectedEpisodeCid === episode.cid">{{ locale.submitting }}</span>
                      <span v-else><span class="hidden sm:inline">{{ locale.select }}</span>{{ locale.submit }}</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>
  </AppModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from '~/components/UI/Icon.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { useLocale } from '~/utils/locale'

const { songs } = useLocale()
const locale = computed(() => songs.value?.bilibiliEpisodesModal || {})

const props = defineProps({
  show: Boolean,
  video: Object,
  episodes: {
    type: Array,
    default: () => []
  },
  submittedEpisodes: {
    type: Array,
    default: () => []
  },
  currentUserId: {
    type: Number,
    default: null
  },
  allowPlayedResubmit: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit', 'play', 'vote'])

const { getCurrentSong, getPlayingStatus, pauseSong } = useAudioPlayer()
const currentSong = getCurrentSong()
const isPlaying = getPlayingStatus()

const submitting = ref(false)
const selectedEpisodeCid = ref(null)

// 计算已投稿状态
const submittedCount = computed(() => props.submittedEpisodes.length)
const totalEpisodes = computed(() => props.episodes.length)

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const isCurrentEpisode = (episode) => {
  if (!currentSong.value) return false
  
  if (!isBilibiliSong(currentSong.value)) return false

  // 检查 CID
  if (
    currentSong.value.bilibiliCid &&
    String(currentSong.value.bilibiliCid) === String(episode.cid)
  ) {
    return true
  }

  // 兼容逻辑：检查 musicId 格式是否为 bvid:cid
  if (currentSong.value.musicId && currentSong.value.musicId.includes(':')) {
    const [, cid] = currentSong.value.musicId.split(':')
    return cid === String(episode.cid)
  }

  return false
}

// 获取 episode 的完整状态（包括 voted）
const getEpisodeStatus = (episode) => {
  const submittedSong = props.submittedEpisodes.find((song) => {
    if (!song.musicId) return false
    const cid = song.musicId.includes(':') ? song.musicId.split(':')[1] : null
    return cid === String(episode.cid)
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
    played: episode.played || false,
    scheduled: episode.scheduled || false
  }
}

const isMyEpisode = (episode) => {
  if (!props.currentUserId) return false

  // 使用 getEpisodeStatus 获取统一的状态信息，避免直接修改 props
  const status = getEpisodeStatus(episode)
  return status.requesterId === props.currentUserId
}

const togglePlay = (episode) => {
  if (isCurrentEpisode(episode) && isPlaying.value) {
    pauseSong()
  } else {
    playEpisode(episode)
  }
}

const playEpisode = (episode) => {
  const episodeData = {
    ...episode,
    cover: props.video?.cover,
    bvid: props.video?.id,
    title: props.video?.title,
    artist: props.video?.artist
  }

  // 构建所有分P的播放列表
  const playlist = props.episodes.map(e => ({
    ...e,
    cover: props.video?.cover,
    bvid: props.video?.id,
    title: props.video?.title,
    artist: props.video?.artist,
    musicPlatform: 'bilibili',
    musicId: props.video?.id,
    bilibiliCid: e.cid
  }))
  const currentIndex = playlist.findIndex(e => e.cid === episode.cid)

  emit('play', { song: episodeData, playlist, playlistIndex: currentIndex })
}

const selectEpisode = (episode) => {
  const status = getEpisodeStatus(episode)
  if (submitting.value || (status.submitted && !(props.allowPlayedResubmit && status.played))) return
  submitting.value = true
  selectedEpisodeCid.value = episode.cid
  emit('submit', { episode, status })
}

const voteEpisode = (episode) => {
  if (submitting.value) {
    return
  }

  // 使用 getEpisodeStatus 获取统一的状态信息，避免重复查找
  const { songId, voted } = getEpisodeStatus(episode)

  if (!songId || voted) {
    return
  }

  emit('vote', { ...episode, songId })
}

const close = () => {
  emit('close')
  // 重置状态
  submitting.value = false
  selectedEpisodeCid.value = null
}

// 暴露方法给父组件，用于在提交失败时重置状态
const resetSubmissionState = () => {
  submitting.value = false
  selectedEpisodeCid.value = null
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
  background-color: var(--overlay-10);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: var(--overlay-20);
}
</style>
