<template>
  <section class="bg-bg-secondary-40 border border-border-secondary rounded-3xl p-6 md:p-8 shadow-2xl">
    <!-- 头部 -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-secondary-50 pb-5 mb-6"
    >
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-primary-10 rounded-xl flex items-center justify-center">
          <FingerprintPattern :size="20" class="text-primary" />
        </div>
        <div>
          <h2 class="text-base font-black text-text-primary">{{ locale.title }}</h2>
          <p class="text-xs text-text-tertiary mt-0.5">{{ locale.desc }}</p>
        </div>
      </div>
      <button
        v-if="fingerprintLoginEnabled && bindings.length > 0 && !currentBound"
        :disabled="loading || enabling"
        class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-text-primary text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
        @click="openEnableDialog"
      >
        <Plus :size="14" />
        {{ locale.enableCurrent }}
      </button>
    </div>

    <!-- 管理员未开启功能 -->
    <div
      v-if="!fingerprintLoginEnabled"
      class="flex items-start gap-3 p-4 bg-warning-10 border border-warning-20 rounded-2xl"
    >
      <AlertCircle :size="16" class="text-warning shrink-0 mt-0.5" />
      <p class="text-xs text-text-tertiary leading-relaxed">{{ locale.disabledNotice }}</p>
    </div>

    <div v-else-if="loading" class="flex items-center justify-center gap-2 py-8 text-xs text-text-tertiary">
      <Loader2 :size="16" class="animate-spin" />
      <span>{{ locale.loading }}</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="bindings.length === 0" class="py-6 flex flex-col items-center text-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-disabled">
        <FingerprintPattern :size="26" />
      </div>
      <p class="text-xs text-text-tertiary leading-relaxed max-w-md">{{ locale.emptyDesc }}</p>
      <button
        :disabled="enabling"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
        @click="openEnableDialog"
      >
        <Plus :size="14" />
        {{ locale.enableCurrent }}
      </button>
    </div>

    <!-- 绑定列表 -->
    <div v-else class="space-y-3">
      <div
        v-for="item in bindings"
        :key="item.id"
        class="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border bg-bg-primary-45 p-4 transition-all"
        :class="item.current ? 'border-primary-30' : 'border-border-secondary-70'"
      >
        <div class="flex items-start gap-3 min-w-0">
          <div
            class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
            :class="item.current ? 'bg-primary-10 text-primary' : 'bg-bg-tertiary text-text-secondary'"
          >
            <Monitor :size="19" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-black text-text-primary truncate">{{ item.label || deviceName(item) }}</p>
              <span
                v-if="item.current"
                class="px-2 py-0.5 rounded-full bg-success-10 text-success text-[10px] font-bold shrink-0"
              >
                {{ locale.currentBrowser }}
              </span>
            </div>
            <p class="text-xs text-text-tertiary mt-1">
              {{ deviceName(item) }} · {{ locale.boundAt }} {{ formatDate(item.createdAt) }}
            </p>
            <p class="text-[11px] text-text-tertiary mt-0.5">
              {{ locale.lastUsed }} {{ item.lastUsedAt ? formatDate(item.lastUsedAt) : locale.neverUsed }}
              <span v-if="item.lastLoginIp"> · IP {{ item.lastLoginIp }}</span>
            </p>
          </div>
        </div>
        <button
          :disabled="deletingId === item.id"
          class="inline-flex items-center justify-center gap-2 shrink-0 px-3 py-2 border border-error-20 bg-error-10 hover:bg-error-15 text-error text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          @click="confirmUnbind(item)"
        >
          <Trash2 :size="14" />
          {{ locale.unbind }}
        </button>
      </div>
      <p class="text-[10px] text-text-tertiary leading-relaxed px-1">{{ locale.limitHint }}</p>
    </div>

    <!-- 启用对话框：需密码认证 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showEnableDialog"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
          @click.self="closeEnableDialog"
        >
          <div class="w-full max-w-md bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl p-6 space-y-5">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-primary-10 rounded-xl flex items-center justify-center">
                <FingerprintPattern :size="20" class="text-primary" />
              </div>
              <div>
                <h3 class="text-base font-black text-text-primary">{{ locale.enableDialog.title }}</h3>
                <p class="text-xs text-text-tertiary mt-0.5">{{ locale.enableDialog.desc }}</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.enableDialog.label }}</label>
                <input
                  v-model="labelInput"
                  type="text"
                  maxlength="50"
                  :placeholder="locale.enableDialog.labelPlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-30 transition-all"
                >
              </div>
              <div>
                <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.enableDialog.password }}</label>
                <input
                  v-model="passwordInput"
                  type="password"
                  autocomplete="current-password"
                  :placeholder="locale.enableDialog.passwordPlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-30 transition-all"
                  @keyup.enter="submitEnable"
                >
              </div>
              <p v-if="dialogError" class="text-xs text-error font-bold">{{ dialogError }}</p>
            </div>

            <div class="flex gap-3">
              <button
                class="flex-1 px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-all"
                :disabled="enabling"
                @click="closeEnableDialog"
              >
                {{ locale.cancel }}
              </button>
              <button
                class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
                :disabled="enabling || !passwordInput"
                @click="submitEnable"
              >
                <Loader2 v-if="enabling" :size="14" class="animate-spin inline mr-1" />
                {{ locale.enableDialog.confirm }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 解绑确认 -->
    <ConfirmDialog
      v-model:show="showUnbindDialog"
      type="danger"
      :title="locale.unbindDialogTitle"
      :message="unbindMessage"
      :loading="deleting"
      :confirm-text="locale.unbind"
      :cancel-text="locale.cancel"
      @confirm="executeUnbind"
      @close="showUnbindDialog = false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  FingerprintPattern,
  Loader2,
  Monitor,
  Plus,
  Trash2
} from '@lucide/vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { collectFingerprint } from '~/utils/fingerprint'
import { formatDateTime } from '~/utils/timeUtils'

const { fingerprintLoginEnabled } = useSiteConfig()
const { showToast } = useToast()
const { pages } = useLocale()
const { localize: localizeServerError } = useServerErrors()
const locale = computed(() => pages.value?.account?.fingerprint || {})

const bindings = ref([])
const loading = ref(true)
const enabling = ref(false)
const deleting = ref(false)
const deletingId = ref(null)
const pendingUnbind = ref(null)
const showUnbindDialog = ref(false)
const showEnableDialog = ref(false)
const labelInput = ref('')
const passwordInput = ref('')
const dialogError = ref('')
// 当前浏览器指纹的匹配项（服务端在列表中标记）
const currentBound = computed(() => bindings.value.some((item) => item.current))

const deviceName = (item) =>
  [item.browser, item.operatingSystem, item.device].filter(Boolean).join(' · ') || '-'

// 时间展示统一走 timeUtils 的北京时间格式化（timestamptz 序列化为带时区 ISO 串，可安全解析）
const formatDate = (value) => (value ? formatDateTime(new Date(value)) : '-')

const loadBindings = async () => {
  loading.value = true
  try {
    const { fingerprint } = await collectFingerprint()
    const query = fingerprint ? { fingerprint } : {}
    const data = await $fetch('/api/auth/fingerprint/list', { query })
    bindings.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('获取浏览器指纹绑定列表失败:', error)
    bindings.value = []
  } finally {
    loading.value = false
  }
}

const openEnableDialog = () => {
  labelInput.value = ''
  passwordInput.value = ''
  dialogError.value = ''
  showEnableDialog.value = true
}

const closeEnableDialog = () => {
  showEnableDialog.value = false
  dialogError.value = ''
}

const submitEnable = async () => {
  if (!passwordInput.value || enabling.value) return
  enabling.value = true
  dialogError.value = ''
  try {
    const { fingerprint } = await collectFingerprint()
    if (!fingerprint) {
      dialogError.value = locale.value.collectFailed || '浏览器指纹采集失败，请刷新页面后重试'
      return
    }
    await $fetch('/api/auth/fingerprint/enable', {
      method: 'POST',
      body: {
        fingerprint,
        password: passwordInput.value,
        label: labelInput.value.trim()
      }
    })
    showEnableDialog.value = false
    showToast(locale.value.enableSuccess, 'success')
    await loadBindings()
  } catch (error) {
    dialogError.value = localizeServerError(error, locale.value.enableFailed)
  } finally {
    enabling.value = false
  }
}

const confirmUnbind = (item) => {
  pendingUnbind.value = item
  showUnbindDialog.value = true
}

const executeUnbind = async () => {
  const item = pendingUnbind.value
  if (!item) return
  deleting.value = true
  deletingId.value = item.id
  try {
    await $fetch(`/api/auth/fingerprint/${item.id}`, { method: 'DELETE' })
    showToast(locale.value.unbindSuccess, 'success')
    await loadBindings()
  } catch (error) {
    showToast(localizeServerError(error, locale.value.unbindFailed), 'error')
  } finally {
    deleting.value = false
    deletingId.value = null
    pendingUnbind.value = null
    showUnbindDialog.value = false
  }
}

const unbindMessage = computed(() => {
  const name = pendingUnbind.value ? deviceName(pendingUnbind.value) : ''
  return (locale.value.unbindMessage || '确定要解绑该浏览器吗？').replace('{0}', name)
})

onMounted(() => {
  loadBindings()
})
</script>
