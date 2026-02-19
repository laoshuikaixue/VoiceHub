<template>
  <div class="auth-layout">
    <div class="auth-container">
      <!-- 左侧信息区域 -->
      <div class="info-section">
        <div class="info-content">
          <div class="logo-section">
            <img alt="VoiceHub Logo" class="brand-logo" :src="logo" >
            <h1 v-if="siteTitle" class="brand-title">{{ siteTitle || 'VoiceHub' }}</h1>
          </div>

          <div v-if="isFirstLogin" class="welcome-message">
            <h2>欢迎使用VoiceHub</h2>
            <p>为了保障您的账号安全，请设置一个新的密码</p>
          </div>
          <div v-else class="security-message">
            <h2>账号安全</h2>
            <p>定期更新密码有助于保护您的账号安全</p>
          </div>

          <div class="security-tips">
            <h3>密码安全建议</h3>
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
                <span>至少8个字符</span>
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
                <span>包含大小写字母</span>
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
                <span>包含数字和特殊字符</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧表单区域 -->
      <div class="form-section">
        <div class="form-container">
          <div class="form-header">
            <h2>{{ isFirstLogin ? '设置新密码' : '修改密码' }}</h2>
            <p>{{ isFirstLogin ? '请设置一个安全的密码' : '更新您的登录密码' }}</p>
          </div>

          <ClientOnly>
            <ChangePasswordForm :is-first-login="isFirstLogin" />
          </ClientOnly>

          <div class="form-footer">
            <NuxtLink class="back-link" to="/">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="15,18 9,12 15,6" />
              </svg>
              返回主页
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ChangePasswordForm from '~/components/Auth/ChangePasswordForm.vue'
import { ref } from 'vue'
import logo from '~/public/images/logo.svg'

// 使用站点配置
const { siteTitle, initSiteConfig } = useSiteConfig()

const auth = useAuth()
const router = useRouter()
const isFirstLogin = ref(false)

// 未登录用户重定向到登录页
onMounted(async () => {
  // 初始化站点配置
  await initSiteConfig()

  if (!auth.isAuthenticated.value && import.meta.client) {
    router.push('/login')
    return
  }

  // 检查是否需要修改密码（用于显示不同的UI提示）
  if (import.meta.client) {
    const userJson = localStorage.getItem('user')
    if (userJson) {
      const user = JSON.parse(userJson)
      isFirstLogin.value = user.forcePasswordChange === true || !user.passwordChangedAt
    }
  }
})
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-container {
  width: 100%;
  max-width: 1200px;
  background: #111111;
  border-radius: 24px;
  border: 1px solid #1f1f1f;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 600px;
}

.info-section {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
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
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
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
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  color: rgba(255, 255, 255, 0.9);
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
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tip-icon {
  width: 16px;
  height: 16px;
  color: #10b981;
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
  background: #111111;
}

.form-container {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px 0;
}

.form-header p {
  font-size: 16px;
  color: #888888;
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
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  color: #cccccc;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.back-link:hover {
  background: #2a2a2a;
  color: #ffffff;
  border-color: #3a3a3a;
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
