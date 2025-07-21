<template>
  <div class="user-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>用户管理</h3>
        <div class="stats">
          <span class="stat-item">总计: {{ users.length }} 个用户</span>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索用户..."
            class="search-input"
          />
        </div>
        <select v-model="roleFilter" class="filter-select">
          <option value="">全部角色</option>
          <option v-for="role in roles" :key="role.name" :value="role.name">
            {{ role.displayName }}
          </option>
        </select>
        <button @click="showAddModal = true" class="btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加用户
        </button>
      </div>
    </div>

    <!-- 用户表格 -->
    <div class="table-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <div>正在加载用户...</div>
      </div>

      <div v-else-if="filteredUsers.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <div class="empty-text">
          {{ searchQuery ? '没有找到匹配的用户' : '暂无用户数据' }}
        </div>
      </div>

      <!-- 桌面端表格 -->
      <div v-else class="table-container">
        <table class="user-table desktop-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>姓名</th>
              <th>用户名</th>
              <th>角色</th>
              <th>年级</th>
              <th>班级</th>
              <th>最后登录</th>
              <th>登录IP</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedUsers" :key="user.id" class="user-row">
              <td>{{ user.id }}</td>
              <td>{{ user.name }}</td>
              <td>{{ user.username }}</td>
              <td>
                <span :class="['role-badge', getRoleClass(user.role)]">
                  {{ getRoleDisplayName(user.role) }}
                </span>
              </td>
              <td>{{ user.grade || '-' }}</td>
              <td>{{ user.class || '-' }}</td>
              <td>{{ formatDate(user.lastLogin) }}</td>
              <td>{{ user.lastLoginIp || '-' }}</td>
              <td>
                <div class="action-buttons">
                  <button
                    @click="editUser(user)"
                    class="action-btn edit-btn"
                    title="编辑用户"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    @click="resetPassword(user)"
                    class="action-btn warning-btn"
                    title="重置密码"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </button>
                <button
                  @click="deleteUser(user)"
                  class="action-btn delete-btn"
                  title="删除用户"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <!-- 移动端卡片式布局 -->
      <div class="mobile-cards">
        <div v-for="user in paginatedUsers" :key="user.id" class="user-card">
          <div class="card-header">
            <div class="user-primary-info">
              <div class="user-name-container">
                <span class="user-name-label">{{ user.name }}</span>
                <span :class="['role-badge', getRoleClass(user.role)]">
                  {{ getRoleDisplayName(user.role) }}
                </span>
              </div>
              <div class="user-username">{{ user.username }}</div>
            </div>
            <div class="card-actions">
              <button
                @click="editUser(user)"
                class="action-btn edit-btn"
                title="编辑用户"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click="resetPassword(user)"
                class="action-btn warning-btn"
                title="重置密码"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </button>
              <button
                @click="confirmDeleteUser(user)"
                class="action-btn delete-btn"
                title="删除用户"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">ID:</span>
              <span class="info-value">{{ user.id }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">年级班级:</span>
              <span class="info-value">{{ user.grade || '-' }} {{ user.class || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">最后登录:</span>
              <span class="info-value">{{ formatDate(user.lastLogin) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">登录IP:</span>
              <span class="info-value">{{ user.lastLoginIp || '-' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        @click="currentPage = 1"
        :disabled="currentPage === 1"
        class="page-btn"
      >
        首页
      </button>
      <button
        @click="currentPage--"
        :disabled="currentPage === 1"
        class="page-btn"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页
      </span>
      <button
        @click="currentPage++"
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        下一页
      </button>
      <button
        @click="currentPage = totalPages"
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        末页
      </button>
    </div>

    <!-- 添加/编辑用户模态框 -->
    <div v-if="showAddModal || editingUser" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingUser ? '编辑用户' : '添加用户' }}</h3>
          <button @click="closeModal" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>姓名</label>
            <input
              v-model="userForm.name"
              type="text"
              placeholder="请输入姓名"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>用户名</label>
            <input
              v-model="userForm.username"
              type="text"
              placeholder="请输入用户名"
              class="form-input"
              :disabled="!!editingUser"
            />
          </div>

          <div class="form-group">
            <label>密码</label>
            <input
              v-model="userForm.password"
              type="password"
              :placeholder="editingUser ? '留空则不修改密码' : '请输入密码'"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>角色</label>
            <select v-model="userForm.role" class="form-select">
              <option v-for="role in roles" :key="role.name" :value="role.name">
                {{ role.displayName }}
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>年级</label>
              <input
                v-model="userForm.grade"
                type="text"
                placeholder="如: 2024"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>班级</label>
              <input
                v-model="userForm.class"
                type="text"
                placeholder="如: 1班"
                class="form-input"
              />
            </div>
          </div>

          <div v-if="formError" class="error-message">
            {{ formError }}
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-secondary">取消</button>
          <button @click="saveUser" class="btn-primary" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 重置密码模态框 -->
    <div v-if="resetPasswordUser" class="modal-overlay" @click="closeResetPassword">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>重置密码 - {{ resetPasswordUser.name }}</h3>
          <button @click="closeResetPassword" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>新密码</label>
            <input
              v-model="passwordForm.password"
              type="password"
              placeholder="请输入新密码"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>确认密码</label>
            <input
              v-model="passwordForm.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              class="form-input"
            />
          </div>

          <div v-if="passwordError" class="error-message">
            {{ passwordError }}
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeResetPassword" class="btn-secondary">取消</button>
          <button @click="confirmResetPassword" class="btn-primary" :disabled="resetting">
            {{ resetting ? '重置中...' : '重置密码' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// 响应式数据
const loading = ref(false)
const users = ref([])
const roles = ref([])
const searchQuery = ref('')
const roleFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// 模态框状态
const showAddModal = ref(false)
const editingUser = ref(null)
const saving = ref(false)
const formError = ref('')

// 重置密码状态
const resetPasswordUser = ref(null)
const resetting = ref(false)
const passwordError = ref('')

// 表单数据
const userForm = ref({
  name: '',
  username: '',
  password: '',
  role: 'USER',
  grade: '',
  class: ''
})

const passwordForm = ref({
  password: '',
  confirmPassword: ''
})

// 服务
let auth = null

// 计算属性
const filteredUsers = computed(() => {
  let filtered = users.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query)
    )
  }

  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  return filtered
})

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredUsers.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / pageSize.value)
})

// 移除了不需要的统计计算属性

// 方法
const formatDate = (dateString) => {
  if (!dateString) return '从未登录'
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN')
}

const getRoleClass = (role) => {
  const classes = {
    'USER': 'user',
    'ADMIN': 'admin',
    'SONG_ADMIN': 'song-admin',
    'SUPER_ADMIN': 'super-admin'
  }
  return classes[role] || 'user'
}

const getRoleDisplayName = (role) => {
  const names = {
    'USER': '普通用户',
    'ADMIN': '管理员',
    'SONG_ADMIN': '歌曲管理员',
    'SUPER_ADMIN': '超级管理员'
  }
  return names[role] || role
}

const editUser = (user) => {
  editingUser.value = user
  userForm.value = {
    name: user.name,
    username: user.username,
    password: '',
    role: user.role,
    grade: user.grade || '',
    class: user.class || ''
  }
}

const resetPassword = (user) => {
  resetPasswordUser.value = user
  passwordForm.value = {
    password: '',
    confirmPassword: ''
  }
}

const deleteUser = async (user) => {
  if (!confirm(`确定要删除用户 "${user.name}" 吗？此操作不可撤销。`)) return

  try {
    await $fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: auth.getAuthHeader().headers
    })

    await loadUsers()

    if (window.$showNotification) {
      window.$showNotification('用户删除成功', 'success')
    }
  } catch (error) {
    console.error('删除用户失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除用户失败: ' + error.message, 'error')
    }
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingUser.value = null
  formError.value = ''
  userForm.value = {
    name: '',
    username: '',
    password: '',
    role: 'USER',
    grade: '',
    class: ''
  }
}

const closeResetPassword = () => {
  resetPasswordUser.value = null
  passwordError.value = ''
  passwordForm.value = {
    password: '',
    confirmPassword: ''
  }
}

const saveUser = async () => {
  if (!userForm.value.name || !userForm.value.username) {
    formError.value = '请填写必要信息'
    return
  }

  if (!editingUser.value && !userForm.value.password) {
    formError.value = '请输入密码'
    return
  }

  saving.value = true
  formError.value = ''

  try {
    const userData = {
      name: userForm.value.name,
      username: userForm.value.username,
      role: userForm.value.role,
      grade: userForm.value.grade,
      class: userForm.value.class
    }

    if (userForm.value.password) {
      userData.password = userForm.value.password
    }

    if (editingUser.value) {
      await $fetch(`/api/admin/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: userData,
        headers: auth.getAuthHeader().headers
      })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: userData,
        headers: auth.getAuthHeader().headers
      })
    }

    await loadUsers()
    closeModal()

    if (window.$showNotification) {
      window.$showNotification(
        editingUser.value ? '用户更新成功' : '用户创建成功',
        'success'
      )
    }
  } catch (error) {
    console.error('保存用户失败:', error)
    formError.value = error.message || '保存失败'
  } finally {
    saving.value = false
  }
}

const confirmResetPassword = async () => {
  if (!passwordForm.value.password) {
    passwordError.value = '请输入新密码'
    return
  }

  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    passwordError.value = '两次输入的密码不一致'
    return
  }

  resetting.value = true
  passwordError.value = ''

  try {
    await $fetch(`/api/admin/users/${resetPasswordUser.value.id}/reset-password`, {
      method: 'POST',
      body: {
        newPassword: passwordForm.value.password
      },
      headers: auth.getAuthHeader().headers
    })

    closeResetPassword()

    if (window.$showNotification) {
      window.$showNotification('密码重置成功', 'success')
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    passwordError.value = error.message || '重置失败'
  } finally {
    resetting.value = false
  }
}

const loadUsers = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/users', {
      headers: auth.getAuthHeader().headers
    })
    users.value = response.users || []
  } catch (error) {
    console.error('加载用户失败:', error)
    if (window.$showNotification) {
      window.$showNotification('加载用户失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

const loadRoles = async () => {
  try {
    const response = await $fetch('/api/admin/roles', {
      headers: auth.getAuthHeader().headers
    })
    roles.value = response.roles || []
  } catch (error) {
    console.error('加载角色失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  auth = useAuth()
  await Promise.all([loadUsers(), loadRoles()])
})
</script>

<style scoped>
.user-manager {
  padding: 24px;
  background: #0a0a0a;
  min-height: 100vh;
  color: #ffffff;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
}

.toolbar-left h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
}

.stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  font-size: 14px;
  color: #888888;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: #666666;
  z-index: 1;
}

.search-input {
  padding: 8px 12px 8px 36px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  width: 200px;
}

.search-input::placeholder {
  color: #666666;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.filter-select {
  padding: 8px 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #667eea;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #5a67d8;
}

.btn-primary svg {
  width: 16px;
  height: 16px;
}

/* 表格容器 */
.table-container {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  overflow: hidden;
}

/* 加载和空状态 */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #888888;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #2a2a2a;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: #444444;
}

.empty-text {
  font-size: 16px;
  color: #888888;
}

/* 用户表格 */
.user-table {
  width: 100%;
  border-collapse: collapse;
}

.user-table th {
  padding: 16px;
  background: #2a2a2a;
  color: #cccccc;
  font-weight: 600;
  font-size: 14px;
  text-align: left;
  border-bottom: 1px solid #3a3a3a;
}

.user-table td {
  padding: 16px;
  border-bottom: 1px solid #2a2a2a;
  font-size: 14px;
  color: #ffffff;
}

.user-row:hover {
  background: #1e1e1e;
}

/* 角色徽章 */
.role-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.role-badge.user {
  background: #1e3a8a;
  color: #93c5fd;
}

.role-badge.admin {
  background: #7c2d12;
  color: #fed7aa;
}

.role-badge.song-admin {
  background: #166534;
  color: #bbf7d0;
}

.role-badge.super-admin {
  background: #7c2d12;
  color: #fca5a5;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.edit-btn {
  background: #1e40af;
  color: #ffffff;
}

.edit-btn:hover {
  background: #1d4ed8;
}

.warning-btn {
  background: #d97706;
  color: #ffffff;
}

.warning-btn:hover {
  background: #f59e0b;
}

.delete-btn {
  background: #dc2626;
  color: #ffffff;
}

.delete-btn:hover {
  background: #ef4444;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  padding: 20px;
}

.page-btn {
  padding: 8px 12px;
  background: #2a2a2a;
  color: #ffffff;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #888888;
  font-size: 14px;
  margin: 0 8px;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #2a2a2a;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #2a2a2a;
  color: #888888;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.close-btn svg {
  width: 16px;
  height: 16px;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: #666666;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.error-message {
  padding: 12px;
  background: #7f1d1d;
  border: 1px solid #991b1b;
  border-radius: 8px;
  color: #fecaca;
  font-size: 14px;
  margin-top: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #2a2a2a;
}

.btn-secondary {
  padding: 8px 16px;
  background: #2a2a2a;
  color: #ffffff;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 移动端卡片布局 */
.mobile-cards {
  display: none;
}

.user-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.user-card:hover {
  border-color: #3a3a3a;
  transform: translateY(-1px);
}

.user-card:active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

.card-header {
  padding: 16px;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.user-primary-info {
  flex: 1;
}

.user-name-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.user-name-label {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.user-username {
  font-size: 14px;
  color: #888888;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.card-body {
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #1a1a1a;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: #888888;
  font-weight: 500;
}

.info-value {
  font-size: 13px;
  color: #cccccc;
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-manager {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .toolbar-right {
    flex-direction: column;
    gap: 12px;
  }

  .search-input {
    width: 100%;
  }

  /* 隐藏桌面端表格，显示移动端卡片 */
  .desktop-table {
    display: none;
  }

  .mobile-cards {
    display: block;
  }

  .modal-content {
    width: 95%;
    margin: 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  /* 移动端分页优化 */
  .pagination {
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .page-btn {
    padding: 10px 14px;
    font-size: 14px;
    min-width: 44px;
    min-height: 44px;
  }

  .page-info {
    font-size: 14px;
    padding: 10px;
  }
}

/* 小屏幕设备进一步优化 */
@media (max-width: 480px) {
  .user-manager {
    padding: 12px;
  }

  .toolbar-title {
    font-size: 18px;
  }

  .toolbar-description {
    font-size: 12px;
  }

  .user-card {
    margin-bottom: 12px;
  }

  .card-header {
    padding: 12px;
  }

  .card-body {
    padding: 12px;
  }

  .user-name-label {
    font-size: 15px;
  }

  .user-username {
    font-size: 13px;
  }

  .role-badge {
    font-size: 10px;
    padding: 3px 6px;
  }

  .info-label, .info-value {
    font-size: 12px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .pagination {
    padding: 12px 0;
  }

  .page-btn {
    padding: 8px 12px;
    font-size: 13px;
    min-width: 40px;
    min-height: 40px;
  }
}
</style>