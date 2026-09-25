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
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        @click.self="handleClose"
      >
        <div class="absolute inset-0 bg-bg-primary-60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-2xl bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-border-secondary-50">
            <div class="min-w-0 flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-primary-10 flex items-center justify-center text-primary shrink-0">
                <Download :size="20" />
              </div>
              <div class="min-w-0">
                <h3 class="text-lg font-black text-text-primary tracking-tight">{{ locale.title }}</h3>
                <p class="mt-0.5 text-[11px] font-bold text-text-tertiary truncate">{{ locale.desc }}</p>
              </div>
            </div>
            <button
              class="p-2 rounded-xl bg-bg-tertiary-50 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-all flex items-center justify-center shrink-0"
              @click="handleClose"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <!-- 筛选范围 -->
            <div class="space-y-3">
              <label class="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                {{ locale.scopeTitle }}
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CustomSelect
                  v-model="scopeValue"
                  :options="scopeOptions"
                  :label="locale.scope.label"
                  label-key="label"
                  value-key="value"
                />
                <CustomSelect
                  v-model="roleValue"
                  :options="roleFilterOptions"
                  :label="locale.filter.role"
                  label-key="label"
                  value-key="value"
                />
                <CustomSelect
                  v-model="gradeValue"
                  :options="gradeFilterOptions"
                  :label="locale.filter.grade"
                  label-key="label"
                  value-key="value"
                />
                <CustomSelect
                  v-model="classValue"
                  :options="classFilterOptions"
                  :label="locale.filter.class"
                  label-key="label"
                  value-key="value"
                />
                <CustomSelect
                  v-model="statusValue"
                  :options="statusFilterOptions"
                  :label="locale.filter.status"
                  label-key="label"
                  value-key="value"
                />
                <div class="relative flex items-center">
                  <Search
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none"
                    :size="14"
                  />
                  <input
                    v-model="searchValue"
                    class="w-full bg-bg-primary border border-border-secondary-80 rounded-lg pl-9 pr-3 py-2 text-[11px] font-bold text-text-primary focus:outline-none focus:border-primary-30 transition-all"
                    :placeholder="locale.filter.searchPlaceholder"
                    type="text"
                  >
                </div>
              </div>
            </div>

            <!-- 导出字段 -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                  {{ locale.fieldTitle }}
                </label>
                <div class="flex items-center gap-2">
                  <button
                    class="px-2 py-1 rounded-lg bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-secondary text-[10px] font-bold transition-colors"
                    @click="selectAllFields"
                  >
                    {{ locale.selectAll }}
                  </button>
                  <button
                    class="px-2 py-1 rounded-lg bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-secondary text-[10px] font-bold transition-colors"
                    @click="clearFields"
                  >
                    {{ locale.clearAll }}
                  </button>
                </div>
              </div>
              <div v-for="group in fieldGroups" :key="group.key" class="space-y-2">
                <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
                  {{ locale.groups[group.key] }}
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    v-for="fieldKey in group.fields"
                    :key="fieldKey"
                    type="button"
                    :class="[
                      'flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all text-left',
                      selectedFields.includes(fieldKey)
                        ? 'bg-primary-10 border-primary-30 text-primary'
                        : 'bg-bg-primary border-border-secondary text-text-tertiary hover:border-border-tertiary hover:text-text-secondary'
                    ]"
                    @click="toggleField(fieldKey)"
                  >
                    <span class="flex-1 truncate">{{ locale.fields[fieldKey] }}</span>
                    <Check v-if="selectedFields.includes(fieldKey)" class="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-3 p-6 border-t border-border-secondary-50">
            <div class="flex items-center gap-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              <span>{{ locale.columnCount(selectedFields.length) }}</span>
              <button
                v-if="!isDefaultSelection"
                class="px-2 py-1 rounded-lg bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-secondary transition-colors normal-case tracking-normal"
                @click="resetFields"
              >
                {{ locale.resetDefault }}
              </button>
            </div>
            <div class="flex-1" />
            <button
              class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              :disabled="exporting"
              @click="handleClose"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="selectedFields.length === 0 || exporting"
              class="flex items-center gap-2 px-5 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all uppercase tracking-wider active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              @click="handleExport"
            >
              <AppSpinner v-if="exporting" :size="14" color="white" />
              <FileSpreadsheet v-else class="w-3.5 h-3.5" />
              {{ exporting ? locale.exporting : locale.export }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Check, Download, FileSpreadsheet, Search, X } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useLocale } from '~/utils/locale'

// 与 server/utils/user-filter.ts 的 UNSET_FILTER_VALUE 保持一致
const UNSET_FILTER_VALUE = '__UNSET__'

const props = defineProps({
  show: { type: Boolean, default: false },
  exporting: { type: Boolean, default: false },
  grades: { type: Array, default: () => [] },
  classes: { type: Array, default: () => [] },
  roleOptions: { type: Array, default: () => [] },
  initialFilters: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'export'])

const { admin } = useLocale()
const userManager = computed(() => admin.value?.userManager || {})
const locale = computed(() => userManager.value?.exportModal || {})

const FIELD_GROUPS = [
  { key: 'basic', fields: ['id', 'username', 'name', 'role', 'grade', 'class', 'status'] },
  { key: 'contact', fields: ['email', 'emailVerified', 'meowNickname', 'remark'] },
  { key: 'login', fields: ['lastLogin', 'lastLoginIp'] },
  { key: 'time', fields: ['createdAt', 'updatedAt', 'statusChangedAt', 'passwordChangedAt', 'meowBoundAt', 'forcePasswordChange'] },
  { key: 'oauth', fields: ['providers'] }
]

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((group) => group.fields)
const DEFAULT_FIELDS = ['username', 'name', 'role', 'grade', 'class', 'status']

const selectedFields = ref([...DEFAULT_FIELDS])
const scopeValue = ref('0')
const roleValue = ref('')
const gradeValue = ref('')
const classValue = ref('')
const statusValue = ref('')
const searchValue = ref('')

// 打开时以当前列表筛选作为初始值
watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    const init = props.initialFilters || {}
    scopeValue.value = init.archived === '1' ? '1' : init.archived === '0' ? '0' : 'all'
    roleValue.value = init.role || ''
    gradeValue.value = init.grade || ''
    classValue.value = init.class || ''
    statusValue.value = init.status || ''
    searchValue.value = init.search || ''
  }
)

const scopeOptions = computed(() => [
  { label: locale.value.scope?.active, value: '0' },
  { label: locale.value.scope?.all, value: 'all' },
  { label: locale.value.scope?.archived, value: '1' }
])

const roleFilterOptions = computed(() => [
  { label: locale.value.filter?.allRoles, value: '' },
  ...props.roleOptions.map((role) => ({ label: role.displayName, value: role.name }))
])

const statusFilterOptions = computed(() => {
  const statuses = userManager.value?.statuses || {}
  return [
    { label: locale.value.filter?.allStatus, value: '' },
    { label: statuses.active, value: 'active' },
    { label: statuses.pending, value: 'pending' },
    { label: statuses.graduate, value: 'graduate' },
    { label: statuses.withdrawn, value: 'withdrawn' }
  ]
})

const gradeFilterOptions = computed(() => [
  { label: locale.value.filter?.allGrades, value: '' },
  ...props.grades.map((grade) => ({ label: grade, value: grade })),
  { label: locale.value.filter?.unsetGrade, value: UNSET_FILTER_VALUE }
])

const classFilterOptions = computed(() => {
  const base = [
    { label: locale.value.filter?.allClasses, value: '' },
    { label: locale.value.filter?.unsetClass, value: UNSET_FILTER_VALUE }
  ]
  let list = props.classes
  if (gradeValue.value && gradeValue.value !== UNSET_FILTER_VALUE) {
    list = props.classes.filter((item) => item.grade === gradeValue.value)
  }
  const seen = new Set()
  const classItems = []
  for (const item of list) {
    if (!item.class || seen.has(item.class)) continue
    seen.add(item.class)
    classItems.push({ label: item.class, value: item.class })
  }
  return [base[0], ...classItems, base[1]]
})

// 切换年级后，若已选班级不在新范围内则重置
watch(gradeValue, () => {
  if (!classValue.value || classValue.value === UNSET_FILTER_VALUE) return
  const valid = classFilterOptions.value.some((option) => option.value === classValue.value)
  if (!valid) classValue.value = ''
})

const fieldGroups = computed(() => FIELD_GROUPS)

const toggleField = (fieldKey) => {
  const index = selectedFields.value.indexOf(fieldKey)
  if (index >= 0) {
    selectedFields.value.splice(index, 1)
  } else {
    selectedFields.value.push(fieldKey)
  }
}

const selectAllFields = () => {
  selectedFields.value = [...ALL_FIELD_KEYS]
}

const clearFields = () => {
  selectedFields.value = []
}

const resetFields = () => {
  selectedFields.value = [...DEFAULT_FIELDS]
}

const isDefaultSelection = computed(
  () =>
    selectedFields.value.length === DEFAULT_FIELDS.length &&
    DEFAULT_FIELDS.every((fieldKey) => selectedFields.value.includes(fieldKey))
)

const handleClose = () => {
  if (props.exporting) return
  emit('close')
}

const handleExport = () => {
  if (selectedFields.value.length === 0 || props.exporting) return

  // 列顺序固定按字段定义顺序，与勾选先后无关
  const fields = selectedFields.value
    .slice()
    .sort((a, b) => ALL_FIELD_KEYS.indexOf(a) - ALL_FIELD_KEYS.indexOf(b))

  const filters = {
    grade: gradeValue.value || undefined,
    class: classValue.value || undefined,
    role: roleValue.value || undefined,
    status: statusValue.value || undefined,
    search: searchValue.value.trim() || undefined,
    archived: scopeValue.value === 'all' ? undefined : scopeValue.value
  }

  emit('export', { fields, filters })
}
</script>
