<template>
  <div class="max-w-[1200px] mx-auto space-y-6 pb-24 px-2">
    <!-- 顶部标题栏 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">站点配置</h2>
        <p class="text-xs text-zinc-500 mt-1 font-medium">
          管理站点全局属性、视觉识别、点歌逻辑及系统安全策略
        </p>
      </div>
      <div class="flex gap-3">
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-5 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          @click="resetForm"
        >
          <RotateCcw :size="14" /> 重置
        </button>
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveConfig"
        >
          <template v-if="saving">
            <div
              class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            />
            保存中...
          </template>
          <template v-else-if="saveSuccess"> <CheckCircle2 :size="14" /> 已保存 </template>
          <template v-else> <Save :size="14" /> 保存配置 </template>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <div
        class="w-8 h-8 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin mb-4"
      />
      <p class="text-zinc-500 text-sm">加载配置中...</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 基础信息 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
        >
          <Globe :size="16" class="text-blue-500" /> 基础信息
        </h3>
        <div class="space-y-4">
          <div>
            <label :class="labelClass">站点标题</label>
            <input
              v-model="formData.siteTitle"
              type="text"
              placeholder="请输入站点标题"
              :class="inputClass"
            >
          </div>
          <div>
            <label :class="labelClass">备案号 (ICP)</label>
            <input
              v-model="formData.icpNumber"
              type="text"
              placeholder="请输入备案号"
              :class="inputClass"
            >
          </div>
          <div>
            <label :class="labelClass">站点描述</label>
            <textarea
              v-model="formData.siteDescription"
              :rows="3"
              placeholder="请输入站点描述"
              :class="[inputClass, 'resize-none']"
            />
          </div>
        </div>
      </section>

      <!-- 视觉识别 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
        >
          <ImageIcon :size="16" class="text-purple-500" /> 视觉识别
        </h3>
        <div class="space-y-4">
          <div>
            <label :class="labelClass">站点 Logo URL</label>
            <input
              v-model="formData.siteLogoUrl"
              type="text"
              placeholder="请输入Logo图片URL"
              :class="inputClass"
            >
          </div>
          <div>
            <label :class="labelClass">首页学校 Logo URL (大尺寸)</label>
            <input
              v-model="formData.schoolLogoHomeUrl"
              type="text"
              placeholder="请输入首页学校Logo URL"
              :class="inputClass"
            >
          </div>
          <div>
            <label :class="labelClass">打印排期 Logo URL (小尺寸)</label>
            <input
              v-model="formData.schoolLogoPrintUrl"
              type="text"
              placeholder="请输入打印页学校Logo URL"
              :class="inputClass"
            >
          </div>
        </div>
      </section>

      <!-- 投稿须知 -->
      <section
        class="lg:col-span-2 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6"
      >
        <h3
          class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
        >
          <FileText :size="16" class="text-emerald-500" /> 投稿须知 (Markdown)
        </h3>
        <textarea
          v-model="formData.submissionGuidelines"
          :rows="6"
          placeholder="请输入投稿须知内容"
          :class="[inputClass, 'font-mono text-xs leading-relaxed min-h-[150px]']"
        />
      </section>

      <!-- 投稿逻辑设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
        >
          <Settings2 :size="16" class="text-amber-500" /> 投稿逻辑设置
        </h3>
        <div class="space-y-6">
          <div
            class="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-zinc-200">启用重播申请</p>
              <p class="text-[10px] text-zinc-500 mt-0.5">允许用户对本学期已播放过的歌曲再次申请</p>
            </div>
            <input
              v-model="formData.enableReplayRequests"
              type="checkbox"
              class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
            >
          </div>

          <div class="space-y-4">
            <div
              class="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl"
            >
              <div>
                <p class="text-xs font-bold text-zinc-200">启用投稿限额</p>
                <p class="text-[10px] text-zinc-500 mt-0.5">限制单个用户的点歌频率</p>
              </div>
              <input
                v-model="formData.enableSubmissionLimit"
                type="checkbox"
                class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
              >
            </div>

            <div v-if="formData.enableSubmissionLimit" class="space-y-4">
              <div class="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button
                  :class="[
                    'py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    currentLimitType === 'daily'
                      ? 'bg-zinc-800 text-blue-400 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-400'
                  ]"
                  @click="handleLimitTypeChange('daily')"
                >
                  每日限额
                </button>
                <button
                  :class="[
                    'py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    currentLimitType === 'weekly'
                      ? 'bg-zinc-800 text-blue-400 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-400'
                  ]"
                  @click="handleLimitTypeChange('weekly')"
                >
                  每周限额
                </button>
              </div>

              <div>
                <label :class="labelClass"
                  >{{ currentLimitType === 'daily' ? '单日' : '单周' }}投稿上限</label
                >
                <div class="relative">
                  <input
                    v-model.number="currentLimitValue"
                    type="number"
                    min="0"
                    :class="inputClass"
                  >
                  <span
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-700 uppercase"
                    >首 / 人</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 安全与隐私设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
        >
          <Shield :size="16" class="text-rose-500" /> 安全与隐私设置
        </h3>
        <div class="space-y-4">
          <div class="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="show-keywords"
                  v-model="formData.showBlacklistKeywords"
                  type="checkbox"
                  class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
              <label for="show-keywords" class="cursor-pointer">
                <p class="text-xs font-bold text-zinc-200">显示黑名单具体关键词</p>
                <p class="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  开启后，在投稿命中黑名单时将明确提示冲突关键词；关闭则仅提示“包含关键词”。
                </p>
              </label>
            </div>
          </div>

          <div class="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="hide-students"
                  v-model="formData.hideStudentInfo"
                  type="checkbox"
                  class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
              <label for="hide-students" class="cursor-pointer">
                <p class="text-xs font-bold text-zinc-200">隐藏学生详细信息</p>
                <p class="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  开启后，非管理员用户在前端点歌列表、排期预览中将无法查看投稿学生的完整学号与真实姓名。
                </p>
              </label>
            </div>
          </div>

          <div
            class="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3"
          >
            <AlertCircle class="text-blue-500 shrink-0 mt-0.5" :size="14" />
            <p class="text-[10px] text-zinc-500 leading-normal">
              站点基础配置在保存后将立即对所有终端生效。请在修改关键业务逻辑（如投稿限额）前确保已知晓对现有用户的影响。
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Globe,
  ImageIcon,
  FileText,
  Settings2,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const { showToast: showNotification } = useToast()

const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)

// 样式类常量
const inputClass =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800'
const labelClass = 'text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 block mb-2'
const cardClass = 'bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6'

const defaultSubmissionGuidelines = `1. 投稿时无需加入书名号
2. 除DJ外，其他类型歌曲均接收（包括小语种）
3. 禁止投递含有违规内容的歌曲
4. 点播的歌曲将由管理员进行审核
5. 审核通过后将安排在播放时段播出
6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。
8. 最终解释权归广播站所有`

const formData = ref({
  siteTitle: '',
  siteLogoUrl: '',
  schoolLogoHomeUrl: '',
  schoolLogoPrintUrl: '',
  siteDescription: '',
  submissionGuidelines: '',
  icpNumber: '',
  enableReplayRequests: false,
  enableSubmissionLimit: false,
  dailySubmissionLimit: 5,
  weeklySubmissionLimit: null,
  showBlacklistKeywords: false,
  hideStudentInfo: true
})

const originalData = ref({})

// 当前限额类型和值的快捷访问
const currentLimitType = computed(() => {
  return formData.value.weeklySubmissionLimit !== null ? 'weekly' : 'daily'
})

const currentLimitValue = computed({
  get: () => {
    return currentLimitType.value === 'daily'
      ? formData.value.dailySubmissionLimit
      : formData.value.weeklySubmissionLimit
  },
  set: (val) => {
    if (currentLimitType.value === 'daily') {
      formData.value.dailySubmissionLimit = val
    } else {
      formData.value.weeklySubmissionLimit = val
    }
  }
})

// 加载配置
const loadConfig = async () => {
  try {
    loading.value = true
    const response = await fetch('/api/admin/system-settings', {
      credentials: 'include'
    })

    if (!response.ok) throw new Error('获取配置失败')

    const data = await response.json()

    formData.value = {
      siteTitle: data.siteTitle || '',
      siteLogoUrl: data.siteLogoUrl || '',
      schoolLogoHomeUrl: data.schoolLogoHomeUrl || '',
      schoolLogoPrintUrl: data.schoolLogoPrintUrl || '',
      siteDescription: data.siteDescription || '',
      submissionGuidelines: data.submissionGuidelines || defaultSubmissionGuidelines,
      icpNumber: data.icpNumber || '',
      enableReplayRequests: !!data.enableReplayRequests,
      enableSubmissionLimit: !!data.enableSubmissionLimit,
      dailySubmissionLimit: data.dailySubmissionLimit ?? 5,
      weeklySubmissionLimit: data.weeklySubmissionLimit ?? null,
      showBlacklistKeywords: !!data.showBlacklistKeywords,
      hideStudentInfo: data.hideStudentInfo ?? true
    }

    originalData.value = JSON.parse(JSON.stringify(formData.value))
  } catch (error) {
    console.error('加载配置失败:', error)
    showNotification('加载配置失败', 'error')
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    saving.value = true
    const configToSave = {
      ...formData.value,
      siteTitle: (formData.value.siteTitle || '').trim() || '校园广播站点歌系统',
      siteLogoUrl: (formData.value.siteLogoUrl || '').trim() || '/favicon.ico',
      submissionGuidelines:
        (formData.value.submissionGuidelines || '').trim() || defaultSubmissionGuidelines,
      // 确保根据限额类型处理空值
      dailySubmissionLimit:
        currentLimitType.value === 'daily' ? formData.value.dailySubmissionLimit : null,
      weeklySubmissionLimit:
        currentLimitType.value === 'weekly' ? formData.value.weeklySubmissionLimit : null
    }

    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(configToSave)
    })

    if (!response.ok) throw new Error('保存配置失败')

    saveSuccess.value = true
    originalData.value = JSON.parse(JSON.stringify(formData.value))
    showNotification('配置保存成功！', 'success')

    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('保存配置失败:', error)
    showNotification('保存配置失败，请重试', 'error')
  } finally {
    saving.value = false
  }
}

// 处理限额类型变化
const handleLimitTypeChange = (type) => {
  if (type === 'daily') {
    formData.value.weeklySubmissionLimit = null
    if (formData.value.dailySubmissionLimit === null) {
      formData.value.dailySubmissionLimit = 5
    }
  } else {
    formData.value.dailySubmissionLimit = null
    if (formData.value.weeklySubmissionLimit === null) {
      formData.value.weeklySubmissionLimit = 20
    }
  }
}

// 重置表单
const resetForm = () => {
  formData.value = JSON.parse(JSON.stringify(originalData.value))
}

onMounted(loadConfig)
</script>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}
</style>
