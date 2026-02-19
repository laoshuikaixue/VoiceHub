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
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      @click="$emit('close')"
    >
      <div
        class="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        @click.stop
      >
        <!-- 头部 -->
        <div class="p-8 pb-4 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500"
              >
                <Icon name="alert-triangle" :size="20" />
              </div>
              歌曲已存在
            </h3>
            <p class="text-xs text-zinc-500 mt-1 ml-13">这首歌曲已经在列表中了，不能重复投稿</p>
          </div>
          <button
            class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
            @click="$emit('close')"
          >
            <Icon name="x" :size="20" />
          </button>
        </div>

        <div class="p-8 pt-4 space-y-6">
          <p class="text-sm text-zinc-400 leading-relaxed font-medium">
            您可以为它点赞支持，或者尝试搜索其他歌曲！
          </p>

          <!-- 歌曲卡片 -->
          <div
            class="flex gap-4 p-5 bg-zinc-950 border border-zinc-800 rounded-3xl group shadow-xl"
          >
            <div
              class="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800"
            >
              <img
                v-if="song.cover"
                :alt="song.title"
                :src="convertToHttps(song.cover)"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              >
              <div v-else class="w-full h-full flex items-center justify-center text-zinc-700">
                <Icon name="music" :size="32" />
              </div>
            </div>

            <div class="flex-1 min-w-0 py-1">
              <h4 class="text-base font-black text-zinc-100 truncate mb-1">{{ song.title }}</h4>
              <p
                class="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate mb-3"
              >
                {{ song.artist }}
              </p>

              <div class="flex items-center gap-4">
                <div
                  class="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest"
                >
                  <Icon name="heart" :size="12" class="fill-current" />
                  {{ song.voteCount || 0 }} 票
                </div>
                <div
                  :class="[
                    'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border',
                    song.played
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  ]"
                >
                  {{ song.played ? '已播放' : '待播放' }}
                </div>
              </div>
              <p class="text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-2">
                投稿者：{{ song.requester }}
              </p>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-8 pt-0 flex gap-3">
          <button
            class="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest active:scale-95"
            @click="$emit('close')"
          >
            返回重选
          </button>
          <button
            :disabled="liking || song.voted"
            class="flex-[2] px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            @click="handleLike"
          >
            <Icon v-if="liking" name="loader" :size="16" class="animate-spin" />
            <Icon v-else name="heart" :size="16" :class="[song.voted ? 'fill-current' : '']" />
            {{ song.voted ? '已点赞' : '立即点赞' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import type { Song } from '~/types'
import { convertToHttps } from '~/utils/url'
import Icon from '~/components/UI/Icon.vue'

interface Props {
  show: boolean
  song: Song
}

const props = defineProps<Props>()

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
