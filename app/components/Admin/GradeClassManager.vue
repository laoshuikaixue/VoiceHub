<template>
  <div class="space-y-6">
    <!-- 头部 -->
    <div>
      <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
      <p class="text-sm text-text-tertiary mt-1">{{ locale.desc }}</p>
    </div>

    <!-- 左右分栏：左为生成操作，右为年级班级展示 -->
    <div class="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6 items-start">
      <div class="space-y-6">
    <!-- 新增与批量生成区 -->
    <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-5 space-y-4">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1">
          <label class="block text-xs font-bold text-text-secondary mb-1.5">{{ locale.gradeLabel }}</label>
          <input
            v-model="gradeInput"
            type="text"
            :placeholder="locale.gradePlaceholder"
            class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary transition-colors"
            @keydown.enter="handleAdd"
          >
        </div>
        <div class="flex-1">
          <label class="block text-xs font-bold text-text-secondary mb-1.5">{{ locale.classLabel }}</label>
          <input
            v-model="classInput"
            type="text"
            :placeholder="locale.classPlaceholder"
            class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary transition-colors"
            @keydown.enter="handleAdd"
          >
        </div>
        <div class="flex items-end">
          <button
            type="button"
            :disabled="adding || !gradeInput.trim() || !classInput.trim()"
            class="w-full sm:w-auto px-6 py-2.5 bg-primary text-white text-xs font-black rounded-xl shadow-lg transition-all hover:opacity-90 active:scale-95 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            @click="handleAdd"
          >
            <Plus v-if="!adding" :size="14" />
            <RefreshCw v-else :size="14" class="animate-spin" />
            {{ locale.addButton }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 border-t border-border-secondary pt-4">
        <div>
          <p class="text-sm font-black text-text-primary mb-2">{{ locale.batchTitle }}</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1">
              <input
                v-model="batchGradeInput"
                type="text"
                :placeholder="locale.batchGradePlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary transition-colors"
              >
            </div>
            <div class="flex-1">
              <input
                v-model="batchClassInput"
                type="text"
                :placeholder="locale.batchClassPlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary transition-colors"
              >
            </div>
            <div class="flex items-end">
              <button
                type="button"
                :disabled="batchAdding || !batchGradeInput.trim() || !batchClassInput.trim()"
                class="w-full sm:w-auto px-6 py-2.5 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-primary transition-colors text-xs font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                @click="handleBatchAdd"
              >
                <Sparkles v-if="!batchAdding" :size="14" />
                <RefreshCw v-else :size="14" class="animate-spin" />
                {{ locale.batchButton }}
              </button>
            </div>
          </div>
        </div>
        <div class="lg:border-l lg:border-border-secondary lg:pl-5">
          <p class="text-sm font-black text-text-primary mb-2">{{ locale.initTitle }}</p>
          <p class="text-xs text-text-tertiary mb-3">{{ locale.initDesc }}</p>
          <button
            type="button"
            :disabled="initLoading"
            class="w-full sm:w-auto px-6 py-2.5 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-primary transition-colors text-xs font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            @click="handleInitialize"
          >
            <Users v-if="!initLoading" :size="14" />
            <RefreshCw v-else :size="14" class="animate-spin" />
            {{ locale.initButton }}
          </button>
        </div>
      </div>
      </div>

      <!-- 使用说明 -->
      <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl p-5">
        <p class="text-xs font-black text-text-primary uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Info :size="13" class="text-text-tertiary" />
          {{ locale.guideTitle }}
        </p>
        <ul class="space-y-2.5 text-xs text-text-tertiary leading-relaxed">
          <li class="flex gap-2">
            <span class="shrink-0 w-4 h-4 mt-0.5 rounded bg-primary-10 text-primary text-[10px] font-black flex items-center justify-center">1</span>
            {{ locale.guideSingle }}
          </li>
          <li class="flex gap-2">
            <span class="shrink-0 w-4 h-4 mt-0.5 rounded bg-primary-10 text-primary text-[10px] font-black flex items-center justify-center">2</span>
            {{ locale.guideBatchLine1 }}
          </li>
          <li class="flex gap-2">
            <span class="shrink-0 w-4 h-4 mt-0.5 rounded bg-primary-10 text-primary text-[10px] font-black flex items-center justify-center">3</span>
            {{ locale.guideBatchLine2 }}
          </li>
          <li class="flex gap-2">
            <span class="shrink-0 w-4 h-4 mt-0.5 rounded bg-primary-10 text-primary text-[10px] font-black flex items-center justify-center">4</span>
            {{ locale.guideDedup }}
          </li>
        </ul>
      </div>

      <div class="space-y-6">
    <!-- 回退提示 -->
    <div
      v-if="fallbackMode"
      class="p-4 bg-warning-10 border border-warning-20 rounded-xl text-xs text-warning font-bold"
    >
      {{ locale.fallbackHint }}
    </div>

    <!-- 年级分组卡片 -->
    <div v-if="loading" class="p-8 flex justify-center">
      <AppSpinner :size="28" />
    </div>

    <div v-else-if="groupedItems.length === 0" class="p-10 text-center bg-bg-secondary-40 border border-border-secondary rounded-2xl">
      <div class="mx-auto w-12 h-12 rounded-xl bg-bg-primary flex items-center justify-center mb-3">
        <GraduationCap :size="22" class="text-text-tertiary" />
      </div>
      <p class="text-sm font-bold text-text-tertiary">{{ locale.empty }}</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div
        v-for="group in groupedItems"
        :key="group.grade"
        class="bg-bg-secondary-40 border border-border-secondary rounded-2xl overflow-hidden"
      >
        <!-- 年级头部 -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-border-secondary">
          <div class="flex items-center gap-2.5">
            <GraduationCap :size="18" class="text-primary" />
            <span class="text-sm font-black text-text-primary">{{ group.grade }}</span>
            <span class="text-[10px] font-bold text-text-tertiary px-2 py-0.5 rounded-full bg-bg-primary">
              {{ locale.classCount(group.items.length) }}
            </span>
            <span class="text-[10px] font-bold text-text-tertiary px-2 py-0.5 rounded-full bg-bg-primary flex items-center gap-1">
              <Users :size="10" />
              {{ locale.personCount(groupTotalUsers(group)) }}
            </span>
          </div>
          <button
            type="button"
            class="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-error-10 transition-colors"
            :title="locale.deleteGradeButton"
            @click="openDeleteGradeConfirm(group)"
          >
            <Trash2 :size="15" />
          </button>
        </div>

        <!-- 班级列表 -->
        <div class="px-5 py-4 flex flex-wrap gap-2">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="group/chip flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 rounded-lg bg-bg-primary border border-border-secondary text-sm font-bold text-text-primary"
          >
            <span>{{ item.class }}</span>
            <span v-if="item.userCount > 0" class="text-[11px] font-bold text-text-tertiary">
              {{ locale.personCount(item.userCount) }}
            </span>
            <button
              type="button"
              class="p-0.5 rounded text-text-tertiary opacity-60 group-hover/chip:opacity-100 hover:text-error hover:bg-error-10 transition-all"
              :title="locale.deleteButton"
              @click="openDeleteConfirm(item)"
            >
              <X :size="13" />
            </button>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>

    <!-- 单条删除确认 -->
    <ConfirmDialog
      :show="showDeleteConfirm"
      :title="locale.gradeLabel + ' / ' + locale.classLabel"
      :message="locale.deleteConfirm"
      type="danger"
      :confirm-text="locale.deleteButton"
      :loading="deleting"
      @confirm="confirmDelete"
      @close="showDeleteConfirm = false"
    />

    <!-- 整年级删除确认 -->
    <ConfirmDialog
      :show="showGradeDeleteConfirm"
      :title="locale.deleteGradeTitle"
      :message="gradeDeleteMessage"
      type="danger"
      :confirm-text="locale.deleteGradeButton"
      :loading="deleting"
      @confirm="confirmDeleteGrade"
      @close="showGradeDeleteConfirm = false"
    />
  </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, RefreshCw, Trash2, GraduationCap, Sparkles, X, Users, Info } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useLocale } from '~/utils/locale'
import { useToast } from '~/composables/useToast'
import { parseClassInput } from '~/utils/grade-class-input'

const { admin } = useLocale()
const locale = computed(() => admin.value?.gradeClass || {})
const { showToast: showNotification } = useToast()

const items = ref([])
const loading = ref(false)
const adding = ref(false)
const deleting = ref(false)
const gradeInput = ref('')
const classInput = ref('')
const batchGradeInput = ref('')
const batchClassInput = ref('')
const batchAdding = ref(false)
const initLoading = ref(false)
const showDeleteConfirm = ref(false)
const targetItem = ref(null)
const showGradeDeleteConfirm = ref(false)
const targetGrade = ref('')
// 配置表为空时前端标记回退模式（后端数据源已兜底，此处仅作提示）
const fallbackMode = ref(false)

// 按年级分组（保持后端 smartSort 顺序）
const groupedItems = computed(() => {
  const groups = new Map()
  for (const item of items.value) {
    if (!groups.has(item.grade)) {
      groups.set(item.grade, { grade: item.grade, items: [] })
    }
    groups.get(item.grade).items.push(item)
  }
  return [...groups.values()]
})

const gradeDeleteMessage = computed(() =>
  locale.value.deleteGradeMessage(targetGrade.value, targetGradeCount.value)
)
const targetGradeCount = computed(() => {
  const group = groupedItems.value.find((g) => g.grade === targetGrade.value)
  return group?.items.length || 0
})

const groupTotalUsers = (group) =>
  group.items.reduce((sum, item) => sum + (item.userCount || 0), 0)

const getErrorMessage = (error) =>
  error?.data?.message || error?.message || error?.statusMessage || ''

const loadItems = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/grade-class')
    if (response.success) {
      items.value = response.items || []
      fallbackMode.value = items.value.length === 0
    }
  } catch (error) {
    showNotification(`${locale.value.loadFailed}: ${getErrorMessage(error)}`, 'error')
  } finally {
    loading.value = false
  }
}

const handleAdd = async () => {
  const grade = gradeInput.value.trim()
  const studentClass = classInput.value.trim()
  if (!grade || !studentClass) return

  adding.value = true
  try {
    const response = await $fetch('/api/admin/grade-class', {
      method: 'POST',
      body: { grade, class: studentClass }
    })

    if (response.success) {
      gradeInput.value = ''
      classInput.value = ''
      await loadItems()
      showNotification(locale.value.addSuccess, 'success')
    }
  } catch (error) {
    if (error.statusCode === 409) {
      showNotification(locale.value.duplicate, 'warning')
    } else {
      showNotification(`${locale.value.addFailed}: ${getErrorMessage(error)}`, 'error')
    }
  } finally {
    adding.value = false
  }
}

const handleBatchAdd = async () => {
  const grades = batchGradeInput.value
    .split(/[,，\n;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const classes = parseClassInput(batchClassInput.value)

  if (grades.length === 0 || classes.length === 0) {
    showNotification(locale.value.batchInvalid, 'warning')
    return
  }

  // 后端批量上限 500，超限直接拦截
  const totalItems = grades.length * classes.length
  if (totalItems > 500) {
    showNotification(locale.value.batchLimit, 'warning')
    return
  }

  const itemsToSend = []
  for (const grade of grades) {
    for (const studentClass of classes) {
      itemsToSend.push({ grade, class: studentClass })
    }
  }

  batchAdding.value = true
  try {
    const response = await $fetch('/api/admin/grade-class', {
      method: 'POST',
      body: { items: itemsToSend }
    })

    if (response.success) {
      batchGradeInput.value = ''
      batchClassInput.value = ''
      await loadItems()
      showNotification(
        locale.value.batchResult(response.added || 0, response.skipped || 0),
        'success'
      )
    }
  } catch (error) {
    showNotification(`${locale.value.batchFailed}: ${getErrorMessage(error)}`, 'error')
  } finally {
    batchAdding.value = false
  }
}

const handleInitialize = async () => {
  initLoading.value = true
  try {
    const response = await $fetch('/api/admin/grade-class/initialize', {
      method: 'POST'
    })

    if (response.success) {
      await loadItems()
      showNotification(
        locale.value.initResult(response.added || 0, response.skipped || 0),
        'success'
      )
    }
  } catch (error) {
    showNotification(`${locale.value.initFailed}: ${getErrorMessage(error)}`, 'error')
  } finally {
    initLoading.value = false
  }
}

const openDeleteConfirm = (item) => {
  targetItem.value = item
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  if (!targetItem.value) return
  deleting.value = true
  try {
    const response = await $fetch(`/api/admin/grade-class/${targetItem.value.id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      showDeleteConfirm.value = false
      await loadItems()
      showNotification(locale.value.deleteSuccess, 'success')
    }
  } catch (error) {
    showNotification(`${locale.value.deleteFailed}: ${getErrorMessage(error)}`, 'error')
  } finally {
    deleting.value = false
  }
}

const openDeleteGradeConfirm = (group) => {
  targetGrade.value = group.grade
  showGradeDeleteConfirm.value = true
}

const confirmDeleteGrade = async () => {
  if (!targetGrade.value) return
  deleting.value = true
  try {
    const response = await $fetch('/api/admin/grade-class/by-grade', {
      method: 'DELETE',
      query: { grade: targetGrade.value }
    })

    if (response.success) {
      showGradeDeleteConfirm.value = false
      await loadItems()
      showNotification(locale.value.deleteGradeSuccess, 'success')
    }
  } catch (error) {
    showNotification(`${locale.value.deleteFailed}: ${getErrorMessage(error)}`, 'error')
  } finally {
    deleting.value = false
  }
}

onMounted(loadItems)
</script>
