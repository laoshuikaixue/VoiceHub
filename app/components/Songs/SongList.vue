<template>
  <div class="song-list">
    <div class="song-list-header">
      <!-- 移动端搜索栏 -->
      <div class="mobile-search-container mobile-only">
        <div class="search-bar-wrapper">
          <div class="search-icon-box">
            <Icon name="search" :size="18" />
          </div>
          <input
            v-model="searchQuery"
            class="mobile-search-input"
            placeholder="搜索点播记录..."
            type="text"
          >
        </div>

        <div class="mobile-tabs">
          <button
            v-ripple
            :class="{ active: activeTab === 'all' }"
            class="mobile-tab-btn"
            @click="setActiveTab('all')"
          >
            全部投稿
            <div v-if="activeTab === 'all'" class="active-indicator" />
          </button>
          <button
            v-if="isAuthenticated"
            v-ripple
            :class="{ active: activeTab === 'mine' }"
            class="mobile-tab-btn"
            @click="setActiveTab('mine')"
          >
            我的投稿
            <div v-if="activeTab === 'mine'" class="active-indicator" />
          </button>
          <button
            v-if="isAuthenticated"
            v-ripple
            :class="{ active: activeTab === 'replays' }"
            class="mobile-tab-btn"
            @click="setActiveTab('replays')"
          >
            我的重播
            <div v-if="activeTab === 'replays'" class="active-indicator" />
          </button>
        </div>
      </div>

      <!-- 桌面端操作区域 (包含搜索和学期选择) -->
      <div class="desktop-header-content desktop-only">
        <div class="tab-controls">
          <button
            v-ripple
            :class="{ active: activeTab === 'all' }"
            class="tab-button"
            @click="setActiveTab('all')"
          >
            全部投稿
          </button>
          <button
            v-if="isAuthenticated"
            v-ripple
            :class="{ active: activeTab === 'mine' }"
            class="tab-button"
            @click="setActiveTab('mine')"
          >
            我的投稿
          </button>
          <button
            v-if="isAuthenticated"
            v-ripple
            :class="{ active: activeTab === 'replays' }"
            class="tab-button"
            @click="setActiveTab('replays')"
          >
            我的重播
          </button>
        </div>

        <div class="search-actions">
          <div class="search-box">
            <input
              v-model="searchQuery"
              class="search-input"
              placeholder="输入想要搜索的歌曲"
              type="text"
            >
            <span class="search-icon">🔍</span>
          </div>

          <!-- 学期选择器 -->
          <div v-if="availableSemesters.length > 1" class="semester-selector-compact">
            <button
              :title="'当前学期: ' + selectedSemester"
              class="semester-toggle-btn"
              @click="showSemesterDropdown = !showSemesterDropdown"
            >
              <svg
                fill="none"
                height="16"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
              </svg>
            </button>

            <div v-if="showSemesterDropdown" class="semester-dropdown">
              <div
                v-for="semester in availableSemesters"
                :key="semester"
                :class="{ active: selectedSemester === semester }"
                class="semester-option"
                @click="onSemesterChange(semester)"
              >
                {{ semester }}
              </div>
            </div>
          </div>

          <!-- 添加刷新按钮 - 使用SVG图标 -->
          <button
            :disabled="loading"
            :title="loading ? '正在刷新...' : '刷新歌曲列表'"
            class="refresh-button"
            @click="handleRefresh"
          >
            <svg
              :class="{ rotating: loading }"
              class="refresh-icon"
              fill="none"
              height="16"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
              />
            </svg>
          </button>
        </div>
      </div>
      <!-- desktop-header-content -->
    </div>

    <!-- 使用Transition组件包裹所有内容 -->
    <Transition mode="out-in" name="tab-switch">
      <div v-if="loading" :key="'loading'" class="loading">加载中...</div>

      <div v-else-if="error" :key="'error'" class="error">
        {{ error }}
      </div>

      <div v-else-if="displayedSongs.length === 0" :key="'empty-' + activeTab" class="empty">
        {{
          activeTab === 'mine'
            ? '您还没有投稿歌曲，马上去点歌吧！'
            : activeTab === 'replays'
              ? '您还没有申请重播的歌曲，去看看已经播放过的歌吧！'
              : '暂无歌曲，马上去点歌吧！'
        }}
      </div>

      <div v-else :key="'songs-' + activeTab" class="songs-container">
        <TransitionGroup class="song-cards" name="page" tag="div">
          <div
            v-for="song in paginatedSongs"
            :key="song.id"
            :class="{
              played: song.played,
              scheduled: song.scheduled,
              focused: isSongFocused(song.id),
              playing: isCurrentPlaying(song.id)
            }"
            class="song-card"
            @click="handleSongCardClick(song)"
          >
            <!-- 歌曲卡片主体 -->
            <div class="song-card-main">
              <!-- 添加歌曲封面 -->
              <div class="song-cover" @click.stop="togglePlaySong(song)">
                <template v-if="song.cover">
                  <img
                    :alt="song.title"
                    :src="convertToHttps(song.cover)"
                    class="cover-image"
                    referrerpolicy="no-referrer"
                    @error="handleImageError($event, song)"
                  >
                </template>
                <div v-else class="text-cover">
                  {{ getFirstChar(song.title) }}
                </div>
                <!-- 添加播放按钮 (仅桌面端显示) -->
                <div
                  v-if="(song.musicPlatform && song.musicId) || song.playUrl"
                  class="play-button-overlay"
                >
                  <button :title="isCurrentPlaying(song.id) ? '暂停' : '播放'" class="play-button">
                    <Icon v-if="isCurrentPlaying(song.id)" :size="16" color="white" name="pause" />
                    <Icon v-else :size="16" color="white" name="play" />
                  </button>
                </div>
              </div>

              <div class="song-info">
                <h3 :title="song.title + ' - ' + song.artist" class="song-title">
                  <marquee-text
                    :activated="isSongFocused(song.id)"
                    :text="`${song.title} - ${song.artist}`"
                  />
                  <span
                    v-if="song.played"
                    :title="
                      song.scheduleDate
                        ? `播放日期：${formatScheduleDate(song.scheduleDate)}`
                        : '已播放'
                    "
                    class="played-tag"
                  >
                    已播放
                  </span>
                  <span
                    v-else-if="song.scheduled"
                    :title="
                      song.scheduleDate
                        ? `排期日期：${formatScheduleDate(song.scheduleDate)}`
                        : '已排期'
                    "
                    class="scheduled-tag"
                  >
                    已排期
                  </span>
                  <span v-else-if="song.isReplay" title="重播歌曲" class="replay-tag"> 重播 </span>
                  <button
                    v-if="song.hasSubmissionNote && song.submissionNote"
                    class="submission-note-trigger"
                    title="查看备注留言"
                    @click.stop="openSubmissionNote(song)"
                  >
                    <Icon :size="14" name="message-circle" />
                  </button>
                </h3>
                <div class="song-meta">
                  <span
                    :title="
                      (song.collaborators && song.collaborators.length
                        ? '主投稿人: '
                        : '投稿人: ') +
                      song.requester +
                      (song.collaborators && song.collaborators.length
                        ? '\n联合投稿: ' +
                          song.collaborators.map((c) => c.displayName || c.name).join(', ')
                        : '')
                    "
                    class="requester"
                  >
                    <template v-if="song.isReplay">
                      重播申请 ({{ song.replayRequestCount || 0 }})：{{
                        song.replayRequesters
                          ? song.replayRequesters
                              .map((r) => r.name)
                              .slice(0, 3)
                              .join(', ') + (song.replayRequesters.length > 3 ? '...' : '')
                          : ''
                      }}
                    </template>
                    <template v-else>
                      投稿人：{{ song.requester }}
                      <span v-if="song.collaborators && song.collaborators.length > 0">
                        & {{ song.collaborators.map((c) => c.displayName || c.name).join(' & ') }}
                      </span>
                    </template>
                  </span>
                </div>
              </div>

              <!-- 热度和点赞按钮区域 -->
              <div class="action-area">
                <!-- 热度展示 -->
                <div class="vote-count">
                  <span class="count">{{ song.voteCount }}</span>
                  <span class="label">热度</span>
                </div>

                <!-- 点赞按钮 -->
                <div class="like-button-wrapper">
                  <button
                    :class="{
                      liked: song.voted,
                      disabled: isVoteButtonDisabled(song)
                    }"
                    :disabled="isVoteButtonDisabled(song)"
                    :title="getVoteButtonTitle(song)"
                    class="like-button"
                    @click.stop="handleVote(song)"
                  >
                    <img alt="点赞" class="like-icon" :src="thumbsUp" >
                  </button>
                </div>
              </div>
            </div>

            <!-- 投稿时间和撤销按钮 -->
            <div class="submission-footer">
              <div class="submission-time">投稿时间：{{ song.requestedAt }}</div>

              <!-- 如果是自己的投稿或联合投稿，显示撤回/退出按钮 -->
              <button
                v-if="(isMySong(song) || isCollaborator(song)) && !song.played && !song.scheduled"
                :disabled="actionInProgress"
                :title="isMySong(song) ? '撤回投稿' : '退出联合投稿'"
                class="withdraw-button"
                @click.stop="handleWithdraw(song)"
              >
                撤销
              </button>

              <!-- 申请/取消重播按钮 -->
              <template v-if="song.played && isAuthenticated">
                <button
                  v-if="shouldShowCancelButton(song)"
                  :disabled="actionInProgress"
                  class="withdraw-button replay-cancel-btn"
                  title="撤回重播申请"
                  @click.stop="handleCancelReplay(song)"
                >
                  撤回申请
                </button>
                <button
                  v-else-if="enableReplayRequests && shouldShowRequestButton(song)"
                  :disabled="isReplayButtonDisabled(song)"
                  class="withdraw-button replay-request-btn"
                  :title="getReplayButtonTitle(song)"
                  @click.stop="handleRequestReplay(song)"
                >
                  {{ getReplayButtonText(song) }}
                </button>
              </template>
            </div>
          </div>
        </TransitionGroup>

        <!-- 分页控件 -->
        <Pagination
          v-model:current-page="currentPage"
          :total-pages="totalPages"
          :total-items="displayedSongs.length"
          item-name="首歌曲"
        />

        <!-- 确认对话框 -->
        <ConfirmDialog
          :show="confirmDialog.show"
          :title="confirmDialog.title"
          :message="confirmDialog.message"
          :type="confirmDialog.type"
          :loading="actionInProgress"
          @confirm="confirmAction"
          @cancel="cancelConfirm"
        />

        <Teleport to="body">
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="submissionNoteDialog.show"
              class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              @click="closeSubmissionNote"
            >
              <div class="submission-note-modal" @click.stop>
                <div class="submission-note-header">
                  <h4>投稿备注留言</h4>
                  <button @click="closeSubmissionNote">
                    <Icon :size="14" name="close" />
                  </button>
                </div>
                <div class="submission-note-meta">
                  <span class="song-title-tag">{{ submissionNoteDialog.songTitle }}</span>
                  <span :class="['visibility-tag', submissionNoteDialog.isPublic ? 'visibility-public' : 'visibility-private']">
                    {{ submissionNoteDialog.isPublic ? '公开备注' : '仅管理员可见' }}
                  </span>
                </div>
                <div class="submission-note-content-box">
                  <p class="submission-note-content">{{ submissionNoteDialog.note }}</p>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSemesters } from '~/composables/useSemesters'
import { useSongs } from '~/composables/useSongs'
import { useSiteConfig } from '~/composables/useSiteConfig'
import Icon from '~/components/UI/Icon.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import MarqueeText from '~/components/UI/MarqueeText.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { convertToHttps } from '~/utils/url'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { getMusicUrl as resolveMusicUrl } from '~/utils/musicUrl'
import thumbsUp from '~~/public/images/thumbs-up.svg'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

const props = defineProps({
  songs: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'vote',
  'withdraw',
  'cancelReplay',
  'requestReplay',
  'refresh',
  'semester-change'
])
const voteInProgress = ref(false)
const actionInProgress = ref(false)
const sortBy = ref('popularity')
const sortOrder = ref('desc') // 'desc' for newest first, 'asc' for oldest first
const searchQuery = ref('') // 搜索查询
const activeTab = ref('all') // 默认显示全部投稿
const auth = useAuth()
const { enableReplayRequests } = useSiteConfig()
const isAuthenticated = computed(() => auth && auth.isAuthenticated && auth.isAuthenticated.value)

// 焦点状态管理
const focusedSongId = ref(null)

// 处理歌曲卡片焦点切换
const handleSongCardClick = (song) => {
  // 如果点击的是当前已获得焦点的歌曲，则取消焦点
  if (focusedSongId.value === song.id) {
    focusedSongId.value = null
  } else {
    // 否则设置新的焦点歌曲
    focusedSongId.value = song.id
  }
}

// 判断歌曲是否获得焦点
const isSongFocused = (songId) => {
  return focusedSongId.value === songId
}

// 学期相关
const { fetchCurrentSemester, currentSemester, semesterUpdateEvent } = useSemesters()
const availableSemesters = ref([])
const selectedSemester = ref('')
const showSemesterDropdown = ref(false)

// 获取完整歌曲数据源
const songsComposable = useSongs()
const { playTimeEnabled } = useSongs()
const allSongsData = computed(() => songsComposable?.visibleSongs?.value || [])

// 音频播放相关
const audioPlayer = useAudioPlayer()

// 分页相关
const currentPage = ref(1)
const pageSize = ref(12) // 每页显示12首歌曲，适合横向布局
const isMobile = ref(false)

// 组件初始化状态
const isComponentInitialized = ref(false)
const isDataLoading = ref(false)
// 防重复调用标志
const isFetchingSemesters = ref(false)
// 用户手动选择学期标志
const isUserManuallySelected = ref(false)

// 切换活动标签
const setActiveTab = (tab) => {
  if (activeTab.value === tab) return // 如果点击的是当前标签，不执行切换
  activeTab.value = tab
  currentPage.value = 1 // 重置为第一页
}

// 检测设备是否为移动设备
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// 处理学期过滤变化事件
const handleSemesterFilterChange = (event) => {
  const newSemester = event.detail.semester

  // 更新选中的学期
  selectedSemester.value = newSemester

  // 重置到第一页
  currentPage.value = 1

  // 保存到sessionStorage
  if (newSemester) {
    sessionStorage.setItem('voicehub_selected_semester', newSemester)
  } else {
    sessionStorage.removeItem('voicehub_selected_semester')
  }
}

// 组件挂载和卸载时添加/移除窗口大小变化监听
onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // 添加学期过滤变化事件监听器
  window.addEventListener('semester-filter-change', handleSemesterFilterChange)

  // 首先从sessionStorage恢复学期选择状态
  try {
    const savedSemester = sessionStorage.getItem('voicehub_selected_semester')
    if (savedSemester && !containsCorruptedText(savedSemester)) {
      const cleanSavedSemester = cleanCorruptedText(savedSemester)
      if (cleanSavedSemester) {
        selectedSemester.value = cleanSavedSemester
      }
    }
  } catch (error) {
    console.warn('恢复学期选择状态失败:', error)
  }

  isDataLoading.value = true
  try {
    // 首先获取当前学期
    await fetchCurrentSemester()

    // 然后获取可用学期（初始化期间只设置列表，不执行选择逻辑）
    await fetchAvailableSemesters()

    // 标记组件初始化完成
    isComponentInitialized.value = true

    // 初始化完成后，尝试执行一次默认选择，确保正确的初始状态
    await selectDefaultSemester()
  } catch (error) {
    console.error('组件初始化失败:', error)
  } finally {
    isDataLoading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  // 移除学期过滤变化事件监听器
  window.removeEventListener('semester-filter-change', handleSemesterFilterChange)
})

// 监听歌曲数据变化，更新学期信息
watch(
  () => props.songs,
  () => {
    // 只有在组件完全初始化后且不在获取学期信息时才处理数据更新
    if (isComponentInitialized.value && !isDataLoading.value && !isFetchingSemesters.value) {
      fetchAvailableSemesters()
    }
  },
  { deep: true }
)

// 监听学期更新事件
watch(semesterUpdateEvent, async () => {
  // 只有在组件完全初始化后且不在获取学期信息时才处理学期更新
  if (isComponentInitialized.value && !isDataLoading.value && !isFetchingSemesters.value) {
    fetchAvailableSemesters()
  }
})

// 监听搜索查询变化，重置分页
watch(searchQuery, () => {
  currentPage.value = 1
})

// 监听allSongsData变化，当数据真正加载完成时重新获取学期信息
watch(
  allSongsData,
  (newData) => {
    // 只有在组件完全初始化后且数据真正有内容时才处理
    if (
      isComponentInitialized.value &&
      newData &&
      newData.length > 0 &&
      !isFetchingSemesters.value
    ) {
      fetchAvailableSemesters()
    }
  },
  { deep: true }
)

dayjs.extend(utc)
dayjs.extend(timezone)

const BEIJING_TIMEZONE = 'Asia/Shanghai'

// 确认对话框
const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  type: 'warning', // 'warning', 'danger', 'info', 'success'
  action: '',
  data: null
})
const submissionNoteDialog = ref({
  show: false,
  songTitle: '',
  note: '',
  isPublic: false
})

// 格式化日期为 X年X月X日
const formatDate = (dateString) => {
  if (!dateString) return '未知时间'
  return dayjs(dateString).tz(BEIJING_TIMEZONE).format('YYYY年M月D日')
}

// 格式化日期为 X年X月X日 HH:MM
const formatDateTime = (dateString) => {
  if (!dateString) return '未知时间'
  return dayjs(dateString).tz(BEIJING_TIMEZONE).format('YYYY年M月D日 HH:mm')
}

// 根据播出时段功能开启状态格式化排期日期
const formatScheduleDate = (dateString) => {
  if (!dateString) return ''
  // 如果播出时段功能开启，显示完整的日期时间
  if (playTimeEnabled.value) {
    return formatDateTime(dateString)
  }
  // 如果播出时段功能未开启，只显示日期
  return formatDate(dateString)
}

// 判断是否是自己投稿的歌曲
const isMySong = (song) => {
  return auth && auth.user && auth.user.value && song.requesterId === auth.user.value.id
}

// 判断是否是联合投稿人
const isCollaborator = (song) => {
  if (!auth || !auth.user || !auth.user.value) return false
  if (!song.collaborators || !Array.isArray(song.collaborators)) return false
  return song.collaborators.some((c) => c.id === auth.user.value.id)
}

// 应用过滤器和搜索
const displayedSongs = computed(() => {
  if (!props.songs) return []

  let result = [...props.songs]

  // 应用学期过滤器
  if (selectedSemester.value) {
    result = result.filter((song) => song.semester === selectedSemester.value)
  }

  // 应用标签过滤器
  if (activeTab.value === 'mine') {
    result = result.filter((song) => isMySong(song))
  } else if (activeTab.value === 'replays') {
    result = result.filter((song) => song.replayRequested)
  }

  // 应用搜索过滤器
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query) ||
        (song.requester && song.requester.toLowerCase().includes(query))
    )
  }

  // 按状态分组：未排期、已排期、已播放
  const unscheduledSongs = result.filter((song) => !song.played && !song.scheduled)
  const scheduledSongs = result.filter((song) => !song.played && song.scheduled)
  const playedSongs = result.filter((song) => song.played)

  // 对每个分组内部进行排序
  const sortSongs = (songs) => {
    if (sortBy.value === 'popularity') {
      return songs.sort((a, b) => {
        // 首先按投票数降序排列
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount
        }
        // 投票数相同时，按创建时间升序排列（投稿早的在前面）
        return new Date(a.createdAt) - new Date(b.createdAt)
      })
    } else if (sortBy.value === 'date') {
      return songs.sort((a, b) => {
        const dateA = new Date(a.createdAt)
        const dateB = new Date(b.createdAt)
        return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB
      })
    }
    return songs
  }

  // 返回按顺序排列的歌曲：未排期 → 已排期 → 已播放
  return [...sortSongs(unscheduledSongs), ...sortSongs(scheduledSongs), ...sortSongs(playedSongs)]
})

// 计算总页数
const totalPages = computed(() => {
  return Math.max(1, Math.ceil(displayedSongs.value.length / pageSize.value))
})

// 获取当前页的歌曲
const paginatedSongs = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  return displayedSongs.value.slice(startIndex, endIndex)
})

// 计算分页显示的页码
// 处理投票
// 检查点赞按钮是否应该禁用
const isVoteButtonDisabled = (song) => {
  if (voteInProgress.value || !song) return true

  // 检查学期
  if (!currentSemester.value || song.semester !== currentSemester.value.name) {
    return true
  }

  // 检查状态
  if (song.played || song.scheduled) {
    return true
  }

  // 检查是否是自己的歌曲
  if (isMySong(song)) {
    return true
  }

  return false
}

// 获取点赞按钮标题（tooltip）
const getVoteButtonTitle = (song) => {
  if (!song) return '点赞'

  // 检查学期
  if (!currentSemester.value || song.semester !== currentSemester.value.name) {
    return '非活跃学期'
  }

  // 检查状态
  if (song.played) {
    return '已播放的歌曲不能点赞'
  }
  if (song.scheduled) {
    return '已排期的歌曲不能点赞'
  }

  // 检查是否是自己的歌曲
  if (isMySong(song)) {
    return '不允许自己给自己点赞'
  }

  return song.voted ? '点击取消点赞' : '点赞'
}

const handleVote = async (song) => {
  // 检查用户是否登录
  if (!isAuthenticated.value) {
    if (window.$showNotification) {
      window.$showNotification('请先登录后再点赞', 'error')
    }
    return
  }

  // 检查学期
  if (!currentSemester.value || song.semester !== currentSemester.value.name) {
    if (window.$showNotification) {
      window.$showNotification('非活跃学期', 'error')
    }
    return
  }

  // 检查歌曲状态
  if (song.played || song.scheduled) {
    return // 已播放或已排期的歌曲不能点赞
  }

  // 检查是否是自己的歌曲
  if (isMySong(song)) {
    if (window.$showNotification) {
      window.$showNotification('不允许自己给自己点赞', 'error')
    }
    return
  }

  voteInProgress.value = true
  try {
    if (song.voted) {
      // 如果已投票，则调用撤销投票
      emit('vote', { ...song, unvote: true })
    } else {
      // 正常投票
      emit('vote', song)
    }
  } catch (err) {
    // 投票处理失败
  } finally {
    voteInProgress.value = false
  }
}

// 处理撤回
const handleWithdraw = (song) => {
  if (song.scheduled) {
    return // 已排期的歌曲不能撤回
  }

  if (isMySong(song)) {
    confirmDialog.value = {
      show: true,
      title: '撤回投稿',
      message: `确认撤回歌曲《${song.title}》的投稿吗？这将同时取消所有联合投稿关联。`,
      type: 'info',
      action: 'withdraw',
      data: song
    }
  } else if (isCollaborator(song)) {
    confirmDialog.value = {
      show: true,
      title: '退出联合投稿',
      message: `确认退出歌曲《${song.title}》的联合投稿吗？`,
      type: 'info',
      action: 'withdraw', // 后端使用相同的接口，根据用户身份处理
      data: song
    }
  }
}

const handleCancelReplay = (song) => {
  confirmDialog.value = {
    show: true,
    title: '取消重播申请',
    message: `确认取消歌曲《${song.title}》的重播申请吗？`,
    type: 'warning',
    action: 'cancelReplay',
    data: song
  }
}

const handleRequestReplay = (song) => {
  confirmDialog.value = {
    show: true,
    title: '申请重播',
    message: `确认申请重播歌曲《${song.title}》吗？`,
    type: 'info',
    action: 'requestReplay',
    data: song
  }
}

// 获取重播按钮文本
const getReplayButtonText = (song) => {
  if (actionInProgress.value) return '处理中...'
  if (!song) return '申请重播'

  // 检查学期
  if (currentSemester.value && song.semester !== currentSemester.value.name) {
    return '非本学期'
  }

  // 检查重播申请状态
  if (song.replayRequestStatus === 'REJECTED') {
    // 如果在冷却期内
    if (song.replayRequestCooldownRemaining && song.replayRequestCooldownRemaining > 0) {
      return `已拒绝（${song.replayRequestCooldownRemaining}小时后可重新申请）`
    }
    // 冷却期已过
    return '申请重播'
  }

  if (song.replayRequestStatus === 'FULFILLED') {
    return '已重播'
  }

  if (song.replayRequested || song.replayRequestStatus === 'PENDING') {
    return '撤回申请'
  }

  return '申请重播'
}

// 获取重播按钮标题（tooltip）
const getReplayButtonTitle = (song) => {
  if (!song) return '申请重播'

  // 检查学期
  if (currentSemester.value && song.semester !== currentSemester.value.name) {
    return '只能申请重播当前学期的歌曲'
  }

  // 检查重播申请状态
  if (song.replayRequestStatus === 'REJECTED') {
    if (song.replayRequestCooldownRemaining && song.replayRequestCooldownRemaining > 0) {
      return `申请被拒绝，需要等待 ${song.replayRequestCooldownRemaining} 小时后才能重新申请`
    }
    return '申请重播'
  }

  if (song.replayRequestStatus === 'FULFILLED') {
    return '该歌曲已重播'
  }

  if (song.replayRequested || song.replayRequestStatus === 'PENDING') {
    return '撤回重播申请'
  }

  return '申请重播'
}

// 检查重播按钮是否应该禁用
const isReplayButtonDisabled = (song) => {
  if (actionInProgress.value || !song) return true

  // 检查学期
  if (currentSemester.value && song.semester !== currentSemester.value.name) {
    return true
  }

  // 检查重播申请状态
  if (song.replayRequestStatus === 'REJECTED') {
    // 如果在冷却期内，禁用按钮
    if (song.replayRequestCooldownRemaining && song.replayRequestCooldownRemaining > 0) {
      return true
    }
    // 冷却期已过，允许重新申请
    return false
  }

  if (song.replayRequestStatus === 'FULFILLED') {
    return true
  }

  // PENDING 状态时不禁用，因为可以撤回
  return false
}

// 判断是否应该显示撤回按钮
const shouldShowCancelButton = (song) => {
  return song.replayRequested && song.replayRequestStatus === 'PENDING'
}

// 判断是否应该显示申请按钮
const shouldShowRequestButton = (song) => {
  // 如果是 PENDING 状态，显示撤回按钮而不是申请按钮
  if (song.replayRequested && song.replayRequestStatus === 'PENDING') {
    return false
  }
  // 其他情况显示申请按钮
  return true
}

// 处理刷新按钮点击
const handleRefresh = () => {
  emit('refresh')
}

// 确认执行操作
const confirmAction = async () => {
  const { action, data } = confirmDialog.value

  actionInProgress.value = true
  try {
    emit(action, data)
  } catch (err) {
    // 操作执行失败
  } finally {
    actionInProgress.value = false
    confirmDialog.value.show = false
  }
}

// 取消确认
const cancelConfirm = () => {
  confirmDialog.value.show = false
}

const openSubmissionNote = (song) => {
  if (!song?.submissionNote) return
  submissionNoteDialog.value = {
    show: true,
    songTitle: `${song.title} - ${song.artist}`,
    note: song.submissionNote,
    isPublic: song.submissionNotePublic === true
  }
}

const closeSubmissionNote = () => {
  submissionNoteDialog.value.show = false
}

// 处理图片加载错误
const handleImageError = (event, song) => {
  if (event?.target) {
    event.target.style.display = 'none'
    if (event.target.parentNode) {
      event.target.parentNode.classList.add('text-cover')
      event.target.parentNode.textContent = getFirstChar(song.title)
    }
  }
}

// 获取歌曲标题的第一个字符作为封面
const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
}

// 播放歌曲的辅助函数，处理 URL 获取和播放列表构建
const playSongWithUrlFetching = async (song) => {
  let url = null
  try {
    url = await getMusicUrl(song)
  } catch (error) {
    if (!isBilibiliSong(song)) {
      if (window.$showNotification) {
        window.$showNotification('获取音乐播放链接失败', 'error')
      }
    }
  }

  const playableSong = { ...song, musicUrl: url || null }
  const playlist = await buildPlayablePlaylist(song)
  const currentIndex = playlist.findIndex((item) => item.id === song.id)
  audioPlayer.playSong(playableSong, playlist, currentIndex)

  if (!url && !isBilibiliSong(song)) return

  // 后台预取后续歌曲的播放链接（不阻塞当前播放）
  ;(async () => {
    for (let i = currentIndex + 1; i < playlist.length; i++) {
      const s = playlist[i]
      if (!s.musicUrl && ((s.musicPlatform && s.musicId) || s.playUrl)) {
        try {
          s.musicUrl = await getMusicUrl(s)
        } catch (error) {
          console.warn(`后台预取失败: ${s.title}`, error)
          s.musicUrl = null
        }
      }
    }
  })()
}

// 切换歌曲播放/暂停
const togglePlaySong = async (song) => {
  // 检查是否为当前歌曲且正在播放
  if (audioPlayer.isCurrentSong(song.id) && audioPlayer.getPlayingStatus().value) {
    // 如果正在播放，则暂停
    audioPlayer.pauseSong()
    return
  }

  // 如果是当前歌曲但已暂停，则恢复播放
  if (audioPlayer.isCurrentSong(song.id) && !audioPlayer.getPlayingStatus().value) {
    // 检查当前全局歌曲是否有URL
    const currentGlobalSong = audioPlayer.getCurrentSong().value
    if (
      currentGlobalSong &&
      (currentGlobalSong.musicUrl || isBilibiliSong(currentGlobalSong))
    ) {
      // 如果有URL或者是哔哩哔哩视频，直接恢复播放
      audioPlayer.playSong(currentGlobalSong)
    } else {
      // 如果没有URL，重新获取
      if ((song.musicPlatform && song.musicId) || song.playUrl) {
        await playSongWithUrlFetching(song)
      }
    }
    return
  }

  // 如果有平台和ID信息或playUrl，动态获取URL
  if ((song.musicPlatform && song.musicId) || song.playUrl) {
    await playSongWithUrlFetching(song)
  }
}

// 构建可播放的播放列表
const buildPlayablePlaylist = async (currentSong) => {
  // 获取当前显示的歌曲列表（已经过滤和排序）
  const songsToProcess = paginatedSongs.value.filter(
    (song) => ((song.musicPlatform && song.musicId) || song.playUrl) && song.id !== currentSong.id
  )

  // 将当前歌曲添加到列表中正确的位置
  const allSongs = [...paginatedSongs.value]

  // 只返回有播放信息的歌曲，保持原有顺序
  return allSongs.filter((song) => (song.musicPlatform && song.musicId) || song.playUrl)
}

// 动态获取音乐URL
const getMusicUrl = async (song) => {
  const { musicPlatform: platform, musicId, playUrl, sourceInfo } = song

  // 如果有自定义播放链接，优先使用
  if (playUrl && playUrl.trim()) {
    console.log(`[SongList] 使用自定义播放链接: ${playUrl}`)
    return playUrl.trim()
  }

  // 如果没有playUrl，检查platform和musicId是否有效
  if (!platform || !musicId) {
    throw new Error('歌曲缺少音乐平台或音乐ID信息，无法获取播放链接')
  }

  // 检查是否为播客内容
  const isPodcast =
    platform === 'netease-podcast' ||
    sourceInfo?.type === 'voice' ||
    (sourceInfo?.source === 'netease-backup' && sourceInfo?.type === 'voice')

  const options = isPodcast ? { unblock: false } : {}
  return resolveMusicUrl(platform, musicId, undefined, options)
}

// 判断当前是否正在播放指定ID的歌曲
const isCurrentPlaying = (songId) => {
  return audioPlayer.isCurrentPlaying(songId)
}

// 学期相关状态
const semesterLoading = ref(false)
const semesterError = ref('')

// 防抖处理学期切换
const debouncedSemesterChange = debounce((semester) => {
  // 增强的状态检查
  if (semesterLoading.value || isDataLoading.value || !isComponentInitialized.value) {
    return
  }

  // 再次检查并清理学期数据
  if (containsCorruptedText(semester)) {
    console.warn('防抖函数检测到乱码学期数据，跳过切换')
    return
  }

  const cleanSemester = cleanCorruptedText(semester)
  if (!cleanSemester) {
    console.warn('防抖函数检测到空学期数据，跳过切换')
    return
  }

  // 检查学期是否仍在可用列表中
  if (!availableSemesters.value.includes(cleanSemester)) {
    console.warn('防抖函数检测到学期不在可用列表中，跳过切换:', cleanSemester)
    return
  }

  // 执行学期切换

  selectedSemester.value = cleanSemester
  showSemesterDropdown.value = false
  currentPage.value = 1 // 重置到第一页

  // 保存到sessionStorage
  try {
    sessionStorage.setItem('voicehub_selected_semester', cleanSemester)
  } catch (error) {
    console.warn('防抖函数无法保存学期选择到sessionStorage:', error)
  }

  emit('semester-change', cleanSemester)
}, 300)

// 乱码检测函数
const containsCorruptedText = (text) => {
  if (!text || typeof text !== 'string') return true

  // 检查Unicode替换字符
  if (text.includes('\uFFFD') || text.includes('�')) {
    return true
  }

  // 检查控制字符（除了常见的空白字符）
  // eslint-disable-next-line no-control-regex
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
  if (controlCharRegex.test(text)) {
    return true
  }

  // 检查孤立代理对字符
  const surrogatePairRegex = /[\uD800-\uDFFF]/
  if (surrogatePairRegex.test(text)) {
    return true
  }

  return false
}

// 清理乱码字符串
const cleanCorruptedText = (text) => {
  if (!text || typeof text !== 'string') return ''

  return (
    text
      // 移除Unicode替换字符
      .replace(/\uFFFD/g, '')
      .replace(/�/g, '')
      // 移除控制字符（保留常见空白字符）
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // 移除孤立代理对字符
      .replace(/[\uD800-\uDFFF]/g, '')
      // 规范化Unicode字符
      .normalize('NFC')
      .trim()
  )
}

// 学期相关函数
const fetchAvailableSemesters = async () => {
  // 防止重复请求和并发调用
  if (semesterLoading.value || isFetchingSemesters.value) {
    return
  }

  // 检查是否有歌曲数据，如果没有则等待
  if (!props.songs || props.songs.length === 0) {
    return
  }

  isFetchingSemesters.value = true
  semesterLoading.value = true
  semesterError.value = ''

  // 如果组件正在初始化，设置数据加载状态
  if (!isComponentInitialized.value) {
    isDataLoading.value = true
  }

  try {
    // 使用完整的歌曲数据源而不是过滤后的props.songs
    let completeSongs = allSongsData.value || []

    // 检查数据源状态

    // 如果allSongsData为空，但props.songs有数据，直接使用props.songs作为数据源
    if (completeSongs.length === 0 && props.songs && props.songs.length > 0) {
      completeSongs = props.songs
    }

    // 如果完全没有数据，直接返回
    if (completeSongs.length === 0) {
      availableSemesters.value = []
      return
    }

    // 从完整歌曲数据中提取学期信息，并过滤乱码
    const rawSemesters = [...new Set(completeSongs.map((song) => song.semester).filter(Boolean))]
    const cleanSemesters = rawSemesters
      .filter((semester) => !containsCorruptedText(semester))
      .map((semester) => cleanCorruptedText(semester))
      .filter((semester) => semester.length > 0)

    // 统计每个学期的歌曲数量，只保留有数据的学期
    const semesterStats = {}
    completeSongs.forEach((song) => {
      if (song.semester && !containsCorruptedText(song.semester)) {
        const cleanSemester = cleanCorruptedText(song.semester)
        if (cleanSemester) {
          semesterStats[cleanSemester] = (semesterStats[cleanSemester] || 0) + 1
        }
      }
    })

    // 只保留有数据的学期，按时间倒序排列
    const semestersWithData = Object.keys(semesterStats)
      .filter((semester) => semesterStats[semester] > 0)
      .sort()
      .reverse()

    // 统计有数据的学期

    // 如果用户手动选择了学期，确保该学期保留在可用学期列表中
    const finalSemesters = [...semestersWithData]
    if (
      isUserManuallySelected.value &&
      selectedSemester.value &&
      !finalSemesters.includes(selectedSemester.value)
    ) {
      // 将用户选择的学期添加到列表中，保持时间倒序
      finalSemesters.push(selectedSemester.value)
      finalSemesters.sort().reverse()
    }

    // 更新可用学期列表
    availableSemesters.value = [...finalSemesters]

    // 缓存学期信息到sessionStorage
    try {
      sessionStorage.setItem(
        'voicehub_available_semesters',
        JSON.stringify(availableSemesters.value)
      )
    } catch (error) {
      console.warn('无法缓存学期信息:', error)
    }

    // 如果组件未完全初始化，只设置availableSemesters，不执行学期选择逻辑
    if (!isComponentInitialized.value) {
      return
    }

    // 执行学期选择逻辑
    await selectDefaultSemester()
  } catch (error) {
    console.error('获取学期信息失败:', error)
    semesterError.value = '获取学期信息失败，请刷新页面重试'

    // 错误恢复：使用缓存的学期信息
    try {
      const cachedSemesters = sessionStorage.getItem('voicehub_available_semesters')
      if (cachedSemesters) {
        availableSemesters.value = JSON.parse(cachedSemesters)
      }
    } catch (cacheError) {
      console.warn('无法恢复缓存的学期信息:', cacheError)
    }
  } finally {
    semesterLoading.value = false
    isFetchingSemesters.value = false
    // 如果组件正在初始化，重置数据加载状态
    if (!isComponentInitialized.value) {
      isDataLoading.value = false
    }
  }
}

// 选择默认学期的逻辑
const selectDefaultSemester = async () => {
  // 如果没有可用学期，清空选择
  if (availableSemesters.value.length === 0) {
    selectedSemester.value = ''
    return
  }

  // 优先级1: 总是优先检查当前活跃学期（如果有数据）
  // 即使之前有缓存的选择，只要当前学期有数据且不是用户本次会话手动切换的，优先展示当前学期
  if (currentSemester.value && currentSemester.value.name) {
    const currentSemesterName = currentSemester.value.name

    if (!containsCorruptedText(currentSemesterName)) {
      const cleanCurrentSemester = cleanCorruptedText(currentSemesterName)

      // 检查当前学期是否在有数据的列表中
      if (cleanCurrentSemester && availableSemesters.value.includes(cleanCurrentSemester)) {
        // 如果当前没有选中任何学期，或者虽然有选中但不是用户手动指定的（可能是上次缓存的），强制切回当前学期
        if (!selectedSemester.value || !isUserManuallySelected.value) {
          selectedSemester.value = cleanCurrentSemester

          // 更新缓存
          try {
            sessionStorage.setItem('voicehub_selected_semester', cleanCurrentSemester)
          } catch (error) {
            console.warn('无法保存学期选择:', error)
          }
          return
        }
      }
    }
  }

  // 如果已经有选中的学期且该学期在可用列表中，保持选择（包括从sessionStorage恢复的选择）
  if (selectedSemester.value && availableSemesters.value.includes(selectedSemester.value)) {
    // 保存选择到sessionStorage以确保状态同步
    try {
      sessionStorage.setItem('voicehub_selected_semester', selectedSemester.value)
    } catch (error) {
      console.warn('无法保存学期选择:', error)
    }
    return
  }

  // 优先级2: 尝试从sessionStorage恢复缓存的选择（如果有数据）
  if (!selectedSemester.value) {
    try {
      const savedSemester = sessionStorage.getItem('voicehub_selected_semester')
      if (savedSemester && !containsCorruptedText(savedSemester)) {
        const cleanSavedSemester = cleanCorruptedText(savedSemester)

        // 只有缓存的学期在有数据的列表中才使用
        if (cleanSavedSemester && availableSemesters.value.includes(cleanSavedSemester)) {
          selectedSemester.value = cleanSavedSemester
          return
        } else {
          sessionStorage.removeItem('voicehub_selected_semester')
        }
      }
    } catch (error) {
      console.warn('恢复缓存学期选择失败:', error)
      sessionStorage.removeItem('voicehub_selected_semester')
    }
  }

  // 优先级3: 使用第一个有数据的学期作为默认
  if (!selectedSemester.value && availableSemesters.value.length > 0) {
    selectedSemester.value = availableSemesters.value[0]

    // 保存选择到sessionStorage
    try {
      sessionStorage.setItem('voicehub_selected_semester', availableSemesters.value[0])
    } catch (error) {
      console.warn('无法保存学期选择:', error)
    }
  }
}

// 监听 currentSemester 变化，确保加载完成后能自动选中
watch(currentSemester, (newVal) => {
  if (newVal && newVal.name) {
    // 当当前学期信息加载完成后，尝试重新选择默认学期
    // 只有在没有手动选择的情况下才强制切换
    if (!isUserManuallySelected.value) {
      selectDefaultSemester()
    }
  }
})

const onSemesterChange = (semester) => {
  // 增强的加载状态检查
  if (semesterLoading.value || isDataLoading.value || !isComponentInitialized.value) {
    return // 防止在加载时或组件未初始化时切换
  }

  // 检查并清理学期数据
  if (containsCorruptedText(semester)) {
    console.warn('学期数据包含乱码，忽略切换请求')
    return
  }

  const cleanSemester = cleanCorruptedText(semester)
  if (!cleanSemester) {
    console.warn('清理后的学期数据为空，忽略切换请求')
    return
  }

  // 检查学期是否在可用列表中
  if (!availableSemesters.value.includes(cleanSemester)) {
    console.warn('选择的学期不在可用列表中:', cleanSemester)
    return
  }

  // 标记为用户手动选择
  isUserManuallySelected.value = true

  // 立即更新选中的学期，确保UI响应
  selectedSemester.value = cleanSemester

  // 使用nextTick确保DOM更新后样式能正确应用
  nextTick(() => {
    // DOM已更新，学期选择样式应该已应用
  })

  // 保存学期选择到sessionStorage
  try {
    sessionStorage.setItem('voicehub_selected_semester', cleanSemester)
    sessionStorage.setItem('voicehub_user_manually_selected', 'true')
  } catch (error) {
    console.warn('无法保存学期选择:', error)
  }

  // 关闭下拉菜单
  showSemesterDropdown.value = false

  // 使用防抖处理其他逻辑
  debouncedSemesterChange(cleanSemester)
}

// 重试获取学期信息
const retrySemesterFetch = () => {
  // 检查组件状态，确保可以安全重试
  if (semesterLoading.value || isDataLoading.value) {
    return
  }

  semesterError.value = ''
  fetchAvailableSemesters()
}

// 当组件销毁时不需要特殊处理，音频播放由全局管理

// 波纹效果指令
const vRipple = {
  mounted(el) {
    el.addEventListener('click', (e) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`

      el.appendChild(ripple)

      setTimeout(() => {
        ripple.remove()
      }, 600) // 与CSS动画时间一致
    })
  }
}
</script>

<style scoped>
.song-list {
  width: 100%;
  position: relative;
  z-index: 2;
}

/* 桌面端/移动端显示控制 */
.desktop-only {
  display: flex !important;
}

.mobile-only {
  display: none !important;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: flex !important;
  }
}

.song-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.desktop-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.mobile-search-container {
  display: none;
}

@media (max-width: 768px) {
  .song-list-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5rem;
  }

  .mobile-search-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 16px;
    padding: 0 4px;
  }

  .search-bar-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }

  .search-icon-box {
    position: absolute;
    left: 14px;
    color: rgba(255, 255, 255, 0.4);
    display: flex;
    align-items: center;
    pointer-events: none;
    z-index: 1;
  }

  .mobile-search-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px 16px 12px 42px;
    font-size: 14px;
    color: #fff;
    width: 100%;
    transition: all 0.2s ease;
  }

  .mobile-search-input:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .mobile-tabs {
    display: flex;
    gap: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 2px;
  }

  .mobile-tab-btn {
    background: transparent;
    border: none;
    padding: 0 0 8px 0;
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    position: relative;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .mobile-tab-btn.active {
    color: #3b82f6;
  }

  .active-indicator {
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: #3b82f6;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }
}

.tab-controls {
  display: flex;
  gap: 1rem;
}

/* 标签切换动画 */
.tab-switch-enter-active,
.tab-switch-leave-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}

.tab-switch-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.tab-switch-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

/* 标签按钮样式 */
.tab-button {
  position: relative;
  overflow: hidden;
  background: transparent;
  border: none;
  padding: 0.75rem 1.5rem;
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-bottom: 3px solid transparent;
  margin: 0 0.5rem;
}

.tab-button:hover {
  color: rgba(255, 255, 255, 0.9);
  transform: translateY(-3px);
}

.tab-button.active {
  color: #ffffff;
  border-bottom-color: #0b5afe;
  transform: none;
  box-shadow: none;
  background-color: transparent;
}

.tab-button:focus {
  outline: none;
}

/* 波纹效果 */
.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(11, 90, 254, 0.3) 0%, rgba(255, 255, 255, 0.1) 70%);
  transform: scale(0);
  animation: ripple 0.8s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: none;
  width: 150px;
  height: 150px;
  margin-left: -75px;
  margin-top: -75px;
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 紧凑型学期选择器样式 */
.semester-selector-compact {
  position: relative;
}

.semester-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #21242d;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  padding: 0;
}

.semester-toggle-btn:hover {
  background: #2a2e38;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  color: #0b5afe;
}

.semester-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #1a1d24;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  min-width: 180px;
  overflow: hidden;
}

.semester-option {
  padding: 0.75rem 1rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.semester-option:last-child {
  border-bottom: none;
}

.semester-option:hover {
  background: rgba(11, 90, 254, 0.1);
  color: #ffffff;
}

.semester-option.active {
  background: rgba(11, 90, 254, 0.2);
  color: #0b5afe;
  font-weight: 600;
}

.search-box {
  position: relative;
  width: 250px;
}

.search-input {
  background: #040e15;
  border: 1px solid #242f38;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  padding-right: 2.5rem;
  font-family: 'MiSans-Demibold', sans-serif;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  width: 100%;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #0b5afe;
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.6);
}

.refresh-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #21242d;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
}

.refresh-button:hover {
  background: #2a2e38;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.refresh-button:active {
  transform: translateY(0);
}

.refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.refresh-icon {
  width: 18px;
  height: 18px;
  transition: transform 0.3s ease;
}

.refresh-icon.rotating {
  animation: rotate 1.2s cubic-bezier(0.5, 0.1, 0.5, 1) infinite;
}

/* 加载动画 */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading {
  text-align: center;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading::before {
  content: '';
  display: block;
  width: 40px;
  height: 40px;
  margin-bottom: 1rem;
  border-radius: 50%;
  border: 3px solid rgba(11, 90, 254, 0.2);
  border-top-color: #0b5afe;
  animation: spin 1s linear infinite;
}

.error,
.empty {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.6);
}

.error {
  color: #ef4444;
}

.songs-container {
  width: 100%;
}

.song-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.song-card {
  width: calc(33.333% - 0.75rem);
  background: transparent;
  border-radius: 10px;
  overflow: visible;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.song-card-main {
  padding: 1rem 0 1rem 1rem; /* 移除右侧内边距，保留左侧、上下内边距 */
  background: #21242d;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  position: relative;
  height: 100px; /* 减小卡片高度 */
  border-radius: 10px;
  width: 100%;
  z-index: 2;
  margin-bottom: -5px;
  overflow: hidden;
  display: flex; /* 使用flex布局 */
  align-items: center; /* 垂直居中 */
  gap: 15px; /* 元素之间的间隔 */
  box-sizing: border-box; /* 确保内边距不会增加元素的总宽度 */
}

/* 已播放歌曲的封面和文字可以保持半透明，以示区别 */
.song-card.played .song-cover,
.song-card.played .song-info {
  opacity: 0.6;
}

/* 歌曲封面样式 */
.song-cover {
  width: 55px;
  height: 55px;
  aspect-ratio: 1;
  flex-shrink: 0;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 文字封面样式 */
.text-cover {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0043f8 0%, #0075f8 100%);
  color: #ffffff;
  font-size: 28px;
  font-weight: bold;
  font-family: 'MiSans-Demibold', sans-serif;
}

/* 播放按钮叠加层 */
.play-button-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.song-cover:hover .play-button-overlay {
  opacity: 1;
}

/* 播放按钮样式 */
.play-button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(11, 90, 254, 0.8);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.play-button:hover {
  transform: scale(1.1);
}

/* 播放图标样式已移至Icon组件 */

/* 修改歌曲信息区域的CSS样式 */
.song-info {
  flex: 1;
  width: 100%; /* 使用100%宽度 */
  min-width: 0; /* 允许内容收缩 */
  padding-right: 10px; /* 添加右侧内边距，而不是外边距 */
  overflow: hidden; /* 确保内容不会溢出 */
}

.song-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: #ffffff;
  margin-bottom: 0.5rem;
  width: 100%; /* 确保标题占满整个容器宽度 */
  display: flex;
  align-items: center;
}

/* 添加一个包装器来处理歌曲标题和歌手的文本溢出 */
.song-title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0; /* 允许文本收缩 */
}

.song-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  width: 100%;
}

.requester {
  font-family: 'MiSans', sans-serif;
  font-weight: normal;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 修改热度和点赞按钮区域的CSS样式 */
.action-area {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0; /* 完全移除间距 */
  margin-left: auto;
  margin-right: 10px; /* 添加右侧外边距，使整体向左移动 */
  flex-shrink: 0;
  width: auto; /* 使用自动宽度 */
  min-width: 100px; /* 增加最小宽度，确保热度和点赞按钮有更多空间 */
  padding-right: 0; /* 移除右侧内边距 */
}

/* 热度样式 */
.vote-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 45px; /* 增加热度显示的最小宽度 */
}

.vote-count .count {
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 20px;
  color: #0b5afe;
  text-shadow:
    0px 20px 30px rgba(0, 114, 248, 0.5),
    0px 8px 15px rgba(0, 114, 248, 0.5),
    0px 4px 10px rgba(0, 179, 248, 0.3),
    0px 2px 10px rgba(0, 179, 248, 0.2),
    inset 3px 3px 10px rgba(255, 255, 255, 0.4),
    inset -1px -1px 15px rgba(255, 255, 255, 0.4);
}

.vote-count .label {
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #ffffff;
  opacity: 0.4;
}

/* 点赞按钮样式 */
.like-button-wrapper {
  /* 向右移动点赞按钮，但考虑到整体已向左移动，减小负边距 */
  margin-right: -10px;
}

.like-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 45px;
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.like-button.liked {
  background: #1a1d24;
  border-color: #242f38;
  background-image: none;
}

.like-button.disabled {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  opacity: 0.5;
}

.like-button.disabled .like-icon {
  opacity: 0.5;
}

.like-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.2s ease;
}

.like-button:hover .like-icon {
  transform: scale(1.2);
}

.scheduled-tag {
  display: inline-flex;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-size: 0.7rem;
  color: #10b981;
  margin-left: 0.5rem;
  flex-shrink: 0; /* 防止标签被压缩 */
  align-self: center; /* 确保垂直居中 */
}

.played-tag {
  display: inline-flex;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-size: 0.7rem;
  color: #10b981;
  margin-left: 0.5rem;
  flex-shrink: 0; /* 防止标签被压缩 */
  align-self: center; /* 确保垂直居中 */
}

.replay-tag {
  display: inline-flex;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-size: 0.7rem;
  color: #3b82f6;
  margin-left: 0.5rem;
  flex-shrink: 0;
  align-self: center;
}

/* 投稿时间和撤销按钮 */
.submission-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #21242d;
  border-radius: 0 0 10px 10px;
  padding: 0.5rem 1rem;
  width: 95%;
  position: relative;
  z-index: 1;
  height: 45px;
}

.submission-time {
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-align: left;
  max-width: 70%;
}

.withdraw-button {
  background: linear-gradient(180deg, #ff2f2f 0%, #ff654d 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.25rem 0.75rem;
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 27px;
  min-width: 51px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
}

.replay-cancel-btn {
  background: linear-gradient(180deg, #0b5afe 0%, #3d7fff 100%);
  min-width: 75px;
}

.replay-request-btn {
  background: linear-gradient(180deg, #0b5afe 0%, #3d7fff 100%);
  min-width: 75px;
}

.withdraw-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.withdraw-button:active {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 分页控件 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1.5rem;
  gap: 0.5rem;
}

.page-button,
.page-number {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-number.active {
  background: #0b5afe;
  border-color: #0b5afe;
}

.page-info {
  margin-left: 0.5rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.875rem;
}

/* 自定义跳转控件 */
.page-jump {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
}

.jump-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.875rem;
  white-space: nowrap;
}

.jump-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: #ffffff;
  width: 60px;
  text-align: center;
  transition: all 0.2s ease;
}

.jump-input:focus {
  outline: none;
  border-color: #0b5afe;
  background: rgba(255, 255, 255, 0.15);
}

.jump-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem;
}

.jump-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.jump-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.jump-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1200px) {
  .song-card {
    width: calc(50% - 0.5rem);
  }
}

@media (max-width: 768px) {
  .song-list {
    padding: 0;
  }

  /* 头部区域 */
  .song-list-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    margin-bottom: 16px;
  }

  /* 标签按钮 */
  .tab-controls {
    justify-content: flex-start;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 4px;
  }

  .tab-controls::-webkit-scrollbar {
    display: none;
  }

  .tab-button {
    flex: 0 0 auto;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    white-space: nowrap;
  }

  .tab-button:hover {
    transform: none;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.08);
  }

  .tab-button.active {
    background: rgba(11, 90, 254, 0.15);
    color: #0b5afe;
    border-bottom: none;
    box-shadow: none;
  }

  /* 搜索和操作区域 */
  .search-actions {
    width: 100%;
    justify-content: space-between;
    gap: 8px;
  }

  .search-box {
    width: 100%;
    flex: 1;
  }

  .search-input {
    background: rgba(255, 255, 255, 0.04);
    border: none;
    border-radius: 12px;
    padding: 10px 16px;
    padding-right: 40px;
    font-size: 14px;
  }

  .search-input:focus {
    background: rgba(255, 255, 255, 0.08);
    box-shadow: none;
  }

  .search-icon {
    right: 12px;
    font-size: 14px;
  }

  /* 学期选择器 */
  .semester-selector-compact {
    flex-shrink: 0;
  }

  .semester-toggle-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: none;
  }

  .semester-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: none;
    box-shadow: none;
  }

  .semester-dropdown {
    background: #1a1a1f;
    border: none;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    top: calc(100% + 8px);
  }

  .semester-option {
    padding: 12px 16px;
    font-size: 14px;
  }

  /* 刷新按钮 */
  .refresh-button {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: none;
    flex-shrink: 0;
  }

  .refresh-button:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: none;
    box-shadow: none;
  }

  /* 歌曲卡片 */
  .song-cards {
    gap: 12px;
    display: flex;
    flex-direction: column;
    padding: 4px;
  }

  .song-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .song-card.playing {
    background: rgba(11, 90, 254, 0.12);
    border-color: rgba(11, 90, 254, 0.4);
    box-shadow: 0 0 20px rgba(11, 90, 254, 0.2);
  }

  .song-card.playing .song-title {
    color: #0b5afe;
    text-shadow: 0 0 10px rgba(11, 90, 254, 0.3);
  }

  .song-card:active {
    transform: scale(0.97);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .song-card.played {
    opacity: 0.8;
    filter: grayscale(0.35);
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .song-card-main {
    height: auto;
    min-height: 80px;
    padding: 12px;
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    margin: 0;
  }

  /* 歌曲封面 */
  .song-cover {
    width: 60px;
    height: 60px;
    aspect-ratio: 1;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  /* 播放按钮 */
  .play-button-overlay {
    display: none !important;
  }

  .song-info {
    flex: 1;
    min-width: 0;
    padding-right: 0;
  }

  .song-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 4px;
    line-height: 1.2;
    color: #ffffff;
    letter-spacing: 0.01em;
  }

  .requester {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 400;
    margin-top: 2px;
  }

  /* 操作区域 */
  .action-area {
    gap: 16px;
    margin-left: 0;
    min-width: auto;
    padding-right: 4px;
  }

  .vote-count .count {
    font-size: 20px;
    font-weight: 800;
    color: var(--primary);
    font-family: 'MiSans-Bold', sans-serif;
    line-height: 1;
    text-shadow: 0 0 10px var(--primary-light);
  }

  .vote-count .label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.3);
    margin-top: 2px;
    text-transform: uppercase;
  }

  .like-button {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .like-button.liked {
    background: var(--primary-light);
    border-color: var(--primary);
    color: var(--primary);
  }

  .like-icon {
    width: 22px;
    height: 22px;
  }

  /* 投稿时间和操作 */
  .submission-footer {
    background: rgba(255, 255, 255, 0.02);
    padding: 10px 16px;
    height: auto;
    width: 100%;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .submission-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 400;
  }

  .withdraw-button {
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .withdraw-button.replay-cancel-btn,
  .withdraw-button.replay-request-btn {
    background: var(--primary-light);
    color: var(--primary);
    border-color: var(--primary-border);
  }

  /* 加载和空状态 */
  .loading,
  .error,
  .empty {
    padding: 40px 20px;
    background: transparent;
    border-radius: 0;
  }

  .loading::before {
    width: 32px;
    height: 32px;
    border-width: 2px;
  }

  /* 分页 */
  .pagination {
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 24px;
    padding-bottom: 16px;
  }

  .page-button,
  .page-number {
    background: rgba(255, 255, 255, 0.04);
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
  }

  .page-number.active {
    background: rgba(11, 90, 254, 0.15);
    color: #0b5afe;
  }

  .page-info {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }

  .page-jump {
    margin-top: 12px;
    gap: 8px;
  }

  .jump-input {
    background: rgba(255, 255, 255, 0.04);
    border: none;
    border-radius: 8px;
    width: 50px;
    padding: 8px;
  }

  .jump-button {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
  }

  /* 移动端分页 */
  .song-list-header {
    gap: 10px;
    margin-bottom: 12px;
  }

  .tab-button {
    padding: 6px 12px;
    font-size: 12px;
  }

  .song-card-main {
    padding: 10px;
    min-height: 60px;
    gap: 10px;
  }

  .song-cover {
    width: 44px;
    height: 44px;
    aspect-ratio: 1;
    border-radius: 8px;
  }

  .song-title {
    font-size: 13px;
  }

  .requester {
    font-size: 11px;
  }

  .vote-count .count {
    font-size: 14px;
  }

  .like-button {
    width: 32px;
    height: 32px;
  }

  .like-icon {
    width: 16px;
    height: 16px;
  }

  .submission-footer {
    padding: 6px 10px;
  }

  .submission-time {
    font-size: 10px;
  }
}

/* 移动端分页 */
@media (max-width: 768px) {
  .pagination-mobile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    padding: 0 10px 20px;
  }

  .page-nav-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .page-nav-btn:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.1);
  }

  .page-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-selector {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    height: 40px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mobile-page-input {
    width: 40px;
    background: transparent;
    border: none;
    color: #fff;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    padding: 0;
    font-family: 'MiSans', sans-serif;
  }

  .mobile-page-input:focus {
    outline: none;
    color: #0b5afe;
  }

  .page-selector .divider {
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
  }

  .page-selector .total {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 500;
  }
}

.page-nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: #3b82f6;
}

.page-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
}

.page-indicator .current {
  font-size: 18px;
  color: #3b82f6;
}

.page-indicator .divider {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.2);
}

.page-indicator .total {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

@media (max-width: 768px) {
  .pagination-mobile {
    display: flex;
  }
}

/* 翻页动画 */
.page-enter-active,
.page-leave-active {
  transition: all 0.4s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

.page-move {
  transition: transform 0.4s ease;
}

.submission-note-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: 6px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.08);
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0);
}

.submission-note-trigger:hover {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 6px 12px rgba(96, 165, 250, 0.15);
}

.submission-note-modal {
  width: 100%;
  max-width: 400px;
  background: rgba(24, 24, 27, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 24px;
  color: #f3f4f6;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.submission-note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.submission-note-header h4 {
  font-size: 16px;
  font-weight: 800;
  color: #f4f4f5;
}

.submission-note-header button {
  border: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s;
}

.submission-note-header button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f4f4f5;
}

.submission-note-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.song-title-tag {
  font-size: 12px;
  color: #a1a1aa;
  font-weight: 500;
}

.visibility-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.visibility-public {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.visibility-private {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.submission-note-content-box {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
}

.submission-note-content {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 14px;
  color: #e4e4e7;
}
</style>
