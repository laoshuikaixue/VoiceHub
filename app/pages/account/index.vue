<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900/50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1200px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-zinc-100"
            @click="goBack"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h1>
            <p class="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">
              {{ locale.subtitle }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-[1200px] mx-auto px-4">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- 左侧：用户信息概览 (PC端占据 4/12) -->
        <div class="lg:col-span-4 space-y-6">
          <section :class="sectionClass" class="flex flex-col items-center text-center">
            <div class="relative group">
              <div
                class="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-blue-900/20 mb-6 group-hover:scale-105 transition-transform duration-500"
              >
                <img
                  v-if="auth.user.value?.avatar && !avatarError"
                  :src="auth.user.value.avatar"
                  class="w-full h-full object-cover"
                  @error="avatarError = true"
                >
                <span v-else>{{ userInitials }}</span>
              </div>
              <div
                class="absolute -bottom-1 -right-1 p-2 bg-zinc-900 border border-zinc-800 rounded-full text-blue-500 shadow-xl"
              >
                <User :size="16" />
              </div>
            </div>

            <div class="space-y-2">
              <h2 class="text-2xl font-black text-zinc-100 tracking-tight">
                {{ auth.user.value?.name || auth.user.value?.username }}
              </h2>
              <p class="text-sm font-medium text-zinc-500">@{{ auth.user.value?.username }}</p>
            </div>

            <div class="flex flex-wrap justify-center gap-2 mt-6">
              <span
                class="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ roleName }}
              </span>
              <span
                v-if="auth.user.value?.grade"
                class="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ auth.user.value?.grade }}
              </span>
              <span
                v-if="auth.user.value?.class"
                class="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ auth.user.value?.class }}
              </span>
            </div>
          </section>
        </div>

        <!-- 右侧：详细设置 (PC端占据 8/12) -->
        <div class="lg:col-span-8 space-y-8">
          <!-- 第三方登录绑定 -->
          <section v-if="hasOAuthProviders" :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-purple-500/10 rounded-xl">
                <LinkIcon :size="20" class="text-purple-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">{{ locale.oauthBinding }}</h2>
                <p class="text-xs text-zinc-500 mt-0.5">{{ locale.oauthBindingDesc }}</p>
              </div>
            </div>
            <AuthOAuthBindingCard />
          </section>

          <!-- 个人 API Key -->
          <section :class="sectionClass">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="flex items-center gap-3">
                <div class="p-2.5 bg-emerald-500/10 rounded-xl">
                  <KeyRound :size="20" class="text-emerald-500" />
                </div>
                <div>
                  <h2 class="text-base font-black text-zinc-100">个人 API Key</h2>
                  <p class="text-xs text-zinc-500 mt-0.5">用于个人集成和投稿</p>
                </div>
              </div>
              <button
                class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                :disabled="apiKeyLoading || apiKeyCreating"
                @click="createPersonalApiKey"
              >
                <RefreshCw v-if="apiKeyCreating" :size="14" class="animate-spin" />
                <Plus v-else :size="14" />
                创建 API Key
              </button>
            </div>

            <div v-if="apiKeyLoading" class="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500 text-center">
              <RefreshCw :size="16" class="animate-spin" />
              <span>正在加载 API Key...</span>
            </div>

            <div
              v-else-if="personalApiKeys.length === 0"
              class="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-5 py-8 text-center"
            >
              <KeyRound :size="28" class="mx-auto text-zinc-700 mb-3" />
              <p class="text-sm font-bold text-zinc-300">还没有个人 API Key</p>
              <p class="text-xs text-zinc-600 mt-2 leading-relaxed">
                创建后可用于个人侧的集成与投稿。
              </p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="key in personalApiKeys"
                :key="key.id"
                class="rounded-2xl border border-zinc-800/70 bg-zinc-950/45 p-4"
              >
                <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-sm font-black text-zinc-100">{{ key.name }}</h3>
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-black border"
                        :class="getApiKeyStatusClass(key.status)"
                      >
                        {{ getApiKeyStatusLabel(key.status) }}
                      </span>
                    </div>
                    <p class="text-xs text-zinc-500 mt-1">{{ key.description || '暂无描述' }}</p>
                  </div>
                  <button
                    class="inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    :disabled="apiKeyDeletingId === key.id"
                    @click="deletePersonalApiKey(key)"
                  >
                    <RefreshCw v-if="apiKeyDeletingId === key.id" :size="13" class="animate-spin" />
                    <Trash2 v-else :size="13" />
                    删除
                  </button>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Key 前缀</p>
                    <p class="font-mono text-xs text-blue-400">{{ key.keyPrefix }}...</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">创建时间</p>
                    <p class="text-xs text-zinc-400">{{ formatDate(key.createdAt) }}</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">最后使用</p>
                    <p class="text-xs text-zinc-400">{{ key.lastUsedAt ? formatDate(key.lastUsedAt) : '从未使用' }}</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">调用次数</p>
                    <button
                      class="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors disabled:cursor-default disabled:opacity-60"
                      @click="openPersonalApiKeyLogs(key)"
                    >
                      {{ key.usageCount || 0 }}
                    </button>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">过期时间</p>
                    <p class="text-xs text-zinc-400">{{ key.expiresAt ? formatDate(key.expiresAt) : '永不过期' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 修改密码 -->
          <section :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-blue-500/10 rounded-xl">
                <Lock :size="20" class="text-blue-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">{{ locale.changePassword }}</h2>
                <p class="text-xs text-zinc-500 mt-0.5">{{ locale.changePasswordDesc }}</p>
              </div>
            </div>
            <div class="max-w-md">
              <AuthChangePasswordForm />
            </div>
          </section>

          <!-- 双重认证 -->
          <section :class="sectionClass">
            <AuthTwoFactorSetup :initial-enabled="auth.user.value?.has2FA" />
          </section>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model:show="showDeleteConfirmDialog"
      type="danger"
      title="删除个人 API Key"
      :message="deleteConfirmMessage"
      confirm-text="删除"
      cancel-text="取消"
      :loading="apiKeyDeletingId !== null"
      @confirm="confirmDeletePersonalApiKey"
      @cancel="cancelDeletePersonalApiKey"
    />

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="createdApiKey"
          class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div class="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
            <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 class="text-lg font-black text-zinc-100">API Key 创建成功</h3>
                <p class="text-xs text-zinc-500 mt-1">完整 Key 只会显示这一次</p>
              </div>
              <button class="text-zinc-500 hover:text-zinc-200 transition-colors" @click="closeCreatedApiKey">
                <X :size="20" />
              </button>
            </div>

            <div class="p-6 space-y-5">
              <div class="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-400">
                <AlertTriangle :size="18" class="shrink-0 mt-0.5" />
                <p class="text-xs font-bold leading-relaxed">
                  请现在复制并保存。关闭窗口后，VoiceHub 不会再次显示完整 Key。
                </p>
              </div>

              <div class="space-y-2">
                <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">完整 Key</p>
                <div class="flex items-stretch gap-2">
                  <div class="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-xs text-blue-400 break-all select-all">
                    {{ createdApiKey.apiKey }}
                  </div>
                  <button
                    class="w-12 rounded-xl flex items-center justify-center transition-all"
                    :class="apiKeyCopied ? 'bg-emerald-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'"
                    @click="copyApiKey(createdApiKey.apiKey)"
                  >
                    <Check v-if="apiKeyCopied" :size="16" />
                    <Copy v-else :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-zinc-800">
              <button
                class="w-full py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-black rounded-xl transition-all"
                @click="closeCreatedApiKey"
              >
                我已保存，关闭
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showApiKeyLogsModal"
          class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div class="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
            <div class="p-6 border-b border-zinc-800 flex items-start justify-between gap-4">
              <div>
                <h3 class="text-lg font-black text-zinc-100">调用记录</h3>
                <p class="text-xs text-zinc-500 mt-1">
                  {{ selectedApiKeyForLogs?.name || '个人 API Key' }} · 共 {{ apiKeyLogsPagination.total }} 条
                </p>
              </div>
              <button class="text-zinc-500 hover:text-zinc-200 transition-colors" @click="closePersonalApiKeyLogs">
                <X :size="20" />
              </button>
            </div>

            <div class="p-6">
              <div v-if="apiKeyLogsLoading" class="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
                <RefreshCw :size="16" class="animate-spin" />
                <span>正在加载调用记录...</span>
              </div>

              <div v-else-if="apiKeyLogs.length === 0" class="py-10 text-center">
                <p class="text-sm font-bold text-zinc-300">暂无调用记录</p>
                <p class="text-xs text-zinc-600 mt-2">这个令牌还没有产生过 API 调用。</p>
              </div>

              <div v-else class="space-y-4">
                <div class="overflow-hidden rounded-2xl border border-zinc-800">
                  <div class="max-h-[60vh] overflow-auto">
                    <table class="min-w-full text-left">
                      <thead class="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
                        <tr class="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          <th class="px-4 py-3">时间</th>
                          <th class="px-4 py-3">方法</th>
                          <th class="px-4 py-3">接口</th>
                          <th class="px-4 py-3">状态</th>
                          <th class="px-4 py-3">IP</th>
                          <th class="px-4 py-3">耗时</th>
                          <th class="px-4 py-3">错误</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="log in apiKeyLogs" :key="log.id" class="border-b border-zinc-900 last:border-0">
                          <td class="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{{ formatDate(log.createdAt) }}</td>
                          <td class="px-4 py-3">
                            <span
                              class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border"
                              :class="getApiMethodClass(log.method)"
                            >
                              {{ log.method }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-xs text-zinc-300 break-all">{{ log.endpoint }}</td>
                          <td class="px-4 py-3 text-xs font-bold" :class="getApiStatusClass(log.statusCode)">
                            {{ log.statusCode }}
                          </td>
                          <td class="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{{ log.ipAddress }}</td>
                          <td class="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{{ log.responseTimeMs }} ms</td>
                          <td class="px-4 py-3 text-xs text-zinc-500 break-all">
                            {{ log.errorMessage || '无' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs text-zinc-500">
                    第 {{ apiKeyLogsPagination.page }} / {{ apiKeyLogsPagination.totalPages || 1 }} 页
                  </p>
                  <div class="flex items-center gap-2">
                    <button
                      class="px-3 py-2 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-300 disabled:opacity-40"
                      :disabled="apiKeyLogsPagination.page <= 1 || apiKeyLogsLoading"
                      @click="changePersonalApiKeyLogsPage(apiKeyLogsPagination.page - 1)"
                    >
                      上一页
                    </button>
                    <button
                      class="px-3 py-2 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-300 disabled:opacity-40"
                      :disabled="apiKeyLogsPagination.page >= apiKeyLogsPagination.totalPages || apiKeyLogsLoading"
                      @click="changePersonalApiKeyLogsPage(apiKeyLogsPagination.page + 1)"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Link as LinkIcon,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  User,
  X
} from '@lucide/vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useLocale } from '~/utils/locale'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const { pages } = useLocale()
const locale = computed(() => pages.value.account)

const hasOAuthProviders = computed(() => {
  return oauthProviders.value.length > 0
})

const avatarError = ref(false)
const personalApiKeys = ref([])
const apiKeyLoading = ref(false)
const apiKeyCreating = ref(false)
const apiKeyDeletingId = ref(null)
const createdApiKey = ref(null)
const apiKeyCopied = ref(false)
const showDeleteConfirmDialog = ref(false)
const pendingDeleteApiKey = ref(null)
const showApiKeyLogsModal = ref(false)
const selectedApiKeyForLogs = ref(null)
const apiKeyLogs = ref([])
const apiKeyLogsLoading = ref(false)
const apiKeyLogsPagination = ref({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
})

// 监听用户头像变化，重置错误状态
watch(
  () => auth.user.value?.avatar,
  () => {
    avatarError.value = false
  }
)

// 处理来自 OAuth 回调的消息
onMounted(() => {
  refreshSiteConfig()
  loadPersonalApiKeys()

  if (route.query.message) {
    showToast(route.query.message, 'success')
    router.replace({ query: { ...route.query, message: undefined, error: undefined } })
  }
  if (route.query.error) {
    showToast(route.query.error, 'error')
    router.replace({ query: { ...route.query, message: undefined, error: undefined } })
  }
})

// 样式类常量
const sectionClass = 'bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl'

const userInitials = computed(() => {
  const name = auth.user.value?.name || auth.user.value?.username || 'U'
  return name.charAt(0).toUpperCase()
})

const roleName = computed(() => {
  const role = auth.user.value?.role
  return locale.value.roles[role] || role
})

const goBack = () => {
  navigateTo('/')
}

const loadPersonalApiKeys = async () => {
  apiKeyLoading.value = true
  try {
    const response = await $fetch('/api/user/api-keys')
    if (response.success) {
      personalApiKeys.value = response.data || []
    }
  } catch (error) {
    console.error('加载个人 API Key 失败:', error)
    showToast(error.data?.message || '加载个人 API Key 失败', 'error')
  } finally {
    apiKeyLoading.value = false
  }
}

const createPersonalApiKey = async () => {
  apiKeyCreating.value = true
  try {
    const response = await $fetch('/api/user/api-keys', {
      method: 'POST',
      body: {
        name: '个人 API Key',
        description: '用于个人集成和投稿'
      }
    })

    if (response.success) {
      createdApiKey.value = response.data
      showToast('个人 API Key 创建成功', 'success')
      await loadPersonalApiKeys()
    }
  } catch (error) {
    console.error('创建个人 API Key 失败:', error)
    showToast(error.data?.message || '创建个人 API Key 失败', 'error')
  } finally {
    apiKeyCreating.value = false
  }
}

const deletePersonalApiKey = async (key) => {
  pendingDeleteApiKey.value = key
  showDeleteConfirmDialog.value = true
}

const confirmDeletePersonalApiKey = async () => {
  const key = pendingDeleteApiKey.value
  if (!key) {
    showDeleteConfirmDialog.value = false
    return
  }

  apiKeyDeletingId.value = key.id
  try {
    const response = await $fetch(`/api/user/api-keys/${key.id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      showToast('个人 API Key 已删除', 'success')
      await loadPersonalApiKeys()
    }
  } catch (error) {
    console.error('删除个人 API Key 失败:', error)
    showToast(error.data?.message || '删除个人 API Key 失败', 'error')
  } finally {
    apiKeyDeletingId.value = null
    showDeleteConfirmDialog.value = false
    pendingDeleteApiKey.value = null
  }
}

const cancelDeletePersonalApiKey = () => {
  showDeleteConfirmDialog.value = false
  pendingDeleteApiKey.value = null
}

const deleteConfirmMessage = computed(() => {
  const key = pendingDeleteApiKey.value
  if (!key) {
    return '确定要删除这个个人 API Key 吗？删除后相关集成将无法继续使用。'
  }
  return `确定要删除个人 API Key “${key.name}”吗？删除后相关集成将无法继续使用。`
})

const copyApiKey = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    apiKeyCopied.value = true
    showToast('已复制到剪贴板', 'success')
    setTimeout(() => {
      apiKeyCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('复制 API Key 失败:', error)
    showToast('复制失败，请手动选择 Key 复制', 'error')
  }
}

const closeCreatedApiKey = () => {
  createdApiKey.value = null
  apiKeyCopied.value = false
}

const openPersonalApiKeyLogs = async (key) => {
  if (!key) {
    return
  }

  selectedApiKeyForLogs.value = key
  showApiKeyLogsModal.value = true
  apiKeyLogsPagination.value = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  }
  await loadPersonalApiKeyLogs(1)
}

const loadPersonalApiKeyLogs = async (page = 1) => {
  const key = selectedApiKeyForLogs.value
  if (!key) return

  apiKeyLogsLoading.value = true
  try {
    const response = await $fetch(`/api/user/api-keys/${key.id}/logs`, {
      query: {
        page,
        limit: apiKeyLogsPagination.value.limit
      }
    })

    if (response.success) {
      apiKeyLogs.value = response.data?.logs || []
      apiKeyLogsPagination.value = response.data?.pagination || {
        page,
        limit: apiKeyLogsPagination.value.limit,
        total: 0,
        totalPages: 0
      }
    }
  } catch (error) {
    console.error('加载个人 API Key 调用记录失败:', error)
    showToast(error.data?.message || '加载调用记录失败', 'error')
    apiKeyLogs.value = []
  } finally {
    apiKeyLogsLoading.value = false
  }
}

const changePersonalApiKeyLogsPage = async (page) => {
  if (page < 1) return
  if (apiKeyLogsPagination.value.totalPages > 0 && page > apiKeyLogsPagination.value.totalPages) return
  await loadPersonalApiKeyLogs(page)
}

const closePersonalApiKeyLogs = () => {
  showApiKeyLogsModal.value = false
  selectedApiKeyForLogs.value = null
  apiKeyLogs.value = []
  apiKeyLogsLoading.value = false
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getApiKeyStatusLabel = (status) => {
  const map = {
    active: '可用',
    inactive: '停用',
    expired: '已过期'
  }
  return map[status] || status
}

const getApiKeyStatusClass = (status) => {
  const map = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    inactive: 'bg-zinc-800 text-zinc-500 border-zinc-700/50',
    expired: 'bg-red-500/10 text-red-400 border-red-500/20'
  }
  return map[status] || 'bg-zinc-800 text-zinc-500 border-zinc-700/50'
}

const getApiMethodClass = (method) => {
  const map = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20'
  }
  return map[method] || 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
}

const getApiStatusClass = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) return 'text-emerald-400'
  if (statusCode >= 300 && statusCode < 400) return 'text-amber-400'
  return 'text-red-400'
}
</script>
