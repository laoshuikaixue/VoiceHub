<template>
  <div class="backup-manager">
    <!-- 标题 -->
    <div class="header">
      <h3>数据库备份</h3>
      <p class="description">导出和导入数据库备份</p>
    </div>

    <!-- 主要功能区 -->
    <div class="actions-grid">
      <div class="action-card">
        <div class="action-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>导出备份</h4>
          <p>创建数据库备份文件</p>
          <button @click="showCreateModal = true" class="action-btn primary" :disabled="createLoading">
            <span v-if="createLoading">导出中...</span>
            <span v-else>开始导出</span>
          </button>
        </div>
      </div>

      <div class="action-card">
        <div class="action-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>导入备份</h4>
          <p>从备份文件恢复数据</p>
          <button @click="showUploadModal = true" class="action-btn secondary" :disabled="uploadLoading">
            <span v-if="uploadLoading">导入中...</span>
            <span v-else>选择文件</span>
          </button>
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

    <!-- 导入备份模态框 -->
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

          <div class="warning-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <h4>注意</h4>
              <p>导入备份将会影响现有数据，请确保您了解操作的后果。</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showUploadModal = false" class="cancel-btn">取消</button>
          <button
            @click="uploadFile"
            class="confirm-btn"
            :disabled="!selectedFile || uploadLoading || (restoreForm.mode === 'replace' && !restoreForm.clearExisting)"
          >
            <span v-if="uploadLoading">导入中...</span>
            <span v-else>开始导入</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 响应式数据
const createLoading = ref(false)
const uploadLoading = ref(false)
const showCreateModal = ref(false)
const showUploadModal = ref(false)
const selectedFile = ref(null)
const isDragOver = ref(false)

// 表单数据
const createForm = ref({
  tables: 'all',
  includeSystemData: true
})

const restoreForm = ref({
  mode: 'merge',
  clearExisting: false
})

// 创建备份
const createBackup = async () => {
  createLoading.value = true
  try {
    const response = await $fetch('/api/admin/backup/export', {
      method: 'POST',
      body: {
        tables: createForm.value.tables,
        includeSystemData: createForm.value.includeSystemData
      }
    })

    if (response.downloadMode === 'direct') {
      // 直接下载模式（无服务器环境）
      const dataStr = JSON.stringify(response.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = response.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      showNotification('备份已下载', 'success')
    } else {
      // 传统文件模式
      showNotification('备份创建成功', 'success')
    }
    
    showCreateModal.value = false
  } catch (error) {
    console.error('创建备份失败:', error)
    showNotification('创建备份失败: ' + (error.data?.message || error.message), 'error')
  } finally {
    createLoading.value = false
  }
}

// 文件选择处理
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
  }
}

// 拖拽处理
const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer.files
  if (files.length > 0) {
    selectedFile.value = files[0]
  }
}

// 上传文件
const uploadFile = async () => {
  if (!selectedFile.value) return
  
  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('mode', restoreForm.value.mode)
    formData.append('clearExisting', restoreForm.value.clearExisting)

    const response = await $fetch('/api/admin/backup/restore', {
      method: 'POST',
      body: formData
    })

    showNotification('备份导入成功', 'success')
    showUploadModal.value = false
    selectedFile.value = null
    restoreForm.value = { mode: 'merge', clearExisting: false }
  } catch (error) {
    console.error('导入备份失败:', error)
    showNotification('导入备份失败: ' + (error.data?.message || error.message), 'error')
  } finally {
    uploadLoading.value = false
  }
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 显示通知
const showNotification = (message, type = 'info') => {
  // 这里可以集成你的通知系统
  console.log(`${type}: ${message}`)
  alert(message) // 临时使用 alert，可以替换为更好的通知组件
}
</script>

<style scoped>
.backup-manager {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: #1f2937;
  color: #f9fafb;
  border-radius: 12px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h3 {
  font-size: 24px;
  font-weight: 600;
  color: #f9fafb;
  margin: 0 0 8px 0;
}

.description {
  color: #9ca3af;
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 40px;
}

.action-card {
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.2s ease;
}

.action-card:hover {
  background: #4b5563;
  border-color: #6b7280;
  transform: translateY(-2px);
}

.action-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: #3b82f6;
}

.action-card h4 {
  font-size: 18px;
  font-weight: 600;
  color: #f9fafb;
  margin: 0 0 8px 0;
}

.action-card p {
  color: #9ca3af;
  margin: 0 0 20px 0;
  font-size: 14px;
  line-height: 1.5;
}

.action-btn {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.action-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.action-btn:disabled {
  background: #6b7280;
  cursor: not-allowed;
  transform: none;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 24px 24px 0;
  border-bottom: 1px solid #374151;
  margin-bottom: 24px;
}

.modal-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: #f9fafb;
  margin: 0 0 8px 0;
}

.modal-header p {
  color: #9ca3af;
  margin: 0 0 24px 0;
  font-size: 14px;
}

.modal-content {
  padding: 0 24px;
}

.modal-footer {
  padding: 24px;
  border-top: 1px solid #374151;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

/* 表单样式 */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 500;
  color: #f9fafb;
  margin-bottom: 8px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-option:hover {
  background: #4b5563;
  border-color: #6b7280;
}

.radio-option input[type="radio"] {
  margin: 0;
  accent-color: #3b82f6;
}

.radio-option span {
  font-weight: 500;
  color: #f9fafb;
}

.radio-option small {
  display: block;
  color: #9ca3af;
  font-size: 12px;
  margin-top: 4px;
}

.checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox-option:hover {
  background: #4b5563;
  border-color: #6b7280;
}

.checkbox-option.danger {
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.checkbox-option.danger:hover {
  background: rgba(220, 38, 38, 0.2);
}

.checkbox-option input[type="checkbox"] {
  margin: 0;
  accent-color: #3b82f6;
}

.checkbox-option span {
  font-weight: 500;
  color: #f9fafb;
}

.checkbox-option small {
  display: block;
  color: #9ca3af;
  font-size: 12px;
  margin-top: 4px;
}

/* 文件上传区域 */
.upload-area {
  border: 2px dashed #4b5563;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  background: #374151;
  transition: all 0.2s ease;
  cursor: pointer;
  margin-bottom: 20px;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.upload-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: #6b7280;
}

.upload-area:hover .upload-icon,
.upload-area.drag-over .upload-icon {
  color: #3b82f6;
}

.upload-text {
  color: #f9fafb;
  font-weight: 500;
  margin-bottom: 8px;
}

.upload-hint {
  color: #9ca3af;
  font-size: 14px;
}

.file-input {
  display: none;
}

/* 文件信息 */
.file-info {
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.file-info h4 {
  color: #f9fafb;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.file-details {
  display: flex;
  justify-content: space-between;
  color: #9ca3af;
  font-size: 14px;
}

/* 警告框 */
.warning-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.warning-box svg {
  width: 20px;
  height: 20px;
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-box h4 {
  color: #f59e0b;
  font-weight: 600;
  margin: 0 0 4px 0;
  font-size: 14px;
}

.warning-box p {
  color: #fbbf24;
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}

/* 按钮样式 */
.cancel-btn {
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #4b5563;
}

.confirm-btn {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-btn:hover {
  background: #2563eb;
}

.confirm-btn:disabled {
  background: #6b7280;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .backup-manager {
    padding: 16px;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .modal {
    margin: 20px;
    max-width: calc(100vw - 40px);
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .modal-footer button {
    width: 100%;
  }
}
</style>
