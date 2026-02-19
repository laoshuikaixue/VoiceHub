<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 :size="24" class="text-blue-500 animate-spin mb-3" />
      <p class="text-zinc-500 text-xs font-medium">加载绑定状态...</p>
    </div>

    <div v-else class="space-y-4">
      <!-- GitHub -->
      <div v-if="config.public.oauth.github" :class="itemClass">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100"
          >
            <AuthProvidersGitHubIcon class="w-5 h-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{
              getProviderDisplayName('github')
            }}</span>
            <span v-if="githubIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{
              githubIdentity.providerUsername
            }}</span>
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>

        <button
          v-if="githubIdentity"
          class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
          :disabled="actionLoading"
          @click="confirmUnbind('github')"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
          v-else
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click="handleBind('github')"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>

      <!-- Casdoor (如果启用) -->
      <div v-if="config.public.oauth.casdoor" :class="itemClass">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100"
          >
            <Shield :size="20" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{
              getProviderDisplayName('casdoor')
            }}</span>
            <span v-if="casdoorIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{
              casdoorIdentity.providerUsername
            }}</span>
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>

        <button
          v-if="casdoorIdentity"
          class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
          :disabled="actionLoading"
          @click="confirmUnbind('casdoor')"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
          v-else
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click="handleBind('casdoor')"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>

      <!-- Google (如果启用) -->
      <div v-if="config.public.oauth.google" :class="itemClass">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100"
          >
            <AuthProvidersGoogleIcon class="w-5 h-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{
              getProviderDisplayName('google')
            }}</span>
            <span v-if="googleIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{
              googleIdentity.providerUsername
            }}</span>
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>

        <button
          v-if="googleIdentity"
          class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
          :disabled="actionLoading"
          @click="confirmUnbind('google')"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
          v-else
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click="handleBind('google')"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>

      <!-- WebAuthn / Passkey -->
      <div 
        v-if="isWebAuthnSupported || webauthnIdentities.length > 0"
        :class="[
          itemClass, 
          webauthnIdentities.length > 0 ? 'cursor-pointer hover:bg-zinc-900/70' : ''
        ]" 
        @click="toggleWebAuthnList"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100"
          >
            <Fingerprint :size="20" />
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-zinc-200">Windows Hello / Passkey</span>
              <ChevronDown 
                v-if="webauthnIdentities.length > 0"
                :size="14" 
                class="text-zinc-500 transition-transform duration-300"
                :class="{ 'rotate-180': isWebAuthnExpanded }"
              />
            </div>
            <span class="text-[11px] text-zinc-500 mt-0.5"
              >已绑定 {{ webauthnIdentities.length }} 个设备</span
            >
          </div>
        </div>

        <button
          v-if="isWebAuthnSupported"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click.stop="handleWebAuthnRegister"
        >
          {{ actionLoading ? '处理中...' : '添加设备' }}
        </button>
      </div>

      <!-- WebAuthn 设备列表 -->
      <Transition name="expand">
        <div v-if="isWebAuthnExpanded && webauthnIdentities.length > 0" class="pl-16 -mt-2 overflow-hidden">
          <div class="space-y-2 pt-2">
            <div
              v-for="cred in webauthnIdentities"
              :key="cred.id"
              class="flex items-center justify-between p-3 bg-zinc-950/20 border border-zinc-900 rounded-xl group/item"
            >
              <div class="flex flex-col">
                <span class="text-xs font-medium text-zinc-300">{{ cred.providerUsername }}</span>
                <span class="text-[10px] text-zinc-600"
                  >添加于 {{ new Date(cred.createdAt).toLocaleString('zh-CN', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: false
                  }) }}</span
                >
              </div>
              <button
                class="text-xs text-rose-500 hover:text-rose-400 font-medium px-2 py-1 opacity-0 group-hover/item:opacity-100 transition-opacity"
                @click="confirmUnbindWebAuthn(cred)"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      </Transition>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Loader2, Shield, Fingerprint, ChevronDown } from 'lucide-vue-next'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useToast } from '~/composables/useToast'
import { getProviderDisplayName } from '~/utils/oauth'
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'

const config = useRuntimeConfig()
const { showToast } = useToast()
const identities = ref([])
const loading = ref(true)
const actionLoading = ref(false)
const isWebAuthnSupported = ref(false)

const isWebAuthnExpanded = ref(false)
const toggleWebAuthnList = () => {
  if (webauthnIdentities.value.length > 0) {
    isWebAuthnExpanded.value = !isWebAuthnExpanded.value
  }
}

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

// 样式类
const itemClass =
  'flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-2xl hover:bg-zinc-900/50 transition-all group'

const githubIdentity = computed(() => identities.value.find((i) => i.provider === 'github'))
const casdoorIdentity = computed(() => identities.value.find((i) => i.provider === 'casdoor'))
const googleIdentity = computed(() => identities.value.find((i) => i.provider === 'google'))
const webauthnIdentities = computed(() => identities.value.filter((i) => i.provider === 'webauthn'))

const fetchIdentities = async () => {
  try {
    loading.value = true
    identities.value = await $fetch('/api/auth/identities')
  } catch (e) {
    console.error('Failed to fetch identities', e)
  } finally {
    loading.value = false
  }
}

const handleBind = (provider) => {
  actionLoading.value = true
  // 绑定也是通过 OAuth 流程，最终回调时会自动识别已登录状态并执行绑定
  navigateTo(`/api/auth/${provider}`, { external: true })
}

const confirmUnbind = (provider) => {
  const providerName = getProviderDisplayName(provider)

  confirmDialog.value = {
    title: '解除绑定',
    message: `确定要解除 ${providerName} 账号的绑定吗？解除后您将无法使用该账号登录。`,
    type: 'danger',
    loading: false,
    onConfirm: () => handleUnbind(provider),
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const confirmUnbindWebAuthn = (cred) => {
  confirmDialog.value = {
    title: '移除 Passkey',
    message: `确定要移除设备 "${cred.providerUsername}" 吗？移除后将无法使用该设备登录。`,
    type: 'danger',
    loading: false,
    onConfirm: () => handleUnbind('webauthn', cred.id),
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const handleUnbind = async (provider, id = null) => {
  confirmDialog.value.loading = true
  actionLoading.value = true
  try {
    await $fetch('/api/auth/unbind', {
      method: 'POST',
      body: { provider, id }
    })
    await fetchIdentities()
    showToast('解除绑定成功', 'success')
    showConfirmDialog.value = false
  } catch (e) {
    showToast(e.data?.message || '解绑失败', 'error')
  } finally {
    actionLoading.value = false
    confirmDialog.value.loading = false
  }
}

const handleWebAuthnRegister = async () => {
  if (!isWebAuthnSupported.value) {
    showToast('您的浏览器不支持 Windows Hello / Passkey', 'error')
    return
  }

  actionLoading.value = true
  try {
    const options = await $fetch('/api/auth/webauthn/register/options')
    
    let attResp
    try {
      attResp = await startRegistration(options)
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        throw new Error('用户取消了操作')
      }
      throw e
    }

    // 提示用户输入设备名称（可选，这里先用默认的）
    // attResp.label = 'Windows Hello' 
    
    await $fetch('/api/auth/webauthn/register/verify', {
      method: 'POST',
      body: attResp
    })
    
    showToast('设备添加成功', 'success')
    await fetchIdentities()
  } catch (e) {
    console.error('WebAuthn 注册错误:', e)
    const apiError = e as { data?: { message?: string }; message?: string }
    const err = e as Error
    const message = apiError.data?.message || err.message || '添加设备失败'
    showToast(message, 'error')
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  isWebAuthnSupported.value = browserSupportsWebAuthn()
  fetchIdentities()
})
</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 500px;
  opacity: 1;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
