<template>
  <div class="space-y-6">
    <!-- 状态显示 -->
    <div class="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
      <div class="flex items-center gap-3">
        <div 
          class="p-2 rounded-lg"
          :class="isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'"
        >
          <ShieldCheck :size="20" />
        </div>
        <div>
          <h3 class="font-bold text-zinc-100">双重认证 (2FA)</h3>
          <p class="text-xs text-zinc-500">
            {{ isEnabled ? '您的账户已开启双重认证保护' : '未开启，建议开启以提升账户安全性' }}
          </p>
        </div>
      </div>
      
      <button
        v-if="!isEnabled"
        @click="startSetup"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors"
      >
        开启
      </button>
      <button
        v-else
        @click="confirmDisable"
        class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-sm font-bold rounded-lg transition-colors"
      >
        关闭
      </button>
    </div>

    <!-- 开启流程 -->
    <div v-if="showSetup" class="bg-zinc-950/30 rounded-xl border border-zinc-800 p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
      <div class="flex items-start justify-between">
        <div>
          <h4 class="font-bold text-zinc-100 mb-1">设置双重认证</h4>
          <p class="text-sm text-zinc-400">请使用 Google Authenticator 或其他验证器应用扫描下方二维码</p>
        </div>
        <button @click="cancelSetup" class="text-zinc-500 hover:text-zinc-300">
          <X :size="20" />
        </button>
      </div>

      <div class="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <!-- 二维码区域 -->
        <div class="flex-shrink-0 bg-white p-2 rounded-lg">
          <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="2FA QR Code" class="w-48 h-48" />
          <div v-else class="w-48 h-48 flex items-center justify-center bg-zinc-100 text-zinc-400">
            <Loader2 class="animate-spin" />
          </div>
        </div>

        <!-- 验证输入区域 -->
        <div class="flex-1 space-y-4 w-full">
          <div>
            <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              手动输入密钥
            </label>
            <div class="flex items-center gap-2">
              <code class="px-3 py-2 bg-zinc-900 rounded-lg text-zinc-300 font-mono text-sm border border-zinc-800 select-all">
                {{ secret }}
              </code>
              <button 
                @click="copySecret"
                class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                title="复制密钥"
              >
                <Copy :size="16" />
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              验证码
            </label>
            <div class="flex gap-2">
              <input
                v-model="verificationCode"
                type="text"
                placeholder="请输入6位验证码"
                maxlength="6"
                class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-center tracking-widest"
                @keyup.enter="enable2FA"
              />
              <button
                @click="enable2FA"
                :disabled="loading || verificationCode.length !== 6"
                class="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <Loader2 v-if="loading" class="animate-spin" :size="16" />
                <span>验证并开启</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UIConfirmDialog
      :show="showDisableConfirm"
      title="关闭双重认证"
      content="关闭后，您的账户将不再受到双重认证保护。为确保安全，请输入您的登录密码以确认。"
      confirm-text="验证并关闭"
      confirm-type="danger"
      :show-input="true"
      input-placeholder="请输入当前登录密码"
      input-type="password"
      @confirm="disable2FA"
      @cancel="showDisableConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, X, Copy, Loader2 } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  initialEnabled?: boolean
}>()

const isEnabled = ref(props.initialEnabled || false)
const showSetup = ref(false)
const showDisableConfirm = ref(false)
const loading = ref(false)
const qrCodeUrl = ref('')
const secret = ref('')
const verificationCode = ref('')
const { showToast } = useToast()

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
    const { data, error } = await useFetch('/api/user/2fa/generate', {
      method: 'POST'
    })

    if (error.value) throw error.value

    if (data.value) {
      qrCodeUrl.value = data.value.qrCode
      secret.value = data.value.secret
      showSetup.value = true
      verificationCode.value = ''
    }
  } catch (err: any) {
    showToast(err.data?.message || err.message || '获取验证码失败', 'error')
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
    showToast('密钥已复制', 'success')
  } catch (err) {
    showToast('复制失败', 'error')
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

    showToast('双重认证已开启', 'success')
    isEnabled.value = true
    cancelSetup()
  } catch (err: any) {
    showToast(err.data?.message || err.message || '验证失败', 'error')
  } finally {
    loading.value = false
  }
}

const confirmDisable = () => {
  showDisableConfirm.value = true
}

const disable2FA = async (password: string) => {
  if (!password) {
    showToast('请输入密码', 'warning')
    return
  }
  
  try {
    loading.value = true
    const { error } = await useFetch('/api/user/2fa/disable', {
      method: 'POST',
      body: { password }
    })

    if (error.value) throw error.value

    showToast('双重认证已关闭', 'success')
    isEnabled.value = false
    showDisableConfirm.value = false
  } catch (err: any) {
    showToast(err.data?.message || err.message || '关闭失败', 'error')
  } finally {
    loading.value = false
  }
}
</script>
