<template>
  <div class="slide-container">
    <div class="bg-gradient" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div v-if="data.topPlatform" class="card platform-card">
          <span class="label">常用平台</span>
          <span class="platform-value">{{ formatPlatform(data.topPlatform) }}</span>
        </div>

        <div class="grid-container">
          <div v-if="data.activeMonth" class="card active-card">
            <span class="label">最活跃</span>
            <span class="active-value">{{ data.activeMonth }}<span class="unit">月</span></span>
          </div>

          <div class="card votes-card">
            <span class="label">投出票数</span>
            <span class="votes-value">{{ data.totalVotes }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineProps({
  data: Object,
  active: Boolean
})

const formatPlatform = (platform) => {
  const map = {
    netease: '网易云音乐',
    bilibili: '哔哩哔哩',
    qq: 'QQ音乐',
    kugou: '酷狗音乐',
    kuwo: '酷我音乐',
    migu: '咪咕音乐',
    tencent: 'QQ音乐'
  }
  return map[platform] || platform
}
</script>

<style scoped>
.slide-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: #111827; /* gray-900 */
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(to bottom, #1f2937, transparent);
  opacity: 0.2;
}

.content {
  z-index: 10;
  width: 100%;
  max-width: 28rem;
  padding: 1.5rem;
  display: grid;
  gap: 1.5rem;
}

.card {
  padding: 1.5rem;
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem; /* adjusted */
}

.platform-value {
  font-size: 1.5rem; /* text-2xl */
  font-weight: 700;
  background-image: linear-gradient(to right, #f87171, #fb923c);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.active-card,
.votes-card {
  aspect-ratio: 1;
}

.active-value {
  font-size: 2.25rem; /* text-4xl */
  font-weight: 700;
  color: #fde047; /* yellow-300 */
}

.unit {
  font-size: 1rem;
  margin-left: 0.25rem;
  color: #9ca3af;
}

.votes-value {
  font-size: 1.875rem; /* text-3xl */
  font-weight: 700;
  color: #67e8f9; /* cyan-300 */
}

@media (min-width: 768px) {
  .platform-value {
    font-size: 1.875rem;
  }
  .active-value {
    font-size: 3rem;
  }
  .votes-value {
    font-size: 2.25rem;
  }
  .card {
    padding: 1.5rem;
  }
}
</style>
