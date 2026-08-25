<template>
  <div class="space-y-6">
    <form class="space-y-5" @submit.prevent="handleChangePassword">
      <div v-if="!isFirstLogin" class="space-y-2">
        <label
          for="current-password"
          class="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
          >{{ locale.currentPassword }}</label
        >
        <div class="relative group">
          <div
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary transition-colors"
          >
            <Lock :size="18" />
          </div>
          <input
            id="current-password"
            v-model="currentPassword"
            :class="[
              inputClass,
              error
                ? 'border-error shadow-[0_0_15px_var(--auth-error-input-shadow)]'
                : 'border-border-secondary focus:border-primary-30'
            ]"
            :type="showCurrentPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :placeholder="locale.currentPasswordPlaceholder"
            required
            @input="error = ''"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            type="button"
            :aria-label="
              showCurrentPassword ? locale.hideCurrentPassword : locale.showCurrentPassword
            "
            @click="showCurrentPassword = !showCurrentPassword"
          >
            <Eye v-if="!showCurrentPassword" :size="18" />
            <EyeOff v-else :size="18" />
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <label
          for="new-password"
          class="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
          >{{ locale.newPassword }}</label
        >
        <div class="relative group">
          <div
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary transition-colors"
          >
            <KeyRound :size="18" />
          </div>
          <input
            id="new-password"
            v-model="newPassword"
            :class="[
              inputClass,
              error
                ? 'border-error shadow-[0_0_15px_var(--auth-error-input-shadow)]'
                : 'border-border-secondary focus:border-primary-30'
            ]"
            :type="showNewPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="locale.newPasswordPlaceholder"
            required
            @input="handleNewPasswordInput"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            type="button"
            :aria-label="showNewPassword ? locale.hideNewPassword : locale.showNewPassword"
            @click="showNewPassword = !showNewPassword"
          >
            <Eye v-if="!showNewPassword" :size="18" />
            <EyeOff v-else :size="18" />
          </button>
        </div>

        <!-- 密码强度指示器 -->
        <div v-if="newPassword" class="px-1 pt-1 space-y-2">
          <div class="h-1 w-full bg-bg-tertiary rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :class="passwordStrength.colorClass"
              :style="{ width: passwordStrength.width }"
            />
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] font-black uppercase tracking-widest text-text-tertiary"
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

      <div class="space-y-2">
        <label
          for="confirm-password"
          class="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
          >{{ locale.confirmPassword }}</label
        >
        <div class="relative group">
          <div
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary transition-colors"
          >
            <CheckCircle2 :size="18" />
          </div>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            :class="[
              inputClass,
              error || (confirmPassword && newPassword !== confirmPassword)
                ? 'border-error shadow-[0_0_15px_var(--auth-error-input-shadow)]'
                : 'border-border-secondary focus:border-primary-30'
            ]"
            :type="showConfirmPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="locale.confirmPasswordPlaceholder"
            required
            @input="error = ''"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            type="button"
            :aria-label="
              showConfirmPassword ? locale.hideConfirmPassword : locale.showConfirmPassword
            "
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <Eye v-if="!showConfirmPassword" :size="18" />
            <EyeOff v-else :size="18" />
          </button>
        </div>

        <!-- 密码匹配提示 -->
        <div v-if="confirmPassword" class="px-1">
          <div
            v-if="newPassword !== confirmPassword"
            class="flex items-center gap-1.5 text-error"
          >
            <XCircle :size="12" />
            <span class="text-[10px] font-bold">{{ locale.mismatch }}</span>
          </div>
          <div v-else class="flex items-center gap-1.5 text-success">
            <CheckCircle2 :size="12" />
            <span class="text-[10px] font-bold">{{ locale.matched }}</span>
          </div>
        </div>
      </div>

      <!-- 状态消息 -->
      <div
        v-if="error"
        aria-live="polite"
        class="p-3 bg-error-10 border border-error-20 rounded-xl flex items-center gap-3"
      >
        <AlertCircle :size="16" class="text-error shrink-0" />
        <span class="text-xs text-error font-medium">{{ error }}</span>
      </div>

      <div
        v-if="success"
        aria-live="polite"
        class="p-3 bg-success-10 border border-success-20 rounded-xl flex items-center gap-3"
      >
        <CheckCircle2 :size="16" class="text-success shrink-0" />
        <span class="text-xs text-success font-medium">{{ success }}</span>
      </div>

      <button
        :disabled="loading || !isFormValid"
        class="w-full flex items-center justify-center gap-2 py-3 bg-primary-hover hover:bg-primary text-text-primary text-sm font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-[0.98] disabled:opacity-50"
        type="submit"
      >
        <Loader2 v-if="loading" :size="18" class="animate-spin" />
        <span>{{ loading ? locale.processing : isFirstLogin ? locale.setInitial : locale.submitChange }}</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { usePasswordStrength } from '~/composables/usePasswordStrength'
import { validateInitialPasswordPolicy, validatePasswordPolicy } from '~/utils/password-policy'

// 组件属性
const props = defineProps({
  isFirstLogin: {
    type: Boolean,
    default: false
  }
})

const auth = useAuth()
const router = useRouter()
const { auth: authLocale } = useLocale()
const locale = computed(() => authLocale.value?.changePasswordForm || {})
const { localize: localizeServerError } = useServerErrors()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)
let redirectTimer = null

const scheduleRedirect = (callback) => {
  if (redirectTimer) clearTimeout(redirectTimer)
  redirectTimer = setTimeout(callback, 2000)
}

onBeforeUnmount(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})

// 样式类
const inputClass =
  'w-full bg-bg-primary border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none transition-all'

// 密码显示状态
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// 密码强度计算
const passwordStrength = usePasswordStrength(newPassword)

const passwordPolicyError = computed(() =>
  props.isFirstLogin
    ? validateInitialPasswordPolicy(newPassword.value)
    : validatePasswordPolicy(newPassword.value)
)

// 表单验证
const isFormValid = computed(() => {
  return Boolean(
    (props.isFirstLogin || currentPassword.value) &&
    newPassword.value &&
    confirmPassword.value &&
    newPassword.value === confirmPassword.value &&
    !passwordPolicyError.value
  )
})

const handleNewPasswordInput = () => {
  error.value = newPassword.value ? passwordPolicyError.value || '' : ''
}

const resetForm = () => {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

const handleChangePassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    error.value = locale.value.newPasswordMismatch
    return
  }

  if (passwordPolicyError.value) {
    error.value = passwordPolicyError.value
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    if (props.isFirstLogin) {
      await auth.setInitialPassword(newPassword.value)
      success.value = locale.value.initialSuccess

      resetForm()

      // 密码设置完成后跳转
      scheduleRedirect(async () => {
        if (auth.isAdmin.value) {
          router.replace('/dashboard')
        } else {
          router.replace('/')
        }
      })
    } else {
      await auth.changePassword(currentPassword.value, newPassword.value)
      success.value = locale.value.changeSuccess

      resetForm()

      // 密码修改后登出
      scheduleRedirect(async () => {
        await auth.logout(false)
        await router.replace('/login')
      })
    }
  } catch (err) {
    // 统一按错误码本地化服务端错误，未命中再回退到默认文案
    error.value = localizeServerError(err, locale.value.failed)
  } finally {
    loading.value = false
  }
}
</script>
