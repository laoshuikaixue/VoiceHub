<template>
  <div class="slide-container">
    <div class="bg-gradient" />

    <Transition name="entry" appear>
      <div v-show="active" class="content">
        <div class="label">未来可期</div>

        <div class="year-container">
          <h2 class="year-next">{{ data.year + 1 }}</h2>
          <div class="year-underline" />
        </div>

        <p class="text-intro">愿音乐继续陪伴你的每一天</p>

        <div class="action-buttons">
          <NuxtLink to="/" class="btn-primary group">
            <div class="btn-bg" />
            <span class="btn-content">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              返回首页
            </span>
          </NuxtLink>
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
defineEmits(['share'])
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
  background-color: #000;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, #1f2937, #000, #000);
  opacity: 0.5;
}

.content {
  z-index: 10;
  text-align: center;
  padding: 1.5rem;
  width: 100%;
  max-width: 32rem;
}

.label {
  color: #6b7280;
  font-size: 0.875rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  margin-bottom: 2rem;
}

.year-container {
  position: relative;
  margin-bottom: 3rem;
  display: inline-block;
}

.year-next {
  font-size: 6rem;
  font-weight: 900;
  line-height: 1;
  background-image: linear-gradient(to bottom, #fff, #1f2937);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.year-underline {
  position: absolute;
  bottom: -1rem;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
}

.text-intro {
  font-size: 1.125rem;
  color: #9ca3af;
  margin-bottom: 3rem;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

@media (min-width: 640px) {
  .action-buttons {
    flex-direction: row;
  }
}

.btn-primary {
  position: relative;
  width: 100%;
  padding: 1rem 2rem;
  border-radius: 9999px;
  background: #fff;
  color: #000;
  font-weight: 700;
  font-size: 1.125rem;
  overflow: hidden;
  display: flex;
  justify-content: center;
  text-decoration: none;
  transition: transform 0.1s;
}

.btn-primary:active {
  transform: scale(0.95);
}

.btn-bg {
  position: absolute;
  inset: 0;
  background: #e5e7eb;
  transform: translateY(100%);
  transition: transform 0.3s;
}

.btn-primary:hover .btn-bg {
  transform: translateY(0);
}

.btn-content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary {
  width: 100%;
  padding: 1rem 2rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-weight: 700;
  font-size: 1.125rem;
  backdrop-filter: blur(12px);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-secondary:active {
  transform: scale(0.95);
}

@media (min-width: 640px) {
  .btn-primary,
  .btn-secondary {
    width: auto;
  }
}

@media (max-width: 768px) {
  .year-next {
    font-size: 4rem;
  }
  .text-intro {
    font-size: 1rem;
  }
}
</style>
