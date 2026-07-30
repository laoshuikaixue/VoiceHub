<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center p-6">
    <div class="max-w-md w-full">
      <div
        class="bg-bg-secondary-40 border border-border-secondary rounded-3xl p-8 md:p-10 shadow-2xl text-center space-y-8"
      >
        <!-- 错误图标 -->
        <div class="flex justify-center">
          <div class="relative">
            <div
              class="w-24 h-24 rounded-3xl bg-error-10 border border-error-20 flex items-center justify-center text-error"
            >
              <ShieldAlert :size="48" stroke-width="1.5" />
            </div>
            <div
              class="absolute -top-2 -right-2 w-8 h-8 bg-bg-primary border border-border-secondary rounded-full flex items-center justify-center text-error shadow-xl"
            >
              <X :size="16" stroke-width="3" />
            </div>
          </div>
        </div>

        <!-- 错误标题与信息 -->
        <div class="space-y-3">
          <h1 class="text-2xl font-black text-text-primary tracking-tight">{{ errorTitle }}</h1>
          <p class="text-sm text-text-tertiary leading-relaxed">{{ errorMessage }}</p>
        </div>

        <!-- 错误详情 -->
        <div
          v-if="errorCode"
          class="p-4 bg-bg-primary-50 border border-border-secondary rounded-2xl space-y-2"
        >
          <p class="text-[10px] text-text-disabled font-black uppercase tracking-widest">{{ locale.errorCode }}</p>
          <code
            class="text-xs font-mono text-primary font-bold bg-primary-5 px-2 py-1 rounded-lg"
          >
            {{ errorCode }}
          </code>
        </div>

        <!-- 操作按钮 -->
        <div class="grid grid-cols-1 gap-3 pt-4">
          <NuxtLink
            to="/login"
            class="flex items-center justify-center gap-2 py-3 bg-primary-hover hover:bg-primary text-text-primary text-sm font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95"
          >
            <LogIn :size="18" />
            {{ primaryActionLabel }}
          </NuxtLink>
          <NuxtLink
            to="/"
            class="flex items-center justify-center gap-2 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-sm font-black rounded-xl transition-all active:scale-95"
          >
            <Home :size="18" />
            {{ locale.backHome }}
          </NuxtLink>
        </div>

        <!-- 底部提示 -->
        <p class="text-[10px] text-text-secondary font-medium uppercase tracking-widest pt-4">
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
const locale = computed(() => pages.value?.authError || {})

const errorCode = computed(() => {
  const code = Array.isArray(route.query.code) ? route.query.code[0] : route.query.code
  return typeof code === 'string' ? code : ''
})
const isAggregateLoginUnavailable = computed(
  () => errorCode.value === 'AGGREGATE_LOGIN_UNAVAILABLE'
)
const errorTitle = computed(() =>
  isAggregateLoginUnavailable.value
    ? locale.value.aggregateUnavailableTitle || '当前登录方式暂不可用'
    : locale.value.title
)
const primaryActionLabel = computed(() =>
  isAggregateLoginUnavailable.value
    ? locale.value.aggregateUnavailableAction || '选择其他登录方式'
    : locale.value.retryLogin
)
const errorMessage = computed(() => {
  const message = Array.isArray(route.query.message) ? route.query.message[0] : route.query.message
  return typeof message === 'string' && message ? message : locale.value.defaultMessage
})

definePageMeta({
  layout: 'default'
})
</script>

<style scoped></style>
