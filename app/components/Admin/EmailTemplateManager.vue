<template>
  <div class="email-template-manager">
    <div class="section-header">
      <h2>邮件模板管理</h2>
      <p>自定义系统邮件的主题与内容，支持占位符</p>
    </div>

    <div class="list-and-editor">
      <div class="template-list">
        <div class="list-header">模板列表</div>
        <div v-for="t in templates" :key="t.key" :class="['tpl-item', selectedKey===t.key?'active':'']"
             @click="select(t)">
          <div class="tpl-name">{{ t.name }} <span class="tpl-key">({{ t.key }})</span></div>
          <div class="tpl-meta">
            <span v-if="t.isBuiltin" class="badge">内置</span>
            <span v-if="t.isOverridden" class="badge badge-green">已自定义</span>
          </div>
        </div>
      </div>
      <div v-if="selected" class="editor">
        <div class="form-group">
          <label>模板名称</label>
          <input v-model="form.name" class="form-input"/>
        </div>
        <div class="form-group">
          <label v-pre>主题（可用 {{var}} 占位符）</label>
          <input v-model="form.subject" class="form-input"/>
        </div>
        <div class="form-group">
          <label v-pre>HTML 内容（可用 {{var}} 与 {{#if cond}}...{{/if}}）</label>
          <textarea v-model="form.html" class="form-textarea" rows="14"></textarea>
        </div>
        <div class="hint">
          <strong>常用变量：</strong>
          <span v-if="selected.key==='verification.code'">name, email, code, expiresInMinutes</span>
          <span v-else>title, message, actionUrl, fromName</span>
        </div>
        <div class="actions">
          <button :disabled="saving" class="btn btn-primary" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
          <button :disabled="saving || !selected.isOverridden" class="btn" @click="restore">恢复默认</button>
          <button :disabled="saving" class="btn btn-secondary" @click="doPreview">预览</button>
        </div>
        <div v-if="previewHtml" class="preview">
          <div class="preview-header">预览：{{ previewSubject }}</div>
          <iframe :srcdoc="previewHtml" class="preview-frame"></iframe>
        </div>
      </div>
    </div>
  </div>

</template>

<script lang="ts" setup>
import {computed, onMounted, ref} from 'vue'
import {useToast} from '~/composables/useToast'

type TemplateItem = {
  key: string;
  name: string;
  subject: string;
  html: string;
  isBuiltin: boolean;
  isOverridden?: boolean
}

const {success, error} = useToast()
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

const selected = computed(() => templates.value.find(t => t.key === selectedKey.value))

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
  form.value = {key: t.key, name: t.name, subject: t.subject, html: t.html}
  previewHtml.value = ''
  previewSubject.value = ''
}

async function save() {
  try {
    saving.value = true
    await $fetch('/api/admin/email-templates', {method: 'POST', body: form.value})
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
    await $fetch(`/api/admin/email-templates?key=${encodeURIComponent(form.value.key)}`, {method: 'DELETE'})
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
    const defaultData = form.value.key === 'verification.code'
        ? {name: '张三', email: 'example@school.edu', code: '123456', expiresInMinutes: 5}
        : {title: '系统通知', message: '这是一条预览内容\n支持换行与链接', actionUrl: 'https://example.com'}
    const res = await $fetch('/api/admin/email-templates/preview', {
      method: 'POST',
      body: {key: form.value.key, data: defaultData}
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
.email-template-manager {
  background: #111;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  padding: 24px;
}

.section-header h2 {
  color: #fff;
  margin: 0 0 8px;
}

.section-header p {
  color: #888;
  margin: 0 0 16px;
}

.list-and-editor {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

.template-list {
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  overflow: hidden;
}

.list-header {
  color: #ccc;
  padding: 12px 16px;
  border-bottom: 1px solid #1f1f1f;
}

.tpl-item {
  padding: 12px 16px;
  border-bottom: 1px solid #1f1f1f;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tpl-item:hover {
  background: #171717;
}

.tpl-item.active {
  background: #151515;
}

.tpl-name {
  color: #fff;
  font-weight: 600;
}

.tpl-key {
  color: #666;
  font-weight: 400;
  font-size: 12px;
}

.badge {
  display: inline-block;
  font-size: 12px;
  color: #aaa;
  border: 1px solid #333;
  padding: 2px 6px;
  border-radius: 6px;
  margin-left: 6px;
}

.badge-green {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.4);
}

.editor {
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  padding: 16px;
}

.form-group {
  margin-bottom: 12px;
}

label {
  color: #ccc;
  display: block;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  border-radius: 8px;
  padding: 10px;
}

.form-textarea {
  width: 100%;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  border-radius: 8px;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.hint {
  color: #888;
  font-size: 12px;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #333;
  background: #1a1a1a;
  color: #fff;
  cursor: pointer;
}

.btn:hover {
  background: #222;
}

.btn-primary {
  background: #007bff;
  border-color: #0056b3;
}

.btn-secondary {
  background: #333;
}

.preview {
  border-top: 1px solid #1f1f1f;
  padding-top: 12px;
}

.preview-header {
  color: #ccc;
  margin-bottom: 8px;
}

.preview-frame {
  width: 100%;
  height: 360px;
  background: #fff;
  border: 1px solid #333;
  border-radius: 6px;
}

@media (max-width: 900px) {
  .list-and-editor {
    grid-template-columns: 1fr;
  }
}
</style>