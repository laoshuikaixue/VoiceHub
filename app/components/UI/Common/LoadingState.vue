<template>
  <div
    :class="{
      'fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md': fullScreen,
      'min-h-[200px] py-12': !fullScreen
    }"
    class="flex flex-col items-center justify-center animate-in fade-in duration-300"
  >
    <div class="flex flex-col items-center text-center max-w-md w-full px-6">
      <!-- 加载动画 -->
      <div class="mb-8">
        <!-- 默认圆形加载器 -->
        <div v-if="spinnerType === 'circle'" class="relative">
          <div
            class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
          />
          <div class="absolute inset-0 blur-lg bg-blue-500/20 rounded-full animate-pulse" />
        </div>

        <!-- 点状加载器 -->
        <div v-else-if="spinnerType === 'dots'" class="flex gap-2">
          <div
            v-for="i in 3"
            :key="i"
            class="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
            :style="{ animationDelay: `${(i - 1) * 0.2}s` }"
          />
        </div>

        <!-- 脉冲加载器 -->
        <div v-else-if="spinnerType === 'pulse'" class="relative w-12 h-12">
          <div
            v-for="i in 3"
            :key="i"
            class="absolute inset-0 border-2 border-blue-500 rounded-full animate-ping"
            :style="{ animationDelay: `${(i - 1) * 0.4}s`, animationDuration: '2s' }"
          />
        </div>

        <!-- 条状加载器 -->
        <div v-else-if="spinnerType === 'bars'" class="flex items-end gap-1.5 h-8">
          <div
            v-for="i in 5"
            :key="i"
            class="w-1.5 bg-blue-500 rounded-full animate-bounce"
            :style="{
              animationDelay: `${(i - 1) * 0.1}s`,
              height: `${40 + Math.random() * 60}%`
            }"
          />
        </div>
      </div>

      <!-- 加载文本 -->
      <div class="w-full space-y-2">
        <h3 v-if="title" class="text-xl font-black text-zinc-100 tracking-tight">{{ title }}</h3>
        <p class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{{ message }}</p>

        <!-- 进度条 -->
        <div v-if="showProgress" class="mt-8 space-y-2">
          <div class="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              class="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <div class="flex justify-between items-center px-1">
            <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
              >加载进度</span
            >
            <span class="text-[10px] font-black text-blue-500 tracking-widest"
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
                class="flex items-center justify-center w-6 h-6 bg-blue-500/10 border border-blue-500/20 rounded-lg"
              >
                <Check :size="12" class="text-blue-500" />
              </div>
              <div
                v-else-if="index === currentStep"
                class="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-lg animate-spin"
              />
              <div
                v-else
                class="flex items-center justify-center w-6 h-6 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                <span class="text-[10px] font-black text-zinc-600">{{ index + 1 }}</span>
              </div>
            </div>
            <span
              class="text-[10px] font-black uppercase tracking-widest transition-colors"
              :class="index === currentStep ? 'text-zinc-200' : 'text-zinc-600'"
            >
              {{ step }}
            </span>
          </div>
        </div>
      </div>

      <!-- 取消按钮 -->
      <button
        v-if="showCancel && onCancel"
        class="mt-10 px-6 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
        @click="onCancel"
      >
        取消加载
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Check } from 'lucide-vue-next'

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
