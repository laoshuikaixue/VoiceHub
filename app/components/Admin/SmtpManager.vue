<template>
  <div
      class="max-w-[1400px] mx-auto space-y-10 pb-20 px-2"
  >
    <!-- Header Area -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">邮件服务配置</h2>
        <p class="text-xs text-zinc-500 mt-1">配置 SMTP 服务以发送系统验证码、投稿通知及其他重要提醒</p>
      </div>
      <div class="flex items-center gap-3">
        <button
            class="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
            @click="sendTestEmail"
            :disabled="testing || !testEmail || !config.smtpEnabled"
        >
          <Check v-if="testResult?.success" :size="14" class="text-emerald-500" />
          <Send v-else :size="14" />
          {{ testing ? '发送中...' : (testResult?.success ? "测试邮件已发送" : "发送测试邮件") }}
        </button>
        <button
            class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            @click="saveConfig"
            :disabled="saving"
        >
          <Save :size="14" /> {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">

      <!-- Left Column: SMTP Settings & Guides -->
      <div class="xl:col-span-4 space-y-8">

        <!-- SMTP Core Settings -->
        <section class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <Server :size="16" class="text-blue-500" /> 服务配置
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
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">SMTP 服务器</label>
              <input
                  v-model="config.smtpHost"
                  type="text"
                  placeholder="smtp.example.com"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">端口</label>
                <input
                    v-model.number="config.smtpPort"
                    type="number"
                    placeholder="587"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">加密方式</label>
                <CustomSelect
                    :model-value="config.smtpSecure ? 'SSL/TLS' : '无'"
                    :options="['SSL/TLS', '无']"
                    @update:model-value="val => config.smtpSecure = val === 'SSL/TLS'"
                    class="w-full"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">发件人账号</label>
              <input
                  v-model="config.smtpUsername"
                  type="text"
                  placeholder="your-email@example.com"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">授权码 / 密码</label>
              <input
                  v-model="config.smtpPassword"
                  type="password"
                  placeholder="••••••••••••"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">发件人姓名</label>
              <input
                  v-model="config.smtpFromName"
                  type="text"
                  placeholder="校园广播站"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">测试接收邮箱</label>
              <input
                  v-model="testEmail"
                  type="email"
                  placeholder="输入测试邮箱地址"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div v-if="testResult" class="mt-4">
              <div
                  class="flex items-center gap-2 p-3 rounded-xl text-xs"
                  :class="testResult.success ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'"
              >
                <CheckCircle v-if="testResult.success" :size="14" />
                <XCircle v-else :size="14" />
                {{ testResult.message }}
              </div>
            </div>
          </div>
        </section>

        <!-- Provider Guides -->
        <section class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-6 space-y-5">
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
            <HelpCircle :size="16" class="text-emerald-500" /> 配置指引
          </h3>
          <div class="space-y-3">
            <div
                v-for="(guide, i) in providerGuides"
                :key="i"
                class="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-2xl group hover:border-zinc-700 transition-all"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-zinc-200">{{ guide.name }}</span>
                <span class="text-[10px] font-black text-zinc-700 group-hover:text-blue-500 transition-colors uppercase tracking-widest">使用推荐</span>
              </div>
              <p class="text-[10px] text-zinc-500 leading-relaxed font-medium">
                服务器: <code class="text-zinc-400">{{ guide.host }}</code><br/>
                端口: <code class="text-zinc-400">{{ guide.port }}</code><br/>
                备注: {{ guide.note }}
              </p>
            </div>
          </div>
        </section>

        <!-- Safety Tips -->
        <div class="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
          <Shield class="text-amber-500 shrink-0 mt-0.5" :size="18" />
          <div class="space-y-1">
            <h4 class="text-[11px] font-black text-amber-500/80 uppercase tracking-widest">安全提示</h4>
            <ul class="text-[10px] text-zinc-500 space-y-1.5 list-disc pl-3 font-medium">
              <li>建议使用专门的部门邮箱账号用于系统通知</li>
              <li>使用应用专用密码而非主账号登录密码</li>
              <li>定期更换密码以确保安全性</li>
              <li>测试成功后再开启服务</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Right Column: Template Editor -->
      <div class="xl:col-span-8">
        <EmailTemplateManager />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import EmailTemplateManager from '~/components/Admin/EmailTemplateManager.vue'
import CustomSelect from '~/components/Admin/Common/CustomSelect.vue'
import {
  Server,
  Mail,
  Shield,
  HelpCircle,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  ExternalLink,
  Code,
  FileJson,
  Eye,
  Send,
  Info,
  ChevronRight,
  Layout,
  CheckCircle,
  XCircle
} from 'lucide-vue-next'

const { showNotification } = useToast()

// 响应式数据
const config = ref({
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '校园广播站'
})

const testEmail = ref('')
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const originalConfig = ref({})

const providerGuides = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: '587', note: '需要使用应用专用密码' },
  { name: 'QQ邮箱', host: 'smtp.qq.com', port: '587', note: '需要在QQ邮箱设置中开启SMTP服务' },
  { name: '163邮箱', host: 'smtp.163.com', port: '994', note: '需要在邮箱设置中开启SMTP服务' },
]

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
      smtpFromName: response.smtpFromName || '校园广播站'
    }

    // 保存原始配置用于重置
    originalConfig.value = { ...config.value }
  } catch (error) {
    console.error('加载SMTP配置失败:', error)
    showNotification('加载配置失败', 'error')
  }
}

// 保存配置
const saveConfig = async () => {
  if (config.value.smtpEnabled) {
    // 验证必填字段
    if (!config.value.smtpHost || !config.value.smtpUsername || !config.value.smtpPassword) {
      showNotification('请填写完整的SMTP配置信息', 'error')
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
    showNotification('SMTP配置保存成功', 'success')
  } catch (error) {
    console.error('保存SMTP配置失败:', error)
    showNotification(error.data?.message || '保存配置失败', 'error')
  } finally {
    saving.value = false
  }
}

// 重置配置
const resetConfig = () => {
  config.value = { ...originalConfig.value }
  testResult.value = null
  showNotification('配置已重置', 'info')
}

// 测试连接
const testConnection = async () => {
  if (!config.value.smtpEnabled || !config.value.smtpHost) {
    showNotification('请先配置SMTP服务器信息', 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-connection', {
      method: 'POST',
      body: config.value
    })

    testResult.value = response
  } catch (error) {
    console.error('测试连接失败:', error)
    testResult.value = {
      success: false,
      message: error.data?.message || '测试连接失败'
    }
  } finally {
    testing.value = false
  }
}

// 发送测试邮件
const sendTestEmail = async () => {
  if (!testEmail.value) {
    showNotification('请输入测试邮箱地址', 'error')
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

    testResult.value = response
    if (response.success) {
      showNotification('测试邮件发送成功', 'success')
      setTimeout(() => {
        testResult.value = null
      }, 5000)
    }
  } catch (error) {
    console.error('发送测试邮件失败:', error)
    testResult.value = {
      success: false,
      message: error.data?.message || '发送测试邮件失败'
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

<style scoped>
/* 移除旧样式，完全使用 Tailwind */
</style>

