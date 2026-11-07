<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
        @click="handleCancel"
      >
        <div
          class="bg-bg-secondary border border-border-secondary w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center gap-3 mb-3">
              <div
                class="w-10 h-10 rounded-xl bg-warning-10 flex items-center justify-center text-warning shrink-0"
              >
                <ShieldAlert :size="20" />
              </div>
              <h3 class="text-lg font-black text-text-primary tracking-tight">{{ locale.title }}</h3>
            </div>
            <p class="text-xs text-text-tertiary leading-relaxed mb-6">{{ resolvedDesc }}</p>

            <form class="space-y-4" @submit.prevent="submit">
              <div class="space-y-2">
                <label class="block text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1">
                  {{ locale.password }}
                </label>
                <input
                  v-model="password"
                  autocomplete="current-password"
                  class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                  :placeholder="locale.passwordPlaceholder"
                  type="password"
                >
              </div>

              <div v-if="requiresCode" class="space-y-2">
                <label class="block text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1">
                  {{ locale.code }}
                </label>
                <input
                  v-model="code"
                  autocomplete="one-time-code"
                  class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary tracking-[0.3em] font-black"
                  :placeholder="locale.codePlaceholder"
                  inputmode="numeric"
                  maxlength="6"
                  type="text"
                >
              </div>

              <div
                v-if="error"
                class="p-3 bg-error-10 border border-error-20 rounded-xl flex items-start gap-2 text-error text-xs"
              >
                <AlertCircle :size="14" class="shrink-0 mt-0.5" />
                <span>{{ error }}</span>
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest disabled:opacity-50"
                  :disabled="loading"
                  type="button"
                  @click="handleCancel"
                >
                  {{ locale.cancel }}
                </button>
                <button
                  class="flex-[2] px-6 py-4 bg-primary-hover hover:bg-primary text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  :disabled="loading || !password"
                  type="submit"
                >
                  <AppSpinner v-if="loading" :size="16" color="white" />
                  <ShieldCheck v-else :size="16" />
                  {{ loading ? locale.verifying : locale.verify }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { AlertCircle, ShieldAlert, ShieldCheck } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useAuth } from '~/composables/useAuth'
import { extractErrorCode, useServerErrors } from '~/composables/useLocaleText'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  reason: {
    type: String,
    default: 'super-admin-role'
  }
})

const emit = defineEmits(['update:show', 'verified', 'cancelled'])

const { admin } = useLocale()
const locale = computed(() => admin.value?.stepUpModal || {})
// 场景专描述缺失时回退到通用文案，避免接入新场景时描述误导
const resolvedDesc = computed(
  () => locale.value?.reasons?.[props.reason] || locale.value?.desc || ''
)
const auth = useAuth()
const { localize } = useServerErrors()

// 本地登录态可能落后于刚开启的双重认证，仅作为初始值，缺码时由服务端结论补位
const requiresCode = ref(false)

const password = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    requiresCode.value = !!auth.user.value?.has2FA
    password.value = ''
    code.value = ''
    loading.value = false
    error.value = ''
  }
)

const submit = async () => {
  if (loading.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/step-up', {
      method: 'POST',
      credentials: 'include',
      body: {
        reason: props.reason,
        password: password.value,
        ...(requiresCode.value ? { code: code.value } : {})
      }
    })
    emit('update:show', false)
    emit('verified')
  } catch (err) {
    // 服务端以库内 TOTP 身份为准，缺码时展开动态码输入供重新提交
    if (extractErrorCode(err) === 'AUTH_MISSING_REQUIRED_PARAMS') {
      requiresCode.value = true
      error.value = ''
    } else {
      error.value = localize(err)
    }
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  if (loading.value) return
  emit('update:show', false)
  emit('cancelled')
}
</script>
