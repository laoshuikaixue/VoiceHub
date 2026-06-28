<template>
  <div class="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
    <div class="max-w-md w-full">
      <div
        class="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-8 md:p-10 shadow-2xl text-center space-y-8"
      >
        <!-- 错误图标 -->
        <div class="flex justify-center">
          <div class="relative">
            <div
              class="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500"
            >
              <ShieldAlert :size="48" stroke-width="1.5" />
            </div>
            <div
              class="absolute -top-2 -right-2 w-8 h-8 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center text-rose-500 shadow-xl"
            >
              <X :size="16" stroke-width="3" />
            </div>
          </div>
        </div>

        <!-- 错误标题与信息 -->
        <div class="space-y-3">
          <h1 class="text-2xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h1>
          <p class="text-sm text-zinc-500 leading-relaxed">{{ errorMessage }}</p>
        </div>

        <!-- 错误详情 -->
        <div
          v-if="errorCode"
          class="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl space-y-2"
        >
          <p class="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{{ locale.errorCode }}</p>
          <code
            class="text-xs font-mono text-blue-500 font-bold bg-blue-500/5 px-2 py-1 rounded-lg"
          >
            {{ errorCode }}
          </code>
        </div>

        <!-- 操作按钮 -->
        <div class="grid grid-cols-1 gap-3 pt-4">
          <NuxtLink
            to="/login"
            class="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            <LogIn :size="18" />
            {{ locale.retryLogin }}
          </NuxtLink>
          <NuxtLink
            to="/"
            class="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-black rounded-xl transition-all active:scale-95"
          >
            <Home :size="18" />
            {{ locale.backHome }}
          </NuxtLink>
        </div>

        <!-- 底部提示 -->
        <p class="text-[10px] text-zinc-700 font-medium uppercase tracking-widest pt-4">
          {{ locale.contactAdmin }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ShieldAlert, X, LogIn, Home } from '@lucide/vue'
import { useLocale } from '~/utils/locale'

const route = useRoute()
const { pages } = useLocale()
const locale = computed(() => pages.value.authError)

const errorCode = computed(() => route.query.code)
const errorMessage = computed(
  () => route.query.message || locale.value.defaultMessage
)

definePageMeta({
  layout: 'default'
})
</script>

<style scoped></style>
