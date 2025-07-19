<template>
  <div class="permission-manager">
    <div class="header">
      <h3>权限管理</h3>
      <p class="description">管理用户权限和角色配置</p>
    </div>

    <!-- 用户选择 -->
    <div class="user-selector">
      <label>选择用户:</label>
      <select v-model="selectedUserId" @change="loadUserPermissions" class="user-select">
        <option value="">请选择用户</option>
        <option v-for="user in users" :key="user.id" :value="user.id">
          {{ user.name || user.username }} ({{ user.username }}) - {{ getRoleDisplayName(user.role) }}
        </option>
      </select>
    </div>

    <!-- 权限配置 -->
    <div v-if="selectedUser" class="permission-config">
      <div class="user-info">
        <h4>{{ selectedUser.name || selectedUser.username }}</h4>
        <p>角色: {{ getRoleDisplayName(selectedUser.role) }}</p>
      </div>

      <div class="permissions-grid">
        <div v-for="(permissions, category) in groupedPermissions" :key="category" class="permission-category">
          <h5>{{ getCategoryDisplayName(category) }}</h5>
          <div class="permission-items">
            <div v-for="permission in permissions" :key="permission.name" class="permission-item">
              <label class="permission-label">
                <input
                  type="checkbox"
                  :checked="permission.granted"
                  @change="togglePermission(permission, $event.target.checked)"
                  :disabled="loading"
                />
                <span class="permission-name">{{ permission.displayName }}</span>
                <span class="permission-source" :class="permission.source">
                  {{ getSourceDisplayName(permission.source) }}
                </span>
              </label>
              <p v-if="permission.description" class="permission-description">
                {{ permission.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button @click="savePermissions" :disabled="loading || !hasChanges" class="save-btn">
          {{ loading ? '保存中...' : '保存权限' }}
        </button>
        <button @click="resetPermissions" :disabled="loading" class="reset-btn">
          重置
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && !selectedUser" class="loading">
      加载中...
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="error">
      {{ error }}
    </div>

    <!-- 成功信息 -->
    <div v-if="success" class="success">
      {{ success }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const users = ref([])
const selectedUserId = ref('')
const selectedUser = ref(null)
const userPermissions = ref([])
const originalPermissions = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

// 计算属性
const groupedPermissions = computed(() => {
  const grouped = {}
  userPermissions.value.forEach(permission => {
    if (!grouped[permission.category]) {
      grouped[permission.category] = []
    }
    grouped[permission.category].push(permission)
  })
  return grouped
})

const hasChanges = computed(() => {
  return JSON.stringify(userPermissions.value) !== JSON.stringify(originalPermissions.value)
})

// 获取用户列表
const fetchUsers = async () => {
  try {
    const response = await $fetch('/api/admin/users', {
      ...useAuth().getAuthHeader()
    })
    users.value = response.users || []
  } catch (err) {
    error.value = '获取用户列表失败'
    console.error('获取用户列表失败:', err)
  }
}

// 加载用户权限
const loadUserPermissions = async () => {
  if (!selectedUserId.value) {
    selectedUser.value = null
    userPermissions.value = []
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch(`/api/admin/permissions/user/${selectedUserId.value}`, {
      ...useAuth().getAuthHeader()
    })
    
    selectedUser.value = response.user
    userPermissions.value = response.permissions
    originalPermissions.value = JSON.parse(JSON.stringify(response.permissions))
  } catch (err) {
    error.value = '获取用户权限失败'
    console.error('获取用户权限失败:', err)
  } finally {
    loading.value = false
  }
}

// 切换权限
const togglePermission = (permission, granted) => {
  const index = userPermissions.value.findIndex(p => p.name === permission.name)
  if (index !== -1) {
    userPermissions.value[index] = {
      ...userPermissions.value[index],
      granted,
      source: granted !== permission.granted ? 'user' : permission.source
    }
  }
}

// 保存权限
const savePermissions = async () => {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch(`/api/admin/permissions/user/${selectedUserId.value}`, {
      method: 'POST',
      body: {
        permissions: userPermissions.value
      },
      ...useAuth().getAuthHeader()
    })

    success.value = '权限保存成功'
    originalPermissions.value = JSON.parse(JSON.stringify(userPermissions.value))
    
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    error.value = '保存权限失败'
    console.error('保存权限失败:', err)
  } finally {
    loading.value = false
  }
}

// 重置权限
const resetPermissions = () => {
  userPermissions.value = JSON.parse(JSON.stringify(originalPermissions.value))
}

// 辅助函数
const getRoleDisplayName = (role) => {
  const roleNames = {
    'USER': '普通用户',
    'SONG_ADMIN': '歌曲管理员',
    'ADMIN': '超级管理员',
    'SUPER_ADMIN': '超级管理员'
  }
  return roleNames[role] || role
}

const getCategoryDisplayName = (category) => {
  const categoryNames = {
    'song': '歌曲管理',
    'schedule': '排期管理',
    'user': '用户管理',
    'system': '系统管理'
  }
  return categoryNames[category] || category
}

const getSourceDisplayName = (source) => {
  const sourceNames = {
    'role': '角色权限',
    'user': '个人权限',
    'none': '无权限'
  }
  return sourceNames[source] || source
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.permission-manager {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 30px;
}

.header h3 {
  color: #fff;
  margin-bottom: 8px;
}

.description {
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.user-selector {
  margin-bottom: 30px;
}

.user-selector label {
  display: block;
  color: #fff;
  margin-bottom: 8px;
  font-weight: 500;
}

.user-select {
  width: 100%;
  max-width: 400px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
}

.user-select option {
  background: #1a1a1a;
  color: #fff;
}

.permission-config {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info {
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info h4 {
  color: #fff;
  margin: 0 0 5px 0;
}

.user-info p {
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.permissions-grid {
  display: grid;
  gap: 25px;
  margin-bottom: 30px;
}

.permission-category h5 {
  color: #fff;
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
}

.permission-items {
  display: grid;
  gap: 12px;
}

.permission-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.permission-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: #fff;
}

.permission-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.permission-name {
  flex: 1;
  font-weight: 500;
}

.permission-source {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.permission-source.role {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.permission-source.user {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.permission-source.none {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

.permission-description {
  margin: 8px 0 0 26px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.save-btn, .reset-btn {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn {
  background: #0b5afe;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #0847d1;
}

.save-btn:disabled {
  background: rgba(11, 90, 254, 0.5);
  cursor: not-allowed;
}

.reset-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.reset-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.loading, .error, .success {
  padding: 12px;
  border-radius: 6px;
  margin-top: 15px;
  text-align: center;
}

.loading {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.error {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.success {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.2);
}
</style>
