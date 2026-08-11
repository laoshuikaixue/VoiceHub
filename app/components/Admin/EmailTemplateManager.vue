<template>
  <div class="bg-bg-secondary-30 border border-border-secondary rounded-[2rem] overflow-hidden">
    <!-- 头部 -->
    <div class="flex items-center justify-between p-6 border-b border-border-secondary bg-bg-secondary-20">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-2xl bg-primary-hover-10 flex items-center justify-center border border-primary-20"
        >
          <Mail :size="20" class="text-primary" />
        </div>
        <div>
          <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ locale.title }}</h3>
          <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.desc }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="selected"
          class="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary text-[11px] font-bold rounded-xl transition-all"
          :disabled="saving"
          @click="doPreview"
        >
          <Eye :size="14" /> {{ previewHtml ? locale.refreshPreview : locale.livePreview }}
        </button>
        <button
          v-if="selected"
          class="flex items-center gap-2 px-6 py-2 bg-primary-hover hover:bg-primary text-text-primary text-[11px] font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95"
          :disabled="saving"
          @click="save"
        >
          <Save :size="14" /> {{ saving ? locale.saving : locale.updateTemplate }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[650px]">
      <!-- 左侧：模板列表 -->
      <div class="lg:col-span-3 border-r border-border-secondary bg-bg-secondary-10 flex flex-col">
        <div class="p-4 border-b border-border-secondary-50">
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              :placeholder="locale.searchPlaceholder"
              class="w-full bg-bg-primary border border-border-secondary rounded-lg pl-9 pr-3 py-2 text-[10px] text-text-tertiary focus:outline-none focus:border-primary-30"
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
                ? 'bg-primary-hover-10 border-primary-20'
                : 'bg-transparent border-transparent hover:bg-bg-tertiary-40'
            ]"
            @click="select(t)"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-[11px] font-black tracking-tight transition-colors"
                :class="
                  selectedKey === t.key
                    ? 'text-primary'
                    : 'text-text-secondary group-hover:text-text-primary'
                "
              >
                {{ t.name }}
              </span>
              <div class="flex gap-1">
                <span
                  v-if="t.isBuiltin && !t.isOverridden"
                  class="px-1.5 py-0.5 rounded-md bg-bg-tertiary text-[8px] font-black text-text-tertiary uppercase tracking-tighter"
                >
                  {{ locale.builtin }}
                </span>
                <span
                  v-if="t.isOverridden"
                  class="px-1.5 py-0.5 rounded-md bg-success-10 text-[8px] font-black text-success uppercase tracking-tighter"
                >
                  {{ locale.custom }}
                </span>
              </div>
            </div>
            <span class="text-[9px] font-bold text-text-disabled font-mono">{{ t.key }}</span>
          </button>
        </div>
      </div>

      <!-- 右侧：编辑器区域 -->
      <div class="lg:col-span-9 flex flex-col bg-bg-primary-20 overflow-hidden">
        <div v-if="selected" class="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div class="max-w-4xl mx-auto space-y-8">
            <!-- 基础信息与主题 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.templateName }}</label
                >
                <input
                  v-model="form.name"
                  type="text"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
                    >{{ locale.emailSubject }}</label
                  >
                  <span class="text-[9px] text-text-tertiary font-bold uppercase">{{ locale.supportsVariables }}</span>
                </div>
                <input
                  v-model="form.subject"
                  type="text"
                  :placeholder="locale.subjectPlaceholder"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>
            </div>

            <!-- 变量提示 -->
            <div class="bg-primary-hover-5 border border-primary-10 rounded-2xl p-4 flex gap-4">
              <div
                class="w-8 h-8 rounded-xl bg-primary-10 flex items-center justify-center shrink-0"
              >
                <Info :size="16" class="text-primary" />
              </div>
              <div class="space-y-1">
                <h4 class="text-[10px] font-black text-primary uppercase tracking-widest">
                  {{ locale.availableVariables }}
                </h4>
                <p class="text-[11px] text-text-tertiary leading-relaxed font-mono">
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
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
                    >{{ locale.htmlContent }}</label
                  >
                  <span
                    class="px-2 py-0.5 rounded-md bg-bg-secondary text-[8px] font-black text-text-tertiary uppercase"
                    >Handlebars</span
                  >
                </div>
                <button
                  v-if="selected.isOverridden"
                  class="flex items-center gap-1.5 text-[10px] font-bold text-error hover:text-error transition-colors"
                  @click="restore"
                >
                  <RotateCcw :size="12" /> {{ locale.restoreDefault }}
                </button>
              </div>
              <div class="relative group">
                <div
                  class="absolute right-4 top-4 p-2 rounded-lg bg-bg-secondary-50 border border-border-secondary opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Code :size="14" class="text-text-tertiary" />
                </div>
                <textarea
                  v-model="form.html"
                  rows="16"
                  class="w-full bg-bg-primary border border-border-secondary rounded-2xl p-6 text-[11px] text-text-secondary font-mono leading-relaxed focus:outline-none focus:border-primary-30 custom-scrollbar"
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
              <div v-if="previewHtml" class="space-y-4 pt-4 border-t border-border-secondary">
                <div class="flex items-center justify-between px-1">
                  <label
                    class="text-[10px] font-black text-text-disabled uppercase tracking-widest flex items-center gap-2"
                  >
                    <Eye :size="14" /> {{ locale.livePreviewLabel }}
                    <span class="text-text-tertiary font-normal normal-case">{{ previewSubject }}</span>
                  </label>
                  <button
                    class="text-[10px] font-bold text-text-tertiary hover:text-text-secondary"
                    @click="previewHtml = ''"
                  >
                    {{ locale.hidePreview }}
                  </button>
                </div>
                <div class="rounded-2xl overflow-hidden border border-border-secondary bg-bg-secondary shadow-2xl">
                  <iframe :srcdoc="previewHtml" class="w-full h-[500px] border-none" />
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center text-text-secondary space-y-4"
        >
          <div
            class="w-16 h-16 rounded-3xl bg-bg-secondary-50 flex items-center justify-center border border-border-secondary-50"
          >
            <Mail :size="32" class="text-text-primary" />
          </div>
          <p class="text-xs font-bold tracking-widest uppercase">{{ locale.emptySelectTemplate }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { Mail, Info, Save, RotateCcw, Eye, Code, Search, ChevronRight } from '@lucide/vue'

type TemplateItem = {
  key: string
  name: string
  subject: string
  html: string
  isBuiltin: boolean
  isOverridden?: boolean
}

const { success, error } = useToast()
const { admin } = useLocale()
const locale = computed(() => {
  const base = admin.value?.emailTemplateManager || {}
  return {
    ...base,
    messages: { ...(base.messages || {}) },
    errors: { ...(base.errors || {}) }
  }
})
const getLocaleText = (section: string, key: string, fallback = '') => {
  return locale.value?.[section]?.[key] || fallback
}
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
    success(getLocaleText('messages', 'saved', '模板已保存'))
    await loadList()
  } catch (e: any) {
    error(e?.data?.message || getLocaleText('errors', 'saveFailed', '保存失败'))
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
    success(getLocaleText('messages', 'restored', '已恢复默认模板'))
    await loadList()
  } catch (e: any) {
    error(e?.data?.message || getLocaleText('errors', 'restoreFailed', '恢复失败'))
  } finally {
    saving.value = false
  }
}

async function doPreview() {
  try {
    const defaultData =
      form.value.key === 'verification.code'
        ? {
            name: locale.value?.previewData?.name || 'Example User',
            email: 'example@school.edu',
            code: '123456',
            expiresInMinutes: 5
          }
        : {
            title: locale.value?.previewData?.title || 'System Notification',
            message: locale.value?.previewData?.message || 'This is preview content.\nLine breaks and links are supported.',
            actionUrl: 'https://example.com'
          }
    const res = await $fetch('/api/admin/email-templates/preview', {
      method: 'POST',
      body: { key: form.value.key, data: defaultData }
    })
    previewHtml.value = res.html
    previewSubject.value = res.subject
  } catch (e: any) {
    error(e?.data?.message || getLocaleText('errors', 'previewFailed', '预览失败'))
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
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}
</style>
