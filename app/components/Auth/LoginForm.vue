<template>
  <div class="login-form">
    <div class="form-header">
      <h2>{{ isBindMode ? '绑定账号' : '欢迎回来' }}</h2>
      <p v-if="isBindMode">即将绑定 {{ providerName }} 账号: {{ providerUsername }}</p>
      <p v-else>登录您的VoiceHub账户</p>
    </div>

    <form :class="['auth-form', { 'has-error': !!error }]" @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="username">账号名</label>
        <div class="input-wrapper">
          <svg
            class="input-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input
            id="username"
            v-model="username"
            :class="{ 'input-error': error }"
            placeholder="请输入账号名"
            required
            type="text"
            @input="error = ''"
          >
        </div>
      </div>

      <div class="form-group">
        <label for="password">密码</label>
        <div class="input-wrapper">
          <svg
            class="input-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
            <circle cx="12" cy="16" r="1" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            id="password"
            v-model="password"
            :class="{ 'input-error': error }"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            required
            @input="error = ''"
          >
          <button class="password-toggle" type="button" @click="showPassword = !showPassword">
            <svg
              v-if="showPassword"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              />
              <line x1="1" x2="23" y1="1" y2="23" />
            </svg>
            <svg v-else fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="error" class="error-container">
        <svg
          class="error-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
        <span class="error-message">{{ error }}</span>
      </div>

      <button :disabled="loading" class="submit-btn" type="submit">
        <svg v-if="loading" class="loading-spinner" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            fill="none"
            r="10"
            stroke="currentColor"
            stroke-dasharray="31.416"
            stroke-dashoffset="31.416"
            stroke-linecap="round"
            stroke-width="2"
          >
            <animate
              attributeName="stroke-dasharray"
              dur="2s"
              repeatCount="indefinite"
              values="0 31.416;15.708 15.708;0 31.416"
            />
            <animate
              attributeName="stroke-dashoffset"
              dur="2s"
              repeatCount="indefinite"
              values="0;-15.708;-31.416"
            />
          </circle>
        </svg>
        <span v-if="loading">{{ isBindMode ? '绑定中...' : '登录中...' }}</span>
        <span v-else>{{ isBindMode ? '绑定并登录' : '登录' }}</span>
      </button>
    </form>

    <div v-if="!isBindMode && isWebAuthnSupported" class="webauthn-section">
      <div class="divider">
        <span>或</span>
      </div>
      <button 
        type="button" 
        class="webauthn-btn" 
        :disabled="loading" 
        @click="handleWebAuthnLogin"
      >
        <Fingerprint :size="20" class="webauthn-icon" />
        <span>使用 Windows Hello / Passkey 登录</span>
      </button>
    </div>

    <AuthOAuthButtons v-if="!isBindMode" />

    <div class="form-footer">
      <p class="help-text">不同VoiceHub平台的账号不互通</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { getProviderDisplayName } from '~/utils/oauth'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { Fingerprint } from 'lucide-vue-next'

const route = useRoute()
const isBindMode = computed(() => route.query.action === 'bind')
const providerUsername = computed(() => route.query.username || '')
const providerName = computed(() => {
  const provider = (route.query.provider as string) || '第三方'
  return getProviderDisplayName(provider)
})

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)
const isWebAuthnSupported = ref(false)

const auth = useAuth()

onMounted(async () => {
  const isApiSupported = browserSupportsWebAuthn()
  let isPlatformAuthenticatorAvailable = false

  if (isApiSupported && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
    try {
      isPlatformAuthenticatorAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch (e) {
      console.warn('WebAuthn 平台认证器检查失败:', e)
    }
  }

  // 兼容外部安全密钥（如 YubiKey），即使没有内置平台认证器也允许尝试
  isWebAuthnSupported.value = isApiSupported
})

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = '请填写完整的登录信息'
    return
  }

  error.value = ''
  loading.value = true

  try {
    if (isBindMode.value) {
      await $fetch('/api/auth/bind', {
        method: 'POST',
        body: {
          username: username.value,
          password: password.value
        }
      })

      // 绑定成功后刷新认证状态
      await auth.initAuth()
      await navigateTo('/')
    } else {
      await auth.login(username.value, password.value)

      // 登录成功后跳转
      if (auth.isAdmin.value) {
        await navigateTo('/dashboard')
      } else {
        await navigateTo('/')
      }
    }
  } catch (err) {
    error.value =
      err.message || (isBindMode.value ? '绑定失败，请检查账号密码' : '登录失败，请检查账号密码')
    // 密码错误时清空密码字段
    if (error.value.includes('密码') || error.value.includes('错误')) {
      password.value = ''
    }
  } finally {
    loading.value = false
  }
}

const handleWebAuthnLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 1. 获取登录选项
    const options = await $fetch('/api/auth/webauthn/login/options', {
      method: 'POST'
    })

    // 2. 调用浏览器 WebAuthn API
    const credential = await startAuthentication(options)

    // 3. 验证登录
    const verification = await $fetch('/api/auth/webauthn/login/verify', {
      method: 'POST',
      body: credential
    })

    if (verification.success) {
      // 登录成功
      await auth.initAuth()
      await navigateTo(verification.redirect || '/')
    }
  } catch (e) {
    console.error('WebAuthn 登录错误:', e)
    const apiError = e as { data?: { message?: string }, message?: string }
    error.value = apiError.data?.message || apiError.message || 'Passkey 登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-form {
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.4s ease both;
}

@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 28px;
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.form-header p {
  font-size: 16px;
  color: var(--text-tertiary);
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal);
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
  transition:
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);
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

.input-wrapper input:hover {
  filter: brightness(1.03);
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
  transition:
    color 0.2s ease,
    transform var(--transition-fast);
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
  0% {
    transform: translateX(0);
  }
  15% {
    transform: translateX(-6px);
  }
  30% {
    transform: translateX(6px);
  }
  45% {
    transform: translateX(-4px);
  }
  60% {
    transform: translateX(4px);
  }
  75% {
    transform: translateX(-2px);
  }
  90% {
    transform: translateX(2px);
  }
  100% {
    transform: translateX(0);
  }
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
  transition:
    background var(--transition-normal),
    box-shadow var(--transition-normal),
    transform var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.submit-btn::before {
  content: none;
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

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.loading-spinner {
  width: 20px;
  height: 20px;
}

.form-footer {
  margin-top: 24px;
  text-align: center;
}

.help-text {
  font-size: 12px;
  color: var(--text-quaternary);
  margin: 0;
  line-height: 1.5;
}

.help-text code {
  background: var(--input-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: var(--primary);
  font-size: 11px;
}

.webauthn-section {
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

.webauthn-btn {
  width: 100%;
  padding: 14px;
  background: var(--surface-secondary);
  color: var(--text-primary);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.webauthn-btn:hover:not(:disabled) {
  background: var(--surface-tertiary);
  border-color: var(--input-border-focus);
}

.webauthn-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.webauthn-icon {
  width: 20px;
  height: 20px;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .form-header h2 {
    font-size: 24px;
  }

  .form-header p {
    font-size: 14px;
  }

  .input-wrapper input {
    padding: 14px 14px 14px 44px;
    font-size: 16px; /* 防止iOS缩放 */
  }

  .submit-btn {
    padding: 14px;
    font-size: 16px;
  }
}
</style>
