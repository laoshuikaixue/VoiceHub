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
        class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div
          class="w-full max-w-3xl bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <!-- 头部 -->
          <div class="p-6 pb-4 flex items-center justify-between gap-4 border-b border-border-secondary-50 shrink-0">
            <div class="min-w-0">
              <h3
                class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3"
              >
                <span
                  class="w-10 h-10 rounded-xl bg-primary-hover-10 flex items-center justify-center text-primary shrink-0"
                >
                  <Copy :size="20" />
                </span>
                {{ t('duplicateModal.title') }}
              </h3>
              <p v-if="groups.length" class="text-xs text-text-tertiary mt-2 ml-13">
                {{ t('duplicateModal.subtitle', '', groups.length, songCount) }}
              </p>
            </div>
            <button
              class="flex items-center justify-center p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all shrink-0"
              @click="closeModal"
            >
              <X :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <p
              v-if="groups.length"
              class="text-[10px] font-bold text-text-disabled mb-4 px-1 leading-relaxed"
            >
              {{ t('duplicateModal.matchHint') }}
            </p>

            <div v-else class="flex flex-col items-center justify-center py-16 text-text-disabled">
              <Music :size="48" class="mb-4 opacity-20" />
              <p class="text-sm font-bold">{{ t('duplicateModal.empty') }}</p>
              <p class="text-[11px] mt-2 max-w-sm text-center leading-relaxed">
                {{ t('duplicateModal.matchHint') }}
              </p>
            </div>

            <div v-if="groups.length" class="space-y-4">
              <div
                v-for="group in groups"
                :key="group.key"
                class="border border-border-secondary-60 rounded-xl overflow-hidden bg-bg-primary-30"
              >
                <!-- 分组标题：重复的歌曲本身 -->
                <div class="flex items-center gap-3 px-4 py-3 bg-bg-secondary-40">
                  <div class="min-w-0 flex-1">
                    <h4 class="text-sm font-black text-text-primary truncate">{{ group.title }}</h4>
                    <p class="text-[11px] text-text-tertiary truncate mt-0.5">{{ group.artist }}</p>
                  </div>
                  <span
                    class="shrink-0 px-2 py-1 text-[10px] font-black rounded-md uppercase tracking-wider bg-primary-10 text-primary"
                  >
                    {{ t('duplicateModal.dupCount', '', group.songs.length) }}
                  </span>
                  <span
                    :class="[
                      'hidden sm:inline-block shrink-0 px-2 py-1 text-[10px] font-black rounded-md uppercase tracking-wider',
                      group.sameSource ? 'bg-success-10 text-success' : 'bg-warning-10 text-warning'
                    ]"
                  >
                    {{ group.sameSource ? t('duplicateModal.sameSource') : t('duplicateModal.diffSource') }}
                  </span>
                </div>

                <!-- 组内每首歌曲 -->
                <div
                  v-for="song in group.songs"
                  :key="song.id"
                  class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-t border-border-secondary-40"
                >
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      class="w-10 h-10 rounded-lg bg-bg-tertiary-40 border border-border-tertiary-30 flex items-center justify-center overflow-hidden shrink-0"
                    >
                      <img
                        v-if="song.cover"
                        :src="convertToHttps(song.cover)"
                        class="w-full h-full object-cover"
                        referrerpolicy="no-referrer"
                      />
                      <Music v-else :size="16" class="text-text-disabled" />
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-text-primary truncate max-w-[140px]">{{
                          song.requester || t('unknown')
                        }}</span>
                        <span
                          class="px-1.5 py-0.5 text-[9px] font-black rounded bg-bg-tertiary text-text-disabled tracking-wider"
                          >ID {{ song.id }}</span
                        >
                        <span
                          :class="[
                            'px-1.5 py-0.5 text-[9px] font-black rounded uppercase tracking-wider',
                            song.played
                              ? 'bg-success-10 text-success'
                              : song.scheduled
                                ? 'bg-primary-10 text-primary'
                                : 'bg-bg-tertiary text-text-tertiary'
                          ]"
                          >{{ statusText(song) }}</span
                        >
                      </div>
                      <div
                        class="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-text-tertiary"
                      >
                        <span>{{ formatDate(song.createdAt) }}</span>
                        <span v-if="song.semester">{{ song.semester }}</span>
                        <span v-if="song.preferredPlayTime?.name">{{ song.preferredPlayTime.name }}</span>
                        <span v-if="song.durationSeconds">{{ formatDuration(song.durationSeconds) }}</span>
                        <span v-if="song.voteCount" class="inline-flex items-center gap-1 text-color-pink">
                          <Heart :size="11" class="fill-color-pink-alpha-20" />{{ song.voteCount }}
                        </span>
                        <span v-if="song.musicPlatform" class="truncate max-w-[220px]">
                          {{ platformLabel(song.musicPlatform) }}<template v-if="song.musicId"> · {{ song.musicId }}</template>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 sm:ml-auto">
                    <button
                      class="flex items-center justify-center p-2 bg-bg-tertiary-50 text-primary hover:bg-primary-hover hover:text-text-primary rounded-xl transition-all border border-border-tertiary-30"
                      :title="t('actions.edit')"
                      @click="emit('edit-song', song)"
                    >
                      <Edit2 :size="14" />
                    </button>
                    <button
                      class="flex items-center justify-center p-2 bg-bg-tertiary-50 text-error hover:bg-error hover:text-text-primary rounded-xl transition-all border border-border-tertiary-30"
                      :title="t('actions.deleteSong')"
                      @click="emit('delete-song', song.id)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部 -->
          <div
            class="p-6 border-t border-border-secondary-50 bg-bg-secondary-50 flex items-center justify-end shrink-0"
          >
            <button
              class="px-6 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-xl transition-all uppercase tracking-widest"
              @click="closeModal"
            >
              {{ commonLocale.close }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { Copy, X, Music, Heart, Edit2, Trash2 } from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { useLocaleText } from '~/composables/useLocaleText'
import { getPlatformDisplayName } from '~/utils/platforms'
import { convertToHttps } from '~/utils/url'
import { formatDuration } from '~/utils/timeUtils'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  // 形如 [{ key, title, artist, sameSource, songs: [] }]，由父组件按当前筛选结果分组
  groups: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'edit-song', 'delete-song'])

const { admin, common, siteConfig, currentLocale } = useLocale()
const commonLocale = computed(() => common.value || {})
const { t } = useLocaleText(computed(() => admin.value?.songManagement || {}))

const songCount = computed(() =>
  props.groups.reduce((total, group) => total + group.songs.length, 0)
)

const closeModal = () => emit('close')

const statusText = (song) => {
  if (song.played) return t('options.played')
  if (song.scheduled) return t('options.scheduled')
  return t('options.pending')
}

const platformLabel = (platform) => getPlatformDisplayName(platform, siteConfig.value, currentLocale.value)

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(currentLocale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
/* 列表自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--text-muted);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: var(--text-muted);
}
</style>
