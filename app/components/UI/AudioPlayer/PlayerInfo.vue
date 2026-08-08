<template>
  <div class="player-info">
    <div class="cover-container" :title="locale.openLyrics" @click="openLyrics">
      <template v-if="song.cover && !coverError">
        <img
          :src="convertToHttps(song.cover)"
          :alt="locale.coverAlt"
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
        <span class="lyrics-text">{{ locale.lyrics }}</span>
      </div>
    </div>
    <div class="player-text">
      <h4>{{ song.title }}</h4>
      <p>{{ song.artist }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { convertToHttps } from '~/utils/url'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  song: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['openLyrics'])

const { ui } = useLocale()
const locale = computed(() => ui.value?.playerInfo || {})
const coverError = ref(false)

const handleImageError = () => {
  coverError.value = true
}

const getFirstChar = (title) => {
  if (!title) return locale.value.textCoverFallback
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
  --player-lyrics-overlay: rgba(0, 0, 0, 0.35);
}

.cover-container {
  width: 48px;
  height: 48px;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-collab-hover) 100%);
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
  background: var(--player-lyrics-overlay);
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
  text-shadow: 0 1px 2px var(--mask-50);
}

.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 添加辉光效果 */
  box-shadow:
    0 0 10px var(--overlay-30),
    0 0 20px var(--overlay-20),
    0 0 30px var(--overlay-10);
  transition: box-shadow 0.3s ease;
}

.player-cover:hover {
  box-shadow:
    0 0 15px var(--overlay-40),
    0 0 30px var(--overlay-30),
    0 0 45px var(--overlay-20);
}

.text-cover {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-collab-hover) 100%);
  color: white;
  font-size: 18px;
  font-weight: bold;
  text-shadow: 0 1px 2px var(--mask-30);
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
  text-shadow: 0 1px 2px var(--mask-30);
}

.player-text p {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--overlay-80);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px var(--mask-30);
}
</style>
