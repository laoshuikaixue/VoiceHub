<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button class="close-btn" @click="close">
              <Icon :size="20" name="close"/>
            </button>
          </div>

          <div class="modal-body">
            <div class="search-input-wrapper">
              <input
                  ref="searchInput"
                  v-model="searchQuery"
                  class="search-input"
                  placeholder="搜索用户名或姓名..."
                  type="text"
                  @input="handleSearch"
                  @keyup.enter="performSearch"
              >
              <div v-if="loading" class="search-loading">
                <div class="search-spinner"></div>
              </div>
            </div>

            <div class="search-results">
              <div v-if="users.length === 0 && !loading && hasSearched" class="no-results">
                未找到匹配的用户
              </div>

              <div
                  v-for="user in users"
                  :key="user.id"
                  :class="{ 'selected': isSelected(user) }"
                  class="user-item"
                  @click="toggleSelection(user)"
              >
                <div class="user-avatar">
                  {{ user.name.charAt(0) }}
                </div>
                <div class="user-info">
                  <div class="user-name">{{ user.name }}</div>
                  <div class="user-meta">
                    <span v-if="user.grade">{{ user.grade }}</span>
                    <span v-if="user.class">{{ user.class }}</span>
                    <span class="username">@{{ user.username }}</span>
                  </div>
                </div>
                <div class="selection-indicator">
                  <Icon v-if="isSelected(user)" :size="16" name="check"/>
                  <div v-else class="checkbox-placeholder"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div v-if="selectedUsers.length > 0" class="selected-count">
              已选择 {{ selectedUsers.length }} 人
            </div>
            <div class="actions">
              <button class="btn btn-secondary" @click="close">取消</button>
              <button :disabled="selectedUsers.length === 0" class="btn btn-primary" @click="confirm">
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import {ref, watch, nextTick} from 'vue'
import Icon from '~/components/UI/Icon.vue'

// 简单的防抖函数实现
function useDebounceFn(fn, delay) {
  let timeoutId
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

const props = defineProps({
  show: Boolean,
  title: {
    type: String,
    default: '搜索用户'
  },
  multiple: {
    type: Boolean,
    default: true
  },
  excludeIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:show', 'select'])

const searchQuery = ref('')
const users = ref([])
const loading = ref(false)
const hasSearched = ref(false)
const selectedUsers = ref([])
const searchInput = ref(null)

const close = () => {
  emit('update:show', false)
}

const isSelected = (user) => {
  return selectedUsers.value.some(u => u.id === user.id)
}

const toggleSelection = (user) => {
  if (props.multiple) {
    const index = selectedUsers.value.findIndex(u => u.id === user.id)
    if (index === -1) {
      selectedUsers.value.push(user)
    } else {
      selectedUsers.value.splice(index, 1)
    }
  } else {
    selectedUsers.value = [user]
  }
}

const confirm = () => {
  emit('select', props.multiple ? selectedUsers.value : selectedUsers.value[0])
  close()
}

const performSearch = async () => {
  if (!searchQuery.value.trim()) return

  loading.value = true
  hasSearched.value = true

  try {
    const data = await $fetch('/api/users/search', {
      params: {keyword: searchQuery.value}
    })

    if (data.success) {
      // 过滤掉排除的用户
      users.value = data.users.filter(u => !props.excludeIds.includes(u.id))
    }
  } catch (error) {
    console.error('搜索用户失败', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = useDebounceFn(() => {
  performSearch()
}, 500)

watch(() => props.show, (newVal) => {
  if (newVal) {
    searchQuery.value = ''
    users.value = []
    selectedUsers.value = []
    hasSearched.value = false
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e1e24;
  width: 90%;
  max-width: 500px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.search-input-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary, #0B5AFE);
  background: rgba(255, 255, 255, 0.1);
}

.search-loading {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}

.search-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--primary, #0B5AFE);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 200px;
}

.no-results {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 40px 0;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.02);
}

.user-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.user-item.selected {
  background: rgba(11, 90, 254, 0.1);
  border: 1px solid rgba(11, 90, 254, 0.2);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #fff;
  margin-right: 12px;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 500;
  color: #fff;
  margin-bottom: 2px;
}

.user-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  gap: 6px;
}

.selection-indicator {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-placeholder {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selected-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background: var(--primary, #0B5AFE);
  color: #fff;
}

.btn-primary:hover {
  background: #0043F8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-content,
.modal-fade-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-fade-enter-from .modal-content {
  transform: scale(0.95) translateY(20px);
}

.modal-fade-leave-to .modal-content {
  transform: scale(0.95) translateY(20px);
}
</style>
