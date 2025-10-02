<template>
  <div class="song-list">
    <!-- 移除顶部径向渐变 -->
    
    <div class="song-list-header">
      <div class="tab-controls">
        <button 
          class="tab-button" 
          :class="{ 'active': activeTab === 'all' }"
          @click="setActiveTab('all')"
          v-ripple
        >
          全部投稿
        </button>
        <button 
          class="tab-button" 
          :class="{ 'active': activeTab === 'mine' }"
          @click="setActiveTab('mine')"
          v-if="isAuthenticated"
          v-ripple
        >
          我的投稿
        </button>
      </div>
      
      <div class="search-actions">
        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="输入想要搜索的歌曲" 
            class="search-input"
          />
          <span class="search-icon">🔍</span>
        </div>
        
        <!-- 学期选择器 -->
        <div v-if="availableSemesters.length > 1" class="semester-selector-compact">
          <button 
            class="semester-toggle-btn"
            @click="showSemesterDropdown = !showSemesterDropdown"
            :title="'当前学期: ' + selectedSemester"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>
            </svg>
          </button>
          
          <div v-if="showSemesterDropdown" class="semester-dropdown">
            <div 
              v-for="semester in availableSemesters" 
              :key="semester"
              class="semester-option"
              :class="{ 'active': selectedSemester === semester }"
              @click="onSemesterChange(semester)"
            >
              {{ semester }}
            </div>
          </div>
        </div>
        
        <!-- 添加刷新按钮 - 使用SVG图标 -->
        <button 
          class="refresh-button"
          @click="handleRefresh"
          :disabled="loading"
          :title="loading ? '正在刷新...' : '刷新歌曲列表'"
        >
          <svg class="refresh-icon" :class="{ 'rotating': loading }" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 使用Transition组件包裹所有内容 -->
    <Transition name="tab-switch" mode="out-in">
      <div v-if="loading" class="loading" :key="'loading'">
        加载中...
      </div>
      
      <div v-else-if="error" class="error" :key="'error'">
        {{ error }}
      </div>
      
      <div v-else-if="displayedSongs.length === 0" class="empty" :key="'empty-' + activeTab">
        {{ activeTab === 'mine' ? '您还没有投稿歌曲，马上去点歌吧！' : '暂无歌曲，马上去点歌吧！' }}
      </div>
      
      <div v-else class="songs-container" :key="'songs-' + activeTab">
        <TransitionGroup 
          name="page" 
          tag="div" 
          class="song-cards"
        >
          <div 
            v-for="song in paginatedSongs" 
            :key="song.id" 
            class="song-card"
            :class="{ 'played': song.played, 'scheduled': song.scheduled, 'focused': isSongFocused(song.id) }"
            @click="handleSongCardClick(song)"
          >
            <!-- 歌曲卡片主体 -->
            <div class="song-card-main">
              <!-- 添加歌曲封面 -->
              <div class="song-cover">
                <template v-if="song.cover">
                  <img
                    :src="convertToHttps(song.cover)"
                    :alt="song.title"
                    class="cover-image"
                    @error="handleImageError($event, song)"
                  />
                </template>
                <div v-else class="text-cover">
                  {{ getFirstChar(song.title) }}
                </div>
                <!-- 添加播放按钮 - 在有播放信息时显示 -->
                <div v-if="(song.musicPlatform && song.musicId) || song.playUrl" class="play-button-overlay" @click.stop="togglePlaySong(song)">
                  <button class="play-button" :title="isCurrentPlaying(song.id) ? '暂停' : '播放'">
                    <Icon v-if="isCurrentPlaying(song.id)" name="pause" :size="16" color="white" />
                    <Icon v-else name="play" :size="16" color="white" />
                  </button>
                </div>
              </div>

              <div class="song-info">
                <h3 class="song-title" :title="song.title + ' - ' + song.artist">
                  <marquee-text :text="`${song.title} - ${song.artist}`" :activated="isSongFocused(song.id)" />
                  <span v-if="song.played" class="played-tag">已播放</span>
                  <span v-else-if="song.scheduled" class="scheduled-tag">已排期</span>
                </h3>
                <div class="song-meta">
                  <span class="requester">投稿人：{{ song.requester }}</span>
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
                    class="like-button"
                    :class="{ 'liked': song.voted, 'disabled': song.played || song.scheduled || isMySong(song) || voteInProgress }"
                    @click.stop="handleVote(song)"
                    :disabled="song.played || song.scheduled || voteInProgress"
                    :title="song.played ? '已播放的歌曲不能点赞' : song.scheduled ? '已排期的歌曲不能点赞' : isMySong(song) ? '不允许自己给自己点赞' : (song.voted ? '点击取消点赞' : '点赞')"
                  >
                    <img src="/images/thumbs-up.svg" alt="点赞" class="like-icon" />
                  </button>
                </div>
              </div>
              
              <!-- 移除原来位置的已排期标签 -->
            </div>
            
            <!-- 投稿时间和撤销按钮 -->
            <div class="submission-footer">
              <div class="submission-time">
                投稿时间：{{ song.requestedAt }}
              </div>
              
              <!-- 如果是自己的投稿，显示撤回按钮 -->
              <button 
                v-if="isMySong(song) && !song.played && !song.scheduled" 
                class="withdraw-button"
                @click.stop="handleWithdraw(song)"
                :disabled="actionInProgress"
                title="撤回投稿"
              >
                撤销
              </button>
            </div>
          </div>
        </TransitionGroup>
        
        <!-- 分页控件 -->
        <div v-if="totalPages > 1" class="pagination">
          <button 
            @click="goToPage(currentPage - 1)" 
            :disabled="currentPage === 1"
            class="page-button"
          >
            上一页
          </button>
          
          <div class="page-numbers">
            <button 
              v-for="page in displayedPageNumbers" 
              :key="page"
              @click="goToPage(page)"
              :class="['page-number', { active: currentPage === page }]"
            >
              {{ page }}
            </button>
          </div>
          
          <button 
            @click="goToPage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="page-button"
          >
            下一页
          </button>
          
          <div class="page-info">
            {{ currentPage }} / {{ totalPages }} 页
          </div>
          
          <!-- 自定义跳转控件 -->
          <div class="page-jump">
            <span class="jump-label">跳转至</span>
            <input 
              type="number" 
              v-model.number="jumpPageInput"
              @keyup.enter="handleJumpToPage"
              @input="validateJumpInput"
              :placeholder="'1-' + totalPages"
              class="jump-input"
              :min="1"
              :max="totalPages"
            />
            <button 
              @click="handleJumpToPage"
              :disabled="!isValidJumpPage"
              class="jump-button"
              title="跳转到指定页面"
            >
              跳转
            </button>
          </div>
        </div>
        
        <!-- 确认对话框 -->
        <div v-if="confirmDialog.show" class="confirm-dialog-backdrop" @click.self="cancelConfirm">
          <div class="confirm-dialog">
            <div class="confirm-dialog-header">
              <h3>{{ confirmDialog.title }}</h3>
            </div>
            <div class="confirm-dialog-content">
              {{ confirmDialog.message }}
            </div>
            <div class="confirm-dialog-actions">
              <button 
                @click="cancelConfirm" 
                class="confirm-dialog-btn confirm-dialog-cancel"
              >
                取消
              </button>
              <button 
                @click="confirmAction" 
                class="confirm-dialog-btn confirm-dialog-confirm"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 使用全局音频播放器，此处不需要audio元素 -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSemesters } from '~/composables/useSemesters'
import { useMusicSources } from '~/composables/useMusicSources'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { useSongs } from '~/composables/useSongs'
import Icon from '~/components/UI/Icon.vue'
import MarqueeText from '~/components/UI/MarqueeText.vue'
import { convertToHttps } from '~/utils/url'

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

const emit = defineEmits(['vote', 'withdraw', 'refresh', 'semester-change'])
const voteInProgress = ref(false)
const actionInProgress = ref(false)
const sortBy = ref('popularity')
const sortOrder = ref('desc') // 'desc' for newest first, 'asc' for oldest first
const searchQuery = ref('') // 搜索查询
const activeTab = ref('all') // 默认显示全部投稿
const auth = useAuth()
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
const allSongsData = computed(() => songsComposable?.visibleSongs?.value || [])

// 音频播放相关
const audioPlayer = useAudioPlayer()

// 分页相关
const currentPage = ref(1)
const pageSize = ref(12) // 每页显示12首歌曲，适合横向布局
const isMobile = ref(false)

// 自定义跳转相关
const jumpPageInput = ref('')
const isValidJumpPage = ref(false)

// 组件初始化状态
const isComponentInitialized = ref(false)
const isDataLoading = ref(false)
// 防重复调用标志
const isFetchingSemesters = ref(false)
// 用户手动选择学期标志
const isUserManuallySelected = ref(false)

// 切换活动标签
const setActiveTab = (tab) => {
  if (activeTab.value === tab) return; // 如果点击的是当前标签，不执行切换
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
watch(() => props.songs, () => {
  // 只有在组件完全初始化后且不在获取学期信息时才处理数据更新
  if (isComponentInitialized.value && !isDataLoading.value && !isFetchingSemesters.value) {
    fetchAvailableSemesters()
  }
}, { deep: true })

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
watch(allSongsData, (newData) => {
  // 只有在组件完全初始化后且数据真正有内容时才处理
  if (isComponentInitialized.value && newData && newData.length > 0 && !isFetchingSemesters.value) {
    fetchAvailableSemesters()
  }
}, { deep: true })

// 确认对话框
const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  action: '',
  data: null
})

// 格式化日期为 X年X月X日
const formatDate = (dateString) => {
  if (!dateString) return '未知时间'
  const date = new Date(dateString)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 格式化日期为 X年X月X日 HH:MM
const formatDateTime = (dateString) => {
  if (!dateString) return '未知时间'
  const date = new Date(dateString)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`
}

// 判断是否是自己投稿的歌曲
const isMySong = (song) => {
  return auth && auth.user && auth.user.value && song.requesterId === auth.user.value.id
}

// 应用过滤器和搜索
const displayedSongs = computed(() => {
  if (!props.songs) return []
  
  let result = [...props.songs]
  
  // 应用学期过滤器
  if (selectedSemester.value) {
    result = result.filter(song => song.semester === selectedSemester.value)
  }
  
  // 应用标签过滤器
  if (activeTab.value === 'mine') {
    result = result.filter(song => isMySong(song))
  }
  
  // 应用搜索过滤器
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(song => 
      song.title.toLowerCase().includes(query) || 
      song.artist.toLowerCase().includes(query) ||
      (song.requester && song.requester.toLowerCase().includes(query))
    )
  }
  
  // 按状态分组：未排期、已排期、已播放
  const unscheduledSongs = result.filter(song => !song.played && !song.scheduled)
  const scheduledSongs = result.filter(song => !song.played && song.scheduled)
  const playedSongs = result.filter(song => song.played)
  
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
  return [
    ...sortSongs(unscheduledSongs),
    ...sortSongs(scheduledSongs),
    ...sortSongs(playedSongs)
  ]
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
const displayedPageNumbers = computed(() => {
  const result = []
  const totalPagesToShow = 5
  
  if (totalPages.value <= totalPagesToShow) {
    // 如果总页数小于等于要显示的页数，则显示所有页码
    for (let i = 1; i <= totalPages.value; i++) {
      result.push(i)
    }
  } else {
    // 否则，显示当前页附近的页码
    const leftOffset = Math.floor(totalPagesToShow / 2)
    const rightOffset = totalPagesToShow - leftOffset - 1
    
    let start = currentPage.value - leftOffset
    let end = currentPage.value + rightOffset
    
    // 调整起始和结束页码，确保它们在有效范围内
    if (start < 1) {
      end = end + (1 - start)
      start = 1
    }
    
    if (end > totalPages.value) {
      start = Math.max(1, start - (end - totalPages.value))
      end = totalPages.value
    }
    
    for (let i = start; i <= end; i++) {
      result.push(i)
    }
  }
  
  return result
})

// 前往指定页
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 验证跳转输入
const validateJumpInput = () => {
  const page = parseInt(jumpPageInput.value)
  isValidJumpPage.value = !isNaN(page) && page >= 1 && page <= totalPages.value
}

// 处理跳转到指定页面
const handleJumpToPage = () => {
  const page = parseInt(jumpPageInput.value)
  if (!isNaN(page) && page >= 1 && page <= totalPages.value) {
    goToPage(page)
    jumpPageInput.value = '' // 清空输入框
    isValidJumpPage.value = false
  } else {
    // 输入无效时给出提示
    if (window.$showNotification) {
      window.$showNotification(`请输入有效的页码 (1-${totalPages.value})`, 'error')
    }
  }
}

// 处理投票
const handleVote = async (song) => {
  // 检查用户是否登录
  if (!isAuthenticated.value) {
    if (window.$showNotification) {
      window.$showNotification('请先登录后再点赞', 'error')
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
  
  confirmDialog.value = {
    show: true,
    title: '撤回投稿',
    message: `确认撤回歌曲《${song.title}》的投稿吗？`,
    action: 'withdraw',
    data: song
  }
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

// 处理图片加载错误
const handleImageError = (event, song) => {
  event.target.style.display = 'none'
  event.target.parentNode.classList.add('text-cover')
  event.target.parentNode.textContent = getFirstChar(song.title)
}

// 获取歌曲标题的第一个字符作为封面
const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
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
          const url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl)
          if (url) {
            const playableSong = {
              ...song,
              musicUrl: url
            }
            // 构建播放列表并设置当前歌曲索引
            const playlist = await buildPlayablePlaylist(song)
            const currentIndex = playlist.findIndex(item => item.id === song.id)
            audioPlayer.playSong(playableSong, playlist, currentIndex)
          } else {
            if (window.$showNotification) {
              window.$showNotification('无法获取音乐播放链接，请稍后再试', 'error')
            }
          }
        } catch (error) {
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
      const url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl)
      if (url) {
        const playableSong = {
          ...song,
          musicUrl: url
        }
        // 构建播放列表并设置当前歌曲索引
        const playlist = await buildPlayablePlaylist(song)
        const currentIndex = playlist.findIndex(item => item.id === song.id)
        audioPlayer.playSong(playableSong, playlist, currentIndex)
      } else {
        if (window.$showNotification) {
          window.$showNotification('无法获取音乐播放链接，请稍后再试', 'error')
        }
      }
    } catch (error) {
      if (window.$showNotification) {
        window.$showNotification('获取音乐播放链接失败', 'error')
      }
    }
  }
}

// 构建可播放的播放列表
const buildPlayablePlaylist = async (currentSong) => {
  // 获取当前显示的歌曲列表（已经过滤和排序）
  const songsToProcess = paginatedSongs.value.filter(song => 
    ((song.musicPlatform && song.musicId) || song.playUrl) && song.id !== currentSong.id
  )
  
  // 将当前歌曲添加到列表中正确的位置
  const allSongs = [...paginatedSongs.value]
  
  // 只返回有播放信息的歌曲，保持原有顺序
  return allSongs.filter(song => (song.musicPlatform && song.musicId) || song.playUrl)
}

// 动态获取音乐URL
const getMusicUrl = async (platform, musicId, playUrl) => {
  // 如果有自定义播放链接，优先使用
  if (playUrl && playUrl.trim()) {
    console.log(`[SongList] 使用自定义播放链接: ${playUrl}`)
    return playUrl.trim()
  }
  
  // 如果没有playUrl，检查platform和musicId是否有效
  if (!platform || !musicId) {
    throw new Error('歌曲缺少音乐平台或音乐ID信息，无法获取播放链接')
  }
  
  const { getQuality } = useAudioQuality()
  const { getSongUrl } = useMusicSources()

  try {
    let apiUrl
    const quality = getQuality(platform)

    if (platform === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
    } else if (platform === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
    } else {
      throw new Error('不支持的音乐平台')
    }

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    if (!response.ok) {
      throw new Error('获取音乐URL失败')
    }

    const data = await response.json()
    if (data.code === 200 && data.data && data.data.url) {
      // 将HTTP URL改为HTTPS
      let url = data.data.url
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      return url
    }

    throw new Error('vkeys返回成功但未获取到音乐URL')
  } catch (error) {
    // vkeys获取音乐URL失败
    
    // 如果是网易云平台，尝试使用备用源
    if (platform === 'netease') {
      try {
        const result = await getSongUrl(musicId)
        if (result.success && result.url) {
          return result.url
        }
      } catch (backupError) {
        // 网易云备用源调用失败
      }
    }
    
    throw error
  }
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
  
  return text
    // 移除Unicode替换字符
    .replace(/\uFFFD/g, '')
    .replace(/�/g, '')
    // 移除控制字符（保留常见空白字符）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 移除孤立代理对字符
    .replace(/[\uD800-\uDFFF]/g, '')
    // 规范化Unicode字符
    .normalize('NFC')
    .trim()
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
    const rawSemesters = [...new Set(completeSongs.map(song => song.semester).filter(Boolean))]
    const cleanSemesters = rawSemesters
      .filter(semester => !containsCorruptedText(semester))
      .map(semester => cleanCorruptedText(semester))
      .filter(semester => semester.length > 0)
    
    // 统计每个学期的歌曲数量，只保留有数据的学期
    const semesterStats = {}
    completeSongs.forEach(song => {
      if (song.semester && !containsCorruptedText(song.semester)) {
        const cleanSemester = cleanCorruptedText(song.semester)
        if (cleanSemester) {
          semesterStats[cleanSemester] = (semesterStats[cleanSemester] || 0) + 1
        }
      }
    })
    
    // 只保留有数据的学期，按时间倒序排列
    const semestersWithData = Object.keys(semesterStats)
      .filter(semester => semesterStats[semester] > 0)
      .sort().reverse()
    
    // 统计有数据的学期
    
    // 如果用户手动选择了学期，确保该学期保留在可用学期列表中
    let finalSemesters = [...semestersWithData]
    if (isUserManuallySelected.value && selectedSemester.value && 
        !finalSemesters.includes(selectedSemester.value)) {
      // 将用户选择的学期添加到列表中，保持时间倒序
      finalSemesters.push(selectedSemester.value)
      finalSemesters.sort().reverse()
    }
    
    // 更新可用学期列表
    availableSemesters.value = [...finalSemesters]
    
    // 缓存学期信息到sessionStorage
    try {
      sessionStorage.setItem('voicehub_available_semesters', JSON.stringify(availableSemesters.value))
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
  
  // 如果当前选中的学期不在可用列表中，清空选择
  if (selectedSemester.value && !availableSemesters.value.includes(selectedSemester.value)) {
    selectedSemester.value = ''
  }
  
  // 如果用户已手动选择学期且该学期仍有数据，保持选择
  if (isUserManuallySelected.value && selectedSemester.value && 
      availableSemesters.value.includes(selectedSemester.value)) {
    return
  }
  
  // 优先级1: 使用当前活跃学期（如果有数据且API已返回）
  // 注意：只有在currentSemester API已经返回数据时才使用，避免在API未响应时进行切换
  if (currentSemester.value && currentSemester.value.name) {
    const currentSemesterName = currentSemester.value.name
    
    if (!containsCorruptedText(currentSemesterName)) {
      const cleanCurrentSemester = cleanCorruptedText(currentSemesterName)
      
      // 检查当前学期是否在有数据的列表中
      if (cleanCurrentSemester && availableSemesters.value.includes(cleanCurrentSemester)) {
        selectedSemester.value = cleanCurrentSemester
        
        // 保存选择到sessionStorage
        try {
          sessionStorage.setItem('voicehub_selected_semester', cleanCurrentSemester)
        } catch (error) {
          console.warn('无法保存学期选择:', error)
        }
        return
      }
    }
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

// 防抖函数实现
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// 当组件销毁时不需要特殊处理，音频播放由全局管理

// 波纹效果指令
const vRipple = {
  mounted(el) {
    el.addEventListener('click', e => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      el.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600); // 与CSS动画时间一致
    });
  }
};
</script>

<style scoped>
.song-list {
  width: 100%;
  position: relative;
  z-index: 2;
}

.song-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.tab-controls {
  display: flex;
  gap: 1rem;
}

/* 标签切换动画 */
.tab-switch-enter-active,
.tab-switch-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
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
  color: #FFFFFF;
  border-bottom-color: #0B5AFE;
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
  background: #21242D;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  padding: 0;
}

.semester-toggle-btn:hover {
  background: #2A2E38;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  color: #0B5AFE;
}

.semester-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #1A1D24;
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
  color: #FFFFFF;
}

.semester-option.active {
  background: rgba(11, 90, 254, 0.2);
  color: #0B5AFE;
  font-weight: 600;
}

.search-box {
  position: relative;
  width: 250px;
}

.search-input {
  background: #040E15;
  border: 1px solid #242F38;
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
  border-color: #0B5AFE;
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
  background: #21242D;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
}

.refresh-button:hover {
  background: #2A2E38;
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
  content: "";
  display: block;
  width: 40px;
  height: 40px;
  margin-bottom: 1rem;
  border-radius: 50%;
  border: 3px solid rgba(11, 90, 254, 0.2);
  border-top-color: #0B5AFE;
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
  background: #21242D;
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

/* 移除左侧状态条 */

.song-card.played {
  opacity: 0.6;
}

/* 歌曲封面样式 */
.song-cover {
  width: 55px;
  height: 55px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0043F8 0%, #0075F8 100%);
  color: #FFFFFF;
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
  color: #FFFFFF;
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
  color: #0B5AFE;
  text-shadow: 0px 20px 30px rgba(0, 114, 248, 0.5), 
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
  color: #FFFFFF;
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
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.like-button.liked {
  background: #1A1D24;
  border-color: #242F38;
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

/* 投稿时间和撤销按钮 */
.submission-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #21242D;
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
  background: linear-gradient(180deg, #FF2F2F 0%, #FF654D 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.25rem 0.75rem;
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #FFFFFF;
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

.page-button, .page-number {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: #FFFFFF;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-number.active {
  background: #0B5AFE;
  border-color: #0B5AFE;
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
  color: #FFFFFF;
  width: 60px;
  text-align: center;
  transition: all 0.2s ease;
}

.jump-input:focus {
  outline: none;
  border-color: #0B5AFE;
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
  color: #FFFFFF;
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

/* 确认对话框 */
.confirm-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.confirm-dialog {
  background: #21242D;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.confirm-dialog-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-content {
  padding: 1.5rem 1rem;
}

.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
  gap: 0.75rem;
}

.confirm-dialog-btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-family: 'MiSans-Demibold', sans-serif;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  cursor: pointer;
}

.confirm-dialog-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
}

.confirm-dialog-confirm {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  color: #FFFFFF;
}

/* 响应式适配 */
@media (max-width: 1200px) {
  .song-card {
    width: calc(50% - 0.5rem);
  }
}

@media (max-width: 768px) {
  .song-list-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .tab-controls {
    justify-content: center;
  }
  
  .tab-button {
    flex: 1;
    padding: 0.5rem;
  }
  
  .search-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .search-box {
    width: calc(100% - 50px);
  }
  
  .song-card {
    width: 100%;
  }
  
  .song-info {
    width: 60%;
  }
  
  .action-area {
    gap: 0.5rem;
  }
  
  .pagination {
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
  }
  
  .page-numbers {
    order: 3;
    width: 100%;
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }
  
  .page-info {
    order: 4;
    margin: 0.5rem 0 0 0;
    text-align: center;
  }
  
  .page-jump {
    order: 5;
    margin: 0.5rem 0 0 0;
    justify-content: center;
  }
  
  .jump-label {
    font-size: 0.75rem;
  }
  
  .jump-input {
    width: 50px;
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
  }
  
  .jump-button {
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
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
</style>