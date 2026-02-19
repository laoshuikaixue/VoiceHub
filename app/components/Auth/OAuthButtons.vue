<template>
  <div v-if="hasEnabledProviders" class="mt-6 w-full">
    <div class="flex items-center text-center text-[var(--text-tertiary)] text-xs mb-4">
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
      <span class="px-2.5">或使用第三方账号登录</span>
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
    </div>
    <div class="flex justify-center gap-4">
      <button
        v-if="config.public.oauth.github"
        type="button"
        class="w-12 h-12 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--bg-tertiary)] hover:bg-[#24292e] hover:text-white hover:border-[#24292e]"
        title="使用 GitHub 登录"
        @click="loginWith('github')"
      >
        <AuthProvidersGitHubIcon />
      </button>

      <button
        v-if="config.public.oauth.google"
        type="button"
        class="w-12 h-12 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--bg-tertiary)] hover:bg-white hover:text-black hover:border-[#dadce0]"
        title="使用 Google 登录"
        @click="loginWith('google')"
      >
        <AuthProvidersGoogleIcon />
      </button>

      <!-- 其他提供商可在此添加 -->
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()

const hasEnabledProviders = computed(() => {
  return config.public.oauth && Object.values(config.public.oauth).some((enabled) => enabled)
})

const loginWith = (provider: string) => {
  // 外部导航到 API 端点
  navigateTo(`/api/auth/${provider}`, { external: true })
}
</script>
