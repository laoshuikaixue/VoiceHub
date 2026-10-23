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
        class="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
        @click="$emit('close')"
      >
        <div
          class="bg-bg-secondary border border-border-secondary w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          @click.stop
        >
          <div
            class="p-8 pb-4 flex items-center justify-between border-b border-border-secondary-50"
          >
            <div>
              <h3
                class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3"
              >
                <div
                  class="w-10 h-10 rounded-xl bg-primary-10 flex items-center justify-center text-primary"
                >
                  <FingerprintPattern :size="20" />
                </div>
                {{ locale.fingerprintBindingsTitle }}
              </h3>
              <p class="text-xs text-text-tertiary mt-1 ml-13">{{ locale.fingerprintBindingsDesc }}</p>
            </div>
            <button
              class="flex items-center justify-center p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all"
              @click="$emit('close')"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
            <div
              v-if="loading"
              class="py-16 flex items-center justify-center gap-2 text-xs text-text-tertiary"
            >
              <Loader2 :size="16" class="animate-spin" />
              <span>{{ locale.loading }}</span>
            </div>

            <div
              v-else-if="bindings.length === 0"
              class="py-16 flex flex-col items-center justify-center gap-3 text-text-disabled"
            >
              <FingerprintPattern :size="28" class="opacity-60" />
              <p class="text-xs font-medium">{{ locale.fingerprintBindingsEmpty }}</p>
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="item in bindings"
                :key="item.id"
                class="p-5 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-4"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="w-11 h-11 rounded-xl bg-bg-primary border border-border-secondary flex items-center justify-center text-text-secondary shrink-0"
                  >
                    <Monitor :size="20" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-black text-text-primary truncate">
                      {{ item.label || deviceName(item) }}
                    </div>
                    <div class="text-xs text-text-tertiary mt-0.5 truncate">
                      {{ deviceName(item) }}
                    </div>
                  </div>
                  <button
                    class="inline-flex items-center gap-2 shrink-0 px-3 py-2 border border-error-20 bg-error-10 hover:bg-error-20 text-error text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    :disabled="revokingId === item.id"
                    @click="revoke(item)"
                  >
                    <Loader2 v-if="revokingId === item.id" :size="13" class="animate-spin" />
                    <Trash2 v-else :size="13" />
                    {{ locale.revoke }}
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-[10px] font-black text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.fingerprintBoundAt }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1">
                      {{ formatDate(item.createdAt) }}
                    </div>
                  </div>
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-[10px] font-black text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.fingerprintLastUsed }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1">
                      {{ formatDate(item.lastUsedAt) }}
                    </div>
                  </div>
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-[10px] font-black text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.fingerprintLastIp }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1 break-all">
                      {{ item.lastUsedIp || '-' }}
                    </div>
                  </div>
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-[10px] font-black text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.fingerprintDevice }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1">
                      {{ deviceName(item) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FingerprintPattern, Loader2, Monitor, Trash2, X } from '@lucide/vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'
import { formatDateTime } from '~/utils/timeUtils'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  userId: {
    type: Number,
    default: null
  }
})

defineEmits(['close'])

const { admin, currentLocale } = useLocale()
const locale = computed(() => admin.value?.userManager?.detail || {})
const { localize: localizeServerError } = useServerErrors()
const { showToast } = useToast()

const bindings = ref([])
const loading = ref(false)
const revokingId = ref(null)

const deviceName = (item) =>
  [item.browser, item.operatingSystem, item.device].filter(Boolean).join(' · ') || '-'

const formatDate = (value) => {
  if (!value) return locale.value.fingerprintNever || '从未'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return locale.value.fingerprintNever || '从未'
  return new Intl.DateTimeFormat(currentLocale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

const loadBindings = async () => {
  if (!props.userId) return
  loading.value = true
  try {
    const detail = await $fetch(`/api/admin/users/${props.userId}`)
    bindings.value = detail?.browserFingerprints || []
  } catch (error) {
    console.error('获取浏览器指纹绑定失败:', error)
    bindings.value = []
    showToast(localizeServerError(error, locale.value.fingerprintLoadFailed), 'error')
  } finally {
    loading.value = false
  }
}

const revoke = async (item) => {
  if (!props.userId || revokingId.value) return
  revokingId.value = item.id
  try {
    await $fetch(`/api/admin/users/${props.userId}/fingerprints/${item.id}`, {
      method: 'DELETE'
    })
    showToast(locale.value.fingerprintRevokeSuccess, 'success')
    await loadBindings()
  } catch (error) {
    showToast(localizeServerError(error, locale.value.fingerprintRevokeFailed), 'error')
  } finally {
    revokingId.value = null
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) loadBindings()
    else bindings.value = []
  }
)
</script>
