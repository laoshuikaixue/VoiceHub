<template>
  <div class="slide-container intro-bg">
    <!-- Dynamic Background Elements -->
    <div class="blob blob-1" />
    <div class="blob blob-2" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div class="year-bg">{{ data.year }}</div>
        <div class="sub-title">{{ yearReview.reportTitle }}</div>
        <h1 class="main-title">VoiceHub</h1>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { useLocale } from '~/utils/locale'

defineProps({
  data: Object,
  active: Boolean
})
const { yearReview } = useLocale()
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
  background: radial-gradient(circle at center, var(--panel-bg-dark), var(--bg-primary));
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
  background: var(--year-review-blob-1-bg);
  animation: spin 20s linear infinite;
}

.blob-2 {
  bottom: -10%;
  right: -10%;
  width: 600px;
  height: 600px;
  background: var(--year-review-blob-2-bg);
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
  color: var(--overlay-3);
  pointer-events: none;
  user-select: none;
  line-height: 1;
}

.sub-title {
  font-size: 1.5rem;
  font-weight: 300;
  color: var(--text-muted);
  margin-bottom: 1rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.main-title {
  font-size: 5rem;
  font-weight: 900;
  background-image: linear-gradient(to right, var(--text-primary), var(--panel-border-light), var(--text-muted));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 2rem;
  filter: drop-shadow(0 25px 25px var(--mask-15));
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
