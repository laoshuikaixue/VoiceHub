<template>
  <div class="user-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>用户管理</h3>
        <div class="stats">
          <span class="stat-item">总计: {{ totalUsers }} 个用户</span>
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
          <option v-for="role in allRoles" :key="role.name" :value="role.name">
            {{ role.displayName }}
          </option>
        </select>
        <div class="action-buttons">
          <button @click="showAddModal = true" class="btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加用户
          </button>
          <button @click="showImportModal = true" class="btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            批量导入
          </button>
          <button @click="showBatchUpdateModal = true" class="btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            批量更新
          </button>
        </div>
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
                    @click="viewUserSongs(user)"
                    class="action-btn music-btn"
                    title="查看歌曲"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
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
                  @click="confirmDeleteUser(user)"
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
                @click="viewUserSongs(user)"
                class="action-btn music-btn"
                title="查看歌曲"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
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
        @click="goToPage(1)"
        :disabled="currentPage === 1"
        class="page-btn"
      >
        首页
      </button>
      <button
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage === 1"
        class="page-btn"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页 (共 {{ totalUsers }} 个用户)
      </span>
      <button
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        下一页
      </button>
      <button
        @click="goToPage(totalPages)"
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
              <option v-for="role in availableRoles" :key="role.name" :value="role.name">
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

  <!-- 批量导入用户模态框 -->
  <div v-if="showImportModal" class="modal-overlay" @click="closeImportModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>批量导入用户</h3>
        <button @click="closeImportModal" class="close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="import-instructions">
          <p>请上传Excel格式文件 (.xlsx)，文件格式如下：</p>
          <div class="excel-format">
            <table>
              <thead>
                <tr>
                  <th>A列</th>
                  <th>B列</th>
                  <th>C列</th>
                  <th>D列</th>
                  <th>E列</th>
                  <th>F列</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>姓名</td>
                  <td>账号名</td>
                  <td>密码</td>
                  <td>角色</td>
                  <td>年级</td>
                  <td>班级</td>
                </tr>
                <tr>
                  <td>张三</td>
                  <td>zhangsan</td>
                  <td>password123</td>
                  <td>USER</td>
                  <td>高一</td>
                  <td>1班</td>
                </tr>
                <tr>
                  <td>李四</td>
                  <td>lisi</td>
                  <td>password456</td>
                  <td>ADMIN</td>
                  <td>教师</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="import-note">
            注意：第一行可以是标题行（会自动跳过），角色可以是：
            <span v-if="isSuperAdmin">USER（普通用户）、ADMIN（管理员）、SONG_ADMIN（歌曲管理员）、SUPER_ADMIN（超级管理员）</span>
            <span v-else>USER（普通用户）、SONG_ADMIN（歌曲管理员）</span>
          </p>
        </div>

        <div class="form-group">
          <label>选择文件</label>
          <div class="file-upload-container">
            <input
              id="file-upload"
              type="file"
              accept=".xlsx"
              @change="handleFileUpload"
              class="file-input-hidden"
            />
            <label for="file-upload" class="file-upload-btn">
              <div class="upload-text">
                <div class="upload-title">点击选择Excel文件</div>
                <div class="upload-subtitle">或拖拽文件到此处</div>
              </div>
            </label>
            <div class="file-upload-info">
              支持 .xlsx 格式文件
            </div>
          </div>
        </div>

        <div v-if="importError" class="error-message">{{ importError }}</div>
        <div v-if="importSuccess" class="success-message">{{ importSuccess }}</div>

        <div class="preview-section" v-if="previewData.length > 0">
          <h4>预览数据 ({{ previewData.length }}条记录)</h4>
          <div class="preview-table-container">
            <table class="preview-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>账号名</th>
                  <th>密码</th>
                  <th>角色</th>
                  <th>年级</th>
                  <th>班级</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in previewData.slice(0, 5)" :key="index">
                  <td>{{ row.name }}</td>
                  <td>{{ row.username }}</td>
                  <td>******</td>
                  <td>{{ row.role }}</td>
                  <td>{{ row.grade || '-' }}</td>
                  <td>{{ row.class || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="previewData.length > 5" class="preview-more">
              以及另外 {{ previewData.length - 5 }} 条记录
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="closeImportModal" class="btn-secondary">取消</button>
        <button
          @click="importUsers"
          class="btn-primary"
          :disabled="importLoading || previewData.length === 0"
        >
          {{ importLoading ? '导入中...' : '确认导入' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 删除确认模态框 -->
  <div v-if="showDeleteModal" class="modal-overlay" @click="closeDeleteModal">
    <div class="modal-content modal-sm" @click.stop>
      <div class="modal-header">
        <h3>确认删除</h3>
        <button @click="closeDeleteModal" class="close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="delete-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div class="warning-text">
            <p>确定要删除用户 <strong>"{{ deletingUser?.name }}"</strong> 吗？</p>
            <p class="warning-note">此操作不可撤销，请谨慎操作！</p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="closeDeleteModal" class="btn-secondary">取消</button>
        <button @click="confirmDelete" class="btn-danger" :disabled="deleting">
          {{ deleting ? '删除中...' : '确认删除' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 批量更新模态框 -->
  <BatchUpdateModal
    :show="showBatchUpdateModal"
    :users="users"
    @close="closeBatchUpdateModal"
    @update-success="handleBatchUpdateSuccess"
  />

  <!-- 用户歌曲模态框 -->
  <UserSongsModal
    :show="showUserSongsModal"
    :user-id="selectedUserId"
    @close="closeUserSongsModal"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { usePermissions } from '~/composables/usePermissions'
import UserSongsModal from '~/components/Admin/UserSongsModal.vue'
import BatchUpdateModal from '~/components/Admin/BatchUpdateModal.vue'

// 响应式数据
const loading = ref(false)
const users = ref([])
const searchQuery = ref('')
const roleFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(50)
const totalUsers = ref(0)
const totalPages = ref(1)

// 硬编码角色定义
const allRoles = [
  { name: 'USER', displayName: '普通用户' },
  { name: 'SONG_ADMIN', displayName: '歌曲管理员' },
  { name: 'ADMIN', displayName: '管理员' },
  { name: 'SUPER_ADMIN', displayName: '超级管理员' }
]

// 模态框状态
const showAddModal = ref(false)
const editingUser = ref(null)
const saving = ref(false)
const formError = ref('')

// 重置密码状态
const resetPasswordUser = ref(null)
const resetting = ref(false)
const passwordError = ref('')

// 批量导入状态
const showImportModal = ref(false)
const importLoading = ref(false)
const importError = ref('')
const importSuccess = ref('')
const previewData = ref([])
const xlsxLoaded = ref(false)

// 批量更新状态
const showBatchUpdateModal = ref(false)

// 删除确认状态
const showDeleteModal = ref(false)
const deletingUser = ref(null)
const deleting = ref(false)

// 用户歌曲模态框状态
const showUserSongsModal = ref(false)
const selectedUserId = ref(null)

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
const auth = useAuth()
const permissions = usePermissions()

// 计算属性
const isSuperAdmin = computed(() => {
  return auth.user.value?.role === 'SUPER_ADMIN'
})

const availableRoles = computed(() => {
  if (isSuperAdmin.value) {
    // 超级管理员可以分配除自己以外的所有角色
    return allRoles.filter(role => role.name !== 'SUPER_ADMIN')
  } else {
    // 其他角色不能分配角色，返回空数组
    return []
  }
})

// 由于使用服务器端分页，这些计算属性简化了
const filteredUsers = computed(() => {
  return users.value
})

const paginatedUsers = computed(() => {
  return users.value
})

// 监听搜索和过滤条件变化
watch([searchQuery, roleFilter], () => {
  currentPage.value = 1
  loadUsers(1, pageSize.value)
}, { debounce: 300 })

// 监听页码变化
watch(currentPage, (newPage) => {
  loadUsers(newPage, pageSize.value)
})

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

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    currentPage.value = page
  }
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

const confirmDeleteUser = (user) => {
  deletingUser.value = user
  showDeleteModal.value = true
}

const viewUserSongs = (user) => {
  selectedUserId.value = user.id
  showUserSongsModal.value = true
}

const closeUserSongsModal = () => {
  showUserSongsModal.value = false
  selectedUserId.value = null
}

const closeBatchUpdateModal = () => {
  showBatchUpdateModal.value = false
}

const handleBatchUpdateSuccess = async () => {
  await loadUsers()
  if (window.$showNotification) {
    window.$showNotification('批量更新成功', 'success')
  }
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  deletingUser.value = null
  deleting.value = false
}

const confirmDelete = async () => {
  if (!deletingUser.value) return

  deleting.value = true

  try {
    await $fetch(`/api/admin/users/${deletingUser.value.id}`, {
      method: 'DELETE',
      ...auth.getAuthConfig()
    })

    await loadUsers()
    closeDeleteModal()

    if (window.$showNotification) {
      window.$showNotification('用户删除成功', 'success')
    }
  } catch (error) {
    console.error('删除用户失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除用户失败: ' + error.message, 'error')
    }
  } finally {
    deleting.value = false
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

    // 检查是否是权限更新
    const isRoleUpdate = editingUser.value && editingUser.value.role !== userForm.value.role
    const oldRole = editingUser.value?.role
    const newRole = userForm.value.role

    if (editingUser.value) {
      await $fetch(`/api/admin/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: userData,
        ...auth.getAuthConfig()
      })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: userData,
        ...auth.getAuthConfig()
      })
    }

    // 如果是权限更新且当前用户是超级管理员，发送通知
    if (isRoleUpdate && permissions.isSuperAdmin) {
      try {
        const roleNames = {
          'USER': '普通用户',
          'SONG_ADMIN': '歌曲管理员', 
          'ADMIN': '管理员',
          'SUPER_ADMIN': '超级管理员'
        }
        
        const notificationMessage = `您的账户权限已由超级管理员更新：${roleNames[oldRole]} → ${roleNames[newRole]}`
        
        await $fetch('/api/admin/notifications/send', {
          method: 'POST',
          body: {
            userId: editingUser.value.id,
            title: '权限变更通知',
            message: notificationMessage,
            type: 'system'
          },
          ...auth.getAuthConfig()
        })
      } catch (notificationError) {
        console.error('发送权限变更通知失败:', notificationError)
        // 不影响主要操作，只记录错误
      }
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
      ...auth.getAuthConfig()
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

const loadUsers = async (page = 1, limit = 100) => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/users', {
      query: {
        page: page.toString(),
        limit: limit.toString(),
        search: searchQuery.value || undefined,
        role: roleFilter.value || undefined
      },
      ...auth.getAuthConfig()
    })
    
    // 处理分页响应数据
    if (response.users) {
      users.value = response.users
      // 更新分页信息
      if (response.pagination) {
        totalUsers.value = response.pagination.total
        currentPage.value = response.pagination.page
        totalPages.value = response.pagination.totalPages
      }
    } else {
      users.value = []
    }
  } catch (error) {
    console.error('加载用户失败:', error)
    if (window.$showNotification) {
      window.$showNotification('加载用户失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

// 批量导入相关方法
const closeImportModal = () => {
  showImportModal.value = false
  importError.value = ''
  importSuccess.value = ''
  previewData.value = []
  // 清空文件输入
  const fileInput = document.getElementById('file-upload')
  if (fileInput) {
    fileInput.value = ''
  }
}

// 加载XLSX库
const loadXLSX = async () => {
  if (typeof window !== 'undefined' && !xlsxLoaded.value) {
    try {
      // 使用多个可靠的CDN源，如果一个失败可以尝试另一个
      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      ]

      // 尝试加载第一个CDN
      let loaded = false
      for (const url of cdnUrls) {
        if (loaded) break

        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = url
            script.async = true

            script.onload = () => {
              xlsxLoaded.value = true
              loaded = true
              console.log('XLSX库加载成功:', url)
              resolve()
            }

            script.onerror = () => {
              console.warn(`无法从 ${url} 加载XLSX库，尝试下一个源`)
              reject()
            }

            document.head.appendChild(script)
          })
        } catch (e) {
          // 这个CDN失败，继续尝试下一个
          continue
        }
      }

      if (!loaded) {
        throw new Error('所有XLSX库源加载失败')
      }
    } catch (err) {
      console.error('加载XLSX库失败:', err)
    }
  }
}

// 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  importError.value = ''
  importSuccess.value = ''
  previewData.value = []

  // 确保XLSX库已加载
  if (!window.XLSX) {
    await loadXLSX()

    if (!window.XLSX) {
      importError.value = '无法加载Excel处理库，请刷新页面重试'
      return
    }
  }

  try {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        // 使用全局XLSX对象
        const workbook = window.XLSX.read(data, { type: 'array' })

        // 假设数据在第一个工作表中
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

        // 智能检测标题行
        let startRow = 0
        if (jsonData.length > 0 && jsonData[0]) {
          const firstRow = jsonData[0]
          // 检查第一行是否包含常见的标题关键词
          const titleKeywords = ['姓名', '用户名', '密码', '角色', '年级', '班级', 'name', 'username', 'password', 'role', 'grade', 'class']
          const isHeaderRow = firstRow.some(cell => 
            cell && titleKeywords.some(keyword => 
              cell.toString().toLowerCase().includes(keyword.toLowerCase())
            )
          )
          
          if (isHeaderRow) {
            startRow = 1
            console.log('检测到标题行，从第二行开始解析')
          } else {
            console.log('未检测到标题行，从第一行开始解析')
          }
        }
        
        const userData = []

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || !row.length || !row[0]) continue // 跳过空行

          let role = (row[3]?.toString() || '').toUpperCase()
          
          // 根据当前用户权限过滤角色
          if (!isSuperAdmin.value) {
            // 普通管理员只能导入 USER 和 SONG_ADMIN 角色
            if (role !== 'USER' && role !== 'SONG_ADMIN') {
              role = 'USER' // 默认设为普通用户
            }
          }
          
          // 确保角色有效
          const validRoles = ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']
          if (!validRoles.includes(role)) {
            role = 'USER'
          }

          userData.push({
            name: row[0]?.toString() || '',
            username: row[1]?.toString() || '',
            password: row[2]?.toString() || '',
            role: role,
            grade: row[4]?.toString() || '',
            class: row[5]?.toString() || ''
          })
        }

        if (userData.length === 0) {
          importError.value = '未找到有效数据'
          return
        }

        previewData.value = userData
      } catch (err) {
        console.error('解析Excel出错:', err)
        importError.value = '解析Excel文件失败: ' + (err.message || '未知错误')
      }
    }

    reader.onerror = () => {
      importError.value = '读取文件失败'
    }

    reader.readAsArrayBuffer(file)
  } catch (err) {
    console.error('处理Excel文件错误:', err)
    importError.value = '处理Excel文件失败: ' + (err.message || '未知错误')
  }
}

// 批量导入用户
const importUsers = async () => {
  if (previewData.value.length === 0) return

  importLoading.value = true
  importError.value = ''
  importSuccess.value = ''

  try {
    // 调用API批量导入用户
    const result = await $fetch('/api/admin/users/batch', {
      method: 'POST',
      body: {
        users: previewData.value
      },
      ...auth.getAuthConfig()
    })

    // 更新用户列表
    await loadUsers()

    importSuccess.value = `成功导入 ${result.created} 个用户，${result.failed} 个用户导入失败`

    // 清空预览数据
    previewData.value = []

    // 3秒后关闭导入对话框
    setTimeout(() => {
      if (importSuccess.value) {
        closeImportModal()
      }
    }, 3000)

  } catch (err) {
    importError.value = err.message || '导入用户失败'
    console.error('导入用户出错:', err)
  } finally {
    importLoading.value = false
  }
}

// 生命周期
onMounted(async () => {
  await loadUsers(1, pageSize.value)
  // 预加载XLSX库
  loadXLSX()
})
</script>

<style scoped>
.user-manager {
  padding: 20px;
  background: var(--bg-primary);
  min-height: 100vh;
  color: #e2e8f0;
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
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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

/* 操作按钮组 */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 搜索框样式 */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 200px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #666666;
  z-index: 2;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 34px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  box-sizing: border-box;
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
  text-align: center;
  text-align-last: center;
}

.filter-select option {
  text-align: left;
  background: #2a2a2a;
  color: #ffffff;
  padding: 8px 12px;
}

.filter-select option {
  text-align: center;
  background: #2a2a2a;
  color: #ffffff;
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

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #4a5568;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #2d3748;
}

.btn-secondary svg {
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

.music-btn {
  background: #7c3aed;
  color: #ffffff;
}

.music-btn:hover {
  background: #8b5cf6;
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
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  /* 移动端第一行：搜索和筛选 */
  .toolbar-right > .search-box {
    flex: 1;
    min-width: 0;
    order: 1;
  }

  .toolbar-right > .filter-select {
    flex-shrink: 0;
    min-width: 100px;
    order: 2;
  }

  /* 移动端第二行：按钮组 */
  .toolbar-right > .action-buttons {
    order: 3;
    flex-basis: 100%; /* 占满整行 */
    width: 100%;
  }

  /* 移动端搜索框样式 - 使用更强的选择器 */
  .toolbar-right > .search-box {
    width: 100% !important;
    flex: 1 !important;
    min-width: 0 !important;
  }

  .user-manager .toolbar-right > .search-box .search-input {
    width: 100% !important;
    padding: 12px 16px 12px 44px !important; /* 匹配mobile-admin.css的padding但增加左padding */
    font-size: 16px !important; /* 匹配mobile-admin.css */
    box-sizing: border-box !important;
    min-height: 44px !important; /* 匹配mobile-admin.css */
    border-radius: 10px !important; /* 匹配mobile-admin.css */
  }

  .user-manager .toolbar-right > .search-box .search-icon {
    left: 16px !important; /* 调整图标位置匹配新的padding */
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 18px !important; /* 稍微增大图标 */
    height: 18px !important;
    position: absolute !important;
    z-index: 10 !important;
  }

  /* 移动端按钮组保持一行 */
  .action-buttons {
    flex-direction: row;
    width: 100%;
    gap: 8px;
    flex-basis: 100%; /* 占满整行 */
  }

  .action-buttons .btn-primary,
  .action-buttons .btn-secondary {
    flex: 1;
    justify-content: center;
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
    max-width: 480px;
    margin: 20px;
    max-height: 85vh;
    overflow-y: auto;
  }

  /* 移动端模态框按钮优化 */
  .modal-footer {
    flex-direction: row;
    gap: 8px;
  }

  .modal-footer .btn-secondary,
  .modal-footer .btn-primary {
    flex: 1;
    justify-content: center;
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

/* 批量导入相关样式 */
.import-instructions {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 0.375rem;
}

.excel-format {
  margin-top: 1rem;
  padding: 1rem;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 0.375rem;
  overflow-x: auto;
}

.excel-format table {
  border-collapse: collapse;
  width: 100%;
}

.excel-format th, .excel-format td {
  padding: 0.5rem;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.875rem;
}

.excel-format th {
  background: rgba(255, 255, 255, 0.05);
  color: #888888;
  font-weight: 500;
}

.import-note {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: #888888;
  font-size: 0.875rem;
}

.preview-section {
  margin: 1.5rem 0;
}

.preview-section h4 {
  margin: 0 0 0.5rem 0;
  color: #ffffff;
}

.preview-table-container {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 0.375rem;
  padding: 0.5rem;
  overflow-x: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
}

.preview-table th, .preview-table td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.875rem;
}

.preview-more {
  text-align: center;
  padding: 0.5rem;
  color: #888888;
  font-style: italic;
}

.success-message {
  color: #10b981;
  margin: 0.5rem 0;
}

.error-message {
  color: #ef4444;
  margin: 0.5rem 0;
}

/* 文件上传样式 */
.file-upload-container {
  margin-top: 0.5rem;
}

.file-input-hidden {
  display: none;
}

.file-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #2a2a2a;
  border: 2px dashed #4a5568;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 80px;
}

.file-upload-btn:hover {
  background: #3a3a3a;
  border-color: #667eea;
}

.upload-text {
  text-align: center;
}

.upload-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.upload-subtitle {
  font-size: 14px;
  color: #888888;
}

.file-upload-info {
  margin-top: 8px;
  font-size: 12px;
  color: #888888;
  text-align: center;
}

/* 删除确认模态框样式 */
.modal-sm {
  max-width: 400px;
}

.delete-warning {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
}

.delete-warning svg {
  width: 24px;
  height: 24px;
  color: #ef4444;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-text p {
  margin: 0 0 8px 0;
  color: #ffffff;
}

.warning-text .warning-note {
  font-size: 14px;
  color: #ef4444;
  margin: 8px 0 0 0;
}

.btn-danger {
  background: #dc2626;
  color: #ffffff;
  border: 1px solid #dc2626;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #ef4444;
  border-color: #ef4444;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>