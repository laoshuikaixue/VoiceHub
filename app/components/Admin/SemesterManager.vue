<template>
  <div class="max-w-[1200px] mx-auto space-y-10 pb-20 px-2">
    <!-- 顶部标题栏 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">学期管理</h2>
        <p class="text-xs text-zinc-500 mt-1">
          定义系统的教学周期，点歌、排期及统计数据将基于当前活跃学期进行归档
        </p>
      </div>
      <button
        class="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
        @click="openAddModal"
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
        添加新学期
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
            class="text-amber-500 fill-amber-500"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
          <h3 class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
            当前活跃学期
          </h3>
        </div>

        <div
          v-if="currentSemester"
          class="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-10 shadow-2xl shadow-blue-900/20 overflow-hidden group"
        >
          <div class="relative z-10 space-y-6">
            <div
              class="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
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
              <h4 class="text-3xl font-black text-white tracking-tight leading-tight">
                {{ currentSemester.name }}
              </h4>
              <div class="flex items-center gap-2 text-blue-100/60 font-bold text-xs">
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
                创建于 {{ formatDate(currentSemester.createdAt) }}
              </div>
            </div>
            <div class="pt-4">
              <span
                class="px-4 py-2 bg-white text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg"
              >
                正在进行中
              </span>
            </div>
          </div>

          <!-- 装饰性背景元素 -->
          <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 blur-3xl rounded-full" />
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
              class="text-white"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
        </div>

        <div
          v-else
          class="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl p-20 flex flex-col items-center justify-center text-center gap-4"
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
            class="text-zinc-700"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p class="text-sm font-bold text-zinc-600">未设置当前活跃学期</p>
          <button class="text-xs text-blue-500 font-black hover:underline" @click="openAddModal">
            立即创建
          </button>
        </div>

        <div class="p-6 bg-zinc-900/20 border border-zinc-800 rounded-3xl flex items-start gap-4">
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
            class="text-zinc-500 shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div class="space-y-1">
            <p class="text-xs font-bold text-zinc-400">学期切换说明</p>
            <p class="text-[11px] text-zinc-600 leading-relaxed">
              切换学期后，前端点歌界面将清空旧排期。所有历史数据会自动归档至对应学期下，您仍可在数据中心进行查看。
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
              class="text-zinc-600"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
            <h3 class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
              学期历史记录
            </h3>
          </div>
          <span class="text-[10px] font-black text-zinc-700">共 {{ semesters.length }} 条</span>
        </div>

        <div class="space-y-4">
          <div
            v-if="loading && semesters.length === 0"
            class="text-center py-20 bg-zinc-900/10 border border-zinc-800 border-dashed rounded-[2rem]"
          >
            <p class="text-xs font-bold text-zinc-600">加载中...</p>
          </div>

          <div
            v-for="sem in sortedSemesters"
            :key="sem.id"
            class="group flex items-center justify-between p-6 rounded-[2rem] border transition-all"
            :class="
              sem.isActive
                ? 'bg-blue-600/5 border-blue-500/30'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
            "
          >
            <div class="flex items-center gap-5">
              <div
                class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                :class="
                  sem.isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'bg-zinc-800 text-zinc-600 border border-zinc-700'
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
                    sem.isActive ? 'text-blue-400' : 'text-zinc-200 group-hover:text-blue-400'
                  "
                >
                  {{ sem.name }}
                </h5>
                <p class="text-[10px] text-zinc-600 font-medium uppercase tracking-widest mt-0.5">
                  创建于 {{ formatDate(sem.createdAt) }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div
                v-if="sem.isActive"
                class="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20"
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
                <span class="text-[10px] font-black uppercase tracking-widest">当前学期</span>
              </div>
              <template v-else>
                <button
                  :disabled="loading"
                  class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-black rounded-xl border border-zinc-700 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
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
                  设为当前
                </button>
                <button
                  :disabled="loading"
                  class="p-2.5 text-zinc-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              </template>
            </div>
          </div>

          <div
            v-if="semesters.length === 0 && !loading"
            class="text-center py-20 bg-zinc-900/10 border border-zinc-800 border-dashed rounded-[2rem]"
          >
            <p class="text-xs font-bold text-zinc-600">暂无学期数据</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加学期弹窗 -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden"
        @click.stop
      >
        <div class="p-8 space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-black text-white tracking-tight">添加新学期</h3>
            <button
              class="p-2 text-zinc-500 hover:text-white transition-colors"
              @click="closeAddModal"
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
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >学期名称</label
              >
              <input
                v-model="newSemester.name"
                type="text"
                placeholder="例如: 2025学年第一学期"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 font-bold transition-all"
              >
            </div>

            <label class="flex items-center gap-3 cursor-pointer group px-1">
              <input
                v-model="newSemester.isActive"
                type="checkbox"
                class="w-4.5 h-4.5 rounded-lg border-zinc-800 bg-zinc-950 accent-blue-600 transition-all"
              >
              <div>
                <span
                  class="text-xs font-bold text-zinc-300 group-hover:text-blue-400 transition-colors"
                  >设为当前活跃学期</span
                >
                <p class="text-[10px] text-zinc-600 font-medium">
                  创建后将立即激活此学期，原学期将变为历史状态
                </p>
              </div>
            </label>

            <div class="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-start gap-3">
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
                class="text-amber-500 shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p class="text-[10px] text-zinc-500 leading-normal">
                提示：请按照统一的命名规范设置学期名称，这有助于数据归档后的检索与分析。
              </p>
            </div>
          </div>
        </div>

        <div class="p-6 bg-zinc-800/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
            @click="closeAddModal"
          >
            取消
          </button>
          <button
            :disabled="submitting || !newSemester.name.trim()"
            class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95"
            @click="handleAddSemester"
          >
            {{ submitting ? '创建中...' : '创建学期' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 确认删除对话框 -->
    <ConfirmDialog
      :loading="loading"
      :show="showDeleteDialog"
      cancel-text="取消"
      confirm-text="确认删除"
      :message="deleteMessage"
      title="确认删除学期"
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

const { showToast: showNotification } = useToast()

const {
  semesters,
  currentSemester,
  loading,
  error,
  fetchSemesters,
  fetchCurrentSemester,
  createSemester,
  setActiveSemester,
  deleteSemester: deleteSemesterAPI
} = useSemesters()

const showAddModal = ref(false)
const showDeleteDialog = ref(false)
const deleteTargetId = ref(null)
const deleteTargetName = ref('')
const submitting = ref(false)
const newSemester = ref({
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
  return `确定要彻底删除 "${deleteTargetName.value}" 吗？此操作将同步清除该学期下的所有点歌记录、排期数据和统计信息。数据一旦删除将无法找回。`
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
      showNotification('活跃学期设置成功！', 'success')
    } else {
      // 如果setActiveSemester返回false，尝试直接显示一个通用错误，因为error可能为空
      showNotification(error.value || '设置活跃学期失败，请稍后重试', 'error')
    }
  } catch (err) {
    showNotification(err.message || '设置失败', 'error')
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
      showNotification('学期删除成功！', 'success')
    } else {
      showNotification(error.value || '删除学期失败', 'error')
    }
  } catch (err) {
    showNotification(err.message || '删除失败', 'error')
  }

  showDeleteDialog.value = false
  deleteTargetId.value = null
  deleteTargetName.value = ''
}

// 处理添加学期
const handleAddSemester = async () => {
  if (!newSemester.value.name.trim()) return

  submitting.value = true
  try {
    const result = await createSemester({
      name: newSemester.value.name,
      isActive: newSemester.value.isActive
    })
    if (result) {
      showNotification('学期创建成功！', 'success')
      closeAddModal()
    } else {
      showNotification(error.value || '创建学期失败', 'error')
    }
  } catch (err) {
    console.error('创建学期失败:', err)
    showNotification(err.message || '创建学期失败', 'error')
  } finally {
    submitting.value = false
  }
}

// 关闭添加弹窗
const closeAddModal = () => {
  showAddModal.value = false
  newSemester.value = {
    name: '',
    isActive: false
  }
}

const getRecommendedName = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  let academicYear = year
  let term = '第一学期'

  if (month >= 3 && month <= 8) {
    academicYear = year - 1
    term = '第二学期'
  } else if (month <= 2) {
    academicYear = year - 1
    term = '第一学期'
  } else {
    academicYear = year
    term = '第一学期'
  }

  return `${academicYear}学年${term}`
}

const openAddModal = () => {
  newSemester.value.name = getRecommendedName()
  showAddModal.value = true
}

// 组件挂载时获取数据
onMounted(async () => {
  await Promise.all([fetchCurrentSemester(), fetchSemesters()])
})
</script>

<style scoped></style>
