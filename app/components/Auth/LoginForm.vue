<template>
  <div class="login-form">
    <div class="form-header">
      <h2>{{ getFormTitle }}</h2>
      <p v-if="isBindMode && !showCreateMode">{{ formatLocale(locale.bindProvider, providerName, providerUsername) }}</p>
      <p v-else-if="isBindMode && showCreateMode">{{ formatLocale(locale.createWithProvider, providerName) }}</p>
      <p v-else>{{ locale.loginSubtitle }}</p>
    </div>

    <!-- OAuth 账号创建/绑定模式选择器 -->
    <div v-if="isBindMode && allowOAuthRegistration" class="mode-selector">
      <button
        :class="['mode-btn', { active: !showCreateMode }]"
        type="button"
        @click="showCreateMode = false"
      >
        <Undo2 />
        {{ locale.bindExisting }}
      </button>
      <button
        :class="['mode-btn', { active: showCreateMode }]"
        type="button"
        @click="showCreateMode = true"
      >
        <UserPlus />
        {{ locale.createAccount }}
      </button>
    </div>

    <form :class="['auth-form', { 'has-error': !!error }]" @submit.prevent="handleLogin">
      <!-- 用户名字段 - 所有模式都需要 -->
      <div class="form-group">
        <label for="username">
          {{ showCreateMode ? locale.setUsername : locale.accountName }}
        </label>
        <div class="input-wrapper">
          <User class="input-icon" />
          <input
            id="username"
            v-model="username"
            :class="{ 'input-error': error }"
            :autocomplete="!isBindMode && !showCreateMode ? 'username webauthn' : 'username'"
            :placeholder="showCreateMode ? locale.usernamePattern : locale.usernamePlaceholder"
            required
            type="text"
            @input="error = ''"
          />
        </div>
        <p v-if="showCreateMode" class="hint-text">{{ locale.usernameHint }}</p>
      </div>

      <!-- 姓名字段 - 仅创建模式 -->
      <div v-if="showCreateMode" class="form-group">
        <label for="name">{{ locale.realName }}</label>
        <div class="input-wrapper">
          <CalendarDays class="input-icon" />
          <input
            id="name"
            v-model="name"
            :class="{ 'input-error': error }"
            :placeholder="locale.realNamePlaceholder"
            required
            type="text"
            @input="error = ''"
          />
        </div>
      </div>

      <!-- 年级班级字段 - 仅创建模式，可选 -->
      <div v-if="showCreateMode" class="form-group">
        <div class="class-row">
          <CustomSelect
            v-model="grade"
            :options="gradeSelectOptions"
            :disabled="classOptionsLoading || gradeOptions.length === 0"
            :label="locale.gradeLabel"
            :placeholder="locale.optional"
            class-name="class-select"
            @change="handleGradeChange"
          />
          <CustomSelect
            v-model="studentClass"
            :options="classSelectOptions"
            :disabled="classOptionsLoading || !grade || availableClassOptions.length === 0"
            :label="locale.classLabel"
            :placeholder="grade ? locale.selectClass : locale.selectGradeFirst"
            class-name="class-select"
            @change="error = ''"
          />
        </div>
        <p class="hint-text">
          {{ gradeOptions.length > 0 ? locale.classHint : locale.noClassHint }}
        </p>
      </div>

      <!-- 密码字段 -->
      <div class="form-group">
        <div class="flex justify-between items-center w-full mb-2">
          <label for="password" class="mb-0">{{ showCreateMode ? locale.setPassword : locale.password }}</label>
          <NuxtLink v-if="!showCreateMode && !isBindMode && smtpEnabled" to="/forgot-password" class="text-xs leading-none text-[var(--primary)] hover:opacity-80 transition-opacity">
            {{ locale.forgotPassword }}
          </NuxtLink>
        </div>
        <div class="input-wrapper">
          <LockKeyhole class="input-icon" />
          <input
            id="password"
            v-model="password"
            :class="{ 'input-error': error }"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="showCreateMode ? locale.createPasswordPlaceholder : locale.passwordPlaceholder"
            required
            @input="error = ''"
          />
          <button
            :aria-label="showPassword ? locale.hidePassword : locale.showPassword"
            class="password-toggle"
            type="button"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" />
            <Eye v-else />
          </button>
        </div>

        <!-- 密码强度指示器 -->
        <div v-if="showCreateMode && password" class="px-1 pt-1 space-y-2 mt-1">
          <div class="h-1 w-full bg-[var(--input-border)] rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :class="passwordStrength.colorClass"
              :style="{ width: passwordStrength.width }"
            />
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]"
              >{{ locale.passwordStrength }}</span
            >
            <span
              class="text-[10px] font-black uppercase tracking-widest"
              :class="passwordStrength.textColorClass"
            >
              {{ passwordStrength.text }}
            </span>
          </div>
        </div>
      </div>

      <!-- 确认密码字段 - 仅在创建模式下显示 -->
      <div v-if="showCreateMode" class="form-group">
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
          />
          <button
            :aria-label="showConfirmPassword ? locale.hideConfirmPassword : locale.showConfirmPassword"
            class="password-toggle"
            type="button"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <EyeOff v-if="showConfirmPassword" />
            <Eye v-else />
          </button>
        </div>
      </div>

      <div v-show="showCaptcha" class="form-group">
        <TurnstileWidget
          v-if="captchaProvider === 'turnstile'"
          ref="turnstileRef"
          v-model="turnstileToken"
        />
        <CaptchaInput
          v-else
          ref="captchaRef"
          v-model="captchaInput"
          @update:captchaId="captchaId = $event"
        />
      </div>

      <div v-if="error" class="error-container">
        <CircleAlert class="error-icon" />
        <span class="error-message">{{ error }}</span>
      </div>

      <button :disabled="loading" class="submit-btn" type="submit">
        <Loader2 v-if="loading" class="size-5 animate-spin" />
        <span v-if="loading">{{ isBindMode ? locale.binding : locale.loggingIn }}</span>
        <span v-else>{{ isBindMode ? locale.bindAndLogin : locale.login }}</span>
      </button>
    </form>

    <div v-if="!isBindMode && isWebAuthnSupported" class="webauthn-section">
      <div class="divider">
        <span>{{ locale.or }}</span>
      </div>
      <button type="button" class="webauthn-btn" :disabled="loading" @click="handleWebAuthnLogin">
        <Fingerprint :size="20" class="webauthn-icon" />
        <span>{{ locale.webauthn }}</span>
      </button>
    </div>

    <AuthOAuthButtons v-if="!isBindMode" />

    <div class="form-footer">
      <p class="help-text">{{ locale.platformNote }}</p>
    </div>

    <AuthTwoFactorVerify
      :show="show2FA"
      :user-id="userId2FA"
      :available-methods="methods2FA"
      :masked-email="maskedEmail2FA"
      :temp-token="tempToken2FA"
      @success="handle2FASuccess"
      @cancel="show2FA = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { getProviderDisplayName } from '~/utils/oauth'
import { validateOAuthRegisterCredentials } from '~/utils/oauth-register'
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  WebAuthnAbortService
} from '@simplewebauthn/browser'
import {
  getWebAuthnErrorMessage,
  signalUnknownWebAuthnCredential,
  startWebAuthnAuthentication
} from '~/utils/webauthn'
import { CalendarDays, CircleAlert, Eye, EyeOff, Fingerprint, Loader2, LockKeyhole, Undo2, User, UserPlus } from '@lucide/vue'
import { usePasswordStrength } from '~/composables/usePasswordStrength'
import CustomSelect from '~/components/Shared/Common/CustomSelect.vue'
import CaptchaInput from './CaptchaInput.vue'
import TurnstileWidget from './TurnstileWidget.vue'
import { useLocale } from '~/utils/locale'

const { allowOAuthRegistration, fetchSiteConfig, smtpEnabled, captchaEnabled, captchaProvider } = useSiteConfig()
const { auth: authLocale, serverErrors } = useLocale()
const locale = computed(() => authLocale.value?.loginForm || {})
const { localize: localizeServerError } = useServerErrors()

const route = useRoute()
const isBindMode = computed(() => route.query.action === 'bind')
const providerUsername = computed(() => route.query.username || '')
const providerName = computed(() => {
  const provider = route.query.provider || 'third-party'
  return getProviderDisplayName(provider)
})
// 图形验证码与Turnstile相关
const isGraphicCaptchaRequired = ref(false)
const captchaId = ref('')
const captchaInput = ref('')
const captchaRef = ref(null)
const turnstileToken = ref('')
const turnstileRef = ref(null)

const showCaptcha = computed(() => {
  // 如果后端明确要求显示验证码，则优先显示
  if (isGraphicCaptchaRequired.value) return true
  // 否则根据配置显示
  if (!captchaEnabled.value) return false
  return captchaProvider.value === 'turnstile'
})

const getFormTitle = computed(() => {
  if (!isBindMode.value) return locale.value.welcomeBack
  if (!showCreateMode.value) return locale.value.bindAccount
  return locale.value.createNewAccount
})

const username = ref('')
const name = ref('')
const grade = ref('')
const studentClass = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isWebAuthnSupported = ref(false)
const classOptionsLoading = ref(false)
const classOptionsLoaded = ref(false)
const classOptions = ref([])
const show2FA = ref(false)
const userId2FA = ref(0)
const methods2FA = ref([])
const tempToken2FA = ref('')
const maskedEmail2FA = ref('')
const showCreateMode = ref(false)

const passwordStrength = usePasswordStrength(password)

const auth = useAuth()

// 只允许站内绝对路径，避免登录参数被用于开放重定向。
const getSafeRedirect = (fallback = '/') => {
  const queryRedirect = route.query.redirect
  const redirect = (Array.isArray(queryRedirect) ? queryRedirect[0] : queryRedirect) || fallback
  return redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')
    ? redirect
    : fallback
}

const gradeOptions = computed(() => {
  return [...new Set(classOptions.value.map((item) => item.grade))]
})

const gradeSelectOptions = computed(() => {
  return [
    { label: locale.value.optional, value: '' },
    ...gradeOptions.value.map(option => ({ label: option, value: option }))
  ]
})

const availableClassOptions = computed(() => {
  if (!grade.value) return []

  return classOptions.value.filter((item) => item.grade === grade.value).map((item) => item.class)
})

const classSelectOptions = computed(() => {
  return availableClassOptions.value.map((option) => ({ label: option, value: option }))
})

const fetchClassOptions = async () => {
  if (classOptionsLoaded.value || classOptionsLoading.value) return

  classOptionsLoading.value = true
  try {
    const response = await $fetch('/api/auth/oauth-register-options')

    if (response.success) {
      classOptions.value = response.classes || []
      classOptionsLoaded.value = true
    }
  } catch (e) {
    console.error('获取年级班级选项失败:', e)
  } finally {
    classOptionsLoading.value = false
  }
}

const handleGradeChange = () => {
  error.value = ''
  studentClass.value = ''
}

const redirectAfterLogin = async () => {
  if (auth.user.value?.requirePasswordChange) {
    return navigateTo('/change-password')
  }
  return navigateTo(getSafeRedirect(auth.isAdmin.value ? '/dashboard' : '/'))
}

const handle2FASuccess = async () => {
  await redirectAfterLogin()
}

onMounted(async () => {
  const isApiSupported = browserSupportsWebAuthn()
  isWebAuthnSupported.value = isApiSupported

  // Conditional UI 应尽早启动，让支持的浏览器通过账号输入框原生推荐 Passkey。
  if (isApiSupported && !isBindMode.value) {
    void startConditionalWebAuthnLogin()
  }

  await fetchSiteConfig()
  if (isBindMode.value) {
    await fetchClassOptions()
  }
})

onUnmounted(() => {
  WebAuthnAbortService.cancelCeremony()
})

watch(showCreateMode, async (enabled) => {
  if (enabled) {
    await fetchClassOptions()
  } else {
    grade.value = ''
    studentClass.value = ''
  }
})

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = locale.value.fullLoginInfo
    return
  }

  // 创建账户模式的验证
  if (isBindMode.value && showCreateMode.value) {
    if (!name.value || !confirmPassword.value) {
      error.value = locale.value.fullRegisterInfo
      return
    }
    if ((grade.value && !studentClass.value) || (!grade.value && studentClass.value)) {
      error.value = locale.value.gradeClassRequired
      return
    }
    return handleRegisterOAuth()
  }

  error.value = ''
  loading.value = true

  // 构建请求体，包含验证码信息
  const requestBody = {
    username: username.value,
    password: password.value
  }
  if (showCaptcha.value) {
    if (captchaProvider.value === 'turnstile') {
      requestBody.turnstileToken = turnstileToken.value
    } else {
      requestBody.captchaId = captchaId.value
      requestBody.captchaInput = captchaInput.value.trim()
    }
  }

  try {
    // 根据模式选择接口
    const url = isBindMode.value && !showCreateMode.value ? '/api/auth/bind' : '/api/auth/login'

    const response = await $fetch(url, {
      method: 'POST',
      body: requestBody
    })

    // 处理 2FA
    if (response.requires2FA) {
      userId2FA.value = response.userId
      methods2FA.value = response.methods
      tempToken2FA.value = response.tempToken || ''
      maskedEmail2FA.value = response.maskedEmail || ''
      show2FA.value = true
      return
    }

    // 登录成功，刷新认证状态
    await auth.initAuth(true)
    return redirectAfterLogin()
  } catch (err) {
    // 正确的错误路径：err.data = { statusCode, message, data: { captchaRequired } }
    const innerData = err.data?.data
    // 统一按错误码本地化服务端错误，未命中再回退到默认文案
    error.value = localizeServerError(
      err,
      isBindMode.value ? locale.value.bindFailed : locale.value.loginFailed
    )

    // 如果后端要求验证码，则显示验证码区域（针对图形验证码）
    if (innerData?.captchaRequired) {
      isGraphicCaptchaRequired.value = true
    }
    // 只要当前显示了验证码，且没有成功登录，就强制刷新验证码
    if (showCaptcha.value) {
      await nextTick()
      if (captchaProvider.value === 'turnstile') {
        turnstileRef.value?.reset?.()
      } else {
        captchaRef.value?.refreshCaptcha?.()
      }
    }

    // 仅凭据错误（401）时清空密码字段（避免验证码错误时误清）
    if (err.statusCode === 401) {
      password.value = ''
    }
  } finally {
    loading.value = false
  }
}

const handleRegisterOAuth = async () => {
  const validationError = validateOAuthRegisterCredentials(
    username.value,
    password.value,
    confirmPassword.value
  )

  if (validationError) {
    error.value = serverErrors.value?.[validationError.code] || locale.value.registerFailed
    return
  }

  error.value = ''
  loading.value = true

  try {
    const response = await $fetch('/api/auth/oauth-register', {
      method: 'POST',
      body: {
        username: username.value,
        name: name.value,
        grade: grade.value,
        class: studentClass.value,
        password: password.value,
        confirmPassword: confirmPassword.value
      }
    })

    if (response.success) {
      // 账户创建成功，刷新认证状态
      await auth.initAuth(true)
      return redirectAfterLogin()
    }
  } catch (err) {
    const apiError = err
    // 统一按错误码本地化服务端错误，未命中再回退到默认文案
    error.value = localizeServerError(apiError, locale.value.registerFailed)
    // 当发生用户名冲突时 (HTTP 409 Conflict)，清空用户名字段
    if (apiError.statusCode === 409) {
      username.value = ''
    }
  } finally {
    loading.value = false
  }
}

const isWebAuthnCeremonyAborted = (webAuthnError) =>
  webAuthnError?.code === 'ERROR_CEREMONY_ABORTED' || webAuthnError?.name === 'AbortError'

const runWebAuthnLogin = async ({ useBrowserAutofill = false, showErrors = true } = {}) => {
  let options
  let credential

  try {
    // 1. 获取登录选项
    options = await $fetch('/api/auth/webauthn/login/options', { method: 'POST' })
    // 2. 调用浏览器 WebAuthn API
    credential = await startWebAuthnAuthentication(options, useBrowserAutofill)
    // 3. 验证登录
    const verification = await $fetch('/api/auth/webauthn/login/verify', {
      method: 'POST',
      body: credential
    })

    if (verification.success) {
      // 登录成功
      await auth.initAuth(true)
      return redirectAfterLogin()
    }
  } catch (e) {
    if (isWebAuthnCeremonyAborted(e)) return
    if (!showErrors && !credential) return

    console.error('WebAuthn 登录错误:', e)
    const message = getWebAuthnErrorMessage(e, locale.value, locale.value.passkeyFailed)

    if (credential?.id && options?.rpId && message === '未找到该 Passkey 关联的账号') {
      const signaled = await signalUnknownWebAuthnCredential({
        credentialId: credential.id,
        rpId: options.rpId
      })
      error.value = signaled
        ? locale.value.passkeyCleanupNotified
        : locale.value.passkeyCleanupRequired
    } else {
      error.value = message
    }
  }
}

const startConditionalWebAuthnLogin = async () => {
  try {
    if (await browserSupportsWebAuthnAutofill()) {
      await runWebAuthnLogin({ useBrowserAutofill: true, showErrors: false })
    }
  } catch (e) {
    console.warn('Passkey 自动填充初始化失败:', e)
  }
}

const handleWebAuthnLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    await runWebAuthnLogin()
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

.class-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.class-select {
  min-width: 0;
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
  background: var(--panel-bg-secondary);
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
  background: var(--panel-bg-tertiary);
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

  .mode-selector {
    gap: 8px;
  }

  .mode-btn {
    padding: 10px 12px;
    font-size: 13px;
  }

  .mode-btn svg {
    width: 16px;
    height: 16px;
  }

  .class-row {
    grid-template-columns: 1fr;
  }
}

.mode-selector {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.mode-btn {
  flex: 1;
  padding: 12px 16px;
  background: var(--panel-bg-secondary);
  color: var(--text-secondary);
  border: 2px solid var(--input-border);
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.mode-btn svg {
  width: 18px;
  height: 18px;
  transition: all 0.2s ease;
}

.mode-btn:hover:not(.active) {
  background: var(--panel-bg-tertiary);
  border-color: var(--input-border-focus);
  color: var(--text-primary);
}

.mode-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.mode-btn.active svg {
  color: white;
}

.hint-text {
  font-size: 12px;
  color: var(--text-quaternary);
  margin: -4px 0 0 0;
  line-height: 1.4;
}
</style>
