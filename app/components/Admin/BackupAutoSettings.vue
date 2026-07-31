<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <!-- 标题栏 -->
        <div class="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm px-8 py-6 border-b border-zinc-800 flex items-center justify-between rounded-t-3xl">
          <div>
            <h3 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h3>
            <p class="text-[11px] text-zinc-500 mt-0.5">{{ locale.subtitle }}</p>
          </div>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="$emit('close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="px-8 py-6 space-y-8">
          <!-- 状态概览 -->
          <section>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity class="w-3.5 h-3.5" />
              {{ locale.sections.status }}
            </h4>
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <p class="text-[10px] text-zinc-500 uppercase tracking-wider">{{ locale.status.lastBackup }}</p>
                <p class="text-sm font-bold text-zinc-300 mt-1">--</p>
              </div>
              <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <p class="text-[10px] text-zinc-500 uppercase tracking-wider">{{ locale.status.nextBackup }}</p>
                <p class="text-sm font-bold text-zinc-300 mt-1">--</p>
              </div>
              <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <p class="text-[10px] text-zinc-500 uppercase tracking-wider">{{ locale.status.storageStatus }}</p>
                <div class="flex items-center gap-1.5 mt-1">
                  <div class="w-2 h-2 rounded-full bg-zinc-600" />
                  <p class="text-sm font-bold text-zinc-500">{{ locale.status.unconfigured }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- S3 兼容存储配置 -->
          <section>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <HardDrive class="w-3.5 h-3.5" />
              {{ locale.sections.storage }}
            </h4>
            <div class="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
              <div class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
                <Info class="text-blue-500 shrink-0 mt-0.5 w-4 h-4" />
                <p class="text-[11px] text-zinc-400 leading-relaxed">
                  {{ locale.storage.s3Hint }}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.storage.endpoint }}</label>
                  <input
                    v-model="storageForm.endpoint"
                    type="text"
                    :placeholder="locale.storage.endpointPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
                  >
                </div>
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.storage.bucket }}</label>
                  <input
                    v-model="storageForm.bucket"
                    type="text"
                    :placeholder="locale.storage.bucketPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
                  >
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.storage.region }}</label>
                  <input
                    v-model="storageForm.region"
                    type="text"
                    :placeholder="locale.storage.regionPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
                  >
                </div>
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.storage.pathPrefix }}</label>
                  <input
                    v-model="storageForm.pathPrefix"
                    type="text"
                    :placeholder="locale.storage.pathPrefixPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
                  >
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.storage.accessKey }}</label>
                <div class="relative">
                  <input
                    v-model="storageForm.accessKey"
                    :type="showAccessKey ? 'text' : 'password'"
                    :placeholder="locale.storage.accessKeyPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
                  >
                  <button
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                    @click="showAccessKey = !showAccessKey"
                  >
                    <Eye v-if="!showAccessKey" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.storage.secretKey }}</label>
                <div class="relative">
                  <input
                    v-model="storageForm.secretKey"
                    :type="showSecretKey ? 'text' : 'password'"
                    :placeholder="locale.storage.secretKeyPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
                  >
                  <button
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                    @click="showSecretKey = !showSecretKey"
                  >
                    <Eye v-if="!showSecretKey" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest"
                  @click="testConnection"
                >
                  {{ locale.storage.testConnection }}
                </button>
                <button
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest"
                  @click="saveStorage"
                >
                  {{ locale.storage.save }}
                </button>
              </div>
            </div>
          </section>

          <!-- API 密钥集成说明 -->
          <section>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Key class="w-3.5 h-3.5" />
              {{ locale.sections.apiKey }}
            </h4>
            <div class="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div class="flex items-start gap-3">
                <Shield class="text-emerald-500 shrink-0 mt-0.5 w-4 h-4" />
                <div class="space-y-1">
                  <p class="text-xs font-bold text-zinc-200">{{ locale.apiKey.existingKeyTitle }}</p>
                  <p class="text-[11px] text-zinc-500 leading-relaxed">
                    {{ locale.apiKey.existingKeyDesc }}
                  </p>
                </div>
              </div>

              <div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.apiKey.requiredPermission }}</span>
                  <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 rounded">backup</span>
                </div>
                <p class="text-[11px] text-zinc-500 leading-relaxed">
                  {{ locale.apiKey.permissionHint }}
                </p>
              </div>

              <div class="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3">
                <AlertCircle class="text-amber-500 shrink-0 mt-0.5 w-4 h-4" />
                <p class="text-[11px] text-zinc-400 leading-relaxed">
                  {{ locale.apiKey.note }}
                </p>
              </div>
            </div>
          </section>

          <!-- 外部触发器 -->
          <section>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Webhook class="w-3.5 h-3.5" />
              {{ locale.sections.trigger }}
            </h4>
            <div class="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
              <p class="text-[11px] text-zinc-400 leading-relaxed">
                {{ locale.trigger.intro }}
              </p>

              <!-- 备份端点 URL -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.trigger.endpointUrl }}</label>
                <div class="flex gap-2">
                  <code class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-blue-400 font-mono break-all select-all">
                    {{ triggerEndpointUrl }}
                  </code>
                  <button
                    class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors"
                    @click="copyToClipboard(triggerEndpointUrl)"
                  >
                    <Copy class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- 触发方式选项卡 -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ locale.trigger.methods }}</label>
                <div class="flex gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                  <button
                    v-for="method in triggerMethods"
                    :key="method.id"
                    :class="[
                      'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all',
                      activeTriggerMethod === method.id
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    ]"
                    @click="activeTriggerMethod = method.id"
                  >
                    {{ method.label }}
                  </button>
                </div>
              </div>

              <!-- curl 命令 -->
              <div v-if="activeTriggerMethod === 'curl'" class="space-y-3">
                <div class="relative">
                  <pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto"><code>curl -X POST "{{ triggerEndpointUrl }}" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'</code></pre>
                  <button
                    class="absolute top-3 right-3 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors"
                    @click="copyCurlCommand"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
                <p class="text-[10px] text-zinc-600">{{ locale.trigger.curlHint }}</p>
              </div>

              <!-- cron-job.org -->
              <div v-if="activeTriggerMethod === 'cronjob'" class="space-y-3">
                <div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600">URL:</span>
                    <code class="text-blue-400 font-mono text-[10px] break-all">{{ triggerEndpointUrl }}</code>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600">Method:</span>
                    <span class="text-zinc-300 font-mono">POST</span>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600">Header:</span>
                    <code class="text-emerald-400 font-mono text-[10px]">Authorization: Bearer YOUR_API_KEY</code>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span class="text-zinc-600">Body:</span>
                    <code class="text-amber-400 font-mono text-[10px]">{"type": "full"}</code>
                  </div>
                </div>
                <a
                  href="https://cron-job.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
                >
                  {{ locale.trigger.cronjobLink }}
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>

              <!-- GitHub Actions -->
              <div v-if="activeTriggerMethod === 'github'" class="space-y-3">
                <div class="relative">
                  <pre v-pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto"><code>name: Auto Backup
on:
  schedule:
    - cron: '0 3 * * *'  # 每天凌晨3点
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
                  <button
                    class="absolute top-3 right-3 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors"
                    @click="copyGithubAction"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
                <p class="text-[10px] text-zinc-600">{{ locale.trigger.githubHint }}</p>
              </div>

              <!-- Linux cron -->
              <div v-if="activeTriggerMethod === 'cron'" class="space-y-3">
                <div class="relative">
                  <pre class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto"><code># 编辑 crontab
crontab -e

# 添加以下行（每天凌晨3点执行备份）
0 3 * * * curl -X POST "{{ triggerEndpointUrl }}" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'</code></pre>
                  <button
                    class="absolute top-3 right-3 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors"
                    @click="copyCronCommand"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
                <p class="text-[10px] text-zinc-600">{{ locale.trigger.cronHint }}</p>
              </div>
            </div>
          </section>

          <!-- 保留策略 -->
          <section>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock class="w-3.5 h-3.5" />
              {{ locale.sections.retention }}
            </h4>
            <div class="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div class="flex items-center justify-between">
                <div class="space-y-1">
                  <p class="text-xs font-bold text-zinc-200">{{ locale.retention.days }}</p>
                  <p class="text-[11px] text-zinc-500">{{ locale.retention.daysHint }}</p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    class="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center"
                    @click="retentionDays = Math.max(1, retentionDays - 1)"
                  >
                    <Minus class="w-4 h-4" />
                  </button>
                  <span class="text-lg font-black text-zinc-100 w-8 text-center">{{ retentionDays }}</span>
                  <button
                    class="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center"
                    @click="retentionDays = Math.min(365, retentionDays + 1)"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <div class="space-y-1">
                  <p class="text-xs font-bold text-zinc-200">{{ locale.retention.maxBackups }}</p>
                  <p class="text-[11px] text-zinc-500">{{ locale.retention.maxBackupsHint }}</p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    class="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center"
                    @click="maxBackups = Math.max(1, maxBackups - 1)"
                  >
                    <Minus class="w-4 h-4" />
                  </button>
                  <span class="text-lg font-black text-zinc-100 w-8 text-center">{{ maxBackups }}</span>
                  <button
                    class="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center"
                    @click="maxBackups = Math.min(999, maxBackups + 1)"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                class="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest"
              >
                {{ locale.retention.save }}
              </button>
            </div>
          </section>

          <!-- 云端备份历史 -->
          <section>
            <h4 class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Cloud class="w-3.5 h-3.5" />
              {{ locale.sections.history }}
            </h4>
            <div class="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
              <div class="p-6 text-center text-zinc-600">
                <Cloud class="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p class="text-xs font-medium">{{ locale.history.empty }}</p>
                <p class="text-[10px] text-zinc-700 mt-1">{{ locale.history.emptyHint }}</p>
              </div>
            </div>
          </section>
        </div>

        <!-- 底部操作栏 -->
        <div class="sticky bottom-0 bg-zinc-950/95 backdrop-blur-sm px-8 py-5 border-t border-zinc-800 rounded-b-3xl flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="$emit('close')"
          >
            {{ locale.cancel }}
          </button>
          <button
            class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest"
            @click="saveAll"
          >
            {{ locale.saveAll }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  X, Activity, HardDrive, Key, Shield, Copy, Webhook, Clock, Cloud,
  ExternalLink, Eye, EyeOff, Plus, Minus, Info, AlertCircle
} from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.databaseManager?.autoBackup || {})

// 存储表单
const storageForm = ref({
  endpoint: '',
  bucket: '',
  region: 'auto',
  pathPrefix: 'voicehub-backups/',
  accessKey: '',
  secretKey: ''
})

const showAccessKey = ref(false)
const showSecretKey = ref(false)

// 保留策略
const retentionDays = ref(30)
const maxBackups = ref(50)

// 触发器
const activeTriggerMethod = ref('curl')
const triggerMethods = computed(() => [
  { id: 'curl', label: locale.value?.trigger?.curlTab || 'cURL' },
  { id: 'cronjob', label: locale.value?.trigger?.cronjobTab || 'cron-job.org' },
  { id: 'github', label: locale.value?.trigger?.githubTab || 'GitHub Actions' },
  { id: 'cron', label: locale.value?.trigger?.cronTab || 'Linux Cron' }
])

// 构建触发端点 URL（基于当前页面域名）
const triggerEndpointUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/admin/backup/auto`
  }
  return 'https://your-domain.com/api/admin/backup/auto'
})

// 复制到剪贴板
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast(locale.value?.messages?.copied || '已复制到剪贴板', 'success')
  } catch {
    showToast(locale.value?.messages?.copyFailed || '复制失败', 'error')
  }
}

// 各触发方式的复制内容
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

// 测试 S3 连接
const testConnection = () => {
  showToast(locale.value?.messages?.testConnection || '正在测试连接...', 'info')
}

// 保存存储配置
const saveStorage = () => {
  showToast(locale.value?.messages?.storageSaved || '存储配置已保存', 'success')
}

// 保存全部
const saveAll = () => {
  showToast(locale.value?.messages?.allSaved || '全部配置已保存', 'success')
}
</script>