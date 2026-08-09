<template>
  <div class="auth-layout">
    <div class="auth-main">
      <div class="auth-container">
      <div class="form-section">
        <div class="form-header">
          <h1 class="form-title">{{ locale.title }}</h1>
          <p class="form-subtitle">{{ locale.subtitle }}</p>
          <div class="header-divider" />
        </div>
        
        <div v-if="success" class="success-container">
          <CircleCheck class="success-icon" />
          <p class="success-message">{{ successMessage }}</p>
          <NuxtLink to="/login" class="back-link-btn">{{ locale.goLogin }}</NuxtLink>
        </div>

        <form v-else :class="['auth-form', { 'has-error': !!error }]" @submit.prevent="handleSubmit">
          <div v-if="!token" class="error-container" style="margin-bottom: 20px;">
            <CircleAlert class="error-icon" />
            <span class="error-message">{{ locale.invalidTokenFull }}</span>
          </div>

          <!-- 密码字段 -->
          <div class="form-group">
            <label for="password">{{ locale.newPassword }}</label>
            <div class="input-wrapper">
              <LockKeyhole class="input-icon" />
              <input
                id="password"
                v-model="password"
                :class="{ 'input-error': error }"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="locale.passwordPlaceholder"
                required
                @input="error = ''"
              >
              <button
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                class="password-toggle"
                type="button"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" />
                <Eye v-else />
              </button>
            </div>
            
            <!-- 密码强度指示器 -->
            <div v-if="password" class="px-1 pt-1 space-y-2 mt-1">
              <div class="h-1 w-full bg-[var(--input-border)] rounded-full overflow-hidden">
                <div
                  class="h-full transition-all duration-500"
                  :class="passwordStrength.colorClass"
                  :style="{ width: passwordStrength.width }"
                />
              </div>
              <div class="flex justify-between items-center">
                <span class="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{{ locale.passwordStrength }}</span>
                <span class="text-[10px] font-black uppercase tracking-widest" :class="passwordStrength.textColorClass">
                  {{ passwordStrength.text }}
                </span>
              </div>
            </div>
          </div>

          <!-- 确认密码字段 -->
          <div class="form-group">
            <label for="confirmPassword">{{ locale.confirmPassword }}</label>
            <div class="input-wrapper">
              <LockKeyhole class="input-icon" />
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :class="{ 'input-error': error }"
                :type="showConfirmPassword ? 'text' : 'password'"
                :placeholder="locale.confirmPasswordPlaceholder"
                required
                @input="error = ''"
              >
              <button
                :aria-label="showConfirmPassword ? '隐藏确认密码' : '显示确认密码'"
                class="password-toggle"
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <EyeOff v-if="showConfirmPassword" />
                <Eye v-else />
              </button>
            </div>
          </div>

          <div v-if="error" class="error-container">
            <CircleAlert class="error-icon" />
            <span class="error-message">{{ error }}</span>
          </div>

          <button :disabled="loading || !token" class="submit-btn" type="submit">
            <Loader2 v-if="loading" class="loading-spinner animate-spin" />
            <span v-if="loading">{{ locale.resetting }}</span>
            <span v-else>{{ locale.submit }}</span>
          </button>
          
          <div class="form-footer">
            <NuxtLink to="/login" class="back-link">{{ locale.backLogin }}</NuxtLink>
          </div>
        </form>
      </div>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup>
import { CircleAlert, CircleCheck, Eye, EyeOff, Loader2, LockKeyhole } from '@lucide/vue'
import { ref, computed, onMounted } from 'vue'

import { usePasswordStrength } from '~/composables/usePasswordStrength'
import { useLocale } from '~/utils/locale'

const { siteTitle, initSiteConfig } = useSiteConfig()
const route = useRoute()
const { pages } = useLocale()
const locale = computed(() => pages.value?.resetPassword || {})

const token = computed(() => route.query.token || '')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref(false)
const successMessage = ref('')

const passwordStrength = usePasswordStrength(password)

useHead({
  title: () => siteTitle.value ? `${locale.value.title} | ${siteTitle.value}` : locale.value.title
})

onMounted(async () => {
  await initSiteConfig()
})

const handleSubmit = async () => {
  if (!token.value) {
    error.value = locale.value.invalidToken
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = locale.value.passwordMismatch
    return
  }

  if (password.value.length < 8) {
    error.value = locale.value.passwordTooShort
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        newPassword: password.value
      }
    })

    if (response.success) {
      success.value = true
      successMessage.value = response.message || locale.value.success
    }
  } catch (err) {
    error.value = err.data?.message || err.message || locale.value.failed
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
}

.auth-main {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding-bottom: clamp(16px, 4vh, 40px);
}

.auth-container {
  width: 100%;
  max-width: 480px;
  background: var(--bg-secondary);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
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

.password-toggle {
  position: absolute;
  right: 16px;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  color: var(--text-quaternary);
  cursor: pointer;
  transition: color 0.2s ease, transform var(--transition-fast);
  z-index: 1;
}

.password-toggle:hover {
  color: var(--text-primary);
}

.password-toggle:active {
  transform: scale(0.95);
}

.password-toggle svg {
  width: 100%;
  height: 100%;
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
  color: var(--success);
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
