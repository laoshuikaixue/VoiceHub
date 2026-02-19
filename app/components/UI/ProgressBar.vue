<template>
  <div class="progress-container">
    <div v-if="showPercentage || message" class="progress-info">
      <span v-if="message" class="progress-message">{{ message }}</span>
      <span v-if="showPercentage" class="progress-percentage">{{ percentage }}%</span>
    </div>
    <div class="progress-bar">
      <div
        :class="{ indeterminate: indeterminate }"
        :style="{ width: `${percentage}%` }"
        class="progress-fill"
      />
    </div>
    <div v-if="subMessage" class="progress-sub-message">{{ subMessage }}</div>
  </div>
</template>

<script setup>
defineProps({
  percentage: {
    type: Number,
    default: 0,
    validator: (value) => value >= 0 && value <= 100
  },
  message: {
    type: String,
    default: ''
  },
  subMessage: {
    type: String,
    default: ''
  },
  showPercentage: {
    type: Boolean,
    default: true
  },
  indeterminate: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.progress-container {
  margin: 15px 0;
  width: 100%;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 14px;
}

.progress-bar {
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #3490dc;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.indeterminate {
  width: 30% !important;
  animation: progress-indeterminate 1.5s ease-in-out infinite;
  background-image: linear-gradient(to right, #3490dc, #38c172, #3490dc);
  background-size: 200% 100%;
}

.progress-sub-message {
  margin-top: 5px;
  font-size: 12px;
  color: #6c757d;
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
</style>
