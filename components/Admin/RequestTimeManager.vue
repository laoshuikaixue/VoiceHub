<template>
  <div class="play-time-manager">
    <!-- 页面标题 -->
    <h2 class="page-title">投稿管理</h2>
    
    <!-- 配置区域 -->
    <div class="config-section">
      <!-- 投稿功能主开关 -->
      <div class="main-toggle-section">
        <div class="toggle-item">
          <span class="label">投稿功能</span>
          <label class="toggle-switch">
            <input v-model="enableRequest" type="checkbox" @change="updateSystemSettings">
            <span class="slider round"></span>
          </label>
          <span class="status-text">{{ enableRequest ? '已开启' : '已关闭' }}</span>
        </div>
      </div>
      
      <!-- 开放时间配置区域 -->
      <div v-if="enableRequest" class="time-config-section">
        <div class="section-header">
          <h4 class="section-title">开放时间配置</h4>
          <p class="section-description">配置投稿功能的时间限制设置</p>
        </div>
        
        <div class="toggle-item">
          <span class="label">使用投稿开放时段限制</span>
          <label class="toggle-switch">
            <input v-model="enableRequestTimeLimitation" type="checkbox" @change="updateSystemSettings">
            <span class="slider round"></span>
          </label>
          <span class="status-text">{{ enableRequestTimeLimitation ? '已启用' : '已禁用' }}</span>
        </div>
        
        <div v-if="enableRequestTimeLimitation" class="current-status">
          <span class="label">当前时段状态：</span>
          <div :class="{ 'enabled': hitRequestTime, 'disabled': !hitRequestTime }" class="status-badge">
            {{ hitRequestTime ? '开放中' : '已关闭' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 分割线 -->
    <div class="section-divider"></div>

    <!-- 投稿限额设置 -->
    <div class="submission-limits-section">
      <h3 class="section-title">投稿限额设置</h3>
      
      <div class="form-group">
        <label class="checkbox-label">
          <input
              v-model="submissionLimitSettings.enableSubmissionLimit"
              type="checkbox"
              @change="updateSubmissionLimitSettings"
          />
          <span class="checkbox-text">启用投稿限额</span>
        </label>
        <small class="help-text">开启后将限制用户的投稿频率</small>
      </div>

      <div v-if="submissionLimitSettings.enableSubmissionLimit" class="submission-limits">
        <div class="limit-type-selection">
          <label class="radio-label">
            <input
                :checked="limitType === 'daily'"
                name="limitType"
                type="radio"
                value="daily"
                @change="handleLimitTypeChange('daily')"
            />
            <span class="radio-text">每日限额</span>
          </label>
          <label class="radio-label">
            <input
                :checked="limitType === 'weekly'"
                name="limitType"
                type="radio"
                value="weekly"
                @change="handleLimitTypeChange('weekly')"
            />
            <span class="radio-text">每周限额</span>
          </label>
        </div>

        <div v-if="limitType === 'daily'" class="form-group">
          <label for="dailySubmissionLimit">每日投稿限额</label>
          <input
              id="dailySubmissionLimit"
              v-model.number="submissionLimitSettings.dailySubmissionLimit"
              max="100"
              min="0"
              placeholder="请输入每日最大投稿数量"
              type="number"
              @input="updateSubmissionLimitSettings"
          />
          <small class="help-text">每个用户每天最多可以投稿的歌曲数量，设置为0表示关闭投稿功能</small>
        </div>

        <div v-if="limitType === 'weekly'" class="form-group">
          <label for="weeklySubmissionLimit">每周投稿限额</label>
          <input
              id="weeklySubmissionLimit"
              v-model.number="submissionLimitSettings.weeklySubmissionLimit"
              max="500"
              min="0"
              placeholder="请输入每周最大投稿数量"
              type="number"
              @input="updateSubmissionLimitSettings"
          />
          <small class="help-text">每个用户每周最多可以投稿的歌曲数量，设置为0表示关闭投稿功能</small>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn btn-primary" @click="showAddForm = true">
        <span class="icon">+</span> 添加投稿开放时段
      </button>
    </div>

    <!-- 投稿开放时段列表 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="requestTimes.length === 0" class="empty-state">
      <div class="icon">🕒</div>
      <p>暂无投稿开放时段</p>
      <p class="hint">点击"添加投稿开放时段"按钮创建第一个投稿开放时段</p>
    </div>

    <div v-else class="request-times-list">
      <div v-for="RequestTime in requestTimes" :key="RequestTime.id" class="play-time-card">
        <div class="card-header">
          <h3 class="time-name">{{ RequestTime.name }} ({{RequestTime.accepted}}/{{ RequestTime.expected }})</h3>
          <div :class="{ 'enabled': !RequestTime.past && RequestTime.enabled, 'disabled': !RequestTime.past && !RequestTime.enabled, 'past': RequestTime.past }" class="status-badge">
            {{ RequestTime.past ? '已过期' : (RequestTime.enabled ? '已启用' : '已禁用') }}
          </div>
        </div>

        <div class="time-details">
          <div class="time-range">
            <span class="label">投稿开放时间:</span>
            <span class="value">
              <template v-if="RequestTime.startTime && RequestTime.endTime">
                {{ RequestTime.startTime }} - {{ RequestTime.endTime }}
              </template>
              <template v-else-if="RequestTime.startTime">
                {{ RequestTime.startTime }} 开始
              </template>
              <template v-else-if="RequestTime.endTime">
                {{ RequestTime.endTime }} 结束
              </template>
              <template v-else>
                不限时间
              </template>
            </span>
          </div>

          <div v-if="RequestTime.description" class="description">
            <span class="label">描述:</span>
            <span class="value">{{ RequestTime.description }}</span>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-secondary" @click="editRequestTime(RequestTime)">
            编辑
          </button>
          <button
              :class="RequestTime.enabled ? 'btn-warning' : 'btn-success'"
              class="btn"
              @click="toggleRequestTimeStatus(RequestTime)"
          >
            {{ RequestTime.enabled ? '禁用' : '启用' }}
          </button>
          <button class="btn btn-danger" @click="confirmDelete(RequestTime)">
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑投稿开放时段表单 -->
    <div v-if="showAddForm || editingRequestTime" class="modal-overlay" @click.self="cancelForm">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingRequestTime ? '编辑投稿开放时段' : '添加投稿开放时段' }}</h3>
          <button class="close-button" @click="cancelForm">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveRequestTime">
            <div class="form-group">
              <label for="name">时段名称</label>
              <input
                  id="name"
                  v-model="formData.name"
                  class="form-control"
                  placeholder="例如：上午、下午"
                  required
                  type="text"
              />
            </div>

            <div class="form-group">
              <label for="startTime">开始时间</label>
              <input
                  id="startTime"
                  v-model="formData.startTime"
                  class="form-control"
                  type="datetime-local"
              />
            </div>

            <div class="form-group">
              <label for="endTime">结束时间</label>
              <input
                  id="endTime"
                  v-model="formData.endTime"
                  class="form-control"
                  type="datetime-local"
              />
            </div>

            <div class="form-group">
              <label for="description">描述 (可选)</label>
              <textarea
                  id="description"
                  v-model="formData.description"
                  class="form-control"
                  placeholder="时段描述..."
              ></textarea>
            </div>

            <div class="form-group">
              <label for="expected">计划投稿数</label>
              <input
                  id="expected"
                  v-model="formData.expected"
                  class="form-control"
                  type="number"
              />
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input v-model="formData.enabled" type="checkbox">
                <span>启用此投稿开放时段</span>
              </label>
            </div>

            <div v-if="formError" class="form-error">
              {{ formError }}
            </div>

            <div class="form-actions">
              <button class="btn btn-secondary" type="button" @click="cancelForm">
                取消
              </button>
              <button :disabled="formSubmitting" class="btn btn-primary" type="submit">
                {{ formSubmitting ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content delete-confirm">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="close-button" @click="showDeleteConfirm = false">&times;</button>
        </div>

        <div class="modal-body">
          <p>确定要删除投稿开放时段 "{{ RequestTimeToDelete?.name }}" 吗？</p>
          <p class="warning">此操作不可恢复</p>

          <div class="form-actions">
            <button class="btn btn-secondary" type="button" @click="showDeleteConfirm = false">
              取消
            </button>
            <button
                :disabled="deleteInProgress"
                class="btn btn-danger"
                type="button"
                @click="deleteRequestTime"
            >
              {{ deleteInProgress ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {computed, onMounted, reactive, ref} from 'vue'
import {useAuth} from '~/composables/useAuth'
import type {RequestTime} from '~/types'

const {getAuthConfig, isAdmin} = useAuth()

const requestTimes = ref<RequestTime[]>([])
const loading = ref(false)
const error = ref('')
const showAddForm = ref(false)
const editingRequestTime = ref<RequestTime | null>(null)
const RequestTimeToDelete = ref<RequestTime | null>(null)
const showDeleteConfirm = ref(false)
const formSubmitting = ref(false)
const deleteInProgress = ref(false)
const formError = ref('')
const enableRequestTimeLimitation = ref(false)
const hitRequestTime = ref(false)
const enableRequest = ref(true)

// 投稿限额设置
const submissionLimitSettings = reactive({
  enableSubmissionLimit: false,
  dailySubmissionLimit: 5,
  weeklySubmissionLimit: null
})

// 限额类型计算属性
const limitType = computed(() => {
  if (submissionLimitSettings.dailySubmissionLimit !== null && submissionLimitSettings.dailySubmissionLimit !== undefined) {
    return 'daily'
  }
  if (submissionLimitSettings.weeklySubmissionLimit !== null && submissionLimitSettings.weeklySubmissionLimit !== undefined) {
    return 'weekly'
  }
  return 'daily'
})

// 表单数据
const formData = reactive({
  id: 0,
  name: '',
  startTime: '',
  endTime: '',
  description: '',
  enabled: true,
  expected: 0
})

// 初始化
onMounted(async () => {
  await fetchRequestTimes()
  await fetchSystemSettings()
  await fetchRequestTimeHit()
  await fetchSubmissionLimitSettings()
})

// 获取投稿开放时段列表
const fetchRequestTimes = async () => {
  if (!isAdmin.value) {
    error.value = '只有管理员才能管理投稿开放时段'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/request-times', {
      headers: {
        'Content-Type': 'application/json'
      },
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `获取投稿开放时段失败: ${response.status}`)
    }

    const data = await response.json()

    // 自定义排序：先按启用状态排序，然后有时间的排在前面，没有时间的排在后面
    requestTimes.value = data.sort((a: RequestTime, b: RequestTime) => {
      // 先按是否过期排序
      if (a.past !== b.past) {
        return a.past ? 1 : -1; // 过期的排在后面
      }
      // 首先按启用状态排序
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1; // 启用的排在前面
      }


      // 然后按是否有时间排序
      const aHasTime = !!(a.startTime || a.endTime);
      const bHasTime = !!(b.startTime || b.endTime);

      if (aHasTime !== bHasTime) {
        return aHasTime ? -1 : 1; // 有时间的排在前面
      }

      // 如果都有时间，按开始时间排序
      if (aHasTime && bHasTime) {
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        } else if (a.startTime) {
          return -1;
        } else if (b.startTime) {
          return 1;
        }
      }

      // 最后按名称排序
      return a.name.localeCompare(b.name);
    });
  } catch (err: any) {
    error.value = err.message || '获取投稿开放时段失败'
  } finally {
    loading.value = false
  }
}

// 获取系统设置
const fetchSystemSettings = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      headers: {
        'Content-Type': 'application/json'
      },
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`获取系统设置失败: ${errorData.message || response.status}`)
      return
    }

    const data = await response.json()
    enableRequestTimeLimitation.value = data.enableRequestTimeLimitation
    enableRequest.value = (!data.forceBlockAllRequests)
  } catch (err: any) {
    console.error('获取系统设置失败:', err.message)
  }
}

const fetchRequestTimeHit = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/request-times', {
      headers: {
        'Content-Type': 'application/json'
      },
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`获取投稿开放状态失败: ${errorData.message || response.status}`)
      return
    }

    const data = await response.json()
    hitRequestTime.value = data.hit
  } catch (err: any) {
    console.error('获取投稿开放状态失败:', err.message)
  }
}

// 更新系统设置
const updateSystemSettings = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enableRequestTimeLimitation: enableRequestTimeLimitation.value,
        forceBlockAllRequests: !enableRequest.value
      }),
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `更新系统设置失败: ${response.status}`)
    }
  } catch (err: any) {
    error.value = err.message || '更新系统设置失败'
  }
}

// 获取投稿限额设置
const fetchSubmissionLimitSettings = async () => {
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      headers: {
        'Content-Type': 'application/json'
      },
      ...authConfig
    })

    if (!response.ok) {
      throw new Error('获取投稿限额设置失败')
    }

    const data = await response.json()
    submissionLimitSettings.enableSubmissionLimit = data.enableSubmissionLimit || false
    submissionLimitSettings.dailySubmissionLimit = data.dailySubmissionLimit !== undefined ? data.dailySubmissionLimit : 5
    submissionLimitSettings.weeklySubmissionLimit = data.weeklySubmissionLimit !== undefined ? data.weeklySubmissionLimit : null
  } catch (err: any) {
    console.error('获取投稿限额设置失败:', err.message)
  }
}

// 更新投稿限额设置
const updateSubmissionLimitSettings = async () => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enableSubmissionLimit: submissionLimitSettings.enableSubmissionLimit,
        dailySubmissionLimit: submissionLimitSettings.dailySubmissionLimit,
        weeklySubmissionLimit: submissionLimitSettings.weeklySubmissionLimit
      }),
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || '更新投稿限额设置失败')
    }
  } catch (err: any) {
    error.value = err.message || '更新投稿限额设置失败'
  }
}

// 处理限额类型变化
const handleLimitTypeChange = (type: string) => {
  if (type === 'daily') {
    submissionLimitSettings.weeklySubmissionLimit = null
    if (submissionLimitSettings.dailySubmissionLimit === null || submissionLimitSettings.dailySubmissionLimit === undefined) {
      submissionLimitSettings.dailySubmissionLimit = 5
    }
  } else if (type === 'weekly') {
    submissionLimitSettings.dailySubmissionLimit = null
    if (submissionLimitSettings.weeklySubmissionLimit === null || submissionLimitSettings.weeklySubmissionLimit === undefined) {
      submissionLimitSettings.weeklySubmissionLimit = 20
    }
  }
  updateSubmissionLimitSettings()
}

// 编辑投稿开放时段
const editRequestTime = (RequestTime: RequestTime) => {
  editingRequestTime.value = RequestTime
  
  // 将 Date 对象转换为 datetime-local 输入所需的格式
  const formatDateForInput = (date: string | Date | null) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    // 转换为本地时间的 YYYY-MM-DDTHH:MM 格式
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  Object.assign(formData, {
    id: RequestTime.id,
    name: RequestTime.name,
    startTime: formatDateForInput(RequestTime.startTime),
    endTime: formatDateForInput(RequestTime.endTime),
    description: RequestTime.description || '',
    enabled: RequestTime.enabled,
    expected: RequestTime.expected || 0
  })
}

// 切换投稿开放时段状态
const toggleRequestTimeStatus = async (RequestTime: RequestTime) => {
  if (!isAdmin.value) return

  try {
    const authConfig = getAuthConfig()
    const response = await fetch(`/api/admin/request-times/${RequestTime.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabled: !RequestTime.enabled
      }),
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `更新投稿开放时段状态失败: ${response.status}`)
    }

    // 更新本地数据
    await fetchRequestTimes()
  } catch (err: any) {
    error.value = err.message || '更新投稿开放时段状态失败'
  }
}

// 确认删除
const confirmDelete = (RequestTime: RequestTime) => {
  RequestTimeToDelete.value = RequestTime
  showDeleteConfirm.value = true
}

// 删除投稿开放时段
const deleteRequestTime = async () => {
  if (!RequestTimeToDelete.value || !isAdmin.value) return

  deleteInProgress.value = true

  try {
    const authConfig = getAuthConfig()
    const response = await fetch(`/api/admin/request-times/${RequestTimeToDelete.value.id}`, {
      method: 'DELETE',
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `删除投稿开放时段失败: ${response.status}`)
    }

    // 更新本地数据
    await fetchRequestTimes()
    showDeleteConfirm.value = false
    RequestTimeToDelete.value = null
  } catch (err: any) {
    error.value = err.message || '删除投稿开放时段失败'
  } finally {
    deleteInProgress.value = false
  }
}

// 保存投稿开放时段
const saveRequestTime = async () => {
  formError.value = ''

  // 时间验证（仅当两个时间都有填写时才进行比较）
  if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
    formError.value = '开始时间必须早于结束时间'
    return
  }

  // 至少要有名称
  if (!formData.name.trim()) {
    formError.value = '时段名称不能为空'
    return
  }

  // 检查名称是否重复
  const isUpdate = !!editingRequestTime.value
  const nameExists = requestTimes.value.some(pt =>
      pt.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!isUpdate || pt.id !== formData.id)
  )

  if (nameExists) {
    formError.value = '投稿开放时段名称已存在，请使用其他名称'
    return
  }

  formSubmitting.value = true

  try {
    const authConfig = getAuthConfig()

    const response = await fetch(isUpdate ? `/api/admin/request-times/${formData.id}` : '/api/admin/request-times', {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name.trim(),
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        description: formData.description || null,
        enabled: formData.enabled,
        expected: formData.expected || 0
      }),
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `${isUpdate ? '更新' : '创建'}投稿开放时段失败: ${response.status}`)
    }

    // 更新本地数据
    await fetchRequestTimes()
    cancelForm()
  } catch (err: any) {
    formError.value = err.message || '保存投稿开放时段失败'
  } finally {
    formSubmitting.value = false
  }
}

// 取消表单
const cancelForm = () => {
  showAddForm.value = false
  editingRequestTime.value = null
  formError.value = ''

  // 重置表单数据
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true
  })
}
</script>

<style scoped>
.play-time-manager {
  background: #111111;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  padding: 24px;
  position: relative;
  width: 100%;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  gap: 1rem;
}

.title {
  font-size: 1.5rem;
  color: #ffffff;
  margin: 0;
  font-weight: 600;
}

/* 投稿开关区域样式 */
.header-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

/* 页面标题样式 */
.page-title {
  margin: 0 0 2rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-title::before {
  content: "📝";
  font-size: 1.3rem;
}

/* 配置区域容器 */
.config-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

/* 分割线样式 */
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  margin: 2rem 0;
  position: relative;
}

.section-divider::before {
  content: "";
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 5px;
  background: linear-gradient(90deg, rgba(79, 70, 229, 0.3), rgba(34, 197, 94, 0.3));
  border-radius: 2px;
}

/* 投稿限额设置区域 */
.submission-limits-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

/* 主开关区域 */
.main-toggle-section {
  margin-bottom: 1.5rem;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.15);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.toggle-item:hover {
  background: rgba(79, 70, 229, 0.12);
  border-color: rgba(79, 70, 229, 0.25);
}

/* 开放时间配置区域 */
.time-config-section {
  margin-top: 1.5rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  border-left: 4px solid rgba(34, 197, 94, 0.4);
}

.section-header {
  margin-bottom: 1rem;
}

.section-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title::before {
  content: "⏰";
  font-size: 1rem;
}

.section-description {
  margin: 0;
  font-size: 0.875rem;
  color: #a3a3a3;
  line-height: 1.4;
}

.time-config-section .toggle-item {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.15);
  margin-bottom: 1rem;
}

.time-config-section .toggle-item:hover {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.25);
}

.current-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.current-status:hover {
  background: rgba(255, 255, 255, 0.05);
}

.status-text {
  color: #a3a3a3;
  font-size: 0.75rem;
  font-style: italic;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.label {
  color: #e5e7eb;
  font-size: 0.875rem;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
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
  background-color: #374151;
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4f46e5;
}

input:focus + .slider {
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background-color: #4338ca;
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.btn-danger {
  background-color: rgba(239, 68, 68, 0.8);
  color: white;
}

.btn-danger:hover {
  background-color: rgba(239, 68, 68, 1);
}

.btn-warning {
  background-color: rgba(234, 179, 8, 0.8);
  color: white;
}

.btn-warning:hover {
  background-color: rgba(234, 179, 8, 1);
}

.btn-success {
  background-color: rgba(34, 197, 94, 0.8);
  color: white;
}

.btn-success:hover {
  background-color: rgba(34, 197, 94, 1);
}

.icon {
  margin-right: 0.25rem;
  font-size: 1rem;
}

.loading-container, .error-message, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border-radius: 8px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  text-align: center;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #ef4444;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  border-radius: 8px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  text-align: center;
  min-height: 250px;
}

.empty-state .icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.6;
  margin-right: 0;
}

.empty-state .hint {
  font-size: 0.875rem;
  color: #888888;
  margin-top: 0.5rem;
}

.request-times-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

@media (min-width: 1200px) {
  .request-times-list {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (min-width: 1600px) {
  .request-times-list {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

.play-time-card {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
  border: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.play-time-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.time-name {
  font-size: 1.125rem;
  color: #ffffff;
  margin: 0;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
}

.status-badge.enabled {
  background-color: rgba(34, 197, 94, 0.2);
  color: rgb(74, 222, 128);
}

.status-badge.disabled {
  background-color: rgba(239, 68, 68, 0.2);
  color: rgb(252, 165, 165);
}

.status-badge.past{
  background-color: rgba(234, 179, 8, 0.2);
  color: rgb(254, 202, 87);
}

.time-details {
  margin-bottom: 1rem;
  flex-grow: 1;
}

.time-range, .description {
  display: flex;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.time-range .label, .description .label {
  min-width: 5rem;
  color: #888888;
}

.time-range .value, .description .value {
  color: #cccccc;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  width: 100%;
  max-width: 550px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

@media (min-width: 1200px) {
  .modal-content {
    max-width: 650px;
  }

  .modal-body {
    padding: 2rem;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
}

.close-button {
  background: none;
  border: none;
  color: #888888;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-button:hover {
  color: #ffffff;
}

.modal-body {
  padding: 1.5rem;
}



.section-title {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title::before {
  content: "⚙️";
  font-size: 1.1rem;
}

.submission-limits {
  margin-top: 1rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.submission-limits:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.limit-type-selection {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.2);
  border-radius: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: #e5e7eb;
  transition: color 0.2s ease;
  position: relative;
}

.radio-label:hover {
  color: #ffffff;
}

.radio-label input[type="radio"] {
  width: 18px;
  height: 18px;
  margin-right: 0.75rem;
  cursor: pointer;
  accent-color: #4f46e5;
}

.radio-text {
  font-size: 0.875rem;
  font-weight: 500;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: #e5e7eb;
  transition: color 0.2s ease;
  padding: 0.5rem 0;
}

.checkbox-label:hover {
  color: #ffffff;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-right: 0.75rem;
  cursor: pointer;
  accent-color: #4f46e5;
}

.checkbox-text {
  font-size: 0.875rem;
  font-weight: 500;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 500;
  color: #d1d5db;
  font-size: 0.875rem;
}

.form-group input[type="number"] {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-group input[type="number"]:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  background: rgba(255, 255, 255, 0.08);
}

.form-group input[type="number"]:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.help-text {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.4;
}

/* 表单控件统一样式 */
.form-control {
  width: 100%;
  padding: 0.875rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 0.875rem;
  color: #ffffff;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-control:focus {
  border-color: #4f46e5;
  outline: none;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  background: rgba(255, 255, 255, 0.08);
}

.form-control:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.form-control::placeholder {
  color: #9ca3af;
  opacity: 1;
}

textarea.form-control {
  min-height: 120px;
  resize: vertical;
  line-height: 1.5;
}

/* 复选框和单选框统一样式 */
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label,
.radio-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: #e5e7eb;
  transition: all 0.2s ease;
  padding: 0.5rem 0;
  user-select: none;
  position: relative;
}

.checkbox-label:hover,
.radio-label:hover {
  color: #ffffff;
  transform: translateX(2px);
}

.checkbox-label input[type="checkbox"],
.radio-label input[type="radio"] {
  width: 18px;
  height: 18px;
  margin-right: 0.75rem;
  cursor: pointer;
  accent-color: #4f46e5;
  transition: all 0.2s ease;
}

.checkbox-label input[type="checkbox"]:hover,
.radio-label input[type="radio"]:hover {
  transform: scale(1.1);
}

.checkbox-text,
.radio-text {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
}

/* 表单错误和操作按钮样式 */
.form-error {
  margin-bottom: 1rem;
  padding: 0.875rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* 响应式布局支持 */
@media (max-width: 768px) {
  .header-section {
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .title {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }

  .main-toggle-section {
    margin-bottom: 1rem;
  }

  .toggle-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
  }

  .time-config-section {
    margin-top: 1rem;
    padding: 1rem;
    border-left-width: 3px;
  }

  .section-title {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .section-description {
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }

  .time-config-section .toggle-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .current-status {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .submission-limits-section {
    padding: 1rem;
    margin-top: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
    margin-bottom: 1rem;
  }

  .submission-limits {
    padding: 1rem;
  }

  .limit-type-selection {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
  }

  .form-group input[type="number"] {
    padding: 0.75rem 0.875rem;
  }

  .form-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal-content {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }

  .modal-body {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .header-section {
    padding: 0.75rem;
  }

  .title {
    font-size: 1.125rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .title::before {
    font-size: 1.1rem;
  }

  .toggle-item {
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .time-config-section {
    padding: 0.75rem;
  }

  .section-title {
    font-size: 0.95rem;
  }

  .section-description {
    font-size: 0.75rem;
  }

  .label {
    font-size: 0.8rem;
  }

  .status-text {
    font-size: 0.7rem;
  }
}

@media (min-width: 1200px) {
  .header-section {
    padding: 2rem;
  }

  .title {
    font-size: 1.75rem;
    margin-bottom: 2rem;
  }

  .settings-toggle {
    gap: 1.5rem;
  }

  .settings-toggle > div:first-child {
    padding: 1.25rem;
  }

  .time-limitation-setting {
    padding: 1.25rem 0 1.25rem 2rem;
  }

  .submission-limits-section {
    padding: 2rem;
    margin-top: 2.5rem;
  }

  .section-title {
    font-size: 1.375rem;
    margin-bottom: 2rem;
  }

  .submission-limits {
    padding: 1.5rem;
  }

  .limit-type-selection {
    padding: 1.25rem;
    gap: 2rem;
  }

  .form-group {
    margin-bottom: 2rem;
  }
}

.delete-confirm .warning {
  color: #fca5a5;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
</style>