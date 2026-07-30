<template>
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
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      @click="$emit('close')"
    >
      <div
        class="bg-bg-secondary border border-border-secondary w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        @click.stop
      >
        <!-- 头部 -->
        <div class="p-8 pb-4 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-2xl bg-warning-10 flex items-center justify-center text-warning"
              >
                <Icon name="alert-triangle" :size="20" />
              </div>
              {{ locale.title }}
            </h3>
            <p class="text-xs text-text-tertiary mt-1 ml-13">{{ locale.desc }}</p>
          </div>
          <button
            class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-2xl transition-all"
            @click="$emit('close')"
          >
            <Icon name="x" :size="20" />
          </button>
        </div>

        <div class="p-8 pt-4 space-y-6">
          <p class="text-sm text-text-tertiary leading-relaxed font-medium">
            {{ locale.tip }}
          </p>

          <!-- 歌曲卡片 -->
          <div
            class="flex gap-4 p-5 bg-bg-primary border border-border-secondary rounded-3xl group shadow-xl"
          >
            <div
              class="w-20 h-20 rounded-2xl overflow-hidden bg-bg-secondary flex-shrink-0 border border-border-secondary"
            >
              <img
                v-if="song.cover"
                :alt="song.title"
                :src="convertToHttps(song.cover)"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              >
              <div v-else class="w-full h-full flex items-center justify-center text-text-secondary">
                <Icon name="music" :size="32" />
              </div>
            </div>

            <div class="flex-1 min-w-0 py-1">
              <h4 class="text-base font-black text-text-primary truncate mb-1">{{ song.title }}</h4>
              <p
                class="text-[10px] font-black uppercase tracking-widest text-text-tertiary truncate mb-3"
              >
                {{ song.artist }}
              </p>

              <div class="flex items-center gap-4">
                <div
                  class="flex items-center gap-1.5 text-[10px] font-black text-error uppercase tracking-widest"
                >
                  <Icon name="heart" :size="12" class="fill-current" />
                  {{ getLocaleMessage('votes', song.voteCount || 0) }}
                </div>
                <div
                  :class="[
                    'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border',
                    song.played
                      ? 'bg-success-10 text-success border-success-20'
                      : 'bg-warning-10 text-warning border-warning-20'
                  ]"
                >
                  {{ song.played ? locale.played : locale.pending }}
                </div>
              </div>
              <p class="text-[10px] text-text-disabled font-black uppercase tracking-widest mt-2">
                {{ locale.requester }}{{ song.requester }}
              </p>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-8 pt-0 flex gap-3">
          <button
            class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest active:scale-95"
            @click="$emit('close')"
          >
            {{ locale.back }}
          </button>
          <button
            :disabled="liking || song.voted"
            class="flex-[2] px-6 py-4 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-2xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            @click="handleLike"
          >
            <Icon v-if="liking" name="loader" :size="16" class="animate-spin" />
            <Icon v-else name="heart" :size="16" :class="[song.voted ? 'fill-current' : '']" />
            {{ song.voted ? locale.liked : locale.likeNow }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { Song } from '~/types'
import { convertToHttps } from '~/utils/url'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'

interface Props {
  show: boolean
  song: Song
}

const props = defineProps<Props>()
const { songs } = useLocale()
const locale = computed(() => songs.value?.duplicateSongModal || {})
const { msg: getLocaleMessage } = useLocaleText(locale)

const emit = defineEmits<{
  close: []
  like: [songId: number]
}>()

const liking = ref(false)

const handleOverlayClick = () => {
  emit('close')
}

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

const handleLike = async () => {
  if (liking.value || props.song.voted) return

  liking.value = true
  try {
    emit('like', props.song.id)
  } finally {
    liking.value = false
  }
}
</script>

<style scoped></style>
