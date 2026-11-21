<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-bg-primary">
    <div
      class="w-full max-w-md rounded-2xl border border-border-secondary bg-bg-secondary-40 p-6 shadow-xl space-y-5"
    >
      <div class="space-y-2">
        <h1 class="text-lg font-black text-text-primary">{{ locale.title }}</h1>
        <p class="text-sm text-text-tertiary">{{ locale.subtitle }}</p>
      </div>

      <div v-if="loading" class="py-8 flex justify-center">
        <AppSpinner :label="locale.confirming" />
      </div>

      <div v-else-if="errorMessage" class="rounded-xl border border-error-20 bg-error-10 p-4">
        <p class="text-sm font-bold text-error">{{ errorMessage }}</p>
        <NuxtLink
          to="/account"
          class="inline-block mt-3 text-xs font-bold text-primary hover:underline"
        >
          {{ locale.backToAccount }}
        </NuxtLink>
      </div>

      <div v-else-if="done" class="rounded-xl border border-success-20 bg-success-10 p-4">
        <p class="text-sm font-bold text-success">
          {{ confirmedByMe ? locale.alreadyBound : locale.success }}
        </p>
        <NuxtLink
          to="/account"
          class="inline-block mt-3 text-xs font-bold text-primary hover:underline"
        >
          {{ locale.backToAccount }}
        </NuxtLink>
      </div>

      <template v-else>
        <dl class="rounded-xl border border-border-secondary bg-bg-primary-45 p-4 space-y-2">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-xs font-bold text-text-tertiary">{{ locale.platform }}</dt>
            <dd class="text-sm font-black text-text-primary">{{ platformLabel }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-xs font-bold text-text-tertiary">{{ locale.target }}</dt>
            <dd class="text-sm font-mono text-text-primary truncate">
              {{ preview?.boundUser || '-' }}
            </dd>
          </div>
        </dl>
        <p class="text-[11px] text-text-disabled">{{ locale.expiresHint }}</p>

        <div class="flex items-center gap-3">
          <button
            type="button"
            :disabled="submitting"
            class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all disabled:opacity-50"
            @click="confirm"
          >
            {{ submitting ? locale.confirming : locale.confirm }}
          </button>
          <NuxtLink
            to="/account"
            class="px-4 py-2.5 bg-bg-tertiary border border-border-secondary text-text-secondary text-sm font-bold rounded-xl hover:border-border-tertiary transition-all"
          >
            {{ locale.cancel }}
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'

const route = useRoute()
const { pages, account } = useLocale()
const { localize } = useServerErrors()
const locale = computed(() => pages.value?.bindTicket || {})

const token = computed(() => String(route.params.token || ''))
const loading = ref(true)
const submitting = ref(false)
const done = ref(false)
const confirmedByMe = ref(false)
const preview = ref(null)
const errorMessage = ref('')

const platformLabel = computed(() => {
  const key = preview.value?.platform
  if (!key) return '-'
  return account.value?.astrbot?.platforms?.[key] || key
})

const loadPreview = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch('/api/notifications/astrbot/bind-ticket', {
      query: { token: token.value }
    })
    preview.value = data
    // 同一账号已确认过：直接展示结果，不再提供确认按钮。
    if (data.confirmedByMe) {
      confirmedByMe.value = true
      done.value = true
    } else if (!data.available) {
      errorMessage.value = locale.value.invalid
    }
  } catch (error) {
    errorMessage.value = localize(error, locale.value.invalid)
  } finally {
    loading.value = false
  }
}

const confirm = async () => {
  submitting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/notifications/astrbot/bind-ticket', {
      method: 'POST',
      body: { token: token.value }
    })
    done.value = true
  } catch (error) {
    errorMessage.value = localize(error, locale.value.failed)
  } finally {
    submitting.value = false
  }
}

onMounted(loadPreview)
</script>
