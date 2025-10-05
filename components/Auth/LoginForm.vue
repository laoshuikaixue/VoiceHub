<template>
  <div class="login-form">
    <div class="form-header">
      <h2>欢迎回来</h2>
      <p>登录您的VoiceHub账户</p>
    </div>

    <form class="auth-form" @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="username">账号名</label>
        <div class="input-wrapper">
          <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <input
              id="username"
              v-model="username"
              :class="{ 'input-error': error }"
              placeholder="请输入账号名"
              required
              type="text"
              @input="error = ''"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="password">密码</label>
        <div class="input-wrapper">
          <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect height="11" rx="2" ry="2" width="18" x="3" y="11"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input
              id="password"
              v-model="password"
              :class="{ 'input-error': error }"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              required
              @input="error = ''"
          />
          <button
              class="password-toggle"
              type="button"
              @click="showPassword = !showPassword"
          >
            <svg v-if="showPassword" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" x2="23" y1="1" y2="23"/>
            </svg>
            <svg v-else fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="error" class="error-container">
        <svg class="error-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" x2="12" y1="8" y2="12"/>
          <line x1="12" x2="12.01" y1="16" y2="16"/>
        </svg>
        <span class="error-message">{{ error }}</span>
      </div>

      <button :disabled="loading" class="submit-btn" type="submit">
        <svg v-if="loading" class="loading-spinner" viewBox="0 0 24 24">
          <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" stroke-dasharray="31.416" stroke-dashoffset="31.416"
                  stroke-linecap="round" stroke-width="2">
            <animate attributeName="stroke-dasharray" dur="2s" repeatCount="indefinite"
                     values="0 31.416;15.708 15.708;0 31.416"/>
            <animate attributeName="stroke-dashoffset" dur="2s" repeatCount="indefinite" values="0;-15.708;-31.416"/>
          </circle>
        </svg>
        <span>{{ loading ? '登录中...' : '登录' }}</span>
      </button>
    </form>

    <div class="form-footer">
      <p class="help-text">
        不同VoiceHub平台的账号不互通
      </p>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {useAuth} from '~/composables/useAuth'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

const auth = useAuth()

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = '请填写完整的登录信息'
    return
  }

  error.value = ''
  loading.value = true

  try {
    await auth.login(username.value, password.value)

    // 登录成功后跳转
    if (auth.isAdmin.value) {
      await navigateTo('/dashboard')
    } else {
      await navigateTo('/')
    }
  } catch (err) {
    error.value = err.message || '登录失败，请检查账号密码'
    // 密码错误时清空密码字段
    if (error.value.includes('密码不正确')) {
      password.value = ''
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-form {
  width: 100%;
  max-width: 400px;
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
  font-weight: 500;
  color: #ffffff;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: #666666;
  z-index: 1;
}

.input-wrapper input {
  width: 100%;
  padding: 16px 16px 16px 48px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  color: #ffffff;
  font-size: 16px;
  transition: all 0.2s ease;
}

.input-wrapper input::placeholder {
  color: #666666;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-wrapper input:focus + .input-icon,
.input-wrapper input:not(:placeholder-shown) + .input-icon {
  color: #667eea;
}

.input-wrapper input.input-error {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.password-toggle {
  position: absolute;
  right: 16px;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  color: #666666;
  cursor: pointer;
  transition: color 0.2s ease;
  z-index: 1;
}

.password-toggle:hover {
  color: #ffffff;
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
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  color: #f87171;
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-message {
  font-size: 14px;
  font-weight: 500;
}

.submit-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.submit-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.submit-btn:hover:not(:disabled)::before {
  left: 100%;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
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
  margin-top: 24px;
  text-align: center;
}

.help-text {
  font-size: 12px;
  color: #666666;
  margin: 0;
  line-height: 1.5;
}

.help-text code {
  background: #1a1a1a;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #667eea;
  font-size: 11px;
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