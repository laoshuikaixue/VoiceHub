<template>
  <div class="player-info">
    <div class="cover-container">
      <template v-if="song.cover && !coverError">
        <img :src="convertToHttps(song.cover)" alt="封面" class="player-cover" @error="handleImageError"/>
      </template>
      <div v-else class="text-cover">
        {{ getFirstChar(song.title || '') }}
      </div>
    </div>
    <div class="player-text">
      <h4>{{ song.title }}</h4>
      <p>{{ song.artist }}</p>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {convertToHttps} from '~/utils/url'

const props = defineProps({
  song: {
    type: Object,
    required: true
  }
})

const coverError = ref(false)

const handleImageError = () => {
  coverError.value = true
}

const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
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
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.text-cover {
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