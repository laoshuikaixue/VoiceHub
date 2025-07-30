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
          <button @click="showCreateModal = false" class="action-btn secondary">取消</button>
          <button @click="createBackup" class="action-btn primary" :disabled="createLoading">
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
          <button @click="showUploadModal = false" class="action-btn secondary">取消</button>
          <button
            @click="uploadFile"
            class="action-btn primary"
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

    console.log('服务器响应:', response)

    if (response.success && response.backup) {
      const { backup } = response
      
      // 强制进行浏览器下载
      let dataToDownload
      
      if (backup.downloadMode === 'direct' && backup.data) {
        // 直接下载模式：服务器返回了完整数据
        dataToDownload = backup.data
        console.log('使用直接下载模式')
        
        // 创建并下载文件
        try {
          const dataStr = JSON.stringify(dataToDownload, null, 2)
          const blob = new Blob([dataStr], { 
            type: 'application/json;charset=utf-8' 
          })
          
          // 创建下载链接
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = backup.filename
          link.style.display = 'none'
          
          // 添加到DOM，点击，然后移除
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          // 清理URL对象
          URL.revokeObjectURL(url)
          
          // 显示成功消息
          const sizeText = backup.size ? ` (${formatFileSize(backup.size)})` : ''
          showNotification(`备份文件已下载: ${backup.filename}${sizeText}`, 'success')
          
          console.log('✅ 文件下载成功:', backup.filename)
        } catch (downloadError) {
          console.error('下载失败:', downloadError)
          showNotification('文件下载失败: ' + downloadError.message, 'error')
        }
      } else if (backup.downloadMode === 'file' && backup.filename) {
        // 文件下载模式：通过API下载文件
        console.log('使用文件下载模式')
        
        try {
          // 使用 $fetch 进行认证请求，然后创建下载
          const response = await $fetch(`/api/admin/backup/download?filename=${encodeURIComponent(backup.filename)}`, {
            method: 'GET'
          })
          
          // 创建 Blob 并下载
          const blob = new Blob([response], {
            type: 'application/json'
          })
          
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = backup.filename
          link.style.display = 'none'
          
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          URL.revokeObjectURL(url)
          
          // 显示成功消息
          const sizeText = backup.size ? ` (${formatFileSize(backup.size)})` : ''
          showNotification(`备份文件已下载: ${backup.filename}${sizeText}`, 'success')
          
          console.log('✅ 文件下载成功:', backup.filename)
        } catch (downloadError) {
          console.error('文件下载失败:', downloadError)
          showNotification('文件下载失败: ' + downloadError.message, 'error')
        }
      } else {
        console.error('无效的下载模式或缺少数据')
        showNotification('备份创建失败：无效的响应格式', 'error')
        showCreateModal.value = false
        return
      }
    } else {
      console.error('服务器响应格式错误:', response)
      showNotification('备份创建失败：服务器响应格式错误', 'error')
    }
    
    showCreateModal.value = false
  } catch (error) {
    console.error('创建备份失败:', error)
    const errorMessage = error.data?.message || error.message || '未知错误'
    showNotification('创建备份失败: ' + errorMessage, 'error')
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
  // 创建通知元素
  const notification = document.createElement('div')
  notification.className = `notification ${type}`
  notification.textContent = message
  
  // 添加到body
  document.body.appendChild(notification)
  
  // 自动移除
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out'
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 4000)
}
</script>

<style scoped>
.backup-manager {
  padding: 20px;
  background: var(--bg-primary) !important;
  min-height: 100vh;
  color: #e2e8f0;
  position: relative;
  z-index: 1;
}

/* 覆盖全局背景 */
.backup-manager::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary) !important;
  z-index: -1;
}

.header {
  margin-bottom: 32px;
  text-align: center;
}

.header h3 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.header .description {
  color: #94a3b8;
  font-size: 16px;
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.action-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  text-align: center;
}

.action-card:hover {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}

.action-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: #6366f1;
}

.action-card h4 {
  font-size: 20px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0 0 8px 0;
}

.action-card p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.action-btn {
  width: 100%;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
}

.action-btn.primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.action-btn.primary:hover {
  background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
}

.action-btn.secondary {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
}

.action-btn.secondary:hover {
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(100, 116, 139, 0.4);
}

.action-btn:disabled {
  background: #374151 !important;
  color: #6b7280 !important;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #1e293b;
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 20px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32px 32px 0 32px;
  margin-bottom: 24px;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(71, 85, 105, 0.3);
  color: #f8fafc;
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 0 32px 32px 32px;
}

.modal-footer {
  padding: 24px 32px;
  border-top: 1px solid rgba(71, 85, 105, 0.3);
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 0;
}

/* 表单样式 */
.form-group {
  margin-bottom: 28px;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 12px;
  font-size: 15px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: rgba(30, 41, 59, 0.6);
  border: 2px solid rgba(71, 85, 105, 0.5);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.radio-option:hover {
  background: rgba(51, 65, 85, 0.6);
  border-color: rgba(99, 102, 241, 0.7);
  transform: translateY(-1px);
}

.radio-option input[type="radio"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #64748b;
  border-radius: 50%;
  background: transparent;
  margin: 2px 0 0 0;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
}

.radio-option input[type="radio"]:checked {
  border-color: #6366f1;
  background: #6366f1;
}

.radio-option input[type="radio"]:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
}

.radio-option input[type="radio"]:checked + span {
  color: #f8fafc;
  font-weight: 600;
}

.radio-option span {
  font-weight: 500;
  color: #e2e8f0;
  font-size: 15px;
  transition: all 0.3s ease;
}

.radio-option small {
  display: block;
  color: #94a3b8;
  font-size: 13px;
  margin-top: 6px;
  line-height: 1.4;
}

.checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: rgba(30, 41, 59, 0.6);
  border: 2px solid rgba(71, 85, 105, 0.5);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.checkbox-option:hover {
  background: rgba(51, 65, 85, 0.6);
  border-color: rgba(99, 102, 241, 0.7);
  transform: translateY(-1px);
}

.checkbox-option.danger {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.1);
}

.checkbox-option.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.7);
}

.checkbox-option input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #64748b;
  border-radius: 4px;
  background: transparent;
  margin: 2px 0 0 0;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
}

.checkbox-option input[type="checkbox"]:checked {
  border-color: #6366f1;
  background: #6366f1;
}

.checkbox-option input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.checkbox-option.danger input[type="checkbox"]:checked {
  border-color: #ef4444;
  background: #ef4444;
}

.checkbox-option input[type="checkbox"]:checked + span {
  color: #f8fafc;
  font-weight: 600;
}

.checkbox-option span {
  font-weight: 500;
  color: #e2e8f0;
  font-size: 15px;
  transition: all 0.3s ease;
}

.checkbox-option small {
  display: block;
  color: #94a3b8;
  font-size: 13px;
  margin-top: 6px;
  line-height: 1.4;
}

/* 文件上传区域 */
.upload-section {
  margin-bottom: 32px;
}

.upload-area {
  border: 2px dashed rgba(71, 85, 105, 0.5);
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  background: rgba(30, 41, 59, 0.4);
  transition: all 0.3s ease;
  cursor: pointer;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
}

.upload-area svg {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  color: #6366f1;
  transition: all 0.3s ease;
}

.upload-area:hover svg,
.upload-area.drag-over svg {
  color: #8b5cf6;
  transform: scale(1.1);
}

.upload-area h4 {
  color: #e2e8f0;
  font-weight: 600;
  font-size: 18px;
  margin-bottom: 8px;
}

.upload-area p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
}

/* 文件信息 */
.selected-file {
  margin-bottom: 32px;
}

.file-info {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.file-info svg {
  width: 24px;
  height: 24px;
  color: #6366f1;
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  color: #e2e8f0;
  font-weight: 500;
  font-size: 15px;
}

.file-size {
  color: #94a3b8;
  font-size: 13px;
}

.remove-file-btn {
  background: rgba(239, 68, 68, 0.2);
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #f87171;
  flex-shrink: 0;
}

.remove-file-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.remove-file-btn svg {
  width: 16px;
  height: 16px;
  color: inherit;
}

/* 警告框 */
.warning-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 32px;
}

.warning-box svg {
  width: 24px;
  height: 24px;
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-box > div {
  flex: 1;
}

.warning-box h4 {
  color: #f59e0b;
  font-weight: 600;
  margin: 0 0 8px 0;
  font-size: 15px;
}

.warning-box p {
  color: #fbbf24;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}



/* 通知样式 */
.notification {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 16px 24px;
  border-radius: 12px;
  color: white;
  font-weight: 500;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  z-index: 1001;
  animation: slideInRight 0.3s ease-out;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 300px;
  max-width: 500px;
}

.notification::before {
  content: '';
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.notification.success::before {
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'%3E%3C/path%3E%3C/svg%3E") no-repeat center;
  background-size: 16px;
}

.notification.error::before {
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'%3E%3C/path%3E%3C/svg%3E") no-repeat center;
  background-size: 16px;
}

.notification.warning::before {
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'%3E%3C/path%3E%3C/svg%3E") no-repeat center;
  background-size: 16px;
}

.notification.info::before {
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'%3E%3C/path%3E%3C/svg%3E") no-repeat center;
  background-size: 16px;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideOutRight {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

.notification.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.notification.error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.notification.warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.notification.info {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
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
    margin: 16px;
    max-width: calc(100vw - 32px);
    border-radius: 16px;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 24px;
  }
  
  .modal-footer {
    flex-direction: column;
    gap: 12px;
  }
  
  .modal-footer button {
    width: 100%;
  }
  
  .notification {
    left: 16px;
    right: 16px;
    top: 16px;
  }
}
</style>
