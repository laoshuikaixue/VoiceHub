<template>
  <div class="user-manager">
    <h2 class="section-title">用户管理</h2>
    
    <!-- 用户列表 -->
    <div class="users-section card">
      <div class="card-header">
        <div class="header-left">
          <h3>用户列表</h3>
          <div class="user-count">
            共 <span class="count-number">{{ users.length }}</span> 名用户
            <span v-if="filteredUsers.length !== users.length">
              (当前显示: {{ filteredUsers.length }})
            </span>
          </div>
        </div>
        <div class="controls">
          <input 
            v-model="searchTerm" 
            type="text" 
            placeholder="搜索用户..." 
            class="search-input"
          />
          <button @click="showAddUser = true" class="btn btn-primary">添加用户</button>
          <button @click="showImportUsers = true" class="btn btn-secondary">批量导入</button>
        </div>
      </div>
      
      <div class="loading-state" v-if="loading">
        加载中...
      </div>
      <div class="error-state" v-else-if="error">
        {{ error }}
      </div>
      <div class="empty-state" v-else-if="filteredUsers.length === 0">
        没有找到用户
      </div>
      <div class="users-table-container" v-else>
        <table class="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>姓名</th>
              <th>账号名</th>
              <th>角色</th>
              <th>年级</th>
              <th>班级</th>
              <th>最后登录</th>
              <th>登录IP</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedUsers" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.name }}</td>
              <td>{{ user.username }}</td>
              <td>
                <span :class="['role-badge', user.role === 'ADMIN' ? 'admin' : 'user']">
                  {{ user.role === 'ADMIN' ? '管理员' : '用户' }}
                </span>
              </td>
              <td>{{ user.grade || '-' }}</td>
              <td>{{ user.class || '-' }}</td>
              <td>{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '-' }}</td>
              <td>{{ user.lastLoginIp || '-' }}</td>
              <td class="actions">
                <button 
                  @click="editUser(user)" 
                  class="btn btn-sm btn-outline"
                >
                  编辑
                </button>
                <button 
                  @click="resetPassword(user)" 
                  class="btn btn-sm btn-warning"
                >
                  重置密码
                </button>
                <button 
                  @click="confirmDeleteUser(user)" 
                  class="btn btn-sm btn-danger"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <!-- 分页控件 -->
        <div class="pagination-container">
          <div class="pagination-settings">
            <label for="page-size">每页显示:</label>
            <select id="page-size" v-model.number="pageSize" class="page-size-select">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="-1">全部</option>
            </select>
          </div>
          
          <div class="pagination-controls" v-if="totalPages > 1">
            <button 
              @click="currentPage = 1" 
              class="pagination-btn"
              :disabled="currentPage === 1"
              title="首页"
            >
              &laquo;
            </button>
            <button 
              @click="currentPage--" 
              class="pagination-btn"
              :disabled="currentPage === 1"
              title="上一页"
            >
              &lsaquo;
            </button>
            
            <div class="pagination-info">
              {{ currentPage }} / {{ totalPages }}
            </div>
            
            <button 
              @click="currentPage++" 
              class="pagination-btn"
              :disabled="currentPage === totalPages"
              title="下一页"
            >
              &rsaquo;
            </button>
            <button 
              @click="currentPage = totalPages" 
              class="pagination-btn"
              :disabled="currentPage === totalPages"
              title="末页"
            >
              &raquo;
            </button>
          </div>
          
          <div class="pagination-status">
            显示 {{ paginationStart }} - {{ paginationEnd }} 条，共 {{ filteredUsers.length }} 条
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加/编辑用户弹窗 -->
    <Teleport to="body">
      <div v-if="showAddUser || editingUser" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editingUser ? '编辑用户' : '添加用户' }}</h3>
            <button @click="closeUserForm" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveUser">
              <div class="form-group">
                <label for="name">姓名</label>
                <input 
                  id="name" 
                  v-model="userForm.name" 
                  type="text" 
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="username">账号名</label>
                <input 
                  id="username" 
                  v-model="userForm.username" 
                  type="text" 
                  required
                  :disabled="!!editingUser"
                />
              </div>
              
              <div class="form-group">
                <label for="grade">年级</label>
                <select id="grade" v-model="userForm.grade">
                  <option value="">无</option>
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                  <option value="教师">教师</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="class">班级</label>
                <input 
                  id="class" 
                  v-model="userForm.class" 
                  type="text" 
                  placeholder="如: 1班、2班"
                />
              </div>
              
              <div v-if="!editingUser" class="form-group">
                <label for="password">密码</label>
                <input 
                  id="password" 
                  v-model="userForm.password" 
                  type="password" 
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="role">角色</label>
                <select id="role" v-model="userForm.role">
                  <option value="USER">普通用户</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>
              
              <div v-if="formError" class="error">{{ formError }}</div>
              
              <div class="form-actions">
                <button type="button" @click="closeUserForm" class="btn btn-secondary">取消</button>
                <button type="submit" class="btn btn-primary" :disabled="formLoading">
                  {{ formLoading ? '保存中...' : '保存' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 批量导入用户弹窗 -->
    <Teleport to="body">
      <div v-if="showImportUsers" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>批量导入用户</h3>
            <button @click="showImportUsers = false" class="close-btn">&times;</button>
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
                  </tbody>
                </table>
              </div>
              <p class="import-note">注意：第一行可以是标题行（会自动跳过），角色可以是USER或ADMIN</p>
            </div>
            
            <div class="form-group">
              <label for="file-upload">选择文件</label>
              <input 
                id="file-upload" 
                type="file" 
                accept=".xlsx" 
                @change="handleFileUpload"
              />
            </div>
            
            <div v-if="importError" class="error">{{ importError }}</div>
            <div v-if="importSuccess" class="success">{{ importSuccess }}</div>
            
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
            
            <div class="form-actions">
              <button type="button" @click="showImportUsers = false" class="btn btn-secondary">取消</button>
              <button 
                type="button" 
                @click="importUsers" 
                class="btn btn-primary" 
                :disabled="importLoading || previewData.length === 0"
              >
                {{ importLoading ? '导入中...' : '确认导入' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 确认删除弹窗 -->
    <Teleport to="body">
      <div v-if="confirmDelete" class="modal">
        <div class="modal-content modal-sm">
          <div class="modal-header">
            <h3>确认删除</h3>
            <button @click="confirmDelete = null" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p>确定要删除用户 "{{ confirmDelete?.name }}" 吗？</p>
            <p class="warning">此操作不可逆，请谨慎操作！</p>
            
            <div class="form-actions">
              <button type="button" @click="confirmDelete = null" class="btn btn-secondary">取消</button>
              <button 
                type="button" 
                @click="deleteUser" 
                class="btn btn-danger" 
                :disabled="deleteLoading"
              >
                {{ deleteLoading ? '删除中...' : '确认删除' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 重置密码弹窗 -->
    <Teleport to="body">
      <div v-if="resetPasswordUser" class="modal">
        <div class="modal-content modal-sm">
          <div class="modal-header">
            <h3>重置密码</h3>
            <button @click="resetPasswordUser = null" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="confirmResetPassword">
              <p>为用户 "{{ resetPasswordUser?.name }}" 重置密码</p>
              
              <div class="form-group">
                <label for="reset-password">新密码</label>
                <input 
                  id="reset-password" 
                  v-model="resetPasswordForm.password" 
                  type="password" 
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="reset-confirm-password">确认密码</label>
                <input 
                  id="reset-confirm-password" 
                  v-model="resetPasswordForm.confirmPassword" 
                  type="password" 
                  required
                />
              </div>
              
              <div v-if="resetPasswordError" class="error">{{ resetPasswordError }}</div>
              
              <div class="form-actions">
                <button type="button" @click="resetPasswordUser = null" class="btn btn-secondary">取消</button>
                <button 
                  type="submit" 
                  class="btn btn-warning" 
                  :disabled="resetPasswordLoading"
                >
                  {{ resetPasswordLoading ? '重置中...' : '确认重置' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// 状态变量
const users = ref([])
const loading = ref(false)
const error = ref('')
const searchTerm = ref('')

// 分页相关
const currentPage = ref(1)
const pageSize = ref(20)

// 表单相关状态
const showAddUser = ref(false)
const editingUser = ref(null)
const userForm = ref({
  name: '',
  username: '',
  password: '',
  role: 'USER',
  grade: '',
  class: ''
})
const formLoading = ref(false)
const formError = ref('')

// 批量导入相关
const showImportUsers = ref(false)
const importLoading = ref(false)
const importError = ref('')
const importSuccess = ref('')
const previewData = ref([])
const xlsxLoaded = ref(false)

// 删除用户相关
const confirmDelete = ref(null)
const deleteLoading = ref(false)

// 重置密码相关
const resetPasswordUser = ref(null)
const resetPasswordForm = ref({
  password: '',
  confirmPassword: ''
})
const resetPasswordLoading = ref(false)
const resetPasswordError = ref('')

// 过滤用户列表
const filteredUsers = computed(() => {
  if (!searchTerm.value) return users.value
  
  const term = searchTerm.value.toLowerCase()
  return users.value.filter(user => 
    user.name?.toLowerCase().includes(term) ||
    user.username.toLowerCase().includes(term)
  )
})

// 分页计算
const totalPages = computed(() => {
  if (pageSize.value <= 0) return 1
  return Math.ceil(filteredUsers.value.length / pageSize.value)
})

const paginatedUsers = computed(() => {
  // 如果pageSize为-1，显示全部
  if (pageSize.value <= 0) return filteredUsers.value
  
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + parseInt(pageSize.value)
  return filteredUsers.value.slice(start, end)
})

const paginationStart = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  if (pageSize.value <= 0) return 1
  return (currentPage.value - 1) * parseInt(pageSize.value) + 1
})

const paginationEnd = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  if (pageSize.value <= 0) return filteredUsers.value.length
  return Math.min(currentPage.value * parseInt(pageSize.value), filteredUsers.value.length)
})

// 当过滤结果变化时，重置到第一页
watch(filteredUsers, () => {
  currentPage.value = 1
})

// 当每页显示数量变化时，重置到第一页
watch(pageSize, () => {
  currentPage.value = 1
})

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  
  try {
    const date = new Date(dateString)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-'
    
    // 获取当前日期
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // 如果是今天
    if (date >= today) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    
    // 如果是昨天
    if (date >= yesterday && date < today) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    
    // 其他日期
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch (e) {
    return '-'
  }
}

// 初始化 - 获取用户列表
onMounted(async () => {
  await fetchUsers()
  // 预加载XLSX库
  loadXLSX()
})

// 加载XLSX库
const loadXLSX = async () => {
  if (process.client && !xlsxLoaded.value) {
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

// 获取用户列表
const fetchUsers = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 调用API获取用户列表
    const response = await $fetch('/api/admin/users', {
      method: 'GET',
      ...useAuth().getAuthHeader()
    })
    
    users.value = response
  } catch (err) {
    error.value = err.message || '获取用户列表失败'
    console.error('获取用户列表出错:', err)
  } finally {
    loading.value = false
  }
}

// 打开编辑用户表单
const editUser = (user) => {
  editingUser.value = user
  userForm.value = {
    id: user.id,
    name: user.name || '',
    username: user.username,
    role: user.role,
    grade: user.grade || '',
    class: user.class || ''
  }
}

// 重置密码
const resetPassword = (user) => {
  resetPasswordUser.value = user
  resetPasswordForm.value = {
    password: '',
    confirmPassword: ''
  }
  resetPasswordError.value = ''
}

const confirmResetPassword = async () => {
  if (!resetPasswordUser.value) return
  
  resetPasswordError.value = ''
  
  // 验证两次密码是否一致
  if (resetPasswordForm.value.password !== resetPasswordForm.value.confirmPassword) {
    resetPasswordError.value = '两次输入的密码不一致'
    return
  }
  
  resetPasswordLoading.value = true
  
  try {
    // 调用API重置密码
    await $fetch(`/api/admin/users/${resetPasswordUser.value.id}/reset-password`, {
      method: 'POST',
      body: {
        newPassword: resetPasswordForm.value.password
      },
      ...useAuth().getAuthHeader()
    })
    
    // 重置成功
    resetPasswordUser.value = null
    
    // 显示通知
    showNotification('密码重置成功，该用户需要重新登录', 'success')
  } catch (err) {
    resetPasswordError.value = err.message || '重置密码失败'
    console.error('重置密码出错:', err)
  } finally {
    resetPasswordLoading.value = false
  }
}

// 显示通知
const showNotification = (message, type = 'info') => {
  // 创建通知元素
  const notification = document.createElement('div')
  notification.className = `global-notification ${type}`
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
    </div>
  `
  
  // 添加到页面
  document.body.appendChild(notification)
  
  // 添加显示类
  setTimeout(() => {
    notification.classList.add('show')
  }, 10)
  
  // 自动关闭
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 3000)
}

// 确认删除用户
const confirmDeleteUser = (user) => {
  confirmDelete.value = user
}

// 删除用户
const deleteUser = async () => {
  if (!confirmDelete.value) return
  
  deleteLoading.value = true
  
  try {
    // 调用API删除用户
    await $fetch(`/api/admin/users/${confirmDelete.value.id}`, {
      method: 'DELETE',
      ...useAuth().getAuthHeader()
    })
    
    // 更新用户列表
    users.value = users.value.filter(user => user.id !== confirmDelete.value.id)
    confirmDelete.value = null
  } catch (err) {
    alert(`删除失败: ${err.message || '未知错误'}`)
    console.error('删除用户出错:', err)
  } finally {
    deleteLoading.value = false
  }
}

// 关闭用户表单
const closeUserForm = () => {
  showAddUser.value = false
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

// 保存用户
const saveUser = async () => {
  formError.value = ''
  formLoading.value = true
  
  try {
    if (editingUser.value) {
      // 更新用户
      const updatedUser = await $fetch(`/api/admin/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: {
          name: userForm.value.name,
          role: userForm.value.role,
          grade: userForm.value.grade,
          class: userForm.value.class
        },
        ...useAuth().getAuthHeader()
      })
      
      // 更新列表中的用户数据
      const index = users.value.findIndex(u => u.id === updatedUser.id)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      
      closeUserForm()
    } else {
      // 创建新用户
      const newUser = await $fetch('/api/admin/users', {
        method: 'POST',
        body: {
          name: userForm.value.name,
          username: userForm.value.username,
          password: userForm.value.password,
          role: userForm.value.role === 'ADMIN' ? 'ADMIN' : 'USER',
          grade: userForm.value.grade,
          class: userForm.value.class
        },
        ...useAuth().getAuthHeader()
      })
      
      // 添加到用户列表
      users.value.push(newUser)
      closeUserForm()
    }
  } catch (err) {
    formError.value = err.message || '保存用户失败'
    console.error('保存用户出错:', err)
  } finally {
    formLoading.value = false
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
        
        // 解析数据，从第二行开始（跳过可能的标题行）
        const startRow = jsonData[0] && jsonData[0].length >= 4 ? 1 : 0
        const userData = []
        
        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || !row.length || !row[0]) continue // 跳过空行
          
          userData.push({
            name: row[0]?.toString() || '',
            username: row[1]?.toString() || '',
            password: row[2]?.toString() || '',
            role: (row[3]?.toString() || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
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
      ...useAuth().getAuthHeader()
    })
    
    // 更新用户列表
    await fetchUsers()
    
    importSuccess.value = `成功导入 ${result.created} 个用户，${result.failed} 个用户导入失败`
    
    // 清空预览数据
    previewData.value = []
    
    // 3秒后关闭导入对话框
    setTimeout(() => {
      if (importSuccess.value) {
        showImportUsers.value = false
        importSuccess.value = ''
      }
    }, 3000)
    
  } catch (err) {
    importError.value = err.message || '导入用户失败'
    console.error('导入用户出错:', err)
  } finally {
    importLoading.value = false
  }
}
</script>

<style scoped>
.user-manager {
  width: 100%;
  max-width: 100%;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--light);
}

.card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  overflow: hidden;
  width: 100%;
}

.users-section {
  width: 100%;
  min-width: 100%;
}

.card-header {
  padding: 1rem 1.5rem;
  background: rgba(30, 41, 59, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--light);
}

.user-count {
  color: var(--gray);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
}

.count-number {
  font-weight: 600;
  color: var(--primary);
  margin: 0 0.25rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.6);
  color: var(--light);
}

.loading-state, .error-state, .empty-state {
  padding: 2rem;
  text-align: center;
}

.error-state {
  color: var(--danger);
}

.users-table-container {
  overflow-x: auto;
  padding: 0.5rem;
  width: 100%;
  max-width: 100%;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

.users-table th, .users-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  white-space: nowrap;
}

/* 设置各列宽度 */
.users-table th:nth-child(1), .users-table td:nth-child(1) { width: 50px; } /* ID */
.users-table th:nth-child(2), .users-table td:nth-child(2) { width: 120px; } /* 姓名 */
.users-table th:nth-child(3), .users-table td:nth-child(3) { width: 120px; } /* 账号名 */
.users-table th:nth-child(4), .users-table td:nth-child(4) { width: 80px; } /* 角色 */
.users-table th:nth-child(5), .users-table td:nth-child(5) { width: 80px; } /* 年级 */
.users-table th:nth-child(6), .users-table td:nth-child(6) { width: 80px; } /* 班级 */
.users-table th:nth-child(7), .users-table td:nth-child(7) { width: 180px; } /* 最后登录 */
.users-table th:nth-child(8), .users-table td:nth-child(8) { width: 120px; } /* 登录IP */
.users-table th:nth-child(9), .users-table td:nth-child(9) { width: auto; } /* 操作 */

.users-table th {
  color: var(--gray);
  font-weight: 500;
  position: sticky;
  top: 0;
  background: rgba(30, 41, 59, 0.8);
  z-index: 10;
}

.users-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* 分页控件样式 */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 0.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.pagination-settings {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--gray);
  font-size: 0.875rem;
}

.page-size-select {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.6);
  color: var(--light);
  cursor: pointer;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.4);
  color: var(--light);
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.2);
  border-color: var(--primary);
}

.pagination-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pagination-info {
  padding: 0 0.75rem;
  font-size: 0.875rem;
  color: var(--gray);
}

.pagination-status {
  font-size: 0.875rem;
  color: var(--gray);
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.role-badge.admin {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
}

.role-badge.user {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  white-space: nowrap;
  min-width: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-secondary {
  background: rgba(100, 116, 139, 0.2);
  color: var(--gray);
  border-color: rgba(100, 116, 139, 0.2);
}

.btn-outline {
  background: transparent;
  border-color: var(--primary);
  color: var(--primary);
}

.btn-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.2);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.btn:hover {
  opacity: 0.8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: rgba(30, 41, 59, 0.95);
  border-radius: 0.5rem;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-sm {
  max-width: 400px;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: rgba(30, 41, 59, 0.95);
  z-index: 10;
}

.modal-header h3 {
  margin: 0;
  color: var(--light);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray);
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem;
}

/* Form */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--light);
}

.form-group input, .form-group select {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.8);
  color: var(--light);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.error, .warning {
  color: var(--danger);
  margin: 0.5rem 0;
}

.success {
  color: var(--success);
  margin: 0.5rem 0;
}

/* Import related */
.import-instructions {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 0.375rem;
}

.import-instructions pre {
  background: rgba(15, 23, 42, 0.8);
  padding: 0.5rem;
  border-radius: 0.25rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.excel-format {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.8);
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
  color: var(--gray);
  font-weight: 500;
}

.import-note {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--gray);
  font-size: 0.875rem;
}

.preview-section {
  margin: 1.5rem 0;
}

.preview-section h4 {
  margin: 0 0 0.5rem 0;
  color: var(--light);
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
  color: var(--gray);
  font-style: italic;
}

/* Responsive */
@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .controls {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .search-input {
    flex-grow: 1;
  }
  
  .users-table th, .users-table td {
    padding: 0.5rem;
    font-size: 0.875rem;
  }
  
  .btn-sm {
    min-width: auto;
    padding: 0.25rem;
  }
  
  .pagination-container {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<style>
/* 全局通知样式 */
.global-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  transform: translateX(120%);
  transition: transform 0.3s ease;
  max-width: 350px;
}

.global-notification.show {
  transform: translateX(0);
}

.global-notification.success {
  border-left: 4px solid var(--success);
}

.global-notification.error {
  border-left: 4px solid var(--danger);
}

.global-notification.info {
  border-left: 4px solid var(--primary);
}

.global-notification.warning {
  border-left: 4px solid var(--warning);
}

.notification-content {
  display: flex;
  align-items: center;
}

.notification-message {
  color: var(--light);
  font-size: 0.9rem;
}
</style> 