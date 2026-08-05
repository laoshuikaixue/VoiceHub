<template>
  <div v-if="hasEnabledProviders" class="mt-6 w-full">
    <div class="flex items-center text-center text-[var(--text-tertiary)] text-xs mb-4">
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
      <span class="px-2.5">{{ locale.divider }}</span>
      <div class="flex-1 border-b border-[var(--border-color)] opacity-20" />
    </div>
    <div class="flex flex-wrap justify-center gap-4">
      <button
        v-for="provider in enabledProviders"
        :key="provider.key"
        type="button"
        :class="providerButtonClass(provider)"
        :title="formatLocale(locale.loginWith, provider.name)"
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
import { useLocale } from '~/utils/locale'
import Icon from '~/components/UI/Icon.vue'
import { getAggregateOAuthLoginTypeIcon } from '~/utils/oauth'

const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const route = useRoute()
const { auth } = useLocale()
const locale = computed(() => auth.value?.oauthButtons || {})
const formatLocale = (value, ...args) => {
  if (typeof value === 'function') return value(...args)
  if (typeof value === 'string') {
    return value.replace(/{(\d+)}/g, (match, index) =>
      args[Number(index)] !== undefined ? String(args[Number(index)]) : match
    )
  }
  return 'OAuth 登录'
}

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
    return `${baseClass} hover:bg-[var(--panel-bg-subtle)] hover:text-text-primary hover:border-[var(--panel-bg-subtle)]`
  }
  if (key === 'casdoor') {
    return `${baseClass} hover:border-[var(--oauth-casdoor-green)]`
  }
  if (key === 'google') {
    return `${baseClass} hover:bg-bg-secondary hover:text-black hover:border-[var(--panel-border)]`
  }
  if (key === 'aggregate') {
    const aggregateClasses = {
      qq: 'hover:bg-[var(--oauth-qq)] hover:text-text-primary hover:border-[var(--oauth-qq)]',
      wx: 'hover:bg-[var(--oauth-wx)] hover:text-text-primary hover:border-[var(--oauth-wx)]',
      alipay: 'hover:bg-[var(--oauth-alipay)] hover:text-text-primary hover:border-[var(--oauth-alipay)]',
      sina: 'hover:bg-[var(--oauth-sina)] hover:text-text-primary hover:border-[var(--oauth-sina)]',
      baidu: 'hover:bg-[var(--oauth-baidu)] hover:text-text-primary hover:border-[var(--oauth-baidu)]',
      douyin: 'hover:bg-[var(--panel-bg-darkest)] hover:text-text-primary hover:border-[var(--oauth-douyin)]',
      huawei: 'hover:bg-[var(--oauth-huawei)] hover:text-text-primary hover:border-[var(--oauth-huawei)]',
      xiaomi: 'hover:bg-[var(--oauth-xiaomi)] hover:text-text-primary hover:border-[var(--oauth-xiaomi)]',
      gitee: 'hover:bg-[var(--oauth-gitee)] hover:text-text-primary hover:border-[var(--oauth-gitee)]',
      gitea:
        '[--gitea-cutout:var(--bg-secondary)] hover:[--gitea-cutout:var(--text-primary)] hover:bg-bg-secondary hover:text-black hover:border-primary',
      bilibili: 'hover:bg-[var(--oauth-bilibili)] hover:text-text-primary hover:border-[var(--oauth-bilibili)]',
      kuaishou: 'hover:bg-[var(--oauth-kuaishou)] hover:text-text-primary hover:border-[var(--oauth-kuaishou)]'
    }
    return `${baseClass} ${aggregateClasses[provider.loginType] || ''}`
  }
  if (key === 'oauth2') {
    return `${baseClass} hover:bg-[var(--status-success-icon)] hover:text-text-primary hover:border-[var(--status-success-icon)]`
  }

  return `${baseClass} hover:border-primary-40 hover:text-primary`
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
