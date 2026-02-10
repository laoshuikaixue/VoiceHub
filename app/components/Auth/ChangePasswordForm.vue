<template>
  <div class="change-password-form">
    <form class="password-form" @submit.prevent="handleChangePassword">
      <div v-if="!isFirstLogin" class="form-group">
        <label for="current-password">当前密码</label>
        <div class="input-wrapper">
          <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect height="11" rx="2" ry="2" width="18" x="3" y="11"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input
              id="current-password"
              v-model="currentPassword"
              :class="{ 'input-error': error }"
              :type="showCurrentPassword ? 'text' : 'password'"
              placeholder="请输入当前密码"
              required
              @input="error = ''"
          />
          <button
              class="password-toggle"
              type="button"
              @click="showCurrentPassword = !showCurrentPassword"
          >
            <svg v-if="showCurrentPassword" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
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

      <div class="form-group">
        <label for="new-password">新密码</label>
        <div class="input-wrapper">
          <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect height="11" rx="2" ry="2" width="18" x="3" y="11"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input
              id="new-password"
              v-model="newPassword"
              :class="{ 'input-error': error }"
              :type="showNewPassword ? 'text' : 'password'"
              placeholder="请输入新密码"
              required
              @input="error = ''; validatePassword()"
          />
          <button
              class="password-toggle"
              type="button"
              @click="showNewPassword = !showNewPassword"
          >
            <svg v-if="showNewPassword" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
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

        <!-- 密码强度指示器 -->
        <div v-if="newPassword" class="password-strength">
          <div class="strength-bar">
            <div :class="passwordStrength.class" :style="{ width: passwordStrength.width }" class="strength-fill"></div>
          </div>
          <div :class="passwordStrength.class" class="strength-text">
            {{ passwordStrength.text }}
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="confirm-password">确认新密码</label>
        <div class="input-wrapper">
          <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect height="11" rx="2" ry="2" width="18" x="3" y="11"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input
              id="confirm-password"
              v-model="confirmPassword"
              :class="{ 'input-error': error || (confirmPassword && newPassword !== confirmPassword) }"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="请再次输入新密码"
              required
              @input="error = ''"
          />
          <button
              class="password-toggle"
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
          >
            <svg v-if="showConfirmPassword" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
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

        <!-- 密码匹配提示 -->
        <div v-if="confirmPassword && newPassword !== confirmPassword" class="password-mismatch">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" x2="9" y1="9" y2="15"/>
            <line x1="9" x2="15" y1="9" y2="15"/>
          </svg>
          <span>密码不匹配</span>
        </div>
        <div v-else-if="confirmPassword && newPassword === confirmPassword" class="password-match">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          <span>密码匹配</span>
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

      <div v-if="success" class="success-container">
        <svg class="success-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        <span class="success-message">{{ success }}</span>
      </div>

      <button :disabled="loading || !isFormValid" class="submit-btn" type="submit">
        <svg v-if="loading" class="loading-spinner" viewBox="0 0 24 24">
          <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" stroke-dasharray="31.416"
                  stroke-dashoffset="31.416"
                  stroke-linecap="round" stroke-width="2">
            <animate attributeName="stroke-dasharray" dur="2s" repeatCount="indefinite"
                     values="0 31.416;15.708 15.708;0 31.416"/>
            <animate attributeName="stroke-dashoffset" dur="2s" repeatCount="indefinite" values="0;-15.708;-31.416"/>
          </circle>
        </svg>
        <span>{{ loading ? '处理中...' : (isFirstLogin ? '设置密码' : '修改密码') }}</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import {computed, ref} from 'vue'

// 组件属性
const props = defineProps({
  isFirstLogin: {
    type: Boolean,
    default: false
  }
})

const auth = useAuth()
const router = useRouter()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

// 密码显示状态
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// 密码强度计算
const passwordStrength = computed(() => {
  const password = newPassword.value
  if (!password) return {width: '0%', class: '', text: ''}

  let score = 0
  let feedback = []

  // 长度检查
  if (password.length >= 8) {
    score += 25
  } else {
    feedback.push('至少8个字符')
  }

  // 大写字母
  if (/[A-Z]/.test(password)) {
    score += 25
  } else {
    feedback.push('包含大写字母')
  }

  // 小写字母
  if (/[a-z]/.test(password)) {
    score += 25
  } else {
    feedback.push('包含小写字母')
  }

  // 数字和特殊字符
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    score += 25
  } else {
    feedback.push('包含数字和特殊字符')
  }

  if (score < 50) {
    return {width: `${score}%`, class: 'weak', text: '弱'}
  } else if (score < 75) {
    return {width: `${score}%`, class: 'medium', text: '中等'}
  } else if (score < 100) {
    return {width: `${score}%`, class: 'strong', text: '强'}
  } else {
    return {width: '100%', class: 'very-strong', text: '很强'}
  }
})

// 表单验证
const isFormValid = computed(() => {
  if (props.isFirstLogin) {
    return newPassword.value &&
        confirmPassword.value &&
        newPassword.value === confirmPassword.value &&
        newPassword.value.length >= 8
  } else {
    return currentPassword.value &&
        newPassword.value &&
        confirmPassword.value &&
        newPassword.value === confirmPassword.value &&
        newPassword.value.length >= 8
  }
})

const validatePassword = () => {
  if (newPassword.value && newPassword.value.length < 8) {
    error.value = '密码长度至少为8位'
  } else {
    error.value = ''
  }
}

const handleChangePassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    error.value = '新密码和确认密码不匹配'
    return
  }

  if (newPassword.value.length < 8) {
    error.value = '新密码长度至少为8位'
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    if (props.isFirstLogin) {
      await auth.setInitialPassword(newPassword.value)
      success.value = '密码设置成功！正在跳转...'

      // 清空表单
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''

      // 密码设置完成后跳转
      setTimeout(async () => {
        // 更新用户状态
        await auth.refreshUser()

        if (auth.isAdmin.value) {
          router.push('/dashboard')
        } else {
          router.push('/')
        }
      }, 2000)
    } else {
      await auth.changePassword(currentPassword.value, newPassword.value)
      success.value = '密码修改成功！正在跳转...'

      // 清空表单
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''

      // 密码修改后登出
      setTimeout(() => {
        auth.logout()
        router.push('/login')
      }, 2000)
    }
  } catch (err) {
    // 提取错误信息，支持多种错误格式
    if (err.data && err.data.statusMessage) {
      error.value = err.data.statusMessage
    } else if (err.data && err.data.message) {
      error.value = err.data.message
    } else if (err.statusMessage) {
      error.value = err.statusMessage
    } else if (err.message) {
      error.value = err.message
    } else {
      error.value = '操作失败，请重试'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.change-password-form {
  width: 100%;
  max-width: 400px;
}

.password-form {
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
  padding: 16px 48px 16px 48px;
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
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.input-wrapper input:focus + .input-icon,
.input-wrapper input:not(:placeholder-shown) + .input-icon {
  color: #4f46e5;
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

/* 密码强度指示器 */
.password-strength {
  margin-top: 8px;
}

.strength-bar {
  width: 100%;
  height: 4px;
  background: #2a2a2a;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 2px;
}

.strength-fill.weak {
  background: #ef4444;
}

.strength-fill.medium {
  background: #f59e0b;
}

.strength-fill.strong {
  background: #10b981;
}

.strength-fill.very-strong {
  background: #059669;
}

.strength-text {
  font-size: 12px;
  font-weight: 500;
}

.strength-text.weak {
  color: #ef4444;
}

.strength-text.medium {
  color: #f59e0b;
}

.strength-text.strong {
  color: #10b981;
}

.strength-text.very-strong {
  color: #059669;
}

/* 密码匹配提示 */
.password-mismatch,
.password-match {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 500;
}

.password-mismatch {
  color: #ef4444;
}

.password-match {
  color: #10b981;
}

.password-mismatch svg,
.password-match svg {
  width: 16px;
  height: 16px;
}

/* 错误和成功容器 */
.error-container,
.success-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
}

.error-container {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.success-container {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.error-icon,
.success-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-message,
.success-message {
  font-size: 14px;
  font-weight: 500;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
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
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
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

/* 响应式设计 */
@media (max-width: 480px) {
  .input-wrapper input {
    padding: 14px 44px 14px 44px;
    font-size: 16px; /* 防止iOS缩放 */
  }

  .submit-btn {
    padding: 14px;
    font-size: 16px;
  }
}
</style>
