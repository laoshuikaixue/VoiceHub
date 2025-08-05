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
            :class="{ 'played': song.played, 'scheduled': song.scheduled }"
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
                <!-- 添加播放按钮 - 在有平台信息时显示 -->
                <div v-if="song.musicPlatform && song.musicId" class="play-button-overlay" @click="togglePlaySong(song)">
                  <button class="play-button" :title="isCurrentPlaying(song.id) ? '暂停' : '播放'">
                    <Icon v-if="isCurrentPlaying(song.id)" name="pause" :size="16" color="white" />
                    <Icon v-else name="play" :size="16" color="white" />
                  </button>
                </div>
              </div>

              <div class="song-info">
                <h3 class="song-title" :title="song.title + ' - ' + song.artist">
                  <span class="song-title-text">{{ song.title }} - {{ song.artist }}</span>
                  <span v-if="song.scheduled" class="scheduled-tag">已排期</span>
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
                    :class="{ 'liked': song.voted, 'disabled': song.played || song.scheduled }"
                    @click="handleVote(song)"
                    :disabled="song.played || song.scheduled || voteInProgress"
                    :title="song.played ? '已播放的歌曲不能点赞' : song.scheduled ? '已排期的歌曲不能点赞' : (song.voted ? '点击取消点赞' : '点赞')"
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
                投稿时间：{{ formatDateTime(song.createdAt) }}
              </div>
              
              <!-- 如果是自己的投稿，显示撤回按钮 -->
              <button 
                v-if="isMySong(song) && !song.played && !song.scheduled" 
                class="withdraw-button"
                @click="handleWithdraw(song)"
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import Icon from '~/components/UI/Icon.vue'
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

const emit = defineEmits(['vote', 'withdraw', 'refresh'])
const voteInProgress = ref(false)
const actionInProgress = ref(false)
const sortBy = ref('popularity')
const sortOrder = ref('desc') // 'desc' for newest first, 'asc' for oldest first
const searchQuery = ref('') // 搜索查询
const activeTab = ref('all') // 默认显示全部投稿
const auth = useAuth()
const isAuthenticated = computed(() => auth && auth.isAuthenticated && auth.isAuthenticated.value)

// 音频播放相关
const audioPlayer = useAudioPlayer()

// 分页相关
const currentPage = ref(1)
const pageSize = ref(12) // 每页显示12首歌曲，适合横向布局
const isMobile = ref(false)

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

// 组件挂载和卸载时添加/移除窗口大小变化监听
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 确认对话框
const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  action: null,
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
  
  // 应用排序
  if (sortBy.value === 'popularity') {
    result.sort((a, b) => b.voteCount - a.voteCount)
  } else if (sortBy.value === 'date') {
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt)
      const dateB = new Date(b.createdAt)
      return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB
    })
  }
  
  return result
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

// 处理投票
const handleVote = async (song) => {
  // 检查歌曲状态
  if (song.played || song.scheduled) {
    return // 已播放或已排期的歌曲不能点赞
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
    console.error('投票处理失败', err)
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
    console.error('操作执行失败', err)
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
      if (song.musicPlatform && song.musicId) {
        try {
          const url = await getMusicUrl(song.musicPlatform, song.musicId)
          if (url) {
            const playableSong = {
              ...song,
              musicUrl: url
            }
            audioPlayer.playSong(playableSong)
          } else {
            if (window.$showNotification) {
              window.$showNotification('无法获取音乐播放链接，可能是付费内容', 'error')
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

  // 如果有平台和ID信息，动态获取URL
  if (song.musicPlatform && song.musicId) {
    try {
      const url = await getMusicUrl(song.musicPlatform, song.musicId)
      if (url) {
        const playableSong = {
          ...song,
          musicUrl: url
        }
        audioPlayer.playSong(playableSong)
      } else {
        if (window.$showNotification) {
          window.$showNotification('无法获取音乐播放链接，可能是付费内容', 'error')
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

// 动态获取音乐URL
const getMusicUrl = async (platform, musicId) => {
  const { getQuality } = useAudioQuality()

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

    return null
  } catch (error) {
    console.error('获取音乐URL错误:', error)
    throw error
  }
}

// 判断当前是否正在播放指定ID的歌曲
const isCurrentPlaying = (songId) => {
  return audioPlayer.isCurrentPlaying(songId)
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
  font-weight: normal;
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
  }
  
  .page-numbers {
    order: 3;
    width: 100%;
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
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