<template>
  <div class="schedule-list">
    <!-- 两列布局：左侧日期选择，右侧排期展示 -->
    <div class="schedule-container">
      <!-- 左侧日期选择列表 -->
      <div class="date-selector">
        <!-- 移动端日期导航按钮 -->
        <div class="mobile-date-nav">
          <div class="nav-capsule">
            <button :disabled="currentDateIndex === 0" class="nav-btn prev" @click="previousDate">
              <Icon :size="18" name="chevron-left" />
            </button>
            <div class="current-date-display" @click="toggleDatePicker">
              <span class="date-text" v-html="currentDateFormatted" />
              <Icon :size="12" class="dropdown-icon" name="chevron-down" />
            </div>
            <button
              :disabled="currentDateIndex >= availableDates.length - 1"
              class="nav-btn next"
              @click="nextDate"
            >
              <Icon :size="18" name="chevron-right" />
            </button>
          </div>
          <button
            v-if="isNeteaseLoggedIn"
            class="mobile-action-btn"
            type="button"
            title="添加到歌单"
            @click="handleAddToPlaylistClick"
          >
            <Icon :size="20" color="#ffffff" name="music" />
          </button>
        </div>

        <!-- 移动端日期选择弹窗 -->
        <Transition name="date-picker-fade">
          <div v-if="showDatePicker" class="date-picker-modal">
            <div class="date-picker-overlay" @click="showDatePicker = false" />
            <div class="date-picker-content">
              <div class="date-picker-header">
                <h3>选择日期</h3>
                <button class="close-btn" @click="showDatePicker = false">×</button>
              </div>
              <div class="date-picker-list">
                <div
                  v-for="(date, index) in availableDates"
                  :key="date"
                  v-ripple
                  :class="['date-picker-item', { active: currentDateIndex === index }]"
                  @click="selectDateAndClose(index)"
                  v-html="formatDate(date, false)"
                />

                <div v-if="availableDates.length === 0" class="empty-dates">暂无排期日期</div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- 桌面端日期列表 -->
        <div class="date-list">
          <div
            v-for="(date, index) in availableDates"
            :key="date"
            v-ripple
            :class="['date-item', { active: currentDateIndex === index }]"
            @click="selectDate(index)"
            v-html="formatDate(date)"
          />

          <div v-if="availableDates.length === 0" class="empty-dates">暂无排期日期</div>
        </div>
        <!-- 添加滚动指示器 -->
        <div class="scroll-indicator-container">
          <div class="scroll-indicator" />
        </div>
      </div>

      <!-- 分隔线 - 添加径向渐变效果 -->
      <div class="vertical-divider" />

      <!-- 右侧排期内容 -->
      <div class="schedule-content">
        <div class="schedule-header">
          <h2 class="current-date" v-html="currentDateFormatted" />
          <button
            v-if="isNeteaseLoggedIn"
            class="add-playlist-btn"
            type="button"
            @click="handleAddToPlaylistClick"
          >
            <Icon :size="18" color="#ffffff" name="music" />
            <span>添加到歌单</span>
          </button>
        </div>

        <!-- 使用Transition组件包裹内容 -->
        <Transition mode="out-in" name="schedule-fade">
          <div v-if="loading" key="loading" class="loading">加载中...</div>

          <div v-else-if="error" key="error" class="error">
            {{ error }}
          </div>

          <div v-else-if="!schedules || schedules.length === 0" key="empty-all" class="empty">
            <div class="icon mb-4">🎵</div>
            <p>暂无排期信息</p>
            <p class="text-sm text-gray">点歌后等待管理员安排播出时间</p>
          </div>

          <div v-else-if="currentDateSchedules.length === 0" key="empty-date" class="empty">
            <div class="icon mb-4">📅</div>
            <p>当前日期暂无排期</p>
            <p>请选择其他日期查看</p>
          </div>

          <div v-else :key="currentDate" class="schedule-items">
            <!-- 按播出时段分组显示 -->
            <template v-if="schedulesByPlayTime && Object.keys(schedulesByPlayTime).length > 0">
              <div
                v-for="(schedules, playTimeId) in schedulesByPlayTime"
                :key="playTimeId"
                class="playtime-group"
              >
                <div v-if="shouldShowPlayTimeHeader(playTimeId)" class="playtime-header">
                  <h4 v-if="playTimeId === 'null'">未指定时段</h4>
                  <h4 v-else-if="getPlayTimeById(playTimeId)">
                    {{ getPlayTimeById(playTimeId).name }}
                    <span
                      v-if="
                        getPlayTimeById(playTimeId).startTime || getPlayTimeById(playTimeId).endTime
                      "
                      class="playtime-time"
                    >
                      ({{ formatPlayTimeRange(getPlayTimeById(playTimeId)) }})
                    </span>
                  </h4>
                </div>

                <div class="song-cards">
                  <div
                    v-for="schedule in schedules"
                    :key="schedule.id"
                    :class="{
                      played: schedule.song.played && schedule.song.replayRequestCount === 0,
                      playing: isCurrentPlaying(schedule.song.id)
                    }"
                    class="song-card"
                  >
                    <div class="song-card-main">
                      <!-- 歌曲封面 -->
                      <div class="song-cover" @click="togglePlaySong(schedule.song)">
                        <template v-if="schedule.song.cover">
                          <img
                            :alt="schedule.song.title"
                            :src="convertToHttps(schedule.song.cover)"
                            class="cover-image"
                            referrerpolicy="no-referrer"
                            @error="handleImageError($event, schedule.song)"
                          >
                        </template>
                        <div v-else class="text-cover">
                          {{ getFirstChar(schedule.song.title) }}
                        </div>
                        <!-- 播放按钮 (仅桌面端显示) -->
                        <div
                          v-if="
                            (schedule.song.musicPlatform && schedule.song.musicId) ||
                            schedule.song.playUrl
                          "
                          class="play-button-overlay"
                        >
                          <button
                            :title="isCurrentPlaying(schedule.song.id) ? '暂停' : '播放'"
                            class="play-button"
                          >
                            <Icon
                              v-if="isCurrentPlaying(schedule.song.id)"
                              :size="16"
                              color="white"
                              name="pause"
                            />
                            <Icon v-else :size="16" color="white" name="play" />
                          </button>
                        </div>
                      </div>

                      <div class="song-info">
                        <h3
                          :title="schedule.song.title + ' - ' + schedule.song.artist"
                          class="song-title"
                        >
                          <span class="title-text"
                            >{{ schedule.song.title }} - {{ schedule.song.artist }}</span
                          >
                          <!-- 重播标识 -->
                          <span
                            v-if="schedule.song.replayRequestCount > 0"
                            class="replay-badge"
                            title="重播歌曲"
                          >
                            <Icon name="repeat" :size="14" />
                          </span>
                        </h3>
                        <div class="song-meta">
                          <span
                            v-if="schedule.song.replayRequestCount > 0"
                            :title="
                              '重播申请人：' +
                              (schedule.song.replayRequesters || [])
                                .map((r) => r.displayName || r.name)
                                .join('、')
                            "
                            class="requester replay-requester"
                          >
                            申请人：{{
                              (schedule.song.replayRequesters || [])[0]
                                ? (schedule.song.replayRequesters[0].displayName ||
                                    schedule.song.replayRequesters[0].name) +
                                  (schedule.song.replayRequestCount > 1 ? '...' : '')
                                : '未知'
                            }}
                          </span>
                          <span
                            v-else
                            :title="
                              (schedule.song.collaborators && schedule.song.collaborators.length > 0
                                ? '主投稿人: '
                                : '投稿人: ') +
                              schedule.song.requester +
                              (schedule.song.collaborators && schedule.song.collaborators.length
                                ? '\n联合投稿: ' +
                                  schedule.song.collaborators
                                    .map((c) => c.displayName || c.name)
                                    .join(', ')
                                : '')
                            "
                            class="requester"
                          >
                            投稿人：{{ schedule.song.requester }}
                            <span
                              v-if="
                                schedule.song.collaborators &&
                                schedule.song.collaborators.length > 0
                              "
                            >
                              &
                              {{
                                schedule.song.collaborators
                                  .map((c) => c.displayName || c.name)
                                  .join(' & ')
                              }}
                            </span>
                          </span>
                        </div>
                      </div>

                      <!-- 人数展示 -->
                      <div class="action-area">
                        <div class="vote-count">
                          <span class="count">{{
                            schedule.song.replayRequestCount > 0
                              ? schedule.song.replayRequestCount
                              : schedule.song.voteCount
                          }}</span>
                          <span class="label">{{
                            schedule.song.replayRequestCount > 0 ? '重播' : '热度'
                          }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </div>

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
        v-if="showPlaylistModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        @click.self="closePlaylistModal"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between p-8 pb-4">
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
              >
                <Icon name="music" :size="24" />
              </div>
              <h3 class="text-xl font-black text-zinc-100 tracking-tight">添加到歌单</h3>
            </div>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
              type="button"
              @click="closePlaylistModal"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
            <div
              v-if="!isNeteaseLoggedIn"
              class="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                class="w-20 h-20 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-6"
              >
                <Icon name="music" :size="40" class="text-zinc-500 opacity-20" />
              </div>
              <p class="text-zinc-400 font-medium mb-8">需要登录网易云音乐账号才能管理歌单</p>
              <button
                class="px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black transition-all active:scale-95 shadow-xl shadow-blue-900/20"
                type="button"
                @click="openLoginFromPlaylist"
              >
                立即登录
              </button>
            </div>

            <div v-else class="space-y-8">
              <!-- 用户信息栏 -->
              <div
                v-if="neteaseUser"
                class="flex items-center p-4 bg-zinc-800/30 border border-zinc-800/50 rounded-2xl"
              >
                <div
                  class="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 mr-4 ring-2 ring-zinc-700/50"
                >
                  <img
                    v-if="neteaseUser.avatarUrl"
                    :src="neteaseUser.avatarUrl"
                    alt="avatar"
                    class="w-full h-full object-cover"
                  >
                  <Icon v-else name="user" :size="24" class="w-full h-full p-3 text-zinc-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <span
                    class="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-0.5"
                    >当前账号</span
                  >
                  <span class="block font-bold text-zinc-100 truncate">
                    {{ neteaseUser.nickname || neteaseUser.userName || '网易云用户' }}
                  </span>
                </div>
              </div>

              <!-- 歌单操作区域 -->
              <div class="space-y-6">
                <!-- 选择歌单 -->
                <div class="space-y-3">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >选择目标歌单</label
                  >
                  <div class="flex gap-3">
                    <CustomSelect
                      v-model="selectedPlaylistId"
                      :options="formattedPlaylists"
                      label-key="displayName"
                      value-key="id"
                      placeholder="请选择歌单"
                      class="flex-1"
                    />
                    <button
                      :disabled="playlistsLoading"
                      class="w-10 h-[38px] flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-all disabled:opacity-50"
                      title="刷新歌单列表"
                      type="button"
                      @click="reloadPlaylists"
                    >
                      <Icon
                        name="refresh"
                        :size="16"
                        :class="{ 'animate-spin': playlistsLoading }"
                      />
                    </button>
                  </div>

                  <div v-if="selectedPlaylistId" class="px-1 pt-1">
                    <button
                      :disabled="playlistActionLoading"
                      class="text-[10px] font-black text-red-400/60 hover:text-red-400 flex items-center gap-1.5 transition-colors uppercase tracking-wider"
                      type="button"
                      @click="handleDeletePlaylist"
                    >
                      <Icon name="trash" :size="14" />
                      删除当前歌单
                    </button>
                  </div>
                </div>

                <div class="relative py-2 flex items-center justify-center">
                  <div class="absolute inset-0 flex items-center px-8">
                    <div class="w-full border-t border-zinc-800/30" />
                  </div>
                  <span
                    class="relative px-4 bg-zinc-900 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]"
                    >或</span
                  >
                </div>

                <!-- 创建新歌单 -->
                <div class="space-y-4">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >创建新歌单</label
                  >
                  <div class="flex gap-3">
                    <input
                      v-model="newPlaylistName"
                      class="flex-1 px-5 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all"
                      placeholder="输入新歌单名称"
                      type="text"
                    >
                    <button
                      :disabled="!newPlaylistName.trim() || playlistActionLoading"
                      class="px-8 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest"
                      type="button"
                      @click="handleCreatePlaylist"
                    >
                      {{ playlistActionLoading ? '...' : '新建' }}
                    </button>
                  </div>
                  <label class="flex items-center gap-3 cursor-pointer group w-fit ml-1">
                    <div class="relative">
                      <input v-model="newPlaylistPrivacy" class="sr-only peer" type="checkbox" >
                      <div
                        class="w-9 h-5 bg-zinc-800 rounded-full border border-zinc-700 peer-checked:bg-blue-600 peer-checked:border-blue-500 transition-all"
                      />
                      <div
                        class="absolute left-1 top-1 w-3 h-3 bg-zinc-500 rounded-full transition-all peer-checked:left-5 peer-checked:bg-white"
                      />
                    </div>
                    <span
                      class="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors"
                      >设为隐私歌单</span
                    >
                  </label>
                </div>
              </div>

              <!-- 歌曲选择区域 -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-1">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    选择歌曲
                    <span
                      class="ml-2 px-2 py-0.5 rounded-md bg-blue-600/10 text-blue-500 text-[9px]"
                      >{{ selectedSongIds.length }} / {{ neteaseSongs.length }}</span
                    >
                  </label>
                  <div class="flex gap-4">
                    <button
                      class="text-[10px] font-black text-zinc-400 hover:text-blue-500 uppercase tracking-wider transition-colors"
                      type="button"
                      @click="selectAllNeteaseSongs"
                    >
                      全选
                    </button>
                    <button
                      class="text-[10px] font-black text-zinc-400 hover:text-red-400 uppercase tracking-wider transition-colors"
                      type="button"
                      @click="clearSelectedSongs"
                    >
                      清空
                    </button>
                  </div>
                </div>

                <div
                  v-if="neteaseSongs.length === 0"
                  class="flex flex-col items-center justify-center py-12 bg-zinc-950/30 border border-dashed border-zinc-800 rounded-3xl text-zinc-600"
                >
                  <Icon name="music" :size="32" class="mb-3 opacity-20" />
                  <p class="text-[10px] font-black uppercase tracking-widest">
                    当前日期没有来自网易云的歌曲
                  </p>
                </div>

                <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    v-for="song in neteaseSongs"
                    :key="song.id"
                    :class="[
                      'group flex items-center p-3.5 rounded-xl border transition-all cursor-pointer',
                      isSongSelected(song.id)
                        ? 'bg-blue-600/10 border-blue-500/30 shadow-lg'
                        : 'bg-zinc-950 border-transparent hover:border-zinc-800'
                    ]"
                    @click="toggleSongSelection(song.id)"
                  >
                    <div
                      :class="[
                        'w-5 h-5 rounded-lg border-2 flex items-center justify-center mr-3.5 transition-all',
                        isSongSelected(song.id)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-zinc-800 group-hover:border-zinc-700'
                      ]"
                    >
                      <Icon v-if="isSongSelected(song.id)" name="check" :size="12" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-bold truncate text-zinc-100">
                        {{ song.title }}
                      </div>
                      <div
                        class="text-[10px] font-black uppercase tracking-widest truncate mt-0.5 text-zinc-500"
                      >
                        {{ song.artist }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div v-if="isNeteaseLoggedIn" class="p-8 pt-0">
            <div class="flex gap-3">
              <button
                class="flex-1 px-6 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black transition-all active:scale-95 uppercase tracking-widest"
                type="button"
                @click="closePlaylistModal"
              >
                取消
              </button>
              <button
                :disabled="
                  !selectedPlaylistId || selectedSongIds.length === 0 || playlistActionLoading
                "
                class="flex-[2] px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                type="button"
                @click="handleAddSongsToPlaylist"
              >
                <Icon v-if="playlistActionLoading" name="loader" :size="16" class="animate-spin" />
                <Icon v-else name="plus" :size="16" />
                <span>{{ playlistActionLoading ? '正在添加...' : '确认添加' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <ConfirmDialog
      :loading="playlistActionLoading"
      :message="confirmDialog.message"
      :show="confirmDialog.show"
      :title="confirmDialog.title"
      :type="confirmDialog.type"
      @cancel="closeConfirmDialog"
      @close="closeConfirmDialog"
      @confirm="handleConfirmAction"
    />
  </Teleport>

  <Teleport to="body">
    <NeteaseLoginModal
      v-if="showLoginModal"
      :show="showLoginModal"
      @close="showLoginModal = false"
      @login-success="handleLoginSuccess"
    />
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Music, X, User, RefreshCw, Trash2, Check, Plus, Loader2 } from 'lucide-vue-next'
import { useSongs } from '~/composables/useSongs'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useMusicSources } from '~/composables/useMusicSources'
import Icon from '~/components/UI/Icon.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { convertToHttps } from '~/utils/url'
import NeteaseLoginModal from './NeteaseLoginModal.vue'
import {
  addSongsToPlaylist,
  createPlaylist,
  deletePlaylist,
  getUserPlaylists
} from '~/utils/neteaseApi'

const props = defineProps({
  schedules: {
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
  }
})

// 音频播放相关 - 使用全局音频播放器
const audioPlayer = useAudioPlayer()

// 获取播放时段启用状态
const { playTimeEnabled } = useSongs()

// 确保schedules不为null
const safeSchedules = computed(() => props.schedules || [])

// 日期选择器状态
const showDatePicker = ref(false)

const showPlaylistModal = ref(false)
const isNeteaseLoggedIn = ref(false)
const neteaseUser = ref(null)
const neteaseCookie = ref('')
const playlists = ref([])
const playlistsLoading = ref(false)
const formattedPlaylists = computed(() => {
  return playlists.value.map((pl) => ({
    ...pl,
    displayName: `${pl.name} (${pl.trackCount}首)`
  }))
})
const selectedPlaylistId = ref('')
const playlistActionLoading = ref(false)
const selectedSongIds = ref([])
const newPlaylistName = ref('')
const newPlaylistPrivacy = ref(false)
const showLoginModal = ref(false)

const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  type: 'warning',
  onConfirm: null
})

const isInitialized = ref(false)
const lastSelectedDate = ref('')

// 按日期分组排期
const safeGroupedSchedules = computed(() => {
  const groups = {}

  if (!safeSchedules.value || !safeSchedules.value.length) {
    return {}
  }

  safeSchedules.value.forEach((schedule) => {
    if (!schedule || !schedule.playDate) return

    try {
      // 使用UTC时间处理日期
      const scheduleDate = new Date(schedule.playDate)
      const date = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(schedule)
    } catch (err) {
      // 无需在此处记录错误
    }
  })

  // 按日期排序
  const sortedGroups = {}
  Object.keys(groups)
    .sort()
    .forEach((date) => {
      sortedGroups[date] = groups[date]
    })

  return sortedGroups
})

// 日期导航
const availableDates = computed(() => {
  return Object.keys(safeGroupedSchedules.value).sort()
})

const currentDateIndex = ref(0)

// 当前显示的日期
const currentDate = computed(() => {
  if (availableDates.value.length === 0) return ''
  return availableDates.value[currentDateIndex.value]
})

// 当日期列表变化时切换到今天日期
watch(
  availableDates,
  (newDates) => {
    if (newDates.length > 0) {
      // 如果已经初始化过且有上次选中的日期，尝试保持
      if (isInitialized.value && lastSelectedDate.value) {
        const index = newDates.indexOf(lastSelectedDate.value)
        if (index !== -1) {
          currentDateIndex.value = index
          return
        }
      }
      // 否则（首次加载或选中日期不存在），执行自动跳转逻辑
      findAndSelectTodayOrClosestDate()
    }
  },
  { immediate: false }
)

// 自动滚动到指定日期项的函数
const scrollToDateItem = async (index) => {
  if (isMobile.value) return // 移动端不需要滚动日期列表

  await nextTick() // 等待DOM更新

  const dateList = document.querySelector('.date-list')
  const dateItems = document.querySelectorAll('.date-item')

  if (!dateList || !dateItems || index >= dateItems.length) return

  const targetItem = dateItems[index]
  const listRect = dateList.getBoundingClientRect()
  const itemRect = targetItem.getBoundingClientRect()

  // 计算目标位置，使选中项居中显示
  const listCenter = listRect.height / 2
  const itemCenter = itemRect.height / 2
  const scrollTop = dateList.scrollTop + (itemRect.top - listRect.top) - listCenter + itemCenter

  // 平滑滚动到目标位置
  dateList.scrollTo({
    top: Math.max(0, scrollTop),
    behavior: 'smooth'
  })
}

// 提取日期选择逻辑到独立函数
const findAndSelectTodayOrClosestDate = async () => {
  if (availableDates.value.length === 0) return

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  let selectedIndex = 0

  // 在宽屏模式下，优先显示最近的日期（今天或之后最近的日期）
  if (!isMobile.value) {
    const todayTime = today.getTime()
    let closestFutureIndex = -1
    let minFutureDiff = Number.MAX_SAFE_INTEGER

    // 查找今天或之后最近的日期
    availableDates.value.forEach((dateStr, index) => {
      const dateParts = dateStr.split('-')
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      )
      const diff = date.getTime() - todayTime

      // 优先选择今天或未来的日期
      if (diff >= 0 && diff < minFutureDiff) {
        minFutureDiff = diff
        closestFutureIndex = index
      }
    })

    // 如果找到了今天或未来的日期，选择它
    if (closestFutureIndex >= 0) {
      selectedIndex = closestFutureIndex
    } else {
      // 如果没有今天或未来的日期，选择最近的过去日期
      let closestPastIndex = -1
      let minPastDiff = Number.MAX_SAFE_INTEGER

      availableDates.value.forEach((dateStr, index) => {
        const dateParts = dateStr.split('-')
        const date = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        )
        const diff = todayTime - date.getTime()

        if (diff > 0 && diff < minPastDiff) {
          minPastDiff = diff
          closestPastIndex = index
        }
      })

      if (closestPastIndex >= 0) {
        selectedIndex = closestPastIndex
      }
    }
  } else {
    // 移动端保持原有逻辑：优先选择今天
    const todayIndex = availableDates.value.findIndex((date) => date === todayStr)

    if (todayIndex >= 0) {
      // 如果找到今天的日期，则选择它
      selectedIndex = todayIndex
    } else {
      // 如果今天没有排期，找到最接近今天的日期
      const todayTime = today.getTime()
      let closestDate = -1
      let minDiff = Number.MAX_SAFE_INTEGER

      availableDates.value.forEach((dateStr, index) => {
        const dateParts = dateStr.split('-')
        const date = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        )
        const diff = Math.abs(date.getTime() - todayTime)

        if (diff < minDiff) {
          minDiff = diff
          closestDate = index
        }
      })

      if (closestDate >= 0) {
        selectedIndex = closestDate
      }
    }
  }

  // 设置选中的日期索引
  currentDateIndex.value = selectedIndex

  // 标记为已初始化并保存选中日期
  isInitialized.value = true
  lastSelectedDate.value = availableDates.value[selectedIndex]

  // 自动滚动到选中的日期项
  await scrollToDateItem(selectedIndex)
}

// 格式化当前日期
const currentDateFormatted = computed(() => {
  if (!currentDate.value) return '无日期'
  return formatDate(currentDate.value, isMobile.value)
})

// 当前日期的排期
const currentDateSchedules = computed(() => {
  if (!currentDate.value) return []
  return safeGroupedSchedules.value[currentDate.value] || []
})

const neteaseSongs = computed(() => {
  if (!currentDateSchedules.value || currentDateSchedules.value.length === 0) return []
  const map = new Map()
  for (const schedule of currentDateSchedules.value) {
    const song = schedule.song
    if (!song) continue
    const platform = song.musicPlatform
    const source = song.sourceInfo && song.sourceInfo.source
    const musicId = song.musicId
    if (!musicId) continue
    const isNetease = platform === 'netease' || source === 'netease-backup'
    if (!isNetease) continue
    if (!map.has(song.id)) {
      map.set(song.id, song)
    }
  }
  return Array.from(map.values())
})

// 上一个日期
const previousDate = async () => {
  if (currentDateIndex.value > 0) {
    currentDateIndex.value--
    // 在桌面端自动滚动到新选中的日期
    if (!isMobile.value) {
      await scrollToDateItem(currentDateIndex.value)
    }
  }
}

// 下一个日期
const nextDate = async () => {
  if (currentDateIndex.value < availableDates.value.length - 1) {
    currentDateIndex.value++
    // 在桌面端自动滚动到新选中的日期
    if (!isMobile.value) {
      await scrollToDateItem(currentDateIndex.value)
    }
  }
}

// 选择特定日期
const selectDate = async (index) => {
  currentDateIndex.value = index
  lastSelectedDate.value = availableDates.value[index]
  showDatePicker.value = false

  // 自动滚动到选中的日期项
  await scrollToDateItem(index)
}

// 切换日期选择器显示状态
const toggleDatePicker = async () => {
  showDatePicker.value = !showDatePicker.value

  // 如果弹窗打开，自动滚动到当前选中的日期
  if (showDatePicker.value) {
    await nextTick() // 等待DOM渲染完成
    scrollToSelectedDateInModal()
  }
}

// 在移动端弹窗中滚动到选中的日期项
const scrollToSelectedDateInModal = () => {
  const modalList = document.querySelector('.date-picker-list')
  const modalItems = document.querySelectorAll('.date-picker-item')

  if (!modalList || !modalItems || currentDateIndex.value >= modalItems.length) return

  const targetItem = modalItems[currentDateIndex.value]
  const listRect = modalList.getBoundingClientRect()
  const itemRect = targetItem.getBoundingClientRect()

  // 计算目标位置，使选中项在可视区域内，并增加向下偏移
  const listCenter = listRect.height / 2
  const itemCenter = itemRect.height / 2
  const downwardOffset = 280
  const scrollTop =
    modalList.scrollTop + (itemRect.top - listRect.top) - listCenter + itemCenter + downwardOffset

  // 确保滚动位置不会超出边界
  const maxScrollTop = modalList.scrollHeight - modalList.clientHeight
  const finalScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop))

  // 平滑滚动到目标位置
  modalList.scrollTo({
    top: finalScrollTop,
    behavior: 'smooth'
  })
}

// 选择日期并关闭弹窗
const selectDateAndClose = (index) => {
  currentDateIndex.value = index
  lastSelectedDate.value = availableDates.value[index]
  showDatePicker.value = false
}

// 重置日期到第一天
const resetDate = () => {
  currentDateIndex.value = 0
}

// 格式化日期
const formatDate = (dateStr, isMobile = false) => {
  try {
    // 解析日期字符串
    const parts = dateStr.split('-')
    if (parts.length !== 3) {
      throw new Error('无效的日期格式')
    }

    const year = parseInt(parts[0])
    const month = parseInt(parts[1])
    const day = parseInt(parts[2])

    // 创建日期对象
    const date = new Date(year, month - 1, day)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期')
    }

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]

    // 移动端显示更紧凑的格式
    if (isMobile) {
      return `${month}月${day}日 ${weekday}`
    }

    return `${year}年${month}月${day}日\n<span class="weekday">${weekday}</span>`
  } catch (e) {
    return dateStr || '未知日期'
  }
}

// 添加窗口大小变化监听
let resizeTimer = null
const isMobile = ref(window.innerWidth <= 768)

// 定义窗口大小变化处理函数
const handleResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(async () => {
    const wasMobile = isMobile.value
    isMobile.value = window.innerWidth <= 768

    // 如果从移动端切换到桌面端，需要重新滚动到当前选中的日期
    if (wasMobile && !isMobile.value && availableDates.value.length > 0) {
      await nextTick()
      await scrollToDateItem(currentDateIndex.value)
    }
  }, 100)
}

// 监听窗口大小变化
onMounted(async () => {
  window.addEventListener('resize', handleResize)
  // 初始化移动状态
  isMobile.value = window.innerWidth <= 768

  // 寻找今天的日期并自动选择 - 初始加载时也尝试一次
  findAndSelectTodayOrClosestDate()

  checkNeteaseLoginStatus()
})

// 组件销毁前移除事件监听器
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

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

const checkNeteaseLoginStatus = () => {
  if (typeof window === 'undefined') return
  const cookie = localStorage.getItem('netease_cookie')
  const userStr = localStorage.getItem('netease_user')
  if (cookie) {
    neteaseCookie.value = cookie
    isNeteaseLoggedIn.value = true
    if (userStr) {
      try {
        neteaseUser.value = JSON.parse(userStr)
      } catch (e) {
        neteaseUser.value = null
      }
    }
  } else {
    neteaseCookie.value = ''
    neteaseUser.value = null
    isNeteaseLoggedIn.value = false
  }
}

const handleLoginSuccess = (data) => {
  neteaseCookie.value = data.cookie
  neteaseUser.value = data.user
  isNeteaseLoggedIn.value = true
  if (typeof window !== 'undefined') {
    localStorage.setItem('netease_cookie', data.cookie)
    localStorage.setItem('netease_user', JSON.stringify(data.user))
  }
  showLoginModal.value = false
  if (showPlaylistModal.value) {
    reloadPlaylists()
  }
}

const handleAddToPlaylistClick = () => {
  if (!isNeteaseLoggedIn.value) {
    showLoginModal.value = true
    return
  }
  if (!neteaseSongs.value.length) {
    if (window.$showNotification) {
      window.$showNotification('当前日期排期中没有来自网易云音乐的歌曲', 'warning')
    }
    return
  }
  selectedSongIds.value = neteaseSongs.value.map((song) => song.id)
  showPlaylistModal.value = true
  reloadPlaylists()
}

const closePlaylistModal = () => {
  showPlaylistModal.value = false
}

const openLoginFromPlaylist = () => {
  showLoginModal.value = true
}

const reloadPlaylists = async () => {
  if (!isNeteaseLoggedIn.value || !neteaseCookie.value || !neteaseUser.value) return
  const uid = neteaseUser.value.userId || neteaseUser.value.id
  if (!uid) return
  playlistsLoading.value = true
  try {
    const { code, message, body } = await getUserPlaylists(uid, neteaseCookie.value)
    const list = body && Array.isArray(body.playlist) ? body.playlist : []
    if (code === 200 && Array.isArray(list)) {
      playlists.value = list
      if (!selectedPlaylistId.value && playlists.value.length > 0) {
        selectedPlaylistId.value = playlists.value[0].id
      }
    } else {
      if (window.$showNotification) {
        const text = message ? `获取歌单列表失败：${message}` : '获取歌单列表失败'
        window.$showNotification(text, 'error')
      }
    }
  } catch (error) {
    if (window.$showNotification) {
      window.$showNotification('获取歌单列表失败', 'error')
    }
  } finally {
    playlistsLoading.value = false
  }
}

const handleCreatePlaylist = async () => {
  const name = newPlaylistName.value.trim()
  if (!name) return
  if (!isNeteaseLoggedIn.value || !neteaseCookie.value) return
  playlistActionLoading.value = true
  try {
    const { code, message, body } = await createPlaylist(
      name,
      newPlaylistPrivacy.value,
      neteaseCookie.value
    )
    if (code === 200) {
      const createdId = body && (body.id || (body.playlist && body.playlist.id))
      if (window.$showNotification) {
        window.$showNotification('歌单创建成功', 'success')
      }
      newPlaylistName.value = ''
      await reloadPlaylists()
      if (createdId) {
        selectedPlaylistId.value = createdId
      }
    } else {
      if (window.$showNotification) {
        const text = message ? `歌单创建失败：${message}` : '歌单创建失败'
        window.$showNotification(text, 'error')
      }
    }
  } catch (error) {
    if (window.$showNotification) {
      window.$showNotification('歌单创建失败', 'error')
    }
  } finally {
    playlistActionLoading.value = false
  }
}

const handleDeletePlaylist = async () => {
  if (!selectedPlaylistId.value) return
  if (!isNeteaseLoggedIn.value || !neteaseCookie.value) return

  confirmDialog.value = {
    show: true,
    title: '删除歌单',
    message: '确定要删除当前歌单吗？此操作无法撤销。',
    type: 'danger',
    onConfirm: async () => {
      playlistActionLoading.value = true
      try {
        const { code, message } = await deletePlaylist(
          selectedPlaylistId.value,
          neteaseCookie.value
        )
        if (code === 200) {
          if (window.$showNotification) {
            window.$showNotification('歌单删除成功', 'success')
          }
          await reloadPlaylists()
          if (
            !playlists.value.find((pl) => pl.id === selectedPlaylistId.value) &&
            playlists.value.length > 0
          ) {
            selectedPlaylistId.value = playlists.value[0].id
          }
          closeConfirmDialog()
        } else {
          if (window.$showNotification) {
            const text = message ? `歌单删除失败：${message}` : '歌单删除失败'
            window.$showNotification(text, 'error')
          }
          // 失败也关闭弹窗，或者保留让用户重试？通常关闭比较好，避免死循环
          closeConfirmDialog()
        }
      } catch (error) {
        if (window.$showNotification) {
          window.$showNotification('歌单删除失败', 'error')
        }
        closeConfirmDialog()
      } finally {
        playlistActionLoading.value = false
      }
    }
  }
}

const closeConfirmDialog = () => {
  confirmDialog.value.show = false
  // 延迟清除回调，防止动画期间触发
  setTimeout(() => {
    confirmDialog.value.onConfirm = null
  }, 300)
}

const handleConfirmAction = () => {
  if (confirmDialog.value.onConfirm) {
    confirmDialog.value.onConfirm()
  }
}

const isSongSelected = (songId) => {
  return selectedSongIds.value.includes(songId)
}

const toggleSongSelection = (songId) => {
  const index = selectedSongIds.value.indexOf(songId)
  if (index === -1) {
    selectedSongIds.value.push(songId)
  } else {
    selectedSongIds.value.splice(index, 1)
  }
}

const selectAllNeteaseSongs = () => {
  selectedSongIds.value = neteaseSongs.value.map((song) => song.id)
}

const clearSelectedSongs = () => {
  selectedSongIds.value = []
}

const handleAddSongsToPlaylist = async () => {
  if (!selectedPlaylistId.value) return
  if (!isNeteaseLoggedIn.value || !neteaseCookie.value) return
  const tracks = neteaseSongs.value
    .filter((song) => selectedSongIds.value.includes(song.id))
    .map((song) => song.musicId)
    .filter((id) => !!id)
  if (!tracks.length) {
    if (window.$showNotification) {
      window.$showNotification('请先选择要添加的歌曲', 'warning')
    }
    return
  }
  playlistActionLoading.value = true
  try {
    const { code, message } = await addSongsToPlaylist(
      selectedPlaylistId.value,
      tracks,
      neteaseCookie.value
    )
    if (code === 200) {
      if (window.$showNotification) {
        window.$showNotification(`成功添加 ${tracks.length} 首歌曲到歌单`, 'success')
      }
      showPlaylistModal.value = false
    } else {
      if (window.$showNotification) {
        const text = message ? `添加到歌单失败：${message}` : '添加到歌单失败'
        window.$showNotification(text, 'error')
      }
    }
  } catch (error) {
    if (window.$showNotification) {
      window.$showNotification('添加到歌单失败', 'error')
    }
  } finally {
    playlistActionLoading.value = false
  }
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
    if (currentGlobalSong && currentGlobalSong.musicUrl) {
      // 如果有URL，直接恢复播放
      audioPlayer.playSong(currentGlobalSong)
    } else {
      // 如果没有URL，重新获取
      if ((song.musicPlatform && song.musicId) || song.playUrl) {
        try {
          const url = await getMusicUrl(song)
          if (url) {
            const playableSong = {
              ...song,
              musicUrl: url
            }
            audioPlayer.playSong(playableSong)
          } else {
            if (window.$showNotification) {
              window.$showNotification('无法获取音乐播放链接，请稍后再试', 'error')
            }
          }
        } catch (error) {
          console.error('获取音乐URL失败:', error)
          if (window.$showNotification) {
            window.$showNotification('获取音乐播放链接失败', 'error')
          }
        }
      }
    }
    return
  }

  // 如果有平台和ID信息或playUrl，动态获取URL
  if ((song.musicPlatform && song.musicId) || song.playUrl) {
    try {
      const url = await getMusicUrl(song)
      if (url) {
        // 构建当前时段的播放列表
        const currentTimeSlot = getCurrentTimeSlot(song)
        let playlist = []
        let songIndex = 0

        if (currentTimeSlot && currentTimeSlot.songs) {
          // 构建播放列表但不阻塞当前播放，后续后台预取
          playlist = currentTimeSlot.songs.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            cover: s.cover,
            musicUrl: s.musicUrl || null,
            musicPlatform: s.musicPlatform,
            musicId: s.musicId,
            playUrl: s.playUrl || null,
            sourceInfo: s.sourceInfo
          }))

          // 找到当前歌曲在播放列表中的索引
          songIndex = playlist.findIndex((s) => s.id === song.id)
          if (songIndex === -1)
            songIndex = 0

            // 后台预取后续歌曲的播放链接（不阻塞当前播放）
          ;(async () => {
            for (let i = songIndex + 1; i < playlist.length; i++) {
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

        const playableSong = {
          ...song,
          musicUrl: url
        }

        // 更新播放列表中当前歌曲的URL
        if (playlist.length > 0 && songIndex >= 0) {
          playlist[songIndex] = playableSong
        }

        audioPlayer.playSong(playableSong, playlist, songIndex)
      } else {
        if (window.$showNotification) {
          window.$showNotification('无法获取音乐播放链接，请稍后再试', 'error')
        }
      }
    } catch (error) {
      console.error('获取音乐URL失败:', error)
      if (window.$showNotification) {
        window.$showNotification('获取音乐播放链接失败', 'error')
      }
    }
  }
}

// 获取歌曲所在的时段
const getCurrentTimeSlot = (song) => {
  if (!schedulesByPlayTime.value) return null

  for (const [playTimeId, schedules] of Object.entries(schedulesByPlayTime.value)) {
    if (schedules.some((schedule) => schedule.song.id === song.id)) {
      return {
        id: playTimeId,
        songs: schedules.map((schedule) => schedule.song)
      }
    }
  }
  return null
}

// 动态获取音乐URL
const getMusicUrl = async (song) => {
  const { musicPlatform: platform, musicId, playUrl, sourceInfo } = song

  // 如果有自定义播放链接，优先使用
  if (playUrl && playUrl.trim()) {
    console.log(`[ScheduleList] 使用自定义播放链接: ${playUrl}`)
    return playUrl.trim()
  }

  // 如果没有playUrl，检查platform和musicId是否有效
  if (!platform || !musicId) {
    throw new Error('歌曲缺少音乐平台或音乐ID信息，无法获取播放链接')
  }

  const { getQuality } = useAudioQuality()
  const { getSongUrl } = useMusicSources()

  const quality = getQuality(platform)

  // 使用统一组件的音源选择逻辑
  console.log(
    `[ScheduleList] 使用统一音源选择逻辑获取播放链接: platform=${platform}, musicId=${musicId}`
  )

  // 检查是否为播客内容
  const isPodcast =
    platform === 'netease-podcast' ||
    sourceInfo?.type === 'voice' ||
    (sourceInfo?.source === 'netease-backup' && sourceInfo?.type === 'voice')

  // 如果是播客内容，强制 unblock=false
  const options = isPodcast ? { unblock: false } : {}

  const result = await getSongUrl(musicId, quality, platform, undefined, options)
  if (result?.success && result.url) {
    console.log('[ScheduleList] 统一音源选择获取音乐URL成功')
    return result.url
  }
  console.warn('[ScheduleList] 统一音源选择未返回有效链接，回退到直接调用 vkeys')

  // 回退到 vkeys
  let apiUrl
  if (platform === 'netease') {
    apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
  } else if (platform === 'tencent') {
    apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
  } else {
    throw new Error('不支持的音乐平台')
  }

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error('vkeys API请求失败')
  }

  const data = await response.json()
  if (data.code === 200 && data.data && data.data.url) {
    // 将HTTP URL改为HTTPS
    let url = data.data.url
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://')
    }
    console.log('[ScheduleList] vkeys API获取音乐URL成功')
    return url
  }

  throw new Error('所有音源都无法获取音乐播放链接')
}

// 判断当前是否正在播放指定ID的歌曲
const isCurrentPlaying = (songId) => {
  return audioPlayer.isCurrentPlaying(songId)
}

// 格式化播放时间
const formatPlayTime = (schedule) => {
  try {
    // 根据歌曲播放状态显示不同文本
    if (schedule.song && schedule.song.played) {
      return '已播放'
    } else {
      return '已排期'
    }
  } catch (e) {
    return '时间未定'
  }
}

// 按播出时段分组的排期
const schedulesByPlayTime = computed(() => {
  if (!currentDateSchedules.value || currentDateSchedules.value.length === 0) {
    return null
  }

  const grouped = {}

  // 先对排期按时段和序号排序
  const sortedSchedules = [...currentDateSchedules.value].sort((a, b) => {
    // 先按时段分组，确保转换为字符串
    const playTimeIdA =
      a.playTimeId !== null && a.playTimeId !== undefined ? String(a.playTimeId) : 'null'
    const playTimeIdB =
      b.playTimeId !== null && b.playTimeId !== undefined ? String(b.playTimeId) : 'null'

    if (playTimeIdA !== playTimeIdB) {
      // 未指定时段排在最后
      if (playTimeIdA === 'null') return 1
      if (playTimeIdB === 'null') return -1
      // 使用数字比较而不是字符串比较
      return parseInt(playTimeIdA) - parseInt(playTimeIdB)
    }

    // 时段相同则按序号排序
    return a.sequence - b.sequence
  })

  // 分组
  for (const schedule of sortedSchedules) {
    // 确保正确处理播放时段ID
    const playTimeId =
      schedule.playTimeId !== null && schedule.playTimeId !== undefined
        ? String(schedule.playTimeId)
        : 'null'

    if (!grouped[playTimeId]) {
      grouped[playTimeId] = []
    }

    grouped[playTimeId].push(schedule)
  }

  return grouped
})

// 根据ID获取播出时段信息
const getPlayTimeById = (id) => {
  if (id === 'null') return null

  try {
    const numId = parseInt(id)
    if (isNaN(numId)) return null

    // 从排期中查找
    for (const schedule of currentDateSchedules.value) {
      // 确保正确比较
      if (schedule.playTimeId === numId && schedule.playTime) {
        return schedule.playTime
      }
    }
  } catch (err) {
    // 无需在此处记录错误
  }

  return null
}

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`
  } else if (playTime.startTime) {
    return `${playTime.startTime} 开始`
  } else if (playTime.endTime) {
    return `${playTime.endTime} 结束`
  }

  return '不限时间'
}

// 判断是否显示播放时段标题
const shouldShowPlayTimeHeader = (playTimeId) => {
  // 如果播放时段功能未启用且是未指定时段，则不显示
  if (!playTimeEnabled.value && playTimeId === 'null') {
    return false
  }
  return true // 显示其他所有时段
}

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
.schedule-list {
  width: 100% !important;
  position: relative;
  box-sizing: border-box;
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  display: flex;
  flex-direction: column;
  flex: 1; /* 占满父容器高度 */
  min-height: 0; /* 允许 flex 子元素收缩 */
}

/* 学期选择器样式 */
.semester-selector {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(11, 90, 254, 0.1) 0%, rgba(33, 36, 45, 0.9) 100%);
  border-radius: 12px;
  border: 1px solid rgba(11, 90, 254, 0.2);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.semester-label {
  color: #ffffff;
  font-size: 15px;
  font-weight: 500;
  margin-right: 0.75rem;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.semester-select {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  color: #ffffff;
  padding: 0.6rem 1rem;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 180px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.semester-select:hover {
  background: linear-gradient(135deg, rgba(11, 90, 254, 0.2) 0%, rgba(255, 255, 255, 0.15) 100%);
  border-color: rgba(11, 90, 254, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(11, 90, 254, 0.2);
}

.semester-select:focus {
  outline: none;
  border-color: #0b5afe;
  box-shadow:
    0 0 0 3px rgba(11, 90, 254, 0.3),
    0 4px 12px rgba(11, 90, 254, 0.2);
  transform: translateY(-1px);
}

.semester-select option {
  background: #1a1d24;
  color: #ffffff;
  padding: 0.5rem;
}

/* 两列布局容器 */
.schedule-container {
  display: flex;
  gap: 0; /* 移除间隙，使用分隔线 */
  width: 100% !important;
  box-sizing: border-box;
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 允许 flex 子元素收缩 */
}

/* 左侧日期选择器 */
.date-selector {
  width: 200px;
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%; /* 占满容器高度 */
  min-height: 0; /* 允许 flex 子元素收缩 */
}

.date-list {
  flex: 1; /* 占据剩余空间 */
  overflow-y: auto;
  width: 100%;
  min-height: 0; /* 允许 flex 子元素收缩 */
}

/* 增强日期项目样式 */
.date-item {
  padding: 0.8rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  white-space: pre-line;
  text-align: left;
  line-height: 1.4;
  position: relative;
  overflow: hidden;
}

.date-item:hover {
  background: #21242d;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.date-item.active {
  background: #21242d;
  color: #ffffff;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(11, 90, 254, 0.2);
  border-left: 3px solid #0b5afe;
}

.empty-dates {
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.weekday {
  display: block;
  font-size: 12px;
  opacity: 0.7;
  margin-top: 2px;
}

/* 垂直分隔线 */
.vertical-divider {
  width: 2px;
  background: linear-gradient(
    180deg,
    rgba(217, 217, 217, 0) 0%,
    rgba(217, 217, 217, 0.5) 50%,
    rgba(217, 217, 217, 0) 100%
  );
  margin: 0 1.5rem;
  position: relative;
  align-self: stretch; /* 占满父容器高度 */
  flex-shrink: 0;
}

/* 右侧排期内容 */
.schedule-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 250px); /* 缩小右侧内容区域宽度 */
  display: flex;
  flex-direction: column;
  height: 100%; /* 占满容器高度 */
  min-height: 0; /* 允许 flex 子元素收缩 */
}

.schedule-header {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0; /* 防止被压缩 */
}

.current-date {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 20px;
  color: #ffffff;
  margin: 0;
}

/* 加载和错误状态 */
.loading {
  padding: 3rem;
  text-align: center;
  border-radius: 10px;
  background: #21242d;
  margin: 1rem 0;
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

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error,
.empty {
  padding: 2rem;
  text-align: center;
  border-radius: 10px;
  background: #21242d;
  margin: 1rem 0;
  color: rgba(255, 255, 255, 0.6);
}

.error {
  color: #ef4444;
}

.empty .icon {
  font-size: 3rem;
  opacity: 0.5;
}

/* 排期内容区域 */
.schedule-items {
  flex: 1; /* 占据剩余空间 */
  overflow-y: auto; /* 允许滚动 */
  min-height: 0; /* 允许 flex 子元素收缩 */
}

/* 排期时段分组 */
.playtime-group {
  margin-bottom: 2rem;
}

.playtime-header h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 1rem 0;
}

.playtime-time {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 0.5rem;
}

/* 歌曲卡片样式 */
.song-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.song-card {
  width: 320px;
  flex-shrink: 0;
  background: #21242d;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

/* ----------------------------------
   添加歌单按钮
   ---------------------------------- */
.add-playlist-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-playlist-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.2);
}

.add-playlist-btn:active {
  transform: translateY(0);
}

.add-playlist-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ----------------------------------
   歌单模态框
   ---------------------------------- */
.playlist-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.playlist-modal {
  width: 100%;
  max-width: 580px;
  max-height: 85vh;
  background: #1e1e24;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 头部样式 */
.playlist-modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 30, 36, 0.95);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  color: var(--primary);
}

.playlist-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.playlist-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.playlist-modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: rotate(90deg);
}

/* 内容区域 */
.playlist-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: #1e1e24;
}

/* 滚动条美化 */
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

/* 登录提示 */
.login-prompt-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.login-icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(102, 126, 234, 0.05) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  color: var(--primary);
}

.login-hint {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
  font-size: 15px;
}

.full-width {
  width: 100%;
  justify-content: center;
  padding: 0.8rem;
  font-size: 15px;
}

/* 用户信息栏 */
.user-profile-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #2a2a32;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(102, 126, 234, 0.2);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 600;
  color: #ffffff;
  font-size: 15px;
}

.user-status {
  font-size: 12px;
  color: var(--success);
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-status::before {
  content: '';
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--success);
}

/* 控制面板（歌单选择与创建） */
.control-panel {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 1.5rem;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 创建新歌单的输入组样式优化 */
.input-group {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  position: relative; /* 确保定位上下文 */
  width: 100%; /* 占满父容器宽度 */
}

.input-group .custom-input {
  flex: 1;
  width: 0; /* 允许flex缩小 */
  min-width: 0; /* 防止内容溢出 */
}

/* 确保按钮不被挤压，且不溢出 */
.input-group .btn-secondary {
  flex-shrink: 0;
  white-space: nowrap;
  margin-left: auto; /* 在必要时推向右侧 */
}

.select-wrapper {
  position: relative;
  flex: 1;
}

.custom-select,
.custom-input {
  width: 100%;
  background: #141418;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s ease;
  appearance: none;
}

.custom-select {
  padding-right: 2.5rem;
  cursor: pointer;
}

.select-arrow {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: rgba(255, 255, 255, 0.4);
}

.custom-select:focus,
.custom-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: #1a1a20;
}

.btn-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

.playlist-actions-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -0.25rem;
}

.btn-text-danger {
  background: none;
  border: none;
  color: rgba(239, 68, 68, 0.8);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.btn-text-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.divider {
  display: flex;
  align-items: center;
  margin: 1.25rem 0;
  color: rgba(255, 255, 255, 0.2);
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.divider span {
  padding: 0 1rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  width: fit-content;
}

.checkbox-wrapper input {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  position: relative;
  transition: all 0.2s ease;
}

.checkbox-wrapper input:checked + .checkbox-custom {
  background: var(--primary);
  border-color: var(--primary);
}

.checkbox-wrapper input:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

/* 歌曲选择面板 */
.songs-selection-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-top: 0.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding: 0 0.25rem;
}

.highlight-count {
  color: var(--primary);
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 1rem;
}

.btn-text {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.btn-text:hover {
  text-decoration: underline;
}

.songs-list {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  margin-bottom: 4px;
}

.song-item:last-child {
  margin-bottom: 0;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.song-item.selected {
  background: rgba(11, 90, 254, 0.1);
  border-color: rgba(11, 90, 254, 0.2);
}

.song-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.song-item.selected .song-checkbox {
  background: var(--primary);
  border-color: var(--primary);
}

.song-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-name {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  margin-bottom: 0;
}

.song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

/* 底部按钮栏 */
.playlist-modal-footer {
  padding: 1.25rem 1.5rem;
  background: rgba(30, 30, 36, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn-primary,
.btn-secondary,
.btn-ghost {
  padding: 0.6rem 1.25rem;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.35);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

/* 动画定义 */
@keyframes modal-slide-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* 移动端添加歌单按钮 */
.mobile-add-playlist-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  cursor: pointer;
  margin-right: 0.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.mobile-add-playlist-btn:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.2);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .mobile-add-playlist-btn {
    display: flex;
  }

  .playlist-modal {
    max-width: 100%;
    width: 100%;
    height: auto;
    max-height: 90vh;
    border-radius: 16px;
  }

  .playlist-modal-body {
    padding: 1rem;
  }

  .control-panel {
    padding: 1rem;
  }

  .playlist-modal-footer {
    padding: 1rem;
    flex-direction: column-reverse;
  }

  .playlist-modal-footer button {
    width: 100%;
  }

  /* 移动端创建歌单输入组改为垂直排列 */
  .input-group.create-playlist-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .input-group.create-playlist-group .custom-input {
    width: 100%;
    flex: none;
  }

  .input-group.create-playlist-group .btn-secondary {
    width: 100%;
    margin-left: 0;
    justify-content: center;
  }
}

/* 针对不同屏幕尺寸的响应式调整 */
@media (max-width: 1400px) {
  .song-card {
    width: 300px;
  }
}

@media (max-width: 1200px) {
  .song-card {
    width: 280px;
  }
}

@media (max-width: 1024px) {
  .song-card {
    width: calc(50% - 0.5rem);
  }
}

@media (max-width: 768px) {
  .song-card {
    width: 100%;
  }
}

.song-card-main {
  padding: 1rem;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  position: relative;
  height: 90px; /* 减小卡片高度 */
  display: flex; /* 使用flex布局 */
  align-items: center; /* 垂直居中 */
  gap: 15px; /* 元素之间的间隔 */
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
  font-family: 'MiSans', sans-serif;
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

.play-icon {
  margin-left: 2px;
}

.pause-icon {
  font-size: 10px;
}

.song-info {
  width: calc(70% - 75px); /* 减去封面宽度和间距 */
}

.song-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: #ffffff;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  line-height: 1.4;
  overflow: hidden;
}

.title-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 重播标识 */
.replay-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  background: rgba(11, 90, 254, 0.15);
  border: 1px solid rgba(11, 90, 254, 0.3);
  border-radius: 4px;
  color: #0b5afe;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  cursor: help;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
}

.replay-badge:hover {
  background: rgba(11, 90, 254, 0.25);
  border-color: rgba(11, 90, 254, 0.5);
}

.song-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.requester {
  font-family: 'MiSans', sans-serif;
  font-weight: normal;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: left;
}

/* 重播申请人数样式 */
.replay-requester {
  /* 使用和普通投稿人相同的颜色 */
  color: rgba(255, 255, 255, 0.4);
  font-weight: normal;
  cursor: help;
}

/* 热度样式 */
.action-area {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
}

.vote-count {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vote-count .count {
  font-family: 'MiSans', sans-serif;
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
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #ffffff;
  opacity: 0.4;
}

/* ==================== 移动端设计 ==================== */

@media (max-width: 768px) {
  .schedule-list {
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
    min-height: auto;
  }

  .schedule-container {
    flex-direction: column;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    gap: 12px;
    min-height: auto;
  }

  .date-selector {
    width: 100% !important;
    max-width: 100% !important;
    margin-bottom: 0;
    padding: 0 !important;
  }

  /* 移动端日期导航 - 胶囊式设计 */
  .mobile-date-nav {
    display: flex !important;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100% !important;
    padding: 16px 12px !important;
    background: transparent !important;
    box-sizing: border-box;
  }

  .nav-capsule {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px;
    flex: 1;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    transition: all 0.2s ease;
  }

  .nav-btn:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #0b5afe;
  }

  .nav-btn:disabled {
    opacity: 0.2;
  }

  .current-date-display {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 8px;
    height: 36px;
    cursor: pointer;
  }

  .date-text {
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    text-shadow:
      0 0 10px rgba(255, 255, 255, 0.2),
      0 0 20px rgba(11, 90, 254, 0.15);
  }

  .dropdown-icon {
    opacity: 0.5;
    color: #ffffff;
  }

  .mobile-action-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0b5afe 0%, #0043f8 100%);
    border: none;
    border-radius: 16px;
    box-shadow: 0 4px 15px rgba(11, 90, 254, 0.4);
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .mobile-action-btn:active {
    transform: scale(0.92);
    box-shadow: 0 2px 8px rgba(11, 90, 254, 0.4);
  }

  /* 移除旧样式 */
  .date-nav-btn,
  .current-date-mobile,
  .mobile-add-playlist-btn {
    display: none;
  }

  /* 隐藏桌面端日期列表 */
  .date-list {
    height: 0;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    position: absolute;
  }

  .scroll-indicator-container {
    display: none;
  }

  .mobile-scroll-hint {
    display: none;
  }

  .vertical-divider {
    display: none;
  }

  .schedule-content {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box;
    min-height: auto;
  }

  /* 隐藏桌面端日期标题 */
  .schedule-header {
    display: none;
  }

  /* 时段标题 */
  .playtime-group {
    margin-bottom: 20px;
  }

  .playtime-header {
    padding: 0 4px;
    margin-bottom: 12px;
  }

  .playtime-header h4 {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .playtime-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  /* 歌曲卡片 - 无边框卡片设计 */
  .song-cards {
    gap: 8px;
    display: flex;
    flex-direction: column;
  }

  .song-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 18px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .song-card.playing {
    background: rgba(11, 90, 254, 0.18);
    border-color: rgba(11, 90, 254, 0.5);
    box-shadow: 0 0 20px rgba(11, 90, 254, 0.3);
  }

  .song-card.playing .song-title {
    color: #0b5afe;
    text-shadow: 0 0 10px rgba(11, 90, 254, 0.4);
  }

  .song-card:active {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .song-card.played {
    opacity: 0.8;
    filter: grayscale(0.35);
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .song-card-main {
    height: auto;
    min-height: 72px;
    padding: 14px;
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    margin: 0;
  }

  .action-area {
    position: static;
    transform: none;
    margin-left: auto;
    padding-left: 8px;
    flex-shrink: 0;
  }

  /* 歌曲封面 - 更大的圆角 */
  .song-cover {
    width: 48px;
    height: 48px;
    aspect-ratio: 1;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .text-cover {
    font-size: 20px;
  }

  /* 播放按钮 */
  .play-button-overlay {
    display: none !important;
  }

  .song-cover {
    cursor: pointer;
  }

  .song-cover:active {
    transform: scale(0.95);
  }

  .song-info {
    flex: 1;
    min-width: 0;
    padding-right: 4px;
  }

  .song-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 2px;
    line-height: 1.4;
    color: #ffffff;
    letter-spacing: 0.01em;
  }

  .requester {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 400;
  }

  /* 热度区域 */
  .vote-count .count {
    font-size: 22px;
    font-weight: 800;
    color: #0b5afe;
    font-family: 'MiSans-Bold', sans-serif;
    line-height: 1;
  }

  .vote-count .label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 2px;
  }

  /* 加载和空状态 - 无边框 */
  .loading,
  .error,
  .empty {
    padding: 40px 20px;
    width: 100%;
    background: transparent;
    border-radius: 0;
    margin: 0;
  }

  .loading::before {
    width: 32px;
    height: 32px;
    border-width: 2px;
  }

  .empty .icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
  }

  /* 日期选择弹窗 */
  .date-picker-content {
    background: #1a1a1f;
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-width: 100%;
    max-height: 70vh;
    border: none;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
  }

  .date-picker-header {
    padding: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .date-picker-header h3 {
    font-size: 17px;
    font-weight: 600;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .date-picker-list {
    padding: 12px;
  }

  .date-picker-item {
    padding: 14px 16px;
    border-radius: 12px;
    margin-bottom: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: none;
    font-size: 14px;
  }

  .date-picker-item:hover {
    background: rgba(255, 255, 255, 0.06);
    transform: none;
  }

  .date-picker-item.active {
    background: rgba(11, 90, 254, 0.15);
    border-left: none;
    color: #0b5afe;
  }
}

/* 小屏幕设备额外优化 */
@media (max-width: 480px) {
  .mobile-date-nav {
    padding: 10px 0 !important;
  }

  .date-nav-btn {
    width: 32px;
    height: 32px;
  }

  .current-date-mobile {
    font-size: 14px;
    padding: 6px 12px;
    border-radius: 10px;
  }

  .song-card-main {
    min-height: 60px;
    padding: 10px;
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

  .play-button {
    width: 24px;
    height: 24px;
  }
}

/* 添加日期切换过渡动画 */
.schedule-fade-enter-active,
.schedule-fade-leave-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}

.schedule-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.schedule-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 波纹效果样式 */
.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(0);
  animation: ripple 0.6s linear;
  pointer-events: none;
  width: 100px;
  height: 100px;
  margin-left: -50px;
  margin-top: -50px;
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* 左侧日期选择器 - 移除背景和边框 */
.date-selector {
  width: 200px;
  flex-shrink: 0;
}

.date-list {
  max-height: 500px;
  overflow-y: auto;
}

/* 移动端滑动提示 */
.mobile-scroll-hint {
  display: none;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.5rem;
}

/* 滚动指示器 */
.scroll-indicator-container {
  display: none;
  width: 100%;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.1);
  margin-top: 0.5rem;
  border-radius: 1px;
  overflow: hidden;
}

.scroll-indicator {
  height: 100%;
  width: 20%;
  background-color: rgba(11, 90, 254, 0.6);
  border-radius: 1px;
  animation: scroll-hint 1.5s infinite;
}

@keyframes scroll-hint {
  0% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(400%);
  }
  100% {
    transform: translateX(0);
  }
}

/* 移动端日期导航 */
.mobile-date-nav {
  display: none;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  background: #21242d;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  position: relative;
  z-index: 10;
  min-width: 100%;
}

.date-nav-btn {
  background: rgba(11, 90, 254, 0.1);
  border: 1px solid rgba(11, 90, 254, 0.2);
  color: #ffffff;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.date-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.date-nav-btn:hover:not(:disabled) {
  background: rgba(11, 90, 254, 0.2);
}

.current-date-mobile {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
  text-align: center;
  flex: 1;
  white-space: pre-line;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.current-date-mobile:after {
  content: '▼';
  font-size: 10px;
  opacity: 0.7;
  margin-left: 5px;
  display: inline-block;
  vertical-align: middle;
}

.current-date-mobile:hover {
  color: #0b5afe;
}

/* 日期选择器弹窗样式 */
.date-picker-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.date-picker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
}

.date-picker-content {
  position: relative;
  width: 85%;
  max-width: 350px;
  max-height: 70vh;
  background: #1a1d24;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: scale-in 0.2s ease;
  display: flex;
  flex-direction: column;
}

.date-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.date-picker-header h3 {
  margin: 0;
  font-size: 16px;
  color: white;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 22px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
}

.date-picker-list {
  padding: 1rem;
  overflow-y: auto;
  max-height: 60vh;
}

.date-picker-item {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  white-space: pre-line;
}

.date-picker-item:hover {
  background: rgba(11, 90, 254, 0.1);
  transform: translateY(-2px);
}

.date-picker-item.active {
  background: rgba(11, 90, 254, 0.2);
  border-left: 3px solid #0b5afe;
}

/* 过渡动画 */
.date-picker-fade-enter-active,
.date-picker-fade-leave-active {
  transition: opacity 0.2s ease;
}

.date-picker-fade-enter-from,
.date-picker-fade-leave-to {
  opacity: 0;
}

@keyframes scale-in {
  0% {
    transform: scale(0.9);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
