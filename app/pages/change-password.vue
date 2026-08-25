<template>
  <div class="auth-layout">
    <div class="auth-container">
      <!-- 左侧信息区域 -->
      <div class="info-section">
        <div class="info-content">
          <div class="logo-section">
            <img alt="VoiceHub Logo" class="brand-logo" :src="getLogo()" />
            <h1 v-if="siteTitle" class="brand-title">{{ siteTitle }}</h1>
          </div>

          <div v-if="isFirstLogin" class="welcome-message">
            <h2>{{ locale.welcomeTitle }}</h2>
            <p>{{ locale.welcomeDesc }}</p>
          </div>
          <div v-else class="security-message">
            <h2>{{ locale.securityTitle }}</h2>
            <p>{{ locale.securityDesc }}</p>
          </div>

          <div class="security-tips">
            <h3>{{ locale.tipsTitle }}</h3>
            <div class="tip-list">
              <div class="tip-item">
                <svg
                  class="tip-icon"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                <span>{{ locale.tipMinLength }}</span>
              </div>
              <div class="tip-item">
                <svg
                  class="tip-icon"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                <span>{{ locale.tipCase }}</span>
              </div>
              <div class="tip-item">
                <svg
                  class="tip-icon"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                <span>{{ locale.tipSpecial }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧表单区域 -->
      <div class="form-section">
        <div class="form-container">
          <div class="form-header">
            <h2>{{ isFirstLogin ? locale.setNewPassword : locale.changePasswordTitle }}</h2>
            <p>{{ isFirstLogin ? locale.setNewPasswordDesc : locale.updatePasswordDesc }}</p>
          </div>

          <div class="password-form-shell">
            <ClientOnly>
              <ChangePasswordForm :is-first-login="isFirstLogin" />
            </ClientOnly>
          </div>

          <div class="form-footer">
            <NuxtLink v-if="!requirePasswordChange" class="back-link" to="/">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="15,18 9,12 15,6" />
              </svg>
              {{ locale.backToHome }}
            </NuxtLink>
            <button v-else class="back-link logout-link" type="button" @click="auth.logout()">
              <Icon class="shrink-0" name="logout" :size="16" aria-hidden="true" />
              {{ locale.logout }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ChangePasswordForm from '~/components/Auth/ChangePasswordForm.vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'
import { useThemeImage } from '~/composables/useThemeImage'

// 使用站点配置
const { siteTitle, initSiteConfig } = useSiteConfig()
const { changePassword: locale } = useLocale()
const { getLogo } = useThemeImage()

const auth = useAuth()
const router = useRouter()
const isFirstLogin = computed(() => {
  const currentUser = auth.user.value
  return currentUser?.needsInitialPasswordSetup === true
})
const requirePasswordChange = computed(() => !!auth.user.value?.requirePasswordChange)

// 未登录用户重定向到登录页
onMounted(async () => {
  // 初始化站点配置
  await initSiteConfig()

  if (!auth.isAuthenticated.value && import.meta.client) {
    router.push('/login')
    return
  }
})
</script>

<style scoped>
.auth-layout {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--panel-bg-deepest);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.auth-container {
  width: 100%;
  max-width: 1200px;
  background: var(--bg-primary);
  border-radius: 24px;
  border: 1px solid var(--panel-border-subtle);
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 600px;
  margin: auto;
}

.info-section {
  background: linear-gradient(135deg, var(--color-indigo-hover) 0%, var(--color-collab-hover) 100%);
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.info-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="%23666" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
  opacity: 0.3;
}

.info-content {
  position: relative;
  z-index: 1;
  color: white;
  text-align: center;
}

.logo-section {
  margin-bottom: 40px;
}

.brand-logo {
  width: 160px;
  height: auto;
  margin-bottom: 24px;
  object-fit: contain;
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0;
  color: white;
}

.welcome-message,
.security-message {
  margin-bottom: 40px;
}

.welcome-message h2,
.security-message h2 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: white;
}

.welcome-message p,
.security-message p {
  font-size: 16px;
  color: var(--overlay-90);
  margin: 0;
  line-height: 1.6;
}

.security-tips {
  text-align: left;
}

.security-tips h3 {
  font-size: 18px;
  font-weight: 600;
  color: white;
  margin: 0 0 20px 0;
}

.tip-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--overlay-10);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid var(--overlay-20);
}

.tip-icon {
  width: 16px;
  height: 16px;
  color: var(--color-success);
  flex-shrink: 0;
}

.tip-item span {
  font-size: 14px;
  color: white;
}

.form-section {
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.form-container {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.password-form-shell {
  width: 100%;
  min-width: 0;
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.form-header p {
  font-size: 16px;
  color: var(--text-tertiary-hover);
  margin: 0;
}

.form-footer {
  margin-top: 32px;
  text-align: center;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--panel-bg-deep);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.back-link:hover {
  background: var(--panel-border);
  color: var(--text-primary);
  border-color: var(--panel-border-light);
}

.back-link svg {
  width: 16px;
  height: 16px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .auth-container {
    grid-template-columns: 1fr;
    max-width: 500px;
  }

  .info-section {
    padding: 40px 30px;
  }

  .form-section {
    padding: 40px 30px;
  }

  .brand-title {
    font-size: 28px;
  }
}

@media (max-width: 768px) {
  .auth-layout {
    padding: 10px;
  }

  .auth-container {
    border-radius: 16px;
    min-height: auto;
  }

  .info-section,
  .form-section {
    padding: 30px 20px;
  }

  .tip-list {
    gap: 8px;
  }

  .tip-item {
    padding: 8px 12px;
  }
}
</style>
