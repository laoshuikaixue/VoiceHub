<template>
  <div class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] overflow-hidden">
    <!-- 头部 -->
    <div class="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/20">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20"
        >
          <Mail :size="20" class="text-blue-500" />
        </div>
        <div>
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">邮件模板管理</h3>
          <p class="text-[10px] text-zinc-500 mt-0.5">自定义系统邮件的主题与内容，支持变量替换</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="selected"
          class="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-[11px] font-bold rounded-xl transition-all"
          :disabled="saving"
          @click="doPreview"
        >
          <Eye :size="14" /> {{ previewHtml ? '刷新预览' : '实时预览' }}
        </button>
        <button
          v-if="selected"
          class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          :disabled="saving"
          @click="save"
        >
          <Save :size="14" /> {{ saving ? '保存中...' : '更新模板' }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[650px]">
      <!-- 左侧：模板列表 -->
      <div class="lg:col-span-3 border-r border-zinc-800 bg-zinc-900/10 flex flex-col">
        <div class="p-4 border-b border-zinc-800/50">
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              placeholder="搜索模板..."
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-[10px] text-zinc-400 focus:outline-none focus:border-blue-500/30"
            >
          </div>
        </div>
        <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          <button
            v-for="t in templates"
            :key="t.key"
            class="w-full group flex flex-col gap-1 p-3 rounded-2xl transition-all text-left border"
            :class="[
              selectedKey === t.key
                ? 'bg-blue-600/10 border-blue-500/20'
                : 'bg-transparent border-transparent hover:bg-zinc-800/40'
            ]"
            @click="select(t)"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-[11px] font-black tracking-tight transition-colors"
                :class="
                  selectedKey === t.key
                    ? 'text-blue-400'
                    : 'text-zinc-300 group-hover:text-zinc-100'
                "
              >
                {{ t.name }}
              </span>
              <div class="flex gap-1">
                <span
                  v-if="t.isBuiltin && !t.isOverridden"
                  class="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[8px] font-black text-zinc-500 uppercase tracking-tighter"
                >
                  内置
                </span>
                <span
                  v-if="t.isOverridden"
                  class="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[8px] font-black text-emerald-500 uppercase tracking-tighter"
                >
                  自定义
                </span>
              </div>
            </div>
            <span class="text-[9px] font-bold text-zinc-600 font-mono">{{ t.key }}</span>
          </button>
        </div>
      </div>

      <!-- 右侧：编辑器区域 -->
      <div class="lg:col-span-9 flex flex-col bg-zinc-950/20 overflow-hidden">
        <div v-if="selected" class="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div class="max-w-4xl mx-auto space-y-8">
            <!-- 基础信息与主题 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >模板名称</label
                >
                <input
                  v-model="form.name"
                  type="text"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                    >邮件主题</label
                  >
                  <span class="text-[9px] text-zinc-500 font-bold uppercase">支持变量</span>
                </div>
                <input
                  v-model="form.subject"
                  type="text"
                  placeholder="请输入邮件主题..."
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
              </div>
            </div>

            <!-- 变量提示 -->
            <div class="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4">
              <div
                class="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"
              >
                <Info :size="16" class="text-blue-500" />
              </div>
              <div class="space-y-1">
                <h4 class="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  可用变量
                </h4>
                <p class="text-[11px] text-zinc-500 leading-relaxed font-mono">
                  <template v-if="selected.key === 'verification.code'">
                    <span v-pre>{{ name }}, {{ email }}, {{ code }}, {{ expiresInMinutes }}</span>
                  </template>
                  <template v-else>
                    <span v-pre>{{ title }}, {{ message }}, {{ actionUrl }}, {{ fromName }}</span>
                  </template>
                </p>
              </div>
            </div>

            <!-- 内容编辑器 -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-2">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                    >HTML 内容</label
                  >
                  <span
                    class="px-2 py-0.5 rounded-md bg-zinc-900 text-[8px] font-black text-zinc-500 uppercase"
                    >Handlebars</span
                  >
                </div>
                <button
                  v-if="selected.isOverridden"
                  class="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 hover:text-rose-400 transition-colors"
                  @click="restore"
                >
                  <RotateCcw :size="12" /> 恢复默认配置
                </button>
              </div>
              <div class="relative group">
                <div
                  class="absolute right-4 top-4 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Code :size="14" class="text-zinc-500" />
                </div>
                <textarea
                  v-model="form.html"
                  rows="16"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-[11px] text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500/30 custom-scrollbar"
                  placeholder="<html>..."
                />
              </div>
            </div>

            <!-- 预览框 -->
            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="transform translate-y-4 opacity-0"
              enter-to-class="transform translate-y-0 opacity-100"
            >
              <div v-if="previewHtml" class="space-y-4 pt-4 border-t border-zinc-800">
                <div class="flex items-center justify-between px-1">
                  <label
                    class="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2"
                  >
                    <Eye :size="14" /> 实时预览:
                    <span class="text-zinc-400 font-normal normal-case">{{ previewSubject }}</span>
                  </label>
                  <button
                    class="text-[10px] font-bold text-zinc-500 hover:text-zinc-300"
                    @click="previewHtml = ''"
                  >
                    隐藏预览
                  </button>
                </div>
                <div class="rounded-2xl overflow-hidden border border-zinc-800 bg-white shadow-2xl">
                  <iframe :srcdoc="previewHtml" class="w-full h-[500px] border-none" />
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center text-zinc-700 space-y-4"
        >
          <div
            class="w-16 h-16 rounded-3xl bg-zinc-900/50 flex items-center justify-center border border-zinc-800/50"
          >
            <Mail :size="32" class="text-zinc-800" />
          </div>
          <p class="text-xs font-bold tracking-widest uppercase">请在左侧选择一个邮件模板</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { Mail, Info, Save, RotateCcw, Eye, Code, Search, ChevronRight } from 'lucide-vue-next'

type TemplateItem = {
  key: string
  name: string
  subject: string
  html: string
  isBuiltin: boolean
  isOverridden?: boolean
}

const { success, error } = useToast()
const templates = ref<TemplateItem[]>([])
const selectedKey = ref<string>('')
const form = ref<{ key: string; name: string; subject: string; html: string }>({
  key: '',
  name: '',
  subject: '',
  html: ''
})
const saving = ref(false)
const previewHtml = ref<string>('')
const previewSubject = ref<string>('')

const selected = computed(() => templates.value.find((t) => t.key === selectedKey.value))

async function loadList() {
  const res: any = await $fetch('/api/admin/email-templates')
  const list = Array.isArray(res?.templates) ? res.templates : []
  templates.value = list.map((t: any) => ({
    key: String(t.key),
    name: String(t.name),
    subject: String(t.subject),
    html: String(t.html),
    isBuiltin: !!t.isBuiltin,
    isOverridden: !!t.isOverridden
  }))
  if (!selectedKey.value && templates.value.length) select(templates.value[0])
}

function select(t: TemplateItem) {
  selectedKey.value = t.key
  form.value = { key: t.key, name: t.name, subject: t.subject, html: t.html }
  previewHtml.value = ''
  previewSubject.value = ''
}

async function save() {
  try {
    saving.value = true
    await $fetch('/api/admin/email-templates', { method: 'POST', body: form.value })
    success('模板已保存')
    await loadList()
  } catch (e: any) {
    error(e?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function restore() {
  try {
    saving.value = true
    await $fetch(`/api/admin/email-templates?key=${encodeURIComponent(form.value.key)}`, {
      method: 'DELETE'
    })
    success('已恢复默认模板')
    await loadList()
  } catch (e: any) {
    error(e?.data?.message || '恢复失败')
  } finally {
    saving.value = false
  }
}

async function doPreview() {
  try {
    const defaultData =
      form.value.key === 'verification.code'
        ? { name: '张三', email: 'example@school.edu', code: '123456', expiresInMinutes: 5 }
        : {
            title: '系统通知',
            message: '这是一条预览内容\n支持换行与链接',
            actionUrl: 'https://example.com'
          }
    const res = await $fetch('/api/admin/email-templates/preview', {
      method: 'POST',
      body: { key: form.value.key, data: defaultData }
    })
    previewHtml.value = res.html
    previewSubject.value = res.subject
  } catch (e: any) {
    error(e?.data?.message || '预览失败')
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
