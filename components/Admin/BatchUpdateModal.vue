<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content modal-lg" @click.stop>
      <div class="modal-header">
        <h3>批量更新学生信息</h3>
        <button @click="$emit('close')" class="close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- 更新方式选择 -->
        <div class="update-type-selector">
          <div class="radio-group">
            <label class="radio-option">
              <input
                type="radio"
                v-model="updateType"
                value="grade-only"
                class="radio-input"
              />
              <span class="radio-label">仅更新年级</span>
              <span class="radio-description">批量更新选中学生的年级，保持班级不变</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                v-model="updateType"
                value="excel-batch"
                class="radio-input"
              />
              <span class="radio-label">Excel批量更新</span>
              <span class="radio-description">通过Excel文件批量更新学生的年级和班级信息</span>
            </label>
          </div>
        </div>

        <!-- 仅更新年级 -->
        <div v-if="updateType === 'grade-only'" class="grade-update-section">
          <div class="section-title">
            <h4>批量年级更新</h4>
            <p class="section-description">选择要更新的学生和目标年级</p>
          </div>

          <!-- 学生筛选 -->
          <div class="filter-section">
            <div class="filter-row">
              <div class="filter-group">
                <label>当前年级筛选</label>
                <select v-model="gradeFilter" class="form-select">
                  <option value="">全部年级</option>
                  <option v-for="grade in availableGrades" :key="grade" :value="grade">
                    {{ grade }}
                  </option>
                </select>
              </div>
              <div class="filter-group">
                <label>当前班级筛选</label>
                <select v-model="classFilter" class="form-select">
                  <option value="">全部班级</option>
                  <option v-for="cls in availableClasses" :key="cls" :value="cls">
                    {{ cls }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 学生列表 -->
          <div class="student-list-section">
            <div class="list-header">
              <label class="select-all-checkbox">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                />
                <span>全选 ({{ selectedUserIds.length }}/{{ filteredStudents.length }})</span>
              </label>
            </div>
            <div class="student-list">
              <div
                v-for="student in filteredStudents"
                :key="student.id"
                class="student-item"
              >
                <label class="student-checkbox">
                  <input
                    type="checkbox"
                    :value="student.id"
                    v-model="selectedUserIds"
                  />
                  <div class="student-info">
                    <span class="student-name">{{ student.name }}</span>
                    <span class="student-details">{{ student.username }} - {{ student.grade || '无' }}年级 {{ student.class || '无班级' }}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- 目标年级设置 -->
          <div class="target-grade-section">
            <div class="form-group">
              <label>目标年级</label>
              <input
                v-model="targetGrade"
                type="text"
                placeholder="如: 2025"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="keepClass"
                />
                <span>保持班级不变</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Excel批量更新 -->
        <div v-if="updateType === 'excel-batch'" class="excel-update-section">
          <div class="section-title">
            <h4>Excel批量更新</h4>
            <p class="section-description">上传Excel文件批量更新学生年级和班级信息</p>
          </div>

          <!-- 文件上传 -->
          <div class="file-upload-section">
            <div class="upload-area" :class="{ 'drag-over': isDragOver }" @drop="handleDrop" @dragover.prevent @dragenter.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false">
              <input
                ref="fileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect"
                class="file-input"
              />
              <div class="upload-content">
                <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
                <div class="upload-text">
                  <p>拖拽Excel文件到此处，或<button type="button" @click="$refs.fileInput.click()" class="upload-link">点击选择文件</button></p>
                  <p class="upload-hint">支持 .xlsx 和 .xls 格式</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Excel模板说明 -->
          <div class="template-info">
            <h5>Excel文件格式要求：</h5>
            <ul>
              <li>第一行为表头：用户名、姓名、年级、班级</li>
              <li>用户名列用于匹配现有用户</li>
              <li>年级和班级列为要更新的新值</li>
              <li>如果某个字段为空，则不更新该字段</li>
            </ul>
            <button @click="downloadTemplate" class="btn-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              下载Excel模板
            </button>
          </div>

          <!-- 预览数据 -->
          <div v-if="excelPreviewData.length > 0" class="preview-section">
            <h5>预览数据 ({{ excelPreviewData.length }}条记录)</h5>
            <div class="preview-table-container">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>用户名</th>
                    <th>姓名</th>
                    <th>当前年级</th>
                    <th>当前班级</th>
                    <th>新年级</th>
                    <th>新班级</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in excelPreviewData.slice(0, 10)" :key="index" :class="{ 'error-row': row.error }">
                    <td>{{ row.username }}</td>
                    <td>{{ row.name || '-' }}</td>
                    <td>{{ row.currentGrade || '-' }}</td>
                    <td>{{ row.currentClass || '-' }}</td>
                    <td>{{ row.newGrade || '-' }}</td>
                    <td>{{ row.newClass || '-' }}</td>
                    <td>
                      <span v-if="row.error" class="status-error">{{ row.error }}</span>
                      <span v-else class="status-success">准备更新</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="excelPreviewData.length > 10" class="preview-more">
                以及另外 {{ excelPreviewData.length - 10 }} 条记录
              </div>
            </div>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-secondary">取消</button>
        <button
          @click="performUpdate"
          class="btn-primary"
          :disabled="loading || !canUpdate"
        >
          {{ loading ? '更新中...' : '确认更新' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'

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
  return allStudents.value.length > 0 ? allStudents.value : props.users.filter(user => user.role === 'USER')
})

const availableGrades = computed(() => {
  return allGrades.value.length > 0 ? allGrades.value : [...new Set(students.value.map(s => s.grade).filter(Boolean))].sort()
})

const availableClasses = computed(() => {
  return allClasses.value.length > 0 ? allClasses.value : [...new Set(students.value.map(s => s.class).filter(Boolean))].sort()
})

const filteredStudents = computed(() => {
  let filtered = students.value

  if (gradeFilter.value) {
    filtered = filtered.filter(s => s.grade === gradeFilter.value)
  }

  if (classFilter.value) {
    filtered = filtered.filter(s => s.class === classFilter.value)
  }

  return filtered
})

const isAllSelected = computed(() => {
  return filteredStudents.value.length > 0 && selectedUserIds.value.length === filteredStudents.value.length
})

const canUpdate = computed(() => {
  if (updateType.value === 'grade-only') {
    return selectedUserIds.value.length > 0 && targetGrade.value.trim()
  } else if (updateType.value === 'excel-batch') {
    return excelPreviewData.value.length > 0 && excelPreviewData.value.some(row => !row.error)
  }
  return false
})

// 方法
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedUserIds.value = []
  } else {
    selectedUserIds.value = filteredStudents.value.map(s => s.id)
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
      }
    }
    reader.readAsArrayBuffer(file)
  } catch (err) {
    console.error('处理Excel文件失败:', err)
    error.value = '处理Excel文件失败: ' + err.message
  } finally {
    loading.value = false
  }
}

const parseExcelData = (jsonData) => {
  const previewData = []
  const userMap = new Map()
  
  // 创建用户映射
  students.value.forEach(user => {
    userMap.set(user.username, user)
  })

  jsonData.forEach((row, index) => {
    const username = row['用户名'] || row['username'] || ''
    const name = row['姓名'] || row['name'] || ''
    const newGrade = row['年级'] || row['grade'] || ''
    const newClass = row['班级'] || row['class'] || ''

    if (!username) {
      previewData.push({
        username: '',
        name: name,
        newGrade: newGrade,
        newClass: newClass,
        error: '用户名不能为空'
      })
      return
    }

    const existingUser = userMap.get(username)
    if (!existingUser) {
      previewData.push({
        username: username,
        name: name,
        newGrade: newGrade,
        newClass: newClass,
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
      newClass: newClass
    })
  })

  excelPreviewData.value = previewData
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
    script.onerror = reject
    document.head.appendChild(script)
  })
}

const downloadTemplate = () => {
  const templateData = [
    { '用户名': 'student001', '姓名': '张三', '年级': '2025', '班级': '1班' },
    { '用户名': 'student002', '姓名': '李四', '年级': '2025', '班级': '2班' }
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
    headers: auth.getAuthHeader().headers
  })

  if (!response.success) {
    throw new Error(response.message || '批量更新失败')
  }
}

const performExcelUpdate = async () => {
  const validUpdates = excelPreviewData.value.filter(row => !row.error && row.userId)
  
  if (validUpdates.length === 0) {
    throw new Error('没有有效的更新数据')
  }

  // 分批更新，避免请求过大
  const batchSize = 50
  for (let i = 0; i < validUpdates.length; i += batchSize) {
    const batch = validUpdates.slice(i, i + batchSize)
    const updates = batch.map(row => ({
      userId: row.userId,
      grade: row.newGrade || undefined,
      class: row.newClass || undefined
    }))

    await $fetch('/api/admin/users/batch-update', {
      method: 'POST',
      body: { updates },
      headers: auth.getAuthHeader().headers
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
        limit: 10000, // 获取所有数据
        role: 'USER'
      },
      headers: auth.getAuthHeader().headers
    })
    
    if (response.success && response.users) {
      const users = response.users
      allStudents.value = users
      
      // 同时更新年级班级信息
      const grades = [...new Set(users.map(u => u.grade).filter(Boolean))].sort()
      const classes = [...new Set(users.map(u => u.class).filter(Boolean))].sort()
      
      allGrades.value = grades
      allClasses.value = classes
    }
  } catch (err) {
    console.error('获取所有学生数据失败:', err)
    // 如果获取失败，回退到使用props.users
    allStudents.value = []
  }
}

// 监听器
watch(() => props.show, (newVal) => {
  if (newVal) {
    // 重置状态
    updateType.value = 'grade-only'
    gradeFilter.value = ''
    classFilter.value = ''
    selectedUserIds.value = []
    targetGrade.value = ''
    keepClass.value = true
    excelPreviewData.value = []
    error.value = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    
    // 获取所有学生用户数据
    fetchAllStudents()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a1a;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #2a2a2a;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #2a2a2a;
}

.close-btn svg {
  width: 20px;
  height: 20px;
  color: #cccccc;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.update-type-selector {
  margin-bottom: 24px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 2px solid #2a2a2a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #1a1a1a;
}

.radio-option:hover {
  border-color: #3a3a3a;
}

.radio-option:has(.radio-input:checked) {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.radio-input {
  margin: 0;
}

.radio-label {
  font-weight: 500;
  color: #ffffff;
}

.radio-description {
  font-size: 14px;
  color: #cccccc;
  margin-top: 4px;
}

.section-title {
  margin-bottom: 20px;
}

.section-title h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.section-description {
  margin: 0;
  color: #cccccc;
  font-size: 14px;
}

.filter-section {
  margin-bottom: 20px;
}

.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
}

.form-select {
  padding: 8px 12px;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  font-size: 14px;
  background: #1a1a1a;
  color: #ffffff;
  min-height: 40px;
}

.form-select option {
  background: #1a1a1a;
  color: #ffffff;
  padding: 8px;
}

.student-list-section {
  margin-bottom: 20px;
}

.list-header {
  padding: 12px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px 6px 0 0;
}

.select-all-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  cursor: pointer;
  color: #ffffff;
}

.student-list {
  border: 1px solid #2a2a2a;
  border-top: none;
  border-radius: 0 0 6px 6px;
  max-height: 300px;
  overflow-y: auto;
  background: #1a1a1a;
}

.student-item {
  border-bottom: 1px solid #2a2a2a;
}

.student-item:last-child {
  border-bottom: none;
}

.student-checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.student-checkbox:hover {
  background: #2a2a2a;
}

.student-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.student-name {
  font-weight: 500;
  color: #ffffff;
}

.student-details {
  font-size: 14px;
  color: #cccccc;
}

.target-grade-section {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  font-size: 14px;
  background: #1a1a1a;
  color: #ffffff;
}

.form-input::placeholder {
  color: #888888;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #ffffff;
}

.file-upload-section {
  margin-bottom: 20px;
}

.upload-area {
  border: 2px dashed #2a2a2a;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;
  background: #1a1a1a;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.file-input {
  display: none;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: #cccccc;
  margin: 0 auto 16px;
}

.upload-text p {
  margin: 0 0 8px 0;
  color: #ffffff;
}

.upload-link {
  background: none;
  border: none;
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
}

.upload-hint {
  font-size: 14px;
  color: #cccccc;
}

.template-info {
  background: #1a1a1a;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #2a2a2a;
}

.template-info h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.template-info ul {
  margin: 0 0 16px 0;
  padding-left: 20px;
}

.template-info li {
  font-size: 14px;
  color: #cccccc;
  margin-bottom: 4px;
}

.btn-link {
  background: none;
  border: none;
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.btn-link svg {
  width: 16px;
  height: 16px;
}

.preview-section {
  margin-top: 20px;
}

.preview-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.preview-table-container {
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  overflow: hidden;
  background: #1a1a1a;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.preview-table th,
.preview-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #2a2a2a;
  color: #cccccc;
}

.preview-table th {
  background: #2a2a2a;
  font-weight: 500;
  color: #ffffff;
}

.preview-table .error-row {
  background: #7f1d1d;
}

.status-success {
  color: #059669;
  font-size: 12px;
}

.status-error {
  color: #dc2626;
  font-size: 12px;
}

.preview-more {
  padding: 12px;
  text-align: center;
  color: #cccccc;
  font-size: 14px;
  background: #1a1a1a;
}

.error-message {
  background: #7f1d1d;
  border: 1px solid #dc2626;
  color: #fca5a5;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  margin-top: 16px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #2a2a2a;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary {
  padding: 8px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  color: #ffffff;
}

.btn-secondary:hover {
  background: #3a3a3a;
}

.btn-primary {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #3a3a3a;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  .target-grade-section {
    grid-template-columns: 1fr;
  }

  .radio-option {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>