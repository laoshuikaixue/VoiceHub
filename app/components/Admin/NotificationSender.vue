<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">向用户发送通知</h2>
        <p class="text-xs text-zinc-500 mt-1">即时推送系统公告、活动信息或重要提醒至指定群体</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- 左侧：编辑区 -->
      <div class="lg:col-span-7 space-y-6">
        <div class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-8 shadow-xl">
          <div class="space-y-6">
            <!-- 标题 -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1"
                >通知标题</label
              >
              <input
                v-model="form.title"
                type="text"
                placeholder="请输入通知标题"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200 placeholder:text-zinc-800"
              >
            </div>

            <!-- 内容 -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1"
                >通知内容</label
              >
              <textarea
                v-model="form.content"
                placeholder="请输入通知详情内容..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200 placeholder:text-zinc-800 min-h-[160px] resize-none"
              />
            </div>

            <!-- 范围选择 -->
            <div class="space-y-3 pt-4 border-t border-zinc-800/50">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1"
                >通知范围</label
              >
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="opt in targetOptions"
                  :key="opt.id"
                  :class="[
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border',
                    form.scope === opt.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
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
                  class="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center gap-4"
                >
                  <Info class="text-blue-500 shrink-0" :size="18" />
                  <p class="text-[11px] font-bold text-zinc-400">
                    将向系统中所有已注册的活跃用户发送此通知。
                  </p>
                </div>

                <div v-else-if="form.scope === 'GRADE'" key="grade" class="space-y-4">
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1"
                      >选择年级</span
                    >
                    <CustomSelect
                      v-model="form.grade"
                      :options="['高一', '高二', '高三', '教师']"
                      placeholder="请选择年级"
                      class="w-full md:w-64"
                    />
                  </div>
                </div>

                <div
                  v-else-if="form.scope === 'CLASS'"
                  key="class"
                  class="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1"
                      >年级</span
                    >
                    <CustomSelect
                      v-model="form.classGrade"
                      :options="['高一', '高二', '高三', '教师']"
                      placeholder="请选择年级"
                      class="w-full"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1"
                      >班级</span
                    >
                    <input
                      v-model="form.className"
                      type="text"
                      placeholder="如: 1班、2班"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500/30 text-zinc-200"
                    >
                  </div>
                </div>

                <div v-else-if="form.scope === 'MULTI_CLASS'" key="multi" class="space-y-4">
                  <div class="p-6 bg-zinc-950/50 border border-zinc-800 border-dashed rounded-2xl">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <CustomSelect
                        v-model="multiClassForm.grade"
                        :options="['高一', '高二', '高三', '教师']"
                        placeholder="请选择年级"
                        class="w-full"
                      />
                      <div class="flex gap-2">
                        <input
                          v-model="multiClassForm.class"
                          type="text"
                          placeholder="输入班级名称"
                          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs focus:outline-none text-zinc-200"
                        >
                        <button
                          :disabled="!canAddClass"
                          class="px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-400 font-bold rounded-xl text-xs transition-all"
                          @click="addClassToSelection"
                        >
                          添加
                        </button>
                      </div>
                    </div>

                    <div v-if="form.selectedClasses.length > 0" class="flex flex-wrap gap-2">
                      <div
                        v-for="(cls, index) in form.selectedClasses"
                        :key="index"
                        class="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg group"
                      >
                        <span class="text-[10px] font-bold text-zinc-400"
                          >{{ cls.grade }} {{ cls.class }}</span
                        >
                        <button
                          class="text-zinc-600 hover:text-red-400 transition-colors"
                          @click="removeClassFromSelection(index)"
                        >
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                    <div v-else class="text-center py-4">
                      <p class="text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                        未选择任何班级
                      </p>
                    </div>
                  </div>
                </div>

                <div v-else-if="form.scope === 'SPECIFIC_USERS'" key="specific" class="space-y-4">
                  <div class="relative flex items-center">
                    <Search
                      v-if="!userSearchLoading"
                      class="absolute left-4 text-zinc-700 pointer-events-none"
                      :size="16"
                    />
                    <Loader2
                      v-else
                      class="absolute left-4 text-blue-500 animate-spin pointer-events-none"
                      :size="16"
                    />
                    <input
                      v-model="userSearchQuery"
                      type="text"
                      placeholder="搜索并选择用户 (姓名、用户名或ID)..."
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
                      @input="onUserSearchInput"
                    >
                  </div>

                  <!-- 搜索结果 -->
                  <div
                    v-if="showUserSearchResults && userSearchResults.length > 0"
                    class="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar"
                  >
                    <div class="px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/40">
                      <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
                        >搜索结果 ({{ userSearchResults.length }})</span
                      >
                    </div>
                    <div
                      v-for="user in userSearchResults"
                      :key="user.id"
                      class="flex items-center justify-between p-4 border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/30 transition-all"
                    >
                      <div>
                        <h5 class="text-sm font-bold text-zinc-200">
                          {{ user.name || user.username }}
                        </h5>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span class="text-[10px] text-blue-500 font-black"
                            >@{{ user.username }}</span
                          >
                          <span
                            v-if="user.grade && user.class"
                            class="text-[10px] text-zinc-600 font-bold uppercase tracking-widest"
                            >{{ user.grade }} {{ user.class }}</span
                          >
                          <span class="text-[10px] text-zinc-700 font-black">{{
                            getRoleText(user.role)
                          }}</span>
                        </div>
                      </div>
                      <button
                        :disabled="isUserSelected(user.id)"
                        class="px-3 py-1.5 bg-zinc-800 hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-zinc-400 text-[10px] font-black rounded-lg transition-all uppercase"
                        @click="addUserToSelection(user)"
                      >
                        {{ isUserSelected(user.id) ? '已选择' : '选择' }}
                      </button>
                    </div>
                  </div>

                  <!-- 已选择的用户 -->
                  <div v-if="form.selectedUsers.length > 0" class="space-y-3">
                    <div class="flex items-center justify-between px-1">
                      <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
                        >已选择用户 ({{ form.selectedUsers.length }})</span
                      >
                      <button
                        class="text-[9px] font-black text-red-500/70 hover:text-red-500 uppercase tracking-widest transition-colors"
                        @click="clearAllSelectedUsers"
                      >
                        清空全部
                      </button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="(user, index) in form.selectedUsers"
                        :key="user.id"
                        class="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg group"
                      >
                        <div class="flex flex-col">
                          <span class="text-[10px] font-bold text-zinc-300 leading-none">{{
                            user.name || user.username
                          }}</span>
                          <span class="text-[8px] text-zinc-600">@{{ user.username }}</span>
                        </div>
                        <button
                          class="text-zinc-600 hover:text-red-400 transition-colors"
                          @click="removeUserFromSelection(index)"
                        >
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center py-4">
                    <p class="text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                      未选择任何用户
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
              class="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3"
            >
              <AlertCircle class="text-red-500 shrink-0" :size="18" />
              <p class="text-xs font-bold text-red-400">{{ error }}</p>
            </div>
            <div
              v-if="success"
              class="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl flex items-center gap-3"
            >
              <Check class="text-green-500 shrink-0" :size="18" />
              <p class="text-xs font-bold text-green-400">{{ success }}</p>
            </div>
          </div>

          <div class="mt-10 flex justify-end">
            <button
              :disabled="loading || !isFormValid"
              :class="[
                'flex items-center gap-2 px-10 py-4 bg-zinc-950 border border-zinc-800 text-xs font-black rounded-2xl transition-all uppercase tracking-[0.2em] shadow-lg',
                loading || !isFormValid
                  ? 'text-zinc-800 cursor-not-allowed'
                  : 'text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900'
              ]"
              @click="sendNotification"
            >
              <Loader2 v-if="loading" class="animate-spin" :size="16" />
              <Send v-else :size="16" />
              {{ loading ? '发送中...' : '发送通知' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：预览区 -->
      <div class="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
        <div
          class="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] p-8 shadow-xl flex flex-col h-full"
        >
          <h3
            class="text-sm font-black text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-2"
          >
            <Eye :size="16" class="text-blue-500" /> 通知预览
          </h3>

          <div class="flex-1 flex flex-col items-center justify-center p-4">
            <div
              class="w-full max-w-[320px] bg-[#0c0c0e] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative"
            >
              <!-- 顶部装饰 -->
              <div class="h-1.5 bg-blue-600 w-full" />

              <div class="p-6 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/20"
                    >
                      <Bell :size="14" />
                    </div>
                    <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                      >VoiceHub 系统</span
                    >
                  </div>
                  <span class="text-[9px] text-zinc-700 font-bold uppercase tracking-wider"
                    >刚刚</span
                  >
                </div>

                <div class="space-y-2">
                  <h4
                    :class="[
                      'text-sm font-black transition-colors',
                      form.title ? 'text-zinc-100' : 'text-zinc-800 italic'
                    ]"
                  >
                    {{ form.title || '通知标题' }}
                  </h4>
                  <p
                    :class="[
                      'text-[11px] leading-relaxed transition-colors',
                      form.content ? 'text-zinc-400' : 'text-zinc-800 italic line-clamp-3'
                    ]"
                  >
                    {{ form.content || '这里将显示通知的详细内容预览...' }}
                  </p>
                </div>

                <div class="pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <Users :size="12" class="text-zinc-700" />
                    <span class="text-[9px] font-black text-zinc-600 uppercase tracking-wider">
                      发送范围: {{ scopeDescription }}
                    </span>
                  </div>
                  <button
                    class="p-1.5 text-blue-500 hover:bg-blue-600/10 rounded-lg transition-all"
                  >
                    <MessageSquare :size="14" />
                  </button>
                </div>
              </div>

              <!-- 背景光晕 -->
              <div
                class="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px] -z-10 rounded-full"
              />
            </div>

            <div class="mt-8 space-y-3 w-full max-w-[320px]">
              <div
                class="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl"
              >
                <AlertCircle class="text-amber-500 shrink-0 mt-0.5" :size="14" />
                <p class="text-[10px] font-bold text-zinc-500 leading-normal">
                  预览图仅供参考布局，实际发送效果可能会根据用户设备显示语言和屏幕尺寸有所不同。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted } from 'vue'
import {
  Send,
  Users,
  GraduationCap,
  LayoutGrid,
  User,
  Search,
  Bell,
  Info,
  X,
  Check,
  Plus,
  AlertCircle,
  Eye,
  MessageSquare,
  Loader2
} from 'lucide-vue-next'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useAuth } from '~/composables/useAuth'
import { useAdmin } from '~/composables/useAdmin'

const { isAdmin } = useAuth()
const { sendAdminNotification } = useAdmin()

// 表单数据
const form = ref({
  title: '',
  content: '',
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

const loading = ref(false)
const error = ref('')
const success = ref('')

// 用户搜索相关
const userSearchQuery = ref('')
const userSearchResults = ref([])
const showUserSearchResults = ref(false)
const userSearchLoading = ref(false)
let userSearchTimeout = null

const targetOptions = [
  { id: 'ALL', label: '全体用户', icon: Users },
  { id: 'GRADE', label: '按年级选择', icon: GraduationCap },
  { id: 'CLASS', label: '按班级选择', icon: LayoutGrid },
  { id: 'MULTI_CLASS', label: '多班级选择', icon: Plus },
  { id: 'SPECIFIC_USERS', label: '指定用户', icon: User }
]

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
      }
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
    admin: '管理员',
    teacher: '教师',
    student: '学生'
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
      return '全体用户'
    case 'GRADE':
      return form.value.grade ? `${form.value.grade}年级` : '请选择年级'
    case 'CLASS':
      return form.value.classGrade && form.value.className
        ? `${form.value.classGrade}年级${form.value.className}班`
        : '请选择班级'
    case 'MULTI_CLASS':
      return form.value.selectedClasses.length > 0
        ? `${form.value.selectedClasses.length}个班级`
        : '请选择班级'
    case 'SPECIFIC_USERS':
      return form.value.selectedUsers.length > 0
        ? `已选择${form.value.selectedUsers.length}个用户`
        : '请选择用户'
    default:
      return ''
  }
})

// 发送通知
const sendNotification = async () => {
  if (!isAdmin.value) {
    error.value = '只有管理员可以发送系统通知'
    return
  }

  if (!isFormValid.value) {
    error.value = '请填写完整信息'
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
      success.value = `成功发送通知给 ${result.sentCount} 名用户`

      // 3秒后自动隐藏成功提示
      setTimeout(() => {
        success.value = ''
      }, 3000)

      // 清空表单
      form.value = {
        title: '',
        content: '',
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
      throw new Error(result?.message || '发送通知失败')
    }
  } catch (err) {
    error.value = err.message || '发送通知时发生错误'
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
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
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
