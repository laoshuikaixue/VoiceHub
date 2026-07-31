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
                <span :class="masterEnabled ? 'translate-x-5.5' : 'translate-x-0.5'" class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5" />
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
                    <button class="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest" @click="testConnection('s3')">
                      {{ locale.methods.s3.testConnection }}
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
                  <button class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest" @click="testConnection('webdav')">
                    {{ locale.methods.webdav.testConnection }}
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
                  <button class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest" @click="testConnection('telegram')">
                    {{ locale.methods.telegram.testSend }}
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
                  <button class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest" @click="testConnection('email')">
                    {{ locale.methods.email.testSend }}
                  </button>
                </div>
              </MethodCard>
            </div>
          </div>

          <!-- API 触发端点（可折叠） -->
          <CollapsibleSection :title="locale.endpoint.title">
            <div class="space-y-4">
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
  -H "Authorization: Bearer YOUR_API_KEY" \
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
                    <code class="text-emerald-400 font-mono text-[10px]">Authorization: Bearer YOUR_API_KEY</code>
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
            -H "Authorization: Bearer ${{ secrets.API_KEY }}" \
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
  -H "Authorization: Bearer YOUR_API_KEY" \
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
            <div class="p-6 text-center text-zinc-600">
              <Clock class="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p class="text-xs font-medium">{{ locale.history.empty }}</p>
              <p class="text-[10px] text-zinc-700 mt-1">{{ locale.history.emptyHint }}</p>
            </div>
          </CollapsibleSection>
        </div>

        <!-- 底部操作栏 -->
        <div class="sticky bottom-0 bg-zinc-950/95 backdrop-blur-sm px-6 py-4 border-t border-zinc-800 rounded-b-3xl flex gap-3 justify-end">
          <button class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest" @click="$emit('close')">
            {{ locale.cancel }}
          </button>
          <button class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest" @click="saveAll">
            {{ locale.saveAll }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { X, Copy, ExternalLink, Clock, Info, Cloud, FolderOpen, Send, Mail } from '@lucide/vue'
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
    return `${window.location.origin}/api/admin/backup/auto`
  }
  return 'https://your-domain.com/api/admin/backup/auto'
})

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
  copyToClipboard(`curl -X POST "${url}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type": "full"}'`)
}

const copyGithubAction = () => {
  copyToClipboard(`name: Auto Backup\non:\n  schedule:\n    - cron: '0 3 * * *'\njobs:\n  backup:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Trigger Backup\n        run: |\n          curl -X POST "\${ secrets.BACKUP_URL }" \\\n            -H "Authorization: Bearer \${ secrets.API_KEY }" \\\n            -H "Content-Type: application/json" \\\n            -d '{"type": "full"}'`)
}

const copyCronCommand = () => {
  const url = triggerEndpointUrl.value
  copyToClipboard(`0 3 * * * curl -X POST "${url}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type": "full"}'`)
}

const testConnection = (type) => {
  const labels = {
    s3: locale.value?.methods?.s3?.testConnection,
    webdav: locale.value?.methods?.webdav?.testConnection,
    telegram: locale.value?.methods?.telegram?.testSend,
    email: locale.value?.methods?.email?.testSend
  }
  showToast(labels[type] || '正在测试...', 'info')
}

const saveAll = () => {
  showToast(locale.value?.messages?.allSaved || '全部配置已保存', 'success')
}
</script>