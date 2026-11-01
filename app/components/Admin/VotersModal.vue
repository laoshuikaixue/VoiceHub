<template>
  <AppModal
    :description="songInfo?.title || ''"
    :show="show"
    :title="locale.title"
    size="xl"
    @close="closeModal"
  >
    <template #icon>
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-hover-10 text-primary"
      >
        <Icon name="users" :size="18" />
      </span>
    </template>

            <!-- 歌曲信息 -->
            <div
              v-if="songInfo"
              class="mb-5 p-5 bg-bg-primary-50 border border-border-secondary-50 rounded-xl"
            >
              <div class="flex items-start gap-4">
                <div
                  class="w-11 h-11 rounded-xl bg-error-10 flex items-center justify-center text-error shrink-0"
                >
                  <Icon name="music" :size="20" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-base font-bold text-text-primary truncate">
                    {{ songInfo.title }}
                  </h4>
                  <p class="text-xs text-text-tertiary mt-1 truncate">{{ songInfo.artist }}</p>
                </div>
                <div
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-error-10 border border-error-20 rounded-full text-error shrink-0"
                >
                  <Icon name="heart" :size="12" class="fill-current" />
                  <span class="text-xs font-bold">{{
                    formatLocale(locale.votes, totalVotes)
                  }}</span>
                </div>
              </div>
            </div>

            <!-- 加载状态 -->
            <LoadingState v-if="loading" :message="locale.loading" spinner-type="circle" />

            <!-- 错误状态 -->
            <div
              v-else-if="error"
              class="flex flex-col items-center justify-center py-16 text-center px-8"
            >
              <div
                class="w-16 h-16 rounded-2xl bg-error-10 flex items-center justify-center text-error mb-4"
              >
                <Icon name="alert-triangle" :size="32" />
              </div>
              <p class="text-sm text-text-tertiary mb-6">{{ error }}</p>
              <button
                class="px-6 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-primary text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
                @click="fetchVoters"
              >
                {{ commonLocale.retry }}
              </button>
            </div>

            <!-- 投票人员列表 -->
            <div v-else-if="voters.length > 0">
              <div class="flex items-center justify-between mb-3 px-1">
                <div
                  class="flex items-center gap-2 text-xs font-bold text-text-tertiary uppercase tracking-wider"
                >
                  <Icon name="users" :size="12" class="text-primary" />
                  {{ formatLocale(locale.voters, voters.length) }}
                </div>
                <div class="text-xs font-bold text-text-disabled uppercase tracking-wider">
                  {{ formatLocale(locale.votes, totalVotes) }}
                </div>
              </div>

              <div class="space-y-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                <div
                  v-for="(voter, index) in voters"
                  :key="voter.id"
                  class="flex items-center gap-4 p-3 rounded-xl border border-transparent hover:bg-bg-tertiary-50 hover:border-border-secondary transition-all"
                >
                  <div
                    class="w-10 h-10 rounded-xl bg-bg-tertiary border border-border-secondary flex items-center justify-center text-text-secondary text-sm font-bold shrink-0"
                  >
                    {{ getAvatarText(voter.name) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-text-primary truncate">
                      {{ voter.name }}
                    </div>
                    <div
                      class="flex items-center gap-1.5 text-xs text-text-disabled mt-0.5 font-medium"
                    >
                      <Icon name="clock" :size="11" />
                      {{ formatVoteTime(voter.votedAt) }}
                    </div>
                  </div>
                  <div
                    class="text-xs font-bold text-text-disabled px-2 py-1 bg-bg-tertiary rounded-lg shrink-0"
                  >
                    #{{ index + 1 }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 无投票状态 -->
            <div v-else class="flex flex-col items-center justify-center py-16 text-text-disabled">
              <Icon name="heart" :size="48" class="mb-4 opacity-20" />
              <p class="text-sm font-bold">{{ locale.empty }}</p>
            </div>

    <template #footer>
      <div class="flex items-center justify-end">

            <button
              class="px-6 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
              @click="closeModal"
            >
              {{ commonLocale.close }}
            </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from '~/components/UI/Icon.vue'
import LoadingState from '~/components/UI/Common/LoadingState.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  songId: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['close'])

// 响应式数据
const loading = ref(false)
const error = ref('')
const songInfo = ref(null)
const voters = ref([])
const totalVotes = ref(0)
const { common, currentLocale } = useLocale()
const commonLocale = computed(() => common.value || {})
const locale = computed(() => common.value?.votersModal || {})
const { localize: localizeServerError } = useServerErrors()

// 方法
const closeModal = () => {
  emit('close')
}

const fetchVoters = async () => {
  if (!props.songId) return

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch(`/api/songs/${props.songId}/voters`)

    songInfo.value = response.song
    voters.value = response.voters || []
    totalVotes.value = response.totalVotes || 0
  } catch (err) {
    console.error('获取投票人员失败:', err)
    error.value = localizeServerError(err, locale.value.fetchFailed)
  } finally {
    loading.value = false
  }
}

const getAvatarText = (name) => {
  if (!name) return '?'
  // 提取中文姓名的最后一个字符，或英文名的首字母
  const cleanName = name.replace(/[（(].*[）)]/, '').trim()
  return cleanName.slice(-1).toUpperCase()
}

const formatTimeAgo = (key, value) => {
  const message = commonLocale.value?.time?.[key]
  if (typeof message === 'function') return message(value)
  if (typeof message === 'string')
    return message.replace(/{(\d+)}/g, (match, index) => (index === '0' ? String(value) : match))
  return ''
}

const formatVoteTime = (dateString) => {
  const date = new Date(dateString)
  const now = getSyncedDate()
  const diff = now - date

  if (diff < 60000) return commonLocale.value?.time?.justNow || ''
  if (diff < 3600000) return formatTimeAgo('minutesAgo', Math.floor(diff / 60000))
  if (diff < 86400000) return formatTimeAgo('hoursAgo', Math.floor(diff / 3600000))
  if (diff < 604800000) return formatTimeAgo('daysAgo', Math.floor(diff / 86400000))

  return date.toLocaleDateString(currentLocale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 监听弹窗显示状态
watch(
  () => props.show,
  (newShow) => {
    if (newShow && props.songId) {
      fetchVoters()
    } else {
      // 重置数据
      songInfo.value = null
      voters.value = []
      totalVotes.value = 0
      error.value = ''
    }
  }
)
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
