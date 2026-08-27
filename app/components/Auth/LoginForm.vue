<template>
  <div class="login-form">
    <div class="form-header">
      <h2>{{ getFormTitle }}</h2>
      <p v-if="isBindMode && !showCreateMode">{{ formatLocale(locale.bindProvider, providerName, providerUsername) }}</p>
      <p v-else-if="isBindMode && showCreateMode">{{ formatLocale(locale.createWithProvider, providerName) }}</p>
      <p v-else-if="showRegisterMode">{{ locale.registerSubtitle }}</p>
      <p v-else>{{ locale.loginSubtitle }}</p>
    </div>

    <!-- OAuth 账号创建/绑定模式选择器 -->
    <div v-if="isBindMode && allowOAuthRegistration" class="mode-selector">
      <button
        :class="['mode-btn', { active: !showCreateMode }]"
        type="button"
        @click="showCreateMode = false"
      >
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M11 16l-6-6m0 0l6-6m-6 6h12.5a4.5 4.5 0 010 9H11" />
        </svg>
        {{ locale.bindExisting }}
      </button>
      <button
        :class="['mode-btn', { active: showCreateMode }]"
        type="button"
        @click="showCreateMode = true"
      >
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
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
            :autocomplete="!isBindMode && !showCreateMode ? 'username webauthn' : 'username'"
            :placeholder="showCreateMode ? locale.usernamePattern : locale.usernamePlaceholder"
            required
            type="text"
            @input="error = ''"
          />
        </div>
        <p v-if="showCreateMode" class="hint-text">{{ locale.usernameHint }}</p>
      </div>

      <!-- 姓名字段 - 仅注册/创建模式 -->
      <div v-if="showCreateMode || showRegisterMode" class="form-group">
        <label for="name">{{ locale.realName }}</label>
        <div class="input-wrapper">
          <svg
            class="input-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
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

      <!-- 年级班级字段 - 仅注册/创建模式，可选 -->
      <div v-if="showCreateMode || showRegisterMode" class="form-group">
        <div class="class-row">
          <CustomSelect
            v-model="grade"
            :options="gradeSelectOptions"
            :disabled="classOptionsLoading || gradeOptions.length === 0"
            :label="locale.gradeLabel"
            :placeholder="registerRequiresGradeClass ? locale.selectGrade : locale.optional"
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
          {{
            gradeOptions.length > 0
              ? registerRequiresGradeClass
                ? locale.classHintRequired
                : locale.classHint
              : registerRequiresGradeClass
                ? locale.noClassHintRequired
                : locale.noClassHint
          }}
        </p>
      </div>

      <!-- 密码字段 -->
      <div class="form-group">
        <div class="flex justify-between items-center w-full mb-2">
          <label for="password" style="margin-bottom: 0;">{{ showCreateMode ? locale.setPassword : locale.password }}</label>
          <NuxtLink v-if="!showCreateMode && !isBindMode && smtpEnabled" to="/forgot-password" class="text-xs text-[var(--primary)] hover:opacity-80 transition-opacity" style="line-height: 1;">
            {{ locale.forgotPassword }}
          </NuxtLink>
        </div>
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
            :placeholder="showCreateMode ? locale.createPasswordPlaceholder : locale.passwordPlaceholder"
            required
            @input="error = ''"
          />
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

        <!-- 密码强度指示器 -->
        <div v-if="(showCreateMode || showRegisterMode) && password" class="px-1 pt-1 space-y-2 mt-1">
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

      <!-- 确认密码字段 - 仅在创建/注册模式下显示 -->
      <div v-if="showCreateMode || showRegisterMode" class="form-group">
        <label for="confirmPassword">{{ locale.confirmPassword }}</label>
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
            id="confirmPassword"
            v-model="confirmPassword"
            :class="{ 'input-error': error }"
            :type="showConfirmPassword ? 'text' : 'password'"
            :placeholder="locale.confirmPasswordPlaceholder"
            required
            @input="error = ''"
          />
          <button
            class="password-toggle"
            type="button"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <svg
              v-if="showConfirmPassword"
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

      <!-- 备注字段 - 仅注册/创建模式下显示（可选） -->
      <div v-if="showRegisterMode || showCreateMode" class="form-group">
        <label for="remark">{{ locale.remarkLabel }}</label>
        <div class="input-wrapper">
          <svg
            class="input-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <input
            id="remark"
            v-model="remark"
            :placeholder="locale.remarkPlaceholder"
            maxlength="200"
            type="text"
            @input="error = ''"
          />
        </div>
      </div>

      <!-- 邮箱字段 - 管理员开启注册邮箱功能后显示（必填，需邮箱验证码验证归属） -->
      <div v-if="(showRegisterMode || showCreateMode) && registerEmailRequired" class="form-group">
        <label for="email">{{ locale.emailLabel }}</label>
        <div class="input-wrapper">
          <svg
            class="input-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
          </svg>
          <input
            id="email"
            v-model="email"
            type="email"
            :placeholder="locale.emailPlaceholder"
            maxlength="100"
            @input="error = ''"
          />
        </div>
      </div>

      <!-- 邮箱验证码 - 仅注册模式且已填写邮箱时显示 -->
      <div v-if="(showRegisterMode || showCreateMode) && email" class="form-group">
        <label for="emailCode">{{ locale.emailCodeLabel }}</label>
        <div class="input-wrapper">
          <svg
            class="input-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <input
            id="emailCode"
            v-model="emailCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            class="code-input"
            :placeholder="locale.emailCodePlaceholder"
            @input="error = ''"
          />
          <button
            type="button"
            class="code-btn"
            :disabled="sendingCode || codeCountdown > 0"
            @click="sendEmailCode"
          >
            {{ codeCountdown > 0 ? locale.codeCountdown(codeCountdown) : locale.sendCode }}
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
        <span v-if="loading">{{ showRegisterMode ? locale.registering : isBindMode ? locale.binding : locale.loggingIn }}</span>
        <span v-else>{{ showRegisterMode ? locale.register : isBindMode ? locale.bindAndLogin : locale.login }}</span>
      </button>

      <!-- 登录/注册模式切换 -->
      <div v-if="!isBindMode && allowRegister" class="mode-switch">
        <button
          v-if="!showRegisterMode"
          type="button"
          class="switch-link"
          @click="switchToRegister"
        >
          {{ locale.toRegister }}
        </button>
        <button v-else type="button" class="switch-link" @click="switchToLogin">
          {{ locale.toLogin }}
        </button>
      </div>
    </form>

    <AuthOAuthQuickLogin v-if="!isBindMode && !showRegisterMode" />

    <div v-if="!isBindMode && !showRegisterMode && isWebAuthnSupported" class="webauthn-section">
      <div class="divider">
        <span>{{ locale.or }}</span>
      </div>
      <button type="button" class="webauthn-btn" :disabled="loading" @click="handleWebAuthnLogin">
        <Fingerprint :size="20" class="webauthn-icon" />
        <span>{{ locale.webauthn }}</span>
      </button>
    </div>

    <AuthOAuthButtons v-if="!isBindMode && !showRegisterMode" />

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

    <!-- 绑定已有账户前的二次确认 -->
    <ConfirmDialog
      v-model:show="showBindConfirm"
      :title="locale.confirmBindTitle"
      :message="bindConfirmMessage"
      type="warning"
      :confirm-text="locale.confirmBind"
      :loading="bindConfirmLoading"
      @confirm="handleBindConfirm"
      @cancel="showBindConfirm = false"
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
import { Fingerprint } from '@lucide/vue'
import { usePasswordStrength } from '~/composables/usePasswordStrength'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import CaptchaInput from './CaptchaInput.vue'
import TurnstileWidget from './TurnstileWidget.vue'
import AuthOAuthQuickLogin from './OAuthQuickLogin.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useLocale } from '~/utils/locale'
import { useOAuthBindReminder } from '~/composables/useOAuthBindReminder'

const { allowOAuthRegistration, allowRegister, fetchSiteConfig, smtpEnabled, captchaEnabled, captchaProvider, registerEmailRequired, registerRequiresGradeClass } = useSiteConfig()
const { auth: authLocale, serverErrors } = useLocale()
const locale = computed(() => authLocale.value?.loginForm || {})
const { localize: localizeServerError } = useServerErrors()
const { success: toastSuccess } = useToast()

const route = useRoute()
const router = useRouter()
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
  // 注册模式开启验证码服务时强制显示验证码
  if (showRegisterMode.value) return captchaEnabled.value
  // 如果后端明确要求显示验证码，则优先显示
  if (isGraphicCaptchaRequired.value) return true
  // 否则根据配置显示
  if (!captchaEnabled.value) return false
  return captchaProvider.value === 'turnstile'
})

const getFormTitle = computed(() => {
  if (showRegisterMode.value) return locale.value.registerTitle
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
const showRegisterMode = ref(false)
const remark = ref('')
const email = ref('')
const emailCode = ref('')
const sendingCode = ref(false)
const codeCountdown = ref(0)
const codeTimer = ref(null)
const showBindConfirm = ref(false)
const bindConfirmLoading = ref(false)

// 二次确认文案：将第三方账号与当前输入的账户绑定
const bindConfirmMessage = computed(() => {
  if (!isBindMode.value || showCreateMode.value) return ''
  return formatLocale(
    locale.value.confirmBindMessage,
    providerName.value,
    providerUsername.value,
    username.value
  )
})

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
  const options = gradeOptions.value.map((option) => ({ label: option, value: option }))
  // 站点开启"注册时必须选择年级班级"时，去掉"不填写"空选项
  if (registerRequiresGradeClass.value) return options
  return [{ label: locale.value.optional, value: '' }, ...options]
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
    const url = showRegisterMode.value
      ? '/api/auth/grade-class-options'
      : '/api/auth/oauth-register-options'
    const response = await $fetch(url)

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

// 年级班级校验：站点开启必填时二者均须选择；未开启时二者成对填写或全部留空
const gradeClassRequiredError = () => {
  if (registerRequiresGradeClass.value && (!grade.value || !studentClass.value)) {
    return locale.value.gradeClassRequiredByConfig
  }
  if ((grade.value && !studentClass.value) || (!grade.value && studentClass.value)) {
    return locale.value.gradeClassRequired
  }
  return ''
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
  if (codeTimer.value) {
    clearInterval(codeTimer.value)
    codeTimer.value = null
  }
})

watch(showCreateMode, async (enabled) => {
  if (enabled) {
    await fetchClassOptions()
  } else {
    grade.value = ''
    studentClass.value = ''
  }
})

watch(showRegisterMode, async (enabled) => {
  if (enabled) {
    await fetchClassOptions()
  } else {
    grade.value = ''
    studentClass.value = ''
    remark.value = ''
  }
})

const switchToRegister = () => {
  showRegisterMode.value = true
  error.value = ''
  isGraphicCaptchaRequired.value = false
}

const switchToLogin = () => {
  showRegisterMode.value = false
  error.value = ''
  grade.value = ''
  studentClass.value = ''
  remark.value = ''
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = locale.value.fullLoginInfo
    return
  }

  // 注册模式的验证与提交
  if (showRegisterMode.value) {
    if (!name.value || !confirmPassword.value) {
      error.value = locale.value.fullRegisterInfo
      return
    }
    const gradeClassError = gradeClassRequiredError()
    if (gradeClassError) {
      error.value = gradeClassError
      return
    }
    return handleRegister()
  }

  // 创建账户模式的验证
  if (isBindMode.value && showCreateMode.value) {
    if (!name.value || !confirmPassword.value) {
      error.value = locale.value.fullRegisterInfo
      return
    }
    const gradeClassError = gradeClassRequiredError()
    if (gradeClassError) {
      error.value = gradeClassError
      return
    }
    return handleRegisterOAuth()
  }

  error.value = ''

  // 绑定已有账户前先弹二次确认，确认后才真正发起绑定请求
  if (isBindMode.value && !showCreateMode.value) {
    showBindConfirm.value = true
    return
  }

  await performLogin()
}

// 发起登录/绑定请求，成功后跳转；返回 'success' | '2fa' | 'failed'
const performLogin = async () => {
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

    // 账号密码登录成功后记录来源，供微信/QQ 内置浏览器进入主页时引导绑定
    if (!isBindMode.value && url === '/api/auth/login') {
      useOAuthBindReminder().markPasswordLogin()
    }

    // 处理 2FA
    if (response.requires2FA) {
      userId2FA.value = response.userId
      methods2FA.value = response.methods
      tempToken2FA.value = response.tempToken || ''
      maskedEmail2FA.value = response.maskedEmail || ''
      show2FA.value = true
      return '2fa'
    }

    // 登录成功，刷新认证状态
    await auth.initAuth(true)
    await redirectAfterLogin()
    return 'success'
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
    return 'failed'
  } finally {
    loading.value = false
  }
}

// 确认弹窗确认后执行绑定请求；失败或进入 2FA 时关闭弹窗
const handleBindConfirm = async () => {
  bindConfirmLoading.value = true
  try {
    const result = await performLogin()
    if (result !== 'success') {
      showBindConfirm.value = false
    }
  } finally {
    bindConfirmLoading.value = false
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

  // 邮箱必填由管理员开关控制：开启时邮箱必须填写，且须附带验证码
  const emailValue = email.value.trim()
  if (registerEmailRequired.value && !emailValue) {
    error.value = locale.value.emailRequired
    return
  }
  if (emailValue && !emailCode.value.trim()) {
    error.value = locale.value.emailCodeRequired
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
        confirmPassword: confirmPassword.value,
        remark: remark.value.trim(),
        email: emailValue || undefined,
        emailCode: emailCode.value.trim() || undefined
      }
    })

    if (response.success) {
      if (response.pendingApproval) {
        // 审核模式：提示后退出 OAuth 创建视图，回到普通登录界面
        toastSuccess(locale.value.registerSuccessPending)
        showCreateMode.value = false
        username.value = ''
        name.value = ''
        password.value = ''
        confirmPassword.value = ''
        grade.value = ''
        studentClass.value = ''
        if (route.query.action === 'bind') {
          await router.replace({ query: {} })
        }
      } else {
        // 账户创建成功，刷新认证状态
        await auth.initAuth(true)
        return redirectAfterLogin()
      }
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

// 发送邮箱验证码：校验格式 → POST /api/auth/email-code → 60 秒倒计时
const sendEmailCode = async () => {
  const emailValue = email.value.trim()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailValue || !emailRegex.test(emailValue)) {
    error.value = locale.value.emailInvalid || '请输入有效的邮箱地址'
    return
  }

  error.value = ''
  sendingCode.value = true
  try {
    await $fetch('/api/auth/email-code', {
      method: 'POST',
      body: { email: emailValue }
    })
    toastSuccess(locale.value.codeSent)
    codeCountdown.value = 60
    codeTimer.value = setInterval(() => {
      codeCountdown.value -= 1
      if (codeCountdown.value <= 0) {
        clearInterval(codeTimer.value)
        codeTimer.value = null
        codeCountdown.value = 0
      }
    }, 1000)
  } catch (err) {
    const apiError = useServerErrors().localize(err, locale.value.codeSendFailed)
    error.value = apiError
  } finally {
    sendingCode.value = false
  }
}

// 用户名密码注册：提交 /api/auth/register，处理待审核与直接登录两种结果
const handleRegister = async () => {
  const validationError = validateOAuthRegisterCredentials(
    username.value,
    password.value,
    confirmPassword.value
  )

  if (validationError) {
    error.value = serverErrors.value?.[validationError.code] || locale.value.registerFailed
    return
  }

  // 邮箱必填由管理员开关控制：开启时邮箱必须填写，且须附带验证码
  const emailValue = email.value.trim()
  if (registerEmailRequired.value && !emailValue) {
    error.value = locale.value.emailRequired
    return
  }
  if (emailValue && !emailCode.value.trim()) {
    error.value = locale.value.emailCodeRequired
    return
  }

  error.value = ''
  loading.value = true

  try {
    const requestBody = {
      username: username.value,
      name: name.value,
      grade: grade.value,
      class: studentClass.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
      remark: remark.value.trim(),
      email: emailValue || undefined,
      emailCode: emailCode.value.trim() || undefined
    }
    if (showCaptcha.value) {
      if (captchaProvider.value === 'turnstile') {
        requestBody.turnstileToken = turnstileToken.value
      } else {
        requestBody.captchaId = captchaId.value
        requestBody.captchaInput = captchaInput.value.trim()
      }
    }

    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: requestBody
    })

    if (response.success) {
      if (response.pendingApproval) {
        // 需要审核：提示后返回登录模式
        toastSuccess(locale.value.registerSuccessPending)
        switchToLogin()
      } else {
        // 无需审核：自动登录
        await auth.initAuth(true)
        return redirectAfterLogin()
      }
    }
  } catch (err) {
    const apiError = err
    const innerData = apiError.data?.data
    // 统一按错误码本地化服务端错误，未命中再回退到默认文案
    error.value = localizeServerError(apiError, locale.value.registerFailed)

    // 如果后端要求验证码，则显示验证码区域
    if (innerData?.captchaRequired) {
      isGraphicCaptchaRequired.value = true
    }
    // 只要当前显示了验证码，就强制刷新验证码
    if (showCaptcha.value) {
      await nextTick()
      if (captchaProvider.value === 'turnstile') {
        turnstileRef.value?.reset?.()
      } else {
        captchaRef.value?.refreshCaptcha?.()
      }
    }

    // 用户名冲突时清空用户名字段
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

/* 邮箱验证码输入：右侧预留发送按钮空间 */
.input-wrapper .code-input {
  padding-right: 118px;
}

.code-btn {
  position: absolute;
  right: 10px;
  z-index: 1;
  padding: 7px 12px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: 1px solid var(--btn-primary-border);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: var(--font-medium);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.code-btn:hover:not(:disabled) {
  background: var(--btn-primary-hover);
}

.code-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.loading-spinner {
  width: 20px;
  height: 20px;
}

.form-footer {
  margin-top: 24px;
  text-align: center;
}

.mode-switch {
  margin-top: 16px;
  text-align: center;
}

.switch-link {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--primary);
  transition: opacity 0.2s ease;
}

.switch-link:hover {
  opacity: 0.8;
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
