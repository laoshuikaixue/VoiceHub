<template>
  <div class="scheduled-backup-manager">
    <!-- 标题 -->
    <div class="header">
      <h3>定时备份</h3>
      <p class="description">设置自动数据库备份计划，支持上传到 S3 或 WebDAV</p>
    </div>

    <!-- 操作按钮 -->
    <div class="actions-bar">
      <button class="action-btn primary" @click="openCreateModal">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <line x1="12" x2="12" y1="5" y2="19" />
          <line x1="5" x2="19" y1="12" y2="12" />
        </svg>
        新建调度
      </button>
    </div>

    <!-- 调度列表 -->
    <div class="schedules-list">
      <div v-if="loading" class="loading-state">
        <p>加载中...</p>
      </div>

      <div v-else-if="schedules.length === 0" class="empty-state">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
        <h4>暂无备份调度</h4>
        <p>点击上方按钮创建第一个定时备份任务</p>
      </div>

      <div v-else class="schedule-cards">
        <div
          v-for="schedule in schedules"
          :key="schedule.id"
          :class="['schedule-card', { disabled: !schedule.enabled }]"
        >
          <div class="schedule-header">
            <div class="schedule-info">
              <h4>{{ schedule.name }}</h4>
              <span :class="['status-badge', schedule.enabled ? 'active' : 'inactive']">
                {{ schedule.enabled ? '已启用' : '已禁用' }}
              </span>
            </div>
            <div class="schedule-actions">
              <button class="icon-btn" title="立即执行" @click="runNow(schedule.id)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </button>
              <button class="icon-btn" title="编辑" @click="openEditModal(schedule)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="icon-btn danger" title="删除" @click="confirmDelete(schedule)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          <div class="schedule-details">
            <div class="detail-item">
              <span class="label">调度类型:</span>
              <span class="value">{{ getScheduleTypeText(schedule.scheduleType) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">执行时间:</span>
              <span class="value">{{ getScheduleTimeText(schedule) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">备份类型:</span>
              <span class="value">{{ schedule.backupType === 'all' ? '完整备份' : '仅用户数据' }}</span>
            </div>
            <div v-if="schedule.uploadEnabled" class="detail-item">
              <span class="label">上传目标:</span>
              <span class="value">{{ schedule.uploadType === 's3' ? 'S3 存储' : 'WebDAV' }}</span>
            </div>
            <div v-if="schedule.retentionType" class="detail-item">
              <span class="label">保留策略:</span>
              <span class="value">
                {{ schedule.retentionType === 'days' ? `保留 ${schedule.retentionValue} 天` : `保留 ${schedule.retentionValue} 个` }}
              </span>
            </div>
            <div v-if="schedule.nextRun" class="detail-item">
              <span class="label">下次执行:</span>
              <span class="value">{{ formatDateTime(schedule.nextRun) }}</span>
            </div>
          </div>

          <div class="schedule-toggle">
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="schedule.enabled"
                @change="toggleSchedule(schedule.id, !schedule.enabled)"
              >
              <span class="slider" />
            </label>
            <span>{{ schedule.enabled ? '启用中' : '已停用' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑模态框 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑备份调度' : '新建备份调度' }}</h3>
          <button class="close-btn" @click="closeModal">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- 基本信息 -->
          <div class="form-section">
            <h4>基本信息</h4>
            <div class="form-group">
              <label>调度名称 *</label>
              <input v-model="formData.name" type="text" placeholder="例如：每日凌晨备份" >
            </div>
          </div>

          <!-- 调度设置 -->
          <div class="form-section">
            <h4>调度设置</h4>
            <div class="form-group">
              <label>调度类型 *</label>
              <div class="radio-group">
                <label class="radio-option">
                  <input v-model="formData.scheduleType" type="radio" value="daily" >
                  <span>每日</span>
                </label>
                <label class="radio-option">
                  <input v-model="formData.scheduleType" type="radio" value="weekly" >
                  <span>每周</span>
                </label>
                <label class="radio-option">
                  <input v-model="formData.scheduleType" type="radio" value="monthly" >
                  <span>每月</span>
                </label>
                <label class="radio-option">
                  <input v-model="formData.scheduleType" type="radio" value="cron" >
                  <span>自定义 Cron</span>
                </label>
              </div>
            </div>

            <!-- 每日调度时间 -->
            <div v-if="formData.scheduleType === 'daily'" class="form-group">
              <label>执行时间</label>
              <input v-model="formData.scheduleTime" type="time" >
            </div>

            <!-- 每周调度 -->
            <div v-if="formData.scheduleType === 'weekly'" class="form-row">
              <div class="form-group">
                <label>执行时间</label>
                <input v-model="formData.scheduleTime" type="time" >
              </div>
              <div class="form-group">
                <label>每周星期</label>
                <select v-model="formData.scheduleDay">
                  <option :value="0">星期日</option>
                  <option :value="1">星期一</option>
                  <option :value="2">星期二</option>
                  <option :value="3">星期三</option>
                  <option :value="4">星期四</option>
                  <option :value="5">星期五</option>
                  <option :value="6">星期六</option>
                </select>
              </div>
            </div>

            <!-- 每月调度 -->
            <div v-if="formData.scheduleType === 'monthly'" class="form-row">
              <div class="form-group">
                <label>执行时间</label>
                <input v-model="formData.scheduleTime" type="time" >
              </div>
              <div class="form-group">
                <label>每月日期</label>
                <select v-model="formData.scheduleDay">
                  <option v-for="day in 31" :key="day" :value="day">{{ day }} 日</option>
                </select>
              </div>
            </div>

            <!-- Cron 表达式 -->
            <div v-if="formData.scheduleType === 'cron'" class="form-group">
              <label>Cron 表达式</label>
              <input v-model="formData.cronExpression" type="text" placeholder="例如: 0 2 * * * (每天凌晨2点)" >
              <small>格式: 分 时 日 月 周 (例如: 0 2 * * *)</small>
            </div>
          </div>

          <!-- 备份设置 -->
          <div class="form-section">
            <h4>备份设置</h4>
            <div class="form-group">
              <label>备份内容</label>
              <div class="radio-group">
                <label class="radio-option">
                  <input v-model="formData.backupType" type="radio" value="all" >
                  <span>完整备份</span>
                </label>
                <label class="radio-option">
                  <input v-model="formData.backupType" type="radio" value="users" >
                  <span>仅用户数据</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="checkbox-option">
                <input v-model="formData.includeSystemData" type="checkbox" >
                <span>包含系统设置</span>
              </label>
            </div>
          </div>

          <!-- 远程上传设置 -->
          <div class="form-section">
            <h4>远程上传 (可选)</h4>
            <div class="form-group">
              <label class="checkbox-option">
                <input v-model="formData.uploadEnabled" type="checkbox" >
                <span>启用自动上传</span>
              </label>
            </div>

            <div v-if="formData.uploadEnabled" class="upload-config">
              <div class="form-group">
                <label>上传方式</label>
                <div class="radio-group">
                  <label class="radio-option">
                    <input v-model="formData.uploadType" type="radio" value="s3" >
                    <span>S3 / 兼容存储</span>
                  </label>
                  <label class="radio-option">
                    <input v-model="formData.uploadType" type="radio" value="webdav" >
                    <span>WebDAV</span>
                  </label>
                </div>
              </div>

              <!-- S3 配置 -->
              <div v-if="formData.uploadType === 's3'" class="s3-config">
                <div class="form-group">
                  <label>Endpoint</label>
                  <input v-model="formData.s3Endpoint" type="text" placeholder="https://s3.example.com" >
                </div>
                <div class="form-group">
                  <label>Bucket 名称</label>
                  <input v-model="formData.s3Bucket" type="text" placeholder="my-backups" >
                </div>
                <div class="form-group">
                  <label>区域</label>
                  <input v-model="formData.s3Region" type="text" placeholder="us-east-1" >
                </div>
                <div class="form-group">
                  <label>Access Key</label>
                  <input v-model="formData.s3AccessKey" type="text" placeholder="AKIA..." >
                </div>
                <div class="form-group">
                  <label>Secret Key</label>
                  <input v-model="formData.s3SecretKey" type="password" placeholder="••••••••" >
                </div>
                <button type="button" class="action-btn secondary" :disabled="testingConnection" @click="testS3Connection">
                  {{ testingConnection ? '测试中...' : '测试连接' }}
                </button>
              </div>

              <!-- WebDAV 配置 -->
              <div v-if="formData.uploadType === 'webdav'" class="webdav-config">
                <div class="form-group">
                  <label>服务器 URL</label>
                  <input v-model="formData.webdavUrl" type="text" placeholder="https://webdav.example.com" >
                </div>
                <div class="form-group">
                  <label>用户名</label>
                  <input v-model="formData.webdavUsername" type="text" placeholder="username" >
                </div>
                <div class="form-group">
                  <label>密码</label>
                  <input v-model="formData.webdavPassword" type="password" placeholder="••••••••" >
                </div>
                <button type="button" class="action-btn secondary" :disabled="testingConnection" @click="testWebDAVConnection">
                  {{ testingConnection ? '测试中...' : '测试连接' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 保留策略 -->
          <div class="form-section">
            <h4>保留策略</h4>
            <div class="form-row">
              <div class="form-group">
                <label>保留方式</label>
                <select v-model="formData.retentionType">
                  <option value="">不限制</option>
                  <option value="days">按天数</option>
                  <option value="count">按数量</option>
                </select>
              </div>
              <div v-if="formData.retentionType" class="form-group">
                <label>{{ formData.retentionType === 'days' ? '保留天数' : '保留数量' }}</label>
                <input v-model.number="formData.retentionValue" type="number" min="1" >
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="action-btn secondary" @click="closeModal">取消</button>
          <button :disabled="saving" class="action-btn primary" @click="saveSchedule">
            <span v-if="saving">保存中...</span>
            <span v-else>{{ isEditing ? '保存修改' : '创建调度' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认模态框 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="showDeleteModal = false">
      <div class="modal delete-modal" @click.stop>
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="close-btn" @click="showDeleteModal = false">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p>确定要删除备份调度 "{{ scheduleToDelete?.name }}" 吗？</p>
          <p class="warning-text">此操作不可恢复</p>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showDeleteModal = false">取消</button>
          <button class="action-btn danger" @click="deleteSchedule">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 备份历史 -->
    <div class="history-section">
      <div class="section-header">
        <h4>备份历史</h4>
        <button class="action-btn secondary small" @click="loadHistory">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          刷新
        </button>
      </div>

      <div v-if="historyLoading" class="loading-state">
        <p>加载中...</p>
      </div>

      <div v-else-if="history.length === 0" class="empty-state small">
        <p>暂无备份记录</p>
      </div>

      <table v-else class="history-table">
        <thead>
          <tr>
            <th>文件名</th>
            <th>大小</th>
            <th>状态</th>
            <th>执行时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in history" :key="record.id">
            <td>{{ record.filename }}</td>
            <td>{{ formatFileSize(record.fileSize) }}</td>
            <td>
              <span :class="['status-badge', record.status]">
                {{ getStatusText(record.status) }}
              </span>
            </td>
            <td>{{ formatDateTime(record.executedAt) }}</td>
            <td>
              <button class="icon-btn small" title="删除" @click="deleteHistoryRecord(record.id)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const loading = ref(false)
const saving = ref(false)
const testingConnection = ref(false)
const historyLoading = ref(false)

const schedules = ref([])
const history = ref([])
const showModal = ref(false)
const showDeleteModal = ref(false)
const isEditing = ref(false)
const scheduleToDelete = ref(null)

const defaultFormData = () => ({
  name: '',
  enabled: true,
  scheduleType: 'daily',
  scheduleTime: '02:00',
  scheduleDay: 1,
  cronExpression: '',
  backupType: 'all',
  includeSystemData: true,
  uploadEnabled: false,
  uploadType: 's3',
  s3Endpoint: '',
  s3Bucket: '',
  s3Region: 'us-east-1',
  s3AccessKey: '',
  s3SecretKey: '',
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  retentionType: 'days',
  retentionValue: 7
})

const formData = ref(defaultFormData())
const editingId = ref(null)

const loadSchedules = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup')
    if (response.success) {
      schedules.value = response.data || []
    }
  } catch (error) {
    console.error('加载调度失败:', error)
    if (window.$showNotification) {
      window.$showNotification('加载调度失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup/history')
    if (response.success) {
      history.value = response.data || []
    }
  } catch (error) {
    console.error('加载历史失败:', error)
  } finally {
    historyLoading.value = false
  }
}

const openCreateModal = () => {
  formData.value = defaultFormData()
  isEditing.value = false
  editingId.value = null
  showModal.value = true
}

const openEditModal = (schedule) => {
  formData.value = {
    name: schedule.name,
    enabled: schedule.enabled,
    scheduleType: schedule.scheduleType,
    scheduleTime: schedule.scheduleTime || '02:00',
    scheduleDay: schedule.scheduleDay || 1,
    cronExpression: schedule.cronExpression || '',
    backupType: schedule.backupType,
    includeSystemData: schedule.includeSystemData,
    uploadEnabled: schedule.uploadEnabled,
    uploadType: schedule.uploadType || 's3',
    s3Endpoint: schedule.s3Endpoint || '',
    s3Bucket: schedule.s3Bucket || '',
    s3Region: schedule.s3Region || 'us-east-1',
    s3AccessKey: schedule.s3AccessKey || '',
    s3SecretKey: schedule.s3SecretKey || '',
    webdavUrl: schedule.webdavUrl || '',
    webdavUsername: schedule.webdavUsername || '',
    webdavPassword: schedule.webdavPassword || '',
    retentionType: schedule.retentionType || '',
    retentionValue: schedule.retentionValue || 7
  }
  isEditing.value = true
  editingId.value = schedule.id
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  formData.value = defaultFormData()
  editingId.value = null
}

const saveSchedule = async () => {
  if (!formData.value.name.trim()) {
    if (window.$showNotification) {
      window.$showNotification('请输入调度名称', 'warning')
    }
    return
  }

  if (!formData.value.scheduleTime && formData.value.scheduleType !== 'cron') {
    if (window.$showNotification) {
      window.$showNotification('请设置执行时间', 'warning')
    }
    return
  }

  if (formData.value.scheduleType === 'cron' && !formData.value.cronExpression) {
    if (window.$showNotification) {
      window.$showNotification('请输入 cron 表达式', 'warning')
    }
    return
  }

  saving.value = true

  try {
    const payload = {
      ...formData.value,
      scheduleDay: formData.value.scheduleDay ? parseInt(formData.value.scheduleDay) : undefined
    }

    let response
    if (isEditing.value) {
      response = await $fetch(`/api/admin/scheduled-backup/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
    } else {
      response = await $fetch('/api/admin/scheduled-backup', {
        method: 'POST',
        body: payload
      })
    }

    if (response.success) {
      if (window.$showNotification) {
        window.$showNotification(isEditing.value ? '调度已更新' : '调度已创建', 'success')
      }
      closeModal()
      await loadSchedules()
    } else {
      if (window.$showNotification) {
        window.$showNotification(response.message || '操作失败', 'error')
      }
    }
  } catch (error) {
    console.error('保存调度失败:', error)
    if (window.$showNotification) {
      window.$showNotification('保存失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    saving.value = false
  }
}

const toggleSchedule = async (id, enabled) => {
  try {
    const response = await $fetch(`/api/admin/scheduled-backup/${id}/toggle`, {
      method: 'POST',
      body: { enabled }
    })

    if (response.success) {
      if (window.$showNotification) {
        window.$showNotification(enabled ? '调度已启用' : '调度已禁用', 'success')
      }
      await loadSchedules()
    }
  } catch (error) {
    console.error('切换调度状态失败:', error)
    if (window.$showNotification) {
      window.$showNotification('操作失败: ' + (error.data?.message || error.message), 'error')
    }
    await loadSchedules()
  }
}

const runNow = async (id) => {
  if (!confirm('确定要立即执行备份吗？')) return

  try {
    if (window.$showNotification) {
      window.$showNotification('备份开始执行...', 'info')
    }

    const response = await $fetch(`/api/admin/scheduled-backup/${id}/run`, {
      method: 'POST'
    })

    if (response.success) {
      if (window.$showNotification) {
        window.$showNotification('备份执行成功', 'success')
      }
      await loadHistory()
    } else {
      if (window.$showNotification) {
        window.$showNotification(response.message || '备份执行失败', 'error')
      }
    }
  } catch (error) {
    console.error('执行备份失败:', error)
    if (window.$showNotification) {
      window.$showNotification('执行失败: ' + (error.data?.message || error.message), 'error')
    }
  }
}

const confirmDelete = (schedule) => {
  scheduleToDelete.value = schedule
  showDeleteModal.value = true
}

const deleteSchedule = async () => {
  if (!scheduleToDelete.value) return

  try {
    const response = await $fetch(`/api/admin/scheduled-backup/${scheduleToDelete.value.id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      if (window.$showNotification) {
        window.$showNotification('调度已删除', 'success')
      }
      showDeleteModal.value = false
      scheduleToDelete.value = null
      await loadSchedules()
    }
  } catch (error) {
    console.error('删除调度失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除失败: ' + (error.data?.message || error.message), 'error')
    }
  }
}

const deleteHistoryRecord = async (id) => {
  if (!confirm('确定要删除这条历史记录吗？')) return

  try {
    const response = await $fetch(`/api/admin/scheduled-backup/history/${id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      if (window.$showNotification) {
        window.$showNotification('历史记录已删除', 'success')
      }
      await loadHistory()
    }
  } catch (error) {
    console.error('删除历史记录失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除失败: ' + (error.data?.message || error.message), 'error')
    }
  }
}

const testS3Connection = async () => {
  testingConnection.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup/test-s3', {
      method: 'POST',
      body: {
        endpoint: formData.value.s3Endpoint,
        bucket: formData.value.s3Bucket,
        region: formData.value.s3Region,
        accessKey: formData.value.s3AccessKey,
        secretKey: formData.value.s3SecretKey
      }
    })

    if (window.$showNotification) {
      window.$showNotification(response.message, response.success ? 'success' : 'error')
    }
  } catch (error) {
    console.error('测试 S3 连接失败:', error)
    if (window.$showNotification) {
      window.$showNotification('连接测试失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    testingConnection.value = false
  }
}

const testWebDAVConnection = async () => {
  testingConnection.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup/test-webdav', {
      method: 'POST',
      body: {
        url: formData.value.webdavUrl,
        username: formData.value.webdavUsername,
        password: formData.value.webdavPassword
      }
    })

    if (window.$showNotification) {
      window.$showNotification(response.message, response.success ? 'success' : 'error')
    }
  } catch (error) {
    console.error('测试 WebDAV 连接失败:', error)
    if (window.$showNotification) {
      window.$showNotification('连接测试失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    testingConnection.value = false
  }
}

const getScheduleTypeText = (type) => {
  const map = {
    daily: '每日',
    weekly: '每周',
    monthly: '每月',
    cron: '自定义 Cron'
  }
  return map[type] || type
}

const getScheduleTimeText = (schedule) => {
  if (schedule.scheduleType === 'cron') {
    return schedule.cronExpression
  }

  const time = schedule.scheduleTime || ''

  if (schedule.scheduleType === 'weekly') {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return `${time} ${days[schedule.scheduleDay] || ''}`
  }

  if (schedule.scheduleType === 'monthly') {
    return `${time} 每月 ${schedule.scheduleDay} 日`
  }

  return time
}

const getStatusText = (status) => {
  const map = {
    success: '成功',
    failed: '失败',
    uploaded: '已上传',
    upload_failed: '上传失败'
  }
  return map[status] || status
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatFileSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  loadSchedules()
  loadHistory()
})
</script>

<style scoped>
.scheduled-backup-manager {
  min-height: 100vh;
  background: #1a1a1a;
  color: #e5e5e5;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h3 {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 0.5rem 0;
}

.header .description {
  font-size: 1rem;
  color: #a0a0a0;
  margin: 0;
}

.actions-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: #4a90e2;
  color: white;
}

.action-btn.primary:hover {
  background: #357abd;
}

.action-btn.secondary {
  background: #404040;
  color: white;
}

.action-btn.secondary:hover {
  background: #505050;
}

.action-btn.danger {
  background: #dc3545;
  color: white;
}

.action-btn.danger:hover {
  background: #c82333;
}

.action-btn.small {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.action-btn svg {
  width: 1rem;
  height: 1rem;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #a0a0a0;
}

.empty-state svg {
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  color: #606060;
}

.empty-state.small {
  padding: 1.5rem;
}

.schedule-cards {
  display: grid;
  gap: 1.5rem;
}

.schedule-card {
  background: #2a2a2a;
  border: 1px solid #404040;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.schedule-card:hover {
  border-color: #505050;
}

.schedule-card.disabled {
  opacity: 0.6;
}

.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.schedule-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.schedule-info h4 {
  margin: 0;
  font-size: 1.25rem;
  color: #ffffff;
}

.schedule-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  background: #404040;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: #505050;
  color: #ffffff;
}

.icon-btn.danger:hover {
  background: #dc3545;
  color: #ffffff;
}

.icon-btn.small {
  padding: 0.25rem;
}

.icon-btn svg {
  width: 1rem;
  height: 1rem;
  display: block;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.active,
.status-badge.success,
.status-badge.uploaded {
  background: #28a745;
  color: white;
}

.status-badge.inactive,
.status-badge.failed,
.status-badge.upload_failed {
  background: #6c757d;
  color: white;
}

.schedule-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.detail-item .label {
  color: #808080;
}

.detail-item .value {
  color: #e5e5e5;
}

.schedule-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #404040;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background: #4a90e2;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

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
  padding: 1.5rem;
}

.modal {
  background: #2a2a2a;
  border: 1px solid #404040;
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.delete-modal {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #404040;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #ffffff;
}

.close-btn {
  background: #404040;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #505050;
  color: #ffffff;
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0 0 0.5rem 0;
}

.warning-text {
  color: #dc3545 !important;
  font-size: 0.9rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #404040;
}

.form-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #404040;
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.form-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #ffffff;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group input[type="time"],
.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: #333333;
  border: 1px solid #404040;
  border-radius: 6px;
  color: #e5e5e5;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4a90e2;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #808080;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #333333;
  border: 1px solid #404040;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.radio-option:hover {
  border-color: #505050;
}

.radio-option input {
  margin: 0;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.checkbox-option input {
  width: 1rem;
  height: 1rem;
  margin: 0;
}

.upload-config,
.s3-config,
.webdav-config {
  padding: 1rem;
  background: #333333;
  border-radius: 8px;
  margin-top: 1rem;
}

.history-section {
  margin-top: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #ffffff;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
}

.history-table th,
.history-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #404040;
}

.history-table th {
  background: #333333;
  font-weight: 600;
  color: #a0a0a0;
  font-size: 0.85rem;
}

.history-table td {
  font-size: 0.9rem;
  color: #e5e5e5;
}

.history-table tbody tr:hover {
  background: #333333;
}
</style>
