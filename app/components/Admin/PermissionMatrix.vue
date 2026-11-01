<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <!-- 顶部标题与操作 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">{{ locale.desc }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all disabled:opacity-50"
          :disabled="!loaded || saving"
          @click="resetToDefault"
        >
          <RotateCcw :size="14" />
          {{ locale.resetDefault }}
        </button>
        <button
          class="flex items-center gap-2 px-5 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
          :disabled="!loaded || saving || !dirty"
          @click="save"
        >
          <AppSpinner v-if="saving" :size="14" :border-width="2" color="white" />
          <Save v-else :size="14" />
          {{ saving ? locale.saving : locale.save }}
        </button>
      </div>
    </div>

    <div v-if="!loaded" class="py-20 flex justify-center">
      <AppSpinner :size="32" :label="locale.loading" />
    </div>

    <template v-else>
      <!-- 概览指标 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="bg-bg-secondary-30 border border-border-secondary rounded-2xl px-5 py-4"
        >
          <p class="text-[10px] font-bold text-text-disabled uppercase tracking-[0.16em]">
            {{ metric.label }}
          </p>
          <p class="text-2xl font-black text-text-primary mt-1.5">{{ metric.value }}</p>
        </div>
      </div>

      <div class="overflow-x-auto bg-bg-secondary rounded-2xl border border-border-tertiary">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr class="border-b border-border-secondary">
              <th class="px-4 py-3 text-[10px] font-black text-text-disabled uppercase tracking-wider">
                {{ locale.code }}
              </th>
              <th class="px-2 py-3 text-[10px] font-black text-text-disabled uppercase tracking-wider text-right">
                {{ locale.holders }}
              </th>
              <th
                v-for="role in roles"
                :key="role"
                class="px-2 py-3 text-[10px] font-black text-text-disabled uppercase tracking-wider text-center"
              >
                <div>{{ roleLabel(role) }}</div>
                <div class="mt-0.5 font-bold normal-case tracking-normal text-text-tertiary">
                  {{ matrix.holdersByRole[role] || 0 }}
                  <span v-if="dirtyRoles.includes(role)" class="text-warning">·</span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody v-for="group in matrix.groups" :key="group.domain">
            <tr class="bg-bg-tertiary-30">
              <td
                :colspan="2 + roles.length"
                class="px-4 py-2 text-[10px] font-black text-text-secondary uppercase tracking-[0.14em]"
              >
                {{ domainLabel(group.domain) }}
              </td>
            </tr>
            <tr
              v-for="code in group.codes"
              :key="code"
              class="border-b border-border-secondary-50 hover:bg-bg-tertiary-30 transition-colors"
            >
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-bold text-text-primary">{{ code }}</span>
                  <span
                    v-if="isProtected(code)"
                    class="px-1.5 py-0.5 rounded text-[9px] font-black bg-warning-10 text-warning"
                  >
                    {{ locale.protectedBadge }}
                  </span>
                  <span
                    v-if="differsFromDefault(code)"
                    class="w-1.5 h-1.5 rounded-full bg-primary"
                    :title="locale.changed"
                  />
                </div>
              </td>
              <td class="px-2 py-2 text-right text-[11px] font-bold text-text-tertiary">
                {{ matrix.codeHolders[code] || 0 }}
              </td>
              <td v-for="role in roles" :key="role" class="px-2 py-2 text-center">
                <label class="inline-flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="w-3.5 h-3.5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    :checked="holds(role, code)"
                    :disabled="saving"
                    @change="toggle(role, code)"
                  >
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-[11px] text-text-tertiary">{{ locale.superAdminNote }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RotateCcw, Save } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { ADMIN_PERMISSION_CODES, hasPermission } from '~/utils/admin-permissions'

const { admin } = useLocale()
const locale = computed(() => admin.value?.permissionMatrix || {})
const { msg: getLocaleMessage } = useLocaleText(locale)
const { showToast } = useToast()
const { localize: localizeServerError } = useServerErrors()

const roles = ref([])
const matrix = ref({
  roles: [],
  groups: [],
  templates: {},
  defaults: {},
  codeHolders: {},
  holdersByRole: {},
  protectedCodes: [],
  customizedRoles: [],
  explicitGrantUsers: 0,
  holderTotal: 0
})
const saved = ref({})
const draft = ref({})
const loaded = ref(false)
const saving = ref(false)

const roleLabels = computed(() => admin.value?.sidebar?.roles || {})

const roleLabel = (role) => roleLabels.value[role] || role

const domainLabel = (domain) =>
  locale.value?.domains?.[domain] || getLocaleMessage('domainFallback', domain)

const isProtected = (code) => matrix.value.protectedCodes.includes(code)

const holds = (role, code) => hasPermission(draft.value[role] || [], code)

const differsFromDefault = (code) =>
  matrix.value.roles.some(
    (role) =>
      hasPermission(matrix.value.templates[role] || [], code) !==
      hasPermission(matrix.value.defaults[role] || [], code)
  )

const dirtyRoles = computed(() =>
  matrix.value.roles.filter(
    (role) => (draft.value[role] || []).join(',') !== (saved.value[role] || []).join(',')
  )
)
const dirty = computed(() => dirtyRoles.value.length > 0)

const metrics = computed(() => [
  { label: locale.value.activeHolders, value: matrix.value.holderTotal },
  { label: locale.value.explicitGrantUsers, value: matrix.value.explicitGrantUsers },
  { label: locale.value.customizedRoles, value: matrix.value.customizedRoles.length },
  { label: locale.value.unsavedRoles, value: dirtyRoles.value.length }
])

// 通配列首次编辑时展开为等价的显式清单，避免勾选框无法表达 *
const expandWildcards = (role) => {
  const tokens = draft.value[role] || []
  if (!tokens.includes('*')) return
  const denies = tokens.filter((token) => token.startsWith('!'))
  draft.value[role] = [...ADMIN_PERMISSION_CODES, ...denies]
}

const toggle = (role, code) => {
  expandWildcards(role)
  const tokens = draft.value[role] || []
  if (hasPermission(tokens, code)) {
    const next = tokens.filter((token) => token !== code && token !== `!${code}`)
    // 通配符仍覆盖该码时补一条显式拒绝，保证取消勾选确实生效
    if (hasPermission(next, code)) next.push(`!${code}`)
    draft.value[role] = next
  } else {
    draft.value[role] = [...tokens.filter((token) => token !== `!${code}`), code]
  }
}

const resetToDefault = () => {
  draft.value = Object.fromEntries(
    matrix.value.roles.map((role) => [role, [...(matrix.value.defaults[role] || [])]])
  )
  showToast(getLocaleMessage('resetHint'), 'info')
}

const applyMatrix = (payload) => {
  matrix.value = payload
  roles.value = payload.roles
  saved.value = Object.fromEntries(payload.roles.map((role) => [role, [...payload.templates[role]]]))
  draft.value = Object.fromEntries(payload.roles.map((role) => [role, [...payload.templates[role]]]))
  loaded.value = true
}

const reload = async () => {
  try {
    const res = await $fetch('/api/admin/permissions/matrix')
    applyMatrix(res.matrix)
  } catch (error) {
    showToast(localizeServerError(error, getLocaleMessage('loadFailed')), 'error')
  }
}

const save = async () => {
  saving.value = true
  try {
    const res = await $fetch('/api/admin/permissions/matrix', {
      method: 'PUT',
      body: { templates: draft.value }
    })
    applyMatrix(res.matrix)
    showToast(getLocaleMessage('saved'), 'success')
  } catch (error) {
    showToast(localizeServerError(error, getLocaleMessage('saveFailed')), 'error')
    // 安全阀拒绝后回到服务端现状，避免界面停留在不可提交的草稿
    await reload()
  } finally {
    saving.value = false
  }
}

onMounted(reload)
</script>
