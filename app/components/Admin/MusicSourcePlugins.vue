<template>
  <section v-if="user?.role === 'SUPER_ADMIN'" class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h3 class="text-sm font-bold text-text-primary">{{ t.title }}</h3><p class="text-xs text-text-tertiary mt-2">{{ snapshot ? t.snapshotHint : t.hotHint }}</p></div>
      <button class="px-4 py-2 rounded-lg bg-primary text-text-primary text-xs" :disabled="busy" @click="edit()">{{ t.add }}</button>
    </div>
    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <AppSpinner v-if="loading" :size="24" />
    <p v-else-if="!items.length" class="text-sm text-text-tertiary">{{ t.empty }}</p>
    <div class="max-h-[60vh] overflow-y-auto space-y-3">
      <div v-for="(item, index) in items" :key="item.id" :draggable="!busy" class="border border-border-secondary rounded-xl p-4 bg-bg-secondary-40" @dragstart="dragIndex = index" @dragover.prevent @drop.prevent="drop(index)">
        <div class="flex flex-wrap items-center gap-3">
          <Icon name="ListMusic" class="w-4 h-4 text-text-tertiary" />
          <span class="text-xs text-text-tertiary">{{ index + 1 }}</span>
          <span class="font-bold text-sm text-text-primary break-all flex-1">{{ item.name }}</span>
          <span class="text-xs text-text-tertiary">{{ item.capability?.protocol || item.protocol }}</span>
          <button role="switch" :aria-checked="item.enabled" :disabled="busy" class="px-3 py-1 rounded-full text-xs border" :class="item.enabled ? 'text-primary border-primary' : 'text-text-tertiary border-border-secondary'" @click="toggle(item)">{{ item.enabled ? t.enabled : t.disabled }}</button>
        </div>
        <p class="text-xs text-text-tertiary mt-2 break-all">{{ displayUrl(item.scriptUrl) }}</p>
        <div class="flex flex-wrap gap-2 mt-3 text-xs text-text-secondary">
          <span>{{ status(item) }}</span>
          <span v-if="item.capability">{{ Object.keys(item.capability.sources).join(' / ') }}</span>
        </div>
        <div class="flex flex-wrap gap-3 mt-3 text-xs text-primary">
          <button :disabled="busy || index === 0" :aria-label="t.up" @click="move(index, -1)">↑</button>
          <button :disabled="busy || index === items.length - 1" :aria-label="t.down" @click="move(index, 1)">↓</button>
          <button :disabled="busy" @click="edit(item)">{{ t.edit }}</button>
          <button :disabled="busy || !item.activeRevision" @click="test(item)">{{ t.test }}</button>
          <button :disabled="busy" @click="refresh(item)">{{ snapshot ? t.deployRequired : t.refresh }}</button>
          <button :disabled="busy" @click="remove(item)">{{ t.remove }}</button>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4" @click.self="!busy && (open = false)">
        <form class="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-bg-primary border border-border-secondary p-6 space-y-4" @submit.prevent="save">
          <h3 class="text-lg font-bold text-text-primary">{{ form.id ? t.edit : t.add }}</h3>
          <label class="block text-xs text-text-secondary">{{ t.name }}<input v-model="form.name" required maxlength="100" class="mt-2 w-full p-3 rounded-lg bg-bg-secondary border border-border-secondary text-text-primary" /></label>
          <label class="block text-xs text-text-secondary">{{ t.url }}<input v-model="form.scriptUrl" required type="url" class="mt-2 w-full p-3 rounded-lg bg-bg-secondary border border-border-secondary text-text-primary" /></label>
          <CustomSelect v-model="form.protocol" :options="protocolOptions" :label="t.protocol" />
          <CustomSelect v-model="form.catalog" :options="catalogOptions" :label="t.catalog" />
          <p class="text-xs text-text-tertiary">{{ t.catalogHint }}</p>
          <label class="block text-xs text-text-secondary">{{ t.variables }}<textarea v-model="form.variablesText" rows="4" class="mt-2 w-full p-3 rounded-lg bg-bg-secondary border border-border-secondary text-text-primary font-mono" placeholder="{}" /></label>
          <p class="text-xs text-text-tertiary">{{ t.variablesHint }}</p>
          <label class="block text-xs text-text-secondary">{{ t.legacy }}<input v-model="form.legacyPlatformKey" maxlength="100" class="mt-2 w-full p-3 rounded-lg bg-bg-secondary border border-border-secondary text-text-primary" /></label>
          <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
          <div class="flex justify-end gap-3"><button type="button" :disabled="busy" class="text-sm text-text-secondary" @click="open = false">{{ t.cancel }}</button><button type="submit" :disabled="busy" class="px-4 py-2 rounded-lg bg-primary text-text-primary text-sm flex items-center gap-2"><AppSpinner v-if="busy" :size="14" />{{ snapshot ? t.saveDeploy : t.saveLoad }}</button></div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useAuth } from '~/composables/useAuth'
import { useLocale } from '~/utils/locale'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { useServerErrors } from '~/composables/useLocaleText'
import { usePlatformConfig } from '~/composables/usePlatformConfig'

const { user } = useAuth()
const { admin } = useLocale()
const t = computed(() => useSafeLocale(admin.value.musicSourcePlugins))
const { localize } = useServerErrors()
const items = ref([])
const revision = ref(0)
const snapshot = ref(false)
const busy = ref(false)
const loading = ref(true)
const error = ref('')
const open = ref(false)
const dragIndex = ref(null)
const form = ref({})
const protocolOptions = computed(() => [{ value: 'auto', label: t.value.auto }, { value: 'lx', label: 'LX Music' }, { value: 'musicfree', label: 'MusicFree' }])
const catalogOptions = computed(() => [{ value: '', label: t.value.privateCatalog }, ...['netease', 'tencent', 'migu', 'kugou', 'kuwo'].map((value) => ({ value, label: value }))])
const displayUrl = (value) => { try { const url = new URL(value); return `${url.origin}${url.pathname}${url.search ? '?…' : ''}` } catch { return '' } }
const status = (item) => item.lastError ? `${t.value.failed}${item.activeRevision ? ` · ${t.value.active} ${item.activeRevision}` : ''}` : item.activeRevision === item.desiredRevision ? `${t.value.active} ${item.activeRevision}` : t.value.pending
async function load() {
  try {
    const response = await $fetch('/api/admin/music-source-plugins')
    items.value = response.data
    revision.value = response.revision
    snapshot.value = response.mode === 'snapshot'
  } catch (err) { error.value = localize(err) }
  finally { loading.value = false }
}
async function mutate(action) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await action(); await load(); await usePlatformConfig().refreshPlatformConfig() }
  catch (err) { error.value = localize(err); await load() }
  finally { busy.value = false }
}
function edit(item) {
  error.value = ''
  form.value = item ? { ...item, catalog: item.catalog || '', variablesText: '' } : { name: '', scriptUrl: '', protocol: 'auto', catalog: '', variablesText: '', legacyPlatformKey: '' }
  open.value = true
}
async function save() {
  let variables
  try { variables = form.value.variablesText.trim() ? JSON.parse(form.value.variablesText) : undefined }
  catch { error.value = t.value.invalidJson; return }
  await mutate(async () => {
    const id = form.value.id
    await $fetch(`/api/admin/music-source-plugins${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: { name: form.value.name, scriptUrl: form.value.scriptUrl, protocol: form.value.protocol, catalog: form.value.catalog || null, legacyPlatformKey: form.value.legacyPlatformKey || null, variables, revision: revision.value }, timeout: 30000 })
    open.value = false
  })
}
const toggle = (item) => mutate(() => $fetch(`/api/admin/music-source-plugins/${item.id}/enabled`, { method: 'PATCH', body: { enabled: !item.enabled, revision: revision.value } }))
const remove = (item) => mutate(() => $fetch(`/api/admin/music-source-plugins/${item.id}`, { method: 'DELETE', body: { revision: revision.value } }))
const refresh = (item) => mutate(() => $fetch(`/api/admin/music-source-plugins/${item.id}/refresh`, { method: 'POST', timeout: 30000 }))
const test = (item) => mutate(async () => {
  const result = await $fetch(`/api/admin/music-source-plugins/${item.id}/test`, { method: 'POST', timeout: 12000 })
  if (result.success) window.$showNotification?.(`${t.value.testPassed} · ${result.elapsed} ms`, 'success')
})
function drop(index) {
  if (dragIndex.value === null || busy.value) return
  const ids = items.value.map((item) => item.id)
  const [id] = ids.splice(dragIndex.value, 1)
  ids.splice(index, 0, id)
  dragIndex.value = null
  return mutate(() => $fetch('/api/admin/music-source-plugins/order', { method: 'PUT', body: { ids, revision: revision.value } }))
}
function move(index, delta) { dragIndex.value = index; return drop(index + delta) }
onMounted(() => { if (user.value?.role === 'SUPER_ADMIN') load(); else loading.value = false })
</script>
