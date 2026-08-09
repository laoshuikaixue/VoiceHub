<template>
  <div v-if="data.topArtist" class="slide-container">
    <!-- Background Gradients -->
    <div class="bg-overlay" />
    <div class="animated-bg" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div class="label">{{ yearReview.favoriteArtist }}</div>

        <p class="text-intro">{{ yearReview.topArtistIntro }}</p>

        <div class="artist-container">
          <div class="artist-bg-blur" />
          <h2 class="artist-name">{{ data.topArtist }}</h2>
        </div>

        <p class="text-desc">{{ yearReview.artistDesc }}</p>
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
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: var(--panel-bg-tertiary);
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg-primary), transparent, transparent);
  opacity: 0.8;
  z-index: 10;
}

.animated-bg {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, var(--color-collab-hover), var(--bg-primary));
  opacity: 0.5;
  animation: pulse 8s infinite;
}

.content {
  z-index: 20;
  width: 100%;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.label {
  color: var(--color-collab-light); /* purple-300 */
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  border-bottom: 1px solid var(--year-review-artist-label-border);
  padding-bottom: 0.5rem;
}

.text-intro {
  font-size: 1.5rem;
  color: var(--text-primary-lighter);
  font-weight: 300;
  margin-bottom: 3rem;
}

.artist-container {
  position: relative;
  width: 100%;
}

.artist-bg-blur {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120%;
  height: 120%;
  background: var(--year-review-artist-bg-blur);
  filter: blur(60px);
  border-radius: 50%;
}

.artist-name {
  position: relative;
  font-size: 5rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.05em;
  background-image: linear-gradient(to bottom right, var(--color-collab-light), var(--color-pink), var(--color-orange));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 25px 25px var(--mask-15));
  word-break: break-word;
  padding: 0 0.5rem;
}

.text-desc {
  margin-top: 3rem;
  color: var(--text-muted);
  max-width: 24rem;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.625;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .artist-name {
    font-size: 3rem;
  }
  .text-intro {
    font-size: 1.25rem;
    margin-bottom: 2rem;
  }
}
</style>
