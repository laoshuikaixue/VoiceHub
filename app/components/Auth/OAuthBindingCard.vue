<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 :size="24" class="text-blue-500 animate-spin mb-3" />
      <p class="text-zinc-500 text-xs font-medium">加载绑定状态...</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="provider in enabledProviders" :key="provider.key" :class="itemClass">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100"
          >
            <AuthProvidersGitHubIcon v-if="provider.key === 'github'" class="w-5 h-5" />
            <AuthProvidersCasdoorIcon v-else-if="provider.key === 'casdoor'" class="w-5 h-5" />
            <AuthProvidersGoogleIcon v-else-if="provider.key === 'google'" class="w-5 h-5" />
            <Icon
              v-else-if="provider.routeProvider === 'aggregate'"
              :name="getAggregateOAuthLoginTypeIcon(provider.loginType)"
              :size="23"
              :class="aggregateIconClass(provider.loginType)"
            />
            <Shield v-else :size="20" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{
              provider.name || getProviderDisplayName(provider.key)
            }}</span>
            <span
              v-if="getIdentityByProvider(provider.key)"
              class="text-[11px] text-blue-500 font-medium mt-0.5"
              >{{ getIdentityByProvider(provider.key).providerUsername }}</span
            >
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>

        <button
          v-if="getIdentityByProvider(provider.key)"
          class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
          :disabled="actionLoading"
          @click="confirmUnbind(provider.key)"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
          v-else
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click="handleBind(provider)"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>

      <!-- WebAuthn / Passkey -->
      <div
        v-if="isWebAuthnSupported || webauthnIdentities.length > 0 || !isSecureContext"
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
              <span class="text-sm font-bold text-zinc-200">Passkey</span>
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
        <div
          v-else-if="!isSecureContext"
          class="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20"
        >
          <AlertTriangle :size="12" />
          <span class="text-[10px] font-medium">需要 HTTPS 环境</span>
        </div>
      </div>

      <!-- WebAuthn 设备列表 -->
      <Transition name="expand">
        <div
          v-if="isWebAuthnExpanded && webauthnIdentities.length > 0"
          class="pl-16 -mt-2 overflow-hidden"
        >
          <div class="space-y-2 pt-2">
            <div
              v-for="cred in webauthnIdentities"
              :key="cred.id"
              class="flex items-center justify-between p-3 bg-zinc-950/20 border border-zinc-900 rounded-xl group/item"
            >
              <div class="flex flex-col flex-1 mr-4">
                <div v-if="editingId === cred.id" class="flex items-center gap-2 mb-1">
                  <input
                    v-model="editingName"
                    type="text"
                    class="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 w-full"
                    :disabled="isRenaming"
                    @keyup.enter="saveEditing(cred.id)"
                    @keyup.esc="cancelEditing"
                    @click.stop
                    ref="editInput"
                  />
                </div>
                <div v-else class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-medium text-zinc-300">{{ cred.providerUsername }}</span>
                  <button
                    class="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5"
                    @click.stop="startEditing(cred)"
                    title="重命名"
                  >
                    <Pencil :size="12" />
                  </button>
                </div>

                <span class="text-[10px] text-zinc-600"
                  >添加于
                  {{
                    new Date(cred.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    })
                  }}</span
                >
              </div>

              <div class="flex items-center gap-1">
                <template v-if="editingId === cred.id">
                  <button
                    class="text-zinc-400 hover:text-green-400 transition-colors p-1"
                    :disabled="isRenaming"
                    @click.stop="saveEditing(cred.id)"
                    title="保存"
                  >
                    <Check :size="14" />
                  </button>
                  <button
                    class="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                    :disabled="isRenaming"
                    @click.stop="cancelEditing"
                    title="取消"
                  >
                    <X :size="14" />
                  </button>
                </template>
                <button
                  v-else
                  class="text-xs text-rose-500 hover:text-rose-400 font-medium px-2 py-1 opacity-0 group-hover/item:opacity-100 transition-opacity"
                  @click="confirmUnbindWebAuthn(cred)"
                >
                  移除
                </button>
              </div>
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

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import {
  Loader2,
  Shield,
  Fingerprint,
  ChevronDown,
  Pencil,
  Check,
  X,
  AlertTriangle
} from '@lucide/vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import Icon from '~/components/UI/Icon.vue'
import { useToast } from '~/composables/useToast'
import { getAggregateOAuthLoginTypeIcon, getProviderDisplayName } from '~/utils/oauth'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import {
  getWebAuthnErrorMessage,
  signalUnknownWebAuthnCredential,
  startWebAuthnRegistration
} from '~/utils/webauthn'

const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const { showToast } = useToast()
const identities = ref([])
const loading = ref(true)
const actionLoading = ref(false)
const isWebAuthnSupported = ref(false)
const isSecureContext = ref(true)

// 编辑相关
const editingId = ref(null)
const editingName = ref('')
const isRenaming = ref(false)
const editInput = ref(null)

const startEditing = async (cred) => {
  editingId.value = cred.id
  editingName.value = cred.providerUsername
  // 聚焦输入框
  await nextTick()
  if (editInput.value) {
    editInput.value?.focus()
  }
}

const cancelEditing = () => {
  editingId.value = null
  editingName.value = ''
}

const saveEditing = async (id) => {
  if (!editingName.value.trim()) {
    showToast('设备名称不能为空', 'error')
    return
  }

  if (editingName.value.trim().length > 50) {
    showToast('设备名称过长 (最大50个字符)', 'error')
    return
  }

  isRenaming.value = true
  try {
    await $fetch('/api/auth/webauthn/rename', {
      method: 'POST',
      body: { id, name: editingName.value }
    })
    showToast('设备名称修改成功', 'success')
    await fetchIdentities()
    cancelEditing()
  } catch (e) {
    showToast(e.data?.message || '修改失败', 'error')
  } finally {
    isRenaming.value = false
  }
}

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

const aggregateIconClass = (loginType) => {
  const classes = {
    qq: 'text-[#12b7f5]',
    wx: 'text-[#07c160]',
    alipay: 'text-[#1677ff]',
    sina: 'text-[#e6162d]',
    baidu: 'text-[#2932e1]',
    douyin: 'text-[#25f4ee]',
    huawei: 'text-[#cf0a2c]',
    xiaomi: 'text-[#ff6900]',
    gitee: 'text-[#c71d23]',
    gitea: 'text-zinc-100',
    bilibili: 'text-[#00a1d6]',
    kuaishou: 'text-[#ff4906]'
  }
  return classes[loginType] || 'text-zinc-100'
}

const enabledProviders = computed(() => oauthProviders.value || [])

const getProviderName = (provider) => {
  const matched = enabledProviders.value.find((item) => item.key === provider)
  return matched?.name || getProviderDisplayName(provider)
}

const getIdentityByProvider = (provider) =>
  identities.value.find((item) => item.provider === provider)

const webauthnIdentities = computed(() => identities.value.filter((i) => i.provider === 'webauthn'))

const fetchIdentities = async () => {
  try {
    loading.value = true
    identities.value = await $fetch('/api/auth/identities')
  } catch (e) {
    console.error('获取绑定信息失败', e)
  } finally {
    loading.value = false
  }
}

const handleBind = (provider) => {
  actionLoading.value = true
  // 绑定也是通过 OAuth 流程，最终回调时会自动识别已登录状态并执行绑定
  const routeProvider = provider.routeProvider || provider.key
  const query = new URLSearchParams()
  if (provider.loginType) query.set('type', provider.loginType)
  const queryString = query.toString()
  navigateTo(`/api/auth/${routeProvider}${queryString ? `?${queryString}` : ''}`, {
    external: true
  })
}

const confirmUnbind = (provider) => {
  const providerName = getProviderName(provider)

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
    message: `确定要移除设备 "${cred.providerUsername}" 吗？VoiceHub 会尝试通知当前设备同步删除；若系统不支持，仍需在密码保险箱中手动删除。`,
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
    const result = await $fetch('/api/auth/unbind', {
      method: 'POST',
      body: { provider, id }
    })
    const cleanupResults = await Promise.all(
      (result.passkeyCleanup || []).map(signalUnknownWebAuthnCredential)
    )
    await fetchIdentities()
    const deviceCleanupSucceeded = cleanupResults.length > 0 && cleanupResults.every(Boolean)
    if (provider === 'webauthn' && !deviceCleanupSucceeded) {
      showToast('已从 VoiceHub 移除，请同时在设备密码保险箱中删除对应 Passkey', 'warning', 6000)
    } else {
      showToast('解除绑定成功', 'success')
    }
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
    showToast('您的浏览器不支持 Passkey', 'error')
    return
  }

  actionLoading.value = true
  try {
    const options = await $fetch('/api/auth/webauthn/register/options')
    const attResp = await startWebAuthnRegistration(options)

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
    showToast(getWebAuthnErrorMessage(e, '添加设备失败'), 'error')
  } finally {
    actionLoading.value = false
  }
}

onMounted(async () => {
  await refreshSiteConfig()
  fetchIdentities()

  isSecureContext.value = window.isSecureContext

  const isApiSupported = browserSupportsWebAuthn()
  let isPlatformAuthenticatorAvailable = false

  if (isApiSupported && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
    try {
      isPlatformAuthenticatorAvailable =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch (e) {
      console.warn('WebAuthn 平台认证器检查失败:', e)
    }
  }

  // 兼容外部安全密钥（如 YubiKey），即使没有内置平台认证器也允许尝试
  isWebAuthnSupported.value = isApiSupported
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
