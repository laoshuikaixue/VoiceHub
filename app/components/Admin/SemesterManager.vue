<template>
  <div class="semester-manager">
    <div class="header">
      <h2>学期管理</h2>
      <button class="add-btn" @click="showAddModal = true">
        <span class="icon">+</span>
        添加学期
      </button>
    </div>

    <!-- 当前活跃学期显示 -->
    <div v-if="currentSemester" class="current-semester">
      <h3>当前学期</h3>
      <div class="semester-card active">
        <div class="semester-info">
          <h4>{{ currentSemester.name }}</h4>
        </div>
        <div class="semester-status">
          <span class="active-badge">当前学期</span>
        </div>
      </div>
    </div>

    <!-- 学期列表 -->
    <div class="semester-list">
      <h3>所有学期</h3>

      <div v-if="loading" class="loading">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="error" class="error">
        <p>{{ error }}</p>
        <button class="retry-btn" @click="fetchSemesters">重试</button>
      </div>

      <div v-else-if="semesters.length === 0" class="empty">
        <p>暂无学期数据</p>
      </div>

      <div v-else class="semester-grid">
        <div
            v-for="semester in semesters"
            :key="semester.id"
            :class="{ active: semester.isActive }"
            class="semester-card"
        >
          <div class="semester-info">
            <h4>{{ semester.name }}</h4>
          </div>
          <div class="semester-actions">
            <button
                v-if="!semester.isActive"
                :disabled="loading"
                class="set-active-btn"
                @click="setActive(semester.id)"
            >
              设为当前
            </button>
            <button
                v-if="!semester.isActive"
                :disabled="loading"
                class="delete-btn"
                @click="deleteSemester(semester.id)"
            >
              删除
            </button>
            <span v-else class="active-badge">当前学期</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加学期模态框 -->
    <div v-if="showAddModal" class="modal-overlay" @click="closeAddModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>添加新学期</h3>
          <button class="close-btn" @click="closeAddModal">×</button>
        </div>

        <form class="modal-body" @submit.prevent="handleAddSemester">
          <div class="form-group">
            <label for="semesterName">学期名称</label>
            <input
                id="semesterName"
                v-model="newSemester.name"
                placeholder="例如：2024-2025学年上学期"
                required
                type="text"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                  v-model="newSemester.isActive"
                  type="checkbox"
              />
              <span class="checkmark"></span>
              设为当前活跃学期
            </label>
          </div>

          <div class="modal-actions">
            <button class="cancel-btn" type="button" @click="closeAddModal">
              取消
            </button>
            <button :disabled="submitting" class="submit-btn" type="submit">
              {{ submitting ? '创建中...' : '创建学期' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 确认删除对话框 -->
  <ConfirmDialog
      :loading="loading"
      :show="showDeleteDialog"
      cancel-text="取消"
      confirm-text="删除"
      message="确定要删除这个学期吗？此操作不可撤销。"
      title="删除学期"
      type="danger"
      @close="showDeleteDialog = false"
      @confirm="confirmDelete"
  />
</template>

<script setup>
import {onMounted, ref} from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

const {
  semesters,
  currentSemester,
  loading,
  error,
  fetchSemesters,
  fetchCurrentSemester,
  createSemester,
  setActiveSemester,
  deleteSemester: deleteSemesterAPI
} = useSemesters()

const showAddModal = ref(false)
const showDeleteDialog = ref(false)
const deleteTargetId = ref(null)
const submitting = ref(false)
const newSemester = ref({
  name: '',
  isActive: false
})

// 移除格式化日期函数（不再需要）

// 设置活跃学期
const setActive = async (semesterId) => {
  const success = await setActiveSemester(semesterId)
  if (success && window.$showNotification) {
    window.$showNotification('活跃学期设置成功！', 'success')
  }
}

// 删除学期
const deleteSemester = async (semesterId) => {
  deleteTargetId.value = semesterId
  showDeleteDialog.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteTargetId.value) return

  const success = await deleteSemesterAPI(deleteTargetId.value)
  if (success && window.$showNotification) {
    window.$showNotification('学期删除成功！', 'success')
  }

  showDeleteDialog.value = false
  deleteTargetId.value = null
}

// 处理添加学期
const handleAddSemester = async () => {
  submitting.value = true

  try {
    const result = await createSemester(newSemester.value)
    if (result) {
      if (window.$showNotification) {
        window.$showNotification('学期创建成功！', 'success')
      }
      closeAddModal()
    }
  } catch (err) {
    console.error('创建学期失败:', err)
  } finally {
    submitting.value = false
  }
}

// 关闭添加模态框
const closeAddModal = () => {
  showAddModal.value = false
  newSemester.value = {
    name: '',
    isActive: false
  }
}

// 组件挂载时获取数据
onMounted(async () => {
  await fetchCurrentSemester()
  await fetchSemesters()
})
</script>

<style scoped>
.semester-manager {
  padding: 20px;
  background: var(--bg-primary);
  min-height: 100vh;
  color: #e2e8f0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.add-btn {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
}

.current-semester {
  margin-bottom: 2rem;
}

.current-semester h3,
.semester-list h3 {
  color: #fff;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.semester-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
}

.semester-card:hover {
  background: #1f1f1f;
  border-color: #3a3a3a;
  transform: translateY(-1px);
}

.semester-card.active {
  border-color: #4f46e5;
  background: rgba(79, 70, 229, 0.1);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.semester-info h4 {
  color: #fff;
  font-size: 1.1rem;
  margin: 0 0 0.5rem 0;
}

.semester-info p {
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 0.5rem 0;
}

.semester-dates {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

.semester-dates span {
  margin-right: 0.5rem;
}

.active-badge {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.set-active-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 0.5rem;
}

.set-active-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.set-active-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.semester-grid {
  display: grid;
  gap: 1rem;
}

.loading, .error, .empty {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid #0b5afe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.retry-btn {
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

/* 模态框样式 */
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
}

.modal {
  background: #1a1a1a;
  border-radius: 12px;
  width: 90%;
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
  color: #fff;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: #fff;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 0.75rem;
  color: #ffffff;
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #0b5afe;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #fff;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
}

.submit-btn {
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-weight: 600;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
