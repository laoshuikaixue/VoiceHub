<template>
  <div class="max-w-[1200px] mx-auto space-y-10 pb-20 px-2">
    <!-- 顶部标题栏 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">
          {{ locale.desc }}
        </p>
      </div>
      <button
        class="flex items-center gap-2 px-6 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95"
        @click="openModal"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {{ locale.add }}
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <!-- 左侧栏：当前活跃学期 -->
      <div class="lg:col-span-5 space-y-6">
        <div class="flex items-center gap-2 px-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-warning fill-warning"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
          <h3 class="text-[10px] font-black text-text-disabled uppercase tracking-[0.2em]">
            {{ locale.currentActive }}
          </h3>
        </div>

        <div
          v-if="currentSemester"
          class="relative bg-gradient-to-br from-primary to-primary-hover rounded-3xl p-10 shadow-2xl shadow-[var(--primary-glow)] overflow-hidden group"
        >
          <div class="relative z-10 space-y-6">
            <div
              class="w-16 h-16 rounded-3xl bg-bg-secondary-10 backdrop-blur-md flex items-center justify-center text-text-primary border border-primary-20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div class="space-y-2">
              <h4 class="text-3xl font-black text-text-primary tracking-tight leading-tight">
                {{ currentSemester.name }}
              </h4>
              <div class="flex items-center gap-2 text-primary-60 font-bold text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {{ getLocaleMessage('createdAt', formatDate(currentSemester.createdAt)) }}
              </div>
            </div>
            <div class="pt-4">
              <span
                class="px-4 py-2 bg-bg-secondary text-primary-hover text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg"
              >
                {{ locale.inProgress }}
              </span>
            </div>
          </div>

          <!-- 装饰性背景元素 -->
          <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-bg-secondary-5 blur-3xl rounded-full" />
          <div class="absolute top-10 right-10 opacity-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="160"
              height="160"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-text-primary"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
        </div>

        <div
          v-else
          class="bg-bg-secondary-30 border border-border-secondary border-dashed rounded-3xl p-20 flex flex-col items-center justify-center text-center gap-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-text-secondary"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p class="text-sm font-bold text-text-disabled">{{ locale.noCurrent }}</p>
          <button class="text-xs text-primary font-black hover:underline" @click="openModal">
            {{ locale.createNow }}
          </button>
        </div>

        <div class="p-6 bg-bg-secondary-20 border border-border-secondary rounded-3xl flex items-start gap-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-text-tertiary shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div class="space-y-1">
            <p class="text-xs font-bold text-text-tertiary">{{ locale.switchTitle }}</p>
            <p class="text-[11px] text-text-disabled leading-relaxed">
              {{ locale.switchDesc }}
            </p>
          </div>
        </div>
      </div>

      <!-- 右侧栏：学期历史记录 -->
      <div class="lg:col-span-7 space-y-6">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-text-disabled"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
            <h3 class="text-[10px] font-black text-text-disabled uppercase tracking-[0.2em]">
              {{ locale.historyTitle }}
            </h3>
          </div>
          <span class="text-[10px] font-black text-text-secondary">{{ getLocaleMessage('historyCount', semesters.length) }}</span>
        </div>

        <div class="space-y-4">
          <div
            v-if="loading && semesters.length === 0"
            class="text-center py-20 bg-bg-secondary-10 border border-border-secondary border-dashed rounded-[2rem]"
          >
            <p class="text-xs font-bold text-text-disabled">{{ locale.loading }}</p>
          </div>

          <div
            v-for="sem in sortedSemesters"
            :key="sem.id"
            class="group flex items-center justify-between p-6 rounded-[2rem] border transition-all"
            :class="
              sem.isActive
                ? 'bg-primary-hover-5 border-primary-30'
                : 'bg-bg-secondary-40 border-border-secondary hover:border-border-tertiary'
            "
          >
            <div class="flex items-center gap-5">
              <div
                class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                :class="
                  sem.isActive
                    ? 'bg-primary-hover text-text-primary shadow-lg shadow-[var(--primary-glow)]'
                    : 'bg-bg-tertiary text-text-disabled border border-border-tertiary'
                "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </div>
              <div>
                <h5
                  class="font-bold transition-colors"
                  :class="
                    sem.isActive ? 'text-primary' : 'text-text-primary group-hover:text-primary'
                  "
                >
                  {{ sem.name }}
                </h5>
                <p class="text-[10px] text-text-disabled font-medium uppercase tracking-widest mt-0.5">
                  {{ getLocaleMessage('createdAt', formatDate(sem.createdAt)) }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div
                v-if="sem.isActive"
                class="flex items-center gap-2 px-4 py-2 bg-success-10 text-success rounded-xl border border-success-20"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span class="text-[10px] font-black uppercase tracking-widest">{{ locale.currentSemester }}</span>
              </div>
              <button
                v-else
                :disabled="loading"
                class="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-quaternary text-text-tertiary hover:text-text-primary text-[10px] font-black rounded-xl border border-border-tertiary transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                @click="setActive(sem.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                {{ locale.setCurrent }}
              </button>

              <button
                :disabled="loading"
                class="p-2.5 text-text-secondary hover:text-primary hover:bg-primary-10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                :title="locale.editSemester"
                @click="openEditModal(sem)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>

              <button
                v-if="!sem.isActive"
                :disabled="loading"
                class="p-2.5 text-text-secondary hover:text-error hover:bg-error-10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                :title="locale.deleteSemester"
                @click="deleteSemester(sem.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          </div>

          <div
            v-if="semesters.length === 0 && !loading"
            class="text-center py-20 bg-bg-secondary-10 border border-border-secondary border-dashed rounded-[2rem]"
          >
            <p class="text-xs font-bold text-text-disabled">{{ locale.empty }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/修改学期弹窗 -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md bg-bg-secondary rounded-3xl border border-border-secondary shadow-2xl overflow-hidden"
        @click.stop
      >
        <div class="p-8 space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-black text-text-primary tracking-tight">
              {{ isEditing ? locale.editSemester : locale.add }}
            </h3>
            <button
              class="p-2 text-text-tertiary hover:text-text-primary transition-colors"
              @click="closeModal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="space-y-6">
            <div class="space-y-2">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.semesterName }}</label
              >
              <input
                v-model="semesterForm.name"
                type="text"
                :placeholder="locale.namePlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-4 text-sm text-text-primary focus:outline-none focus:border-primary-30 font-bold transition-all"
              >
            </div>

            <label v-if="!isEditing" class="flex items-center gap-3 cursor-pointer group px-1">
              <input
                v-model="semesterForm.isActive"
                type="checkbox"
                class="w-4.5 h-4.5 rounded-lg border-border-secondary bg-bg-primary transition-all"
              >
              <div>
                <span
                  class="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors"
                  >{{ locale.setAsActive }}</span
                >
                <p class="text-[10px] text-text-disabled font-medium">
                  {{ locale.setAsActiveHint }}
                </p>
              </div>
            </label>

            <div class="p-4 bg-bg-primary border border-border-secondary rounded-2xl flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-warning shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p class="text-[10px] text-text-tertiary leading-normal">
                {{ locale.namingTip }}
              </p>
            </div>
          </div>
        </div>

        <div class="p-6 bg-bg-tertiary-50 border-t border-border-secondary flex gap-3 justify-end">
          <button
            class="px-6 py-2.5 text-xs font-bold text-text-tertiary hover:text-text-secondary transition-colors"
            @click="closeModal"
          >
            {{ locale.cancel }}
          </button>
          <button
            :disabled="submitting || !semesterForm.name.trim()"
            class="px-8 py-2.5 bg-primary-hover hover:bg-primary disabled:bg-primary-hover disabled:opacity-50 text-text-primary text-xs font-black rounded-xl shadow-lg transition-all active:scale-95"
            @click="handleSubmit"
          >
            {{ submitting ? (isEditing ? locale.saving : locale.creating) : (isEditing ? locale.saveChanges : locale.createSemester) }}
          </button>
        </div>
      </div>
    </div>

    <!-- 确认删除对话框 -->
    <ConfirmDialog
      :loading="loading"
      :show="showDeleteDialog"
      :cancel-text="locale.cancel"
      :confirm-text="locale.confirmDelete"
      :message="deleteMessage"
      :title="locale.deleteDialogTitle"
      type="danger"
      @close="showDeleteDialog = false"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { showToast: showNotification } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.semesterManager || {})
const { msg: getLocaleMessage, nested: getNestedMessage } = useLocaleText(locale)

const {
  semesters,
  currentSemester,
  loading,
  error,
  fetchSemesters,
  fetchCurrentSemester,
  createSemester,
  setActiveSemester,
  updateSemester,
  deleteSemester: deleteSemesterAPI
} = useSemesters()

const showModal = ref(false)
const isEditing = ref(false)
const editSemesterId = ref(null)
const originalSemesterName = ref('')

const showDeleteDialog = ref(false)
const deleteTargetId = ref(null)
const deleteTargetName = ref('')
const submitting = ref(false)
const semesterForm = ref({
  name: '',
  isActive: false
})

// 按创建时间排序
const sortedSemesters = computed(() => {
  return [...semesters.value].sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
})

// 删除确认信息
const deleteMessage = computed(() => {
  return getLocaleMessage('deleteMessage', deleteTargetName.value)
})

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 设置活跃学期
const setActive = async (semesterId) => {
  try {
    const success = await setActiveSemester(semesterId)
    // 注意：这里需要重新获取error，因为useSemesters内部可能没有正确更新error的响应式引用
    // 或者直接依据success返回值判断
    if (success) {
      showNotification(getNestedMessage('messages', 'activeSet'), 'success')
    } else {
      // 如果setActiveSemester返回false，尝试直接显示一个通用错误，因为error可能为空
      showNotification(error.value || getNestedMessage('errors', 'setActiveFailedRetry'), 'error')
    }
  } catch (err) {
    showNotification(err.message || getNestedMessage('errors', 'setFailed'), 'error')
  }
}

// 准备删除学期
const deleteSemester = (semesterId) => {
  const semester = semesters.value.find((s) => s.id === semesterId)
  if (semester) {
    deleteTargetId.value = semesterId
    deleteTargetName.value = semester.name
    showDeleteDialog.value = true
  }
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteTargetId.value) return

  try {
    const success = await deleteSemesterAPI(deleteTargetId.value)
    if (success) {
      showNotification(getNestedMessage('messages', 'deleted'), 'success')
    } else {
      showNotification(error.value || getNestedMessage('errors', 'deleteFailed'), 'error')
    }
  } catch (err) {
    showNotification(err.message || getNestedMessage('errors', 'deleteFailedShort'), 'error')
  }

  showDeleteDialog.value = false
  deleteTargetId.value = null
  deleteTargetName.value = ''
}

// 处理表单提交
const handleSubmit = async () => {
  const normalizedName = semesterForm.value.name.trim()
  if (!normalizedName) return

  if (isEditing.value && normalizedName === originalSemesterName.value) {
    showNotification(getNestedMessage('messages', 'nameUnchanged'), 'info')
    closeModal()
    return
  }

  submitting.value = true
  try {
    if (isEditing.value && editSemesterId.value) {
      // 修改学期
      const success = await updateSemester(editSemesterId.value, {
        name: normalizedName
      })
      if (success) {
        showNotification(getNestedMessage('messages', 'updated'), 'success')
        closeModal()
      } else {
        showNotification(error.value || getNestedMessage('errors', 'updateFailed'), 'error')
      }
    } else {
      // 创建学期
      const result = await createSemester({
        name: normalizedName,
        isActive: semesterForm.value.isActive
      })
      if (result) {
        showNotification(getNestedMessage('messages', 'created'), 'success')
        closeModal()
      } else {
        showNotification(error.value || getNestedMessage('errors', 'createFailed'), 'error')
      }
    }
  } catch (err) {
    console.error(isEditing.value ? '修改学期失败:' : '创建学期失败:', err)
    showNotification(
      err.message || (isEditing.value ? getNestedMessage('errors', 'updateFailed') : getNestedMessage('errors', 'createFailed')),
      'error'
    )
  } finally {
    submitting.value = false
  }
}

// 关闭弹窗
const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editSemesterId.value = null
  originalSemesterName.value = ''
  semesterForm.value = {
    name: '',
    isActive: false
  }
}

const getRecommendedName = () => {
  const now = getSyncedDate()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  let academicYear = year
  let term = locale.value?.terms?.first || '第一学期'

  if (month >= 3 && month <= 8) {
    academicYear = year - 1
    term = locale.value?.terms?.second || '第二学期'
  } else if (month <= 2) {
    academicYear = year - 1
    term = locale.value?.terms?.first || '第一学期'
  } else {
    academicYear = year
    term = locale.value?.terms?.first || '第一学期'
  }

  return getLocaleMessage('recommendedName', academicYear, term)
}

const openModal = () => {
  isEditing.value = false
  editSemesterId.value = null
  semesterForm.value.name = getRecommendedName()
  semesterForm.value.isActive = false
  showModal.value = true
}

const openEditModal = (sem) => {
  isEditing.value = true
  editSemesterId.value = sem.id
  originalSemesterName.value = sem.name
  semesterForm.value.name = sem.name
  semesterForm.value.isActive = sem.isActive
  showModal.value = true
}

// 组件挂载时获取数据
onMounted(async () => {
  await Promise.all([fetchCurrentSemester(), fetchSemesters()])
})
</script>

<style scoped></style>
