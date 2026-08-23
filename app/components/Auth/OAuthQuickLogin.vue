<template>
  <div v-if="hasQuickLogin" class="quick-login-section">
    <div class="divider">
      <span>{{ orText }}</span>
    </div>
    <div class="quick-login-buttons">
      <button
        v-if="showWeChat"
        type="button"
        class="quick-login-btn wechat"
        @click="loginWith('wx')"
      >
        <Icon name="oauth-wechat" :size="20" />
        <span>{{ locale.quickLoginWx }}</span>
      </button>
      <button
        v-if="showQQ"
        type="button"
        class="quick-login-btn qq"
        @click="loginWith('qq')"
      >
        <Icon name="oauth-qq" :size="20" />
        <span>{{ locale.quickLoginQq }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'
import { detectEmbeddedBrowser } from '~/utils/embedded-browser'
import { useSiteConfig } from '~/composables/useSiteConfig'

const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const route = useRoute()
const { auth } = useLocale()
const locale = computed(() => auth.value?.oauthButtons || {})
// "或" 分隔文案取自 loginForm 分区
const orText = computed(() => auth.value?.loginForm?.or || '或')

// 初始为 false，SSR/首屏不渲染，onMounted 检测到微信/QQ 内置浏览器后才显示
const env = ref({ isWeChat: false, isQQApp: false })

onMounted(async () => {
  env.value = detectEmbeddedBrowser()
  await refreshSiteConfig()
})

const aggregateLoginTypes = computed(() => {
  const types = new Set()
  for (const provider of oauthProviders.value || []) {
    if (provider.routeProvider === 'aggregate' && provider.loginType) {
      types.add(provider.loginType)
    }
  }
  return types
})

const showWeChat = computed(() => env.value.isWeChat && aggregateLoginTypes.value.has('wx'))
const showQQ = computed(() => env.value.isQQApp && aggregateLoginTypes.value.has('qq'))
const hasQuickLogin = computed(() => showWeChat.value || showQQ.value)

const loginWith = (loginType) => {
  const queryRedirect = route.query.redirect
  const redirect = Array.isArray(queryRedirect) ? queryRedirect[0] : queryRedirect
  const safeRedirect =
    redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')
      ? redirect
      : null
  const query = new URLSearchParams()
  query.set('type', loginType)
  if (safeRedirect) query.set('redirect', safeRedirect)
  navigateTo(`/api/auth/aggregate?${query.toString()}`, { external: true })
}
</script>

<style scoped>
.quick-login-section {
  width: 100%;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 20px 0;
  color: var(--text-quaternary);
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--input-border);
}

.divider span {
  padding: 0 10px;
}

.quick-login-buttons {
  display: flex;
  gap: 12px;
}

.quick-login-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  background: var(--panel-bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-login-btn .icon {
  color: var(--text-primary);
  transition: color 0.2s ease;
}

.quick-login-btn.wechat:hover {
  background: var(--oauth-wx);
  border-color: var(--oauth-wx);
  color: white;
}

.quick-login-btn.qq:hover {
  background: var(--oauth-qq);
  border-color: var(--oauth-qq);
  color: white;
}

.quick-login-btn.wechat:hover .icon,
.quick-login-btn.qq:hover .icon {
  color: white;
}

.quick-login-btn:active {
  transform: scale(0.98);
}

@media (max-width: 480px) {
  .quick-login-btn {
    padding: 12px;
    font-size: 13px;
  }
}
</style>