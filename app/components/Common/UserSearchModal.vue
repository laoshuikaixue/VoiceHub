<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between p-8 pb-4">
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
              >
                <Icon name="user" :size="24" />
              </div>
              <h3 class="text-xl font-black text-zinc-100 tracking-tight">{{ title }}</h3>
            </div>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
              @click="close"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
            <!-- 搜索输入框 -->
            <div class="relative mb-6 group">
              <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Icon
                  name="search"
                  :size="20"
                  class="text-zinc-500 group-focus-within:text-zinc-300 transition-colors"
                />
              </div>
              <input
                ref="searchInput"
                v-model="searchQuery"
                class="w-full pl-12 pr-12 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all"
                placeholder="搜索用户名或姓名..."
                type="text"
                @input="handleSearch"
                @keyup.enter="performSearch"
              >
              <div v-if="loading" class="absolute inset-y-0 right-4 flex items-center">
                <Icon name="loader" :size="20" class="text-zinc-400 animate-spin" />
              </div>
            </div>

            <!-- 搜索结果 -->
            <div class="user-list space-y-3 min-h-[300px]">
              <div
                v-if="users.length === 0 && !loading && hasSearched"
                class="flex flex-col items-center justify-center py-12 text-zinc-500"
              >
                <div
                  class="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mb-4"
                >
                  <Icon name="search" :size="32" class="opacity-20" />
                </div>
                <p class="text-sm font-bold uppercase tracking-widest">未找到匹配的用户</p>
              </div>

              <div
                v-for="user in users"
                :key="user.id"
                :class="[
                  'group flex items-center p-4 rounded-2xl border transition-all cursor-pointer',
                  isSelected(user)
                    ? 'bg-blue-600/10 border-blue-500/30 shadow-lg'
                    : 'bg-zinc-950 border-transparent hover:border-zinc-800'
                ]"
                @click="toggleSelection(user)"
              >
                <!-- 头像 -->
                <div
                  :class="[
                    'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black mr-4 transition-colors',
                    isSelected(user) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'
                  ]"
                >
                  {{ user.name.charAt(0) }}
                </div>

                <!-- 用户信息 -->
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-zinc-100 truncate">
                    {{ user.name }}
                  </div>
                  <div
                    class="text-[10px] font-black uppercase tracking-widest flex flex-wrap gap-2 mt-0.5 text-zinc-500"
                  >
                    <span v-if="user.grade" class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40" />
                      {{ user.grade }}
                    </span>
                    <span v-if="user.class" class="flex items-center">
                      <span class="w-1 h-1 rounded-full bg-current mr-1.5 opacity-40" />
                      {{ user.class }}
                    </span>
                    <span class="truncate">@{{ user.username }}</span>
                  </div>
                </div>

                <!-- 选中指示器 -->
                <div class="ml-4">
                  <div
                    :class="[
                      'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                      isSelected(user)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-zinc-800 group-hover:border-zinc-700'
                    ]"
                  >
                    <Icon v-if="isSelected(user)" name="check" :size="14" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="p-8 pt-0">
            <div class="flex items-center justify-between gap-4">
              <div class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <span v-if="selectedUsers.length > 0" class="text-blue-500">
                  已选择 {{ selectedUsers.length }} 人
                </span>
              </div>
              <div class="flex gap-3">
                <button
                  class="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black transition-all active:scale-95 uppercase tracking-widest"
                  @click="close"
                >
                  取消
                </button>
                <button
                  :disabled="selectedUsers.length === 0"
                  class="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-blue-900/20"
                  @click="confirm"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
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
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
