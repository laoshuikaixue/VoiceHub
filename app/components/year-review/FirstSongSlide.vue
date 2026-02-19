<template>
  <div v-if="data.firstSong" class="slide-container">
    <!-- Background Image Blur -->
    <div
      v-if="data.firstSong.cover"
      class="bg-blur"
      :style="{ backgroundImage: `url(${data.firstSong.cover})` }"
    />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <span class="badge">初次相遇</span>

        <p class="text-intro">这一年，你点的<span class="highlight">第一首歌</span>是</p>

        <div class="vinyl-container">
          <div class="vinyl-record">
            <img
              v-if="data.firstSong.cover"
              :src="data.firstSong.cover"
              alt="Cover"
              class="cover-img"
            >
            <div v-else class="placeholder-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div class="glossy-overlay" />
          </div>
        </div>

        <div class="song-info">
          <h2 class="song-title">{{ data.firstSong.title }}</h2>
          <p class="song-artist">{{ data.firstSong.artist }}</p>
        </div>

        <p class="date-text">{{ formatDate(data.firstSong.createdAt) }}</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineProps({
  data: Object,
  active: Boolean
})

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
</script>

<style scoped>
.slide-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: #000;
}

.bg-blur {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.3;
  filter: blur(80px);
  transform: scale(1.1);
}

.content {
  z-index: 10;
  width: 100%;
  max-width: 450px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 0.25rem 1rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  letter-spacing: 0.1em;
  color: #f472b6; /* brand-pink */
  font-weight: 600;
}

.text-intro {
  font-size: 1.5rem;
  color: #d1d5db;
  font-weight: 300;
  margin-bottom: 2rem;
}

.highlight {
  color: #fff;
  font-weight: 700;
  margin: 0 0.5rem;
}

.vinyl-container {
  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
  margin-bottom: 2rem;
}

.vinyl-record {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #111827;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s;
}

.vinyl-record:hover .cover-img {
  transform: scale(1.05);
}

.placeholder-icon {
  color: #4b5563;
}

.glossy-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top right, rgba(255, 255, 255, 0.1), transparent);
  pointer-events: none;
}

.song-info {
  width: 100%;
  margin-bottom: 0.5rem;
}

.song-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
}

.song-artist {
  font-size: 1.125rem;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-text {
  margin-top: 2rem;
  font-size: 1.125rem;
  color: #9ca3af;
  font-family:
    'MiSans',
    system-ui,
    -apple-system,
    sans-serif;
  font-weight: 500;
  letter-spacing: 0.05em;
}

@media (max-width: 768px) {
  .text-intro {
    font-size: 1.125rem;
  }
  .song-title {
    font-size: 1.5rem;
  }
  .vinyl-container {
    max-width: 280px;
  }
}
</style>
