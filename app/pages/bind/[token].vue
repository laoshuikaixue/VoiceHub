<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
    <section class="space-y-5 rounded-2xl border border-border-secondary bg-bg-secondary-30 p-5 shadow-lg shadow-[0_10px_15px_var(--shadow-color)] sm:p-6" aria-labelledby="bind-title">
      <header class="flex items-start gap-3">
        <span class="flex shrink-0 items-center justify-center rounded-xl bg-primary-10 p-2.5 text-primary">
          <Icon name="user" :size="20" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h1 id="bind-title" class="text-base font-black text-text-primary">{{ msg('title') }}</h1>
          <p class="mt-1 text-sm text-text-tertiary">{{ msg('subtitle') }}</p>
        </div>
      </header>

      <div v-if="loading" class="flex justify-center py-8">
        <AppSpinner :label="msg('loading')" />
      </div>

      <template v-else>
        <p v-if="requestError" role="alert" class="rounded-md bg-error-10 p-3 text-sm text-error">
          {{ localize(requestError, msg(preview ? 'failed' : 'invalid')) }}
        </p>

        <template v-if="preview">
          <dl class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2.5 rounded-xl border border-border-secondary bg-bg-primary px-4 py-3 text-sm">
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
                <span class="block text-xs text-text-tertiary">
                  {{ msg(preview.current.passwordResetGranted ? 'resetGranted' : 'resetNotGranted') }}
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

          <fieldset class="min-w-0 space-y-3" :disabled="submitting">
            <legend class="mb-2 text-sm font-bold text-text-primary">{{ msg('access') }}</legend>
            <ul class="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              <li>{{ msg('notificationAccess') }}</li>
              <li>{{ msg('songAccess') }}</li>
            </ul>
            <template v-if="canConfirm">
              <div v-if="preview.passwordResetVerification" class="space-y-3 border-t border-border-secondary pt-3">
                <label class="flex items-start gap-2 text-sm text-text-primary">
                  <input v-model="allowPasswordReset" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-primary" aria-describedby="bind-reset-hint" />
                  <span class="font-semibold">{{ msg('resetOption') }}</span>
                </label>
                <p id="bind-reset-hint" class="ml-6 text-xs leading-relaxed text-text-tertiary">{{ msg('resetWarning') }}</p>
                <div v-if="allowPasswordReset" class="space-y-3">
                  <label class="block space-y-1.5 text-sm text-text-primary">
                    <span>{{ msg('currentPassword') }}</span>
                    <input v-model="password" type="password" maxlength="128" autocomplete="current-password"
                      class="w-full rounded-xl border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none" />
                  </label>
                  <label v-if="usesTotp" class="block space-y-1.5 text-sm text-text-primary">
                    <span>{{ msg('totp') }}</span>
                    <input v-model="code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
                      class="w-full rounded-xl border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none" />
                  </label>
                </div>
              </div>
              <p v-else class="text-xs text-text-tertiary">{{ msg('resetUnavailable') }}</p>
              <label class="flex items-start gap-2 text-sm text-text-primary">
                <input v-model="acknowledged" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                <span>{{ msg('acknowledge') }}</span>
              </label>
            </template>
          </fieldset>
        </template>

        <div class="flex flex-wrap items-center gap-3">
          <button
            v-if="canConfirm"
            type="button"
            :disabled="!readyToSubmit || submitting"
            class="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            @click="confirm"
          >
            {{ msg(submitting ? 'confirming' : 'confirm') }}
          </button>
          <NuxtLink to="/account" class="rounded-xl border border-border-secondary bg-bg-tertiary px-4 py-2.5 text-sm font-bold text-text-primary hover:bg-bg-quaternary">
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
import Icon from '~/components/UI/Icon.vue'

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
const allowPasswordReset = ref(false)
const password = ref('')
const code = ref('')
const preview = ref(null)
const requestError = shallowRef(null)

const platformLabel = computed(() => platformText(preview.value?.platform, preview.value?.platform))
const canConfirm = computed(() => !!preview.value?.confirmation && !done.value)
const usesTotp = computed(() => preview.value?.passwordResetVerification === 'totp')
const readyToSubmit = computed(() => acknowledged.value && (!allowPasswordReset.value ||
  (!!password.value && (!usesTotp.value || /^[0-9]{6}$/.test(code.value)))))

const clearCredentials = () => {
  password.value = ''
  code.value = ''
}
watch(allowPasswordReset, (allowed) => { if (!allowed) clearCredentials() })

const loadPreview = async (currentToken, _previous, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  loading.value = true
  preview.value = null
  requestError.value = null
  done.value = false
  acknowledged.value = false
  allowPasswordReset.value = false
  clearCredentials()
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
  if (submitting.value || !canConfirm.value || !readyToSubmit.value) return
  const currentPreview = preview.value
  submitting.value = true
  requestError.value = null
  try {
    const result = await $fetch('/api/notifications/astrbot/bind-ticket', {
      method: 'POST',
      body: {
        token: token.value,
        confirmation: currentPreview.confirmation,
        allowPasswordReset: allowPasswordReset.value,
        ...(allowPasswordReset.value ? { password: password.value, ...(usesTotp.value ? { code: code.value } : {}) } : {})
      }
    })
    if (preview.value === currentPreview) {
      preview.value = { ...currentPreview, current: { ...currentPreview.target,
        boundAt: result.boundAt, passwordResetGranted: result.passwordResetGranted }, confirmation: null }
      done.value = true
    }
  } catch (error) {
    if (preview.value === currentPreview) requestError.value = error
  } finally {
    clearCredentials()
    submitting.value = false
  }
}

if (import.meta.client) watch(token, loadPreview, { immediate: true })
</script>
