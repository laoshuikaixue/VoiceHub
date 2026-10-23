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
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="available && enabled"
          :disabled="loading || toggling"
          class="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border-secondary bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
          @click="showDisableDialog = true"
        >
          <Power :size="14" />
          {{ locale.disableAction }}
        </button>
        <button
          v-if="available && enabled && records.length > 0 && !currentRecord"
          :disabled="loading || collecting"
          class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-text-primary text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
          @click="collectCurrent"
        >
          <Plus :size="14" />
          {{ locale.collectCurrent }}
        </button>
      </div>
    </div>

    <!-- 管理员未开启该功能 -->
    <div
      v-if="!available"
      class="flex items-start gap-3 p-4 bg-warning-10 border border-warning-20 rounded-2xl"
    >
      <AlertCircle :size="16" class="text-warning shrink-0 mt-0.5" />
      <p class="text-xs text-text-tertiary leading-relaxed">{{ locale.disabledNotice }}</p>
    </div>

    <!-- 未开启：说明用途 + 开启入口 -->
    <div v-else-if="!enabled" class="space-y-4">
      <div class="flex items-start gap-3 p-4 bg-info-10 border border-info-20 rounded-2xl">
        <Info :size="16" class="text-info shrink-0 mt-0.5" />
        <div class="space-y-1">
          <p class="text-xs font-bold text-text-secondary">{{ locale.notEnabledTitle }}</p>
          <p class="text-xs text-text-tertiary leading-relaxed">{{ locale.notEnabledDesc }}</p>
        </div>
      </div>
      <button
        :disabled="loading || toggling"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
        @click="openEnableDialog"
      >
        <FingerprintPattern :size="14" />
        {{ locale.enableAction }}
      </button>
    </div>

    <div v-else-if="loading" class="flex items-center justify-center gap-2 py-8 text-xs text-text-tertiary">
      <Loader2 :size="16" class="animate-spin" />
      <span>{{ locale.loading }}</span>
    </div>

    <!-- 已开启但尚未采集任何数据 -->
    <div v-else-if="records.length === 0" class="py-6 flex flex-col items-center text-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-disabled">
        <FingerprintPattern :size="26" />
      </div>
      <p class="text-xs text-text-tertiary leading-relaxed max-w-md">{{ locale.emptyDesc }}</p>
      <button
        :disabled="collecting"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
        @click="collectCurrent"
      >
        <Plus :size="14" />
        {{ locale.collectCurrent }}
      </button>
    </div>

    <!-- 已采集的数据列表 -->
    <div v-else class="space-y-3">
      <div
        v-for="item in records"
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
              {{ deviceName(item) }} · {{ locale.collectedAt }} {{ formatDate(item.createdAt) }}
            </p>
            <p class="text-[11px] text-text-tertiary mt-0.5">
              {{ locale.lastUsed }} {{ item.lastUsedAt ? formatDate(item.lastUsedAt) : locale.neverUsed }}
              <span v-if="item.lastUsedIp"> · IP {{ item.lastUsedIp }}</span>
            </p>
          </div>
        </div>
        <button
          :disabled="deletingId === item.id"
          class="inline-flex items-center justify-center gap-2 shrink-0 px-3 py-2 border border-error-20 bg-error-10 hover:bg-error-15 text-error text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          @click="confirmDelete(item)"
        >
          <Trash2 :size="14" />
          {{ locale.delete }}
        </button>
      </div>
      <p class="text-[10px] text-text-tertiary leading-relaxed px-1">{{ locale.limitHint }}</p>
    </div>

    <!-- 开启对话框：显式告知将收集浏览器指纹 + 密码校验 -->
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

            <!-- 采集内容告知：必须让用户明确知道会收集什么 -->
            <div class="p-3.5 rounded-xl bg-warning-10 border border-warning-20 space-y-2">
              <div class="flex items-start gap-2">
                <AlertTriangle :size="15" class="text-warning shrink-0 mt-0.5" />
                <p class="text-xs font-bold text-text-secondary">{{ locale.enableDialog.consentTitle }}</p>
              </div>
              <ul class="text-[11px] text-text-tertiary leading-relaxed space-y-1 pl-6 list-disc">
                <li v-for="(item, index) in locale.enableDialog.collectItems" :key="index">{{ item }}</li>
              </ul>
            </div>

            <div class="space-y-4">
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
              <!-- 显式勾选确认 -->
              <label class="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  v-model="consentChecked"
                  type="checkbox"
                  class="mt-0.5 w-4 h-4 accent-[var(--primary)] shrink-0"
                >
                <span class="text-xs text-text-secondary leading-relaxed">{{ locale.enableDialog.consentLabel }}</span>
              </label>
              <p v-if="dialogError" class="text-xs text-error font-bold">{{ dialogError }}</p>
            </div>

            <div class="flex gap-3">
              <button
                class="flex-1 px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-all"
                :disabled="toggling"
                @click="closeEnableDialog"
              >
                {{ locale.cancel }}
              </button>
              <button
                class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
                :disabled="toggling || !passwordInput || !consentChecked"
                @click="submitEnable"
              >
                <Loader2 v-if="toggling" :size="14" class="animate-spin inline mr-1" />
                {{ locale.enableDialog.confirm }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 关闭确认 -->
    <ConfirmDialog
      v-model:show="showDisableDialog"
      type="danger"
      :title="locale.disableDialogTitle"
      :message="locale.disableMessage"
      :loading="toggling"
      :confirm-text="locale.disableAction"
      :cancel-text="locale.cancel"
      @confirm="submitDisable"
      @close="showDisableDialog = false"
    />

    <!-- 删除确认 -->
    <ConfirmDialog
      v-model:show="showDeleteDialog"
      type="danger"
      :title="locale.deleteDialogTitle"
      :message="deleteMessage"
      :loading="deleting"
      :confirm-text="locale.delete"
      :cancel-text="locale.cancel"
      @confirm="executeDelete"
      @close="showDeleteDialog = false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  AlertTriangle,
  FingerprintPattern,
  Info,
  Loader2,
  Monitor,
  Plus,
  Power,
  Trash2
} from '@lucide/vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { collectFingerprint } from '~/utils/fingerprint'
import { formatDateTime } from '~/utils/timeUtils'

const { showToast } = useToast()
const { pages } = useLocale()
const { localize: localizeServerError } = useServerErrors()
const locale = computed(() => pages.value?.account?.fingerprint || {})

const records = ref([])
const loading = ref(true)
const toggling = ref(false)
const collecting = ref(false)
const deleting = ref(false)
const deletingId = ref(null)
const pendingDelete = ref(null)
const showDeleteDialog = ref(false)
const showDisableDialog = ref(false)
const showEnableDialog = ref(false)
const passwordInput = ref('')
const consentChecked = ref(false)
const dialogError = ref('')
// 管理员总开关：关闭时全站不可采集
const available = ref(false)
// 用户自己的采集开关
const enabled = ref(false)
// 当前浏览器是否已在已采集列表中
const currentRecord = computed(() => records.value.some((item) => item.current))

const deviceName = (item) =>
  [item.browser, item.operatingSystem, item.device].filter(Boolean).join(' · ') || '-'

// 时间展示统一走 timeUtils 的北京时间格式化（timestamptz 序列化为带时区 ISO 串，可安全解析）
const formatDate = (value) => (value ? formatDateTime(new Date(value)) : '-')

const loadPreference = async () => {
  try {
    const result = await $fetch('/api/user/fingerprint/preference')
    available.value = result?.available === true
    enabled.value = result?.enabled === true
  } catch (error) {
    console.error('获取浏览器指纹数据设置失败:', error)
    available.value = false
    enabled.value = false
  }
}

const loadRecords = async () => {
  loading.value = true
  try {
    const { fingerprint } = await collectFingerprint()
    const query = fingerprint ? { fingerprint } : {}
    const data = await $fetch('/api/user/fingerprint/list', { query })
    records.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('获取浏览器指纹数据列表失败:', error)
    records.value = []
  } finally {
    loading.value = false
  }
}

const openEnableDialog = () => {
  passwordInput.value = ''
  consentChecked.value = false
  dialogError.value = ''
  showEnableDialog.value = true
}

const closeEnableDialog = () => {
  showEnableDialog.value = false
  dialogError.value = ''
}

const submitEnable = async () => {
  if (!passwordInput.value || !consentChecked.value || toggling.value) return
  toggling.value = true
  dialogError.value = ''
  try {
    await $fetch('/api/user/fingerprint/preference', {
      method: 'POST',
      body: { enabled: true, consent: true, password: passwordInput.value }
    })
    enabled.value = true
    showEnableDialog.value = false
    showToast(locale.value.enableSuccess, 'success')
    await loadRecords()
  } catch (error) {
    dialogError.value = localizeServerError(error, locale.value.enableFailed)
  } finally {
    toggling.value = false
  }
}

const submitDisable = async () => {
  if (toggling.value) return
  toggling.value = true
  try {
    await $fetch('/api/user/fingerprint/preference', {
      method: 'POST',
      body: { enabled: false }
    })
    enabled.value = false
    records.value = []
    showDisableDialog.value = false
    showToast(locale.value.disableSuccess, 'success')
  } catch (error) {
    showToast(localizeServerError(error, locale.value.disableFailed), 'error')
  } finally {
    toggling.value = false
  }
}

// 采集当前浏览器指纹并保存为用户数据项
const collectCurrent = async () => {
  if (collecting.value) return
  collecting.value = true
  try {
    const { fingerprint } = await collectFingerprint()
    if (!fingerprint) {
      showToast(locale.value.collectFailed, 'error')
      return
    }
    await $fetch('/api/user/fingerprint/enable', {
      method: 'POST',
      body: { fingerprint }
    })
    showToast(locale.value.collectSuccess, 'success')
    await loadRecords()
  } catch (error) {
    showToast(localizeServerError(error, locale.value.collectFailed), 'error')
  } finally {
    collecting.value = false
  }
}

const confirmDelete = (item) => {
  pendingDelete.value = item
  showDeleteDialog.value = true
}

const executeDelete = async () => {
  const item = pendingDelete.value
  if (!item) return
  deleting.value = true
  deletingId.value = item.id
  try {
    await $fetch(`/api/user/fingerprint/${item.id}`, { method: 'DELETE' })
    showToast(locale.value.deleteSuccess, 'success')
    await loadRecords()
  } catch (error) {
    showToast(localizeServerError(error, locale.value.deleteFailed), 'error')
  } finally {
    deleting.value = false
    deletingId.value = null
    pendingDelete.value = null
    showDeleteDialog.value = false
  }
}

const deleteMessage = computed(() => {
  const name = pendingDelete.value ? deviceName(pendingDelete.value) : ''
  return (locale.value.deleteMessage || '确定要删除该条浏览器指纹数据吗？').replace('{0}', name)
})

onMounted(async () => {
  await loadPreference()
  if (available.value && enabled.value) {
    await loadRecords()
  } else {
    loading.value = false
  }
})
</script>
