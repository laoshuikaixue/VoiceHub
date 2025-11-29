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
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" x2="12" y1="15" y2="3"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>创建备份</h4>
          <p>导出当前数据库数据</p>
          <button :disabled="createLoading" class="action-btn primary" @click="showCreateModal = true">
            <span v-if="createLoading">创建中...</span>
            <span v-else>创建备份</span>
          </button>
        </div>
      </div>

      <!-- 恢复备份 -->
      <div class="operation-card">
        <div class="card-icon restore-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/>
            <polyline points="17,14 12,9 7,14"/>
            <line x1="12" x2="12" y1="9" y2="21"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>恢复备份</h4>
          <p>从备份文件恢复数据</p>
          <button :disabled="uploadLoading" class="action-btn secondary" @click="showUploadModal = true">
            <span v-if="uploadLoading">恢复中...</span>
            <span v-else>选择文件</span>
          </button>
        </div>
      </div>

      <!-- 重置序列 -->
      <div class="operation-card">
        <div class="card-icon sequence-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M3 12h18m-9-9l9 9-9 9"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>重置序列</h4>
          <p>修复数据表的自增序列</p>
          <button :disabled="sequenceLoading" class="action-btn warning" @click="showSequenceModal = true">
            <span v-if="sequenceLoading">重置中...</span>
            <span v-else>重置序列</span>
          </button>
        </div>
      </div>

      <!-- 重置数据库 -->
      <div class="operation-card danger">
        <div class="card-icon reset-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" x2="12" y1="9" y2="13"/>
            <line x1="12" x2="12.01" y1="17" y2="17"/>
          </svg>
        </div>
        <div class="card-content">
          <h4>重置数据库</h4>
          <p>清空所有数据（危险操作）</p>
          <button :disabled="resetLoading" class="action-btn danger" @click="showResetModal = true">
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
          <button class="close-btn" @click="showCreateModal = false">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="checkbox-option">
              <input v-model="createForm.includeSongs" type="checkbox"/>
              <span>包含歌曲数据</span>
              <small>包含所有歌曲和投稿记录</small>
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-option">
              <input v-model="createForm.includeUsers" type="checkbox"/>
              <span>包含用户数据</span>
              <small>包含用户账户和权限信息</small>
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-option">
              <input v-model="createForm.includeSystemData" type="checkbox"/>
              <span>包含系统设置</span>
              <small>包含系统配置和设置数据</small>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showCreateModal = false">取消</button>
          <button :disabled="createLoading" class="action-btn primary" @click="createBackup">
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
          <button class="close-btn" @click="showUploadModal = false">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="upload-area" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="handleFileDrop">
            <div class="upload-icon">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" x2="8" y1="13" y2="13"/>
                <line x1="16" x2="8" y1="17" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <div class="upload-text">
              <p v-if="!selectedFile">点击选择备份文件或拖拽到此处</p>
              <p v-else class="selected-file">{{ selectedFile.name }}</p>
            </div>
            <input ref="fileInput" accept=".json" style="display: none;" type="file" @change="handleFileSelect">
          </div>

          <div class="form-group">
            <label>恢复模式</label>
            <select v-model="restoreForm.mode" class="form-select">
              <option value="merge">合并模式（保留现有数据）</option>
              <option value="replace">替换模式（清空后恢复）</option>
            </select>
          </div>

          <div class="warning-box">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" x2="12" y1="9" y2="13"/>
              <line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
            <div>
              <h4>注意</h4>
              <p>恢复备份将会影响现有数据，请确保您了解操作的后果。</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showUploadModal = false">取消</button>
          <button :disabled="uploadLoading || !selectedFile" class="action-btn primary" @click="restoreBackup">
            <span v-if="uploadLoading">{{ restoreProgress || '恢复中...' }}</span>
            <span v-else>开始恢复</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 重置序列模态框 -->
    <div v-if="showSequenceModal" class="modal-overlay" @click="showSequenceModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>重置数据表序列</h3>
          <button class="close-btn" @click="showSequenceModal = false">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择要重置序列的数据表</label>
            <select v-model="sequenceForm.table" class="form-select">
              <option value="">请选择数据表</option>
              <option value="all">重置所有表 (All)</option>
              <option value="Song">歌曲表 (Song)</option>
              <option value="User">用户表 (User)</option>
              <option value="Vote">投票表 (Vote)</option>
              <option value="Schedule">排期表 (Schedule)</option>
              <option value="Notification">通知表 (Notification)</option>
              <option value="NotificationSettings">通知设置表 (NotificationSettings)</option>
              <option value="PlayTime">播放时段表 (PlayTime)</option>
              <option value="Semester">学期表 (Semester)</option>
              <option value="SystemSettings">系统设置表 (SystemSettings)</option>
              <option value="SongBlacklist">歌曲黑名单表 (SongBlacklist)</option>
            </select>
          </div>

          <div class="info-box">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path d="l 4,-6 2,0 0,-2 -2,0 z"/>
              <path d="l 4,2 2,0 0,6 -2,0 z"/>
            </svg>
            <div>
              <h4>说明</h4>
              <p>重置序列将修复数据表的自增ID序列，确保新记录的ID从正确的值开始。</p>
              <p>此操作不会影响现有数据，只会调整序列的下一个值。</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showSequenceModal = false">取消</button>
          <button :disabled="sequenceLoading || !sequenceForm.table" class="action-btn warning" @click="resetSequence">
            <span v-if="sequenceLoading">重置中...</span>
            <span v-else>重置序列</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 重置数据库模态框 -->
    <div v-if="showResetModal" class="modal-overlay" @click="showResetModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>重置数据库</h3>
          <button class="close-btn" @click="showResetModal = false">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/>
              <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="danger-warning">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" x2="12" y1="9" y2="13"/>
              <line x1="12" x2="12.01" y1="17" y2="17"/>
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
                class="form-input"
                placeholder="输入 CONFIRM-DATABASE-RESET-OPERATION 确认"
                type="text"
                @input="resetConfirmText = $event.target.value.toUpperCase()"
            >
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showResetModal = false">取消</button>
          <button
              :disabled="resetLoading || resetConfirmText !== 'CONFIRM-DATABASE-RESET-OPERATION'"
              class="action-btn danger"
              @click="resetDatabase"
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
import {ref} from 'vue'
import {useAuth} from '~/composables/useAuth'

// 响应式数据
const showCreateModal = ref(false)
const showUploadModal = ref(false)
const showResetModal = ref(false)
const showSequenceModal = ref(false)
const createLoading = ref(false)
const uploadLoading = ref(false)
const resetLoading = ref(false)
const sequenceLoading = ref(false)
const selectedFile = ref(null)
const resetConfirmText = ref('')
const restoreProgress = ref('')

// 表单数据
const createForm = ref({
  includeSongs: true,
  includeUsers: true,
  includeSystemData: true
})

const restoreForm = ref({
  mode: 'merge'
})

const sequenceForm = ref({
  table: ''
})

// 文件选择处理
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
  } else {
    if (window.$showNotification) {
      window.$showNotification('请选择有效的JSON备份文件', 'error')
    }
  }
}

// 拖拽文件处理
const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
  } else {
    if (window.$showNotification) {
      window.$showNotification('请选择有效的JSON备份文件', 'error')
    }
  }
}

// 创建备份
const createBackup = async () => {
  createLoading.value = true
  try {
    const response = await $fetch('/api/admin/backup/export', {
      method: 'POST',
      body: {
        tables: createForm.value.includeUsers && createForm.value.includeSongs ? 'all' :
            createForm.value.includeUsers ? 'users' : 'all',
        includeSystemData: createForm.value.includeSystemData
      }
    })

    if (response.success && response.backup) {
      // 处理直接下载模式
      if (response.backup.downloadMode === 'direct' && response.backup.data) {
        // 创建下载链接
        const blob = new Blob([JSON.stringify(response.backup.data, null, 2)], {type: 'application/json'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = response.backup.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        if (window.$showNotification) {
          window.$showNotification('备份文件已下载', 'success')
        }
        showCreateModal.value = false
      } else if (response.backup.downloadMode === 'file' && response.backup.filename) {
        // 处理文件模式，通过下载API获取文件
        try {
          // 使用fetch直接获取文件，以便正确处理二进制数据
          const downloadUrl = `/api/admin/backup/download/${response.backup.filename}`
          const downloadResponse = await fetch(downloadUrl, {
            method: 'GET',
            credentials: 'include'
          })

          if (!downloadResponse.ok) {
            throw new Error(`下载失败: ${downloadResponse.status}`)
          }

          // 获取文件内容
          const blob = await downloadResponse.blob()

          // 创建下载链接
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = response.backup.filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)

          if (window.$showNotification) {
            window.$showNotification('备份文件已下载', 'success')
          }
          showCreateModal.value = false
        } catch (downloadError) {
          console.error('下载备份文件失败:', downloadError)
          if (window.$showNotification) {
            window.$showNotification('下载备份文件失败: ' + downloadError.message, 'error')
          }
        }
      } else {
        if (window.$showNotification) {
          window.$showNotification('备份创建成功', 'success')
        }
        showCreateModal.value = false
      }
    } else {
      throw new Error(response.message || '备份创建失败')
    }
  } catch (error) {
    console.error('创建备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification('创建备份失败: ' + error.message, 'error')
    }
  } finally {
    createLoading.value = false
  }
}

// 恢复备份
const restoreBackup = async () => {
  if (!selectedFile.value) {
    if (window.$showNotification) {
      window.$showNotification('请选择备份文件', 'error')
    }
    return
  }

  uploadLoading.value = true
  restoreProgress.value = '正在读取文件...'
  
  try {
    // 1. 读取并解析文件
    const fileContent = await selectedFile.value.text()
    let backupData
    try {
      backupData = JSON.parse(fileContent)
    } catch (e) {
      throw new Error('无法解析备份文件，文件格式不正确')
    }

    if (!backupData.data) {
      throw new Error('备份文件缺少数据部分')
    }

    // 2. 如果是替换模式，先清空现有数据
    if (restoreForm.value.mode === 'replace') {
      restoreProgress.value = '正在清空现有数据...'
      const clearResult = await $fetch('/api/admin/backup/clear', {
        method: 'POST'
      })
      if (!clearResult.success) {
        throw new Error(clearResult.message || '清空数据失败')
      }
    }

    // 3. 定义恢复顺序
    const tableOrder = [
      'users',
      'systemSettings',
      'semesters',
      'playTimes',
      'songs',
      'votes',
      'schedules',
      'notificationSettings',
      'notifications',
      'songBlacklist',
      'userStatusLogs'
    ]

    // 4. 初始化映射对象
    const mappings = {
      users: {},
      songs: {}
    }

    // 5. 按顺序恢复表数据
    const CHUNK_SIZE = 50
    let totalProcessed = 0
    
    // 计算总记录数用于进度显示
    let totalRecords = 0
    for (const tableName of tableOrder) {
      if (backupData.data[tableName] && Array.isArray(backupData.data[tableName])) {
        totalRecords += backupData.data[tableName].length
      }
    }

    for (const tableName of tableOrder) {
      const records = backupData.data[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) {
        continue
      }

      console.log(`开始恢复表 ${tableName}, 共 ${records.length} 条记录`)
      
      // 分块处理
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE)
        const progressPercent = Math.round((totalProcessed / totalRecords) * 100)
        restoreProgress.value = `正在恢复 ${tableName} (${i + 1}-${Math.min(i + CHUNK_SIZE, records.length)}/${records.length}) ${progressPercent}%`

        const response = await $fetch('/api/admin/backup/restore-chunk', {
          method: 'POST',
          body: {
            tableName,
            records: chunk,
            mappings,
            mode: restoreForm.value.mode
          }
        })

        if (response.success) {
          // 更新ID映射
          if (response.newMappings) {
            if (response.newMappings.users) {
              Object.assign(mappings.users, response.newMappings.users)
            }
            if (response.newMappings.songs) {
              Object.assign(mappings.songs, response.newMappings.songs)
            }
          }
          totalProcessed += chunk.length
        } else {
          console.error(`恢复块失败 (${tableName}):`, response)
          throw new Error(response.message || `恢复表 ${tableName} 失败`)
        }
      }
    }

    // 6. 修复数据库序列
    restoreProgress.value = '正在修复数据库序列...'
    try {
      const fixSequenceResult = await $fetch('/api/admin/fix-sequence', {
        method: 'POST',
        body: {
          table: 'all'
        }
      })
      
      if (!fixSequenceResult.success) {
        console.warn('序列修复部分失败:', fixSequenceResult.message)
        if (window.$showNotification) {
          window.$showNotification('数据恢复成功，但部分表序列修复失败，建议手动执行"重置序列"', 'warning')
        }
      }
    } catch (seqError) {
      console.error('序列修复失败:', seqError)
      if (window.$showNotification) {
        window.$showNotification('数据恢复成功，但自动修复序列失败，请务必手动执行"重置序列"', 'warning')
      }
    }

    restoreProgress.value = '恢复完成'

    // 显示成功通知
    if (window.$showNotification) {
      window.$showNotification('数据恢复成功！', 'success')

      // 显示即将重定向的通知
      setTimeout(() => {
        window.$showNotification('数据库恢复完成，3秒后将返回首页重新登录', 'info')
      }, 1500)
    }

    // 清除认证状态并重定向到首页
    setTimeout(() => {
      const {logout} = useAuth()
      if (logout) {
        logout()
      }
      // 清除本地存储的认证信息
      localStorage.removeItem('auth-token')
      localStorage.removeItem('user-info')

      // 重定向到首页
      window.location.href = '/'
    }, 4500)

    // 关闭模态框并重置表单
    showUploadModal.value = false
    selectedFile.value = null
    
  } catch (error) {
    console.error('恢复备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification('恢复备份失败: ' + error.message, 'error')
    }
  } finally {
    uploadLoading.value = false
    restoreProgress.value = ''
  }
}

// 重置数据库
const resetDatabase = async () => {
  if (resetConfirmText.value !== 'CONFIRM-DATABASE-RESET-OPERATION') {
    if (window.$showNotification) {
      window.$showNotification('请输入 CONFIRM-DATABASE-RESET-OPERATION 确认操作', 'error')
    }
    return
  }

  resetLoading.value = true
  try {
    const response = await $fetch('/api/admin/database/reset', {
      method: 'POST'
    })

    if (response.success) {
      // 关闭模态框并重置表单
      showResetModal.value = false
      resetConfirmText.value = ''

      // 显示成功通知
      if (window.$showNotification) {
        window.$showNotification('数据库重置成功！', 'success')

        // 显示即将重定向的通知
        setTimeout(() => {
          window.$showNotification('数据库重置完成，3秒后将返回首页重新登录', 'info')
        }, 1500)
      }

      // 清除认证状态并重定向到首页
      setTimeout(() => {
        const {logout} = useAuth()
        if (logout) {
          logout()
        }
        // 清除本地存储的认证信息
        localStorage.removeItem('auth-token')
        localStorage.removeItem('user-info')

        // 重定向到首页
        window.location.href = '/'
      }, 4500)
    } else {
      throw new Error(response.message || '数据库重置失败')
    }
  } catch (error) {
    console.error('重置数据库失败:', error)
    if (window.$showNotification) {
      window.$showNotification('重置数据库失败: ' + error.message, 'error')
    }
  } finally {
    resetLoading.value = false
  }
}

// 重置序列
const resetSequence = async () => {
  if (!sequenceForm.value.table) {
    if (window.$showNotification) {
      window.$showNotification('请选择要重置序列的数据表', 'error')
    }
    return
  }

  sequenceLoading.value = true
  const selectedTable = sequenceForm.value.table

  try {
    const response = await $fetch('/api/admin/fix-sequence', {
      method: 'POST',
      body: {
        table: selectedTable
      }
    })

    if (response.success) {
      // 关闭模态框并重置表单
      showSequenceModal.value = false
      sequenceForm.value.table = ''

      // 显示成功通知
      if (window.$showNotification) {
        const successMessage = selectedTable === 'all'
            ? '所有表的序列重置成功！'
            : `${selectedTable}表的序列重置成功！`
        window.$showNotification(successMessage, 'success')
      }
    } else {
      throw new Error(response.error || '序列重置失败')
    }
  } catch (error) {
    console.error('重置序列失败:', error)
    if (window.$showNotification) {
      window.$showNotification('重置序列失败: ' + error.message, 'error')
    }
  } finally {
    sequenceLoading.value = false
  }
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

.sequence-icon {
  background: rgba(255, 193, 7, 0.2);
  color: #FFC107;
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

.action-btn.warning {
  border-color: #FFC107;
  color: #FFC107;
}

.action-btn.warning:hover:not(:disabled) {
  background: #FFC107;
  color: #000000;
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

/* 信息框样式 */
.info-box {
  display: flex;
  gap: 1rem;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-box svg {
  width: 20px;
  height: 20px;
  color: #2196F3;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-box h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #FFFFFF;
  margin: 0 0 0.5rem 0;
}

.info-box p {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.25rem 0;
  line-height: 1.5;
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