<template>
  <div class="max-w-[1400px] mx-auto space-y-10 pb-20 px-2">
    <!-- 头部区域 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-zinc-500 mt-1">
          {{ locale.desc }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-2 px-6 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
          :disabled="reloading"
          @click="reloadSmtpConfig"
        >
          <RotateCw :size="14" :class="reloading ? 'animate-spin' : ''" />
          {{ reloading ? locale.reloading : locale.reload }}
        </button>
        <button
          class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          :disabled="saving"
          @click="saveConfig"
        >
          <Save :size="14" /> {{ saving ? locale.saving : locale.save }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
      <!-- 左侧栏：SMTP 设置与测试 -->
      <div class="xl:col-span-4 space-y-8">
        <!-- SMTP 核心设置 -->
        <section class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2"
            >
              <Server :size="16" class="text-blue-500" /> {{ locale.serviceConfig }}
            </h3>
            <button
              class="relative w-10 h-5 rounded-full transition-colors"
              :class="config.smtpEnabled ? 'bg-blue-600' : 'bg-zinc-800'"
              @click="config.smtpEnabled = !config.smtpEnabled"
            >
              <div
                class="absolute top-1 w-3 h-3 bg-white rounded-full transition-all"
                :class="config.smtpEnabled ? 'left-6' : 'left-1'"
              />
            </button>
          </div>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.smtpHost }}</label
              >
              <input
                v-model="config.smtpHost"
                type="text"
                placeholder="smtp.example.com"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              >
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.port }}</label
                >
                <input
                  v-model.number="config.smtpPort"
                  type="number"
                  placeholder="587"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.secure }}</label
                >
                <CustomSelect
                  :model-value="config.smtpSecure ? secureOptionLabels.ssl : secureOptionLabels.none"
                  :options="[secureOptionLabels.ssl, secureOptionLabels.none]"
                  class="w-full"
                  @update:model-value="(val) => (config.smtpSecure = val === secureOptionLabels.ssl)"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.username }}</label
              >
              <input
                v-model="config.smtpUsername"
                type="text"
                placeholder="your-email@example.com"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.fromEmail }}</label
              >
              <input
                v-model="config.smtpFromEmail"
                type="text"
                :placeholder="config.smtpUsername || 'your-email@example.com'"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              >
              <p class="text-[9px] text-zinc-500 px-1 italic">
                {{ locale.fromEmailHint }}
              </p>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.password }}</label
              >
              <input
                v-model="config.smtpPassword"
                type="password"
                placeholder="••••••••••••"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.fromName }}</label
              >
              <input
                v-model="config.smtpFromName"
                type="text"
                :placeholder="locale.defaultFromName"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              >
            </div>
          </div>
        </section>

        <!-- SMTP 测试模块 -->
        <section class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
          <h3
            class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2"
          >
            <Send :size="16" class="text-emerald-500" /> {{ locale.serviceTest }}
          </h3>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.testEmail }}</label
              >
              <div class="flex gap-2">
                <input
                  v-model="testEmail"
                  type="email"
                  :placeholder="locale.testEmailPlaceholder"
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  :disabled="testing || !testEmail || !config.smtpEnabled"
                  @click="sendTestEmail"
                >
                  <Check v-if="testResult?.success" :size="14" class="text-emerald-500" />
                  <Send v-else :size="14" />
                  {{ testing ? locale.sending : testResult?.success ? locale.sent : locale.send }}
                </button>
              </div>
            </div>

            <div v-if="testResult">
              <div
                class="flex items-center gap-2 p-3 rounded-xl text-xs"
                :class="
                  testResult.success
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                "
              >
                <CheckCircle v-if="testResult.success" :size="14" />
                <XCircle v-else :size="14" />
                <div class="flex flex-col gap-0.5">
                  <p class="font-bold">{{ testResult.message }}</p>
                  <p v-if="testResult.detail" class="text-[10px] opacity-80 break-all font-mono">
                    {{ testResult.detail }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 右侧栏：模板编辑器 -->
      <div class="xl:col-span-8">
        <EmailTemplateManager />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import EmailTemplateManager from '~/components/Admin/EmailTemplateManager.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { Server, Save, Check, Send, CheckCircle, XCircle, RotateCw } from '@lucide/vue'

const { showToast: showNotification } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.smtpManager || {})
const getLocaleMessage = (key) => locale.value?.[key] || ''
const getOptionText = (value, fallback) => {
  if (typeof value === 'function') return value() || fallback
  if (typeof value === 'string') return value || fallback
  return fallback
}
const secureOptionLabels = computed(() => ({
  ssl: getOptionText(locale.value?.secureOptions?.ssl, 'SSL/TLS'),
  none: getOptionText(locale.value?.secureOptions?.none, 'None')
}))

// 响应式数据
const config = ref({
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: getLocaleMessage('defaultFromName')
})

const testEmail = ref('')
const testing = ref(false)
const saving = ref(false)
const reloading = ref(false)
const testResult = ref(null)
const originalConfig = ref({})

// 将服务端返回的固定文案映射为当前语言，避免后端中文穿透到前端界面。
const getLocalizedServerMessage = (message) => {
  if (!message) {
    return ''
  }

  const serverMessages = locale.value?.serverMessages
  if (!serverMessages) return message

  const rawMessages = serverMessages.raw
  if (rawMessages) {
    const key = Object.keys(rawMessages).find((item) => rawMessages[item] === message)
    return key ? serverMessages[key] : message
  }

  const matchedEntry = Object.values(serverMessages).find((entry) => entry?.raw === message)
  return matchedEntry?.text || message
}

const localizeSmtpResult = (response) => ({
  ...response,
  message: getLocalizedServerMessage(response?.message) || response?.message
})

// 加载配置
const loadConfig = async () => {
  try {
    const response = await $fetch('/api/admin/system-settings')

    config.value = {
      smtpEnabled: response.smtpEnabled || false,
      smtpHost: response.smtpHost || '',
      smtpPort: response.smtpPort || 587,
      smtpSecure: response.smtpSecure || false,
      smtpUsername: response.smtpUsername || '',
      smtpPassword: response.smtpPassword || '',
      smtpFromEmail: response.smtpFromEmail || '',
      smtpFromName: response.smtpFromName || getLocaleMessage('defaultFromName')
    }

    // 保存原始配置用于重置
    originalConfig.value = { ...config.value }
  } catch (error) {
    console.error('加载SMTP配置失败:', error)
    showNotification(getLocaleMessage('loadFailed'), 'error')
  }
}

// 保存配置
const saveConfig = async () => {
  if (config.value.smtpEnabled) {
    // 验证必填字段
    if (!config.value.smtpHost || !config.value.smtpUsername || !config.value.smtpPassword) {
      showNotification(getLocaleMessage('incompleteConfig'), 'error')
      return
    }
  }

  saving.value = true
  try {
    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      body: config.value
    })

    originalConfig.value = { ...config.value }
    showNotification(getLocaleMessage('saveSuccess'), 'success')
  } catch (error) {
    console.error('保存SMTP配置失败:', error)
    showNotification(getLocalizedServerMessage(error.data?.message) || getLocaleMessage('saveFailed'), 'error')
  } finally {
    saving.value = false
  }
}

// 重置配置
const resetConfig = () => {
  config.value = { ...originalConfig.value }
  testResult.value = null
  showNotification(getLocaleMessage('resetSuccess'), 'info')
}

const reloadSmtpConfig = async () => {
  reloading.value = true
  try {
    const response = await $fetch('/api/admin/smtp/reload', {
      method: 'POST'
    })
    if (!response.success) {
      throw new Error(getLocalizedServerMessage(response.message) || getLocaleMessage('reloadFailed'))
    }
    showNotification(getLocalizedServerMessage(response.message) || getLocaleMessage('reloadSuccess'), 'success')
  } catch (error) {
    console.error('重载SMTP配置失败:', error)
    showNotification(
      getLocalizedServerMessage(error.data?.message || error.message) || getLocaleMessage('reloadFailed'),
      'error'
    )
  } finally {
    reloading.value = false
  }
}

// 测试连接
const testConnection = async () => {
  if (!config.value.smtpEnabled || !config.value.smtpHost) {
    showNotification(getLocaleMessage('serverRequired'), 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-connection', {
      method: 'POST',
      body: config.value
    })

    testResult.value = localizeSmtpResult(response)
  } catch (error) {
    console.error('测试连接失败:', error)
    testResult.value = {
      success: false,
      message:
        getLocalizedServerMessage(error.data?.message) || getLocaleMessage('testConnectionFailed')
    }
  } finally {
    testing.value = false
  }
}

// 发送测试邮件
const sendTestEmail = async () => {
  if (!testEmail.value) {
    showNotification(getLocaleMessage('testEmailRequired'), 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-email', {
      method: 'POST',
      body: {
        ...config.value,
        testEmail: testEmail.value
      }
    })

    testResult.value = localizeSmtpResult(response)
    if (response.success) {
      showNotification(getLocaleMessage('testEmailSuccess'), 'success')
      setTimeout(() => {
        testResult.value = null
      }, 5000)
    }
  } catch (error) {
    console.error('发送测试邮件失败:', error)
    testResult.value = {
      success: false,
      message: getLocalizedServerMessage(error.data?.message) || getLocaleMessage('testEmailFailed')
    }
  } finally {
    testing.value = false
  }
}

// 生命周期
onMounted(() => {
  loadConfig()
})
</script>

<style scoped></style>
