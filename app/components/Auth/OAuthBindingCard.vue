<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 :size="24" class="text-primary animate-spin mb-3" />
      <p class="text-text-tertiary text-xs font-medium">{{ locale.loading }}</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="provider in enabledProviders"
        :key="provider.key"
        :class="[itemClass, 'items-start']"
      >
        <div class="flex items-start gap-4 flex-1 min-w-0">
          <div
            class="w-10 h-10 rounded-xl bg-bg-primary flex items-center justify-center border border-border-secondary text-text-primary"
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
          <div class="flex flex-col flex-1 min-w-0">
            <span class="text-sm font-bold text-text-primary">{{
              provider.name || getProviderDisplayName(provider.key)
            }}</span>
            <span
              v-if="getIdentitiesByProvider(provider).length === 0"
              class="text-[11px] text-text-tertiary mt-0.5"
              >{{ locale.unbound }}</span
            >
            <div
              v-if="getIdentitiesByProvider(provider).length > 0"
              class="flex flex-col gap-2 mt-2"
            >
              <div
                v-for="identity in getIdentitiesByProvider(provider)"
                :key="identity.id"
                class="flex items-center gap-3 p-2.5 bg-bg-primary-20 border border-border-secondary rounded-xl"
              >
                <div
                  class="w-8 h-8 rounded-full bg-bg-primary border border-border-secondary overflow-hidden flex items-center justify-center text-xs font-bold text-text-secondary shrink-0"
                >
                  <img
                    v-if="identity.avatar && !failedAvatarIds.includes(identity.id)"
                    :src="identity.avatar"
                    :alt="identity.providerUsername || provider.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="markAvatarFailed(identity.id)"
                  >
                  <span v-else>{{
                    (identity.providerUsername || provider.name || '?').charAt(0)
                  }}</span>
                </div>
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-xs font-medium text-text-secondary truncate">{{
                    identity.providerUsername
                  }}</span>
                  <span
                    v-if="identity.isAvatarSource"
                    class="text-[10px] font-bold text-success bg-success-10 border border-success-20 px-2 py-0.5 rounded-full w-fit mt-1"
                    >{{ locale.currentAvatar }}</span
                  >
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    v-if="!identity.isAvatarSource"
                    class="px-2.5 py-1.5 bg-primary-hover hover:bg-primary text-text-primary text-[11px] font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    :disabled="avatarLoadingId === identity.id || actionLoading"
                    @click="setAsAvatar(identity)"
                  >
                    {{ avatarLoadingId === identity.id ? locale.processing : locale.setAsAvatar }}
                  </button>
                  <button
                    class="px-2.5 py-1.5 bg-error-10 border border-error-20 hover:bg-error-20 text-error text-[11px] font-bold rounded-lg transition-all disabled:opacity-50"
                    :disabled="actionLoading"
                    @click="confirmUnbind(provider, identity)"
                  >
                    {{ locale.unbind }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          v-if="getIdentitiesByProvider(provider).length === 0"
          class="px-4 py-1.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click="handleBind(provider)"
        >
          {{ actionLoading ? locale.redirecting : locale.bindNow }}
        </button>
      </div>

      <!-- WebAuthn / Passkey -->
      <div
        v-if="isWebAuthnSupported || webauthnIdentities.length > 0 || !isSecureContext"
        :class="[
          itemClass,
          webauthnIdentities.length > 0 ? 'cursor-pointer hover:bg-bg-secondary-70' : ''
        ]"
        @click="toggleWebAuthnList"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-xl bg-bg-primary flex items-center justify-center border border-border-secondary text-text-primary"
          >
            <Fingerprint :size="20" />
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-text-primary">Passkey</span>
              <ChevronDown
                v-if="webauthnIdentities.length > 0"
                :size="14"
                class="text-text-tertiary transition-transform duration-300"
                :class="{ 'rotate-180': isWebAuthnExpanded }"
              />
            </div>
            <span class="text-[11px] text-text-tertiary mt-0.5"
              >{{ locale.boundDevices }} {{ webauthnIdentities.length }} {{ locale.devices }}</span
            >
          </div>
        </div>

        <button
          v-if="isWebAuthnSupported"
          class="px-4 py-1.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50"
          :disabled="actionLoading"
          @click.stop="handleWebAuthnRegister"
        >
          {{ actionLoading ? locale.processing : locale.addDevice }}
        </button>
        <div
          v-else-if="!isSecureContext"
          class="flex items-center gap-1 text-warning bg-warning-10 px-3 py-1.5 rounded-lg border border-warning-20"
        >
          <AlertTriangle :size="12" />
          <span class="text-[10px] font-medium">{{ locale.httpsRequired }}</span>
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
              class="flex items-center justify-between p-3 bg-bg-primary-20 border border-border-secondary rounded-xl group/item"
            >
              <div class="flex flex-col flex-1 mr-4">
                <div v-if="editingId === cred.id" class="flex items-center gap-2 mb-1">
                  <input
                    v-model="editingName"
                    type="text"
                    class="bg-bg-secondary border border-border-tertiary rounded px-2 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary w-full"
                    :disabled="isRenaming"
                    @keyup.enter="saveEditing(cred.id)"
                    @keyup.esc="cancelEditing"
                    @click.stop
                    ref="editInput"
                  />
                </div>
                <div v-else class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-medium text-text-secondary">{{ cred.providerUsername }}</span>
                  <button
                    class="text-text-tertiary hover:text-text-secondary opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5"
                    @click.stop="startEditing(cred)"
                    :title="locale.rename"
                  >
                    <Pencil :size="12" />
                  </button>
                </div>

                <span class="text-[10px] text-text-disabled"
                  >{{ locale.addedAt }} {{ new Date(cred.createdAt).toLocaleString(currentLocale.value, {
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

              <div class="flex items-center gap-1">
                <template v-if="editingId === cred.id">
                  <button
                    class="text-text-tertiary hover:text-success transition-colors p-1"
                    :disabled="isRenaming"
                    @click.stop="saveEditing(cred.id)"
                    :title="locale.save"
                  >
                    <Check :size="14" />
                  </button>
                  <button
                    class="text-text-tertiary hover:text-text-primary transition-colors p-1"
                    :disabled="isRenaming"
                    @click.stop="cancelEditing"
                    :title="locale.cancel"
                  >
                    <X :size="14" />
                  </button>
                </template>
                <button
                  v-else
                  class="text-xs text-error hover:text-error font-medium px-2 py-1 opacity-0 group-hover/item:opacity-100 transition-opacity"
                  @click="confirmUnbindWebAuthn(cred)"
                >
                  {{ locale.remove }}
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
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { useAuth } from '~/composables/useAuth'

const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const { showToast } = useToast()
const { refreshUser } = useAuth()
const { localize: localizeServerError } = useServerErrors()
const { auth, currentLocale } = useLocale()
const locale = computed(() => auth.value?.oauthBindingCard || {})
const { t: callLocale } = useLocaleText(locale)
const identities = ref([])
const loading = ref(true)
const actionLoading = ref(false)
const avatarLoadingId = ref(null)
const failedAvatarIds = ref([])
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
    showToast(locale.value.nameRequired, 'error')
    return
  }

  if (editingName.value.trim().length > 50) {
    showToast(locale.value.nameTooLong, 'error')
    return
  }

  isRenaming.value = true
  try {
    await $fetch('/api/auth/webauthn/rename', {
      method: 'POST',
      body: { id, name: editingName.value }
    })
    showToast(locale.value.renameSuccess, 'success')
    await fetchIdentities()
    cancelEditing()
  } catch (e) {
    showToast(localizeServerError(e, locale.value.renameFailed), 'error')
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
  'flex items-center justify-between p-4 bg-bg-primary-30 border border-border-secondary rounded-2xl hover:bg-bg-secondary-50 transition-all group'

const aggregateIconClass = (loginType) => {
  const classes = {
    qq: 'text-[var(--oauth-qq)]',
    wx: 'text-[var(--oauth-wx)]',
    alipay: 'text-[var(--oauth-alipay)]',
    sina: 'text-[var(--oauth-sina)]',
    baidu: 'text-[var(--oauth-baidu)]',
    douyin: 'text-[var(--oauth-douyin)]',
    huawei: 'text-[var(--oauth-huawei)]',
    xiaomi: 'text-[var(--oauth-xiaomi)]',
    gitee: 'text-[var(--oauth-gitee)]',
    gitea: 'text-text-primary [--gitea-cutout:var(--panel-bg-dialog)]',
    bilibili: 'text-[var(--oauth-bilibili)]',
    kuaishou: 'text-[var(--oauth-kuaishou)]'
  }
  return classes[loginType] || 'text-text-primary'
}

const enabledProviders = computed(() => oauthProviders.value || [])

const getProviderName = (provider) => {
  const matched = enabledProviders.value.find((item) => item.key === provider)
  return matched?.name || getProviderDisplayName(provider)
}

const getIdentitiesByProvider = (provider) =>
  identities.value.filter((item) => item.provider === provider.key)

const markAvatarFailed = (id) => {
  if (!failedAvatarIds.value.includes(id)) {
    failedAvatarIds.value.push(id)
  }
}

const setAsAvatar = async (identity) => {
  avatarLoadingId.value = identity.id
  try {
    await $fetch('/api/user/avatar', {
      method: 'POST',
      body: { identityId: identity.id }
    })
    showToast(locale.value.avatarSetSuccess, 'success')
    await Promise.all([fetchIdentities(), refreshUser()])
  } catch (e) {
    showToast(localizeServerError(e, locale.value.avatarSetFailed), 'error')
  } finally {
    avatarLoadingId.value = null
  }
}

const webauthnIdentities = computed(() => identities.value.filter((i) => i.provider === 'webauthn'))

const fetchIdentities = async () => {
  try {
    loading.value = true
    identities.value = await $fetch('/api/auth/identities')
    failedAvatarIds.value = []
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

const confirmUnbind = (provider, identity) => {
  const providerName = getProviderName(provider.key)

  confirmDialog.value = {
    title: locale.value.unbindTitle,
    message: callLocale('unbindMessage', '', providerName),
    type: 'danger',
    loading: false,
    onConfirm: () => handleUnbind(provider.key, identity.id),
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const confirmUnbindWebAuthn = (cred) => {
  confirmDialog.value = {
    title: locale.value.removePasskeyTitle,
    message: callLocale('removePasskeyMessage', '', cred.providerUsername),
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
    try {
      await refreshUser()
    } catch (e) {
      // 头像来源变化后的用户刷新失败不阻塞解绑流程
    }
    const deviceCleanupSucceeded = cleanupResults.length > 0 && cleanupResults.every(Boolean)
    if (provider === 'webauthn' && !deviceCleanupSucceeded) {
      showToast(locale.value.passkeyCleanupRequired, 'warning', 6000)
    } else {
      showToast(locale.value.unbindSuccess, 'success')
    }
    showConfirmDialog.value = false
  } catch (e) {
    showToast(localizeServerError(e, locale.value.unbindFailed), 'error')
  } finally {
    actionLoading.value = false
    confirmDialog.value.loading = false
  }
}

const handleWebAuthnRegister = async () => {
  if (!isWebAuthnSupported.value) {
    showToast(locale.value.browserNotSupported, 'error')
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
    showToast(locale.value.addDeviceSuccess, 'success')
    await fetchIdentities()
  } catch (e) {
    console.error('WebAuthn 注册错误:', e)
    const message = getWebAuthnErrorMessage(e, locale.value, locale.value.addDeviceFailed)
    showToast(message, 'error')
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
