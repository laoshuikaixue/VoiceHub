<template>
  <AppModal
    :show="show"
    :title="resolvedTitle"
    size="lg"
    @close="close"
  >
    <template #icon>
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-hover-10 text-primary"
      >
        <Icon name="user" :size="18" />
      </span>
    </template>


            <!-- 搜索输入框 -->
            <div class="relative mb-6 group">
              <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Icon
                  name="search"
                  :size="20"
                  class="text-text-tertiary group-focus-within:text-text-secondary transition-colors"
                />
              </div>
              <input
                ref="searchInput"
                v-model="searchQuery"
                class="w-full pl-12 pr-12 py-4 bg-bg-primary border border-border-secondary rounded-2xl text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary-30 transition-all"
                :placeholder="locale.searchUsersPlaceholder"
                type="text"
                @input="handleSearch"
                @keyup.enter="performSearch"
              >
              <div v-if="loading" class="absolute inset-y-0 right-4 flex items-center">
                <Icon name="loader" :size="20" class="text-text-tertiary animate-spin" />
              </div>
            </div>

            <!-- 搜索结果 -->
            <div class="user-list space-y-3 min-h-[300px]">
              <div
                v-if="users.length === 0 && !loading && hasSearched"
                class="flex flex-col items-center justify-center py-12 text-text-tertiary"
              >
                <div
                  class="w-16 h-16 rounded-2xl bg-bg-tertiary-50 flex items-center justify-center mb-4"
                >
                  <Icon name="search" :size="32" class="opacity-20" />
                </div>
                <p class="text-sm font-bold uppercase tracking-wider">{{ locale.noMatchingUsers }}</p>
              </div>

              <div
                v-for="user in users"
                :key="user.id"
                :class="[
                  'group flex items-center p-4 rounded-2xl border transition-all cursor-pointer',
                  isSelected(user)
                    ? 'bg-primary-hover-10 border-primary-30 shadow-lg'
                    : 'bg-bg-primary border-transparent hover:border-border-secondary'
                ]"
                @click="toggleSelection(user)"
              >
                <!-- 头像 -->
                <div
                  :class="[
                    'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold mr-4 transition-colors',
                    isSelected(user) ? 'bg-primary-hover text-text-primary' : 'bg-bg-tertiary text-text-tertiary'
                  ]"
                >
                  {{ user.name.charAt(0) }}
                </div>

                <!-- 用户信息 -->
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-text-primary truncate">
                    {{ user.name }}
                  </div>
                  <div
                    class="text-xs font-bold uppercase tracking-wider flex flex-wrap gap-2 mt-0.5 text-text-tertiary"
                  >
                    <span v-if="user.grade" class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40" />
                      {{ user.grade }}
                    </span>
                    <span v-if="user.class" class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40" />
                      {{ user.class }}
                    </span>
                  </div>
                </div>

                <!-- 选中指示器 -->
                <div class="ml-4">
                  <div
                    :class="[
                      'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                      isSelected(user)
                        ? 'bg-primary-hover border-primary text-text-primary'
                        : 'border-border-secondary group-hover:border-border-tertiary'
                    ]"
                  >
                    <Icon v-if="isSelected(user)" name="check" :size="14" />
                  </div>
                </div>
              </div>
            </div>

    <template #footer>
            <div class="flex w-full items-center justify-between gap-4">
              <div class="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                <span v-if="selectedUsers.length > 0" class="text-primary">
                  {{ formatLocale(locale.selectedUsers, selectedUsers.length) }}
                </span>
              </div>
              <div class="flex gap-3">
                <button
                  class="px-6 py-3 rounded-xl bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold transition-all active:scale-95 uppercase tracking-wider"
                  @click="close"
                >
                  {{ locale.cancel }}
                </button>
                <button
                  :disabled="selectedUsers.length === 0"
                  class="px-8 py-3 rounded-xl bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold disabled:opacity-50 transition-all active:scale-95 uppercase tracking-wider shadow-lg shadow-[var(--primary-glow)]"
                  @click="confirm"
                >
                  {{ locale.confirm }}
                </button>
              </div>
            </div>
    </template>
  </AppModal>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'

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
    default: ''
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
const { common } = useLocale()
const locale = computed(() => common.value || {})
const resolvedTitle = computed(() => {
  if (props.title) return props.title
  const title = locale.value.searchUsers
  return typeof title === 'function' ? title() : (title || '')
})

const close = () => {
  emit('update:show', false)
}

const isSelected = (user) => {
  return selectedUsers.value.some((u) => u.id === user.id)
}

const toggleSelection = (user) => {
  if (props.multiple) {
    const index = selectedUsers.value.findIndex((u) => u.id === user.id)
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
      params: { keyword: searchQuery.value }
    })

    if (data.success) {
      // 过滤掉排除的用户
      users.value = data.users.filter((u) => !props.excludeIds.includes(u.id))
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

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      searchQuery.value = ''
      users.value = []
      selectedUsers.value = []
      hasSearched.value = false
      nextTick(() => {
        searchInput.value?.focus()
      })
    }
  }
)
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--overlay-10);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--overlay-20);
}
</style>
