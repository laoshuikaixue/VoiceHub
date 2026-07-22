<template>
  <div v-if="hasEnabledProviders" class="mt-6 w-full">
    <div class="flex items-center text-center text-[var(--text-tertiary)] text-xs mb-4">
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
      <span class="px-2.5">或使用第三方账号登录</span>
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
    </div>
    <div class="flex flex-wrap justify-center gap-4">
      <button
        v-for="provider in enabledProviders"
        :key="provider.key"
        type="button"
        :class="providerButtonClass(provider)"
        :title="`使用 ${provider.name} 登录`"
        @click="loginWith(provider)"
      >
        <AuthProvidersGitHubIcon v-if="provider.key === 'github'" />
        <AuthProvidersCasdoorIcon v-else-if="provider.key === 'casdoor'" />
        <AuthProvidersGoogleIcon v-else-if="provider.key === 'google'" />
        <Icon
          v-else-if="provider.routeProvider === 'aggregate'"
          :name="getAggregateOAuthLoginTypeIcon(provider.loginType)"
          :size="26"
        />
        <Shield v-else :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { Shield } from '@lucide/vue'
import Icon from '~/components/UI/Icon.vue'
import { getAggregateOAuthLoginTypeIcon } from '~/utils/oauth'

const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const route = useRoute()

onMounted(async () => {
  await refreshSiteConfig()
})

const enabledProviders = computed(() => oauthProviders.value || [])

const hasEnabledProviders = computed(() => {
  return enabledProviders.value.length > 0
})

const providerButtonClass = (provider) => {
  const key = provider.routeProvider || provider.key
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
  if (key === 'aggregate') {
    const aggregateClasses = {
      qq: 'hover:bg-[#12b7f5] hover:text-white hover:border-[#12b7f5]',
      wx: 'hover:bg-[#07c160] hover:text-white hover:border-[#07c160]',
      alipay: 'hover:bg-[#1677ff] hover:text-white hover:border-[#1677ff]',
      sina: 'hover:bg-[#e6162d] hover:text-white hover:border-[#e6162d]',
      baidu: 'hover:bg-[#2932e1] hover:text-white hover:border-[#2932e1]',
      douyin: 'hover:bg-[#161823] hover:text-white hover:border-[#25f4ee]',
      huawei: 'hover:bg-[#cf0a2c] hover:text-white hover:border-[#cf0a2c]',
      xiaomi: 'hover:bg-[#ff6900] hover:text-white hover:border-[#ff6900]',
      gitee: 'hover:bg-[#c71d23] hover:text-white hover:border-[#c71d23]',
      gitea: 'hover:bg-white hover:text-black hover:border-white',
      bilibili: 'hover:bg-[#00a1d6] hover:text-white hover:border-[#00a1d6]',
      kuaishou: 'hover:bg-[#ff4906] hover:text-white hover:border-[#ff4906]'
    }
    return `${baseClass} ${aggregateClasses[provider.loginType] || ''}`
  }
  if (key === 'oauth2') {
    return `${baseClass} hover:bg-[#0f766e] hover:text-white hover:border-[#0f766e]`
  }

  return `${baseClass} hover:border-blue-500/40 hover:text-blue-400`
}

const loginWith = (provider) => {
  const queryRedirect = route.query.redirect
  const redirect = Array.isArray(queryRedirect) ? queryRedirect[0] : queryRedirect
  const safeRedirect =
    redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')
      ? redirect
      : null
  const query = new URLSearchParams()
  if (provider.loginType) query.set('type', provider.loginType)
  if (safeRedirect) query.set('redirect', safeRedirect)
  const queryString = query.toString()
  const routeProvider = provider.routeProvider || provider.key
  // 外部导航到 API 端点
  navigateTo(`/api/auth/${routeProvider}${queryString ? `?${queryString}` : ''}`, {
    external: true
  })
}
</script>
