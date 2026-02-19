<template>
  <div class="max-w-[1400px] mx-auto space-y-10 pb-20 px-2">
    <!-- 头部区域 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">邮件服务配置</h2>
        <p class="text-xs text-zinc-500 mt-1">
          配置 SMTP 服务以发送系统验证码、投稿通知及其他重要提醒
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          :disabled="saving"
          @click="saveConfig"
        >
          <Save :size="14" /> {{ saving ? '保存中...' : '保存配置' }}
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
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >SMTP 服务器</label
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
                  >端口</label
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
                  >加密方式</label
                >
                <CustomSelect
                  :model-value="config.smtpSecure ? 'SSL/TLS' : '无'"
                  :options="['SSL/TLS', '无']"
                  class="w-full"
                  @update:model-value="(val) => (config.smtpSecure = val === 'SSL/TLS')"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >发件人账号</label
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
                >授权码 / 密码</label
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
                >发件人姓名</label
              >
              <input
                v-model="config.smtpFromName"
                type="text"
                placeholder="校园广播站"
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
            <Send :size="16" class="text-emerald-500" /> 服务测试
          </h3>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >测试接收邮箱</label
              >
              <div class="flex gap-2">
                <input
                  v-model="testEmail"
                  type="email"
                  placeholder="输入测试邮箱地址"
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  :disabled="testing || !testEmail || !config.smtpEnabled"
                  @click="sendTestEmail"
                >
                  <Check v-if="testResult?.success" :size="14" class="text-emerald-500" />
                  <Send v-else :size="14" />
                  {{ testing ? '发送中' : testResult?.success ? '已发送' : '发送' }}
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
import { onMounted, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import EmailTemplateManager from '~/components/Admin/EmailTemplateManager.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { Server, Save, Check, Send, CheckCircle, XCircle } from 'lucide-vue-next'

const { showToast: showNotification } = useToast()

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

<style scoped></style>
