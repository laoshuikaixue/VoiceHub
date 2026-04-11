<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="form-section">
        <div class="form-header">
          <h1 class="form-title">找回密码</h1>
          <p class="form-subtitle">请输入您的账号名和绑定的邮箱地址</p>
          <div class="header-divider" />
        </div>
        
        <div v-if="success" class="success-container">
          <svg class="success-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="success-message">{{ successMessage }}</p>
          <NuxtLink to="/login" class="back-link-btn">返回登录</NuxtLink>
        </div>

        <form v-else :class="['auth-form', { 'has-error': !!error }]" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="username">账号名</label>
            <div class="input-wrapper">
              <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="username"
                v-model="username"
                :class="{ 'input-error': error }"
                placeholder="请输入您的账号名"
                required
                type="text"
                @input="error = ''"
              >
            </div>
          </div>

          <div class="form-group">
            <label for="email">绑定的邮箱</label>
            <div class="input-wrapper">
              <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              <input
                id="email"
                v-model="email"
                :class="{ 'input-error': error }"
                placeholder="请输入预留的邮箱地址"
                required
                type="email"
                @input="error = ''"
              >
            </div>
          </div>

          <div v-if="error" class="error-container">
            <svg class="error-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <span class="error-message">{{ error }}</span>
          </div>

          <button :disabled="loading" class="submit-btn" type="submit">
            <svg v-if="loading" class="loading-spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" stroke-dasharray="31.416" stroke-dashoffset="31.416" stroke-linecap="round" stroke-width="2">
                <animate attributeName="stroke-dasharray" dur="2s" repeatCount="indefinite" values="0 31.416;15.708 15.708;0 31.416"/>
                <animate attributeName="stroke-dashoffset" dur="2s" repeatCount="indefinite" values="0;-15.708;-31.416"/>
              </circle>
            </svg>
            <span v-if="loading">发送中...</span>
            <span v-else>发送重置邮件</span>
          </button>
          
          <div class="form-footer">
            <NuxtLink to="/login" class="back-link">返回登录</NuxtLink>
          </div>
        </form>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const { siteTitle, initSiteConfig } = useSiteConfig()

const username = ref('')
const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)
const successMessage = ref('')

onMounted(async () => {
  await initSiteConfig()
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `找回密码 | ${siteTitle.value}`
  }
})

const handleSubmit = async () => {
  if (!username.value || !email.value) {
    error.value = '请填写完整的账号名和邮箱'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        username: username.value,
        email: email.value
      }
    })

    if (response.success) {
      success.value = true
      successMessage.value = response.message || '重置邮件已发送'
    }
  } catch (err) {
    error.value = err.data?.message || err.message || '请求失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 20px;
  --content-footer-gap: clamp(16px, 4vh, 40px);
}

.auth-container {
  width: 100%;
  max-width: 480px;
  background: var(--bg-secondary);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  margin: auto 0;
  margin-bottom: var(--content-footer-gap);
}

.form-section {
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-title {
  font-size: 24px;
  font-weight: var(--font-bold);
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.form-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.header-divider {
  height: 1px;
  background: var(--border-secondary);
  margin: 20px auto 0;
  width: 100%;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 8px;
  height: 2px;
  background: var(--primary);
  border-radius: 2px;
  opacity: 0;
  transform: scaleX(0.2);
  transition: transform var(--transition-normal), opacity var(--transition-normal);
}

.input-wrapper:focus-within::after {
  opacity: 0.35;
  transform: scaleX(1);
}

.input-icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: var(--text-quaternary);
  z-index: 1;
}

.input-wrapper input {
  width: 100%;
  padding: 16px 16px 16px 48px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  color: var(--input-text);
  font-size: 16px;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}

.input-wrapper input::placeholder {
  color: var(--input-placeholder);
}

.input-wrapper input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-shadow-focus);
}

.input-wrapper input:focus + .input-icon,
.input-wrapper input:not(:placeholder-shown) + .input-icon {
  color: var(--primary);
}

.input-wrapper input.input-error {
  border-color: var(--error);
  box-shadow: 0 0 0 3px var(--error-light);
}

.error-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--error-light);
  border: 1px solid var(--error-border);
  border-radius: var(--radius-lg);
  color: var(--error);
}

.auth-form.has-error {
  animation: shake 0.4s ease;
}

@keyframes shake {
  0% { transform: translateX(0); }
  15% { transform: translateX(-6px); }
  30% { transform: translateX(6px); }
  45% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
  90% { transform: translateX(2px); }
  100% { transform: translateX(0); }
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-message {
  font-size: 14px;
  font-weight: var(--font-medium);
}

.submit-btn {
  width: 100%;
  padding: 16px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: 1px solid var(--btn-primary-border);
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal), transform var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-btn:hover:not(:disabled) {
  background: var(--btn-primary-hover);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  width: 20px;
  height: 20px;
}

.form-footer {
  margin-top: 16px;
  text-align: center;
}

.back-link {
  font-size: 14px;
  color: var(--primary);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.back-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 0;
  width: 100%;
}

.success-icon {
  width: 64px;
  height: 64px;
  color: var(--success, #10b981);
  margin-bottom: 20px;
}

.success-message {
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 32px;
  line-height: 1.5;
}

.back-link-btn {
  padding: 12px 32px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border-radius: var(--radius-lg);
  text-decoration: none;
  font-weight: var(--font-medium);
  transition: opacity 0.2s ease;
}

.back-link-btn:hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .auth-layout {
    padding: 10px;
  }
  .auth-container {
    border-radius: 16px;
  }
  .form-section {
    padding: 30px 20px;
  }
}
</style>
