<template>
  <div class="space-y-6">
    <form class="space-y-5" @submit.prevent="handleChangePassword">
      <div v-if="!isFirstLogin" class="space-y-2">
        <label
          for="current-password"
          class="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1"
          >当前密码</label
        >
        <div class="relative group">
          <div
            class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors"
          >
            <Lock :size="18" />
          </div>
          <input
            id="current-password"
            v-model="currentPassword"
            :class="[
              inputClass,
              error
                ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                : 'border-zinc-800 focus:border-blue-500/30'
            ]"
            :type="showCurrentPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="请输入当前密码"
            required
            @input="error = ''"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            type="button"
            :aria-label="showCurrentPassword ? '隐藏当前密码' : '显示当前密码'"
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
          class="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1"
          >新密码</label
        >
        <div class="relative group">
          <div
            class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors"
          >
            <KeyRound :size="18" />
          </div>
          <input
            id="new-password"
            v-model="newPassword"
            :class="[
              inputClass,
              error
                ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                : 'border-zinc-800 focus:border-blue-500/30'
            ]"
            :type="showNewPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="请输入新密码"
            required
            @input="handleNewPasswordInput"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            type="button"
            :aria-label="showNewPassword ? '隐藏新密码' : '显示新密码'"
            @click="showNewPassword = !showNewPassword"
          >
            <Eye v-if="!showNewPassword" :size="18" />
            <EyeOff v-else :size="18" />
          </button>
        </div>

        <!-- 密码强度指示器 -->
        <div v-if="newPassword" class="px-1 pt-1 space-y-2">
          <div class="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :class="passwordStrength.colorClass"
              :style="{ width: passwordStrength.width }"
            />
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] font-black uppercase tracking-widest text-zinc-500"
              >密码强度</span
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
          class="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1"
          >确认新密码</label
        >
        <div class="relative group">
          <div
            class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors"
          >
            <CheckCircle2 :size="18" />
          </div>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            :class="[
              inputClass,
              error || (confirmPassword && newPassword !== confirmPassword)
                ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                : 'border-zinc-800 focus:border-blue-500/30'
            ]"
            :type="showConfirmPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="请再次输入新密码"
            required
            @input="error = ''"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            type="button"
            :aria-label="showConfirmPassword ? '隐藏确认密码' : '显示确认密码'"
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
            class="flex items-center gap-1.5 text-rose-500"
          >
            <XCircle :size="12" />
            <span class="text-[10px] font-bold">密码不匹配</span>
          </div>
          <div v-else class="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 :size="12" />
            <span class="text-[10px] font-bold">密码匹配</span>
          </div>
        </div>
      </div>

      <!-- 状态消息 -->
      <div
        v-if="error"
        aria-live="polite"
        class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3"
      >
        <AlertCircle :size="16" class="text-rose-500 shrink-0" />
        <span class="text-xs text-rose-500 font-medium">{{ error }}</span>
      </div>

      <div
        v-if="success"
        aria-live="polite"
        class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3"
      >
        <CheckCircle2 :size="16" class="text-emerald-500 shrink-0" />
        <span class="text-xs text-emerald-500 font-medium">{{ success }}</span>
      </div>

      <button
        :disabled="loading || !isFormValid"
        class="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
        type="submit"
      >
        <Loader2 v-if="loading" :size="18" class="animate-spin" />
        <span>{{ loading ? '处理中...' : isFirstLogin ? '设置初始密码' : '确认修改密码' }}</span>
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
import { validatePasswordPolicy } from '~/utils/password-policy'

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
  'w-full bg-zinc-950 border rounded-xl pl-11 pr-11 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-all'

// 密码显示状态
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// 密码强度计算
const passwordStrength = computed(() => {
  const password = newPassword.value
  if (!password) return { width: '0%', colorClass: '', textColorClass: '', text: '' }

  let score = 0

  if (password.length >= 8) score += 25
  if (/[A-Z]/.test(password)) score += 25
  if (/[a-z]/.test(password)) score += 25
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 25

  if (score < 50) {
    return {
      width: `${score || 10}%`,
      colorClass: 'bg-rose-500',
      textColorClass: 'text-rose-500',
      text: '弱'
    }
  } else if (score < 75) {
    return {
      width: `${score}%`,
      colorClass: 'bg-amber-500',
      textColorClass: 'text-amber-500',
      text: '中等'
    }
  } else if (score < 100) {
    return {
      width: `${score}%`,
      colorClass: 'bg-blue-500',
      textColorClass: 'text-blue-500',
      text: '强'
    }
  } else {
    return {
      width: '100%',
      colorClass: 'bg-emerald-500',
      textColorClass: 'text-emerald-500',
      text: '极强'
    }
  }
})

const passwordPolicyError = computed(() => validatePasswordPolicy(newPassword.value))

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
    error.value = '新密码和确认密码不匹配'
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
      success.value = '密码设置成功！正在跳转...'

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
      success.value = '密码修改成功！请重新登录'

      resetForm()

      // 密码修改后登出
      scheduleRedirect(async () => {
        await auth.logout(false)
        await router.replace('/login')
      })
    }
  } catch (err) {
    error.value =
      err?.data?.message ||
      err?.data?.statusMessage ||
      err?.message ||
      err?.statusMessage ||
      '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>
