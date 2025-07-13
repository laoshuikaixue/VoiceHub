<template>
  <div class="song-list">
    <div v-if="loading" class="loading">
      加载中...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else-if="songs.length === 0" class="empty">
      暂无歌曲，马上去点歌吧！
    </div>
    
    <div v-else class="songs-container">
      <div class="sort-controls">
        <button :class="{ active: sortBy === 'popularity' }" @click="sortBy = 'popularity'">
          按热度排序
        </button>
        <button :class="{ active: sortBy === 'date' }" @click="sortBy = 'date'">
          按时间排序
        </button>
      </div>
      
      <div class="songs-grid">
        <div 
          v-for="song in sortedSongs" 
          :key="song.id" 
          class="song-card"
          :class="{ 'played': song.played }"
        >
          <div class="song-info">
            <div class="song-title-row">
              <h3 class="song-title">{{ song.title }} - {{ song.artist }}</h3>
              <div class="votes">
                <span class="vote-count">{{ song.voteCount }}</span>
                <button 
                  class="vote-button"
                  @click="handleVote(song)"
                  :disabled="song.voted || song.played"
                >
                  {{ song.voted ? '已投' : '投票' }}
                </button>
              </div>
            </div>
            
            <div class="song-meta">
              <span class="requester">投稿人：{{ song.requester }} 时间：{{ formatDate(song.createdAt) }}</span>
              <span class="song-status">{{ song.played ? '已播放' : '待播放' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

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

const emit = defineEmits(['vote'])

const sortBy = ref('popularity')

// 格式化日期为 X年X月X日
const formatDate = (dateString) => {
  if (!dateString) return '未知时间'
  const date = new Date(dateString)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 按照选择的方式排序歌曲
const sortedSongs = computed(() => {
  if (sortBy.value === 'popularity') {
    return [...props.songs].sort((a, b) => b.voteCount - a.voteCount)
  } else {
    return [...props.songs].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }
})

// 用户操作：投票
const handleVote = (song) => {
  emit('vote', song)
}
</script>

<style scoped>
.song-list {
  width: 100%;
}

.loading, .error, .empty {
  padding: 2rem;
  text-align: center;
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.4);
  margin: 1rem 0;
  color: var(--light);
}

.error {
  color: var(--danger);
}

.empty {
  color: var(--gray);
}

.sort-controls {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
}

.sort-controls button {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.375rem;
  cursor: pointer;
  color: var(--gray);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.sort-controls button:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.sort-controls button:hover:before {
  width: 150%;
  height: 150%;
}

.sort-controls button.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.songs-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.song-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
  transition: all 0.3s ease;
}

.song-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.3);
}

.song-card.played {
  opacity: 0.7;
}

.song-info {
  width: 100%;
}

.song-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.song-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.song-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--gray);
}

.votes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vote-count {
  font-size: 1rem;
  font-weight: bold;
  color: var(--primary);
}

.vote-button {
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.vote-button:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
  z-index: 0;
}

.vote-button:hover:not([disabled]):before {
  width: 150%;
  height: 150%;
}

.vote-button:hover:not([disabled]) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.2);
}

.vote-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.admin-action {
  padding: 0.35rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.6);
  color: var(--light);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.admin-action:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
  z-index: 0;
}

.admin-action:hover:before {
  width: 150%;
  height: 150%;
}

.admin-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.admin-action.mark-played {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.3);
  color: var(--success);
}

.admin-action.mark-played:hover {
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.2);
}

@media (max-width: 639px) {
  .song-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .song-title {
    max-width: 100%;
  }
  
  .votes {
    width: 100%;
    justify-content: space-between;
  }
}
</style> 