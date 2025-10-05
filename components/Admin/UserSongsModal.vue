<template>
  <transition name="modal-overlay">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <transition name="modal">
        <div v-if="show" class="modal" @click.stop>
          <div class="modal-header">
            <h3>用户歌曲信息</h3>
            <button class="close-btn" @click="$emit('close')">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <line x1="18" x2="6" y1="6" y2="18"/>
                <line x1="6" x2="18" y1="6" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- 加载状态 -->
            <div v-if="loading" class="loading-container">
              <div class="loading-spinner"></div>
              <p>加载中...</p>
            </div>

            <!-- 错误状态 -->
            <div v-else-if="error" class="error-container">
              <div class="error-icon">⚠️</div>
              <p>{{ error }}</p>
              <button class="retry-btn" @click="fetchUserSongs">重试</button>
            </div>

            <!-- 内容 -->
            <div v-else-if="userSongs" class="content">
              <!-- 用户信息 -->
              <div class="user-info">
                <h4>{{ userSongs.user.name }} ({{ userSongs.user.username }})</h4>
                <p v-if="userSongs.user.grade || userSongs.user.class">
                  {{ userSongs.user.grade || '' }} {{ userSongs.user.class || '' }}
                </p>
              </div>

              <!-- 选项卡 -->
              <div class="tabs">
                <button
                    :class="['tab-btn', { active: activeTab === 'submitted' }]"
                    @click="activeTab = 'submitted'"
                >
                  投稿歌曲 ({{ userSongs.submittedSongs.length }})
                </button>
                <button
                    :class="['tab-btn', { active: activeTab === 'voted' }]"
                    @click="activeTab = 'voted'"
                >
                  投票歌曲 ({{ userSongs.votedSongs.length }})
                </button>
              </div>

              <!-- 投稿歌曲列表 -->
              <div v-if="activeTab === 'submitted'" class="song-list">
                <div v-if="userSongs.submittedSongs.length === 0" class="empty-state">
                  <div class="empty-icon">🎵</div>
                  <p>该用户还没有投稿任何歌曲</p>
                </div>
                <div v-else class="songs">
                  <div
                      v-for="song in userSongs.submittedSongs"
                      :key="song.id"
                      class="song-item"
                  >
                    <div class="song-info">
                      <div class="song-title">{{ song.title }}</div>
                      <div class="song-artist">{{ song.artist }}</div>
                      <div class="song-meta">
                        <span class="submit-time">{{ formatDate(song.createdAt) }}</span>
                        <span class="vote-count">{{ song.voteCount }} 票</span>
                        <span :class="['status', getStatusClass(song)]">
                          {{ getStatusText(song) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 投票歌曲列表 -->
              <div v-if="activeTab === 'voted'" class="song-list">
                <div v-if="userSongs.votedSongs.length === 0" class="empty-state">
                  <div class="empty-icon">❤️</div>
                  <p>该用户还没有投票任何歌曲</p>
                </div>
                <div v-else class="songs">
                  <div
                      v-for="song in userSongs.votedSongs"
                      :key="song.id"
                      class="song-item"
                  >
                    <div class="song-info">
                      <div class="song-title">{{ song.title }}</div>
                      <div class="song-artist">{{ song.artist }}</div>
                      <div class="song-meta">
                        <span class="vote-time">{{ formatDate(song.votedAt) }} 投票</span>
                        <span class="vote-count">{{ song.voteCount }} 票</span>
                        <span :class="['status', getStatusClass(song)]">
                          {{ getStatusText(song) }}
                        </span>
                      </div>
                      <div v-if="song.requester" class="submitter-info">
                        投稿人: {{ song.requester.name }}
                        <span v-if="song.requester.grade || song.requester.class">
                          ({{ song.requester.grade || '' }} {{ song.requester.class || '' }})
                        </span>
                      </div>
                    </div>
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
import {ref, watch} from 'vue'

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

const loading = ref(false)
const error = ref('')
const userSongs = ref(null)
const activeTab = ref('submitted')

// 监听 userId 变化，重新获取数据
watch(() => props.userId, (newUserId) => {
  if (newUserId && props.show) {
    fetchUserSongs()
  }
})

// 监听 show 变化
watch(() => props.show, (newShow) => {
  if (newShow && props.userId) {
    fetchUserSongs()
  } else if (!newShow) {
    // 重置状态
    userSongs.value = null
    error.value = ''
    activeTab.value = 'submitted'
  }
})

const fetchUserSongs = async () => {
  if (!props.userId) return

  loading.value = true
  error.value = ''

  try {
    const auth = useAuth()

    const response = await $fetch(`/api/admin/users/${props.userId}/songs`, {
      ...auth.getAuthConfig()
    })

    userSongs.value = response
  } catch (err) {
    console.error('获取用户歌曲信息失败:', err)
    error.value = err.data?.message || '获取用户歌曲信息失败'
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString) => {
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

// 获取歌曲状态文本
const getStatusText = (song) => {
  if (song.played) return '已播放'
  if (song.scheduled) return '已排期'
  return '待排期'
}

// 获取歌曲状态样式类
const getStatusClass = (song) => {
  if (song.played) return 'played'
  if (song.scheduled) return 'scheduled'
  return 'pending'
}

const handleOverlayClick = () => {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal {
  background: #21242D;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  font-family: 'MiSans', sans-serif;
}

.close-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  color: #9ca3af;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid #0B5AFE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-container .error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-btn {
  background: #0B5AFE;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 16px;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #0952d9;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-info {
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info h4 {
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.user-info p {
  color: #9ca3af;
  font-size: 14px;
  margin: 0;
}

.tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 16px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #0B5AFE;
  border-bottom-color: #0B5AFE;
  background: rgba(11, 90, 254, 0.1);
}

.song-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  color: #9ca3af;
}

.empty-state .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.songs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.song-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-title {
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.song-artist {
  color: #9ca3af;
  font-size: 14px;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.submit-time, .vote-time, .vote-count {
  color: #9ca3af;
  font-size: 12px;
}

.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status.played {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status.scheduled {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.status.pending {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.submitter-info {
  color: #9ca3af;
  font-size: 12px;
  margin-top: 4px;
}

/* 动画 */
.modal-overlay-enter-active, .modal-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.modal-overlay-enter-from, .modal-overlay-leave-to {
  opacity: 0;
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal {
    width: 95%;
    max-height: 95vh;
  }

  .modal-header, .user-info, .song-list {
    padding-left: 16px;
    padding-right: 16px;
  }

  .song-meta {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>