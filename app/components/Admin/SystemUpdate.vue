<template>
  <section class="space-y-5 rounded-2xl border border-border-secondary bg-bg-secondary p-5 sm:p-6">
    <h2 class="text-xl font-bold text-text-primary">{{ locale.title }}</h2>
    <p v-if="status && !status.enabled" class="text-sm text-text-secondary">{{ locale.disabled }}</p>
    <template v-if="status?.enabled">
      <dl class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl bg-bg-tertiary p-4">
          <dt class="text-sm text-text-secondary">{{ locale.current }}</dt>
          <dd class="mt-1 font-mono text-text-primary">{{ status.current }}</dd>
        </div>
        <div class="rounded-xl bg-bg-tertiary p-4">
          <dt class="text-sm text-text-secondary">{{ locale.previous }}</dt>
          <dd class="mt-1 font-mono text-text-primary">{{ status.previous || locale.none }}</dd>
        </div>
      </dl>
      <p v-if="status.backup" class="break-all text-sm text-text-secondary">{{ locale.backup }} {{ status.backup }}</p>
      <p class="text-sm text-text-secondary">{{ locale.hint }}</p>
      <label class="block max-w-lg text-sm text-text-primary">
        {{ locale.choose }}
        <input
          ref="fileInput"
          class="mt-2 block w-full rounded-lg border border-border-secondary bg-bg-tertiary p-2"
          type="file"
          accept=".vhu,application/octet-stream"
          :disabled="busy"
          @change="file = $event.target.files?.[0] || null"
        />
      </label>
      <div class="flex flex-wrap gap-3">
        <button type="button" class="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50" :disabled="busy || !file" @click="action = 'install'">
          {{ locale.install }}
        </button>
        <button type="button" class="rounded-lg bg-bg-tertiary px-4 py-2 text-text-primary disabled:opacity-50" :disabled="busy || !status.previous" @click="action = 'rollback'">
          {{ locale.rollback }}
        </button>
        <button v-if="status.status === 'succeeded'" type="button" class="rounded-lg bg-bg-tertiary px-4 py-2 text-text-primary" @click="reload">
          {{ locale.reload }}
        </button>
      </div>
    </template>
    <div class="flex flex-wrap items-center gap-3" aria-live="polite">
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      <p v-else-if="uploading" class="text-sm text-text-secondary">{{ locale.uploading }}</p>
      <p v-else-if="busy" class="text-sm text-text-secondary">{{ locale.applying }}</p>
      <p v-else-if="status?.status && status.status !== 'idle'" class="text-sm text-text-secondary">
        {{ status.status === 'failed' && status.failure === 'backup' ? locale.backupFailed : locale[status.status] }}
      </p>
      <button v-if="!busy" type="button" class="rounded-lg bg-bg-tertiary px-4 py-2 text-sm text-text-primary" @click="refresh">
        {{ locale.refresh }}
      </button>
    </div>
    <ConfirmDialog
      :show="!!action"
      :title="action === 'rollback' ? locale.rollback : locale.install"
      :message="locale.confirm"
      type="warning"
      @cancel="action = null"
      @confirm="submit"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useAuth } from '~/composables/useAuth'
import { useServerErrors } from '~/composables/useLocaleText'
import { useLocale } from '~/utils/locale'

const auth = useAuth()
const serverErrors = useServerErrors()
const { admin } = useLocale()
const locale = computed(() => admin.value.systemUpdate)
const status = ref(null)
const file = ref(null)
const fileInput = ref(null)
const action = ref(null)
const error = ref('')
const uploading = ref(false)
const pending = ref(null)
const busy = computed(() => uploading.value || pending.value || status.value?.status === 'applying')
let timer
let refreshInFlight = false
let unavailablePolls = 0

async function refresh() {
  if (refreshInFlight) return
  refreshInFlight = true
  try {
    const result = await $fetch('/api/admin/system-update', { ...auth.getAuthConfig(), timeout: 3500, retry: 0 })
    status.value = result
    unavailablePolls = 0
    if (pending.value && result.requestId === pending.value && result.status !== 'applying') pending.value = null
    if (error.value === locale.value.unavailable) error.value = ''
  } catch {
    unavailablePolls++
    if (!busy.value || unavailablePolls >= 30) {
      error.value = locale.value.unavailable
      pending.value = null
    }
  } finally {
    refreshInFlight = false
  }
}

async function submit() {
  const operation = action.value
  action.value = null
  if (!operation || busy.value) return
  error.value = ''
  uploading.value = true
  try {
    const config = auth.getAuthConfig()
    const body = operation === 'install' ? file.value : undefined
    const headers = new Headers(config.headers)
    if (body) headers.set('Content-Type', 'application/octet-stream')
    const result = await $fetch('/api/admin/system-update', {
      ...config, headers, body, method: 'POST', query: { action: operation }, retry: 0
    })
    pending.value = result.requestId
    if (fileInput.value) fileInput.value.value = ''
    file.value = null
  } catch (cause) {
    error.value = serverErrors.localize(cause)
  } finally {
    uploading.value = false
  }
  if (pending.value) await refresh()
}

function reload() {
  window.location.reload()
}

onMounted(() => {
  void refresh()
  timer = setInterval(() => {
    if (pending.value || status.value?.status === 'applying') void refresh()
  }, 2000)
})
onUnmounted(() => clearInterval(timer))
</script>
