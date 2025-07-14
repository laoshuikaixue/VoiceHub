<template>
  <div class="notification-sender">
    <h2 class="section-title">发送通知</h2>
    
    <div class="card glass">
      <div class="card-header">
        <h3>向用户发送通知</h3>
      </div>
      
      <div class="card-body">
        <form @submit.prevent="sendNotification">
          <div class="notification-form-layout">
            <!-- 左侧表单部分 -->
            <div class="form-section">
              <!-- 通知内容 -->
              <div class="form-group">
                <label for="title">通知标题</label>
                <input
                  id="title"
                  v-model="form.title"
                  type="text"
                  required
                  placeholder="输入通知标题"
                  maxlength="100"
                  class="input"
                />
              </div>
              
              <div class="form-group">
                <label for="content">通知内容</label>
                <textarea
                  id="content"
                  v-model="form.content"
                  required
                  placeholder="输入通知内容"
                  rows="6"
                  maxlength="500"
                  class="input"
                ></textarea>
              </div>
            </div>
            
            <!-- 右侧设置部分 -->
            <div class="settings-section">
              <!-- 通知范围 -->
              <div class="form-group">
                <label>通知范围</label>
                <div class="scope-selector">
                  <button 
                    type="button" 
                    :class="['scope-btn', { active: form.scope === 'ALL' }]"
                    @click="form.scope = 'ALL'"
                  >
                    全体用户
                  </button>
                  
                  <button 
                    type="button" 
                    :class="['scope-btn', { active: form.scope === 'GRADE' }]"
                    @click="form.scope = 'GRADE'"
                  >
                    按年级选择
                  </button>
                  
                  <button 
                    type="button" 
                    :class="['scope-btn', { active: form.scope === 'CLASS' }]"
                    @click="form.scope = 'CLASS'"
                  >
                    按班级选择
                  </button>
                  
                  <button 
                    type="button" 
                    :class="['scope-btn', { active: form.scope === 'MULTI_CLASS' }]"
                    @click="form.scope = 'MULTI_CLASS'"
                  >
                    多班级选择
                  </button>
                </div>
              </div>
              
              <!-- 按年级选择 -->
              <div v-if="form.scope === 'GRADE'" class="form-group">
                <label for="grade">选择年级</label>
                <select 
                  id="grade" 
                  v-model="form.grade" 
                  required
                  class="input"
                >
                  <option value="">请选择年级</option>
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                  <option value="教师">教师</option>
                </select>
              </div>
              
              <!-- 按单个班级选择 -->
              <div v-if="form.scope === 'CLASS'" class="form-group grid-2">
                <div>
                  <label for="classGrade">年级</label>
                  <select 
                    id="classGrade" 
                    v-model="form.classGrade" 
                    required
                    class="input"
                  >
                    <option value="">请选择年级</option>
                    <option value="高一">高一</option>
                    <option value="高二">高二</option>
                    <option value="高三">高三</option>
                    <option value="教师">教师</option>
                  </select>
                </div>
                
                <div>
                  <label for="className">班级</label>
                  <input 
                    id="className" 
                    v-model="form.className" 
                    type="text" 
                    required
                    placeholder="如: 1班、2班"
                    class="input"
                  />
                </div>
              </div>
              
              <!-- 按多班级选择 -->
              <div v-if="form.scope === 'MULTI_CLASS'" class="form-group">
                <div class="multi-class-selector">
                  <div class="multi-class-controls">
                    <label>选择年级和班级</label>
                    <div class="flex gap-2 mb-2">
                      <select 
                        v-model="multiClassForm.grade" 
                        class="input"
                      >
                        <option value="">请选择年级</option>
                        <option value="高一">高一</option>
                        <option value="高二">高二</option>
                        <option value="高三">高三</option>
                        <option value="教师">教师</option>
                      </select>
                      
                      <input 
                        v-model="multiClassForm.class" 
                        type="text" 
                        placeholder="输入班级名称" 
                        class="input"
                      />
                      
                      <button 
                        type="button" 
                        @click="addClassToSelection" 
                        class="btn btn-primary"
                        :disabled="!canAddClass"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                  
                  <div v-if="form.selectedClasses.length > 0" class="selected-classes">
                    <label>已选择的班级</label>
                    <div class="class-tags">
                      <div 
                        v-for="(cls, index) in form.selectedClasses" 
                        :key="index"
                        class="class-tag"
                      >
                        <span>{{ cls.grade }} {{ cls.class }}</span>
                        <button 
                          type="button" 
                          @click="removeClassFromSelection(index)" 
                          class="remove-tag"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="empty-selection">
                    未选择任何班级
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="form-actions">
                <button 
                  type="submit" 
                  class="btn btn-primary" 
                  :disabled="loading || !isFormValid"
                >
                  {{ loading ? '发送中...' : '发送通知' }}
                </button>
              </div>
              
              <div v-if="error" class="error-message">{{ error }}</div>
              <div v-if="success" class="success-message">{{ success }}</div>
            </div>
          </div>
          
          <!-- 预览区域 -->
          <div class="notification-preview glass">
            <h4>通知预览</h4>
            <div class="preview-card">
              <div class="preview-title">{{ form.title || '通知标题' }}</div>
              <div class="preview-content">{{ form.content || '通知内容' }}</div>
              <div class="preview-scope">
                <strong>发送范围:</strong> {{ scopeDescription }}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useAdmin } from '~/composables/useAdmin'

const { isAdmin } = useAuth()
const { sendAdminNotification } = useAdmin()

// 表单数据
const form = ref({
  title: '',
  content: '',
  scope: 'ALL', // 'ALL', 'GRADE', 'CLASS', 'MULTI_CLASS'
  grade: '',
  classGrade: '',
  className: '',
  selectedClasses: [] // 用于多班级选择
})

// 多班级选择表单
const multiClassForm = ref({
  grade: '',
  class: ''
})

const loading = ref(false)
const error = ref('')
const success = ref('')

// 判断是否可以添加班级
const canAddClass = computed(() => {
  return multiClassForm.value.grade && multiClassForm.value.class
})

// 添加班级到选择列表
const addClassToSelection = () => {
  if (!canAddClass.value) return
  
  // 检查是否已经选择了这个班级
  const isDuplicate = form.value.selectedClasses.some(cls => 
    cls.grade === multiClassForm.value.grade && 
    cls.class === multiClassForm.value.class
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
      if (form.value.classGrade && form.value.className) {
        return `${form.value.classGrade} ${form.value.className}`
      }
      return '请选择班级'
    case 'MULTI_CLASS':
      if (form.value.selectedClasses.length > 0) {
        return `${form.value.selectedClasses.length}个班级`
      }
      return '请选择班级'
    default:
      return '请选择范围'
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
    }
    
    // 发送通知
    const result = await sendAdminNotification(notificationData)
    
    if (result && result.success) {
      success.value = `成功发送通知给 ${result.sentCount} 名用户`
      
      // 清空表单
      form.value = {
        title: '',
        content: '',
        scope: 'ALL',
        grade: '',
        classGrade: '',
        className: '',
        selectedClasses: []
      }
    } else {
      throw new Error(result?.message || '发送通知失败')
    }
  } catch (err) {
    error.value = err.message || '发送通知时发生错误'
    console.error('发送通知错误:', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.notification-sender {
  margin-bottom: 30px;
  width: 100%;
  max-width: 100%;
}

.card {
  overflow: hidden;
  width: 100%;
  max-width: 100%;
}

/* 双列布局样式 */
.notification-form-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
  width: 100%;
}

.form-section {
  flex: 1;
  width: 100%;
}

.settings-section {
  flex: 1;
  width: 100%;
}

.card-header {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--light);
}

.card-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--light);
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

/* 范围选择器 */
.scope-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 5px;
}

.scope-btn {
  padding: 8px 15px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--gray);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.scope-btn:hover:not(.active) {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.scope-btn.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-color: var(--primary);
  font-weight: 500;
}

/* 多班级选择 */
.multi-class-selector {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 15px;
  background: rgba(15, 23, 42, 0.3);
}

.multi-class-controls {
  margin-bottom: 15px;
}

.flex {
  display: flex;
}

.gap-2 {
  gap: 8px;
}

.mb-2 {
  margin-bottom: 8px;
}

.selected-classes {
  margin-top: 15px;
}

.class-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.class-tag {
  display: flex;
  align-items: center;
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 14px;
}

.remove-tag {
  background: none;
  border: none;
  color: var(--primary);
  margin-left: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-selection {
  padding: 10px;
  color: var(--gray);
  text-align: center;
  font-style: italic;
}

/* 预览区域 */
.notification-preview {
  margin-top: 0;
  margin-bottom: 30px;
  padding: 15px;
  border-radius: 8px;
  width: 100%;
}

.notification-preview h4 {
  margin-bottom: 10px;
  font-size: 16px;
  color: var(--light);
}

.preview-card {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 15px;
  width: 100%;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--light);
}

.preview-content {
  margin-bottom: 15px;
  white-space: pre-line;
  color: var(--light);
  min-height: 60px;
}

.preview-scope {
  font-size: 13px;
  color: var(--gray-light);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 30px;
}

.error-message {
  color: var(--danger);
  margin-top: 15px;
}

.success-message {
  color: var(--success);
  margin-top: 15px;
}

@media (max-width: 1024px) {
  .notification-form-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 640px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
  
  .scope-selector {
    flex-direction: column;
  }
  
  .scope-btn {
    width: 100%;
  }
}
</style> 