<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')" />
      <div class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
        <!-- 标题栏 -->
        <div class="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm px-6 py-5 border-b border-zinc-800 flex items-center justify-between rounded-t-3xl">
          <h3 class="text-lg font-black text-zinc-100 tracking-tight">{{ locale.title }}</h3>
          <button class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200" @click="$emit('close')">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="px-6 py-5 space-y-6">
          <!-- 总开关 -->
          <div class="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-5">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-bold text-zinc-200">{{ locale.masterSwitch.label }}</p>
                <p class="text-[11px] text-zinc-500 leading-relaxed">{{ locale.masterSwitch.desc }}</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="masterEnabled"
                :class="masterEnabled ? 'bg-blue-600' : 'bg-zinc-700'"
                class="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
                @click="masterEnabled = !masterEnabled"
              >
                <span :class="masterEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'" class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5" />
              </button>
            </div>
          </div>

          <!-- 备份方式 -->
          <div>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">{{ locale.methods.title }}</h4>
            <div class="space-y-3">
              <!-- S3 -->
              <MethodCard
                :enabled="masterEnabled && methods.s3.enabled"
                :master-off="!masterEnabled"
                :name="locale.methods.s3.name"
                :desc="locale.methods.s3.desc"
                @toggle="methods.s3.enabled = $event"
              >
                <template #icon><Cloud class="w-5 h-5" /></template>
                <div class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <InputField :label="locale.methods.s3.endpoint" :placeholder="locale.methods.s3.endpointPlaceholder" v-model="methods.s3.endpoint" />
                    <InputField :label="locale.methods.s3.bucket" :placeholder="locale.methods.s3.bucketPlaceholder" v-model="methods.s3.bucket" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <InputField :label="locale.methods.s3.region" :placeholder="locale.methods.s3.regionPlaceholder" v-model="methods.s3.region" />
                    <InputField :label="locale.methods.s3.pathPrefix" :placeholder="locale.methods.s3.pathPrefixPlaceholder" v-model="methods.s3.pathPrefix" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <InputField :label="locale.methods.s3.accessKey" :placeholder="locale.methods.s3.accessKeyPlaceholder" v-model="methods.s3.accessKey" />
                    <PasswordField :label="locale.methods.s3.secretKey" :placeholder="locale.methods.s3.secretKeyPlaceholder" v-model="methods.s3.secretKey" />
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="flex-1 py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                      :class="testing === 's3' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'"
                      :disabled="testing !== null"
                      @click="testConnection('s3')"
                    >
                      {{ testing === 's3' ? '测试中...' : locale.methods.s3.testConnection }}
                    </button>
                  </div>
                </div>
              </MethodCard>

              <!-- WebDAV -->
              <MethodCard
                :enabled="masterEnabled && methods.webdav.enabled"
                :master-off="!masterEnabled"
                :name="locale.methods.webdav.name"
                :desc="locale.methods.webdav.desc"
                @toggle="methods.webdav.enabled = $event"
              >
                <template #icon><FolderOpen class="w-5 h-5" /></template>
                <div class="space-y-3">
                  <InputField :label="locale.methods.webdav.url" :placeholder="locale.methods.webdav.urlPlaceholder" v-model="methods.webdav.url" />
                  <div class="grid grid-cols-2 gap-3">
                    <InputField :label="locale.methods.webdav.username" :placeholder="locale.methods.webdav.usernamePlaceholder" v-model="methods.webdav.username" />
                    <PasswordField :label="locale.methods.webdav.password" :placeholder="locale.methods.webdav.passwordPlaceholder" v-model="methods.webdav.password" />
                  </div>
                  <InputField :label="locale.methods.webdav.path" :placeholder="locale.methods.webdav.pathPlaceholder" v-model="methods.webdav.path" />
                  <button
                    class="w-full py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                    :class="testing === 'webdav' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'"
                    :disabled="testing !== null"
                    @click="testConnection('webdav')"
                  >
                    {{ testing === 'webdav' ? '测试中...' : locale.methods.webdav.testConnection }}
                  </button>
                </div>
              </MethodCard>

              <!-- Telegram -->
              <MethodCard
                :enabled="masterEnabled && methods.telegram.enabled"
                :master-off="!masterEnabled"
                :name="locale.methods.telegram.name"
                :desc="locale.methods.telegram.desc"
                @toggle="methods.telegram.enabled = $event"
              >
                <template #icon><Send class="w-5 h-5" /></template>
                <div class="space-y-3">
                  <PasswordField :label="locale.methods.telegram.botToken" :placeholder="locale.methods.telegram.botTokenPlaceholder" v-model="methods.telegram.botToken" />
                  <InputField :label="locale.methods.telegram.chatId" :placeholder="locale.methods.telegram.chatIdPlaceholder" v-model="methods.telegram.chatId" />
                  <button
                    class="w-full py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                    :class="testing === 'telegram' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'"
                    :disabled="testing !== null"
                    @click="testConnection('telegram')"
                  >
                    {{ testing === 'telegram' ? '发送中...' : locale.methods.telegram.testSend }}
                  </button>
                </div>
              </MethodCard>

              <!-- 邮件 -->
              <MethodCard
                :enabled="masterEnabled && methods.email.enabled"
                :master-off="!masterEnabled"
                :name="locale.methods.email.name"
                :desc="locale.methods.email.desc"
                @toggle="methods.email.enabled = $event"
              >
                <template #icon><Mail class="w-5 h-5" /></template>
                <div class="space-y-3">
                  <div class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-2.5">
                    <Info class="text-blue-500 shrink-0 mt-0.5 w-3.5 h-3.5" />
                    <p class="text-[11px] text-zinc-400 leading-relaxed">{{ locale.methods.email.smtpHint }}</p>
                  </div>
                  <InputField :label="locale.methods.email.recipient" :placeholder="locale.methods.email.recipientPlaceholder" v-model="methods.email.recipient" />
                  <button
                    class="w-full py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                    :class="testing === 'email' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'"
                    :disabled="testing !== null"
                    @click="testConnection('email')"
                  >
                    {{ testing === 'email' ? '发送中...' : locale.methods.email.testSend }}
                  </button>
                </div>
              </MethodCard>
            </div>
          </div>

          <!-- API 触发端点（可折叠） -->
          <CollapsibleSection :title="locale.endpoint.title">
            <div class="space-y-4">
              <!-- 提示 -->
              <div class="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2.5">
                <Info class="text-amber-500 shrink-0 mt-0.5 w-3.5 h-3.5" />
                <p class="text-[11px] text-zinc-400 leading-relaxed">{{ locale.endpoint.hint }}</p>
              </div>

              <!-- 端点 URL -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.endpoint.url }}</label>
                <div class="flex gap-2">
                  <code class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-blue-400 font-mono break-all select-all">
                    {{ triggerEndpointUrl }}
                  </code>
                  <button class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors shrink-0" @click="copyToClipboard(triggerEndpointUrl)">
                    <Copy class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- 触发方式选项卡 -->
              <div class="flex gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                <button
                  v-for="method in triggerMethods"
                  :key="method.id"
                  :class="['flex-1 py-2 text-[11px] font-bold rounded-lg transition-all', activeTriggerMethod === method.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300']"
                  @click="activeTriggerMethod = method.id"
                >
                  {{ method.label }}
                </button>
              </div>

              <!-- curl -->
              <div v-if="activeTriggerMethod === 'curl'" class="relative">
                <pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto"><code>curl -X POST "{{ triggerEndpointUrl }}" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'</code></pre>
                <button class="absolute top-3 right-3 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors" @click="copyCurlCommand">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- cron-job.org -->
              <div v-if="activeTriggerMethod === 'cronjob'">
                <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600 shrink-0">URL:</span>
                    <code class="text-blue-400 font-mono text-[10px] break-all">{{ triggerEndpointUrl }}</code>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600 shrink-0">Method:</span>
                    <span class="text-zinc-300 font-mono">POST</span>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600 shrink-0">Header:</span>
                    <code class="text-emerald-400 font-mono text-[10px]">X-API-Key: YOUR_API_KEY</code>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600 shrink-0"></span>
                    <code class="text-emerald-400 font-mono text-[10px]">Content-Type: application/json</code>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600 shrink-0">Body:</span>
                    <code class="text-amber-400 font-mono text-[10px]">{"type": "full"}</code>
                  </div>
                </div>
                <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors mt-2">
                  {{ locale.endpoint.cronjobLink }}
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>

              <!-- GitHub Actions -->
              <div v-if="activeTriggerMethod === 'github'" class="relative">
                <pre v-pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto"><code>name: Auto Backup
on:
  schedule:
    - cron: '0 3 * * *'
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Backup
        run: |
          curl -X POST "${{ secrets.BACKUP_URL }}" \
            -H "X-API-Key: ${{ secrets.API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"type": "full"}'</code></pre>
                <button class="absolute top-3 right-3 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors" @click="copyGithubAction">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Linux cron -->
              <div v-if="activeTriggerMethod === 'cron'" class="relative">
                <pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto"><code># 编辑 crontab
crontab -e

# 添加以下行（每天凌晨3点执行备份）
0 3 * * * curl -X POST "{{ triggerEndpointUrl }}" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'</code></pre>
                <button class="absolute top-3 right-3 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors" @click="copyCronCommand">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </CollapsibleSection>

          <!-- 备份历史（可折叠） -->
          <CollapsibleSection :title="locale.history.title">
            <div v-if="historyLoading" class="p-6 text-center text-zinc-600">
              <p class="text-xs">加载中...</p>
            </div>
            <div v-else-if="historyRecords.length === 0" class="p-6 text-center text-zinc-600">
              <Clock class="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p class="text-xs font-medium">{{ locale.history.empty }}</p>
              <p class="text-[10px] text-zinc-700 mt-1">{{ locale.history.emptyHint }}</p>
            </div>
            <div v-else class="space-y-2">
              <div v-for="record in historyRecords" :key="record.id" class="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span :class="getStatusInfo(record).cls" class="px-2 py-0.5 text-[10px] font-bold rounded-md border">
                      {{ getStatusInfo(record).text }}
                    </span>
                    <span class="text-[11px] text-zinc-400 font-mono">{{ record.filename }}</span>
                  </div>
                  <span class="text-[10px] text-zinc-600">{{ formatTime(record.createdAt) }}</span>
                </div>
                <div class="flex items-center gap-4 text-[10px] text-zinc-500">
                  <span>{{ record.totalRecords }} 条记录</span>
                  <span>{{ formatSize(record.backupSize) }}</span>
                  <span>{{ record.triggeredBy === 'api' ? 'API 触发' : record.triggeredBy || '未知' }}</span>
                </div>
                <div v-if="record.methods && record.methods.length" class="flex gap-2 mt-2">
                  <span v-for="m in record.methods" :key="m.method" :class="m.success ? 'text-emerald-500' : 'text-red-500'" class="text-[10px]">
                    {{ m.method }} {{ m.success ? '✓' : '✗' }}<span v-if="!m.success && m.error" class="text-zinc-500 ml-0.5">({{ formatMethodError(m.error) }})</span>
                  </span>
                </div>
              </div>
            </div>
            <div v-if="historyRecords.length > 0" class="flex justify-end pt-2">
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-red-400 bg-zinc-950/50 border border-zinc-800 hover:border-red-500/20 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="clearingHistory"
                @click="clearHistory"
              >
                <Trash2 class="w-3.5 h-3.5" />
                {{ clearingHistory ? '清空中...' : locale.history.clear || '清空历史' }}
              </button>
            </div>
          </CollapsibleSection>
        </div>

        <!-- 底部操作栏 -->
        <div class="sticky bottom-0 bg-zinc-950/95 backdrop-blur-sm px-6 py-4 border-t border-zinc-800 rounded-b-3xl flex gap-3 justify-end">
          <button class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest" @click="$emit('close')">
            {{ locale.cancel }}
          </button>
          <button class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed" :disabled="saving" @click="saveAll">
            {{ saving ? '保存中...' : locale.saveAll }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { X, Copy, ExternalLink, Clock, Info, Cloud, FolderOpen, Send, Mail, Trash2 } from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { useToast } from '~/composables/useToast'
import CollapsibleSection from '~/components/UI/Common/CollapsibleSection.vue'
import InputField from '~/components/UI/Common/InputField.vue'
import PasswordField from '~/components/UI/Common/PasswordField.vue'
import MethodCard from '~/components/UI/Common/MethodCard.vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['close'])

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.databaseManager?.autoBackup || {})

const saving = ref(false)
const loading = ref(false)
const testing = ref(null)
const configuredSecrets = ref({})
const historyLoading = ref(false)
const clearingHistory = ref(false)
const historyRecords = ref([])

// 总开关
const masterEnabled = ref(false)

// 各备份方式
const methods = reactive({
  s3: {
    enabled: false,
    endpoint: '',
    bucket: '',
    region: 'auto',
    pathPrefix: 'voicehub-backups/',
    accessKey: '',
    secretKey: ''
  },
  webdav: {
    enabled: false,
    url: '',
    username: '',
    password: '',
    path: 'voicehub-backups/'
  },
  telegram: {
    enabled: false,
    botToken: '',
    chatId: ''
  },
  email: {
    enabled: false,
    recipient: ''
  }
})

// 触发方式
const activeTriggerMethod = ref('curl')
const triggerMethods = computed(() => [
  { id: 'curl', label: locale.value?.endpoint?.curlTab || 'cURL' },
  { id: 'cronjob', label: locale.value?.endpoint?.cronjobTab || 'cron-job.org' },
  { id: 'github', label: locale.value?.endpoint?.githubTab || 'GitHub Actions' },
  { id: 'cron', label: locale.value?.endpoint?.cronTab || 'Linux Cron' }
])

const triggerEndpointUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/open/backup/auto`
  }
  return 'https://your-domain.com/api/open/backup/auto'
})

// 密钥哨兵值：已配置密钥时填入输入框，用户可选中后删除
const SECRET_SENTINEL = '••••••••••••••••'

// 加载已有配置
const loadConfig = async () => {
  loading.value = true
  try {
    const { data } = await $fetch('/api/admin/backup/auto-config')
    if (data) {
      masterEnabled.value = data.enabled
      if (data.config) {
        const cfg = data.config
        configuredSecrets.value = cfg.configuredSecrets || {}
        if (cfg.methods) {
          for (const key of ['s3', 'webdav', 'telegram', 'email']) {
            if (cfg.methods[key]) {
              Object.assign(methods[key], cfg.methods[key])
            }
          }
        }
        // 已配置的密钥填入哨兵值，用户可选中删除
        if (configuredSecrets.value.s3SecretKey) methods.s3.secretKey = SECRET_SENTINEL
        if (configuredSecrets.value.webdavPassword) methods.webdav.password = SECRET_SENTINEL
        if (configuredSecrets.value.telegramBotToken) methods.telegram.botToken = SECRET_SENTINEL
      }
    }
  } catch (err) {
    console.error('加载自动备份配置失败:', err)
  } finally {
    loading.value = false
  }
}

// 弹窗打开时加载配置
watch(() => props.visible, (val) => {
  if (val) {
    loadConfig()
    loadHistory()
  }
})

const formatTime = (d) => {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const getStatusInfo = (record) => {
  const methods = record.methods || []
  if (methods.length === 0) {
    return record.success
      ? { text: '成功', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
      : { text: '失败', cls: 'bg-red-500/10 text-red-400 border-red-500/20' }
  }
  const allSuccess = methods.every((m) => m.success)
  const allFailed = methods.every((m) => !m.success)
  if (allSuccess) return { text: '成功', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
  if (allFailed) return { text: '失败', cls: 'bg-red-500/10 text-red-400 border-red-500/20' }
  return { text: '部分成功', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
}

const formatMethodError = (err) => {
  if (!err) return ''
  const match = err.match(/(\d{3})/)
  return match ? match[1] : err.slice(0, 16)
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const { data } = await $fetch('/api/admin/backup/history')
    historyRecords.value = data || []
  } catch (err) {
    console.error('加载备份历史失败:', err)
  } finally {
    historyLoading.value = false
  }
}

const clearHistory = async () => {
  clearingHistory.value = true
  try {
    const result = await $fetch('/api/admin/backup/history-clear', { method: 'POST' })
    showToast(result.message || '备份历史已清空', 'success')
    historyRecords.value = []
  } catch (err) {
    showToast(err?.data?.message || '清空失败', 'error')
  } finally {
    clearingHistory.value = false
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast(locale.value?.messages?.copied || '已复制到剪贴板', 'success')
  } catch {
    showToast(locale.value?.messages?.copyFailed || '复制失败', 'error')
  }
}

const copyCurlCommand = () => {
  const url = triggerEndpointUrl.value
  copyToClipboard(`curl -X POST "${url}" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type": "full"}'`)
}

const copyGithubAction = () => {
  copyToClipboard(`name: Auto Backup\non:\n  schedule:\n    - cron: '0 3 * * *'\njobs:\n  backup:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Trigger Backup\n        run: |\n          curl -X POST "\${ secrets.BACKUP_URL }" \\\n            -H "X-API-Key: \${ secrets.API_KEY }" \\\n            -H "Content-Type: application/json" \\\n            -d '{"type": "full"}'`)
}

const copyCronCommand = () => {
  const url = triggerEndpointUrl.value
  copyToClipboard(`0 3 * * * curl -X POST "${url}" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type": "full"}'`)
}

const testConnection = async (type) => {
  if (testing.value) return
  const testLabels = {
    s3: locale.value?.methods?.s3?.testConnection || '测试连接',
    webdav: locale.value?.methods?.webdav?.testConnection || '测试连接',
    telegram: locale.value?.methods?.telegram?.testSend || '测试发送',
    email: locale.value?.methods?.email?.testSend || '测试发送'
  }
  testing.value = type
  try {
    const payload = { ...methods[type] }
    // 哨兵值不发送，由后端从已存储配置中获取真实密钥
    if (type === 's3' && payload.secretKey === SECRET_SENTINEL) delete payload.secretKey
    if (type === 'webdav' && payload.password === SECRET_SENTINEL) delete payload.password
    if (type === 'telegram' && payload.botToken === SECRET_SENTINEL) delete payload.botToken

    const result = await $fetch(`/api/admin/backup/test-${type}`, {
      method: 'POST',
      body: payload
    })
    if (result.success) {
      showToast(result.message || '测试成功', 'success')
    } else {
      showToast(result.message || '测试失败', 'error')
    }
  } catch (err) {
    showToast(err?.data?.message || err?.message || '测试失败', 'error')
  } finally {
    testing.value = null
  }
}

const saveAll = async () => {
  saving.value = true
  try {
    const config = {
      methods: {
        s3: { ...methods.s3 },
        webdav: { ...methods.webdav },
        telegram: { ...methods.telegram },
        email: { ...methods.email }
      }
    }
    // 空值或哨兵值不覆盖已有密钥
    for (const key of ['s3', 'webdav', 'telegram']) {
      const m = config.methods[key]
      if (key === 's3' && (!m.secretKey || m.secretKey === SECRET_SENTINEL)) delete m.secretKey
      if (key === 'webdav' && (!m.password || m.password === SECRET_SENTINEL)) delete m.password
      if (key === 'telegram' && (!m.botToken || m.botToken === SECRET_SENTINEL)) delete m.botToken
    }

    await $fetch('/api/admin/backup/auto-config', {
      method: 'PUT',
      body: { enabled: masterEnabled.value, config }
    })
    showToast(locale.value?.messages?.allSaved || '全部配置已保存', 'success')
  } catch (err) {
    showToast(err?.data?.message || err?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}
</script>