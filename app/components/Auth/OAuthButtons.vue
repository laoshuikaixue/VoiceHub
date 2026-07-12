<template>
  <div v-if="hasEnabledProviders" class="mt-6 w-full">
    <div class="flex items-center text-center text-[var(--text-tertiary)] text-xs mb-4">
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
      <span class="px-2.5">{{ locale.divider }}</span>
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
    </div>
    <div class="flex justify-center gap-4">
      <button
        v-for="provider in enabledProviders"
        :key="provider.key"
        type="button"
        :class="providerButtonClass(provider.key)"
        :title="formatLocale(locale.loginWith, provider.name)"
        @click="loginWith(provider.key)"
      >
        <AuthProvidersGitHubIcon v-if="provider.key === 'github'" />
        <AuthProvidersCasdoorIcon v-else-if="provider.key === 'casdoor'" />
        <AuthProvidersGoogleIcon v-else-if="provider.key === 'google'" />
        <Shield v-else :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Shield } from '@lucide/vue'
import { useLocale } from '~/utils/locale'

const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const route = useRoute()
const { auth } = useLocale()
const locale = computed(() => auth.value?.oauthButtons || {})
const formatLocale = (value: unknown, ...args: unknown[]) => {
  if (typeof value === 'function') return value(...args)
  if (typeof value === 'string') {
    return value.replace(/{(\d+)}/g, (match, index) =>
      args[Number(index)] !== undefined ? String(args[Number(index)]) : match
    )
  }
  return ''
}

onMounted(async () => {
  await refreshSiteConfig()
})

const enabledProviders = computed(() => oauthProviders.value || [])

const hasEnabledProviders = computed(() => {
  return enabledProviders.value.length > 0
})

const providerButtonClass = (key: string) => {
  const baseClass =
    'w-12 h-12 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--bg-tertiary)]'

  if (key === 'github') {
    return `${baseClass} hover:bg-[#24292e] hover:text-white hover:border-[#24292e]`
  }
  if (key === 'casdoor') {
    return `${baseClass} hover:border-[#67c23a]`
  }
  if (key === 'google') {
    return `${baseClass} hover:bg-white hover:text-black hover:border-[#dadce0]`
  }
  if (key === 'oauth2') {
    return `${baseClass} hover:bg-[#0f766e] hover:text-white hover:border-[#0f766e]`
  }

  return `${baseClass} hover:border-blue-500/40 hover:text-blue-400`
}

const loginWith = (provider: string) => {
  const queryRedirect = route.query.redirect
  const redirect = Array.isArray(queryRedirect) ? queryRedirect[0] : queryRedirect
  const safeRedirect =
    redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')
      ? redirect
      : null
  const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ''
  // 外部导航到 API 端点
  navigateTo(`/api/auth/${provider}${redirectQuery}`, { external: true })
}
</script>
