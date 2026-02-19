<template>
  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      @click="handleOverlayClick"
    >
      <!-- 遮罩层 -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <!-- 模态框面板 -->
      <transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div
          v-if="show"
          class="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm"
          >
            <h3 class="text-lg font-semibold text-white">用户歌曲信息</h3>
            <button
              class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              @click="$emit('close')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 18 12" />
              </svg>
            </button>
          </div>

          <!-- 主体内容 -->
          <div class="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-900">
            <!-- 加载状态 -->
            <div v-if="loading" class="flex-1 flex flex-col items-center justify-center">
              <LoadingState message="加载数据中..." spinner-type="circle" />
            </div>

            <!-- 错误状态 -->
            <div
              v-else-if="error"
              class="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-4"
            >
              <div class="text-4xl">⚠️</div>
              <p>{{ error }}</p>
              <button
                class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                @click="retryFetch"
              >
                重试
              </button>
            </div>

            <!-- 内容 -->
            <div v-else-if="userSongs" class="flex-1 flex flex-col min-h-0">
              <!-- 用户信息头部 -->
              <div class="px-6 py-4 bg-zinc-900 border-b border-zinc-800">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-3">
                    <h4 class="text-base font-medium text-white">{{ userSongs.user.name }}</h4>
                    <span class="text-sm text-zinc-500 font-mono">{{
                      userSongs.user.username
                    }}</span>
                  </div>
                  <p
                    v-if="userSongs.user.grade || userSongs.user.class"
                    class="text-sm text-zinc-400"
                  >
                    {{ userSongs.user.grade || '' }} {{ userSongs.user.class || '' }}
                  </p>
                </div>
              </div>

              <!-- 工具栏 (标签页 + 过滤) -->
              <div
                class="flex flex-col sm:flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900/50"
              >
                <!-- 标签页 -->
                <div class="flex w-full sm:w-auto overflow-x-auto no-scrollbar">
                  <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    class="relative px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
                    :class="
                      activeTab === tab.id
                        ? 'text-blue-500'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    "
                    @click="activeTab = tab.id"
                  >
                    {{ tab.label }}
                    <span
                      class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                      :class="
                        activeTab === tab.id
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-zinc-800 text-zinc-500'
                      "
                    >
                      {{ getTabCount(tab.id) }}
                    </span>
                    <!-- 激活指示器 -->
                    <div
                      v-if="activeTab === tab.id"
                      class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                    />
                  </button>
                </div>

                <!-- 学期过滤器 -->
                <div
                  class="w-full sm:w-auto px-4 py-2 border-t sm:border-t-0 sm:border-l border-zinc-800 flex items-center gap-3 bg-zinc-900/30"
                >
                  <CustomSelect
                    v-model="selectedSemester"
                    :options="[{ label: '全部学期', value: null }, ...semesterOptions]"
                    label="学期过滤"
                    placeholder="全部学期"
                    class-name="w-full sm:w-48"
                  />
                </div>
              </div>

              <!-- 歌曲列表 -->
              <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                <div
                  v-if="filteredSongs.length === 0"
                  class="flex flex-col items-center justify-center py-20 text-zinc-500"
                >
                  <div class="text-5xl mb-4 opacity-50">{{ activeTabIcon }}</div>
                  <p>没有找到相关记录</p>
                </div>

                <div
                  v-for="song in filteredSongs"
                  :key="song.id"
                  class="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-800/20 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200"
                >
                  <!-- 歌曲信息 -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h5 class="text-sm font-medium text-white truncate">{{ song.title }}</h5>
                      <span
                        v-if="song.semester"
                        class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700"
                      >
                        {{ song.semester }}
                      </span>
                    </div>
                    <div class="text-sm text-zinc-400 truncate">{{ song.artist }}</div>

                    <!-- Meta Info (Mobile) -->
                    <div
                      class="flex flex-wrap items-center gap-3 mt-3 sm:hidden text-xs text-zinc-500"
                    >
                      <span>{{ getMetaTime(song) }}</span>
                      <span v-if="song.voteCount !== undefined">{{ song.voteCount }} 票</span>
                      <span v-if="song.requestCount !== undefined"
                        >{{ song.requestCount }} 人申请</span
                      >
                    </div>
                  </div>

                  <!-- 状态与元数据 (桌面端) -->
                  <div class="flex items-center gap-4 sm:gap-6">
                    <!-- 状态标签 -->
                    <div class="flex-shrink-0">
                      <span
                        class="px-2.5 py-1 rounded-full text-xs font-medium border"
                        :class="getStatusClasses(song)"
                      >
                        {{ getStatusText(song) }}
                      </span>
                    </div>

                    <!-- Meta Info (Desktop) -->
                    <div class="hidden sm:flex flex-col items-end gap-0.5 min-w-[100px]">
                      <span class="text-xs text-zinc-400">{{ getMetaTime(song) }}</span>
                      <div class="flex items-center gap-2">
                        <span v-if="song.voteCount !== undefined" class="text-xs text-zinc-500"
                          >{{ song.voteCount }} 票</span
                        >
                        <span v-if="song.requestCount !== undefined" class="text-xs text-zinc-500"
                          >{{ song.requestCount }} 人申请</span
                        >
                      </div>
                    </div>

                    <!-- Submitter Info (if available) -->
                    <div v-if="song.requester" class="hidden sm:block text-right min-w-[80px]">
                      <div class="text-xs text-zinc-300">{{ song.requester.name }}</div>
                      <div class="text-[10px] text-zinc-500">
                        {{ song.requester.grade }}{{ song.requester.class }}
                      </div>
                    </div>
                  </div>

                  <!-- 投稿人信息 (移动端) -->
                  <div
                    v-if="song.requester"
                    class="sm:hidden pt-3 mt-1 border-t border-zinc-800/50 flex justify-between items-center text-xs"
                  >
                    <span class="text-zinc-500">投稿人:</span>
                    <span class="text-zinc-300">
                      {{ song.requester.name }}
                      <span class="text-zinc-500 ml-1">
                        {{ song.requester.grade }}{{ song.requester.class }}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSemesters } from '~/composables/useSemesters'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import LoadingState from '~/components/UI/Common/LoadingState.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  userId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close'])

// Data
const loading = ref(false)
const error = ref('')
const userSongs = ref(null)
const activeTab = ref('submitted')
const selectedSemester = ref(null)

// Composables
const { semesters, fetchSemesterOptions } = useSemesters()

// Computed
const semesterOptions = computed(() => {
  return semesters.value.map((s) => ({
    label: s.name,
    value: s.name
  }))
})

const tabs = [
  { id: 'submitted', label: '投稿歌曲' },
  { id: 'voted', label: '投票歌曲' },
  { id: 'replay', label: '重播申请' }
]

const activeTabIcon = computed(() => {
  switch (activeTab.value) {
    case 'submitted':
      return '🎵'
    case 'voted':
      return '❤️'
    case 'replay':
      return '🔁'
    default:
      return '📄'
  }
})

const currentSongs = computed(() => {
  if (!userSongs.value) return []
  switch (activeTab.value) {
    case 'submitted':
      return userSongs.value.submittedSongs || []
    case 'voted':
      return userSongs.value.votedSongs || []
    case 'replay':
      return userSongs.value.replayRequestedSongs || []
    default:
      return []
  }
})

const filteredSongs = computed(() => {
  let songs = currentSongs.value

  if (selectedSemester.value) {
    songs = songs.filter((song) => song.semester === selectedSemester.value)
  }

  return songs
})

// Methods
const getTabCount = (tabId) => {
  if (!userSongs.value) return 0

  let songs = []
  switch (tabId) {
    case 'submitted':
      songs = userSongs.value.submittedSongs || []
      break
    case 'voted':
      songs = userSongs.value.votedSongs || []
      break
    case 'replay':
      songs = userSongs.value.replayRequestedSongs || []
      break
    default:
      return 0
  }

  if (selectedSemester.value) {
    songs = songs.filter((song) => song.semester === selectedSemester.value)
  }

  return songs.length
}

const fetchUserSongs = async () => {
  if (!props.userId) return

  loading.value = true
  error.value = ''

  try {
    const auth = useAuth()

    // 并行获取歌曲数据和学期列表
    const promises = [$fetch(`/api/admin/users/${props.userId}/songs`, { ...auth.getAuthConfig() })]

    // 如果学期列表为空，尝试获取
    if (semesters.value.length === 0) {
      promises.push(fetchSemesterOptions())
    }

    const [songsResponse] = await Promise.all(promises)
    userSongs.value = songsResponse
  } catch (err) {
    console.error('获取用户歌曲信息失败:', err)
    error.value = err.data?.message || '获取用户歌曲信息失败'
  } finally {
    loading.value = false
  }
}

const retryFetch = () => {
  fetchUserSongs()
}

const handleOverlayClick = () => {
  emit('close')
}

// Helpers
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getMetaTime = (song) => {
  if (activeTab.value === 'submitted') return formatDate(song.createdAt)
  if (activeTab.value === 'voted') return `${formatDate(song.votedAt)} 投票`
  if (activeTab.value === 'replay') return `${formatDate(song.requestedAt)} 申请`
  return ''
}

const getStatusText = (song) => {
  if (song.played) return '已播放'
  if (song.scheduled) return '已排期'
  return '待排期'
}

const getStatusClasses = (song) => {
  if (song.played) {
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  }
  if (song.scheduled) {
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  }
  return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
}

// 监听器
watch(
  () => props.userId,
  (newUserId) => {
    if (newUserId && props.show) {
      fetchUserSongs()
    }
  }
)

watch(
  () => props.show,
  (newShow) => {
    if (newShow && props.userId) {
      fetchUserSongs()
    } else if (!newShow) {
      // 关闭时重置状态
      userSongs.value = null
      error.value = ''
      activeTab.value = 'submitted'
      selectedSemester.value = null // 可选：关闭时重置过滤器
    }
  }
)
</script>

<style scoped>
/* 列表的自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(113, 113, 122, 0.3); /* zinc-500/30 */
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(113, 113, 122, 0.5);
}

/* 标签页隐藏滚动条 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
