<template>
  <div class="space-y-3">
    <!-- 搜索：命中时切换为平铺结果，未搜索时展示组织树 -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
        <input
          v-model="keyword"
          type="text"
          :placeholder="locale.assignSearchUserPlaceholder"
          class="w-full rounded-xl border border-border-secondary bg-bg-primary py-2.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-40 focus:outline-none"
          @input="handleKeywordInput"
        >
        <button
          v-if="keyword"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-tertiary hover:text-text-primary"
          @click="clearKeyword"
        >
          <X :size="14" />
        </button>
      </div>
      <button
        v-if="modelValue.length"
        type="button"
        class="shrink-0 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary hover:text-text-primary"
        @click="clearAll"
      >
        {{ locale.assignClearRecipients }}
      </button>
    </div>

    <!-- 搜索命中：直接勾选，不受树层级限制 -->
    <div v-if="keyword.trim()" class="rounded-xl border border-border-secondary bg-bg-primary">
      <div class="flex items-center justify-between gap-2 border-b border-border-secondary px-3 py-2">
        <p class="text-[11px] font-bold text-text-tertiary">
          <AppSpinner v-if="searching" :size="13" class="mr-1 align-middle" />
          {{ searching ? locale.assignSearching : getMessage('assignSearchResultCount', searchResults.length) }}
        </p>
        <button
          v-if="searchResults.length"
          type="button"
          class="text-[11px] font-bold text-primary hover:text-primary-hover"
          @click="selectAllSearchResults"
        >
          {{ locale.assignSelectAllResults }}
        </button>
      </div>
      <div class="max-h-[320px] overflow-y-auto p-1">
        <button
          v-for="user in searchResults"
          :key="user.id"
          type="button"
          class="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-tertiary-50 sm:min-h-0"
          @click="toggleUser(user)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black"
            :class="isSelected(user.id) ? 'border-primary bg-primary text-text-primary' : 'border-border-tertiary'"
          >
            {{ isSelected(user.id) ? '✓' : '' }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-text-primary">{{ user.name || user.username }}</span>
            <span class="block truncate text-[11px] text-text-tertiary">
              @{{ user.username }}
              <template v-if="user.grade || user.class"> · {{ [user.grade, user.class].filter(Boolean).join(' · ') }}</template>
            </span>
          </span>
        </button>
        <p v-if="!searching && !searchResults.length" class="px-3 py-6 text-center text-xs text-text-tertiary">
          {{ locale.assignSearchEmpty }}
        </p>
      </div>
    </div>

    <!-- 组织树：年级 → 班级 → 用户 -->
    <div v-else class="rounded-xl border border-border-secondary bg-bg-primary">
      <div class="flex items-center justify-between gap-2 border-b border-border-secondary px-3 py-2">
        <p class="text-[11px] font-bold text-text-tertiary">
          {{ getMessage('assignTreeSummary', treeTotal, modelValue.length) }}
        </p>
        <button
          type="button"
          class="flex items-center gap-1 text-[11px] font-bold text-text-tertiary hover:text-text-primary"
          :disabled="treeLoading"
          @click="fetchTree"
        >
          <RefreshCw :size="12" :class="{ 'animate-spin': treeLoading }" />
          {{ locale.assignTreeRefresh }}
        </button>
      </div>

      <div v-if="treeLoading && !tree.length" class="px-3 py-8 text-center text-xs text-text-tertiary">
        <AppSpinner :size="18" />
        {{ locale.assignPreviewLoading }}
      </div>
      <p v-else-if="!tree.length" class="px-3 py-8 text-center text-xs text-text-tertiary">
        {{ locale.assignTreeEmpty }}
      </p>

      <div v-else class="max-h-[340px] overflow-y-auto p-1.5">
        <div v-for="grade in tree" :key="grade.value" class="mb-0.5">
          <!-- 年级行 -->
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-tertiary-50 hover:text-text-primary sm:h-7 sm:w-7"
              :aria-label="locale.assignToggleExpand"
              @click="toggleGrade(grade.value)"
            >
              <ChevronDown v-if="expandedGrades.has(grade.value)" :size="15" />
              <ChevronRight v-else :size="15" />
            </button>
            <button
              type="button"
              class="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-bg-tertiary-50 sm:min-h-0 sm:py-1.5"
              @click="toggleGrade(grade.value)"
            >
              <span class="truncate text-sm font-bold text-text-primary sm:text-[13px]">{{ gradeLabel(grade.value) }}</span>
              <span class="shrink-0 text-[11px] font-black text-text-tertiary">{{ grade.userCount }}</span>
              <span
                v-if="gradeSelectedCount(grade) > 0"
                class="shrink-0 rounded-full bg-primary-10 px-1.5 py-0.5 text-[10px] font-black text-primary"
              >
                {{ getMessage('assignPickedCount', gradeSelectedCount(grade)) }}
              </span>
            </button>
            <button
              type="button"
              class="flex min-h-[36px] shrink-0 items-center rounded-lg px-2 text-[11px] font-bold text-text-tertiary transition-colors hover:bg-bg-tertiary-50 hover:text-primary"
              @click="selectWholeGrade(grade)"
            >
              {{ locale.assignSelectWholeGrade }}
            </button>
          </div>

          <!-- 班级列表 -->
          <div v-if="expandedGrades.has(grade.value)" class="ml-4 border-l border-border-secondary pl-2">
            <div v-for="cls in grade.classes" :key="`${grade.value}|${cls.value}`">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-tertiary-50 hover:text-text-primary sm:h-7 sm:w-7"
                  :aria-label="locale.assignToggleExpand"
                  @click="toggleClass(grade.value, cls.value)"
                >
                  <ChevronDown v-if="expandedClasses.has(classKey(grade.value, cls.value))" :size="15" />
                  <ChevronRight v-else :size="15" />
                </button>
                <button
                  type="button"
                  class="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-bg-tertiary-50 sm:min-h-0 sm:py-1.5"
                  @click="toggleClass(grade.value, cls.value)"
                >
                  <span class="truncate text-[13px] font-bold text-text-secondary">{{ className(cls.value) }}</span>
                  <span class="shrink-0 text-[11px] font-black text-text-tertiary">{{ cls.userCount }}</span>
                  <span
                    v-if="classSelectedCount(grade.value, cls.value) > 0"
                    class="shrink-0 rounded-full bg-primary-10 px-1.5 py-0.5 text-[10px] font-black text-primary"
                  >
                    {{ getMessage('assignPickedCount', classSelectedCount(grade.value, cls.value)) }}
                  </span>
                </button>
                <button
                  type="button"
                  class="flex min-h-[36px] shrink-0 items-center rounded-lg px-2 text-[11px] font-bold text-text-tertiary transition-colors hover:bg-bg-tertiary-50 hover:text-primary"
                  @click="selectWholeClass(grade.value, cls.value)"
                >
                  {{ locale.assignSelectWholeClass }}
                </button>
              </div>

              <!-- 班级用户 -->
              <div v-if="expandedClasses.has(classKey(grade.value, cls.value))" class="ml-4 border-l border-border-secondary pl-2 pb-1">
                <p v-if="classLoading[classKey(grade.value, cls.value)]" class="px-2 py-3 text-[11px] text-text-tertiary">
                  {{ locale.assignPreviewLoading }}
                </p>
                <template v-else>
                  <button
                    v-for="user in classUsers[classKey(grade.value, cls.value)] || []"
                    :key="user.id"
                    type="button"
                    class="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-bg-tertiary-50 sm:min-h-0"
                    @click="toggleUser(user)"
                  >
                    <span
                      class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black"
                      :class="isSelected(user.id) ? 'border-primary bg-primary text-text-primary' : 'border-border-tertiary'"
                    >
                      {{ isSelected(user.id) ? '✓' : '' }}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                      {{ user.name || user.username }}
                    </span>
                    <span class="shrink-0 truncate text-[11px] text-text-tertiary">@{{ user.username }}</span>
                  </button>
                  <p
                    v-if="!(classUsers[classKey(grade.value, cls.value)] || []).length"
                    class="px-2 py-3 text-[11px] text-text-tertiary"
                  >
                    {{ locale.assignTreeClassEmpty }}
                  </p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 已选用户 -->
    <div v-if="modelValue.length" class="rounded-xl border border-info-20 bg-info-10 p-2.5">
      <p class="mb-2 text-[11px] font-black text-info">
        {{ getMessage('assignPickedSummary', modelValue.length) }}
      </p>
      <div class="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
        <span
          v-for="user in modelValue"
          :key="user.id"
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-info-20 bg-bg-primary px-2 py-1 text-[11px] font-bold text-text-secondary"
        >
          <span class="truncate">{{ user.name || user.username }}</span>
          <button type="button" class="shrink-0 text-text-tertiary hover:text-error" @click="removeUser(user.id)">
            <X :size="12" />
          </button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, ChevronRight, RefreshCw, Search, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useLocaleText } from '~/composables/useLocaleText'

/** 按组织树选择点歌券接收人。 */

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  max: {
    type: Number,
    default: 2000
  }
})

const emit = defineEmits(['update:modelValue'])

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const { msg: getMessage } = useLocaleText(locale)

/** 后端用这个值表示「未设置年级/班级」，与 recipients 接口的过滤参数一致 */
const UNSET_KEY = '__unset__'

const keyword = ref('')
const treeLoading = ref(false)
const tree = ref([])
const treeTotal = ref(0)
const expandedGrades = ref(new Set())
const expandedClasses = ref(new Set())
const classUsers = ref({})
const classLoading = ref({})

const searching = ref(false)
const searchResults = ref([])
let searchTimer = null

const selectedIds = computed(() => new Set(props.modelValue.map((item) => Number(item.id))))

const isSelected = (id) => selectedIds.value.has(Number(id))

const gradeLabel = (value) => (value === UNSET_KEY ? locale.value?.assignUnsetGrade || '未设置年级' : value)
const className = (value) => (value === UNSET_KEY ? locale.value?.assignUnsetClass || '未设置班级' : value)
const classKey = (gradeValue, classValue) => `${gradeValue}|${classValue}`

const classUsersOf = (gradeValue, classValue) => classUsers.value[classKey(gradeValue, classValue)] || []

const gradeSelectedCount = (grade) => {
  const ids = new Set()
  for (const cls of grade.classes) {
    for (const user of classUsersOf(grade.value, cls.value)) {
      if (isSelected(user.id)) ids.add(user.id)
    }
  }
  return ids.size
}

const classSelectedCount = (gradeValue, classValue) =>
  classUsersOf(gradeValue, classValue).filter((user) => isSelected(user.id)).length

const emitUsers = (users) => {
  emit('update:modelValue', users)
}

/** 追加式合并：保持已有顺序，去重，超出上限时明确告知而不是静默截断 */
const addUsers = (users) => {
  const map = new Map(props.modelValue.map((item) => [Number(item.id), item]))
  let overflow = false
  for (const user of users) {
    if (map.has(Number(user.id))) continue
    if (map.size >= props.max) {
      overflow = true
      break
    }
    map.set(Number(user.id), {
      id: Number(user.id),
      name: user.name || '',
      username: user.username || ''
    })
  }
  emitUsers([...map.values()])
  if (overflow) {
    showToast(getMessage('assignTooManyRecipients', props.max), 'warning')
  }
}

const removeUser = (id) => {
  emitUsers(props.modelValue.filter((item) => Number(item.id) !== Number(id)))
}

const clearAll = () => emitUsers([])

const fetchTree = async () => {
  treeLoading.value = true
  try {
    const res = await $fetch('/api/admin/card-codes/recipients-tree')
    tree.value = Array.isArray(res?.grades) ? res.grades : []
    treeTotal.value = Number(res?.total || 0)
  } catch (error) {
    console.error('加载组织树失败', error)
    showToast(locale.value?.assignTreeLoadFailed || '加载组织架构失败', 'error')
    tree.value = []
  } finally {
    treeLoading.value = false
  }
}

const toggleGrade = (value) => {
  const next = new Set(expandedGrades.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  expandedGrades.value = next
}

const loadClassUsers = async (gradeValue, classValue) => {
  const key = classKey(gradeValue, classValue)
  if (classUsers.value[key]) return
  classLoading.value = { ...classLoading.value, [key]: true }
  try {
    const query = new URLSearchParams({ grade: gradeValue, class: classValue, all: '1' })
    const res = await $fetch(`/api/admin/card-codes/recipients?${query.toString()}`)
    classUsers.value = { ...classUsers.value, [key]: Array.isArray(res?.data) ? res.data : [] }
  } catch (error) {
    console.error('加载班级用户失败', error)
    classUsers.value = { ...classUsers.value, [key]: [] }
    showToast(locale.value?.assignTreeLoadFailed || '加载班级用户失败', 'error')
  } finally {
    classLoading.value = { ...classLoading.value, [key]: false }
  }
}

const toggleClass = async (gradeValue, classValue) => {
  const key = classKey(gradeValue, classValue)
  const next = new Set(expandedClasses.value)
  if (next.has(key)) {
    next.delete(key)
    expandedClasses.value = next
    return
  }
  next.add(key)
  expandedClasses.value = next
  await loadClassUsers(gradeValue, classValue)
}

/** 整班或整年级全选。 */
const selectWholeClass = async (gradeValue, classValue) => {
  await loadClassUsers(gradeValue, classValue)
  const users = classUsersOf(gradeValue, classValue)
  if (!users.length) {
    showToast(locale.value?.assignTreeClassEmpty || '该班级暂无可派发用户', 'info')
    return
  }
  addUsers(users)
}

const selectWholeGrade = async (grade) => {
  for (const cls of grade.classes) {
    await loadClassUsers(grade.value, cls.value)
  }
  const users = grade.classes.flatMap((cls) => classUsersOf(grade.value, cls.value))
  if (!users.length) {
    showToast(locale.value?.assignTreeClassEmpty || '该年级暂无可派发用户', 'info')
    return
  }
  addUsers(users)
}

const toggleUser = (user) => {
  if (isSelected(user.id)) {
    removeUser(user.id)
    return
  }
  addUsers([user])
}

const runSearch = async () => {
  const term = keyword.value.trim()
  if (!term) {
    searchResults.value = []
    return
  }
  searching.value = true
  try {
    const query = new URLSearchParams({ q: term, all: '1' })
    const res = await $fetch(`/api/admin/card-codes/recipients?${query.toString()}`)
    searchResults.value = Array.isArray(res?.data) ? res.data : []
  } catch (error) {
    console.error('搜索接收人失败', error)
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

const handleKeywordInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  // 输入停顿 300ms 后查询。
  searchTimer = setTimeout(runSearch, 300)
}

const clearKeyword = () => {
  keyword.value = ''
  searchResults.value = []
  if (searchTimer) clearTimeout(searchTimer)
}

const selectAllSearchResults = () => {
  if (!searchResults.value.length) return
  addUsers(searchResults.value)
}

defineExpose({ refresh: fetchTree })

onMounted(fetchTree)
</script>
