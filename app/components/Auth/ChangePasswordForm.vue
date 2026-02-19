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
            placeholder="请输入当前密码"
            required
            @input="error = ''"
          >
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            type="button"
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
            placeholder="请输入新密码"
            required
            @input="
              error = '';
              validatePassword()
            "
          >
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            type="button"
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
            placeholder="请再次输入新密码"
            required
            @input="error = ''"
          >
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            type="button"
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
        class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3"
      >
        <AlertCircle :size="16" class="text-rose-500 shrink-0" />
        <span class="text-xs text-rose-500 font-medium">{{ error }}</span>
      </div>

      <div
        v-if="success"
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
import { computed, ref } from 'vue'
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-vue-next'

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

// 表单验证
const isFormValid = computed(() => {
  if (props.isFirstLogin) {
    return (
      newPassword.value &&
      confirmPassword.value &&
      newPassword.value === confirmPassword.value &&
      newPassword.value.length >= 8
    )
  } else {
    return (
      currentPassword.value &&
      newPassword.value &&
      confirmPassword.value &&
      newPassword.value === confirmPassword.value &&
      newPassword.value.length >= 8
    )
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
      success.value = '密码修改成功！请重新登录'

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
