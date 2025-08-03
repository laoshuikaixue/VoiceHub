<template>
  <div class="database-manager">
    <!-- 标题 -->
    <div class="header">
      <h3>数据库操作</h3>
      <p class="description">数据库备份、恢复和重置操作</p>
    </div>

    <!-- 操作卡片网格 -->
    <div class="operations-grid">
      <!-- 创建备份 -->
      <div class="operation-card">
        <div class="card-icon backup-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>创建备份</h4>
          <p>导出当前数据库数据</p>
          <button @click="showCreateModal = true" class="action-btn primary" :disabled="createLoading">
            <span v-if="createLoading">创建中...</span>
            <span v-else>创建备份</span>
          </button>
        </div>
      </div>

      <!-- 恢复备份 -->
      <div class="operation-card">
        <div class="card-icon restore-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/>
            <polyline points="17,14 12,9 7,14"/>
            <line x1="12" y1="9" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>恢复备份</h4>
          <p>从备份文件恢复数据</p>
          <button @click="showUploadModal = true" class="action-btn secondary" :disabled="uploadLoading">
            <span v-if="uploadLoading">恢复中...</span>
            <span v-else>选择文件</span>
          </button>
        </div>
      </div>

      <!-- 重置数据库 -->
      <div class="operation-card danger">
        <div class="card-icon reset-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>重置数据库</h4>
          <p>清空所有数据（危险操作）</p>
          <button @click="showResetModal = true" class="action-btn danger" :disabled="resetLoading">
            <span v-if="resetLoading">重置中...</span>
            <span v-else>重置数据库</span>
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
            <label class="checkbox-option">
              <input type="checkbox" v-model="createForm.includeSongs" />
              <span>包含歌曲数据</span>
              <small>包含所有歌曲和投稿记录</small>
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-option">
              <input type="checkbox" v-model="createForm.includeUsers" />
              <span>包含用户数据</span>
              <small>包含用户账户和权限信息</small>
            </label>
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

    <!-- 恢复备份模态框 -->
    <div v-if="showUploadModal" class="modal-overlay" @click="showUploadModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>恢复数据库备份</h3>
          <button @click="showUploadModal = false" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="upload-area" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="handleFileDrop">
            <div class="upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <div class="upload-text">
              <p v-if="!selectedFile">点击选择备份文件或拖拽到此处</p>
              <p v-else class="selected-file">{{ selectedFile.name }}</p>
            </div>
            <input ref="fileInput" type="file" accept=".json" @change="handleFileSelect" style="display: none;">
          </div>
          
          <div class="form-group">
            <label>恢复模式</label>
            <select v-model="restoreForm.mode" class="form-select">
              <option value="merge">合并模式（保留现有数据）</option>
              <option value="replace">替换模式（清空后恢复）</option>
            </select>
          </div>

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
        </div>
        <div class="modal-footer">
          <button @click="showUploadModal = false" class="action-btn secondary">取消</button>
          <button @click="restoreBackup" class="action-btn primary" :disabled="uploadLoading || !selectedFile">
            <span v-if="uploadLoading">恢复中...</span>
            <span v-else>开始恢复</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 重置数据库模态框 -->
    <div v-if="showResetModal" class="modal-overlay" @click="showResetModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>重置数据库</h3>
          <button @click="showResetModal = false" class="close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="danger-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <h4>危险操作警告</h4>
              <p>此操作将永久删除数据库中的所有内容，包括：</p>
              <ul>
                <li>所有歌曲和投稿记录</li>
                <li>所有用户账户（除当前管理员）</li>
                <li>所有排期和播放记录</li>
                <li>所有通知和黑名单数据</li>
              </ul>
              <p><strong style="color: #F44336;">此操作不可撤销！</strong></p>
            </div>
          </div>
          
          <div class="form-group reset-confirm-group">
            <label>请输入 "CONFIRM-DATABASE-RESET-OPERATION" 确认操作</label>
            <input 
              v-model="resetConfirmText" 
              type="text" 
              class="form-input" 
              placeholder="输入 CONFIRM-DATABASE-RESET-OPERATION 确认"
              @input="resetConfirmText = $event.target.value.toUpperCase()"
            >
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showResetModal = false" class="action-btn secondary">取消</button>
          <button 
            @click="resetDatabase" 
            class="action-btn danger" 
            :disabled="resetLoading || resetConfirmText !== 'CONFIRM-DATABASE-RESET-OPERATION'"
          >
            <span v-if="resetLoading">重置中...</span>
            <span v-else>确认重置</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 响应式数据
const showCreateModal = ref(false)
const showUploadModal = ref(false)
const showResetModal = ref(false)
const createLoading = ref(false)
const uploadLoading = ref(false)
const resetLoading = ref(false)
const selectedFile = ref(null)
const resetConfirmText = ref('')

// 表单数据
const createForm = ref({
  includeSongs: true,
  includeUsers: true,
  includeSystemData: true
})

const restoreForm = ref({
  mode: 'merge'
})

// 文件选择处理
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
  } else {
    showNotification('请选择有效的JSON备份文件', 'error')
  }
}

// 拖拽文件处理
const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
  } else {
    showNotification('请选择有效的JSON备份文件', 'error')
  }
}

// 创建备份
const createBackup = async () => {
  createLoading.value = true
  try {
    const response = await $fetch('/api/admin/backup/create', {
      method: 'POST',
      body: {
        includeSongs: createForm.value.includeSongs,
        includeUsers: createForm.value.includeUsers,
        includeSystemData: createForm.value.includeSystemData,
        downloadMode: true
      }
    })

    if (response.success && response.downloadData) {
      // 创建下载链接
      const blob = new Blob([response.downloadData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showNotification('备份文件已下载', 'success')
      showCreateModal.value = false
    } else {
      throw new Error(response.message || '备份创建失败')
    }
  } catch (error) {
    console.error('创建备份失败:', error)
    showNotification('创建备份失败: ' + error.message, 'error')
  } finally {
    createLoading.value = false
  }
}

// 恢复备份
const restoreBackup = async () => {
  if (!selectedFile.value) {
    showNotification('请选择备份文件', 'error')
    return
  }

  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('mode', restoreForm.value.mode)
    formData.append('clearExisting', restoreForm.value.mode === 'replace')

    const response = await $fetch('/api/admin/backup/restore', {
      method: 'POST',
      body: formData
    })

    if (response.success) {
      showNotification('数据恢复完成', 'success')
      showUploadModal.value = false
      selectedFile.value = null
      
      // 刷新页面以反映数据变化
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } else {
      throw new Error(response.message || '数据恢复失败')
    }
  } catch (error) {
    console.error('恢复备份失败:', error)
    showNotification('恢复备份失败: ' + error.message, 'error')
  } finally {
    uploadLoading.value = false
  }
}

// 重置数据库
const resetDatabase = async () => {
  if (resetConfirmText.value !== 'CONFIRM-DATABASE-RESET-OPERATION') {
    showNotification('请输入 CONFIRM-DATABASE-RESET-OPERATION 确认操作', 'error')
    return
  }

  resetLoading.value = true
  try {
    const response = await $fetch('/api/admin/database/reset', {
      method: 'POST'
    })

    if (response.success) {
      showNotification('数据库重置完成', 'success')
      showResetModal.value = false
      resetConfirmText.value = ''
      
      // 刷新页面
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } else {
      throw new Error(response.message || '数据库重置失败')
    }
  } catch (error) {
    console.error('重置数据库失败:', error)
    showNotification('重置数据库失败: ' + error.message, 'error')
  } finally {
    resetLoading.value = false
  }
}

// 显示通知
const showNotification = (message, type = 'info') => {
  const notification = document.createElement('div')
  notification.className = `notification ${type}`
  notification.innerHTML = `
    <div class="notification-content">
      <span>${message}</span>
    </div>
  `
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.classList.add('show')
  }, 100)
  
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 4000)
}
</script>

<style scoped>
/* 主容器 */
.database-manager {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* 标题区域 */
.header {
  margin-bottom: 2rem;
}

.header h3 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 24px;
  color: #FFFFFF;
  margin: 0 0 0.5rem 0;
}

.description {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

/* 操作网格 */
.operations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

/* 操作卡片 */
.operation-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.operation-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.operation-card.danger {
  border-color: rgba(244, 67, 54, 0.3);
}

.operation-card.danger:hover {
  border-color: rgba(244, 67, 54, 0.5);
}

/* 卡片图标 */
.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.backup-icon {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

.restore-icon {
  background: rgba(33, 150, 243, 0.2);
  color: #2196F3;
}

.reset-icon {
  background: rgba(244, 67, 54, 0.2);
  color: #F44336;
}

.card-icon svg {
  width: 24px;
  height: 24px;
}

/* 卡片内容 */
.card-content h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: #FFFFFF;
  margin: 0 0 0.5rem 0;
}

.card-content p {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 1rem 0;
}

/* 按钮样式 */
.action-btn {
  background: transparent;
  border: 1px solid;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.action-btn.primary {
  border-color: #0B5AFE;
  color: #0B5AFE;
}

.action-btn.primary:hover:not(:disabled) {
  background: #0B5AFE;
  color: #FFFFFF;
}

.action-btn.secondary {
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
}

.action-btn.secondary:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.5);
  color: #FFFFFF;
}

.action-btn.danger {
  border-color: #F44336;
  color: #F44336;
}

.action-btn.danger:hover:not(:disabled) {
  background: #F44336;
  color: #FFFFFF;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 模态框样式 */
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
  padding: 1rem;
}

.modal {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: #FFFFFF;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.close-btn:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.1);
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* 表单样式 */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #FFFFFF;
  margin-bottom: 0.5rem;
}

.checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.75rem;
  border-radius: 8px;
  transition: background 0.3s ease;
}

.checkbox-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.checkbox-option input[type="checkbox"] {
  margin: 0;
  accent-color: #0B5AFE;
}

.checkbox-option span {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #FFFFFF;
}

.checkbox-option small {
  display: block;
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.25rem;
}

.form-select,
.form-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 14px;
  color: #FFFFFF;
  transition: border-color 0.3s ease;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #0B5AFE;
}

/* 上传区域 */
.upload-area {
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 1.5rem;
}

.upload-area:hover {
  border-color: #0B5AFE;
  background: rgba(11, 90, 254, 0.05);
}

.upload-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.upload-icon svg {
  width: 100%;
  height: 100%;
}

.upload-text p {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.selected-file {
  color: #0B5AFE !important;
  font-weight: 500 !important;
}

/* 警告框 */
.warning-box,
.danger-warning {
  display: flex;
  gap: 1rem;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.danger-warning {
  background: rgba(244, 67, 54, 0.1);
  border-color: rgba(244, 67, 54, 0.3);
}

.warning-box svg,
.danger-warning svg {
  width: 20px;
  height: 20px;
  color: #FF9800;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.danger-warning svg {
  color: #F44336;
}

.warning-box h4,
.danger-warning h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #FFFFFF;
  margin: 0 0 0.5rem 0;
}

.warning-box p,
.danger-warning p {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  line-height: 1.5;
}

.danger-warning ul {
  margin: 0.5rem 0;
  padding-left: 1rem;
}

.danger-warning li {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.25rem;
}

/* 重置确认输入框特殊样式 */
.reset-confirm-group {
  margin-top: 2rem !important;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.reset-confirm-group label {
  font-size: 15px !important;
  font-weight: 600 !important;
  color: #F44336 !important;
  margin-bottom: 1rem !important;
}

/* 通知样式 */
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #333;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #0B5AFE;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 1001;
  max-width: 400px;
}

.notification.show {
  transform: translateX(0);
}

.notification.success {
  border-left-color: #4CAF50;
}

.notification.error {
  border-left-color: #F44336;
}

.notification.warning {
  border-left-color: #FF9800;
}

.notification-content {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .operations-grid {
    grid-template-columns: 1fr;
  }
  
  .modal {
    margin: 1rem;
    max-width: calc(100% - 2rem);
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>