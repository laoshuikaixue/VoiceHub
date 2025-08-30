<template>
  <div class="announcement-manager">
    <div class="manager-header">
      <h2>公告管理</h2>
      <p class="subtitle">创建和管理站内外公告</p>
    </div>

    <!-- 权限检查 -->
    <div v-if="!canManageAnnouncements" class="permission-denied">
      <div class="permission-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="m15 9-6 6"/>
          <path d="m9 9 6 6"/>
        </svg>
      </div>
      <h3>权限不足</h3>
      <p>您没有管理公告的权限，请联系管理员获取相应权限。</p>
    </div>

    <div v-else class="manager-layout">
      <!-- 左侧表单面板 -->
      <div class="form-panel">
        <div class="form-group">
          <h3>{{ editingAnnouncement ? '编辑公告' : '创建公告' }}</h3>
          
          <!-- 公告标题 -->
          <div class="form-item">
            <label>公告标题</label>
            <input
              v-model="formData.title"
              type="text"
              class="form-input"
              placeholder="请输入公告标题"
              maxlength="100"
            />
          </div>

          <!-- 公告类型 -->
          <div class="form-item">
            <label>公告类型</label>
            <select v-model="formData.type" class="form-select">
              <option value="EXTERNAL">站外公告（所有访客可见）</option>
              <option value="INTERNAL">站内公告（仅登录用户可见）</option>
            </select>
          </div>

          <!-- 优先级 -->
          <div class="form-item">
            <label>优先级</label>
            <select v-model="formData.priority" class="form-select">
              <option value="0">普通</option>
              <option value="1">重要</option>
              <option value="2">紧急</option>
            </select>
          </div>

          <!-- 显示时间 -->
          <div class="form-item">
            <label>显示时间</label>
            <div class="date-range">
              <input
                v-model="formData.startDate"
                type="datetime-local"
                class="date-input"
                placeholder="开始时间（可选）"
              />
              <span>至</span>
              <input
                v-model="formData.endDate"
                type="datetime-local"
                class="date-input"
                placeholder="结束时间（可选）"
              />
            </div>
          </div>

          <!-- 公告内容 -->
          <div class="form-item">
            <label>公告内容</label>
            <textarea
              v-model="formData.content"
              class="form-textarea"
              placeholder="请输入公告内容（支持**粗体**和*斜体*格式）"
              rows="6"
            ></textarea>
          </div>

          <!-- 颜色设置 -->
          <div class="form-group">
            <h4>外观设置</h4>
            
            <div class="color-settings">
              <div class="color-item">
                <label>背景颜色</label>
                <div class="color-input-wrapper">
                  <input
                    v-model="formData.backgroundColor"
                    type="color"
                    class="color-input"
                  />
                  <input
                    v-model="formData.backgroundColor"
                    type="text"
                    class="color-text"
                    placeholder="#1a1a1a"
                  />
                </div>
              </div>

              <div class="color-item">
                <label>文字颜色</label>
                <div class="color-input-wrapper">
                  <input
                    v-model="formData.textColor"
                    type="color"
                    class="color-input"
                  />
                  <input
                    v-model="formData.textColor"
                    type="text"
                    class="color-text"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <div class="color-item">
                <label>按钮颜色</label>
                <div class="color-input-wrapper">
                  <input
                    v-model="formData.buttonColor"
                    type="color"
                    class="color-input"
                  />
                  <input
                    v-model="formData.buttonColor"
                    type="text"
                    class="color-text"
                    placeholder="#4F46E5"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="form-actions">
            <button @click="resetForm" class="btn btn-secondary">
              重置
            </button>
            <button @click="previewAnnouncement" class="btn btn-info">
              预览
            </button>
            <button 
              @click="saveAnnouncement" 
              class="btn btn-primary" 
              :disabled="isSaving"
            >
              {{ isSaving ? '保存中...' : (editingAnnouncement ? '更新公告' : '创建公告') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧列表面板 -->
      <div class="list-panel">
        <div class="list-header">
          <h3>现有公告</h3>
          <div class="list-filters">
            <select v-model="filterType" class="filter-select">
              <option value="">全部类型</option>
              <option value="EXTERNAL">站外公告</option>
              <option value="INTERNAL">站内公告</option>
            </select>
            <select v-model="filterStatus" class="filter-select">
              <option value="">全部状态</option>
              <option value="active">已启用</option>
              <option value="inactive">已停用</option>
            </select>
          </div>
        </div>

        <div class="announcement-list">
          <div
            v-for="announcement in filteredAnnouncements"
            :key="announcement.id"
            class="announcement-item"
            :class="{ active: announcement.isActive }"
          >
            <div class="announcement-info">
              <h4>{{ announcement.title }}</h4>
              <p>{{ announcement.content.substring(0, 100) }}{{ announcement.content.length > 100 ? '...' : '' }}</p>
              
              <div class="announcement-meta">
                <span class="announcement-type" :class="announcement.type.toLowerCase()">
                  {{ announcement.type === 'INTERNAL' ? '站内' : '站外' }}
                </span>
                <span class="announcement-priority" :class="'priority-' + announcement.priority">
                  {{ ['普通', '重要', '紧急'][announcement.priority] }}
                </span>
                <span class="announcement-views">
                  浏览: {{ announcement.viewCount }}
                </span>
                <span class="announcement-date">
                  {{ formatDate(announcement.createdAt) }}
                </span>
              </div>
            </div>

            <div class="announcement-actions">
              <button @click="editAnnouncement(announcement)" class="action-btn edit">
                编辑
              </button>
              <button 
                @click="toggleAnnouncementStatus(announcement)" 
                class="action-btn toggle"
                :class="announcement.isActive ? 'deactivate' : 'activate'"
              >
                {{ announcement.isActive ? '停用' : '启用' }}
              </button>
              <button @click="deleteAnnouncement(announcement)" class="action-btn delete">
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <AnnouncementDialog
      v-if="previewDialogVisible"
      :announcement="previewData"
      :show="previewDialogVisible"
      :hide-remember-option="true"
      @close="previewDialogVisible = false"
      @confirm="previewDialogVisible = false"
    />

    <!-- 确认删除弹窗 -->
    <ConfirmDialog
      v-if="deleteDialogVisible"
      :show="deleteDialogVisible"
      title="确认删除"
      message="确定要删除这条公告吗？此操作无法撤销。"
      type="danger"
      @confirm="confirmDelete"
      @cancel="deleteDialogVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePermissions } from '~/composables/usePermissions'
import AnnouncementDialog from '~/components/UI/AnnouncementDialog.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

// 权限检查
const { hasRole } = usePermissions()
const canManageAnnouncements = computed(() => hasRole(['ADMIN', 'SUPER_ADMIN']))

// 数据状态
const announcements = ref([])
const editingAnnouncement = ref(null)
const isSaving = ref(false)
const previewDialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const announcementToDelete = ref(null)

// 筛选
const filterType = ref('')
const filterStatus = ref('')

// 表单数据
const formData = ref({
  title: '',
  content: '',
  type: 'EXTERNAL',
  priority: 0,
  startDate: '',
  endDate: '',
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  buttonColor: '#4F46E5'
})

// 预览数据
const previewData = computed(() => ({
  id: 0,
  title: formData.value.title || '预览标题',
  content: formData.value.content || '预览内容',
  type: formData.value.type,
  backgroundColor: formData.value.backgroundColor,
  textColor: formData.value.textColor,
  buttonColor: formData.value.buttonColor,
  createdAt: new Date().toISOString()
}))

// 过滤后的公告列表
const filteredAnnouncements = computed(() => {
  let filtered = announcements.value

  if (filterType.value) {
    filtered = filtered.filter(a => a.type === filterType.value)
  }

  if (filterStatus.value) {
    const isActive = filterStatus.value === 'active'
    filtered = filtered.filter(a => a.isActive === isActive)
  }

  return filtered.sort((a, b) => {
    // 按优先级和创建时间排序
    if (a.priority !== b.priority) {
      return b.priority - a.priority
    }
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
})

// 方法
const loadAnnouncements = async () => {
  try {
    const response = await $fetch('/api/announcements?type=ALL')
    announcements.value = response
  } catch (error) {
    console.error('加载公告失败:', error)
    if (window.$showNotification) {
      window.$showNotification('加载公告失败', 'error')
    }
  }
}

const resetForm = () => {
  formData.value = {
    title: '',
    content: '',
    type: 'EXTERNAL',
    priority: 0,
    startDate: '',
    endDate: '',
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    buttonColor: '#4F46E5'
  }
  editingAnnouncement.value = null
}

const previewAnnouncement = () => {
  if (!formData.value.title || !formData.value.content) {
    if (window.$showNotification) {
      window.$showNotification('请填写标题和内容后再预览', 'warning')
    }
    return
  }
  previewDialogVisible.value = true
}

const saveAnnouncement = async () => {
  if (!formData.value.title || !formData.value.content) {
    if (window.$showNotification) {
      window.$showNotification('请填写完整的公告信息', 'warning')
    }
    return
  }

  isSaving.value = true
  try {
    const payload = {
      ...formData.value,
      priority: parseInt(formData.value.priority)
    }

    if (editingAnnouncement.value) {
      // 更新
      await $fetch(`/api/announcements/${editingAnnouncement.value.id}`, {
        method: 'PUT',
        body: payload
      })
      if (window.$showNotification) {
        window.$showNotification('公告更新成功', 'success')
      }
    } else {
      // 创建
      await $fetch('/api/announcements', {
        method: 'POST',
        body: payload
      })
      if (window.$showNotification) {
        window.$showNotification('公告创建成功', 'success')
      }
    }

    resetForm()
    await loadAnnouncements()
  } catch (error) {
    console.error('保存公告失败:', error)
    if (window.$showNotification) {
      window.$showNotification('保存公告失败: ' + error.data?.message, 'error')
    }
  } finally {
    isSaving.value = false
  }
}

const editAnnouncement = (announcement) => {
  editingAnnouncement.value = announcement
  formData.value = {
    title: announcement.title,
    content: announcement.content,
    type: announcement.type,
    priority: announcement.priority,
    startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().slice(0, 16) : '',
    endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().slice(0, 16) : '',
    backgroundColor: announcement.backgroundColor || '#1a1a1a',
    textColor: announcement.textColor || '#ffffff',
    buttonColor: announcement.buttonColor || '#4F46E5'
  }
}

const toggleAnnouncementStatus = async (announcement) => {
  try {
    await $fetch(`/api/announcements/${announcement.id}`, {
      method: 'PUT',
      body: {
        isActive: !announcement.isActive
      }
    })
    
    announcement.isActive = !announcement.isActive
    if (window.$showNotification) {
      window.$showNotification(`公告已${announcement.isActive ? '启用' : '停用'}`, 'success')
    }
  } catch (error) {
    console.error('切换公告状态失败:', error)
    if (window.$showNotification) {
      window.$showNotification('操作失败', 'error')
    }
  }
}

const deleteAnnouncement = (announcement) => {
  announcementToDelete.value = announcement
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  try {
    await $fetch(`/api/announcements/${announcementToDelete.value.id}`, {
      method: 'DELETE'
    })
    
    if (window.$showNotification) {
      window.$showNotification('公告删除成功', 'success')
    }
    
    await loadAnnouncements()
  } catch (error) {
    console.error('删除公告失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除公告失败', 'error')
    }
  } finally {
    deleteDialogVisible.value = false
    announcementToDelete.value = null
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 生命周期
onMounted(() => {
  loadAnnouncements()
})
</script>

<style scoped>
.announcement-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px;
}

.manager-header {
  text-align: center;
  margin-bottom: 40px;
}

.manager-header h2 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 16px;
  color: #888;
  margin: 0;
}

.permission-denied {
  text-align: center;
  padding: 80px 20px;
  color: #ffffff;
}

.permission-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: #ff4757;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.permission-denied h3 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.permission-denied p {
  font-size: 16px;
  line-height: 1.5;
  margin: 0;
  max-width: 400px;
  margin: 0 auto;
}

.manager-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 40px;
  height: calc(100vh - 200px);
}

/* 表单面板 */
.form-panel {
  background: #111111;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #1f1f1f;
  overflow-y: auto;
}

.form-group h3,
.form-group h4 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #ffffff;
}

.form-group h4 {
  font-size: 16px;
  margin-top: 24px;
  margin-bottom: 16px;
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #cccccc;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-input {
  flex: 1;
}

.date-range span {
  color: #888;
  font-size: 14px;
}

.color-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-item label {
  font-size: 13px;
  margin-bottom: 4px;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input {
  width: 40px;
  height: 32px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.color-text {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
}

.form-actions {
  margin-top: 32px;
  display: flex;
  gap: 12px;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.btn-secondary {
  background: #374151;
  color: #ffffff;
}

.btn-info {
  background: #0891B2;
  color: #ffffff;
}

.btn-primary {
  background: #4F46E5;
  color: #ffffff;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 列表面板 */
.list-panel {
  background: #111111;
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-header {
  padding: 24px;
  border-bottom: 1px solid #1f1f1f;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.list-filters {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  color: #ffffff;
  font-size: 13px;
}

.announcement-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.announcement-item {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: all 0.2s;
}

.announcement-item.active {
  border-color: #4F46E5;
}

.announcement-item:hover {
  border-color: #555;
}

.announcement-info {
  flex: 1;
}

.announcement-info h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #ffffff;
}

.announcement-info p {
  font-size: 14px;
  color: #cccccc;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.announcement-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}

.announcement-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.announcement-type.internal {
  background: rgba(79, 70, 229, 0.2);
  color: #8B5CF6;
}

.announcement-type.external {
  background: rgba(16, 185, 129, 0.2);
  color: #10B981;
}

.announcement-priority {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.priority-0 {
  background: rgba(107, 114, 128, 0.2);
  color: #9CA3AF;
}

.priority-1 {
  background: rgba(245, 158, 11, 0.2);
  color: #F59E0B;
}

.priority-2 {
  background: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

.announcement-views,
.announcement-date {
  color: #888;
}

.announcement-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 16px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn.edit {
  border-color: #4F46E5;
  color: #4F46E5;
  background: transparent;
}

.action-btn.edit:hover {
  background: #4F46E5;
  color: white;
}

.action-btn.toggle.activate {
  border-color: #10B981;
  color: #10B981;
  background: transparent;
}

.action-btn.toggle.activate:hover {
  background: #10B981;
  color: white;
}

.action-btn.toggle.deactivate {
  border-color: #F59E0B;
  color: #F59E0B;
  background: transparent;
}

.action-btn.toggle.deactivate:hover {
  background: #F59E0B;
  color: white;
}

.action-btn.delete {
  border-color: #EF4444;
  color: #EF4444;
  background: transparent;
}

.action-btn.delete:hover {
  background: #EF4444;
  color: white;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .manager-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
  
  .form-panel {
    margin-bottom: 20px;
  }
}

@media (max-width: 640px) {
  .announcement-manager {
    padding: 16px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .announcement-item {
    flex-direction: column;
    gap: 12px;
  }
  
  .announcement-actions {
    flex-direction: row;
    margin-left: 0;
  }
  
  .list-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .list-filters {
    flex-direction: column;
  }
}
</style>
