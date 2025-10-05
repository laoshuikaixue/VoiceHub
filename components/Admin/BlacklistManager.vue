<template>
  <div class="blacklist-manager">
    <div class="header">
      <h3>歌曲黑名单管理</h3>
      <p class="description">管理禁止点歌的歌曲和关键词</p>
    </div>

    <!-- 添加黑名单项 -->
    <div class="add-section">
      <h4>添加黑名单项</h4>
      <div class="add-form">
        <div class="form-row">
          <div class="form-group">
            <label>类型:</label>
            <select v-model="newItem.type" class="form-select">
              <option value="SONG">具体歌曲</option>
              <option value="KEYWORD">关键词</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label>{{ newItem.type === 'SONG' ? '歌曲名称 - 艺术家' : '关键词' }}:</label>
            <input
                v-model="newItem.value"
                :placeholder="newItem.type === 'SONG' ? '例如: 歌曲名 - 艺术家' : '例如: 敏感词'"
                class="form-input"
                type="text"
            />
          </div>
        </div>
        <div class="form-group">
          <label>原因 (可选):</label>
          <input
              v-model="newItem.reason"
              class="form-input"
              placeholder="加入黑名单的原因"
              type="text"
          />
        </div>
        <button :disabled="!newItem.value || loading" class="add-btn" @click="addBlacklistItem">
          {{ loading ? '添加中...' : '添加到黑名单' }}
        </button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="form-group">
          <label>类型筛选:</label>
          <select v-model="filters.type" class="form-select" @change="loadBlacklist">
            <option value="">全部</option>
            <option value="SONG">具体歌曲</option>
            <option value="KEYWORD">关键词</option>
          </select>
        </div>
        <div class="form-group flex-1">
          <label>搜索:</label>
          <input
              v-model="filters.search"
              class="form-input"
              placeholder="搜索黑名单项..."
              type="text"
              @input="debounceSearch"
          />
        </div>
      </div>
    </div>

    <!-- 黑名单列表 -->
    <div class="blacklist-section">
      <h4>黑名单列表 ({{ pagination.total }} 项)</h4>

      <div v-if="loading && blacklist.length === 0" class="loading">
        加载中...
      </div>

      <div v-else-if="blacklist.length === 0" class="empty">
        暂无黑名单项
      </div>

      <div v-else class="blacklist-list">
        <div v-for="item in blacklist" :key="item.id" class="blacklist-item">
          <div class="item-header">
            <div class="item-info">
              <span :class="item.type.toLowerCase()" class="item-type">
                {{ item.type === 'SONG' ? '歌曲' : '关键词' }}
              </span>
              <span class="item-value">{{ item.value }}</span>
              <span v-if="!item.isActive" class="item-status disabled">已禁用</span>
            </div>
            <div class="item-actions">
              <button
                  :class="item.isActive ? 'disable-btn' : 'enable-btn'"
                  :disabled="loading"
                  @click="toggleItemStatus(item)"
              >
                {{ item.isActive ? '禁用' : '启用' }}
              </button>
              <button :disabled="loading" class="delete-btn" @click="deleteItem(item)">
                删除
              </button>
            </div>
          </div>
          <div v-if="item.reason" class="item-reason">
            原因: {{ item.reason }}
          </div>
          <div class="item-meta">
            创建时间: {{ formatDate(item.createdAt) }}
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.pages > 1" class="pagination">
        <button
            :disabled="pagination.page <= 1 || loading"
            class="page-btn"
            @click="changePage(pagination.page - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ pagination.page }} 页，共 {{ pagination.pages }} 页
        </span>
        <button
            :disabled="pagination.page >= pagination.pages || loading"
            class="page-btn"
            @click="changePage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="error">
      {{ error }}
    </div>

    <!-- 成功信息 -->
    <div v-if="success" class="success">
      {{ success }}
    </div>
  </div>

  <!-- 确认删除对话框 -->
  <ConfirmDialog
      :loading="loading"
      :message="deleteDialogMessage"
      :show="showDeleteDialog"
      cancel-text="取消"
      confirm-text="删除"
      title="删除黑名单项"
      type="danger"
      @close="showDeleteDialog = false"
      @confirm="confirmDelete"
  />
</template>

<script setup>
import {onMounted, reactive, ref} from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

const blacklist = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

// 删除对话框相关
const showDeleteDialog = ref(false)
const deleteDialogMessage = ref('')
const deleteTargetItem = ref(null)

const newItem = reactive({
  type: 'SONG',
  value: '',
  reason: ''
})

const filters = reactive({
  type: '',
  search: ''
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})

let searchTimeout = null

// 加载黑名单
const loadBlacklist = async () => {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      ...(filters.type && {type: filters.type}),
      ...(filters.search && {search: filters.search})
    })

    const response = await $fetch(`/api/admin/blacklist?${params}`, {
      ...useAuth().getAuthConfig()
    })

    blacklist.value = response.blacklist
    Object.assign(pagination, response.pagination)
  } catch (err) {
    error.value = '获取黑名单失败'
    console.error('获取黑名单失败:', err)
  } finally {
    loading.value = false
  }
}

// 添加黑名单项
const addBlacklistItem = async () => {
  if (!newItem.value.trim()) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch('/api/admin/blacklist', {
      method: 'POST',
      body: {
        type: newItem.type,
        value: newItem.value.trim(),
        reason: newItem.reason.trim() || null
      },
      ...useAuth().getAuthConfig()
    })

    success.value = '黑名单项添加成功'

    // 重置表单
    newItem.value = ''
    newItem.reason = ''

    // 重新加载列表
    pagination.page = 1
    await loadBlacklist()

    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    error.value = err.data?.message || '添加黑名单项失败'
    console.error('添加黑名单项失败:', err)
  } finally {
    loading.value = false
  }
}

// 切换项目状态
const toggleItemStatus = async (item) => {
  loading.value = true
  error.value = ''

  try {
    await $fetch(`/api/admin/blacklist/${item.id}`, {
      method: 'PATCH',
      body: {
        isActive: !item.isActive
      },
      ...useAuth().getAuthConfig()
    })

    item.isActive = !item.isActive
    success.value = `黑名单项已${item.isActive ? '启用' : '禁用'}`

    setTimeout(() => {
      success.value = ''
    }, 2000)
  } catch (err) {
    error.value = '更新状态失败'
    console.error('更新状态失败:', err)
  } finally {
    loading.value = false
  }
}

// 删除项目
const deleteItem = async (item) => {
  deleteTargetItem.value = item
  deleteDialogMessage.value = `确定要删除黑名单项"${item.value}"吗？`
  showDeleteDialog.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteTargetItem.value) return

  loading.value = true
  error.value = ''

  try {
    await $fetch(`/api/admin/blacklist/${deleteTargetItem.value.id}`, {
      method: 'DELETE',
      ...useAuth().getAuthConfig()
    })

    if (window.$showNotification) {
      window.$showNotification('黑名单项删除成功', 'success')
    }
    await loadBlacklist()
  } catch (err) {
    error.value = '删除失败'
    console.error('删除失败:', err)
    if (window.$showNotification) {
      window.$showNotification('删除失败: ' + err.message, 'error')
    }
  } finally {
    loading.value = false
    showDeleteDialog.value = false
    deleteTargetItem.value = null
  }
}

// 搜索防抖
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.page = 1
    loadBlacklist()
  }, 500)
}

// 切换页面
const changePage = (page) => {
  pagination.page = page
  loadBlacklist()
}

// 格式化日期
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadBlacklist()
})
</script>

<style scoped>
.blacklist-manager {
  padding: 20px;
  background: var(--bg-primary);
  min-height: 100vh;
  color: #e2e8f0;
}

.header {
  margin-bottom: 30px;
}

.header h3 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.description {
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.add-section, .filter-section, .blacklist-section {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #2a2a2a;
}

.add-section h4, .blacklist-section h4 {
  color: #fff;
  margin: 0 0 15px 0;
  font-size: 16px;
}

.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.filter-row {
  display: flex;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group.flex-1 {
  flex: 1;
}

.form-group label {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.form-input, .form-select {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-select option {
  background: #1a1a1a;
  color: #fff;
}

.add-btn {
  padding: 10px 20px;
  background: var(--btn-primary-bg);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.add-btn:hover:not(:disabled) {
  background: var(--btn-primary-hover-bg);
}

.add-btn:disabled {
  background: rgba(11, 90, 254, 0.5);
  cursor: not-allowed;
}

.blacklist-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blacklist-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.item-type.song {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.item-type.keyword {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.item-value {
  color: #fff;
  font-weight: 500;
}

.item-status.disabled {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

.item-actions {
  display: flex;
  gap: 8px;
}

.enable-btn, .disable-btn, .delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.enable-btn {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.enable-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.3);
}

.disable-btn {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.disable-btn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.3);
}

.delete-btn {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
}

.item-reason, .item-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 5px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.page-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.6);
}

.error, .success {
  padding: 12px;
  border-radius: 6px;
  margin-top: 15px;
  text-align: center;
}

.error {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.success {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.2);
}
</style>
