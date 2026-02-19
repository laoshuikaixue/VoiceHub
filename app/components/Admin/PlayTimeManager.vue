<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">播出时段管理</h2>
        <p class="text-xs text-zinc-500 mt-1">
          定义校园广播的常规播放窗口，用户仅可在这些时间段内进行点歌或查看排期
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div
          class="bg-zinc-900/40 border border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-3"
        >
          <span class="text-[10px] font-black text-zinc-500 uppercase tracking-widest"
            >启用播出时段选择</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enablePlayTimeSelection ? 'bg-blue-600' : 'bg-zinc-800'
            ]"
            @click="toggleGlobalEnabled"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-white rounded-full transition-all',
                enablePlayTimeSelection ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
        <button
          class="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          @click="openAddForm"
        >
          <Plus :size="14" /> 添加播出时段
        </button>
      </div>
    </div>

    <!-- 信息卡片 -->
    <div class="bg-blue-600/5 border border-blue-500/10 rounded-xl p-5 flex items-start gap-4">
      <Info class="text-blue-500 shrink-0 mt-0.5" :size="18" />
      <div class="space-y-1">
        <p class="text-xs font-bold text-zinc-300">关于时段限制</p>
        <p class="text-[11px] text-zinc-500 leading-relaxed">
          启用全局时段选择后，系统将仅在定义的时段内开放点歌功能。如果未设置开始或结束时间，系统将视为该边界不设限。
        </p>
      </div>
    </div>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="flex flex-col items-center justify-center py-20 space-y-4 bg-zinc-900/20 border border-zinc-800/50 rounded-xl"
    >
      <div
        class="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"
      />
      <p class="text-xs font-black text-zinc-500 uppercase tracking-widest">加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="error"
      class="bg-red-500/5 border border-red-500/10 rounded-xl p-5 flex items-start gap-4"
    >
      <AlertCircle class="text-red-500 shrink-0 mt-0.5" :size="18" />
      <div class="space-y-1">
        <p class="text-xs font-bold text-zinc-300">获取数据失败</p>
        <p class="text-[11px] text-zinc-500 leading-relaxed">{{ error }}</p>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="playTimes.length === 0"
      class="flex flex-col items-center justify-center py-20 space-y-6 bg-zinc-900/20 border border-zinc-800/50 rounded-xl"
    >
      <div class="p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-700">
        <Clock :size="48" />
      </div>
      <div class="text-center space-y-2">
        <h3 class="text-lg font-bold text-zinc-100">暂无播出时段</h3>
        <p class="text-xs text-zinc-500">点击“添加播出时段”按钮创建第一个播出时段</p>
      </div>
    </div>

    <!-- 时段网格 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <TransitionGroup name="list">
        <div
          v-for="playTime in playTimes"
          :key="playTime.id"
          :class="[
            'group relative bg-zinc-900/30 border rounded-xl p-8 transition-all hover:shadow-2xl hover:shadow-black/40',
            playTime.enabled ? 'border-zinc-800/80' : 'border-zinc-800/40 opacity-60'
          ]"
        >
          <div class="flex items-start justify-between mb-6">
            <div
              :class="[
                'p-3 rounded-xl bg-zinc-950 border border-zinc-800 transition-all',
                playTime.enabled ? 'text-blue-500 border-blue-500/20' : 'text-zinc-700'
              ]"
            >
              <Clock :size="20" />
            </div>
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all',
                  playTime.enabled
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/50'
                ]"
              >
                {{ playTime.enabled ? '已启用' : '已禁用' }}
              </span>
              <button class="p-1.5 text-zinc-700 hover:text-zinc-400">
                <MoreVertical :size="14" />
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <h4
                class="text-lg font-black text-zinc-100 group-hover:text-blue-400 transition-colors"
              >
                {{ playTime.name }}
              </h4>
              <div
                class="flex items-center gap-2 mt-1.5 text-blue-500/80 font-black tracking-tighter"
              >
                <span class="text-xl">{{ playTime.startTime || '不限' }}</span>
                <div class="w-4 h-[2px] bg-zinc-800" />
                <span class="text-xl">{{ playTime.endTime || '不限' }}</span>
              </div>
            </div>

            <p class="text-xs text-zinc-500 font-medium leading-relaxed min-h-[32px] line-clamp-2">
              {{ playTime.description || '暂无详细描述...' }}
            </p>
          </div>

          <div class="mt-8 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
            <div class="flex gap-2">
              <button
                class="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                @click="editPlayTime(playTime)"
              >
                <Edit2 :size="14" />
              </button>
              <button
                class="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                @click="confirmDelete(playTime)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
            <button
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                playTime.enabled
                  ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
              ]"
              @click="togglePlayTimeStatus(playTime)"
            >
              <Power :size="12" />
              {{ playTime.enabled ? '禁用' : '启用' }}
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- 添加/编辑弹窗 -->
    <Transition name="modal">
      <div
        v-if="showAddForm || editingPlayTime"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="cancelForm" />
        <div
          class="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-black text-zinc-100 tracking-tight">
                {{ editingPlayTime ? '编辑播出时段' : '添加播出时段' }}
              </h3>
              <button
                class="p-2 text-zinc-500 hover:text-zinc-200 transition-colors"
                @click="cancelForm"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >时段名称</label
                >
                <input
                  v-model="formData.name"
                  type="text"
                  placeholder="例如: 午间广播"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30"
                >
              </div>

              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                    >开始时间 (可选)</label
                  >
                  <div class="relative">
                    <input
                      v-model="formData.startTime"
                      type="time"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 appearance-none"
                    >
                    <Clock
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none"
                      :size="14"
                    />
                  </div>
                  <p class="text-[9px] text-zinc-600 px-1">留空表示不限制开始时间</p>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                    >结束时间 (可选)</label
                  >
                  <div class="relative">
                    <input
                      v-model="formData.endTime"
                      type="time"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 appearance-none"
                    >
                    <Clock
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none"
                      :size="14"
                    />
                  </div>
                  <p class="text-[9px] text-zinc-600 px-1">留空表示不限制结束时间</p>
                </div>
              </div>

              <div class="space-y-2">
                <label
                  class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 flex items-center gap-2"
                >
                  <AlignLeft :size="10" /> 描述 (可选)
                </label>
                <textarea
                  v-model="formData.description"
                  placeholder="请输入时段描述信息..."
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-4 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 min-h-[100px] resize-none"
                />
              </div>

              <label class="flex items-center gap-3 cursor-pointer group px-1">
                <input
                  v-model="formData.enabled"
                  type="checkbox"
                  class="w-4 h-4 rounded border-zinc-800 bg-zinc-950 accent-blue-600"
                >
                <span
                  class="text-xs font-bold text-zinc-300 group-hover:text-blue-400 transition-colors"
                  >启用此播出时段</span
                >
              </label>

              <div
                v-if="formError"
                class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-[11px] text-red-400"
              >
                {{ formError }}
              </div>
            </div>
          </div>

          <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
            <button
              class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300"
              @click="cancelForm"
            >
              取消
            </button>
            <button
              :disabled="formSubmitting"
              class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-lg shadow-lg transition-all active:scale-95"
              @click="savePlayTime"
            >
              {{ formSubmitting ? '保存中...' : '保存设置' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认弹窗 -->
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm"
          @click="showDeleteConfirm = false"
        />
        <div
          class="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="p-8">
            <div class="flex flex-col items-center py-4 space-y-6">
              <div
                class="w-16 h-16 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center border border-red-500/10 shadow-xl shadow-red-900/5"
              >
                <AlertCircle :size="32" />
              </div>
              <div class="text-center space-y-2 px-4">
                <h4 class="text-lg font-bold text-zinc-100">
                  确定要删除播出时段 "{{ playTimeToDelete?.name }}" 吗？
                </h4>
                <p class="text-xs text-zinc-500 leading-relaxed">
                  此操作不可恢复，相关的歌曲点播和排期的时段设置将受影响或被清除。
                </p>
              </div>
              <div class="flex gap-3 w-full pt-4">
                <button
                  class="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 text-zinc-500 text-xs font-black rounded-lg transition-all hover:bg-zinc-800"
                  @click="showDeleteConfirm = false"
                >
                  取消
                </button>
                <button
                  :disabled="deleteInProgress"
                  class="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-lg shadow-xl shadow-red-900/20 transition-all active:scale-95"
                  @click="deletePlayTime"
                >
                  {{ deleteInProgress ? '删除中...' : '确认删除' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import type { PlayTime } from '~/types'
import {
  Plus,
  Clock,
  Edit2,
  Trash2,
  MoreVertical,
  Power,
  Info,
  AlertCircle,
  X,
  AlignLeft
} from 'lucide-vue-next'

const { getAuthConfig, isAdmin } = useAuth()
const { showToast: showNotification } = useToast()

const playTimes = ref<PlayTime[]>([])
const loading = ref(false)
const error = ref('')
const showAddForm = ref(false)
const editingPlayTime = ref<PlayTime | null>(null)
const playTimeToDelete = ref<PlayTime | null>(null)
const showDeleteConfirm = ref(false)
const formSubmitting = ref(false)
const deleteInProgress = ref(false)
const formError = ref('')
const enablePlayTimeSelection = ref(false)

// 表单数据
const formData = reactive({
  id: 0,
  name: '',
  startTime: '',
  endTime: '',
  description: '',
  enabled: true
})

// 初始化
onMounted(async () => {
  await fetchPlayTimes()
  await fetchSystemSettings()
})

// 获取播出时段列表
const fetchPlayTimes = async () => {
  if (!isAdmin.value) {
    error.value = '只有管理员才能管理播出时段'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const authConfig = getAuthConfig()
    const data = await $fetch('/api/admin/play-times', {
      ...authConfig
    })

    // 自定义排序：先按启用状态排序，然后有时间的排在前面，没有时间的排在后面
    playTimes.value = data.sort((a: PlayTime, b: PlayTime) => {
      // 首先按启用状态排序
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1 // 启用的排在前面
      }

      // 然后按是否有时间排序
      const aHasTime = !!(a.startTime || a.endTime)
      const bHasTime = !!(b.startTime || b.endTime)

      if (aHasTime !== bHasTime) {
        return aHasTime ? -1 : 1 // 有时间的排在前面
      }

      // 如果都有时间，按开始时间排序
      if (aHasTime && bHasTime) {
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime)
        } else if (a.startTime) {
          return -1
        } else if (b.startTime) {
          return 1
        }
      }

      // 最后按名称排序
      return a.name.localeCompare(b.name)
    })
  } catch (err: any) {
    error.value = err.message || '获取播出时段失败'
  } finally {
    loading.value = false
  }
}

// 获取系统设置
const fetchSystemSettings = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const data = await $fetch('/api/admin/system-settings', {
      ...authConfig
    })
    enablePlayTimeSelection.value = data.enablePlayTimeSelection
  } catch (err: any) {
    console.error('获取系统设置失败:', err.message)
  }
}

// 切换全局启用状态
const toggleGlobalEnabled = async () => {
  enablePlayTimeSelection.value = !enablePlayTimeSelection.value
  await updateSystemSettings()
}

// 更新系统设置
const updateSystemSettings = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      body: {
        enablePlayTimeSelection: enablePlayTimeSelection.value
      },
      ...authConfig
    })

    showNotification('系统设置已更新', 'success')
  } catch (err: any) {
    error.value = err.message || '更新系统设置失败'
    showNotification(error.value, 'error')
    // 如果失败，恢复状态
    enablePlayTimeSelection.value = !enablePlayTimeSelection.value
  }
}

// 打开添加表单
const openAddForm = () => {
  showAddForm.value = true
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true
  })
}

// 编辑播出时段
const editPlayTime = (playTime: PlayTime) => {
  editingPlayTime.value = playTime
  Object.assign(formData, {
    id: playTime.id,
    name: playTime.name,
    startTime: playTime.startTime || '',
    endTime: playTime.endTime || '',
    description: playTime.description || '',
    enabled: playTime.enabled
  })
}

// 切换播出时段状态
const togglePlayTimeStatus = async (playTime: PlayTime) => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    await $fetch(`/api/admin/play-times/${playTime.id}`, {
      method: 'PATCH',
      body: {
        enabled: !playTime.enabled
      },
      ...authConfig
    })

    // 更新本地数据
    await fetchPlayTimes()
    showNotification(playTime.enabled ? '播出时段已禁用' : '播出时段已启用', 'success')
  } catch (err: any) {
    error.value = err.message || '更新播出时段状态失败'
    showNotification(error.value, 'error')
  }
}

// 确认删除
const confirmDelete = (playTime: PlayTime) => {
  playTimeToDelete.value = playTime
  showDeleteConfirm.value = true
}

// 删除播出时段
const deletePlayTime = async () => {
  if (!playTimeToDelete.value || !isAdmin.value) return

  deleteInProgress.value = true

  try {
    const authConfig = getAuthConfig()
    await $fetch(`/api/admin/play-times/${playTimeToDelete.value.id}`, {
      method: 'DELETE',
      ...authConfig
    })

    // 更新本地数据
    await fetchPlayTimes()
    showDeleteConfirm.value = false
    playTimeToDelete.value = null
    showNotification('播出时段已删除', 'success')
  } catch (err: any) {
    error.value = err.message || '删除播出时段失败'
    showNotification(error.value, 'error')
  } finally {
    deleteInProgress.value = false
  }
}

// 保存播出时段
const savePlayTime = async () => {
  formError.value = ''

  // 时间验证（仅当两个时间都有填写时才进行比较）
  if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
    formError.value = '开始时间必须早于结束时间'
    return
  }

  // 至少要有名称
  if (!formData.name.trim()) {
    formError.value = '时段名称不能为空'
    return
  }

  // 检查名称是否重复
  const isUpdate = !!editingPlayTime.value
  const nameExists = playTimes.value.some(
    (pt) =>
      pt.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!isUpdate || pt.id !== formData.id)
  )

  if (nameExists) {
    formError.value = '播出时段名称已存在，请使用其他名称'
    return
  }

  formSubmitting.value = true

  try {
    const authConfig = getAuthConfig()

    await $fetch(isUpdate ? `/api/admin/play-times/${formData.id}` : '/api/admin/play-times', {
      method: isUpdate ? 'PUT' : 'POST',
      body: {
        name: formData.name.trim(),
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        description: formData.description || null,
        enabled: formData.enabled
      },
      ...authConfig
    })

    // 更新本地数据
    await fetchPlayTimes()
    cancelForm()
    showNotification(isUpdate ? '播出时段已更新' : '播出时段已创建', 'success')
  } catch (err: any) {
    formError.value = err.message || '保存播出时段失败'
    showNotification(formError.value, 'error')
  } finally {
    formSubmitting.value = false
  }
}

// 取消表单
const cancelForm = () => {
  showAddForm.value = false
  editingPlayTime.value = null
  formError.value = ''

  // 重置表单数据
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true
  })
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: all 0.3s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
  opacity: 0;
}
</style>
