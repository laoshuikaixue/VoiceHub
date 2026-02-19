<template>
  <div class="slide-container intro-bg">
    <!-- Dynamic Background Elements -->
    <div class="blob blob-1" />
    <div class="blob blob-2" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div class="year-bg">{{ data.year }}</div>
        <div class="sub-title">年度点歌报告</div>
        <h1 class="main-title">VoiceHub</h1>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineProps({
  data: Object,
  active: Boolean
})
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
  background: radial-gradient(circle at center, #111827, #000000);
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.3;
}

.blob-1 {
  top: -20%;
  left: -10%;
  width: 500px;
  height: 500px;
  background: rgba(139, 92, 246, 0.4); /* brand-purple */
  animation: spin 20s linear infinite;
}

.blob-2 {
  bottom: -10%;
  right: -10%;
  width: 600px;
  height: 600px;
  background: rgba(244, 114, 182, 0.2); /* brand-pink */
  animation: reverse-spin 25s linear infinite;
}

.content {
  z-index: 10;
  text-align: center;
  padding: 1.5rem;
  position: relative;
}

.year-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.03);
  pointer-events: none;
  user-select: none;
  line-height: 1;
}

.sub-title {
  font-size: 1.5rem;
  font-weight: 300;
  color: #9ca3af;
  margin-bottom: 1rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.main-title {
  font-size: 5rem;
  font-weight: 900;
  background-image: linear-gradient(to right, #ffffff, #e5e7eb, #6b7280);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 2rem;
  filter: drop-shadow(0 25px 25px rgba(0, 0, 0, 0.15));
}

@media (max-width: 768px) {
  .year-bg {
    font-size: 8rem;
  }
  .main-title {
    font-size: 3rem;
  }
  .sub-title {
    font-size: 1rem;
  }
}
</style>
