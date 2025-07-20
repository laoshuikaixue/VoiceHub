<template>
  <div class="backup-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>数据库备份管理</h3>
        <p class="toolbar-description">创建、管理和恢复数据库备份</p>
      </div>
      <div class="toolbar-right">
        <button @click="showCreateModal = true" class="create-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          创建备份
        </button>
        <button @click="showUploadModal = true" class="upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          导入备份
        </button>
        <button @click="refreshBackups" class="refresh-btn" :disabled="loading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,4 23,10 17,10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="backups.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      <h4>暂无备份文件</h4>
      <p>点击"创建备份"按钮开始创建数据库备份</p>
    </div>

    <!-- 备份列表 -->
    <div v-else class="backup-list">
      <div v-for="backup in backups" :key="backup.filename" class="backup-item">
        <div class="backup-header">
          <div class="backup-info">
            <div class="backup-title">
              <span class="backup-type" :class="backup.type">
                {{ backup.type === 'full' ? '完整备份' : '用户备份' }}
              </span>
              <span class="backup-filename">{{ backup.filename }}</span>
              <span v-if="!backup.isValid" class="backup-status invalid">格式错误</span>
            </div>
            <div class="backup-meta">
              <span class="backup-size">{{ formatFileSize(backup.size) }}</span>
              <span class="backup-date">{{ formatDate(backup.createdAt) }}</span>
              <span v-if="backup.metadata" class="backup-records">
                {{ backup.metadata.totalRecords }} 条记录
              </span>
            </div>
          </div>
          <div class="backup-actions">
            <button
              @click="downloadBackup(backup.filename)"
              class="action-btn download-btn"
              title="下载备份"
              :disabled="actionLoading"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button
              v-if="backup.isValid"
              @click="showRestoreModal(backup)"
              class="action-btn restore-btn"
              title="恢复备份"
              :disabled="actionLoading"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23,4 23,10 17,10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button
              @click="deleteBackup(backup.filename)"
              class="action-btn delete-btn"
              title="删除备份"
              :disabled="actionLoading"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- 备份详情 -->
        <div v-if="backup.metadata" class="backup-details">
          <div class="detail-item">
            <span class="detail-label">创建者:</span>
            <span class="detail-value">{{ backup.metadata.creator }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">描述:</span>
            <span class="detail-value">{{ backup.metadata.description }}</span>
          </div>
          <div v-if="backup.metadata.tables" class="detail-item">
            <span class="detail-label">包含表:</span>
            <div class="table-list">
              <span 
                v-for="table in backup.metadata.tables" 
                :key="table.name" 
                class="table-tag"
              >
                {{ table.description || table.name }} ({{ table.recordCount }})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建备份模态框 -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>创建数据库备份</h3>
          <button @click="showCreateModal = false" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>备份类型</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" v-model="createForm.tables" value="all" />
                <span>完整备份（推荐）</span>
                <small>备份所有数据表</small>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="createForm.tables" value="users" />
                <span>仅用户数据</span>
                <small>只备份用户相关数据</small>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-option">
              <input type="checkbox" v-model="createForm.includeSystemData" />
              <span>包含系统设置</span>
              <small>包含系统配置和设置数据</small>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showCreateModal = false" class="cancel-btn">取消</button>
          <button @click="createBackup" class="confirm-btn" :disabled="createLoading">
            <span v-if="createLoading">创建中...</span>
            <span v-else>创建备份</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 恢复备份模态框 -->
    <div v-if="showRestoreModalFlag" class="modal-overlay" @click="showRestoreModalFlag = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>恢复数据库备份</h3>
          <button @click="showRestoreModalFlag = false" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="warning-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <h4>注意</h4>
              <p>恢复备份将会影响现有数据，请确保您了解操作的后果。</p>
            </div>
          </div>
          
          <div class="backup-info-box">
            <h4>备份信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">文件名:</span>
                <span class="info-value">{{ selectedBackup?.filename }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间:</span>
                <span class="info-value">{{ formatDate(selectedBackup?.createdAt) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">记录数:</span>
                <span class="info-value">{{ selectedBackup?.metadata?.totalRecords || 'N/A' }}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>恢复模式</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" v-model="restoreForm.mode" value="merge" />
                <span>合并模式（推荐）</span>
                <small>更新现有记录，添加新记录</small>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="restoreForm.mode" value="replace" />
                <span>替换模式</span>
                <small>先清空数据，然后导入备份</small>
              </label>
            </div>
          </div>
          
          <div v-if="restoreForm.mode === 'replace'" class="form-group">
            <label class="checkbox-option danger">
              <input type="checkbox" v-model="restoreForm.clearExisting" />
              <span>我确认要清空现有数据</span>
              <small>此操作不可逆，请谨慎操作</small>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showRestoreModalFlag = false" class="cancel-btn">取消</button>
          <button 
            @click="restoreBackup" 
            class="confirm-btn danger" 
            :disabled="restoreLoading || (restoreForm.mode === 'replace' && !restoreForm.clearExisting)"
          >
            <span v-if="restoreLoading">恢复中...</span>
            <span v-else>确认恢复</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 上传备份模态框 -->
    <div v-if="showUploadModal" class="modal-overlay" @click="showUploadModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>导入备份文件</h3>
          <button @click="showUploadModal = false" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="upload-section">
            <div class="upload-area" :class="{ 'drag-over': isDragOver }"
                 @drop="handleDrop"
                 @dragover.prevent="isDragOver = true"
                 @dragleave="isDragOver = false"
                 @click="$refs.fileInput.click()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <h4>选择或拖拽备份文件</h4>
              <p>支持 .json 格式的备份文件，最大 100MB</p>
              <input
                ref="fileInput"
                type="file"
                accept=".json,application/json"
                @change="handleFileSelect"
                style="display: none"
              />
            </div>

            <div v-if="selectedFile" class="selected-file">
              <div class="file-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
                <div class="file-details">
                  <span class="file-name">{{ selectedFile.name }}</span>
                  <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
                </div>
              </div>
              <button @click="selectedFile = null" class="remove-file-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="warning-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <h4>注意</h4>
              <p>上传的备份文件将被保存到服务器，您可以在文件列表中查看和管理。</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showUploadModal = false" class="cancel-btn">取消</button>
          <button
            @click="uploadFile"
            class="confirm-btn"
            :disabled="!selectedFile || uploadLoading"
          >
            <span v-if="uploadLoading">上传中...</span>
            <span v-else>上传文件</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteConfirm" class="confirm-dialog-backdrop" @click.self="cancelDelete">
      <div class="confirm-dialog">
        <div class="confirm-dialog-header">
          <h3>确认删除</h3>
        </div>
        <div class="confirm-dialog-content">
          <p>确定要删除备份文件 <strong>"{{ deleteTarget }}"</strong> 吗？</p>
          <p class="warning-text">此操作不可逆，删除后无法恢复。</p>
        </div>
        <div class="confirm-dialog-actions">
          <button
            @click="cancelDelete"
            class="confirm-dialog-btn confirm-dialog-cancel"
          >
            取消
          </button>
          <button
            @click="confirmDelete"
            class="confirm-dialog-btn confirm-dialog-confirm"
            :disabled="actionLoading"
          >
            {{ actionLoading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 响应式数据
const backups = ref([])
const loading = ref(false)
const actionLoading = ref(false)
const createLoading = ref(false)
const restoreLoading = ref(false)

const showCreateModal = ref(false)
const showRestoreModalFlag = ref(false)
const showUploadModal = ref(false)
const showDeleteConfirm = ref(false)
const selectedBackup = ref(null)
const selectedFile = ref(null)
const isDragOver = ref(false)
const uploadLoading = ref(false)
const deleteTarget = ref(null)

// 消息提示
const message = ref('')
const messageType = ref('') // 'success', 'error', 'warning'
const showMessage = ref(false)

const createForm = ref({
  tables: 'all',
  includeSystemData: true
})

const restoreForm = ref({
  mode: 'merge',
  clearExisting: false
})

// 服务
let adminService = null

// 方法
const refreshBackups = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/backup/list', {
      ...useAuth().getAuthHeader()
    })
    backups.value = response.backups || []
  } catch (error) {
    console.error('获取备份列表失败:', error)
    if (window.$showNotification) {
      window.$showNotification('获取备份列表失败', 'error')
    }
  } finally {
    loading.value = false
  }
}

const createBackup = async () => {
  createLoading.value = true
  try {
    const response = await $fetch('/api/admin/backup/export', {
      method: 'POST',
      body: createForm.value,
      ...useAuth().getAuthHeader()
    })

    if (window.$showNotification) {
      window.$showNotification('备份创建成功', 'success')
    }
    showCreateModal.value = false
    await refreshBackups()
  } catch (error) {
    console.error('创建备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification(error.data?.message || '创建备份失败', 'error')
    }
  } finally {
    createLoading.value = false
  }
}

const downloadBackup = async (filename) => {
  actionLoading.value = true
  try {
    // 创建下载链接
    const response = await fetch(`/api/admin/backup/download/${filename}`, {
      headers: useAuth().getAuthHeader().headers
    })

    if (!response.ok) {
      throw new Error('下载失败')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    if (window.$showNotification) {
      window.$showNotification('下载开始', 'success')
    }
  } catch (error) {
    console.error('下载备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification('下载备份失败', 'error')
    }
  } finally {
    actionLoading.value = false
  }
}

const showRestoreModal = (backup) => {
  selectedBackup.value = backup
  restoreForm.value = {
    mode: 'merge',
    clearExisting: false
  }
  showRestoreModalFlag.value = true
}

const restoreBackup = async () => {
  restoreLoading.value = true
  try {
    const response = await $fetch('/api/admin/backup/restore', {
      method: 'POST',
      body: {
        filename: selectedBackup.value.filename,
        mode: restoreForm.value.mode,
        clearExisting: restoreForm.value.clearExisting
      },
      ...useAuth().getAuthHeader()
    })

    if (response.success) {
      if (window.$showNotification) {
        window.$showNotification('数据恢复成功', 'success')
      }
      if (response.details?.errors?.length > 0) {
        if (window.$showNotification) {
          window.$showNotification(`恢复完成，但有 ${response.details.errors.length} 个错误`, 'warning')
        }
      }
    } else {
      if (window.$showNotification) {
        window.$showNotification(response.message || '数据恢复失败', 'error')
      }
    }

    showRestoreModalFlag.value = false
  } catch (error) {
    console.error('恢复备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification(error.data?.message || '恢复备份失败', 'error')
    }
  } finally {
    restoreLoading.value = false
  }
}

const deleteBackup = (filename) => {
  deleteTarget.value = filename
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return

  actionLoading.value = true
  try {
    await $fetch(`/api/admin/backup/delete/${deleteTarget.value}`, {
      method: 'DELETE',
      ...useAuth().getAuthHeader()
    })

    if (window.$showNotification) {
      window.$showNotification('备份文件删除成功', 'success')
    }
    await refreshBackups()
  } catch (error) {
    console.error('删除备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除备份失败', 'error')
    }
  } finally {
    actionLoading.value = false
    showDeleteConfirm.value = false
    deleteTarget.value = null
  }
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    validateAndSetFile(file)
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false

  const files = event.dataTransfer.files
  if (files.length > 0) {
    validateAndSetFile(files[0])
  }
}

const validateAndSetFile = (file) => {
  // 验证文件类型
  if (!file.name.endsWith('.json')) {
    if (window.$showNotification) {
      window.$showNotification('请选择 JSON 格式的备份文件', 'error')
    }
    return
  }

  // 验证文件大小 (100MB)
  if (file.size > 100 * 1024 * 1024) {
    if (window.$showNotification) {
      window.$showNotification('文件大小不能超过 100MB', 'error')
    }
    return
  }

  selectedFile.value = file
}

const uploadFile = async () => {
  if (!selectedFile.value) {
    if (window.$showNotification) {
      window.$showNotification('请选择要上传的文件', 'error')
    }
    return
  }

  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const response = await fetch('/api/admin/backup/upload', {
      method: 'POST',
      body: formData,
      headers: useAuth().getAuthHeader().headers
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || '上传失败')
    }

    const result = await response.json()
    if (window.$showNotification) {
      window.$showNotification('备份文件上传成功', 'success')
    }

    // 关闭模态框并刷新列表
    showUploadModal.value = false
    selectedFile.value = null
    await refreshBackups()
  } catch (error) {
    console.error('上传备份文件失败:', error)
    if (window.$showNotification) {
      window.$showNotification(error.message || '上传备份文件失败', 'error')
    }
  } finally {
    uploadLoading.value = false
  }
}

// 工具方法
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('zh-CN')
}

// 生命周期
onMounted(async () => {
  adminService = useAdmin()
  await refreshBackups()
})
</script>

<style scoped>
.backup-manager {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: #111111;
  border-radius: 12px;
  border: 1px solid #1f1f1f;
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
  flex-wrap: wrap;
  gap: 16px;
}

.toolbar-left h3 {
  margin: 0 0 4px 0;
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
}

.toolbar-description {
  margin: 0;
  color: #888888;
  font-size: 14px;
}

.toolbar-right {
  display: flex;
  gap: 12px;
}

.create-btn, .upload-btn, .refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-btn {
  background: #4f46e5;
  color: white;
}

.create-btn:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
}

.upload-btn {
  background: #059669;
  color: white;
}

.upload-btn:hover:not(:disabled) {
  background: #047857;
  transform: translateY(-1px);
}

.refresh-btn {
  background: #374151;
  color: #d1d5db;
}

.refresh-btn:hover:not(:disabled) {
  background: #4b5563;
}

.create-btn svg, .upload-btn svg, .refresh-btn svg {
  width: 16px;
  height: 16px;
}

/* 状态 */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #888888;
}

.loading-state .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333333;
  border-top: 3px solid #4f46e5;
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
  color: #555555;
}

.empty-state h4 {
  margin: 0 0 8px 0;
  color: #cccccc;
  font-size: 18px;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  color: #888888;
  font-size: 14px;
}

/* 备份列表 */
.backup-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.backup-item {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.backup-item:hover {
  border-color: #3a3a3a;
  transform: translateY(-1px);
}

.backup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  gap: 16px;
}

.backup-info {
  flex: 1;
  min-width: 0;
}

.backup-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.backup-type {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.backup-type.full {
  background: #065f46;
  color: #10b981;
}

.backup-type.users {
  background: #1e3a8a;
  color: #3b82f6;
}

.backup-filename {
  color: #e5e7eb;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  letter-spacing: 0.025em;
  word-break: break-all;
  line-height: 1.4;
}

.backup-status.invalid {
  padding: 2px 6px;
  background: #7f1d1d;
  color: #ef4444;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.backup-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #888888;
  font-size: 13px;
  flex-wrap: wrap;
}

.backup-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.download-btn {
  background: #065f46;
  color: #10b981;
}

.download-btn:hover:not(:disabled) {
  background: #047857;
}

.restore-btn {
  background: #1e3a8a;
  color: #3b82f6;
}

.restore-btn:hover:not(:disabled) {
  background: #1e40af;
}

.delete-btn {
  background: #7f1d1d;
  color: #ef4444;
}

.delete-btn:hover:not(:disabled) {
  background: #991b1b;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 备份详情 */
.backup-details {
  padding: 0 20px 20px 20px;
  border-top: 1px solid #2a2a2a;
  margin-top: 16px;
  padding-top: 16px;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: #888888;
  font-size: 13px;
  font-weight: 500;
  min-width: 60px;
  flex-shrink: 0;
}

.detail-value {
  color: #cccccc;
  font-size: 13px;
  flex: 1;
}

.table-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-tag {
  padding: 2px 6px;
  background: #374151;
  color: #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: linear-gradient(145deg, #1a1a1a 0%, #1f1f1f 100%);
  border: 1px solid #3a3a3a;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffffff 0%, #e5e7eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  background: rgba(255, 255, 255, 0.01);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px 24px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
}

.cancel-btn, .confirm-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.confirm-btn {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #4338ca 0%, #5b21b6 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
}

.confirm-btn.danger {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.confirm-btn.danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 表单 */
.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option, .checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #111111;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-option:hover, .checkbox-option:hover {
  border-color: #3a3a3a;
  background: #1a1a1a;
}

.radio-option input, .checkbox-option input {
  margin: 0;
  flex-shrink: 0;
}

.radio-option span, .checkbox-option span {
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
}

.radio-option small, .checkbox-option small {
  display: block;
  color: #888888;
  font-size: 12px;
  margin-top: 4px;
}

.checkbox-option.danger span {
  color: #ef4444;
}

.checkbox-option.danger small {
  color: #dc2626;
}

/* 信息框 */
.warning-box, .backup-info-box {
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.warning-box {
  background: #7f1d1d;
  border: 1px solid #991b1b;
  display: flex;
  gap: 12px;
}

.warning-box svg {
  width: 20px;
  height: 20px;
  color: #fbbf24;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-box h4 {
  margin: 0 0 4px 0;
  color: #fbbf24;
  font-size: 14px;
  font-weight: 600;
}

.warning-box p {
  margin: 0;
  color: #fecaca;
  font-size: 13px;
}

.backup-info-box {
  background: #1e3a8a;
  border: 1px solid #1e40af;
}

.backup-info-box h4 {
  margin: 0 0 12px 0;
  color: #93c5fd;
  font-size: 14px;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  color: #93c5fd;
  font-size: 12px;
  font-weight: 500;
}

.info-value {
  color: #dbeafe;
  font-size: 13px;
  font-family: 'Courier New', monospace;
}

/* 上传区域 */
.upload-section {
  margin-bottom: 20px;
}

.upload-area {
  border: 2px dashed #4b5563;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.02);
}

.upload-area:hover, .upload-area.drag-over {
  border-color: #059669;
  background: rgba(5, 150, 105, 0.05);
}

.upload-area svg {
  width: 48px;
  height: 48px;
  color: #6b7280;
  margin-bottom: 16px;
}

.upload-area h4 {
  margin: 0 0 8px 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.upload-area p {
  margin: 0;
  color: #9ca3af;
  font-size: 14px;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #1e3a8a;
  border: 1px solid #1e40af;
  border-radius: 8px;
  margin-top: 16px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-info svg {
  width: 24px;
  height: 24px;
  color: #3b82f6;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  color: #dbeafe;
  font-weight: 500;
  font-size: 14px;
}

.file-size {
  color: #93c5fd;
  font-size: 12px;
}

.remove-file-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-file-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

.remove-file-btn svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .backup-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .backup-actions {
    align-self: flex-end;
  }

  .upload-area {
    padding: 30px 15px;
  }

  .selected-file {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .remove-file-btn {
    align-self: flex-end;
  }
}

/* 确认对话框样式 */
.confirm-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease-out;
}

.confirm-dialog {
  background: linear-gradient(145deg, #1a1a1a 0%, #1f1f1f 100%);
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  width: 90%;
  max-width: 420px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  animation: slideIn 0.3s ease-out;
}

.confirm-dialog-header {
  padding: 20px 20px 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-dialog-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffffff 0%, #e5e7eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.confirm-dialog-content {
  padding: 20px;
  color: #cccccc;
  line-height: 1.6;
}

.confirm-dialog-content p {
  margin: 0 0 12px 0;
}

.confirm-dialog-content p:last-child {
  margin-bottom: 0;
}

.confirm-dialog-content strong {
  color: #ffffff;
  font-weight: 600;
}

.warning-text {
  color: #fbbf24 !important;
  font-size: 14px;
  font-weight: 500;
}

.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
}

.confirm-dialog-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.confirm-dialog-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.confirm-dialog-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.confirm-dialog-confirm {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.confirm-dialog-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
}

.confirm-dialog-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
}

@media (max-width: 480px) {
  .confirm-dialog {
    width: 95%;
    margin: 20px;
  }

  .confirm-dialog-actions {
    flex-direction: column;
    gap: 8px;
  }

  .confirm-dialog-btn {
    width: 100%;
  }
}
</style>
