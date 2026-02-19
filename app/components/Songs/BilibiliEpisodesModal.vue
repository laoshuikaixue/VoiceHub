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
              <div class="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-zinc-800">
                <img
                  v-if="video?.cover"
                  :src="video.cover"
                  :alt="video.title"
                  class="w-full h-full object-cover"
                  referrerpolicy="no-referrer"
                >
                <div
                  v-else
                  class="w-full h-full bg-blue-600/10 flex items-center justify-center text-blue-500"
                >
                  <Icon name="play" :size="24" />
                </div>
              </div>
              <div class="min-w-0">
                <h3 class="text-xl font-black text-zinc-100 tracking-tight truncate">
                  {{ video?.title }}
                </h3>
                <p class="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
                  UP主：{{ video?.artist }}
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

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
            <div
              v-if="episodes.length === 0"
              class="flex flex-col items-center justify-center py-12 text-zinc-500"
            >
              <div
                class="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-4"
              >
                <Icon name="play" :size="32" class="opacity-20" />
              </div>
              <p class="text-sm font-bold uppercase tracking-widest">暂无剧集</p>
            </div>

            <div v-else class="program-list space-y-3">
              <div
                v-for="episode in episodes"
                :key="episode.cid"
                class="group flex items-center p-3 sm:p-4 rounded-3xl transition-all"
                :class="[
                  isCurrentEpisode(episode)
                    ? 'bg-blue-600/10 border border-blue-500/50'
                    : 'bg-zinc-800/30 border border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700'
                ]"
              >
                <!-- 剧集编号 -->
                <div
                  class="w-8 h-8 sm:w-12 sm:h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 font-black text-xs sm:text-sm flex-shrink-0 mr-3 sm:mr-4 group-hover:text-zinc-300 transition-colors"
                >
                  P{{ episode.page }}
                </div>

                <!-- 剧集信息 -->
                <div class="flex-1 min-w-0">
                  <h4
                    class="font-bold text-zinc-100 text-sm sm:text-base whitespace-normal sm:whitespace-nowrap sm:truncate line-clamp-2 sm:line-clamp-none group-hover:text-white transition-colors"
                  >
                    {{ episode.part }}
                  </h4>
                  <div
                    class="flex items-center gap-3 mt-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider"
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
                    class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-all active:scale-95"
                    :title="isCurrentEpisode(episode) && isPlaying ? '暂停' : '预听'"
                    @click.stop="togglePlay(episode)"
                  >
                    <Icon
                      :name="isCurrentEpisode(episode) && isPlaying ? 'pause' : 'play'"
                      :size="16"
                    />
                  </button>

                  <template v-if="getEpisodeStatus(episode).played">
                    <!-- 已播放标签 -->
                    <div
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest"
                    >
                      已播放
                    </div>
                  </template>

                  <template v-else-if="getEpisodeStatus(episode).scheduled">
                    <!-- 已排期标签 -->
                    <div
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest"
                    >
                      已排期
                    </div>
                  </template>

                  <template v-else-if="getEpisodeStatus(episode).submitted">
                    <div class="flex flex-col gap-2 items-center">
                      <!-- 已投稿标签 -->
                      <div
                        class="w-full text-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-800 text-zinc-500 text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest"
                      >
                        已投稿
                      </div>

                      <!-- 点赞按钮（非自己投稿） -->
                      <button
                        v-if="!isMyEpisode(episode)"
                        :disabled="getEpisodeStatus(episode).voted || submitting"
                        :class="[
                          'w-full px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black shrink-0 uppercase tracking-widest transition-all active:scale-95',
                          getEpisodeStatus(episode).voted
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20 cursor-not-allowed'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-500'
                        ]"
                        @click.stop="voteEpisode(episode)"
                      >
                        <span class="flex items-center justify-center gap-1">
                          <Icon
                            name="heart"
                            :size="12"
                            :class="getEpisodeStatus(episode).voted ? 'fill-current' : ''"
                          />
                          <span>{{ getEpisodeStatus(episode).voted ? '已点赞' : '点赞' }}</span>
                        </span>
                      </button>
                    </div>
                  </template>

                  <template v-else>
                    <!-- 选择投稿按钮（未投稿） -->
                    <button
                      :disabled="submitting"
                      class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black disabled:opacity-50 transition-all active:scale-95 shrink-0 uppercase tracking-widest shadow-lg shadow-blue-900/20"
                      @click.stop="selectEpisode(episode)"
                    >
                      <span v-if="submitting && selectedEpisodeCid === episode.cid">提交中...</span>
                      <span v-else><span class="hidden sm:inline">选择</span>投稿</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

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
  if (currentSong.value.musicPlatform !== 'bilibili') return false

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

const isEpisodeSubmitted = (episode) => {
  return props.submittedEpisodes.some((song) => {
    if (!song.musicId) return false
    const cid = song.musicId.includes(':') ? song.musicId.split(':')[1] : null
    return cid === String(episode.cid)
  })
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
  emit('play', episodeData)
}

const selectEpisode = (episode) => {
  if (submitting.value || isEpisodeSubmitted(episode)) return
  submitting.value = true
  selectedEpisodeCid.value = episode.cid
  emit('submit', episode)
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
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
