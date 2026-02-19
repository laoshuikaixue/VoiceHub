<template>
  <div ref="shareCardRef" class="share-card">
    <div class="card-background">
      <div class="gradient-overlay" />
      <div class="noise-overlay" />
    </div>

    <div class="card-content">
      <div class="header">
        <div class="logo">VoiceHub</div>
        <div class="year">{{ data.year }}</div>
      </div>

      <div class="title-section">
        <h1 class="main-title">年度点歌报告</h1>
        <p class="subtitle">Music Journey</p>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ data.totalRequests }}</div>
          <div class="stat-label">点歌次数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ data.playedRequests }}</div>
          <div class="stat-label">已播放</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ data.totalVotes }}</div>
          <div class="stat-label">投票数</div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-text">用音乐记录每一刻</div>
        <div class="footer-line" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  data: {
    type: Object,
    required: true
  }
})

const shareCardRef = ref(null)

defineExpose({
  shareCardRef
})
</script>

<style scoped>
.share-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 600px;
  overflow: hidden;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
}

.card-background {
  position: absolute;
  inset: 0;
}

.gradient-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(244, 114, 182, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 60%);
}

.noise-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

.card-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 3rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: 900;
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.year {
  font-size: 3rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.1);
  line-height: 1;
}

.title-section {
  text-align: center;
  margin: 2rem 0;
}

.main-title {
  font-size: 3.5rem;
  font-weight: 900;
  background: linear-gradient(135deg, #ffffff 0%, #e5e7eb 50%, #9ca3af 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin: 2rem 0;
}

.stat-item {
  text-align: center;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 900;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.05em;
}

.footer {
  text-align: center;
  padding-top: 2rem;
}

.footer-text {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
}

.footer-line {
  width: 100px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  margin: 0 auto;
}

@media (max-width: 768px) {
  .card-content {
    padding: 2rem;
  }

  .main-title {
    font-size: 2.5rem;
  }

  .stats-grid {
    gap: 1rem;
  }

  .stat-value {
    font-size: 1.75rem;
  }

  .year {
    font-size: 2rem;
  }
}
</style>
