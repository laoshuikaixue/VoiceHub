<template>
  <div class="slide-container">
    <div class="bg-gradient" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div v-if="data.topPlatform" class="card platform-card">
          <span class="label">{{ yearReview.commonPlatform }}</span>
          <span class="platform-value">{{ formatPlatform(data.topPlatform) }}</span>
        </div>

        <div class="grid-container">
          <div v-if="data.activeMonth" class="card active-card">
            <span class="label">{{ yearReview.mostActive }}</span>
            <span class="active-value">{{ yearReview.activeMonth(data.activeMonth) }}</span>
          </div>

          <div class="card votes-card">
            <span class="label">{{ yearReview.votesCast }}</span>
            <span class="votes-value">{{ data.totalVotes }}</span>
          </div>
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

const formatPlatform = (platform) => {
  const map = yearReview.value.platforms
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
  background-color: var(--panel-bg-dark); /* gray-900 */
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(to bottom, var(--panel-border-subtle), transparent);
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
  background: var(--overlay-5);
  border: 1px solid var(--overlay-10);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.label {
  font-size: 0.75rem;
  color: var(--year-review-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem; /* adjusted */
}

.platform-value {
  font-size: 1.5rem; /* text-2xl */
  font-weight: 700;
  background-image: linear-gradient(to right, var(--color-error-light), var(--color-orange));
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
  color: var(--year-review-text-yellow);
}

.unit {
  font-size: 1rem;
  margin-left: 0.25rem;
  color: var(--text-muted);
}

.votes-value {
  font-size: 1.875rem; /* text-3xl */
  font-weight: 700;
  color: var(--year-review-text-cyan); /* cyan-300 */
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
