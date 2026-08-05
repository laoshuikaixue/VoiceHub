<template>
  <div class="slide-container">
    <div class="bg-gradient" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div class="label">{{ yearReview.musicJourney }}</div>

        <p class="text-intro">{{ yearReview.totalRequestsIntro }}</p>

        <div class="number-container">
          <span class="big-number">{{ data.totalRequests.toLocaleString() }}</span>
          <span class="suffix">{{ yearReview.requestCount }}</span>
        </div>

        <div class="sub-stats">
          <div v-if="data.playedRequests > 0" class="sub-content">
            <p class="text-base">
              {{ yearReview.playedSummary(data.playedRequests) }}
            </p>
            <p class="text-sub">{{ yearReview.playedDesc }}</p>
          </div>
          <p v-else class="text-sub">{{ yearReview.pendingPlayedDesc }}</p>
        </div>
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
  background-color: var(--panel-bg-darkest); /* gray-950 */
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at top right,
    var(--year-review-stats-bg-gradient),
    transparent,
    transparent
  );
}

.content {
  z-index: 10;
  max-width: 42rem;
  padding: 1.5rem;
  text-align: center;
}

.label {
  margin-bottom: 1rem;
  color: var(--color-accent-light); /* brand-blue */
  font-weight: 700;
  letter-spacing: 0.05em;
  font-size: 1.125rem;
}

.text-intro {
  font-size: 1.5rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.number-container {
  position: relative;
  padding: 1rem 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
}

.big-number {
  font-size: 10rem;
  font-weight: 900;
  line-height: 1;
  background-image: linear-gradient(to bottom, var(--color-accent-light), var(--color-accent-light-hover));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 30px var(--year-review-stat-number-shadow));
}

.suffix {
  font-size: 1.5rem;
  color: var(--year-review-text-tertiary);
  font-weight: 500;
  margin-left: 0.5rem;
}

.sub-stats {
  margin-top: 3rem;
  padding: 1.5rem;
  border-radius: 1rem;
  background: var(--overlay-5);
  border: 1px solid var(--overlay-10);
  backdrop-filter: blur(4px);
}

.sub-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.text-base {
  font-size: 1.125rem;
  color: var(--text-primary-lighter);
}

.highlight-green {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--color-success-light);
  margin: 0 0.25rem;
}

.text-sub {
  font-size: 1rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .number-container {
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .big-number {
    font-size: 7rem;
  }
  .text-intro {
    font-size: 1.25rem;
  }
  .suffix {
    font-size: 1.25rem;
    margin-top: 0.5rem;
    margin-left: 0;
  }
}
</style>
