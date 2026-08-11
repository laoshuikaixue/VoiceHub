<template>
  <div class="space-y-6">
    <!-- 状态显示 -->
    <div class="flex items-center justify-between p-4 bg-bg-primary-50 rounded-xl border border-border-secondary">
      <div class="flex items-center gap-3">
        <div 
          class="p-2 rounded-lg flex items-center justify-center"
          :class="isEnabled ? 'bg-success-10 text-success' : 'bg-bg-tertiary text-text-tertiary'"
        >
          <ShieldCheck :size="20" />
        </div>
        <div>
          <h3 class="font-bold text-text-primary">{{ locale.title }}</h3>
          <p class="text-xs text-text-tertiary">
            {{ isEnabled ? locale.enabledDesc : locale.disabledDesc }}
          </p>
        </div>
      </div>
      
      <button
        v-if="!isEnabled"
        @click="startSetup"
        class="px-4 py-2 bg-primary-hover hover:bg-primary text-text-primary text-sm font-bold rounded-lg transition-colors"
      >
        {{ locale.enable }}
      </button>
      <button
        v-else
        @click="confirmDisable"
        class="px-4 py-2 bg-error-10 hover:bg-error-20 text-error border border-error-20 text-sm font-bold rounded-lg transition-colors"
      >
        {{ locale.disable }}
      </button>
    </div>

    <!-- 开启流程 -->
    <div v-if="showSetup" class="bg-bg-primary-30 rounded-xl border border-border-secondary p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
      <div class="flex items-start justify-between">
        <div>
          <h4 class="font-bold text-text-primary mb-1">{{ locale.setupTitle }}</h4>
          <p class="text-sm text-text-tertiary">{{ locale.setupDesc }}</p>
        </div>
        <button @click="cancelSetup" class="text-text-tertiary hover:text-text-secondary">
          <X :size="20" />
        </button>
      </div>

      <div class="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <!-- 二维码区域 -->
        <div class="flex-shrink-0 bg-bg-secondary p-2 rounded-lg">
          <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="2FA QR Code" class="w-48 h-48" />
          <div v-else class="w-48 h-48 flex items-center justify-center bg-bg-secondary text-text-tertiary">
            <Loader2 class="animate-spin" />
          </div>
        </div>

        <!-- 验证输入区域 -->
        <div class="flex-1 space-y-4 w-full">
          <div>
            <label class="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">
              {{ locale.manualKey }}
            </label>
            <div class="flex items-center gap-2">
              <code class="px-3 py-2 bg-bg-secondary rounded-lg text-text-secondary font-mono text-sm border border-border-secondary select-all">
                {{ secret }}
              </code>
              <button 
                @click="copySecret"
                class="p-2 hover:bg-bg-tertiary rounded-lg text-text-tertiary transition-colors"
                :title="locale.copyKey"
              >
                <Copy :size="16" />
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">
              {{ locale.code }}
            </label>
            <div class="flex gap-2">
              <input
                v-model="verificationCode"
                type="text"
                :placeholder="locale.codePlaceholder"
                maxlength="6"
                class="flex-1 bg-bg-secondary border border-border-secondary rounded-lg px-4 py-2 text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-center tracking-widest"
                @keyup.enter="enable2FA"
              />
              <button
                @click="enable2FA"
                :disabled="loading || verificationCode.length !== 6"
                class="px-6 py-2 bg-primary-hover hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <Loader2 v-if="loading" class="animate-spin" :size="16" />
                <span>{{ locale.verifyAndEnable }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UIConfirmDialog
      :show="showDisableConfirm"
      :title="locale.disableTitle"
      :message="locale.disableContent"
      :confirm-text="locale.verifyAndDisable"
      type="danger"
      :show-input="true"
      :input-placeholder="locale.passwordPlaceholder"
      input-type="password"
      @confirm="disable2FA"
      @cancel="showDisableConfirm = false"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ShieldCheck, X, Copy, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  initialEnabled: {
    type: Boolean,
    default: false
  }
})

const isEnabled = ref(props.initialEnabled || false)
const showSetup = ref(false)
const showDisableConfirm = ref(false)
const loading = ref(false)
const qrCodeUrl = ref('')
const secret = ref('')
const verificationCode = ref('')
const { showToast } = useToast()
const { auth } = useLocale()
const locale = computed(() => auth.value?.twoFactorSetup || {})

// 获取当前状态（可选，如果父组件没传可以通过API获取，这里暂时假设父组件会传或者初始化为false，
// 实际生产中最好有一个 API check status，但为了简化，这里先依赖父组件或默认）
// 修正：我们应该在组件挂载时检查状态，但目前没有专门的 check status API，
// 通常这包含在 user profile 信息中。如果 user 对象里有 has2FA 字段最好。
// 假设父组件通过 prop 传入，或者我们添加一个 check API。
// 为了稳健，我们可以复用 generate 接口之前的逻辑，或者在 login 时返回的信息里带。
// 这里的实现先依赖 props，如果需要更精确，可以加一个 api。

const startSetup = async () => {
  try {
    loading.value = true
    const data = await $fetch('/api/user/2fa/generate', {
      method: 'POST'
    })

    if (data) {
      qrCodeUrl.value = data.qrCode
      secret.value = data.secret
      showSetup.value = true
      verificationCode.value = ''
    }
  } catch (err) {
    showToast(err.data?.message || err.message || locale.value.fetchFailed, 'error')
  } finally {
    loading.value = false
  }
}

const cancelSetup = () => {
  showSetup.value = false
  qrCodeUrl.value = ''
  secret.value = ''
  verificationCode.value = ''
}

const copySecret = async () => {
  try {
    await navigator.clipboard.writeText(secret.value)
    showToast(locale.value.copied, 'success')
  } catch (err) {
    showToast(locale.value.copyFailed, 'error')
  }
}

const enable2FA = async () => {
  if (verificationCode.value.length !== 6) return
  
  try {
    loading.value = true
    const { error } = await useFetch('/api/user/2fa/enable', {
      method: 'POST',
      body: {
        token: verificationCode.value,
        secret: secret.value
      }
    })

    if (error.value) throw error.value

    showToast(locale.value.enabled, 'success')
    isEnabled.value = true
    cancelSetup()
  } catch (err) {
    showToast(err.data?.message || err.message || locale.value.verifyFailed, 'error')
  } finally {
    loading.value = false
  }
}

const confirmDisable = () => {
  showDisableConfirm.value = true
}

const disable2FA = async (password) => {
  if (!password) {
    showToast(locale.value.passwordRequired, 'warning')
    return
  }
  
  try {
    loading.value = true
    const { error } = await useFetch('/api/user/2fa/disable', {
      method: 'POST',
      body: { password }
    })

    if (error.value) throw error.value

    showToast(locale.value.disabled, 'success')
    isEnabled.value = false
    showDisableConfirm.value = false
  } catch (err) {
    showToast(err.data?.message || err.message || locale.value.disableFailed, 'error')
  } finally {
    loading.value = false
  }
}
</script>
