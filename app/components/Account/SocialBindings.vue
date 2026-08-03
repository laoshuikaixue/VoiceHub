<template>
  <section :class="sectionClass">
    <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
      <div class="p-2.5 bg-purple-500/10 rounded-xl">
        <Share2 :size="20" class="text-purple-500" />
      </div>
      <div>
        <h2 class="text-base font-black text-zinc-100">{{ locale.title }}</h2>
        <p class="text-xs text-zinc-500 mt-0.5">{{ locale.desc }}</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500">
      <Loader2 :size="16" class="animate-spin" />
      <span>{{ locale.loading }}</span>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 邮箱绑定 -->
      <div v-if="smtpEnabled" :class="cardClass">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 bg-zinc-950 rounded-lg border border-zinc-800">
            <Mail :size="16" class="text-zinc-400" />
          </div>
          <h3 class="text-sm font-bold text-zinc-200">{{ locale.emailNotifyTitle }}</h3>
        </div>

        <div class="space-y-4">
          <div v-if="userEmail" class="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl">
            <div class="flex items-center justify-between">
              <div>
                <p
                  class="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1"
                >
                  {{ locale.currentEmail }}
                </p>
                <p class="text-sm font-medium text-zinc-200">{{ userEmail }}</p>
              </div>
              <div
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                  emailVerified
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                ]"
              >
                {{ emailVerified ? locale.verified : locale.pendingVerify }}
              </div>
            </div>
          </div>

          <!-- 未绑定状态 -->
          <div v-if="!userEmail" class="space-y-3">
            <p class="text-xs text-zinc-500">{{ locale.emailUnboundDesc }}</p>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="newEmail"
                :disabled="bindingEmail"
                type="email"
                :placeholder="locale.emailPlaceholder"
                class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/30 w-full sm:w-auto"
              >
              <button
                :disabled="!newEmail || bindingEmail"
                class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                @click="bindEmail"
              >
                {{ bindingEmail ? locale.pleaseWait : locale.bindNow }}
              </button>
            </div>
          </div>

          <!-- 待验证状态 -->
          <div v-else-if="!emailVerified" class="space-y-4 pt-2">
            <div
              class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3"
            >
              <AlertCircle :size="14" class="text-blue-500 shrink-0 mt-0.5" />
              <p class="text-[11px] text-zinc-500 leading-relaxed">
                {{ locale.emailCodeSentTip }}
              </p>
            </div>

            <div class="space-y-3">
              <input
                v-model="emailCode"
                type="text"
                maxlength="6"
                :placeholder="locale.emailCodePlaceholder"
                :class="[
                  'w-full bg-zinc-950 border rounded-xl px-4 py-3 text-lg font-black tracking-[0.5em] text-center focus:outline-none transition-all',
                  emailCodeError
                    ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                    : 'border-zinc-800 focus:border-blue-500/30'
                ]"
                @input="handleEmailCodeInput"
                @keydown="handleEmailCodeKeydown"
              >
              <div class="grid grid-cols-2 gap-2">
                <button
                  :disabled="bindingEmail || emailCode.length !== 6"
                  class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
                  @click="verifyEmailCode"
                >
                  {{ bindingEmail ? locale.verifying : locale.confirmVerify }}
                </button>
                <button
                  :disabled="resendingEmail"
                  class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  @click="resendVerificationEmail"
                >
                  {{ resendingEmail ? locale.sending : locale.resend }}
                </button>
              </div>
              <button
                class="w-full py-2 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all"
                @click="changeEmail"
              >
                {{ locale.changeEmailAddress }}
              </button>
            </div>
          </div>

          <!-- 已验证状态 -->
          <div v-else class="flex gap-2 pt-2">
            <button
              class="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="changeEmail"
            >
              {{ locale.changeEmail }}
            </button>
            <button
              :disabled="unbindingEmail"
              class="flex-1 py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all"
              @click="unbindEmail"
            >
              {{ unbindingEmail ? locale.unbinding : locale.unbindEmail }}
            </button>
          </div>
        </div>
      </div>

      <!-- MeoW 账号绑定 -->
      <div :class="[cardClass, 'border-blue-500/20 bg-blue-500/[0.02]']">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Smartphone :size="16" class="text-blue-500" />
            </div>
            <h3 class="text-sm font-bold text-zinc-200">{{ locale.meowPushTitle }}</h3>
          </div>
        </div>

        <div class="space-y-4">
          <div
            v-if="meowUserIdBound"
            class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"
          >
            <div class="flex items-center justify-between">
              <div>
                <p
                  class="text-[10px] text-blue-500/60 font-black uppercase tracking-widest mb-1"
                >
                  {{ locale.currentBoundId }}
                </p>
                <p class="text-sm font-black text-blue-500 tracking-tight">
                  {{ meowUserIdBound }}
                </p>
              </div>
              <div
                class="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider"
              >
                {{ locale.connected }}
              </div>
            </div>
          </div>

          <!-- 未绑定状态 -->
          <div v-if="!meowUserIdBound" class="space-y-3">
            <p class="text-xs text-zinc-500">
              {{ locale.meowDesc }}
            </p>

            <!-- 第一步：输入用户ID -->
            <div v-if="!verificationSent" class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="meowUserId"
                :disabled="binding"
                type="text"
                :placeholder="locale.meowIdPlaceholder"
                class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/30 w-full sm:w-auto"
              >
              <button
                :disabled="!meowUserId || binding"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20 whitespace-nowrap"
                @click="sendVerificationCode"
              >
                {{ binding ? locale.sending : locale.sendCode }}
              </button>
            </div>

            <!-- 第二步：输入验证码 -->
            <div v-else class="space-y-4">
              <div
                class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3"
              >
                <AlertCircle :size="14" class="text-blue-500 shrink-0 mt-0.5" />
                <p class="text-[11px] text-zinc-500 leading-relaxed">
                  {{ locale.meowCodeSentPrefix }}
                  <span class="font-bold text-zinc-200">{{ meowUserId }}</span
                  >{{ locale.meowCodeSentSuffix }}
                </p>
              </div>

              <div class="space-y-3">
                <input
                  v-model="verificationCode"
                  type="text"
                  maxlength="6"
                  :placeholder="locale.codePlaceholder"
                  :class="[
                    'w-full bg-zinc-950 border rounded-xl px-4 py-3 text-lg font-black tracking-[0.5em] text-center focus:outline-none transition-all',
                    verificationCodeError
                      ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                      : 'border-zinc-800 focus:border-blue-500/30'
                  ]"
                  @input="handleVerificationCodeInput"
                  @keydown="handleVerificationCodeKeydown"
                >
                <div class="grid grid-cols-2 gap-2">
                  <button
                    :disabled="binding || verificationCode.length !== 6"
                    class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
                    @click="verifyAndBind"
                  >
                    {{ binding ? locale.verifying : locale.confirmBind }}
                  </button>
                  <button
                    :disabled="binding"
                    class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    @click="cancelVerification"
                  >
                    {{ locale.cancel }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 已绑定状态 -->
          <div v-else class="pt-2">
            <button
              class="w-full py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all"
              @click="showUnbindConfirm"
            >
              {{ locale.unbindMeow }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :loading="confirmDialog.loading"
      :message="confirmDialog.message"
      :title="confirmDialog.title"
      :type="confirmDialog.type"
      @cancel="confirmDialog.onCancel"
      @confirm="confirmDialog.onConfirm"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, Loader2, Mail, Share2, Smartphone } from '@lucide/vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { smtpEnabled } = useSiteConfig()
const { showToast } = useToast()
const { pages } = useLocale()
const locale = computed(() => pages.value?.account?.social || {})

// 样式类常量
const sectionClass = 'bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl'
const cardClass =
  'bg-zinc-950/40 border border-zinc-800/50 rounded-2xl p-5 transition-all hover:border-zinc-700/50'

// 页面状态
const loading = ref(true)
const binding = ref(false)

// 已绑定的 MeoW 用户 ID
const meowUserIdBound = ref('')

// MeoW 绑定相关
const meowUserId = ref('')
const verificationSent = ref(false)
const verificationCode = ref('')
const verificationCodeError = ref(false)

// 邮箱绑定相关
const userEmail = ref('')
const emailVerified = ref(false)
const newEmail = ref('')
const bindingEmail = ref(false)
const resendingEmail = ref(false)
const unbindingEmail = ref(false)
const emailCode = ref('')
const emailCodeError = ref(false)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => {},
  onCancel: () => {}
})

onMounted(() => {
  loadBindings()
})

// 加载绑定状态
const loadBindings = async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/notifications/settings')

    if (response.success) {
      meowUserIdBound.value = response.data.meowUserId || ''
      userEmail.value = response.data.userEmail || ''
      emailVerified.value = response.data.emailVerified || false
    }
  } catch (err) {
    console.error(locale.value.loadFailedLog, err)
    showToast(locale.value.loadFailed, 'error')
  } finally {
    loading.value = false
  }
}

// 处理验证码输入
const handleVerificationCodeInput = (event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  verificationCode.value = value
  if (verificationCodeError.value) {
    verificationCodeError.value = false
  }
}

// 处理验证码输入键盘事件
const handleVerificationCodeKeydown = (event) => {
  if (event.key === 'Enter' && verificationCode.value.length === 6) {
    verifyAndBind()
  }
}

// 发送验证码
const sendVerificationCode = async () => {
  if (!meowUserId.value.trim()) {
    showToast(locale.value.meowIdRequired, 'error')
    return
  }

  try {
    binding.value = true
    const response = await $fetch('/api/meow/bind', {
      method: 'POST',
      body: {
        action: 'send_verification',
        meowId: meowUserId.value.trim()
      }
    })

    if (response.success) {
      verificationSent.value = true
      showToast(locale.value.meowCodeSent, 'success')
    } else {
      showToast(response.message || locale.value.sendCodeFailed, 'error')
    }
  } catch (err) {
    showToast(err.data?.message || locale.value.sendCodeFailed, 'error')
  } finally {
    binding.value = false
  }
}

// 验证并绑定
const verifyAndBind = async () => {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    showToast(locale.value.codeRequired, 'error')
    verificationCodeError.value = true
    return
  }

  try {
    binding.value = true
    const response = await $fetch('/api/meow/bind', {
      method: 'POST',
      body: {
        action: 'verify_and_bind',
        meowId: meowUserId.value.trim(),
        verificationCode: verificationCode.value
      }
    })

    if (response.success) {
      meowUserIdBound.value = meowUserId.value.trim()
      meowUserId.value = ''
      verificationCode.value = ''
      verificationSent.value = false
      showToast(locale.value.meowBindSuccess, 'success')
    } else {
      showToast(response.message || locale.value.verifyFailed, 'error')
      verificationCodeError.value = true
    }
  } catch (err) {
    showToast(err.data?.message || locale.value.verifyFailed, 'error')
    verificationCodeError.value = true
  } finally {
    binding.value = false
  }
}

// 取消验证
const cancelVerification = () => {
  verificationSent.value = false
  verificationCode.value = ''
  meowUserId.value = ''
}

// 显示解绑确认对话框
const showUnbindConfirm = () => {
  confirmDialog.value = {
    title: locale.value.unbindMeowTitle,
    message: locale.value.unbindMeowMessage,
    type: 'danger',
    loading: false,
    onConfirm: performUnbind,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

// 执行解绑操作
const performUnbind = async () => {
  try {
    confirmDialog.value.loading = true
    const response = await $fetch('/api/meow/unbind', { method: 'POST' })

    if (response.success) {
      meowUserIdBound.value = ''
      showToast(locale.value.meowUnbound, 'success')
      showConfirmDialog.value = false
    } else {
      showToast(response.message || locale.value.unbindFailed, 'error')
    }
  } catch (err) {
    showToast(err.data?.message || locale.value.unbindFailed, 'error')
  } finally {
    confirmDialog.value.loading = false
  }
}

// 邮箱绑定相关方法
const bindEmail = async () => {
  if (!newEmail.value) {
    showToast(locale.value.emailRequired, 'error')
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail.value)) {
    showToast(locale.value.emailInvalid, 'error')
    return
  }

  bindingEmail.value = true
  try {
    const response = await $fetch('/api/user/email/bind', {
      method: 'POST',
      body: { email: newEmail.value }
    })

    if (response.success) {
      userEmail.value = newEmail.value
      emailVerified.value = false
      newEmail.value = ''
      showToast(locale.value.emailCodeSent, 'success')
    } else {
      showToast(response.message || locale.value.bindFailed, 'error')
    }
  } catch (err) {
    showToast(err.data?.message || locale.value.bindFailed, 'error')
  } finally {
    bindingEmail.value = false
  }
}

const handleEmailCodeInput = (event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  emailCode.value = value
  if (emailCodeError.value) emailCodeError.value = false
}

const handleEmailCodeKeydown = (event) => {
  if (event.key === 'Enter' && emailCode.value.length === 6) verifyEmailCode()
}

const verifyEmailCode = async () => {
  if (emailCode.value.length !== 6) {
    emailCodeError.value = true
    showToast(locale.value.codeRequired, 'error')
    return
  }
  try {
    bindingEmail.value = true
    const response = await $fetch('/api/user/email/verify-code', {
      method: 'POST',
      body: { email: userEmail.value, code: emailCode.value }
    })
    if (response.success) {
      emailVerified.value = true
      emailCode.value = ''
      showToast(locale.value.emailVerifySuccess, 'success')
    } else {
      emailCodeError.value = true
      showToast(response.message || locale.value.verifyFailed, 'error')
    }
  } catch (err) {
    emailCodeError.value = true
    showToast(err.data?.message || locale.value.verifyFailed, 'error')
  } finally {
    bindingEmail.value = false
  }
}

const changeEmail = () => {
  confirmDialog.value = {
    title: locale.value.changeEmailTitle,
    message: locale.value.changeEmailMessage,
    type: 'warning',
    loading: false,
    onConfirm: performChangeEmail,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const performChangeEmail = () => {
  userEmail.value = ''
  emailVerified.value = false
  newEmail.value = ''
  emailCode.value = ''
  emailCodeError.value = false
  showConfirmDialog.value = false
  showToast(locale.value.emailCleared, 'info')
}

const resendVerificationEmail = async () => {
  try {
    resendingEmail.value = true
    const response = await $fetch('/api/user/email/resend-verification', { method: 'POST' })
    if (response.success) {
      emailCode.value = ''
      emailCodeError.value = false
      showToast(locale.value.emailCodeResent, 'success')
    } else {
      showToast(response.message || locale.value.sendFailed, 'error')
    }
  } catch (err) {
    showToast(err.data?.message || locale.value.sendFailed, 'error')
  } finally {
    resendingEmail.value = false
  }
}

const unbindEmail = async () => {
  confirmDialog.value = {
    title: locale.value.unbindEmailTitle,
    message: locale.value.unbindEmailMessage,
    type: 'warning',
    loading: false,
    onConfirm: performEmailUnbind,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const performEmailUnbind = async () => {
  try {
    confirmDialog.value.loading = true
    unbindingEmail.value = true
    const response = await $fetch('/api/user/email/unbind', { method: 'POST' })
    if (response.success) {
      userEmail.value = ''
      emailVerified.value = false
      showToast(locale.value.emailUnbound, 'success')
      showConfirmDialog.value = false
    } else {
      showToast(response.message || locale.value.unbindFailed, 'error')
    }
  } catch (err) {
    showToast(err.data?.message || locale.value.unbindFailed, 'error')
  } finally {
    confirmDialog.value.loading = false
    unbindingEmail.value = false
  }
}
</script>
