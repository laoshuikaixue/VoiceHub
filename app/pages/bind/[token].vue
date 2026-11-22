<template>
  <div class="bg-bg-primary px-4 py-8 sm:py-14">
    <section class="mx-auto w-full max-w-xl space-y-5" aria-labelledby="bind-title">
      <header class="space-y-2">
        <h1 id="bind-title" class="text-xl font-bold text-text-primary">{{ msg('title') }}</h1>
        <p class="text-sm text-text-secondary">{{ msg('subtitle') }}</p>
      </header>

      <div v-if="loading" class="flex justify-center py-8">
        <AppSpinner :label="msg('loading')" />
      </div>

      <template v-else>
        <p v-if="requestError" role="alert" class="rounded-md bg-error-10 p-3 text-sm text-error">
          {{ localize(requestError, msg(preview ? 'failed' : 'invalid')) }}
        </p>

        <template v-if="preview">
          <dl class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-3 border-y border-border-secondary py-4 text-sm">
            <dt class="text-text-tertiary">{{ msg('account') }}</dt>
            <dd class="break-all font-semibold text-text-primary">
              <bdi>{{ preview.account.username }}</bdi>
              <span v-if="preview.account.name && preview.account.name !== preview.account.username" class="ml-2 font-normal text-text-secondary">
                <bdi>{{ preview.account.name }}</bdi>
              </span>
            </dd>
            <dt class="text-text-tertiary">{{ msg('platform') }}</dt>
            <dd class="text-text-primary">{{ platformLabel }}</dd>
            <dt class="text-text-tertiary">{{ msg('target') }}</dt>
            <dd class="break-all font-mono text-text-primary"><bdi>{{ preview.target.chatId }}</bdi></dd>
            <dt class="text-text-tertiary">{{ msg('botInstance') }}</dt>
            <dd class="break-all font-mono text-text-primary"><bdi>{{ preview.target.instance }}</bdi></dd>
            <dt class="text-text-tertiary">{{ msg('adapter') }}</dt>
            <dd class="break-all font-mono text-text-primary"><bdi>{{ preview.target.adapter }}</bdi></dd>
            <dt class="text-text-tertiary">{{ msg('current') }}</dt>
            <dd class="break-all text-text-primary">
              <template v-if="preview.current">
                <bdi class="font-mono">{{ preview.current.chatId }}</bdi>
                <span class="block text-xs text-text-tertiary">
                  <bdi>{{ preview.current.instance }}</bdi>
                  <span v-if="preview.current.boundAt"> · {{ preview.current.boundAt }}</span>
                </span>
              </template>
              <template v-else>{{ msg('notBound') }}</template>
            </dd>
            <dt class="text-text-tertiary">{{ msg('expiresAt') }}</dt>
            <dd class="text-text-primary">{{ preview.expiresAtDisplay }}</dd>
          </dl>

          <p v-if="done || preview.confirmedByMe" role="status" class="rounded-md bg-success-10 p-3 text-sm font-semibold text-success">
            {{ msg(done ? 'success' : 'alreadyBound') }}
          </p>
          <p v-else-if="preview.conflict" role="alert" class="rounded-md bg-error-10 p-3 text-sm text-error">
            {{ msg(preview.conflict === 'chat' ? 'chatConflict' : 'accountConflict') }}
          </p>

          <div class="space-y-1 text-sm text-text-secondary">
            <h2 class="font-semibold text-text-primary">{{ msg('access') }}</h2>
            <ul class="list-disc space-y-1 pl-5">
              <li>{{ msg('notificationAccess') }}</li>
              <li>{{ msg('songAccess') }}</li>
              <li>{{ msg('noPasswordAccess') }}</li>
            </ul>
          </div>
          <label v-if="canConfirm" class="flex items-start gap-2 text-sm text-text-primary">
            <input v-model="acknowledged" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-primary" :disabled="submitting" />
            <span>{{ msg('acknowledge') }}</span>
          </label>
        </template>

        <div class="flex flex-wrap items-center gap-3">
          <button
            v-if="canConfirm"
            type="button"
            :disabled="!acknowledged || submitting"
            class="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            @click="confirm"
          >
            {{ msg(submitting ? 'confirming' : 'confirm') }}
          </button>
          <NuxtLink to="/account" class="rounded-md bg-bg-tertiary px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-quaternary">
            {{ msg(canConfirm ? 'cancel' : 'backToAccount') }}
          </NuxtLink>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { useLocale } from '~/utils/locale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'

const route = useRoute()
const { pages } = useLocale()
const { msg } = useLocaleText(() => pages.value?.bindTicket)
const { t: platformText } = useLocaleText(() => pages.value?.account?.social?.astrbot?.platforms)
const { localize } = useServerErrors()

const token = computed(() => String(route.params.token || ''))
const loading = ref(true)
const submitting = ref(false)
const done = ref(false)
const acknowledged = ref(false)
const preview = ref(null)
const requestError = shallowRef(null)

const platformLabel = computed(() => platformText(preview.value?.platform, preview.value?.platform))
const canConfirm = computed(() => !!preview.value?.confirmation && !done.value)

const loadPreview = async (currentToken, _previous, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  loading.value = true
  preview.value = null
  requestError.value = null
  done.value = false
  acknowledged.value = false
  try {
    const data = await $fetch('/api/notifications/astrbot/bind-ticket', {
      query: { token: currentToken },
      signal: controller.signal
    })
    if (!controller.signal.aborted) preview.value = data
  } catch (error) {
    if (!controller.signal.aborted) requestError.value = error
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

const confirm = async () => {
  if (submitting.value || !canConfirm.value || !acknowledged.value) return
  const currentPreview = preview.value
  submitting.value = true
  requestError.value = null
  try {
    const result = await $fetch('/api/notifications/astrbot/bind-ticket', {
      method: 'POST',
      body: { token: token.value, confirmation: currentPreview.confirmation }
    })
    if (preview.value === currentPreview) {
      preview.value = { ...currentPreview, current: { ...currentPreview.target, boundAt: result.boundAt }, confirmation: null }
      done.value = true
    }
  } catch (error) {
    if (preview.value === currentPreview) requestError.value = error
  } finally {
    submitting.value = false
  }
}

if (import.meta.client) watch(token, loadPreview, { immediate: true })
</script>
