<template>
  <div v-if="hasEnabledProviders" class="oauth-buttons">
    <div class="divider">
      <span>或使用第三方账号登录</span>
    </div>
    <div class="buttons-grid">
      <button 
        v-if="config.public.oauth.github"
        type="button" 
        class="oauth-btn github"
        @click="loginWith('github')"
        title="使用 GitHub 登录"
      >
        <AuthProvidersGitHubIcon />
      </button>
      
      <!-- 其他提供商可在此添加 -->
    </div>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()

const hasEnabledProviders = computed(() => {
  return config.public.oauth && Object.values(config.public.oauth).some(enabled => enabled)
})

const loginWith = (provider) => {
  // 外部导航到 API 端点
  navigateTo(`/api/auth/${provider}`, { external: true })
}
</script>

<style scoped>
.oauth-buttons {
  margin-top: 24px;
  width: 100%;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
  margin-bottom: 16px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--border-color);
  opacity: 0.2;
}

.divider span {
  padding: 0 10px;
}

.buttons-grid {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.oauth-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.oauth-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  background: var(--bg-tertiary);
}

.oauth-btn.github:hover {
  background: #24292e;
  color: white;
  border-color: #24292e;
}
</style>
