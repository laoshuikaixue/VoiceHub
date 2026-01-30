<template>
  <div :class="{ 'full-screen': fullScreen }" class="loading-state">
    <div class="loading-content">
      <!-- 加载动画 -->
      <div :class="spinnerType" class="loading-spinner">
        <div v-if="spinnerType === 'dots'" class="dots-spinner">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>

        <div v-else-if="spinnerType === 'pulse'" class="pulse-spinner">
          <div class="pulse-ring"></div>
          <div class="pulse-ring"></div>
          <div class="pulse-ring"></div>
        </div>

        <div v-else-if="spinnerType === 'bars'" class="bars-spinner">
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
        </div>

        <div v-else class="circle-spinner">
          <svg viewBox="0 0 50 50">
            <circle
                cx="25"
                cy="25"
                fill="none"
                r="20"
                stroke="currentColor"
                stroke-dasharray="31.416"
                stroke-dashoffset="31.416"
                stroke-linecap="round"
                stroke-width="3"
            >
              <animate
                  attributeName="stroke-dasharray"
                  dur="2s"
                  repeatCount="indefinite"
                  values="0 31.416;15.708 15.708;0 31.416"
              />
              <animate
                  attributeName="stroke-dashoffset"
                  dur="2s"
                  repeatCount="indefinite"
                  values="0;-15.708;-31.416"
              />
            </circle>
          </svg>
        </div>
      </div>

      <!-- 加载文本 -->
      <div class="loading-text">
        <h3 v-if="title" class="loading-title">{{ title }}</h3>
        <p class="loading-message">{{ message }}</p>

        <!-- 进度条 -->
        <div v-if="showProgress" class="progress-container">
          <div class="progress-bar">
            <div
                :style="{ width: `${progress}%` }"
                class="progress-fill"
            ></div>
          </div>
          <span class="progress-text">{{ progress }}%</span>
        </div>

        <!-- 加载步骤 -->
        <div v-if="steps && steps.length > 0" class="loading-steps">
          <div
              v-for="(step, index) in steps"
              :key="index"
              :class="{
              'completed': index < currentStep,
              'active': index === currentStep,
              'pending': index > currentStep
            }"
              class="step-item"
          >
            <div class="step-icon">
              <svg v-if="index < currentStep" fill="none" viewBox="0 0 24 24">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
                      stroke-width="2"/>
              </svg>
              <div v-else-if="index === currentStep" class="step-spinner"></div>
              <span v-else class="step-number">{{ index + 1 }}</span>
            </div>
            <span class="step-text">{{ step }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 取消按钮 -->
    <button
        v-if="showCancel && onCancel"
        class="cancel-btn"
        @click="onCancel"
    >
      取消
    </button>
  </div>
</template>

<script lang="ts" setup>
interface Props {
  title?: string
  message?: string
  spinnerType?: 'circle' | 'dots' | 'pulse' | 'bars'
  fullScreen?: boolean
  showProgress?: boolean
  progress?: number
  steps?: string[]
  currentStep?: number
  showCancel?: boolean
  onCancel?: () => void
}

withDefaults(defineProps<Props>(), {
  title: '',
  message: '正在加载...',
  spinnerType: 'circle',
  fullScreen: false,
  showProgress: false,
  progress: 0,
  steps: () => [],
  currentStep: 0,
  showCancel: false,
  onCancel: undefined
})
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  min-height: 200px;
}

.loading-state.full-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  z-index: 9999;
  min-height: 100vh;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
}

/* 加载动画样式 */
.loading-spinner {
  margin-bottom: 24px;
}

/* 圆形加载器 */
.circle-spinner {
  width: 50px;
  height: 50px;
  color: #4f46e5;
}

.circle-spinner svg {
  width: 100%;
  height: 100%;
  transform-origin: center;
  animation: rotate 2s linear infinite;
}

/* 点状加载器 */
.dots-spinner {
  display: flex;
  gap: 4px;
}

.dots-spinner .dot {
  width: 8px;
  height: 8px;
  background: #4f46e5;
  border-radius: 50%;
  animation: dots-bounce 1.4s ease-in-out infinite both;
}

.dots-spinner .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dots-spinner .dot:nth-child(2) {
  animation-delay: -0.16s;
}

.dots-spinner .dot:nth-child(3) {
  animation-delay: 0s;
}

/* 脉冲加载器 */
.pulse-spinner {
  position: relative;
  width: 40px;
  height: 40px;
}

.pulse-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 3px solid #4f46e5;
  border-radius: 50%;
  opacity: 0;
  animation: pulse-ring 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.pulse-ring:nth-child(2) {
  animation-delay: 0.33s;
}

.pulse-ring:nth-child(3) {
  animation-delay: 0.66s;
}

/* 条状加载器 */
.bars-spinner {
  display: flex;
  gap: 3px;
  align-items: end;
  height: 30px;
}

.bars-spinner .bar {
  width: 4px;
  background: #4f46e5;
  border-radius: 2px;
  animation: bars-scale 1.2s ease-in-out infinite;
}

.bars-spinner .bar:nth-child(1) {
  animation-delay: -1.1s;
}

.bars-spinner .bar:nth-child(2) {
  animation-delay: -1.0s;
}

.bars-spinner .bar:nth-child(3) {
  animation-delay: -0.9s;
}

.bars-spinner .bar:nth-child(4) {
  animation-delay: -0.8s;
}

.bars-spinner .bar:nth-child(5) {
  animation-delay: -0.7s;
}

/* 文本样式 */
.loading-text {
  width: 100%;
}

.loading-title {
  font-size: 20px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 8px 0;
}

.loading-message {
  font-size: 16px;
  color: #94a3b8;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

/* 进度条 */
.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  width: 100%;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  font-weight: 500;
  color: #4f46e5;
  min-width: 40px;
}

/* 加载步骤 */
.loading-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  text-align: left;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  transition: all 0.3s ease;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.step-item.completed .step-icon {
  background: #10b981;
  color: white;
}

.step-item.completed .step-icon svg {
  width: 14px;
  height: 14px;
}

.step-item.active .step-icon {
  background: #4f46e5;
  color: white;
}

.step-item.pending .step-icon {
  background: rgba(255, 255, 255, 0.1);
  color: #64748b;
}

.step-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.step-text {
  font-size: 14px;
  transition: color 0.3s ease;
}

.step-item.completed .step-text {
  color: #10b981;
}

.step-item.active .step-text {
  color: #f1f5f9;
  font-weight: 500;
}

.step-item.pending .step-text {
  color: #64748b;
}

/* 取消按钮 */
.cancel-btn {
  margin-top: 24px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #94a3b8;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: #f1f5f9;
}

/* 动画定义 */
@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes dots-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.33);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

@keyframes bars-scale {
  0%, 40%, 100% {
    transform: scaleY(0.4);
  }
  20% {
    transform: scaleY(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-state {
    padding: 24px 16px;
  }

  .loading-title {
    font-size: 18px;
  }

  .loading-message {
    font-size: 14px;
  }

  .loading-steps {
    text-align: center;
  }

  .step-item {
    justify-content: center;
  }
}
</style>