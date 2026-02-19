<template>
  <div class="player-info">
    <div class="cover-container" title="点击打开歌词" @click="openLyrics">
      <template v-if="song.cover && !coverError">
        <img
          :src="convertToHttps(song.cover)"
          alt="封面"
          class="player-cover"
          referrerpolicy="no-referrer"
          @error="handleImageError"
        >
      </template>
      <div v-else class="text-cover">
        {{ getFirstChar(song.title || '') }}
      </div>
      <!-- 悬浮提示层 -->
      <div class="lyrics-overlay">
        <svg
          fill="none"
          height="20"
          viewBox="0 0 24 24"
          width="20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 5h18v2H3V5zm0 4h14v2H3V9zm0 4h18v2H3v-2zm0 4h10v2H3v-2z"
            fill="currentColor"
            opacity="0.9"
          />
          <circle cx="20" cy="11" fill="currentColor" opacity="0.7" r="2" />
          <circle cx="18" cy="15" fill="currentColor" opacity="0.7" r="1.5" />
        </svg>
        <span class="lyrics-text">歌词</span>
      </div>
    </div>
    <div class="player-text">
      <h4>{{ song.title }}</h4>
      <p>{{ song.artist }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  song: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['openLyrics'])

const coverError = ref(false)

const handleImageError = () => {
  coverError.value = true
}

const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
}

const openLyrics = () => {
  emit('openLyrics')
}
</script>

<style scoped>
.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.cover-container {
  width: 48px;
  height: 48px;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.cover-container:hover {
  transform: scale(1.05);
}

.lyrics-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  color: white;
  gap: 2px;
}

.cover-container:hover .lyrics-overlay {
  opacity: 1;
}

.lyrics-text {
  font-size: 10px;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 添加辉光效果 */
  box-shadow:
    0 0 10px rgba(255, 255, 255, 0.3),
    0 0 20px rgba(255, 255, 255, 0.2),
    0 0 30px rgba(255, 255, 255, 0.1);
  transition: box-shadow 0.3s ease;
}

.player-cover:hover {
  box-shadow:
    0 0 15px rgba(255, 255, 255, 0.4),
    0 0 30px rgba(255, 255, 255, 0.3),
    0 0 45px rgba(255, 255, 255, 0.2);
}

.text-cover {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 18px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.player-text {
  min-width: 0;
  flex: 1;
}

.player-text h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.player-text p {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
