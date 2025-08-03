<template>
  <div class="role-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>角色管理</h3>
        <p class="toolbar-description">配置系统角色和权限</p>
      </div>
      <div class="toolbar-right">
        <button @click="showCreateModal = true" class="create-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          创建角色
        </button>
        <button @click="refreshRoles" class="refresh-btn" :disabled="loading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,4 23,10 17,10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">正在加载角色...</div>
    </div>

    <!-- 角色列表 -->
    <div v-else-if="roles && roles.length > 0" class="roles-grid">
      <div
        v-for="role in roles"
        :key="role.id"
        class="role-card"
      >
        <div class="role-header">
          <div class="role-info">
            <h4 class="role-name">{{ role.displayName || role.name }}</h4>
            <p class="role-description">{{ role.description || '暂无描述' }}</p>
          </div>
          <div class="role-actions">
            <button
              @click="editRole(role)"
              class="action-btn edit-btn"
              title="编辑角色"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              v-if="!role.isSystem"
              @click="deleteRole(role.id)"
              class="action-btn delete-btn"
              title="删除角色"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="role-stats">
          <div class="stat-item">
            <span class="stat-label">用户数:</span>
            <span class="stat-value">{{ role.userCount || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">权限数:</span>
            <span class="stat-value">{{ role.permissions?.length || 0 }}</span>
          </div>
        </div>
        
        <div class="role-permissions">
          <div class="permissions-header">
            <span>权限列表</span>
          </div>
          <div class="permissions-list">
            <div
              v-for="permission in role.permissions?.slice(0, 6)"
              :key="permission"
              class="permission-tag"
            >
              {{ getPermissionDisplayName(permission) }}
            </div>
            <div
              v-if="role.permissions?.length > 6"
              class="permission-tag more"
            >
              +{{ role.permissions.length - 6 }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12h8"/>
        </svg>
        <div class="empty-text">暂无角色数据</div>
        <div class="empty-actions">
          <button @click="initializeRoles" class="create-first-btn primary">
            初始化角色系统
          </button>
          <button @click="showCreateModal = true" class="create-first-btn">
            手动创建角色
          </button>
        </div>
      </div>

    <!-- 创建/编辑角色模态框 -->
    <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click="closeModals">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ showCreateModal ? '创建角色' : '编辑角色' }}</h3>
          <button @click="closeModals" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label for="roleName">角色名称</label>
            <input
              id="roleName"
              v-model="formData.name"
              type="text"
              placeholder="请输入角色名称"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="roleDescription">角色描述</label>
            <textarea
              id="roleDescription"
              v-model="formData.description"
              placeholder="请输入角色描述"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label>权限配置</label>
            <div class="permissions-grid">
              <div
                v-for="category in permissionCategories"
                :key="category.name"
                class="permission-category"
              >
                <div class="category-header">
                  <input
                    type="checkbox"
                    :checked="isCategorySelected(category)"
                    @change="toggleCategory(category)"
                    class="category-checkbox"
                  />
                  <span class="category-name">{{ category.displayName }}</span>
                </div>
                <div class="category-permissions">
                  <label
                    v-for="permission in category.permissions"
                    :key="permission.id"
                    class="permission-item"
                  >
                    <input
                      type="checkbox"
                      :checked="formData.permissions.includes(permission.id)"
                      @change="togglePermission(permission.id)"
                      class="permission-checkbox"
                    />
                    <span class="permission-name">{{ permission.displayName }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeModals" class="cancel-btn">取消</button>
          <button
            @click="saveRole"
            class="save-btn"
            :disabled="!formData.name || savingRole"
          >
            {{ savingRole ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 确认对话框 -->
  <ConfirmDialog
    :show="showConfirmDialog"
    :title="confirmDialogTitle"
    :message="confirmDialogMessage"
    :type="confirmDialogType"
    :confirm-text="confirmDialogConfirmText"
    cancel-text="取消"
    :loading="loading"
    @confirm="handleConfirm"
    @close="showConfirmDialog = false"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

// 响应式数据
const loading = ref(false)
const savingRole = ref(false)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingRole = ref(null)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogType = ref('warning')
const confirmDialogConfirmText = ref('确认')
const confirmAction = ref(null)

const roles = ref([])
const permissions = ref([])

const formData = ref({
  name: '',
  description: '',
  permissions: []
})

// 服务
const auth = useAuth()

// 权限分类
const permissionCategories = computed(() => {
  const categories = [
    {
      name: 'song',
      displayName: '歌曲管理',
      permissions: []
    },
    {
      name: 'schedule',
      displayName: '排期管理',
      permissions: []
    },
    {
      name: 'user',
      displayName: '用户管理',
      permissions: []
    },
    {
      name: 'role',
      displayName: '角色管理',
      permissions: []
    },
    {
      name: 'system',
      displayName: '系统管理',
      permissions: []
    }
  ]
  
  permissions.value.forEach(permission => {
    const category = categories.find(cat => permission.name.startsWith(cat.name))
    if (category) {
      category.permissions.push({
        id: permission.name, // 使用权限名称作为ID
        name: permission.name,
        displayName: permission.displayName || getPermissionDisplayName(permission.name)
      })
    }
  })
  
  return categories.filter(cat => cat.permissions.length > 0)
})

// 方法
const getPermissionDisplayName = (permissionName) => {
  const displayNames = {
    // 歌曲管理权限
    'song.view': '查看歌曲',
    'song.submit': '投稿歌曲',
    'song.manage': '管理歌曲',
    'song.vote': '投票',
    'song.delete': '删除歌曲',

    // 排期管理权限
    'schedule.view': '查看排期',
    'schedule.manage': '管理排期',
    'schedule.create': '创建排期',
    'schedule.edit': '编辑排期',
    'schedule.delete': '删除排期',

    // 用户管理权限
    'user.view': '查看用户',
    'user.manage': '管理用户',
    'user.create': '创建用户',
    'user.edit': '编辑用户',
    'user.delete': '删除用户',
    'user.reset_password': '重置密码',

    // 角色管理权限
    'role.view': '查看角色',
    'role.manage': '管理角色',
    'role.create': '创建角色',
    'role.edit': '编辑角色',
    'role.delete': '删除角色',

    // 系统管理权限
    'system.settings': '系统设置',
    'system.notifications': '通知管理',
    'system.blacklist': '黑名单管理',
    'system.semesters': '学期管理',
    'system.backup': '数据备份',
    'system.logs': '查看日志'
  }
  return displayNames[permissionName] || permissionName
}

const isCategorySelected = (category) => {
  return category.permissions.every(p => formData.value.permissions.includes(p.id))
}

const toggleCategory = (category) => {
  const allSelected = isCategorySelected(category)
  
  if (allSelected) {
    // 取消选择该分类的所有权限
    category.permissions.forEach(p => {
      const index = formData.value.permissions.indexOf(p.id)
      if (index > -1) {
        formData.value.permissions.splice(index, 1)
      }
    })
  } else {
    // 选择该分类的所有权限
    category.permissions.forEach(p => {
      if (!formData.value.permissions.includes(p.id)) {
        formData.value.permissions.push(p.id)
      }
    })
  }
}

const togglePermission = (permissionId) => {
  const index = formData.value.permissions.indexOf(permissionId)
  if (index > -1) {
    formData.value.permissions.splice(index, 1)
  } else {
    formData.value.permissions.push(permissionId)
  }
}

const refreshRoles = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/roles', {
      headers: auth.getAuthHeader().headers
    })
    roles.value = response.roles || []
  } catch (error) {
    console.error('加载角色失败:', error)
    if (window.$showNotification) {
      window.$showNotification('加载角色失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

const loadPermissions = async () => {
  try {
    const response = await $fetch('/api/admin/permissions', {
      headers: auth.getAuthHeader().headers
    })
    permissions.value = response.permissions || []
  } catch (error) {
    console.error('加载权限失败:', error)
  }
}

const editRole = (role) => {
  editingRole.value = role
  formData.value = {
    name: role.name,
    description: role.description || '',
    permissions: role.permissions || []
  }
  showEditModal.value = true
}

const deleteRole = async (roleId) => {
  const role = roles.value.find(r => r.id === roleId)
  if (!role) return

  confirmDialogTitle.value = '删除角色'
  confirmDialogMessage.value = `确定要删除角色 "${role.name}" 吗？此操作不可撤销。`
  confirmDialogType.value = 'danger'
  confirmDialogConfirmText.value = '删除'
  confirmAction.value = async () => {
    try {
      await $fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: auth.getAuthHeader().headers
      })

      await refreshRoles()

      if (window.$showNotification) {
        window.$showNotification('角色删除成功', 'success')
      }
    } catch (error) {
      console.error('删除角色失败:', error)
      if (window.$showNotification) {
        window.$showNotification('删除角色失败: ' + error.message, 'error')
      }
    }
  }
  showConfirmDialog.value = true
}

const saveRole = async () => {
  if (!formData.value.name) return

  savingRole.value = true
  try {
    const url = showEditModal.value
      ? `/api/admin/roles/${editingRole.value.id}`
      : '/api/admin/roles'

    const method = showEditModal.value ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeader().headers
      },
      body: JSON.stringify({
        name: formData.value.name,
        description: formData.value.description,
        permissions: formData.value.permissions
      })
    })

    await refreshRoles()
    closeModals()

    if (window.$showNotification) {
      window.$showNotification(
        showEditModal.value ? '角色更新成功' : '角色创建成功',
        'success'
      )
    }
  } catch (error) {
    console.error('保存角色失败:', error)
    if (window.$showNotification) {
      window.$showNotification('保存角色失败: ' + error.message, 'error')
    }
  } finally {
    savingRole.value = false
  }
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingRole.value = null
  formData.value = {
    name: '',
    description: '',
    permissions: []
  }
}

const initializeRoles = async () => {
  confirmDialogTitle.value = '初始化角色系统'
  confirmDialogMessage.value = '确定要初始化角色系统吗？这将创建默认的角色和权限。'
  confirmDialogType.value = 'info'
  confirmDialogConfirmText.value = '初始化'
  confirmAction.value = async () => {
    try {
      loading.value = true

      const response = await $fetch('/api/admin/init-roles', {
        method: 'POST',
        headers: auth.getAuthHeader().headers
      })

      if (response.success) {
        await refreshRoles()
        await loadPermissions()

        if (window.$showNotification) {
          window.$showNotification(response.message, 'success')
        }
      }
    } catch (error) {
      console.error('初始化角色系统失败:', error)
      if (window.$showNotification) {
        window.$showNotification('初始化失败: ' + error.message, 'error')
      }
    } finally {
      loading.value = false
    }
  }
  showConfirmDialog.value = true
}

// 处理确认操作
const handleConfirm = async () => {
  if (confirmAction.value) {
    await confirmAction.value()
  }
  showConfirmDialog.value = false
  confirmAction.value = null
}

// 生命周期
onMounted(async () => {
  await loadPermissions()
  await refreshRoles()
})
</script>

<style scoped>
.role-manager {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  min-height: 100vh;
  color: #e2e8f0;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
}

.toolbar-left h3 {
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin: 0 0 4px 0;
}

.toolbar-description {
  font-size: 14px;
  color: #888888;
  margin: 0;
}

.toolbar-right {
  display: flex;
  gap: 12px;
}

.create-btn,
.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.create-btn {
  background: #667eea;
  color: #ffffff;
}

.create-btn:hover {
  background: #5a67d8;
}

.refresh-btn {
  background: #2a2a2a;
  color: #cccccc;
  border: 1px solid #3a3a3a;
}

.refresh-btn:hover:not(:disabled) {
  background: #3a3a3a;
  color: #ffffff;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-btn svg,
.refresh-btn svg {
  width: 16px;
  height: 16px;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #2a2a2a;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #888888;
  font-size: 14px;
}

/* 角色网格 */
.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.role-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.role-card:hover {
  border-color: #3a3a3a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.role-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.role-info {
  flex: 1;
}

.role-name {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 4px 0;
}

.role-description {
  font-size: 14px;
  color: #888888;
  margin: 0;
  line-height: 1.4;
}

.role-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
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
  background: #667eea;
  color: #ffffff;
}

.edit-btn:hover {
  background: #5a67d8;
}

.delete-btn {
  background: #ef4444;
  color: #ffffff;
}

.delete-btn:hover {
  background: #dc2626;
}

.role-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #2a2a2a;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  color: #888888;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.role-permissions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.permissions-header {
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
}

.permissions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-tag {
  padding: 4px 8px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  font-size: 12px;
  color: #cccccc;
}

.permission-tag.more {
  background: #667eea;
  color: #ffffff;
  border-color: #667eea;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  color: #444444;
}

.empty-text {
  color: #666666;
  font-size: 16px;
  text-align: center;
}

.empty-actions {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  justify-content: center;
}

.create-first-btn {
  padding: 12px 24px;
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  border: 1px solid var(--btn-secondary-border);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-first-btn:hover {
  background: var(--btn-secondary-hover);
}

.create-first-btn.primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border-color: var(--btn-primary-bg);
}

.create-first-btn.primary:hover {
  background: var(--btn-primary-hover);
  border-color: var(--btn-primary-hover);
}

/* 模态框 */
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
  padding: 20px;
}

.modal-content {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #2a2a2a;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #cccccc;
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
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
  margin-bottom: 8px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #666666;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.permissions-grid {
  display: grid;
  gap: 16px;
}

.permission-category {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 16px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3a3a3a;
}

.category-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
}

.category-permissions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.permission-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.permission-item:hover {
  background: #3a3a3a;
}

.permission-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.permission-name {
  font-size: 14px;
  color: #cccccc;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #2a2a2a;
}

.cancel-btn,
.save-btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.cancel-btn {
  background: #2a2a2a;
  color: #cccccc;
  border: 1px solid #3a3a3a;
}

.cancel-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.save-btn {
  background: #667eea;
  color: #ffffff;
}

.save-btn:hover:not(:disabled) {
  background: #5a67d8;
}

.save-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .role-manager {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .toolbar-right {
    justify-content: flex-start;
  }

  .roles-grid {
    grid-template-columns: 1fr;
  }

  .role-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .role-actions {
    align-self: flex-end;
  }

  .modal-content {
    margin: 10px;
    max-width: none;
  }

  .category-permissions {
    grid-template-columns: 1fr;
  }

  .permission-item {
    padding: 12px 8px !important;
    margin-bottom: 8px !important;
  }

  .permission-checkbox,
  .category-checkbox {
    width: 18px !important;
    height: 18px !important;
    margin-right: 10px !important;
  }

  .permission-name,
  .category-name {
    font-size: 15px !important;
  }

  .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .cancel-btn,
  .save-btn {
    width: 100%;
    padding: 14px 20px !important;
    font-size: 16px !important;
    min-height: 48px !important;
  }
}

/* 小屏幕设备进一步优化 */
@media (max-width: 480px) {
  .role-manager {
    padding: 12px;
  }

  .toolbar-title {
    font-size: 18px;
  }

  .toolbar-description {
    font-size: 12px;
  }

  .role-card {
    padding: 16px;
  }

  .role-name {
    font-size: 16px;
  }

  .role-description {
    font-size: 13px;
  }

  .permission-tag {
    font-size: 11px;
    padding: 4px 8px;
  }

  .permission-item {
    padding: 10px 6px !important;
  }

  .permission-checkbox,
  .category-checkbox {
    width: 16px !important;
    height: 16px !important;
  }

  .permission-name,
  .category-name {
    font-size: 14px !important;
  }

  .cancel-btn,
  .save-btn {
    padding: 12px 16px !important;
    font-size: 15px !important;
    min-height: 44px !important;
  }
}
</style>
