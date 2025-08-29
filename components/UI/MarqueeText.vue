<template>
  <div class="marquee-container" ref="containerEl">
    <div class="marquee-content" :class="{ scrolling }" ref="contentEl">
      <span class="text-item">{{ text }}</span>
      <span v-if="scrolling" class="text-item">{{ text }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  speed: {
    type: Number,
    default: 40, // pixels per second
  },
});

const containerEl = ref(null);
const contentEl = ref(null);
const scrolling = ref(false);
const isMobile = ref(false);
let mql = null;

const checkOverflow = async () => {
  if (!containerEl.value || !contentEl.value) return;

  // Reset scrolling to measure a single item's width.
  scrolling.value = false;
  await nextTick();

  if (!isMobile.value) {
    return; // No scrolling on desktop.
  }

  const containerWidth = containerEl.value.offsetWidth;
  const contentWidth = contentEl.value.scrollWidth;

  if (contentWidth > containerWidth) {
    scrolling.value = true;
    await nextTick(); // Wait for the second span to render.
    
    // The animation scrolls by 50% of the total width.
    // This distance is equivalent to the width of the first span (including its padding).
    const scrollDistance = contentEl.value.firstElementChild.offsetWidth;
    const animationDuration = scrollDistance / props.speed;
    contentEl.value.style.setProperty('--duration', `${animationDuration}s`);
  }
};

const handleScreenChange = () => {
  if (mql) {
    isMobile.value = mql.matches;
  }
  checkOverflow();
};

onMounted(() => {
  mql = window.matchMedia('(max-width: 768px)');
  
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      handleScreenChange(); // Initial check once visible.
      observer.disconnect();
    }
  }, { threshold: 0.01 });

  if (containerEl.value) {
    observer.observe(containerEl.value);
  }
  
  mql.addEventListener('change', handleScreenChange);
  window.addEventListener('resize', handleScreenChange);
});

onUnmounted(() => {
  if (mql) {
    mql.removeEventListener('change', handleScreenChange);
  }
  window.removeEventListener('resize', handleScreenChange);
});

watch(() => props.text, () => {
  checkOverflow();
});
</script>

<style scoped>
.marquee-container {
  overflow: hidden;
  width: 100%;
  white-space: nowrap;
}

.marquee-content {
  display: inline-block;
}

.marquee-content.scrolling {
  animation: marquee var(--duration) linear infinite;
  will-change: transform;
}

.text-item {
  display: inline-block;
  padding-right: 50px; /* Space between repeated text */
  vertical-align: middle;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
</style>