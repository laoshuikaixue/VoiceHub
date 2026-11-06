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
          class="bg-bg-secondary border border-border-secondary w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          @click.stop
        >
          <div class="p-8 pb-4 flex items-center justify-between border-b border-border-secondary-50">
            <div>
              <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary-10 flex items-center justify-center text-primary">
                  <ShieldCheck :size="20" />
                </div>
                {{ locale.title }}
              </h3>
              <p class="text-xs text-text-tertiary mt-1 ml-13">
                {{ user?.name || user?.username || '' }} ·
                {{ roleLabels[user?.role] || user?.role || '' }}
              </p>
            </div>
            <button
              class="flex items-center justify-center p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all"
              @click="$emit('close')"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
            <div v-if="loading" class="py-16 flex justify-center">
              <AppSpinner :size="28" :label="locale.loading" />
            </div>

            <template v-else-if="detail">
              <label
                class="flex items-start gap-3 p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl cursor-pointer"
              >
                <input
                  v-model="follow"
                  type="checkbox"
                  class="mt-0.5 w-3.5 h-3.5 rounded border-border-secondary bg-bg-secondary"
                >
                <div>
                  <p class="text-xs font-black text-text-primary">{{ locale.followTemplate }}</p>
                  <p class="text-[10px] text-text-tertiary mt-1">{{ locale.followTemplateDesc }}</p>
                </div>
              </label>

              <div class="flex items-center gap-4 mt-4 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <span>{{ grantSummary }}</span>
                <span>{{ denySummary }}</span>
                <span>{{ effectiveSummary }}</span>
              </div>

              <div v-if="!follow" class="mt-5 space-y-5">
                <div v-for="group in detail.groups" :key="group.domain">
                  <h4 class="text-[10px] font-black text-text-disabled uppercase tracking-[0.14em] mb-2">
                    {{ domainLabel(group.domain) }}
                  </h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      v-for="code in group.codes"
                      :key="code"
                      class="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
                      :class="[
                        holds(code)
                          ? 'bg-primary-5 border-primary-30'
                          : 'bg-bg-primary border-border-secondary-50',
                        canGrant(code) ? 'cursor-pointer hover:border-border-tertiary' : 'opacity-50 cursor-not-allowed'
                      ]"
                      :title="isPermissionDenied(templateTokens, code) ? locale.templateDenied : canGrant(code) ? '' : locale.cannotGrant"
                    >
                      <input
                        type="checkbox"
                        class="w-3.5 h-3.5 rounded border-border-secondary bg-bg-secondary shrink-0 disabled:cursor-not-allowed"
                        :checked="holds(code)"
                        :disabled="!canGrant(code)"
                        @change="toggle(code)"
                      >
                      <span
                        class="text-[11px] font-bold truncate"
                        :class="holds(code) ? 'text-primary' : 'text-text-secondary'"
                      >
                        {{ code }}
                      </span>
                      <span
                        v-if="fromTemplate(code)"
                        class="ml-auto shrink-0 text-[9px] font-black text-text-disabled uppercase"
                      >
                        {{ locale.fromTemplate }}
                      </span>
                      <span
                        v-else-if="isProtected(code)"
                        class="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black bg-warning-10 text-warning"
                      >
                        {{ locale.protectedBadge }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </template>

            <div v-else class="py-16 flex flex-col items-center justify-center gap-3 text-text-disabled">
              <ShieldOff :size="28" class="opacity-60" />
              <p class="text-xs font-medium">{{ locale.loadFailed }}</p>
            </div>
          </div>

          <div class="p-8 pt-4 border-t border-border-secondary-50 flex justify-end gap-2">
            <button
              class="px-4 py-2 text-xs font-bold rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
              @click="$emit('close')"
            >
              {{ locale.cancel }}
            </button>
            <button
              class="flex items-center gap-2 px-5 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
              :disabled="loading || saving || !detail"
              @click="save"
            >
              <AppSpinner v-if="saving" :size="14" :border-width="2" color="white" />
              {{ saving ? locale.saving : locale.save }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ShieldCheck, ShieldOff, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { usePermissions } from '~/composables/usePermissions'
import { ADMIN_PERMISSION_CODES, hasPermission, isPermissionDenied, toggleExplicitPermission } from '~/utils/admin-permissions'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'saved'])

const { admin } = useLocale()
const locale = computed(() => admin.value?.userPermissions || {})
const { msg: getLocaleMessage } = useLocaleText(locale)
const { showToast } = useToast()
const { localize: localizeServerError } = useServerErrors()
const { perms: operatorPerms } = usePermissions()

const roleLabels = computed(() => admin.value?.sidebar?.roles || {})

const detail = ref(null)
const loading = ref(false)
const saving = ref(false)
const follow = ref(true)
const explicit = ref([])

const templateTokens = computed(() => detail.value?.template || [])
const explicitGrants = computed(() => explicit.value.filter((token) => !token.startsWith('!')))
const explicitDenies = computed(() => explicit.value.filter((token) => token.startsWith('!')))
const effectiveTokens = computed(() => (follow.value ? templateTokens.value : [...templateTokens.value, ...explicit.value]))

const grantSummary = computed(() => getLocaleMessage('grantCount', explicitGrants.value.length))
const denySummary = computed(() => getLocaleMessage('denyCount', explicitDenies.value.length))
// 有效权限按判定口径统计（显式拒绝会抵消同码授予），不能直接数 token 长度
const effectiveSummary = computed(
  () => getLocaleMessage('effectiveCount', ADMIN_PERMISSION_CODES.filter((code) => holds(code)).length)
)

function holds(code) {
  return hasPermission(effectiveTokens.value, code)
}
const fromTemplate = (code) => hasPermission(templateTokens.value, code)
const isProtected = (code) => (detail.value?.protectedCodes || []).includes(code)
const canGrant = (code) => hasPermission(operatorPerms.value, code) && !isPermissionDenied(templateTokens.value, code)

// 域名中文标签与权限矩阵页共用同一分区，避免词典重复
const roleDomains = computed(() => admin.value?.permissionMatrix?.domains || {})
const domainLabel = (domain) => roleDomains.value[domain] || domain

const toggle = (code) => {
  explicit.value = toggleExplicitPermission(templateTokens.value, explicit.value, code)
}

const load = async () => {
  if (!props.user?.id) return
  loading.value = true
  detail.value = null
  try {
    const res = await $fetch('/api/admin/users/' + props.user.id + '/permissions')
    detail.value = res
    follow.value = res.followsTemplate
    explicit.value = [...res.explicit.grants, ...res.explicit.denies.map((code) => `!${code}`)]
  } catch (error) {
    showToast(localizeServerError(error, getLocaleMessage('loadFailed')), 'error')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await $fetch('/api/admin/users/' + props.user.id + '/permissions', {
      method: 'PUT',
      body: { permissions: follow.value ? null : explicit.value }
    })
    showToast(getLocaleMessage('saved'), 'success')
    emit('saved')
    emit('close')
  } catch (error) {
    showToast(localizeServerError(error, getLocaleMessage('saveFailed')), 'error')
    await load()
  } finally {
    saving.value = false
  }
}

watch(
  () => [props.show, props.user?.id],
  () => {
    if (props.show) load()
  },
  { immediate: true }
)
</script>
