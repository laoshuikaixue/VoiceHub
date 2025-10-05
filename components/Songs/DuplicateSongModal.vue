<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>歌曲已存在</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" x2="6" y1="6" y2="18"></line>
            <line x1="6" x2="18" y1="6" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="duplicate-message">
          这首歌曲已经在列表中了，不能重复投稿。您可以为它点赞支持！
        </p>

        <!-- 歌曲卡片 -->
        <div class="song-card">
          <div class="song-cover">
            <img
                v-if="song.cover"
                :alt="song.title"
                :src="convertToHttps(song.cover)"
                @error="handleImageError"
            />
            <div v-else class="default-cover">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
                <path d="m9 12 1.5-1.5L16 16"/>
                <path d="M21 15.5c.621 0 1-.504 1-1.125v-3.75c0-.621-.379-1.125-1-1.125h-1.5"/>
                <path d="M3 15.5c-.621 0-1-.504-1-1.125v-3.75c0-.621.379-1.125 1-1.125h1.5"/>
              </svg>
            </div>
          </div>

          <div class="song-info">
            <h4 class="song-title">{{ song.title }}</h4>
            <p class="song-artist">{{ song.artist }}</p>
            <p class="song-requester">投稿者：{{ song.requester }}</p>
            <div class="song-stats">
              <span class="vote-count">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path
                      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {{ song.voteCount || 0 }} 票
              </span>
              <span :class="{ played: song.played }" class="play-status">
                {{ song.played ? '已播放' : '待播放' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
            class="btn btn-secondary"
            @click="$emit('close')"
        >
          取消
        </button>
        <button
            :disabled="liking || song.voted"
            class="btn btn-primary like-btn"
            @click="handleLike"
        >
          <svg v-if="!liking" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <div v-else class="loading-spinner"></div>
          {{ song.voted ? '已点赞' : '立即点赞' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {ref} from 'vue'
import type {Song} from '~/types'
import {convertToHttps} from '~/utils/url'

interface Props {
  show: boolean
  song: Song
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  like: [songId: number]
}>()

const liking = ref(false)

const handleOverlayClick = () => {
  emit('close')
}

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

const handleLike = async () => {
  if (liking.value || props.song.voted) return

  liking.value = true
  try {
    emit('like', props.song.id)
  } finally {
    liking.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #6b7280;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 20px 24px;
}

.duplicate-message {
  margin: 0 0 20px;
  color: #6b7280;
  line-height: 1.5;
}

.song-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.song-cover {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-cover {
  color: #9ca3af;
}

.default-cover svg {
  width: 32px;
  height: 32px;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  margin: 0 0 4px;
  color: #6b7280;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-requester {
  margin: 0 0 8px;
  color: #9ca3af;
  font-size: 0.85rem;
}

.song-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
}

.vote-count {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ef4444;
}

.vote-count svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.play-status {
  color: #f59e0b;
}

.play-status.played {
  color: #10b981;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px 20px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.like-btn svg {
  width: 16px;
  height: 16px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .modal-content {
    margin: 10px;
    max-width: none;
  }

  .song-card {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .song-cover {
    width: 120px;
    height: 120px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>