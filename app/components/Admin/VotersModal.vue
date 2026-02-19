<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">投票人员列表</h3>
        <button class="close-btn" @click="closeModal">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- 歌曲信息 -->
        <div v-if="songInfo" class="song-info">
          <h4 class="song-title">{{ songInfo.title }}</h4>
          <p class="song-artist">{{ songInfo.artist }}</p>
          <div class="vote-summary">
            <svg class="heart-icon" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              />
            </svg>
            <span class="vote-count">{{ totalVotes }} 票</span>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <div class="spinner" />
          <p>正在加载投票人员...</p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="error-container">
          <svg
            class="error-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" x2="9" y1="9" y2="15" />
            <line x1="9" x2="15" y1="9" y2="15" />
          </svg>
          <p class="error-message">{{ error }}</p>
          <button class="retry-btn" @click="fetchVoters">重试</button>
        </div>

        <!-- 投票人员列表 -->
        <div v-else-if="voters.length > 0" class="voters-list">
          <div class="voters-header">
            <span class="voters-title">投票人员 ({{ voters.length }})</span>
          </div>
          <div class="voters-container">
            <div v-for="(voter, index) in voters" :key="voter.id" class="voter-item">
              <div class="voter-info">
                <div class="voter-avatar">
                  {{ getAvatarText(voter.name) }}
                </div>
                <div class="voter-details">
                  <span class="voter-name">{{ voter.name }}</span>
                  <span class="vote-time">{{ formatVoteTime(voter.votedAt) }}</span>
                </div>
              </div>
              <div class="voter-number">#{{ index + 1 }}</div>
            </div>
          </div>
        </div>

        <!-- 无投票状态 -->
        <div v-else class="empty-state">
          <svg
            class="empty-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            />
          </svg>
          <p>暂无投票</p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="close-button" @click="closeModal">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

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
    error.value = err.data?.message || '获取投票人员失败'
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

const formatVoteTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN', {
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #1a1a1a;
  border-radius: 16px;
  border: 1px solid #2a2a2a;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #2a2a2a;
  color: #ffffff;
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.song-info {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid #3a3a3a;
}

.song-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 8px 0;
}

.song-artist {
  color: #888;
  margin: 0 0 16px 0;
  font-size: 14px;
}

.vote-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.heart-icon {
  width: 20px;
  height: 20px;
  color: #ef4444;
}

.vote-count {
  color: #ef4444;
  font-weight: 600;
  font-size: 16px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #3a3a3a;
  border-top: 3px solid #667eea;
  border-radius: 50%;
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

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: #ef4444;
}

.error-message {
  color: #ef4444;
  text-align: center;
  margin: 0;
}

.retry-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #5a67d8;
}

.voters-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #3a3a3a;
}

.voters-title {
  font-weight: 600;
  color: #ffffff;
  font-size: 16px;
}

.voters-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.voter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  transition: all 0.2s ease;
}

.voter-item:hover {
  background: #333333;
  border-color: #4a4a4a;
}

.voter-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.voter-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.voter-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.voter-name {
  color: #ffffff;
  font-weight: 500;
  font-size: 14px;
}

.vote-time {
  color: #888;
  font-size: 12px;
}

.voter-number {
  color: #888;
  font-size: 12px;
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: #666;
}

.empty-state p {
  color: #888;
  margin: 0;
}

.modal-footer {
  padding: 0 24px 24px;
  display: flex;
  justify-content: flex-end;
}

.close-button {
  background: #3a3a3a;
  color: #ffffff;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s ease;
}

.close-button:hover {
  background: #4a4a4a;
}

/* 滚动条样式 */
.voters-container::-webkit-scrollbar {
  width: 6px;
}

.voters-container::-webkit-scrollbar-track {
  background: #2a2a2a;
  border-radius: 3px;
}

.voters-container::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

.voters-container::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }

  .modal-content {
    max-height: 90vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .voter-item {
    padding: 10px 12px;
  }

  .voter-avatar {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }
}
</style>
