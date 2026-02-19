<template>
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
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      @click="$emit('close')"
    >
      <div
        class="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        @click.stop
      >
        <!-- 头部 -->
        <div class="p-8 pb-4 flex items-center justify-between border-b border-zinc-800/50">
          <div>
            <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-500"
              >
                <Layers :size="20" />
              </div>
              批量更新学生信息
            </h3>
            <p class="text-xs text-zinc-500 mt-1 ml-13">
              快速调整学生年级、班级或通过 Excel 批量修改
            </p>
          </div>
          <button
            class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-xl transition-all"
            @click="$emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar space-y-8">
          <!-- 更新方式选择 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              :class="[
                'relative flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer group',
                updateType === 'grade-only'
                  ? 'bg-purple-500/5 border-purple-500/50 ring-4 ring-purple-500/10'
                  : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
              ]"
            >
              <input v-model="updateType" type="radio" value="grade-only" class="sr-only" >
              <div class="flex items-center justify-between mb-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    updateType === 'grade-only'
                      ? 'bg-purple-500 text-white'
                      : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                  ]"
                >
                  <Calendar :size="18" />
                </div>
                <div
                  v-if="updateType === 'grade-only'"
                  class="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center"
                >
                  <Check :size="12" class="text-white" />
                </div>
              </div>
              <span class="text-sm font-black text-zinc-200 uppercase tracking-widest"
                >仅更新年级</span
              >
              <span class="text-[10px] text-zinc-500 mt-1 font-medium leading-relaxed"
                >批量更新选中学生的年级，保持班级不变</span
              >
            </label>

            <label
              :class="[
                'relative flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer group',
                updateType === 'excel-batch'
                  ? 'bg-emerald-500/5 border-emerald-500/50 ring-4 ring-emerald-500/10'
                  : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
              ]"
            >
              <input v-model="updateType" type="radio" value="excel-batch" class="sr-only" >
              <div class="flex items-center justify-between mb-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    updateType === 'excel-batch'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                  ]"
                >
                  <FileSpreadsheet :size="18" />
                </div>
                <div
                  v-if="updateType === 'excel-batch'"
                  class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                >
                  <Check :size="12" class="text-white" />
                </div>
              </div>
              <span class="text-sm font-black text-zinc-200 uppercase tracking-widest"
                >Excel 批量更新</span
              >
              <span class="text-[10px] text-zinc-500 mt-1 font-medium leading-relaxed"
                >通过 Excel 文件精确匹配并批量修改学生信息</span
              >
            </label>
          </div>

          <!-- 仅更新年级面板 -->
          <div
            v-if="updateType === 'grade-only'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div class="p-6 bg-zinc-950/50 border border-zinc-800/50 rounded-xl space-y-6">
              <div
                class="flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest"
              >
                <Filter :size="14" class="text-purple-500" />
                学生范围筛选
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >当前年级</label
                  >
                  <CustomSelect
                    v-model="gradeFilter"
                    :options="gradeOptions"
                    label-key="label"
                    value-key="value"
                    placeholder="全部年级"
                    class-name="w-full"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >当前班级</label
                  >
                  <CustomSelect
                    v-model="classFilter"
                    :options="classOptions"
                    label-key="label"
                    value-key="value"
                    placeholder="全部班级"
                    class-name="w-full"
                  />
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest"
                    >选择学生 ({{ selectedUserIds.length }}/{{ filteredStudents.length }})</label
                  >
                  <button
                    class="text-[10px] font-black text-purple-400 hover:text-purple-300 uppercase tracking-widest transition-colors"
                    @click="toggleSelectAll"
                  >
                    {{ isAllSelected ? '取消全选' : '选择当前全部' }}
                  </button>
                </div>
                <div
                  class="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 custom-scrollbar"
                >
                  <div
                    v-if="filteredStudents.length === 0"
                    class="py-10 text-center text-xs text-zinc-600 font-medium"
                  >
                    没有匹配条件的学生
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <label
                      v-for="student in filteredStudents"
                      :key="student.id"
                      class="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900/50 cursor-pointer transition-colors group"
                    >
                      <input
                        v-model="selectedUserIds"
                        :value="student.id"
                        type="checkbox"
                        class="w-4 h-4 rounded-md border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500/20"
                      >
                      <div class="flex flex-col">
                        <span
                          class="text-xs font-bold text-zinc-200 group-hover:text-purple-400 transition-colors"
                          >{{ student.name }}</span
                        >
                        <span class="text-[10px] text-zinc-600 font-mono">{{
                          student.username
                        }}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-6 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-6">
              <div
                class="flex items-center gap-2 text-xs font-black text-purple-400 uppercase tracking-widest"
              >
                <Save :size="14" />
                目标设置
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >目标年级</label
                  >
                  <div class="relative group">
                    <Calendar
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-purple-500 transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="targetGrade"
                      type="text"
                      placeholder="例如: 2025"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-purple-500/30 transition-all text-zinc-200"
                    >
                  </div>
                </div>
                <label
                  class="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-all"
                >
                  <input
                    v-model="keepClass"
                    type="checkbox"
                    class="w-5 h-5 rounded-md border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500/20"
                  >
                  <span class="text-xs font-bold text-zinc-300">保持原有班级不变</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Excel 批量更新面板 -->
          <div
            v-if="updateType === 'excel-batch'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <!-- 文件上传区 -->
            <div
              :class="[
                'relative group cursor-pointer transition-all',
                isDragOver ? 'scale-[0.99]' : ''
              ]"
              @drop="handleDrop"
              @dragover.prevent
              @dragenter.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @click="$refs.fileInput.click()"
            >
              <input
                ref="fileInput"
                accept=".xlsx,.xls"
                class="hidden"
                type="file"
                @change="handleFileSelect"
              >
              <div
                :class="[
                  'w-full py-12 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center gap-4',
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                ]"
              >
                <div
                  :class="[
                    'w-16 h-16 rounded-lg bg-zinc-900 flex items-center justify-center transition-colors shadow-xl',
                    isDragOver ? 'text-emerald-500' : 'text-zinc-600 group-hover:text-emerald-500'
                  ]"
                >
                  <Upload :size="32" />
                </div>
                <div class="text-center">
                  <p class="text-base font-black text-zinc-200 tracking-tight">
                    拖拽 Excel 文件到此处
                  </p>
                  <p class="text-xs text-zinc-500 mt-1">
                    或 <span class="text-emerald-500 font-bold">点击选择文件</span> (支持 .xlsx /
                    .xls)
                  </p>
                </div>
              </div>
            </div>

            <!-- 模板与说明 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                class="md:col-span-2 p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3"
              >
                <div
                  class="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest"
                >
                  <Info :size="12" />
                  文件格式规范
                </div>
                <ul class="text-[10px] text-zinc-600 space-y-1.5 font-medium leading-relaxed">
                  <li class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-zinc-700 mt-1.5" />
                    第一行为表头：用户名、姓名、年级、班级、新用户名
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-zinc-700 mt-1.5" />
                    <span class="text-zinc-400 font-bold">用户名</span> 列用于精确匹配现有账户
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-zinc-700 mt-1.5" />
                    字段留空则保持原值不变，不进行覆盖更新
                  </li>
                </ul>
              </div>
              <button
                class="p-5 bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all flex flex-col items-center justify-center gap-2 group"
                @click="downloadTemplate"
              >
                <div
                  class="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 group-hover:scale-110 transition-transform"
                >
                  <Download :size="20" />
                </div>
                <span class="text-[10px] font-black text-emerald-500 uppercase tracking-widest"
                  >获取模板文件</span
                >
              </button>
            </div>

            <!-- 预览表格 -->
            <div v-if="excelPreviewData.length > 0" class="space-y-4">
              <div class="flex items-center justify-between ml-1">
                <label class="text-xs font-black text-zinc-400 uppercase tracking-widest"
                  >数据预览 ({{ excelPreviewData.length }}条)</label
                >
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-1.5">
                    <div class="w-2 h-2 rounded-full bg-emerald-500" />
                    <span class="text-[10px] text-zinc-500 font-bold">待更新</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="w-2 h-2 rounded-full bg-red-500" />
                    <span class="text-[10px] text-zinc-500 font-bold">错误</span>
                  </div>
                </div>
              </div>
              <div class="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
                <div class="overflow-x-auto custom-scrollbar">
                  <table class="w-full text-left border-collapse">
                    <thead
                      class="bg-zinc-900/80 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800"
                    >
                      <tr>
                        <th class="px-5 py-4 whitespace-nowrap">匹配用户</th>
                        <th class="px-5 py-4 whitespace-nowrap">当前信息</th>
                        <th class="px-5 py-4 whitespace-nowrap">更新后</th>
                        <th class="px-5 py-4 whitespace-nowrap text-right">匹配状态</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-900">
                      <tr
                        v-for="(row, index) in excelPreviewData.slice(0, 10)"
                        :key="index"
                        :class="[
                          row.error ? 'bg-red-500/5' : 'hover:bg-zinc-900/30 transition-colors'
                        ]"
                      >
                        <td class="px-5 py-4">
                          <div class="flex flex-col">
                            <span
                              :class="[
                                'text-xs font-bold',
                                row.error ? 'text-red-400' : 'text-zinc-200'
                              ]"
                              >{{ row.username }}</span
                            >
                            <span class="text-[10px] text-zinc-600 font-medium">{{
                              row.name || '-'
                            }}</span>
                          </div>
                        </td>
                        <td class="px-5 py-4">
                          <div class="text-[10px] text-zinc-500 font-medium">
                            {{ row.currentGrade || '-' }}年级 {{ row.currentClass || '-' }}
                          </div>
                        </td>
                        <td class="px-5 py-4">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-emerald-400">{{
                              row.newGrade || row.currentGrade || '-'
                            }}</span>
                            <span class="text-[10px] text-zinc-700">/</span>
                            <span class="text-xs font-bold text-emerald-400">{{
                              row.newClass || row.currentClass || '-'
                            }}</span>
                          </div>
                        </td>
                        <td class="px-5 py-4 text-right">
                          <span
                            v-if="row.error"
                            class="px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black rounded uppercase tracking-tighter border border-red-500/20"
                          >
                            {{ row.error }}
                          </span>
                          <span
                            v-else
                            class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded uppercase tracking-tighter border border-emerald-500/20"
                          >
                            已就绪
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div
                  v-if="excelPreviewData.length > 10"
                  class="p-4 text-center border-t border-zinc-900 bg-zinc-900/20 text-[10px] text-zinc-600 font-bold uppercase tracking-widest"
                >
                  以及另外 {{ excelPreviewData.length - 10 }} 条记录已在队列中
                </div>
              </div>
            </div>
          </div>

          <!-- 错误提示 -->
          <div
            v-if="error"
            class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs animate-in shake duration-300"
          >
            <AlertCircle :size="16" />
            {{ error }}
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-8 pt-4 border-t border-zinc-800/50 bg-zinc-900/50 flex gap-3">
          <button
            class="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
            @click="$emit('close')"
          >
            取消操作
          </button>
          <button
            :disabled="loading || !canUpdate"
            :class="[
              'flex-[2] px-6 py-4 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95',
              updateType === 'excel-batch'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
            ]"
            @click="performUpdate"
          >
            <RefreshCw v-if="loading" class="animate-spin" :size="16" />
            <Save v-else :size="16" />
            {{ loading ? '正在提交更新...' : '确认并开始更新' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import {
  Layers,
  X,
  Calendar,
  FileSpreadsheet,
  Check,
  Filter,
  ChevronDown,
  Save,
  Upload,
  Download,
  Info,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-vue-next'

import CustomSelect from '~/components/UI/Common/CustomSelect.vue'

const props = defineProps({
  show: Boolean,
  users: Array
})

const emit = defineEmits(['close', 'update-success'])

// 响应式数据
const updateType = ref('grade-only')
const loading = ref(false)
const error = ref('')

// 仅更新年级相关
const gradeFilter = ref('')
const classFilter = ref('')
const selectedUserIds = ref([])
const targetGrade = ref('')
const keepClass = ref(true)

// Excel批量更新相关
const isDragOver = ref(false)
const excelPreviewData = ref([])
const fileInput = ref(null)

// 所有用户的年级班级信息
const allGrades = ref([])
const allClasses = ref([])
// 所有学生用户数据
const allStudents = ref([])

// 服务
const auth = useAuth()

// 计算属性
const students = computed(() => {
  return allStudents.value.length > 0
    ? allStudents.value
    : props.users.filter((user) => user.role === 'USER')
})

const availableGrades = computed(() => {
  return allGrades.value.length > 0
    ? allGrades.value
    : [...new Set(students.value.map((s) => s.grade).filter(Boolean))].sort()
})

const availableClasses = computed(() => {
  return allClasses.value.length > 0
    ? allClasses.value
    : [...new Set(students.value.map((s) => s.class).filter(Boolean))].sort()
})

const gradeOptions = computed(() => {
  return [
    { label: '全部年级', value: '' },
    ...availableGrades.value.map((g) => ({ label: g, value: g }))
  ]
})

const classOptions = computed(() => {
  return [
    { label: '全部班级', value: '' },
    ...availableClasses.value.map((c) => ({ label: c, value: c }))
  ]
})

const filteredStudents = computed(() => {
  let filtered = students.value

  if (gradeFilter.value) {
    filtered = filtered.filter((s) => s.grade === gradeFilter.value)
  }

  if (classFilter.value) {
    filtered = filtered.filter((s) => s.class === classFilter.value)
  }

  return filtered
})

const isAllSelected = computed(() => {
  return (
    filteredStudents.value.length > 0 &&
    selectedUserIds.value.length === filteredStudents.value.length
  )
})

const canUpdate = computed(() => {
  if (updateType.value === 'grade-only') {
    return selectedUserIds.value.length > 0 && targetGrade.value.trim()
  } else if (updateType.value === 'excel-batch') {
    return excelPreviewData.value.length > 0 && excelPreviewData.value.some((row) => !row.error)
  }
  return false
})

// 方法
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedUserIds.value = []
  } else {
    selectedUserIds.value = filteredStudents.value.map((s) => s.id)
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    processExcelFile(file)
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  const file = event.dataTransfer.files[0]
  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
    processExcelFile(file)
  }
}

const processExcelFile = async (file) => {
  try {
    loading.value = true
    error.value = ''

    // 确保学生数据已加载
    if (students.value.length === 0) {
      console.log('学生数据为空，重新获取数据...')
      await fetchAllStudents()
      // 等待一小段时间确保数据更新
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 动态加载XLSX库
    if (typeof window.XLSX === 'undefined') {
      await loadXLSX()
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = window.XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet)

        parseExcelData(jsonData)
      } catch (parseError) {
        console.error('解析Excel文件失败:', parseError)
        error.value = 'Excel文件格式错误，请检查文件格式'
        loading.value = false
      }
    }

    reader.onerror = () => {
      console.error('读取文件失败')
      error.value = '读取文件失败，请重试'
      loading.value = false
    }

    reader.readAsArrayBuffer(file)
  } catch (err) {
    console.error('处理Excel文件失败:', err)
    const errorMessage = err && err.message ? err.message : '未知错误，请检查文件格式或网络连接'
    error.value = '处理Excel文件失败: ' + errorMessage
    loading.value = false
  }
}

const parseExcelData = (jsonData) => {
  const previewData = []
  const userMap = new Map()

  // 创建用户映射，同时处理用户名标准化
  students.value.forEach((user) => {
    if (user.username) {
      const normalizedUsername = user.username.trim().toLowerCase()
      userMap.set(normalizedUsername, user)
      userMap.set(user.username, user)
    }
  })

  jsonData.forEach((row, index) => {
    const username = (row['用户名'] || row['username'] || '').toString().trim()
    const name = row['姓名'] || row['name'] || ''
    const newGrade = row['年级'] || row['grade'] ? String(row['年级'] || row['grade']).trim() : ''
    const newClass = row['班级'] || row['class'] ? String(row['班级'] || row['class']).trim() : ''
    const newUsername = row['新用户名'] || row['new_username'] || ''

    if (!username) {
      previewData.push({
        username: '',
        name: name,
        newGrade: newGrade,
        newClass: newClass,
        newUsername: newUsername,
        error: '用户名不能为空'
      })
      return
    }

    const existingUser =
      userMap.get(username) ||
      userMap.get(username.toLowerCase()) ||
      userMap.get(username.toUpperCase())

    if (!existingUser) {
      previewData.push({
        username: username,
        name: name,
        newGrade: newGrade,
        newClass: newClass,
        newUsername: newUsername,
        error: '用户不存在'
      })
      return
    }

    previewData.push({
      userId: existingUser.id,
      username: username,
      name: existingUser.name,
      currentGrade: existingUser.grade,
      currentClass: existingUser.class,
      newGrade: newGrade,
      newClass: newClass,
      newUsername: newUsername
    })
  })

  excelPreviewData.value = previewData
  loading.value = false
}

const loadXLSX = async () => {
  return new Promise((resolve, reject) => {
    if (typeof window.XLSX !== 'undefined') {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    script.onload = resolve
    script.onerror = (error) => {
      console.error('加载XLSX库失败:', error)
      reject(new Error('无法加载Excel处理库，请检查网络连接'))
    }
    document.head.appendChild(script)
  })
}

const downloadTemplate = () => {
  const templateData = [
    { 用户名: 'student001', 姓名: '张三', 年级: '2025', 班级: '1班', 新用户名: 'new_student001' },
    { 用户名: 'student002', 姓名: '李四', 年级: '2025', 班级: '2班', 新用户名: '' }
  ]

  const ws = window.XLSX.utils.json_to_sheet(templateData)
  const wb = window.XLSX.utils.book_new()
  window.XLSX.utils.book_append_sheet(wb, ws, '学生信息')
  window.XLSX.writeFile(wb, '学生信息批量更新模板.xlsx')
}

const performUpdate = async () => {
  try {
    loading.value = true
    error.value = ''

    if (updateType.value === 'grade-only') {
      await performGradeUpdate()
    } else if (updateType.value === 'excel-batch') {
      await performExcelUpdate()
    }

    emit('update-success')
    emit('close')
  } catch (err) {
    console.error('批量更新失败:', err)
    error.value = '批量更新失败: ' + err.message
  } finally {
    loading.value = false
  }
}

const performGradeUpdate = async () => {
  const response = await $fetch('/api/admin/users/batch-grade-update', {
    method: 'POST',
    body: {
      userIds: selectedUserIds.value,
      targetGrade: targetGrade.value.trim(),
      keepClass: keepClass.value
    },
    ...auth.getAuthConfig()
  })

  if (!response.success) {
    throw new Error(response.message || '批量更新失败')
  }
}

const performExcelUpdate = async () => {
  const validUpdates = excelPreviewData.value.filter((row) => !row.error && row.userId)

  if (validUpdates.length === 0) {
    throw new Error('没有有效的更新数据')
  }

  // 分批更新，避免请求过大
  const batchSize = 50
  for (let i = 0; i < validUpdates.length; i += batchSize) {
    const batch = validUpdates.slice(i, i + batchSize)
    const updates = batch.map((row) => ({
      userId: row.userId,
      grade: row.newGrade ? String(row.newGrade).trim() : undefined,
      class: row.newClass ? String(row.newClass).trim() : undefined,
      username: row.newUsername ? String(row.newUsername).trim() : undefined
    }))

    await $fetch('/api/admin/users/batch-update', {
      method: 'POST',
      body: { updates },
      ...auth.getAuthConfig()
    })
  }
}

// 获取所有学生用户数据
const fetchAllStudents = async () => {
  try {
    const response = await $fetch('/api/admin/users', {
      method: 'GET',
      query: {
        page: 1,
        limit: 10000,
        role: 'USER'
      },
      ...auth.getAuthConfig()
    })

    if (response.success && response.users) {
      const users = response.users
      allStudents.value = users

      const grades = [...new Set(users.map((u) => u.grade).filter(Boolean))].sort()
      const classes = [...new Set(users.map((u) => u.class).filter(Boolean))].sort()

      allGrades.value = grades
      allClasses.value = classes
    }
  } catch (err) {
    console.error('获取所有学生数据失败:', err)
  }
}

// 监听显示状态
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      fetchAllStudents()
      // 重置状态
      selectedUserIds.value = []
      excelPreviewData.value = []
      error.value = ''
    }
  }
)
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #718096;
}
</style>
