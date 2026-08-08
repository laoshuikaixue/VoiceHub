<template>
  <div
    :class="{
      'fixed inset-0 z-[9999] bg-bg-primary-80 backdrop-blur-md': fullScreen,
      'min-h-[200px] py-12': !fullScreen
    }"
    class="flex flex-col items-center justify-center animate-in fade-in duration-300"
  >
    <div class="flex flex-col items-center text-center max-w-md w-full px-6">
      <!-- 加载动画 -->
      <div class="mb-8">
        <!-- 默认圆形加载器 -->
        <div v-if="spinnerType === 'circle'">
          <AppSpinner :size="48" />
        </div>

        <!-- 点状加载器 -->
        <div v-else-if="spinnerType === 'dots'" class="flex gap-2">
          <div
            v-for="i in 3"
            :key="i"
            class="w-3 h-3 bg-primary rounded-full animate-bounce"
            :style="{ animationDelay: `${(i - 1) * 0.2}s` }"
          />
        </div>

        <!-- 脉冲加载器 -->
        <div v-else-if="spinnerType === 'pulse'" class="relative w-12 h-12">
          <div
            v-for="i in 3"
            :key="i"
            class="absolute inset-0 border-2 border-primary rounded-full animate-ping"
            :style="{ animationDelay: `${(i - 1) * 0.4}s`, animationDuration: '2s' }"
          />
        </div>

        <!-- 条状加载器 -->
        <div v-else-if="spinnerType === 'bars'" class="flex items-end gap-1.5 h-8">
          <div
            v-for="i in 5"
            :key="i"
            class="w-1.5 bg-primary rounded-full animate-bounce"
            :style="{
              animationDelay: `${(i - 1) * 0.1}s`,
              height: `${40 + Math.random() * 60}%`
            }"
          />
        </div>
      </div>

      <!-- 加载文本 -->
      <div class="w-full space-y-2">
        <h3 v-if="title" class="text-xl font-black text-text-primary tracking-tight">{{ title }}</h3>
        <p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest">{{ displayMessage }}</p>

        <!-- 进度条 -->
        <div v-if="showProgress" class="mt-8 space-y-2">
          <div class="h-1.5 w-full bg-bg-secondary rounded-full overflow-hidden border border-border-secondary">
            <div
              class="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_var(--primary-50)]"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <div class="flex justify-between items-center px-1">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
              >{{ locale.progress }}</span
            >
            <span class="text-[10px] font-black text-primary tracking-widest"
              >{{ progress }}%</span
            >
          </div>
        </div>

        <!-- 加载步骤 -->
        <div v-if="steps && steps.length > 0" class="mt-8 space-y-3 text-left">
          <div
            v-for="(step, index) in steps"
            :key="index"
            class="flex items-center gap-3 transition-all duration-300"
            :class="{
              'opacity-100': index <= currentStep,
              'opacity-30': index > currentStep
            }"
          >
            <div class="relative flex items-center justify-center w-6 h-6">
              <div
                v-if="index < currentStep"
                class="flex items-center justify-center w-6 h-6 bg-primary-10 border border-primary-20 rounded-lg"
              >
                <Check :size="12" class="text-primary" />
              </div>
              <div
                v-else-if="index === currentStep"
                class="w-6 h-6 flex items-center justify-center"
              >
                <AppSpinner :size="24" />
              </div>
              <div
                v-else
                class="flex items-center justify-center w-6 h-6 bg-bg-secondary border border-border-secondary rounded-lg"
              >
                <span class="text-[10px] font-black text-text-disabled">{{ index + 1 }}</span>
              </div>
            </div>
            <span
              class="text-[10px] font-black uppercase tracking-widest transition-colors"
              :class="index === currentStep ? 'text-text-primary' : 'text-text-disabled'"
            >
              {{ step }}
            </span>
          </div>
        </div>
      </div>

      <!-- 取消按钮 -->
      <button
        v-if="showCancel && onCancel"
        class="mt-10 px-6 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary hover:text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
        @click="onCancel"
      >
        {{ locale.cancel }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Check } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { computed } from 'vue'
import { useLocale } from '~/utils/locale'

const { ui } = useLocale()
const locale = computed(() => ui.value?.loadingState || {})

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

const props = withDefaults(defineProps<Props>(), {
  title: '',
  message: undefined,
  spinnerType: 'circle',
  fullScreen: false,
  showProgress: false,
  progress: 0,
  steps: () => [],
  currentStep: 0,
  showCancel: false,
  onCancel: undefined
})

const displayMessage = computed(() => props.message || locale.value.defaultMessage)
</script>

<style scoped>
/* 保持必要的动画定义，如果 Tailwind 无法完全覆盖的话 */
@keyframes pulse-ring {
  0% {
    transform: scale(0.33);
    opacity: 0;
  }
  80%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
