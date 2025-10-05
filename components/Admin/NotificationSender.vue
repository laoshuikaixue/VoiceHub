<template>
  <div class="notification-sender">
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
                    class="input"
                    maxlength="100"
                    placeholder="输入通知标题"
                    required
                    type="text"
                />
              </div>

              <div class="form-group">
                <label for="content">通知内容</label>
                <textarea
                    id="content"
                    v-model="form.content"
                    class="input"
                    maxlength="500"
                    placeholder="输入通知内容"
                    required
                    rows="6"
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
                      :class="['scope-btn', { active: form.scope === 'ALL' }]"
                      type="button"
                      @click="form.scope = 'ALL'"
                  >
                    全体用户
                  </button>

                  <button
                      :class="['scope-btn', { active: form.scope === 'GRADE' }]"
                      type="button"
                      @click="form.scope = 'GRADE'"
                  >
                    按年级选择
                  </button>

                  <button
                      :class="['scope-btn', { active: form.scope === 'CLASS' }]"
                      type="button"
                      @click="form.scope = 'CLASS'"
                  >
                    按班级选择
                  </button>

                  <button
                      :class="['scope-btn', { active: form.scope === 'MULTI_CLASS' }]"
                      type="button"
                      @click="form.scope = 'MULTI_CLASS'"
                  >
                    多班级选择
                  </button>

                  <button
                      :class="['scope-btn', { active: form.scope === 'SPECIFIC_USERS' }]"
                      type="button"
                      @click="form.scope = 'SPECIFIC_USERS'"
                  >
                    指定用户
                  </button>
                </div>
              </div>

              <!-- 按年级选择 -->
              <div v-if="form.scope === 'GRADE'" class="form-group">
                <label for="grade">选择年级</label>
                <select
                    id="grade"
                    v-model="form.grade"
                    class="input"
                    required
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
                      class="input"
                      required
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
                      class="input"
                      placeholder="如: 1班、2班"
                      required
                      type="text"
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
                          class="input"
                          placeholder="输入班级名称"
                          type="text"
                      />

                      <button
                          :disabled="!canAddClass"
                          class="btn btn-primary"
                          type="button"
                          @click="addClassToSelection"
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
                            class="remove-tag"
                            type="button"
                            @click="removeClassFromSelection(index)"
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

              <!-- 指定用户选择 -->
              <div v-if="form.scope === 'SPECIFIC_USERS'" class="form-group">
                <div class="user-selector">
                  <div class="user-search-controls">
                    <label>搜索并选择用户</label>
                    <div class="search-input-container">
                      <div class="search-box">
                        <svg class="search-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                            v-model="userSearchQuery"
                            class="input search-input"
                            placeholder="按姓名、用户名或ID搜索用户"
                            type="text"
                            @input="onUserSearchInput"
                        />
                      </div>
                    </div>

                    <!-- 搜索结果列表 -->
                    <div v-if="showUserSearchResults && userSearchResults.length > 0" class="search-results">
                      <div class="search-results-header">
                        <span>搜索结果 ({{ userSearchResults.length }})</span>
                      </div>
                      <div class="search-results-list">
                        <div
                            v-for="user in userSearchResults"
                            :key="user.id"
                            class="search-result-item"
                            @click="addUserToSelection(user)"
                        >
                          <div class="user-info">
                            <div class="user-name">{{ user.name || user.username }}</div>
                            <div class="user-details">
                              <span class="user-username">@{{ user.username }}</span>
                              <span v-if="user.grade && user.class" class="user-class">{{ user.grade }} {{
                                  user.class
                                }}</span>
                              <span class="user-role">{{ getRoleText(user.role) }}</span>
                            </div>
                          </div>
                          <button
                              :disabled="isUserSelected(user.id)"
                              class="add-user-btn"
                              type="button"
                          >
                            {{ isUserSelected(user.id) ? '已选择' : '选择' }}
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- 无搜索结果 -->
                    <div v-else-if="showUserSearchResults && userSearchQuery && userSearchResults.length === 0"
                         class="no-search-results">
                      未找到匹配的用户
                    </div>
                  </div>

                  <!-- 已选择的用户 -->
                  <div v-if="form.selectedUsers.length > 0" class="selected-users">
                    <div class="selected-users-header">
                      <label>已选择的用户 ({{ form.selectedUsers.length }})</label>
                      <button
                          class="clear-all-btn"
                          type="button"
                          @click="clearAllSelectedUsers"
                      >
                        清空全部
                      </button>
                    </div>
                    <div class="user-tags">
                      <div
                          v-for="(user, index) in form.selectedUsers"
                          :key="user.id"
                          class="user-tag"
                      >
                        <div class="user-tag-info">
                          <span class="user-tag-name">{{ user.name || user.username }}</span>
                          <span class="user-tag-details">@{{ user.username }}</span>
                        </div>
                        <button
                            class="remove-tag"
                            type="button"
                            @click="removeUserFromSelection(index)"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-else class="empty-selection">
                    未选择任何用户
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="form-actions">
                <button
                    :disabled="loading || !isFormValid"
                    class="btn btn-primary"
                    type="submit"
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
import {computed, ref} from 'vue'
import {useAuth} from '~/composables/useAuth'
import {useAdmin} from '~/composables/useAdmin'

const {isAdmin} = useAuth()
const {sendAdminNotification} = useAdmin()

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
  return form.value.selectedUsers.some(user => user.id === userId)
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
    'admin': '管理员',
    'teacher': '教师',
    'student': '学生'
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
      return (form.value.classGrade && form.value.className)
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
      notificationData.filter.userIds = form.value.selectedUsers.map(user => user.id)
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
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.notification-sender {
  padding: 20px;
  background: var(--bg-primary);
  min-height: 100vh;
  color: #e2e8f0;
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
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  overflow: hidden;
}

.scope-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s;
}

.scope-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #d1d5db;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.scope-btn:hover::before {
  left: 100%;
}

.scope-btn.active {
  background: linear-gradient(135deg, rgba(11, 90, 254, 0.2), rgba(11, 90, 254, 0.1));
  color: #60a5fa;
  border-color: rgba(11, 90, 254, 0.4);
  font-weight: 500;
  box-shadow: 0 0 20px rgba(11, 90, 254, 0.2);
}

.scope-btn.active::before {
  background: linear-gradient(90deg, transparent, rgba(11, 90, 254, 0.2), transparent);
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
  background: rgba(26, 26, 26, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
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

/* 用户搜索样式 */
.user-selector {
  margin-top: 16px;
}

.user-search-controls {
  margin-bottom: 20px;
}

.search-input-container {
  margin-top: 8px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: #9ca3af;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 44px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
  background: rgba(15, 23, 42, 0.5);
  color: #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
  background: rgba(15, 23, 42, 0.7);
}

.search-input:hover:not(:focus) {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.search-input::placeholder {
  color: #64748b;
}

/* 搜索结果样式 */
.search-results {
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.search-results-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
}

.search-results-list {
  max-height: 240px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: translateX(4px);
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 500;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.user-details {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.user-username {
  color: #60a5fa;
}

.user-class {
  color: #34d399;
}

.user-role {
  color: #fbbf24;
}

.add-user-btn {
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  color: #60a5fa;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-user-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
  transform: scale(1.05);
}

.add-user-btn:disabled {
  background: rgba(107, 114, 128, 0.2);
  border-color: rgba(107, 114, 128, 0.3);
  color: #6b7280;
  cursor: not-allowed;
}

.no-search-results {
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-style: italic;
}

/* 已选用户样式 */
.selected-users {
  margin-top: 20px;
}

.selected-users-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.clear-all-btn {
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #f87171;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-all-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
}

.user-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-tag {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.user-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.user-tag-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-tag-name {
  font-weight: 500;
  color: #f1f5f9;
}

.user-tag-details {
  font-size: 11px;
  color: #94a3b8;
}

.remove-tag {
  background: none;
  border: none;
  color: #f87171;
  margin-left: 8px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.remove-tag:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: scale(1.1);
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

  .user-tags {
    flex-direction: column;
  }

  .user-tag {
    width: 100%;
  }
}
</style>