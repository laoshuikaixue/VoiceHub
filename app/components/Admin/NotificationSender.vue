<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">{{ locale.desc }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- 左侧：编辑区 -->
      <div class="lg:col-span-7 space-y-6">
        <div class="bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-8 shadow-xl">
          <div class="space-y-6">
            <!-- 标题 -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-[0.2em] px-1"
                >{{ locale.notificationTitle }}</label
              >
              <input
                v-model="form.title"
                type="text"
                :placeholder="locale.titlePlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary-30 transition-all text-text-primary placeholder:text-text-primary"
              >
            </div>

            <!-- 内容 -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-[0.2em] px-1"
                >{{ locale.notificationContent }}</label
              >
              <textarea
                v-model="form.content"
                :placeholder="locale.contentPlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-primary-30 transition-all text-text-primary placeholder:text-text-primary min-h-[160px] resize-none"
              />
              <p class="px-1 text-[10px] font-medium text-text-disabled">
                {{ locale.markdownHint }}
              </p>
            </div>

            <!-- 重要通知开关 -->
            <label
              class="flex cursor-pointer items-start gap-4 rounded-2xl border p-4 shadow-sm transition-colors"
              :class="
                form.important
                  ? 'border-primary-300 bg-primary-10'
                  : 'border-border-tertiary bg-bg-primary hover:border-border-quaternary hover:bg-bg-secondary'
              "
            >
              <span
                class="relative mt-0.5 inline-block h-6 w-11 shrink-0"
              >
                <input v-model="form.important" type="checkbox" class="peer sr-only">
                <span
                  class="absolute inset-0 rounded-full bg-border-tertiary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300"
                />
                <span
                  class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
                />
              </span>
              <span class="min-w-0">
                <span class="flex items-center gap-2 text-sm font-black text-text-primary">
                  <AlertTriangle
                    :size="16"
                    :class="form.important ? 'text-primary' : 'text-text-tertiary'"
                  />
                  {{ locale.importantToggleTitle }}
                </span>
                <span class="mt-1 block text-xs leading-relaxed text-text-secondary">
                  {{ locale.importantToggleDescription }}
                </span>
              </span>
            </label>

            <!-- 范围选择 -->
            <div class="space-y-3 pt-4 border-t border-border-secondary-50">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-[0.2em] px-1"
                >{{ locale.scope }}</label
              >
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="opt in targetOptions"
                  :key="opt.id"
                  :class="[
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border',
                    form.scope === opt.id
                      ? 'bg-primary-hover border-primary text-text-primary shadow-lg shadow-[var(--primary-glow)]'
                      : 'bg-bg-primary border-border-secondary text-text-tertiary hover:border-border-tertiary hover:text-text-secondary'
                  ]"
                  @click="form.scope = opt.id"
                >
                  <component :is="opt.icon" :size="14" />
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- 动态配置区 -->
            <div class="pt-2">
              <Transition name="fade" mode="out-in">
                <div
                  v-if="form.scope === 'ALL'"
                  key="all"
                  class="p-4 bg-primary-5 border border-primary-10 rounded-2xl flex items-center gap-4"
                >
                  <Info class="text-primary shrink-0" :size="18" />
                  <p class="text-[11px] font-bold text-text-tertiary">
                    {{ locale.allUsersHint }}
                  </p>
                </div>

                <div v-else-if="form.scope === 'GRADE'" key="grade" class="space-y-4">
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest px-1"
                      >{{ locale.selectGrade }}</span
                    >
                    <CustomSelect
                      v-model="form.grade"
                      :options="gradeOptions"
                      label-key="label"
                      value-key="value"
                      :placeholder="locale.selectGradePlaceholder"
                      class-name="w-full md:w-64"
                    />
                  </div>
                </div>

                <div
                  v-else-if="form.scope === 'CLASS'"
                  key="class"
                  class="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest px-1"
                      >{{ locale.grade }}</span
                    >
                    <CustomSelect
                      v-model="form.classGrade"
                      :options="gradeOptions"
                      label-key="label"
                      value-key="value"
                      :placeholder="locale.selectGradePlaceholder"
                      class-name="w-full"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest px-1"
                      >{{ locale.className }}</span
                    >
                    <CustomSelect
                      v-model="form.className"
                      :options="classOptionsForClassScope"
                      label-key="label"
                      value-key="value"
                      :placeholder="locale.selectClassPlaceholder"
                      class-name="w-full"
                      :disabled="!form.classGrade"
                    />
                  </div>
                </div>

                <div v-else-if="form.scope === 'MULTI_CLASS'" key="multi" class="space-y-4">
                  <div class="p-6 bg-bg-primary-50 border border-border-secondary border-dashed rounded-2xl">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <CustomSelect
                        v-model="multiClassForm.grade"
                        :options="gradeOptions"
                        label-key="label"
                        value-key="value"
                          :placeholder="locale.selectGradePlaceholder"
                        class-name="w-full"
                      />
                      <div class="flex gap-2">
                        <CustomSelect
                          v-model="multiClassForm.class"
                          :options="classOptionsForMultiClassScope"
                          label-key="label"
                          value-key="value"
                          :placeholder="locale.selectClassPlaceholder"
                          class-name="flex-1"
                          :disabled="!multiClassForm.grade"
                        />
                        <button
                          :disabled="!canAddClass"
                          class="px-4 bg-bg-tertiary hover:bg-bg-quaternary disabled:opacity-50 disabled:cursor-not-allowed text-text-tertiary font-bold rounded-xl text-xs transition-all"
                          @click="addClassToSelection"
                        >
                          {{ locale.add }}
                        </button>
                      </div>
                    </div>

                    <div v-if="form.selectedClasses.length > 0" class="flex flex-wrap gap-2">
                      <div
                        v-for="(cls, index) in form.selectedClasses"
                        :key="index"
                        class="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary border border-border-secondary rounded-lg group"
                      >
                        <span class="text-[10px] font-bold text-text-tertiary"
                          >{{ cls.grade }} {{ cls.class }}</span
                        >
                        <button
                          class="text-text-disabled hover:text-error transition-colors"
                          @click="removeClassFromSelection(index)"
                        >
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                    <div v-else class="text-center py-4">
                      <p class="text-[10px] font-black text-text-secondary uppercase tracking-widest">
                        {{ locale.noClassSelected }}
                      </p>
                    </div>
                  </div>
                </div>

                <div v-else-if="form.scope === 'SPECIFIC_USERS'" key="specific" class="space-y-4">
                  <div class="relative flex items-center">
                    <Search
                      v-if="!userSearchLoading"
                      class="absolute left-4 text-text-secondary pointer-events-none"
                      :size="16"
                    />
                    <Loader2
                      v-else
                      class="absolute left-4 text-primary animate-spin pointer-events-none"
                      :size="16"
                    />
                    <input
                      v-model="userSearchQuery"
                      type="text"
                      :placeholder="locale.userSearchPlaceholder"
                      class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                      @input="onUserSearchInput"
                    >
                  </div>

                  <!-- 搜索结果 -->
                  <div
                    v-if="showUserSearchResults && userSearchResults.length > 0"
                    class="bg-bg-primary border border-border-secondary rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar"
                  >
                    <div class="px-4 py-2 border-b border-border-secondary-60 bg-bg-secondary-40">
                      <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
                        >{{ getLocaleMessage('searchResults', userSearchResults.length) }}</span
                      >
                    </div>
                    <div
                      v-for="user in userSearchResults"
                      :key="user.id"
                      class="flex items-center justify-between p-4 border-b border-border-secondary-30 last:border-0 hover:bg-bg-tertiary-30 transition-all"
                    >
                      <div>
                        <h5 class="text-sm font-bold text-text-primary">
                          {{ user.name || user.username }}
                        </h5>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span class="text-[10px] text-primary font-black"
                            >@{{ user.username }}</span
                          >
                          <span
                            v-if="user.grade && user.class"
                            class="text-[10px] text-text-disabled font-bold uppercase tracking-widest"
                            >{{ user.grade }} {{ user.class }}</span
                          >
                          <span class="text-[10px] text-text-secondary font-black">{{
                            getRoleText(user.role)
                          }}</span>
                        </div>
                      </div>
                      <button
                        :disabled="isUserSelected(user.id)"
                        class="px-3 py-1.5 bg-bg-tertiary hover:bg-primary-hover hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed text-text-tertiary text-[10px] font-black rounded-lg transition-all uppercase"
                        @click="addUserToSelection(user)"
                      >
                        {{ isUserSelected(user.id) ? locale.selected : locale.select }}
                      </button>
                    </div>
                  </div>

                  <!-- 已选择的用户 -->
                  <div v-if="form.selectedUsers.length > 0" class="space-y-3">
                    <div class="flex items-center justify-between px-1">
                      <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
                        >{{ getLocaleMessage('selectedUsers', form.selectedUsers.length) }}</span
                      >
                      <button
                        class="text-[9px] font-black text-error-70 hover:text-error uppercase tracking-widest transition-colors"
                        @click="clearAllSelectedUsers"
                      >
                        {{ locale.clearAll }}
                      </button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="(user, index) in form.selectedUsers"
                        :key="user.id"
                        class="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary border border-border-secondary rounded-lg group"
                      >
                        <div class="flex flex-col">
                          <span class="text-[10px] font-bold text-text-secondary leading-none">{{
                            user.name || user.username
                          }}</span>
                          <span class="text-[8px] text-text-disabled">@{{ user.username }}</span>
                        </div>
                        <button
                          class="text-text-disabled hover:text-error transition-colors"
                          @click="removeUserFromSelection(index)"
                        >
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center py-4">
                    <p class="text-[10px] font-black text-text-secondary uppercase tracking-widest">
                      {{ locale.noUsersSelected }}
                    </p>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 错误和成功提示 -->
          <div v-if="error || success" class="mt-6">
            <div
              v-if="error"
              class="p-4 bg-error-5 border border-error-10 rounded-2xl flex items-center gap-3"
            >
              <AlertCircle class="text-error shrink-0" :size="18" />
              <p class="text-xs font-bold text-error">{{ error }}</p>
            </div>
            <div
              v-if="success"
              class="p-4 bg-success-5 border border-success-10 rounded-2xl flex items-center gap-3"
            >
              <Check class="text-success shrink-0" :size="18" />
              <p class="text-xs font-bold text-success">{{ success }}</p>
            </div>
          </div>

          <div class="mt-10 flex justify-end">
            <button
              :disabled="loading || !isFormValid"
              :class="[
                'flex items-center gap-2 px-10 py-4 bg-bg-primary border border-border-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-[0.2em] shadow-lg',
                loading || !isFormValid
                  ? 'text-text-primary cursor-not-allowed'
                  : 'text-text-tertiary hover:text-text-primary hover:border-border-tertiary hover:bg-bg-secondary'
              ]"
              @click="sendNotification"
            >
              <Loader2 v-if="loading" class="animate-spin" :size="16" />
              <Send v-else :size="16" />
              {{ loading ? locale.sending : locale.send }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：预览区 -->
      <div class="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
        <div
          class="bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-8 shadow-xl flex flex-col h-full"
        >
          <h3
            class="text-sm font-black text-text-primary uppercase tracking-widest mb-6 flex items-center gap-2"
          >
            <Eye :size="16" class="text-primary" /> {{ locale.previewTitle }}
          </h3>

          <div class="flex flex-1 flex-col items-center justify-center p-1 sm:p-4">
            <!-- 重要通知预览 -->
            <section
              v-if="form.important"
              class="w-full max-w-[320px] overflow-hidden rounded-2xl border border-primary-300 bg-bg-primary shadow-2xl"
            >
              <div class="h-1.5 w-full bg-warning" />
              <div class="p-5 space-y-5">
                <header class="flex items-start gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning-300 bg-warning-10 text-warning"
                    aria-hidden="true"
                  >
                    <Icon name="bell-ring" :size="17" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4
                      class="break-words text-sm font-black"
                      :class="form.title ? 'text-text-primary' : 'italic text-text-disabled'"
                    >
                      {{ form.title || locale.previewTitlePlaceholder }}
                    </h4>
                    <p class="mt-1 truncate text-[11px] font-black text-text-disabled">
                      {{ locale.senderLabel }}：{{ previewSenderName }}
                    </p>
                  </div>
                </header>

                <div
                  v-if="form.content"
                  class="markdown-body max-h-64 overflow-y-auto text-sm leading-relaxed text-text-tertiary"
                  v-html="previewContent"
                />
                <p v-else class="text-sm italic leading-relaxed text-text-disabled">
                  {{ locale.previewContentPlaceholder }}
                </p>

                <footer class="flex items-center justify-between gap-4 border-t border-border-secondary-50 pt-4">
                  <div class="flex min-w-0 items-center gap-1.5 text-text-secondary">
                    <Users :size="13" class="shrink-0" aria-hidden="true" />
                    <span class="truncate text-[10px] font-black text-text-disabled">
                      {{ getLocaleMessage('previewScope', scopeDescription) }}
                    </span>
                  </div>
                  <MessageSquare :size="17" class="shrink-0 text-warning" aria-hidden="true" />
                </footer>
              </div>
            </section>

            <!-- 普通通知预览 -->
            <article
              v-else
              class="w-full max-w-[320px] overflow-hidden rounded-2xl border border-border-secondary bg-bg-primary shadow-2xl"
            >
              <div class="h-1.5 w-full bg-primary" />
              <div class="p-5 space-y-5">
                <header class="flex items-start gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-20 bg-primary-hover-10 text-primary"
                    aria-hidden="true"
                  >
                    <Icon name="bell" :size="17" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4
                      class="break-words text-sm font-black"
                      :class="form.title ? 'text-text-primary' : 'italic text-text-disabled'"
                    >
                      {{ form.title || locale.previewTitlePlaceholder }}
                    </h4>
                    <p class="mt-1 truncate text-[11px] font-black text-text-disabled">
                      {{ locale.senderLabel }}：{{ previewSenderName }}
                    </p>
                  </div>
                </header>

                <div
                  v-if="form.content"
                  class="markdown-body max-h-64 overflow-y-auto text-sm leading-relaxed text-text-tertiary"
                  v-html="previewContent"
                />
                <p v-else class="text-sm italic leading-relaxed text-text-disabled">
                  {{ locale.previewContentPlaceholder }}
                </p>

                <footer class="flex items-center justify-between gap-4 border-t border-border-secondary-50 pt-4">
                  <div class="flex min-w-0 items-center gap-1.5 text-text-secondary">
                    <Users :size="13" class="shrink-0" aria-hidden="true" />
                    <span class="truncate text-[10px] font-black text-text-disabled">
                      {{ getLocaleMessage('previewScope', scopeDescription) }}
                    </span>
                  </div>
                  <MessageSquare :size="17" class="shrink-0 text-primary" aria-hidden="true" />
                </footer>
              </div>
            </article>

            <div
              class="mt-6 flex w-full max-w-[320px] items-start gap-3 rounded-lg border border-warning-10 bg-warning-5 p-3"
            >
              <AlertCircle :size="14" class="mt-0.5 shrink-0 text-warning" />
              <p class="text-[10px] font-black text-text-tertiary leading-normal">
                {{ locale.previewHint }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <NotificationHistory :refresh-key="historyRefreshKey" />
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted, onMounted, watch } from 'vue'
import {
  Send,
  Users,
  GraduationCap,
  LayoutGrid,
  User,
  Search,
  Info,
  X,
  Check,
  Plus,
  AlertCircle,
  AlertTriangle,
  Eye,
  MessageSquare,
  Loader2
} from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Icon from '~/components/UI/Icon.vue'
import NotificationHistory from '~/components/Admin/NotificationHistory.vue'
import { useAuth } from '~/composables/useAuth'
import { useAdmin } from '~/composables/useAdmin'
import { useUserFilters } from '~/composables/useUserFilters'
import { useLocale } from '~/utils/locale'
import { renderMarkdown } from '~/utils/markdown'

const { user: authUser, isAdmin, getAuthConfig } = useAuth()
const { sendAdminNotification } = useAdmin()
const userFilters = useUserFilters()
const { admin } = useLocale()
const locale = computed(() => admin.value?.notificationSender || {})
const { msg: getLocaleMessage, nested: getNestedMessage } = useLocaleText(locale)
const previewSenderName = computed(
  () =>
    authUser.value?.name?.trim() ||
    authUser.value?.username?.trim() ||
    locale.value.previewSender
)

onMounted(() => {
  userFilters.fetchOptions()
})

const gradeOptions = computed(() => {
  return userFilters.getAvailableGrades().map(g => ({ label: g, value: g }))
})

// 表单数据
const form = ref({
  title: '',
  content: '',
  important: false,
  scope: 'ALL', // 'ALL', 'GRADE', 'CLASS', 'MULTI_CLASS', 'SPECIFIC_USERS'
  grade: '',
  classGrade: '',
  className: '',
  selectedClasses: [], // 用于多班级选择
  selectedUsers: [] // 用于指定用户选择
})

// 多班级选择表单
const multiClassForm = ref({
  grade: '',
  class: ''
})

const classOptionsForClassScope = computed(() => {
  const classes = userFilters.getAvailableClasses(undefined, form.value.classGrade)
  return classes.map(c => ({ label: c, value: c }))
})

const classOptionsForMultiClassScope = computed(() => {
  const classes = userFilters.getAvailableClasses(undefined, multiClassForm.value.grade)
  return classes.map(c => ({ label: c, value: c }))
})

watch(() => form.value.classGrade, () => {
  form.value.className = ''
})

watch(() => multiClassForm.value.grade, () => {
  multiClassForm.value.class = ''
})

const loading = ref(false)
const error = ref('')
const success = ref('')
const historyRefreshKey = ref(0)
const previewContent = computed(() => renderMarkdown(form.value.content))

// 用户搜索相关
const userSearchQuery = ref('')
const userSearchResults = ref([])
const showUserSearchResults = ref(false)
const userSearchLoading = ref(false)
let userSearchTimeout = null

const targetOptions = computed(() => [
  { id: 'ALL', label: getNestedMessage('targets', 'all'), icon: Users },
  { id: 'GRADE', label: getNestedMessage('targets', 'grade'), icon: GraduationCap },
  { id: 'CLASS', label: getNestedMessage('targets', 'class'), icon: LayoutGrid },
  { id: 'MULTI_CLASS', label: getNestedMessage('targets', 'multiClass'), icon: Plus },
  { id: 'SPECIFIC_USERS', label: getNestedMessage('targets', 'specificUsers'), icon: User }
])

// 判断是否可以添加班级
const canAddClass = computed(() => {
  return multiClassForm.value.grade && multiClassForm.value.class
})

// 添加班级到选择列表
const addClassToSelection = () => {
  if (!canAddClass.value) return

  // 检查是否已经选择了这个班级
  const isDuplicate = form.value.selectedClasses.some(
    (cls) => cls.grade === multiClassForm.value.grade && cls.class === multiClassForm.value.class
  )

  if (!isDuplicate) {
    form.value.selectedClasses.push({
      grade: multiClassForm.value.grade,
      class: multiClassForm.value.class
    })

    // 清空输入
    multiClassForm.value.class = ''
  }
}

// 从选择列表中移除班级
const removeClassFromSelection = (index) => {
  form.value.selectedClasses.splice(index, 1)
}

// 用户搜索输入处理（防抖）
const onUserSearchInput = () => {
  clearTimeout(userSearchTimeout)

  if (!userSearchQuery.value.trim()) {
    userSearchResults.value = []
    showUserSearchResults.value = false
    return
  }

  userSearchTimeout = setTimeout(async () => {
    await searchUsers(userSearchQuery.value.trim())
  }, 300)
}

// 搜索用户API调用
const searchUsers = async (query) => {
  if (!query) return

  try {
    userSearchLoading.value = true
    const response = await $fetch('/api/admin/users', {
      method: 'GET',
      query: {
        search: query,
        limit: 20
      },
      ...getAuthConfig()
    })

    if (response.success) {
      userSearchResults.value = response.users || []
      showUserSearchResults.value = true
    }
  } catch (err) {
    console.error('搜索用户失败:', err)
    userSearchResults.value = []
    showUserSearchResults.value = false
  } finally {
    userSearchLoading.value = false
  }
}

// 检查用户是否已被选择
const isUserSelected = (userId) => {
  return form.value.selectedUsers.some((user) => user.id === userId)
}

// 添加用户到选择列表
const addUserToSelection = (user) => {
  if (isUserSelected(user.id)) return

  form.value.selectedUsers.push({
    id: user.id,
    name: user.name,
    username: user.username,
    grade: user.grade,
    class: user.class,
    role: user.role
  })

  // 清空搜索
  userSearchQuery.value = ''
  userSearchResults.value = []
  showUserSearchResults.value = false
}

// 从选择列表中移除用户
const removeUserFromSelection = (index) => {
  form.value.selectedUsers.splice(index, 1)
}

// 清空所有已选用户
const clearAllSelectedUsers = () => {
  form.value.selectedUsers = []
}

// 获取角色文本
const getRoleText = (role) => {
  const roleMap = {
    admin: getNestedMessage('roles', 'admin'),
    teacher: getNestedMessage('roles', 'teacher'),
    student: getNestedMessage('roles', 'student')
  }
  return roleMap[role] || role
}

// 表单验证
const isFormValid = computed(() => {
  if (!form.value.title || !form.value.content) {
    return false
  }

  if (form.value.scope === 'GRADE' && !form.value.grade) {
    return false
  }

  if (form.value.scope === 'CLASS' && (!form.value.classGrade || !form.value.className)) {
    return false
  }

  if (form.value.scope === 'MULTI_CLASS' && form.value.selectedClasses.length === 0) {
    return false
  }

  if (form.value.scope === 'SPECIFIC_USERS' && form.value.selectedUsers.length === 0) {
    return false
  }

  return true
})

// 范围描述
const scopeDescription = computed(() => {
  switch (form.value.scope) {
    case 'ALL':
      return getNestedMessage('scopeDescriptions', 'all')
    case 'GRADE':
      return form.value.grade
        ? getNestedMessage('scopeDescriptions', 'grade', form.value.grade)
        : getNestedMessage('scopeDescriptions', 'selectGrade')
    case 'CLASS':
      return form.value.classGrade && form.value.className
        ? getNestedMessage('scopeDescriptions', 'class', form.value.classGrade, form.value.className)
        : getNestedMessage('scopeDescriptions', 'selectClass')
    case 'MULTI_CLASS':
      return form.value.selectedClasses.length > 0
        ? getNestedMessage('scopeDescriptions', 'multiClass', form.value.selectedClasses.length)
        : getNestedMessage('scopeDescriptions', 'selectClass')
    case 'SPECIFIC_USERS':
      return form.value.selectedUsers.length > 0
        ? getNestedMessage('scopeDescriptions', 'specificUsers', form.value.selectedUsers.length)
        : getNestedMessage('scopeDescriptions', 'selectUsers')
    default:
      return ''
  }
})

// 发送通知
const sendNotification = async () => {
  if (!isAdmin.value) {
    error.value = getNestedMessage('errors', 'adminOnly')
    return
  }

  if (!isFormValid.value) {
    error.value = getNestedMessage('errors', 'incomplete')
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    // 构建请求数据
    const notificationData = {
      title: form.value.title,
      content: form.value.content,
      important: form.value.important,
      scope: form.value.scope,
      filter: {}
    }

    // 添加过滤条件
    if (form.value.scope === 'GRADE') {
      notificationData.filter.grade = form.value.grade
    } else if (form.value.scope === 'CLASS') {
      notificationData.filter.grade = form.value.classGrade
      notificationData.filter.class = form.value.className
    } else if (form.value.scope === 'MULTI_CLASS') {
      notificationData.filter.classes = form.value.selectedClasses
    } else if (form.value.scope === 'SPECIFIC_USERS') {
      notificationData.filter.userIds = form.value.selectedUsers.map((user) => user.id)
    }

    // 发送通知
    const result = await sendAdminNotification(notificationData)

    if (result && result.success) {
      success.value = getNestedMessage('messages', 'sendSuccess', result.sentCount)
      historyRefreshKey.value += 1

      // 3秒后自动隐藏成功提示
      setTimeout(() => {
        success.value = ''
      }, 3000)

      // 清空表单
      form.value = {
        title: '',
        content: '',
        important: false,
        scope: 'ALL',
        grade: '',
        classGrade: '',
        className: '',
        selectedClasses: [],
        selectedUsers: []
      }
      multiClassForm.value = {
        grade: '',
        class: ''
      }
      // 清空用户搜索相关状态
      userSearchQuery.value = ''
      userSearchResults.value = []
      showUserSearchResults.value = false
      userSearchLoading.value = false
      clearTimeout(userSearchTimeout)
    } else {
      throw new Error(result?.message || getNestedMessage('errors', 'sendFailed'))
    }
  } catch (err) {
    error.value = err.message || getNestedMessage('errors', 'sendError')
    console.error('发送通知错误:', err)

    // 3秒后自动隐藏错误提示
    setTimeout(() => {
      error.value = ''
    }, 3000)
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (userSearchTimeout) {
    clearTimeout(userSearchTimeout)
  }
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
