<template>
  <section v-if="user?.role === 'SUPER_ADMIN'" class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 shadow-xl space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border-secondary pb-4">
      <div class="flex items-start gap-3 min-w-0">
        <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-bg-primary border border-border-secondary text-primary shrink-0">
          <ListMusic :size="16" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ t.title }}</h3>
          <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">{{ snapshot ? t.snapshotHint : t.hotHint }}</p>
        </div>
      </div>
      <button
        :disabled="busy"
        class="flex items-center gap-2 px-4 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50"
        @click="edit()"
      >
        <Plus :size="14" /> {{ t.add }}
      </button>
    </div>

    <div v-if="error" role="alert" class="bg-error-5 border border-error-10 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle class="text-error shrink-0 mt-0.5" :size="16" />
      <div class="min-w-0 space-y-0.5">
        <p class="text-xs font-bold text-text-secondary">{{ errorTitle }}</p>
        <p class="text-[11px] text-text-tertiary leading-relaxed break-words">{{ error }}</p>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl space-y-4">
      <AppSpinner :size="40" />
      <p class="text-xs font-black text-text-tertiary uppercase tracking-widest">{{ t.loading }}</p>
    </div>

    <div v-else-if="!items.length" class="flex flex-col items-center justify-center py-16 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl space-y-5">
      <div class="flex items-center justify-center p-6 rounded-xl bg-bg-primary border border-border-secondary text-text-secondary">
        <ListMusic :size="32" />
      </div>
      <p class="text-xs text-text-tertiary">{{ t.empty }}</p>
    </div>

    <div v-else class="max-h-[60vh] overflow-y-auto pr-1">
      <TransitionGroup name="plugin-source" tag="div" class="relative space-y-2">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          :draggable="!busy"
          :class="[
            'flex flex-col gap-2 p-3 border rounded-xl transition-all',
            item.enabled ? 'border-border-secondary bg-bg-secondary-40' : 'border-border-secondary-40 bg-bg-secondary-60 opacity-60',
            dragOverIndex === index ? 'border-t-2 border-t-primary' : ''
          ]"
          @dragstart="handleDragStart($event, index)"
          @dragover.prevent
          @dragenter.prevent="handleDragEnter(index)"
          @dragleave="handleDragLeave"
          @drop.stop.prevent="handleDrop($event, index)"
          @dragend="handleDragEnd"
        >
          <div class="flex items-center gap-3">
            <span class="w-5 text-center text-[10px] font-black text-text-tertiary shrink-0">{{ index + 1 }}</span>
            <div class="flex items-center justify-center text-text-disabled hover:text-text-primary shrink-0" :class="busy ? 'cursor-not-allowed' : 'cursor-move'">
              <GripVertical :size="14" />
            </div>
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-xs font-bold text-text-primary truncate">{{ item.name }}</span>
              <AppSpinner v-if="pendingId === item.id" :size="12" class="shrink-0" />
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="item.enabled"
              :aria-label="item.enabled ? t.enabled : t.disabled"
              :disabled="busy"
              :class="['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all disabled:opacity-50', item.enabled ? 'bg-primary' : 'bg-bg-tertiary-70']"
              @click="toggle(item)"
            >
              <span :class="['inline-block h-3.5 w-3.5 rounded-full bg-bg-primary shadow transition-transform', item.enabled ? 'translate-x-5' : 'translate-x-1']" />
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 pl-8">
            <span v-for="(badge, badgeIndex) in badges(item)" :key="badgeIndex" :title="badge.title" :class="['px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap', TONE_CLASS[badge.tone]]">{{ badge.text }}</span>
          </div>

          <p class="pl-8 text-[10px] font-mono text-text-disabled break-all leading-relaxed">{{ displayUrl(item.scriptUrl) }}</p>

          <div class="ml-8 flex flex-wrap items-center gap-1 p-1 rounded-xl border border-border-secondary-50 bg-bg-secondary-60">
            <button type="button" :title="t.up" :aria-label="t.up" :disabled="busy || index === 0" :class="ICON_BTN" @click="move(index, -1)">
              <ArrowUp :size="12" />
            </button>
            <button type="button" :title="t.down" :aria-label="t.down" :disabled="busy || index === items.length - 1" :class="ICON_BTN" @click="move(index, 1)">
              <ArrowDown :size="12" />
            </button>
            <span class="w-px h-4 bg-border-secondary-50 mx-0.5 shrink-0" />
            <button type="button" :disabled="busy" :class="TEXT_BTN" @click="edit(item)">
              <Pencil :size="12" /> {{ t.edit }}
            </button>
            <button type="button" :disabled="busy || !item.activeRevision" :class="TEXT_BTN" @click="test(item)">
              <FlaskConical :size="12" /> {{ t.test }}
            </button>
            <button v-if="!snapshot" type="button" :disabled="busy" :class="TEXT_BTN" @click="refresh(item)">
              <RefreshCw :size="12" /> {{ t.refresh }}
            </button>
            <button type="button" :disabled="busy" :class="TEXT_DANGER_BTN" @click="askRemove(item)">
              <Trash2 :size="12" /> {{ t.remove }}
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-bg-primary-80 backdrop-blur-sm" @click="!busy && (open = false)" />
        <form class="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-bg-secondary border border-border-secondary shadow-2xl p-6 space-y-5" @submit.prevent="save">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-black text-text-primary tracking-tight">{{ form.id ? t.edit : t.add }}</h3>
            <button type="button" :disabled="busy" class="flex items-center justify-center p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary-50 transition-all disabled:opacity-50" @click="open = false">
              <X :size="18" />
            </button>
          </div>

          <label class="block space-y-1.5">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ t.name }}</span>
            <input v-model="form.name" maxlength="100" class="w-full px-3 py-2.5 rounded-lg bg-bg-primary border border-border-secondary text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            <span class="block text-[10px] text-text-tertiary leading-relaxed">{{ t.nameHint }}</span>
          </label>
          <label class="block space-y-1.5">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ t.url }}</span>
            <input v-model="form.scriptUrl" required type="url" class="w-full px-3 py-2.5 rounded-lg bg-bg-primary border border-border-secondary text-sm font-mono text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </label>
          <CustomSelect v-model="form.protocol" :options="protocolOptions" :label="t.protocol" />
          <CustomSelect v-model="form.catalog" :options="catalogOptions" :label="t.catalog" />
          <p class="text-[10px] text-text-tertiary leading-relaxed">{{ t.catalogHint }}</p>
          <label class="block space-y-1.5">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ t.variables }}</span>
            <textarea v-model="form.variablesText" rows="4" placeholder="{}" class="w-full px-3 py-2.5 rounded-lg bg-bg-primary border border-border-secondary text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            <span class="block text-[10px] text-text-tertiary leading-relaxed">{{ t.variablesHint }}</span>
          </label>
          <label class="block space-y-1.5">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ t.legacy }}</span>
            <input v-model="form.legacyPlatformKey" maxlength="100" class="w-full px-3 py-2.5 rounded-lg bg-bg-primary border border-border-secondary text-sm font-mono text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </label>

          <p v-if="error" role="alert" class="text-[11px] text-error leading-relaxed break-words">{{ error }}</p>

          <div class="flex justify-end gap-3 pt-1">
            <button type="button" :disabled="busy" class="px-4 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50" @click="open = false">
              {{ t.cancel }}
            </button>
            <button type="submit" :disabled="busy" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-hover hover:bg-primary text-text-primary text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50">
              <AppSpinner v-if="busy" :size="12" color="white" /> {{ snapshot ? t.saveDeploy : t.saveLoad }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model:show="showRemove"
      type="danger"
      :title="removeDialog.title"
      :message="removeDialog.message"
      :confirm-text="removeDialog.confirmText"
      :cancel-text="removeDialog.cancelText"
      :loading="removing"
      @confirm="confirmRemove"
      @cancel="removeTarget = null"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, ArrowDown, ArrowUp, FlaskConical, GripVertical, ListMusic, Pencil, Plus, RefreshCw, Trash2, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useAuth } from '~/composables/useAuth'
import { useLocale } from '~/utils/locale'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { useServerErrors } from '~/composables/useLocaleText'
import { usePlatformConfig } from '~/composables/usePlatformConfig'

const BTN_BASE = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-text-tertiary transition-all disabled:opacity-40 disabled:cursor-not-allowed'
const ICON_BTN = 'flex items-center justify-center w-7 h-7 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed'
const TEXT_BTN = `${BTN_BASE} hover:text-primary hover:bg-bg-primary`
const TEXT_DANGER_BTN = `${BTN_BASE} hover:text-error hover:bg-bg-primary`
const TONE_CLASS = {
  success: 'bg-success-10 text-success border-success-20',
  warning: 'bg-warning-10 text-warning border-warning-20',
  error: 'bg-error-10 text-error border-error-20',
  neutral: 'bg-bg-tertiary-70 text-text-tertiary border-border-tertiary-50'
}

const { user } = useAuth()
const { admin, serverErrors } = useLocale()
const t = computed(() => useSafeLocale(admin.value.musicSourcePlugins))
const { localize } = useServerErrors()
const items = ref([])
const revision = ref(0)
const snapshot = ref(false)
const busy = ref(false)
const loading = ref(true)
const error = ref('')
const errorKind = ref('action')
const open = ref(false)
const form = ref({})
const pendingId = ref('')
const showRemove = ref(false)
const removing = ref(false)
const removeTarget = ref(null)
const dragOverIndex = ref(-1)
let draggedIndex = -1

const protocolOptions = computed(() => [{ value: 'auto', label: t.value.auto }, { value: 'lx', label: 'LX Music' }, { value: 'musicfree', label: 'MusicFree' }])
const catalogOptions = computed(() => [{ value: '', label: t.value.privateCatalog }, ...['netease', 'tencent', 'migu', 'kugou', 'kuwo'].map((value) => ({ value, label: value }))])
const protocolLabels = computed(() => Object.fromEntries(protocolOptions.value.map((option) => [option.value, option.label])))
const removeDialog = computed(() => ({
  title: String(t.value.removeTitle),
  message: removeTarget.value ? String(t.value.removeConfirm(removeTarget.value.name)) : '',
  confirmText: String(t.value.remove),
  cancelText: String(t.value.cancel)
}))
const errorTitle = computed(() => String(errorKind.value === 'load' ? t.value.fetchFailed : t.value.failed))

const displayUrl = (value) => { try { const url = new URL(value); return `${url.origin}${url.pathname}${url.search ? '?…' : ''}` } catch { return '' } }

// 版本标签按部署模式区分：serverless 下产物固化在构建里，只有和期望版本一致才算已部署
const versionLabel = () => (snapshot.value ? t.value.deployed : t.value.active)
// lastError 存的是服务端错误码，能本地化就本地化，取不到词典时退回原始码便于排查
function failureText(code) {
  if (code === 'PLUGIN_INVALID_TICKET') return String(t.value.invalidVariables)
  return serverErrors.value?.[code] ? localize({ data: { code } }) : String(code)
}
function badges(item) {
  const list = []
  const protocol = item.capability?.protocol || item.protocol
  if (protocol) list.push({ tone: 'neutral', text: protocolLabels.value[protocol] || protocol })
  if (item.capability) list.push({ tone: item.capability.search ? 'success' : 'neutral', text: item.capability.search ? String(t.value.canSearch) : String(t.value.resolveOnly) })
  const sources = Object.keys(item.capability?.sources || {})
  if (sources.length) list.push({ tone: 'neutral', text: sources.join(' / ') })
  if (item.catalog) list.push({ tone: 'neutral', text: item.catalog })
  if (item.lastError) {
    const detail = failureText(item.lastError)
    list.push({ tone: 'error', title: item.lastError, text: item.activeRevision ? `${t.value.failed} · ${detail} · ${versionLabel()} ${item.activeRevision}` : `${t.value.failed} · ${detail}` })
  } else if (!item.activeRevision) {
    list.push({ tone: 'warning', text: snapshot.value ? String(t.value.deployRequired) : String(t.value.pending) })
  } else if (item.activeRevision === item.desiredRevision) {
    list.push({ tone: 'success', text: `${versionLabel()} ${item.activeRevision}` })
  } else {
    list.push({ tone: 'warning', text: `${versionLabel()} ${item.activeRevision} · ${snapshot.value ? t.value.deployRequired : t.value.pending}` })
  }
  if (item.variablesInvalid) list.push({ tone: 'warning', text: String(t.value.invalidVariables) })
  return list
}

async function load() {
  try {
    const response = await $fetch('/api/admin/music-source-plugins')
    items.value = response.data
    revision.value = response.revision
    snapshot.value = response.mode === 'snapshot'
    error.value = ''
  } catch (err) {
    errorKind.value = 'load'
    error.value = localize(err)
  }
  finally { loading.value = false }
}
async function mutate(action, id = '') {
  if (busy.value) return
  busy.value = true
  errorKind.value = 'action'
  error.value = ''
  pendingId.value = id
  try { await action(); await load(); await usePlatformConfig().refreshPlatformConfig() }
  catch (err) {
    const message = localize(err)
    await load()
    error.value = message
  }
  finally { busy.value = false; pendingId.value = '' }
}
function edit(item) {
  error.value = ''
  form.value = item ? { ...item, catalog: item.catalog || '', variablesText: '' } : { name: '', scriptUrl: '', protocol: 'auto', catalog: '', variablesText: '', legacyPlatformKey: '' }
  open.value = true
}
async function save() {
  let variables
  try { variables = form.value.variablesText.trim() ? JSON.parse(form.value.variablesText) : undefined }
  catch { error.value = String(t.value.invalidJson); return }
  await mutate(async () => {
    const id = form.value.id
    await $fetch(`/api/admin/music-source-plugins${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: { name: form.value.name, scriptUrl: form.value.scriptUrl, protocol: form.value.protocol, catalog: form.value.catalog || null, legacyPlatformKey: form.value.legacyPlatformKey || null, variables, revision: revision.value }, timeout: 30000 })
    open.value = false
  }, form.value.id)
}
const toggle = (item) => mutate(() => $fetch(`/api/admin/music-source-plugins/${item.id}/enabled`, { method: 'PATCH', body: { enabled: !item.enabled, revision: revision.value } }), item.id)
const refresh = (item) => mutate(() => $fetch(`/api/admin/music-source-plugins/${item.id}/refresh`, { method: 'POST', timeout: 30000 }), item.id)
const test = (item) => mutate(async () => {
  const result = await $fetch(`/api/admin/music-source-plugins/${item.id}/test`, { method: 'POST', timeout: 12000 })
  if (result.success) window.$showNotification?.(`${String(t.value.testPassed)} · ${result.elapsed} ms`, 'success')
}, item.id)

function reorder(from, to) {
  if (from === to || to < 0 || to >= items.value.length) return
  const ids = items.value.map((item) => item.id)
  const [id] = ids.splice(from, 1)
  ids.splice(to, 0, id)
  return mutate(() => $fetch('/api/admin/music-source-plugins/order', { method: 'PUT', body: { ids, revision: revision.value } }), id)
}
const move = (index, delta) => reorder(index, index + delta)
const resetDrag = () => { draggedIndex = -1; dragOverIndex.value = -1 }
function handleDragStart(event, index) {
  if (busy.value) return
  draggedIndex = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
  setTimeout(() => event.target.classList.add('opacity-50'), 0)
}
function handleDragLeave(event) {
  if (draggedIndex === -1) return
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) dragOverIndex.value = -1
}
function handleDragEnter(index) {
  if (draggedIndex !== -1) dragOverIndex.value = index
}
function handleDragEnd(event) {
  event.target.classList.remove('opacity-50')
  resetDrag()
}
function handleDrop(event, index) {
  event.preventDefault()
  const from = draggedIndex
  resetDrag()
  if (from !== -1) reorder(from, index)
}
function askRemove(item) {
  error.value = ''
  removeTarget.value = item
  showRemove.value = true
}
async function confirmRemove() {
  const target = removeTarget.value
  if (!target || busy.value) return
  removing.value = true
  try {
    await mutate(async () => {
      await $fetch(`/api/admin/music-source-plugins/${target.id}`, { method: 'DELETE', body: { revision: revision.value } })
      showRemove.value = false
      removeTarget.value = null
    }, target.id)
  } finally {
    removing.value = false
  }
}
onMounted(() => { if (user.value?.role === 'SUPER_ADMIN') load(); else loading.value = false })
</script>

<style scoped>
/* 插件音源拖拽排序过渡动画，与音源控制器的平台排序保持一致 */
.plugin-source-move,
.plugin-source-enter-active,
.plugin-source-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.plugin-source-enter-from,
.plugin-source-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.plugin-source-leave-active {
  position: absolute;
  width: 100%;
}
</style>
