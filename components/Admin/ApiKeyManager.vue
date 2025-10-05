<template>
  <div class="api-key-manager">
    <!-- 页面标题和操作 -->
    <div class="manager-header">
      <div class="header-content">
        <h2 class="manager-title">API密钥管理</h2>
        <p class="manager-description">管理开放API的访问密钥，控制第三方应用的访问权限</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" @click="showCreateModal = true">
          <svg class="btn-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="12" x2="12" y1="5" y2="19"/>
            <line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
          创建API密钥
        </button>
      </div>
    </div>

    <!-- 筛选和搜索 -->
    <div class="filters-section">
      <div class="filters-row">
        <div class="filter-group">
          <label class="filter-label">搜索</label>
          <input
              v-model="filters.search"
              class="filter-input"
              placeholder="搜索API密钥名称或描述"
              type="text"
              @input="debouncedSearch"
          />
        </div>
        <div class="filter-group">
          <label class="filter-label">状态</label>
          <select v-model="filters.status" class="filter-select" @change="loadApiKeys">
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="inactive">非活跃</option>
            <option value="expired">已过期</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">创建者</label>
          <input
              v-model="filters.createdBy"
              class="filter-input"
              placeholder="创建者用户名"
              type="text"
              @input="debouncedSearch"
          />
        </div>
      </div>
    </div>

    <!-- API密钥列表 -->
    <div class="api-keys-section">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="apiKeys.length === 0" class="empty-state">
        <svg class="empty-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect height="11" rx="2" ry="2" width="18" x="3" y="11"/>
          <circle cx="12" cy="16" r="1"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h3>暂无API密钥</h3>
        <p>还没有创建任何API密钥，点击上方按钮创建第一个密钥</p>
      </div>

      <div v-else class="api-keys-grid">
        <div
            v-for="apiKey in apiKeys"
            :key="apiKey.id"
            :class="{ 'card-inactive': !apiKey.isActive, 'card-expired': apiKey.isExpired }"
            class="api-key-card"
        >
          <div class="card-header">
            <div class="card-title-section">
              <h3 class="card-title">{{ apiKey.name }}</h3>
              <span :class="`status-${apiKey.status}`" class="status-badge">
                {{ getStatusText(apiKey.status) }}
              </span>
            </div>
            <div class="card-actions">
              <button class="action-btn" title="查看详情" @click="viewApiKey(apiKey)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="action-btn" title="编辑" @click="editApiKey(apiKey)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="action-btn action-btn-danger" title="删除" @click="deleteApiKey(apiKey)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="card-content">
            <p class="card-description">{{ apiKey.description || '暂无描述' }}</p>

            <div class="card-info">
              <div class="info-item">
                <span class="info-label">创建者:</span>
                <span class="info-value">{{ apiKey.creatorName || '未知' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间:</span>
                <span class="info-value">{{ formatDate(apiKey.createdAt) }}</span>
              </div>
              <div v-if="apiKey.expiresAt" class="info-item">
                <span class="info-label">过期时间:</span>
                <span :class="{ 'text-danger': apiKey.isExpired }" class="info-value">
                  {{ formatDate(apiKey.expiresAt) }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">权限:</span>
                <div class="permissions-list">
                  <span
                      v-for="permission in apiKey.permissions.slice(0, 3)"
                      :key="permission"
                      class="permission-tag"
                  >
                    {{ permission }}
                  </span>
                  <span v-if="apiKey.permissions.length > 3" class="permission-more">
                    +{{ apiKey.permissions.length - 3 }}个
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.totalPages > 1" class="pagination-section">
        <div class="pagination">
          <button
              :disabled="pagination.page <= 1"
              class="pagination-btn"
              @click="changePage(pagination.page - 1)"
          >
            上一页
          </button>
          <span class="pagination-info">
            第 {{ pagination.page }} 页，共 {{ pagination.totalPages }} 页
          </span>
          <button
              :disabled="pagination.page >= pagination.totalPages"
              class="pagination-btn"
              @click="changePage(pagination.page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑API密钥模态框 -->
    <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click="closeModals">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">
            {{ showCreateModal ? '创建API密钥' : '编辑API密钥' }}
          </h3>
          <button class="modal-close" @click="closeModals">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="showCreateModal ? createApiKey() : updateApiKey()">
            <div class="form-group">
              <label class="form-label">名称 *</label>
              <input
                  v-model="form.name"
                  class="form-input"
                  placeholder="输入API密钥名称"
                  required
                  type="text"
              />
            </div>

            <div class="form-group">
              <label class="form-label">描述</label>
              <textarea
                  v-model="form.description"
                  class="form-textarea"
                  placeholder="输入API密钥描述（可选）"
                  rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">过期时间</label>
              <select
                  v-model="form.expiresAt"
                  class="form-select"
              >
                <option value="">永不过期</option>
                <option value="3d">3天后过期</option>
                <option value="7d">7天后过期</option>
                <option value="30d">30天后过期</option>
                <option value="60d">60天后过期</option>
                <option value="90d">90天后过期</option>
              </select>
              <small class="form-help">选择API Key的有效期</small>
            </div>


            <div class="form-group">
              <label class="form-label">权限设置 *</label>
              <div class="permissions-grid">
                <label
                    v-for="permission in availablePermissions"
                    :key="permission.value"
                    class="permission-checkbox"
                >
                  <input
                      v-model="form.permissions"
                      :value="permission.value"
                      type="checkbox"
                  />
                  <span class="checkbox-label">
                    <strong>{{ permission.label }}</strong>
                    <small>{{ permission.description }}</small>
                  </span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="permission-checkbox">
                <input v-model="form.isActive" type="checkbox"/>
                <span class="checkbox-label">启用此API密钥</span>
              </label>
            </div>

            <div class="form-actions">
              <button class="btn btn-secondary" type="button" @click="closeModals">
                取消
              </button>
              <button :disabled="submitting" class="btn btn-primary" type="submit">
                {{ submitting ? '保存中...' : (showCreateModal ? '创建' : '保存') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 查看API密钥详情模态框 -->
    <div v-if="showViewModal" class="modal-overlay" @click="closeModals">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">API密钥详情</h3>
          <button class="modal-close" @click="closeModals">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div v-if="selectedApiKey" class="modal-body">
          <div class="detail-section">
            <h4 class="detail-title">基本信息</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">名称:</span>
                <span class="detail-value">{{ selectedApiKey.name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">状态:</span>
                <span :class="`status-${selectedApiKey.status}`" class="status-badge">
                  {{ getStatusText(selectedApiKey.status) }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">描述:</span>
                <span class="detail-value">{{ selectedApiKey.description || '暂无描述' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">创建者:</span>
                <span class="detail-value">{{ selectedApiKey.creatorName || '未知' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">创建时间:</span>
                <span class="detail-value">{{ formatDate(selectedApiKey.createdAt) }}</span>
              </div>
              <div v-if="selectedApiKey.expiresAt" class="detail-item">
                <span class="detail-label">过期时间:</span>
                <span :class="{ 'text-danger': selectedApiKey.isExpired }" class="detail-value">
                  {{ formatDate(selectedApiKey.expiresAt) }}
                </span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-title">使用统计</h4>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">总调用次数:</span>
                <span class="stat-value">{{ selectedApiKey.usageCount || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">最后使用:</span>
                <span class="stat-value">{{
                    selectedApiKey.lastUsedAt ? formatDate(selectedApiKey.lastUsedAt) : '从未使用'
                  }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-title">使用日志</h4>
            <div class="logs-container">
              <div v-if="loadingLogs" class="loading-state">
                <div class="loading-spinner"></div>
                <span>加载日志中...</span>
              </div>
              <div v-else-if="apiLogs.length === 0" class="empty-state">
                <span>暂无使用记录</span>
              </div>
              <div v-else class="logs-list">
                <div v-for="log in apiLogs" :key="log.id" class="log-item">
                  <div class="log-header">
                    <span :class="`method-${log.method.toLowerCase()}`" class="log-method">{{ log.method }}</span>
                    <span class="log-endpoint">{{ log.endpoint }}</span>
                    <span :class="`status-${Math.floor(log.statusCode / 100)}`" class="log-status">{{
                        log.statusCode
                      }}</span>
                  </div>
                  <div class="log-details">
                    <span class="log-time">{{ formatDate(log.createdAt) }}</span>
                    <span class="log-ip">{{ log.ipAddress }}</span>
                    <span class="log-response-time">{{ log.responseTimeMs }}ms</span>
                  </div>
                </div>
              </div>
              <div v-if="apiLogs.length > 0 && logsPagination.totalPages > 1" class="logs-pagination">
                <button
                    :disabled="logsPagination.page <= 1"
                    class="btn btn-secondary btn-sm"
                    @click="loadApiLogs(logsPagination.page - 1)"
                >
                  上一页
                </button>
                <span class="pagination-info">
                  {{ logsPagination.page }} / {{ logsPagination.totalPages }}
                </span>
                <button
                    :disabled="logsPagination.page >= logsPagination.totalPages"
                    class="btn btn-secondary btn-sm"
                    @click="loadApiLogs(logsPagination.page + 1)"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-title">权限列表</h4>
            <div class="permissions-display">
              <span
                  v-for="permission in selectedApiKey.permissions"
                  :key="permission"
                  class="permission-tag"
              >
                {{ permission }}
              </span>
            </div>
          </div>


        </div>
      </div>
    </div>

    <!-- API密钥创建成功模态框 -->
    <div v-if="showSuccessModal" class="modal-overlay" @click="closeModals">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">API密钥创建成功</h3>
          <button class="modal-close" @click="closeModals">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div v-if="newApiKey" class="modal-body">
          <div class="success-message">
            <div class="success-icon">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
            </div>
            <h4>API密钥创建成功！</h4>
            <p>请妥善保管以下API密钥，它只会显示这一次。</p>
          </div>

          <div class="detail-section">
            <h4 class="detail-title">API密钥信息</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">名称:</span>
                <span class="detail-value">{{ newApiKey.name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">描述:</span>
                <span class="detail-value">{{ newApiKey.description || '暂无描述' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">创建者:</span>
                <span class="detail-value">{{ newApiKey.creatorName || '未知' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">创建时间:</span>
                <span class="detail-value">{{ formatDate(newApiKey.createdAt) }}</span>
              </div>
              <div v-if="newApiKey.expiresAt" class="detail-item">
                <span class="detail-label">过期时间:</span>
                <span class="detail-value">{{ formatDate(newApiKey.expiresAt) }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-title">完整API密钥</h4>
            <div class="api-key-display">
              <input
                  :value="newApiKey.apiKey"
                  class="api-key-input"
                  readonly
                  type="text"
              />
              <button class="btn btn-secondary" @click="copyToClipboard(newApiKey.apiKey)">
                复制
              </button>
            </div>
            <small class="form-help text-warning">
              ⚠️ 请立即复制并保存此API密钥，关闭此窗口后将无法再次查看完整密钥
            </small>
          </div>

          <div class="detail-section">
            <h4 class="detail-title">权限列表</h4>
            <div class="permissions-display">
              <span
                  v-for="permission in newApiKey.permissions"
                  :key="permission"
                  class="permission-tag"
              >
                {{ permission }}
              </span>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" @click="closeModals">
              我已保存，关闭窗口
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 确认删除对话框 -->
    <ConfirmDialog
        v-model:show="showConfirmDialog"
        :cancel-text="confirmDialogConfig.cancelText"
        :confirm-text="confirmDialogConfig.confirmText"
        :message="confirmDialogConfig.message"
        :title="confirmDialogConfig.title"
        :type="confirmDialogConfig.type"
        @cancel="cancelDelete"
        @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import {computed, onMounted, reactive, ref} from 'vue'
import {useToast} from '~/composables/useToast'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const apiKeys = ref([])
const selectedApiKey = ref(null)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showViewModal = ref(false)
const showSuccessModal = ref(false)
const showFullKey = ref(false)
const newApiKey = ref(null)
const loadingLogs = ref(false)
const apiLogs = ref([])
const logsPagination = ref({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
})

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref({
  title: '确认删除',
  message: '',
  type: 'danger',
  confirmText: '删除',
  cancelText: '取消'
})
const pendingDeleteApiKey = ref(null)

// 分页信息
const pagination = ref({
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0
})

// 筛选条件
const filters = reactive({
  search: '',
  status: '',
  createdBy: ''
})

// 表单数据
const form = reactive({
  name: '',
  description: '',
  expiresAt: '',

  permissions: [],
  isActive: true
})

// 可用权限列表
const availablePermissions = [
  {
    value: 'schedules:read',
    label: '排期查询',
    description: '查看排期列表和详情'
  },
  {
    value: 'songs:read',
    label: '歌曲查询',
    description: '查看歌曲列表和详情'
  }
]

// Toast通知
const toast = useToast()

// 计算属性
const debouncedSearch = computed(() => {
  let timeout
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      loadApiKeys()
    }, 500)
  }
})

// 方法
const loadApiKeys = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: pagination.value.page.toString(),
      limit: pagination.value.limit.toString()
    })

    if (filters.search) params.append('search', filters.search)
    if (filters.status) params.append('status', filters.status)
    if (filters.createdBy) params.append('createdBy', filters.createdBy)

    const response = await $fetch(`/api/admin/api-keys?${params}`)

    if (response.success) {
      apiKeys.value = response.data.items
      pagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('加载API密钥失败:', error)
    toast.error('加载API密钥失败')
  } finally {
    loading.value = false
  }
}

const createApiKey = async () => {
  submitting.value = true
  try {
    const data = {
      name: form.name,
      description: form.description || null,
      expiresAt: form.expiresAt || null,

      permissions: form.permissions,
      isActive: form.isActive
    }

    const response = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: data
    })

    if (response.success) {
      toast.success('API密钥创建成功')
      newApiKey.value = response.data
      showCreateModal.value = false
      showSuccessModal.value = true
      resetForm()
      await loadApiKeys()
    }
  } catch (error) {
    console.error('创建API密钥失败:', error)
    toast.error(error.data?.message || '创建API密钥失败')
  } finally {
    submitting.value = false
  }
}

const updateApiKey = async () => {
  if (!selectedApiKey.value) return

  submitting.value = true
  try {
    const data = {
      name: form.name,
      description: form.description || null,
      expiresAt: form.expiresAt || null,

      permissions: form.permissions,
      isActive: form.isActive
    }

    const response = await $fetch(`/api/admin/api-keys/${selectedApiKey.value.id}`, {
      method: 'PUT',
      body: data
    })

    if (response.success) {
      toast.success('API密钥更新成功')
      closeModals()
      resetForm()
      await loadApiKeys()
    }
  } catch (error) {
    console.error('更新API密钥失败:', error)
    toast.error(error.data?.message || '更新API密钥失败')
  } finally {
    submitting.value = false
  }
}

const deleteApiKey = (apiKey) => {
  pendingDeleteApiKey.value = apiKey
  confirmDialogConfig.value = {
    title: '确认删除',
    message: `确定要删除API密钥 "${apiKey.name}" 吗？此操作不可撤销。`,
    type: 'danger',
    confirmText: '删除',
    cancelText: '取消'
  }
  showConfirmDialog.value = true
}

const confirmDelete = async () => {
  if (!pendingDeleteApiKey.value) return

  try {
    const response = await $fetch(`/api/admin/api-keys/${pendingDeleteApiKey.value.id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      toast.success('API密钥删除成功')
      await loadApiKeys()
    }
  } catch (error) {
    console.error('删除API密钥失败:', error)
    toast.error(error.data?.message || '删除API密钥失败')
  } finally {
    showConfirmDialog.value = false
    pendingDeleteApiKey.value = null
  }
}

const cancelDelete = () => {
  showConfirmDialog.value = false
  pendingDeleteApiKey.value = null
}

const viewApiKey = async (apiKey) => {
  try {
    const response = await $fetch(`/api/admin/api-keys/${apiKey.id}`)
    if (response.success) {
      selectedApiKey.value = response.data
      showViewModal.value = true
      showFullKey.value = false
      // 加载API使用日志
      await loadApiLogs(1)
    }
  } catch (error) {
    console.error('获取API密钥详情失败:', error)
    toast.error('获取API密钥详情失败')
  }
}

const editApiKey = async (apiKey) => {
  try {
    const response = await $fetch(`/api/admin/api-keys/${apiKey.id}`)
    if (response.success) {
      selectedApiKey.value = response.data

      // 填充表单
      form.name = response.data.name
      form.description = response.data.description || ''
      form.expiresAt = response.data.expiresAt
          ? new Date(response.data.expiresAt).toISOString().slice(0, 16)
          : ''

      form.permissions = response.data.permissions || []
      form.isActive = response.data.isActive

      showEditModal.value = true
    }
  } catch (error) {
    console.error('获取API密钥详情失败:', error)
    toast.error('获取API密钥详情失败')
  }
}

const loadApiLogs = async (page = 1) => {
  if (!selectedApiKey.value) return

  loadingLogs.value = true
  try {
    const response = await $fetch('/api/admin/api-keys/logs', {
      query: {
        apiKeyId: selectedApiKey.value.id,
        page,
        limit: logsPagination.value.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    })

    if (response.logs) {
      apiLogs.value = response.logs
      logsPagination.value = {
        ...logsPagination.value,
        ...response.pagination,
        page
      }
    }
  } catch (error) {
    console.error('获取API使用日志失败:', error)
    toast.error('获取API使用日志失败')
    apiLogs.value = []
  } finally {
    loadingLogs.value = false
  }
}

const changePage = (page) => {
  pagination.value.page = page
  loadApiKeys()
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  showViewModal.value = false
  showSuccessModal.value = false
  selectedApiKey.value = null
  newApiKey.value = null
  showFullKey.value = false
  // 重置日志相关状态
  apiLogs.value = []
  loadingLogs.value = false
  logsPagination.value = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  }
  resetForm()
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.expiresAt = ''
  form.allowedIpsText = ''
  form.permissions = []
  form.isActive = true
}

const getStatusText = (status) => {
  const statusMap = {
    active: '活跃',
    inactive: '非活跃',
    expired: '已过期'
  }
  return statusMap[status] || status
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  } catch (error) {
    console.error('复制失败:', error)
    toast.error('复制失败')
  }
}

// 生命周期
onMounted(() => {
  loadApiKeys()
})
</script>

<style scoped>
.api-key-manager {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 24px;
}

.header-content {
  flex: 1;
}

.manager-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.manager-description {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: #f8f9fa;
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.btn-secondary:hover {
  background: #e9ecef;
  border-color: var(--primary-color);
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* 修复缺少背景色的按钮样式 */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 6px;
  background: #f8f9fa;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #e9ecef;
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.action-btn-danger {
  background: #fff5f5;
  border-color: #fed7d7;
  color: #e53e3e;
}

.action-btn-danger:hover {
  background: #fed7d7;
  border-color: #e53e3e;
  color: #c53030;
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8f9fa;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.pagination-btn:disabled {
  background: #f1f3f4;
  border-color: #e0e0e0;
  color: #9e9e9e;
  cursor: not-allowed;
}

.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 6px;
  background: #f8f9fa;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #e9ecef;
  border-color: #dc3545;
  color: #dc3545;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.filters-section {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.filters-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 20px;
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.filter-input,
.filter-select {
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}

/* 修复select下拉箭头样式 */
.filter-select,
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23666' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

.filter-select:focus,
.form-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 确保表单元素有正确的背景和文字颜色 */
.form-input,
.form-textarea,
.form-select {
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}

/* 修复可能的白色背景配白色文字问题 */
.form-input:not([readonly]),
.form-textarea:not([readonly]),
.filter-input:not([readonly]) {
  background: #ffffff;
  color: #333333;
  border: 1px solid #d1d5db;
}

.form-input:not([readonly]):focus,
.form-textarea:not([readonly]):focus,
.filter-input:not([readonly]):focus {
  background: #ffffff;
  color: #333333;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 确保只读输入框有明显的视觉区别 */
.form-input[readonly],
.api-key-input[readonly] {
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #dee2e6;
}

/* 确保按钮文字颜色正确 */
.btn {
  color: inherit;
}

.btn-primary {
  background: var(--primary-color);
  color: #ffffff;
  border: 1px solid var(--primary-color);
}

.btn-secondary {
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #dee2e6;
}

.btn-secondary:hover {
  background: #e9ecef;
  color: #495057;
  border-color: var(--primary-color);
}

/* 确保状态徽章有足够的对比度 */
.status-active {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-inactive {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.status-expired {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23666' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

.api-key-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 6px 0 0 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 600;
}

.logs-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-secondary);
  gap: 12px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-primary);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.logs-list {
  padding: 8px;
}

.log-item {
  padding: 12px;
  border-bottom: 1px solid var(--border-primary);
  transition: background-color 0.2s ease;
}

.log-item:hover {
  background: var(--bg-tertiary);
}

.log-item:last-child {
  border-bottom: none;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.log-method {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.method-get {
  background: #e3f2fd;
  color: #1976d2;
}

.method-post {
  background: #e8f5e8;
  color: #388e3c;
}

.method-put {
  background: #fff3e0;
  color: #f57c00;
}

.method-delete {
  background: #ffebee;
  color: #d32f2f;
}

.log-endpoint {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
}

.log-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-2 {
  background: #e8f5e8;
  color: #388e3c;
}

.status-3 {
  background: #fff3e0;
  color: #f57c00;
}

.status-4,
.status-5 {
  background: #ffebee;
  color: #d32f2f;
}

.log-details {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.log-time {
  font-weight: 500;
}

.log-ip {
  font-family: 'Courier New', monospace;
}

.log-response-time {
  font-weight: 500;
  color: var(--primary-color);
}

.logs-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.pagination-info {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.api-keys-section {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 24px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-primary);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.api-keys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.api-key-card {
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  background: var(--bg-secondary);
}

.api-key-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-inactive {
  opacity: 0.7;
  background: var(--bg-tertiary);
}

.card-expired {
  border-color: var(--error-color);
  background: var(--error-bg);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.card-title-section {
  flex: 1;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-active {
  background: var(--success-bg);
  color: var(--success-color);
}

.status-inactive {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.status-expired {
  background: var(--error-bg);
  color: var(--error-color);
}

.card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  background: var(--bg-tertiary);
}

.action-btn-danger:hover {
  background: var(--error-bg);
  border-color: var(--error-color);
  color: var(--error-color);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.card-content {
  border-top: 1px solid var(--border-secondary);
  padding-top: 16px;
}

.card-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
}

.info-label {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 70px;
}

.info-value {
  color: var(--text-secondary);
  flex: 1;
}

.text-danger {
  color: var(--error-color);
}

.permissions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.permission-tag {
  display: inline-block;
  padding: 2px 6px;
  background: var(--primary-bg);
  color: var(--primary-color);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.permission-more {
  display: inline-block;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 4px;
  font-size: 11px;
}

.pagination-section {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 14px;
  color: var(--text-secondary);
}

/* 模态框样式 */
.modal-overlay {
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
  padding: 20px;
}

.modal {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-large {
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid var(--border-primary);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s ease;
}

.modal-close:hover {
  background: var(--bg-tertiary);
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-help {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.text-warning {
  color: var(--warning-color);
}

.permissions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.permission-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.permission-checkbox:hover {
  background: var(--bg-tertiary);
}

.permission-checkbox input[type="checkbox"] {
  margin: 0;
  margin-top: 2px;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-label strong {
  font-size: 14px;
  color: var(--text-primary);
}

.checkbox-label small {
  font-size: 12px;
  color: var(--text-secondary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-primary);
}

/* 详情页面样式 */
.detail-section {
  margin-bottom: 32px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-primary);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
}

.api-key-display {
  display: flex;
  gap: 12px;
  align-items: center;
}

.api-key-input {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  background: var(--bg-secondary);
}

.permissions-display {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ip-tag {
  display: inline-block;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .api-key-manager {
    padding: 16px;
  }

  .manager-header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .api-keys-grid {
    grid-template-columns: 1fr;
  }

  .modal {
    margin: 10px;
    max-width: none;
  }

  .permissions-grid {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .api-key-display {
    flex-direction: column;
    align-items: stretch;
  }
}

/* 成功模态框样式 */
.success-message {
  text-align: center;
  margin-bottom: 32px;
  padding: 24px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  color: white;
}

.success-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-icon svg {
  width: 32px;
  height: 32px;
  stroke-width: 3;
}

.success-message h4 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.success-message p {
  font-size: 14px;
  margin: 0;
  opacity: 0.9;
}

.api-key-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
  padding: 12px;
  border-radius: 6px;
  width: 100%;
}

.api-key-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>