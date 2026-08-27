<template>
  <div class="min-h-screen bg-bg-primary text-text-primary pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-bg-primary-80 backdrop-blur-xl border-b border-border-secondary-50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1200px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-bg-secondary rounded-xl transition-all text-text-tertiary hover:text-text-primary"
            @click="goBack"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-text-primary tracking-tight">{{ locale.title }}</h1>
            <p class="text-[10px] text-text-tertiary font-medium uppercase tracking-widest mt-0.5">
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
                class="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-text-primary text-4xl font-black shadow-2xl shadow-[var(--primary-glow)] mb-6 group-hover:scale-105 transition-transform duration-500"
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
                class="absolute -bottom-1 -right-1 p-2 bg-bg-secondary border border-border-secondary rounded-full text-primary shadow-xl flex items-center justify-center"
              >
                <User :size="16" />
              </div>
            </div>

            <div class="space-y-2">
              <h2 class="text-2xl font-black text-text-primary tracking-tight">
                {{ auth.user.value?.name || auth.user.value?.username }}
              </h2>
              <p class="text-sm font-medium text-text-tertiary">@{{ auth.user.value?.username }}</p>
            </div>

            <div class="flex flex-wrap justify-center gap-2 mt-6">
              <span
                class="px-3 py-1 bg-primary-10 border border-primary-20 text-primary text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ roleName }}
              </span>
              <span
                v-if="auth.user.value?.grade"
                class="px-3 py-1 bg-bg-tertiary text-text-tertiary text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ auth.user.value?.grade }}
              </span>
              <span
                v-if="auth.user.value?.class"
                class="px-3 py-1 bg-bg-tertiary text-text-tertiary text-[10px] font-black uppercase tracking-wider rounded-full"
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
            <div class="flex items-center gap-3 border-b border-border-secondary-50 pb-5 mb-6">
              <div class="p-2.5 bg-info-10 rounded-xl flex items-center justify-center">
                <LinkIcon :size="20" class="text-info" />
              </div>
              <div>
                <h2 class="text-base font-black text-text-primary">{{ locale.oauthBinding }}</h2>
                <p class="text-xs text-text-tertiary mt-0.5">{{ locale.oauthBindingDesc }}</p>
              </div>
            </div>
            <AuthOAuthBindingCard />
          </section>

          <!-- 社交账号绑定 -->
          <AccountSocialBindings />

          <!-- 个人 API Key -->
          <section :class="sectionClass">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-secondary-50 pb-5 mb-6">
              <div class="flex items-center gap-3">
                <div class="p-2.5 bg-success-10 rounded-xl flex items-center justify-center">
                  <KeyRound :size="20" class="text-success" />
                </div>
                <div>
                  <h2 class="text-base font-black text-text-primary">{{ locale.personalApiKey.title }}</h2>
                  <p class="text-xs text-text-tertiary mt-0.5">{{ locale.personalApiKey.desc }}</p>
                </div>
              </div>
              <button
                class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-success hover:bg-success text-text-primary text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                :disabled="apiKeyLoading || apiKeyCreating"
                @click="createPersonalApiKey"
              >
                <RefreshCw v-if="apiKeyCreating" :size="14" class="animate-spin" />
                <Plus v-else :size="14" />
                {{ locale.personalApiKey.create }}
              </button>
            </div>

            <div v-if="apiKeyLoading" class="flex items-center justify-center gap-2 py-8 text-xs text-text-tertiary text-center">
              <RefreshCw :size="16" class="animate-spin" />
              <span>{{ locale.personalApiKey.loading }}</span>
            </div>

            <div
              v-else-if="personalApiKeys.length === 0"
              class="rounded-2xl border border-dashed border-border-secondary bg-bg-primary-40 px-5 py-8 text-center"
            >
              <KeyRound :size="28" class="mx-auto text-text-secondary mb-3" />
              <p class="text-sm font-bold text-text-secondary">{{ locale.personalApiKey.emptyTitle }}</p>
              <p class="text-xs text-text-disabled mt-2 leading-relaxed">
                {{ locale.personalApiKey.emptyDesc }}
              </p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="key in personalApiKeys"
                :key="key.id"
                class="rounded-2xl border border-border-secondary-70 bg-bg-primary-45 p-4"
              >
                <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-sm font-black text-text-primary">{{ key.name }}</h3>
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-black border"
                        :class="getApiKeyStatusClass(key.status)"
                      >
                        {{ getApiKeyStatusLabel(key.status) }}
                      </span>
                    </div>
                    <p class="text-xs text-text-tertiary mt-1">{{ key.description || locale.personalApiKey.noDescription }}</p>
                  </div>
                  <button
                    class="inline-flex items-center justify-center gap-2 px-3 py-2 border border-error-20 bg-error-10 text-error hover:bg-error-15 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    :disabled="apiKeyDeletingId === key.id"
                    @click="deletePersonalApiKey(key)"
                  >
                    <RefreshCw v-if="apiKeyDeletingId === key.id" :size="13" class="animate-spin" />
                    <Trash2 v-else :size="13" />
                    {{ locale.personalApiKey.delete }}
                  </button>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ locale.personalApiKey.keyPrefix }}</p>
                    <p class="font-mono text-xs text-primary">{{ key.keyPrefix }}...</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ locale.personalApiKey.createdAt }}</p>
                    <p class="text-xs text-text-tertiary">{{ formatDate(key.createdAt) }}</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ locale.personalApiKey.lastUsedAt }}</p>
                    <p class="text-xs text-text-tertiary">{{ key.lastUsedAt ? formatDate(key.lastUsedAt) : locale.personalApiKey.neverUsed }}</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ locale.personalApiKey.usageCount }}</p>
                    <button
                      class="text-xs font-bold text-success hover:text-success-hover transition-colors disabled:cursor-default disabled:opacity-60"
                      @click="openPersonalApiKeyLogs(key)"
                    >
                      {{ key.usageCount || 0 }}
                    </button>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ locale.personalApiKey.expiresAt }}</p>
                    <p class="text-xs text-text-tertiary">{{ key.expiresAt ? formatDate(key.expiresAt) : locale.personalApiKey.neverExpires }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 修改密码 -->
          <section :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-border-secondary-50 pb-5 mb-6">
              <div class="p-2.5 bg-primary-10 rounded-xl flex items-center justify-center">
                <Lock :size="20" class="text-primary" />
              </div>
              <div>
                <h2 class="text-base font-black text-text-primary">{{ locale.changePassword }}</h2>
                <p class="text-xs text-text-tertiary mt-0.5">{{ locale.changePasswordDesc }}</p>
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

          <!-- 登录会话 -->
          <section :class="sectionClass">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-secondary-50 pb-5 mb-6">
              <div class="flex items-center gap-3">
                <div class="p-2.5 bg-info-10 rounded-xl flex items-center justify-center"><Monitor :size="20" class="text-info" /></div>
                <div>
                  <h2 class="text-base font-black text-text-primary">{{ locale.sessions.title }}</h2>
                  <p class="text-xs text-text-tertiary mt-0.5">{{ locale.sessions.desc }}</p>
                </div>
              </div>
              <button class="inline-flex items-center justify-center gap-2 px-3 py-2 border border-border-secondary bg-bg-primary-40 hover:bg-bg-tertiary text-text-secondary text-xs font-bold rounded-xl transition-all disabled:opacity-50" :disabled="sessionsLoading || sessionsRevoking" @click="loadSessions">
                <RefreshCw :size="14" :class="{ 'animate-spin': sessionsLoading }" /> {{ locale.sessions.refresh }}
              </button>
            </div>
            <div v-if="sessionsLoading" class="flex items-center justify-center gap-2 py-8 text-xs text-text-tertiary"><RefreshCw :size="16" class="animate-spin" />{{ locale.sessions.loading }}</div>
            <div v-else-if="sessions.length === 0" class="py-8 text-center text-xs text-text-tertiary">{{ locale.sessions.empty }}</div>
            <div v-else class="space-y-3">
              <div v-for="session in sessions" :key="session.id" class="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-border-secondary-70 bg-bg-primary-45 p-4">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-10 h-10 shrink-0 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary"><Monitor :size="19" /></div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2"><p class="text-sm font-black text-text-primary">{{ session.browser }} · {{ session.operatingSystem }}</p><span v-if="session.current" class="px-2 py-0.5 rounded-full bg-success-10 text-success text-[10px] font-bold">{{ locale.sessions.current }}</span></div>
                    <p class="text-xs text-text-tertiary mt-1">{{ locale.sessions.ip }}: {{ session.ipAddress || '-' }} · {{ locale.sessions.loginMethod }}: {{ getSessionMethod(session.loginMethod) }}</p>
                    <p class="text-xs text-text-tertiary mt-1">{{ locale.sessions.lastActive }}: {{ formatDate(session.lastActiveAt) }} · {{ locale.sessions.expiresAt }}: {{ formatDate(session.expiresAt) }}</p>
                  </div>
                </div>
                <button class="inline-flex items-center justify-center gap-2 shrink-0 px-3 py-2 border border-error-20 bg-error-10 hover:bg-error-15 text-error text-xs font-bold rounded-xl transition-all disabled:opacity-50" :disabled="sessionsRevoking" @click="revokeSession(session)"><LogOut :size="14" />{{ locale.sessions.logout }}</button>
              </div>
              <button v-if="sessions.length > 1" class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-error-20 bg-error-10 hover:bg-error-15 text-error text-xs font-bold rounded-xl transition-all disabled:opacity-50" :disabled="sessionsRevoking" @click="revokeOtherSessions"><LogOut :size="14" />{{ locale.sessions.logoutOthers }}</button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model:show="showDeleteConfirmDialog"
      type="danger"
      :title="locale.personalApiKey.deleteTitle"
      :message="deleteConfirmMessage"
      :confirm-text="locale.personalApiKey.delete"
      :cancel-text="locale.personalApiKey.cancel"
      :loading="apiKeyDeletingId !== null"
      @confirm="confirmDeletePersonalApiKey"
      @cancel="cancelDeletePersonalApiKey"
    />

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="createdApiKey"
          class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-bg-primary-70 backdrop-blur-sm"
        >
          <div class="w-full max-w-xl bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden">
            <div class="p-6 border-b border-border-secondary flex items-center justify-between">
              <div>
                <h3 class="text-lg font-black text-text-primary">{{ locale.personalApiKey.createdTitle }}</h3>
                <p class="text-xs text-text-tertiary mt-1">{{ locale.personalApiKey.createdDesc }}</p>
              </div>
              <button class="text-text-tertiary hover:text-text-primary transition-colors" @click="closeCreatedApiKey">
                <X :size="20" />
              </button>
            </div>

            <div class="p-6 space-y-5">
              <div class="flex items-start gap-3 rounded-2xl border border-warning-20 bg-warning-10 p-4 text-warning">
                <AlertTriangle :size="18" class="shrink-0 mt-0.5" />
                <p class="text-xs font-bold leading-relaxed">
                  {{ locale.personalApiKey.copyWarning }}
                </p>
              </div>

              <div class="space-y-2">
                <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ locale.personalApiKey.fullKey }}</p>
                <div class="flex items-stretch gap-2">
                  <div class="flex-1 min-w-0 rounded-xl border border-border-secondary bg-bg-primary px-4 py-3 font-mono text-xs text-primary break-all select-all">
                    {{ createdApiKey.apiKey }}
                  </div>
                  <button
                    class="w-12 rounded-xl flex items-center justify-center transition-all"
                    :class="apiKeyCopied ? 'bg-success text-text-primary' : 'bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary'"
                    @click="copyApiKey(createdApiKey.apiKey)"
                  >
                    <Check v-if="apiKeyCopied" :size="16" />
                    <Copy v-else :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div class="p-6 border-t border-border-secondary">
              <button
                class="w-full py-3 bg-bg-primary border border-border-secondary hover:border-border-tertiary text-text-primary text-xs font-black rounded-xl transition-all"
                @click="closeCreatedApiKey"
              >
                {{ locale.personalApiKey.closeSaved }}
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
          class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-bg-primary-70 backdrop-blur-sm"
        >
          <div class="w-full max-w-4xl bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden">
            <div class="p-6 border-b border-border-secondary flex items-start justify-between gap-4">
              <div>
                <h3 class="text-lg font-black text-text-primary">{{ locale.personalApiKey.logsTitle }}</h3>
                <p class="text-xs text-text-tertiary mt-1">
                  {{ locale.personalApiKey.logsSubtitle(selectedApiKeyForLogs?.name || locale.personalApiKey.defaultName, apiKeyLogsPagination.total) }}
                </p>
              </div>
              <button class="text-text-tertiary hover:text-text-primary transition-colors" @click="closePersonalApiKeyLogs">
                <X :size="20" />
              </button>
            </div>

            <div class="p-6">
              <div v-if="apiKeyLogsLoading" class="flex items-center justify-center gap-2 py-10 text-xs text-text-tertiary">
                <RefreshCw :size="16" class="animate-spin" />
                <span>{{ locale.personalApiKey.loadingLogs }}</span>
              </div>

              <div v-else-if="apiKeyLogs.length === 0" class="py-10 text-center">
                <p class="text-sm font-bold text-text-secondary">{{ locale.personalApiKey.noLogs }}</p>
                <p class="text-xs text-text-disabled mt-2">{{ locale.personalApiKey.noLogsDesc }}</p>
              </div>

              <div v-else class="space-y-4">
                <div class="overflow-hidden rounded-2xl border border-border-secondary">
                  <div class="max-h-[60vh] overflow-auto">
                    <table class="min-w-full text-left">
                      <thead class="sticky top-0 bg-bg-primary-95 backdrop-blur border-b border-border-secondary">
                        <tr class="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                          <th class="px-4 py-3">{{ locale.personalApiKey.logColumns.time }}</th>
                          <th class="px-4 py-3">{{ locale.personalApiKey.logColumns.method }}</th>
                          <th class="px-4 py-3">{{ locale.personalApiKey.logColumns.endpoint }}</th>
                          <th class="px-4 py-3">{{ locale.personalApiKey.logColumns.status }}</th>
                          <th class="px-4 py-3">IP</th>
                          <th class="px-4 py-3">{{ locale.personalApiKey.logColumns.duration }}</th>
                          <th class="px-4 py-3">{{ locale.personalApiKey.logColumns.error }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="log in apiKeyLogs" :key="log.id" class="border-b border-border-secondary last:border-0">
                          <td class="px-4 py-3 text-xs text-text-tertiary whitespace-nowrap">{{ formatDate(log.createdAt) }}</td>
                          <td class="px-4 py-3">
                            <span
                              class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border"
                              :class="getApiMethodClass(log.method)"
                            >
                              {{ log.method }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-xs text-text-secondary break-all">{{ log.endpoint }}</td>
                          <td class="px-4 py-3 text-xs font-bold" :class="getApiStatusClass(log.statusCode)">
                            {{ log.statusCode }}
                          </td>
                          <td class="px-4 py-3 text-xs text-text-tertiary whitespace-nowrap">{{ log.ipAddress }}</td>
                          <td class="px-4 py-3 text-xs text-text-tertiary whitespace-nowrap">{{ log.responseTimeMs }} ms</td>
                          <td class="px-4 py-3 text-xs text-text-tertiary break-all">
                            {{ log.errorMessage || locale.personalApiKey.none }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs text-text-tertiary">
                    {{ locale.personalApiKey.pageInfo(apiKeyLogsPagination.page, apiKeyLogsPagination.totalPages || 1) }}
                  </p>
                  <div class="flex items-center gap-2">
                    <button
                      class="px-3 py-2 rounded-xl border border-border-secondary text-xs font-bold text-text-secondary disabled:opacity-40"
                      :disabled="apiKeyLogsPagination.page <= 1 || apiKeyLogsLoading"
                      @click="changePersonalApiKeyLogsPage(apiKeyLogsPagination.page - 1)"
                    >
                      {{ locale.personalApiKey.previousPage }}
                    </button>
                    <button
                      class="px-3 py-2 rounded-xl border border-border-secondary text-xs font-bold text-text-secondary disabled:opacity-40"
                      :disabled="apiKeyLogsPagination.page >= apiKeyLogsPagination.totalPages || apiKeyLogsLoading"
                      @click="changePersonalApiKeyLogsPage(apiKeyLogsPagination.page + 1)"
                    >
                      {{ locale.personalApiKey.nextPage }}
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
  LogOut,
  Monitor,
  Plus,
  RefreshCw,
  Trash2,
  User,
  X
} from '@lucide/vue'
import AccountSocialBindings from '~/components/Account/SocialBindings.vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { getProviderDisplayName } from '~/utils/oauth'
import { useScrollMemory } from '~/composables/useScrollMemory'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const { oauthProviders, refreshSiteConfig } = useSiteConfig()
const { currentLocale, pages } = useLocale()
const { localize: localizeServerError } = useServerErrors()
const locale = computed(() => pages.value?.account || {})
// 记忆并恢复页面滚动位置
useScrollMemory()
const getAccountText = (path, ...args) => {
  const value = String(path).split('.').reduce((target, key) => target?.[key], locale.value?.personalApiKey)
  return formatLocaleValue(value, ...args)
}

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
const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsRevoking = ref(false)

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
  loadSessions()

  if (route.query.message) {
    showToast(route.query.message, 'success')
    router.replace({ query: { ...route.query, message: undefined, error: undefined } })
  }
  if (route.query.error) {
    showToast(route.query.error, 'error')
    router.replace({ query: { ...route.query, message: undefined, error: undefined } })
  }
})

const loadSessions = async () => {
  sessionsLoading.value = true
  try {
    const response = await $fetch('/api/user/sessions')
    sessions.value = response.data || []
  } catch (error) {
    console.error('加载登录会话失败:', error)
    showToast(localizeServerError(error, locale.value.sessions.loadFailed), 'error')
  } finally {
    sessionsLoading.value = false
  }
}

const revokeSession = async (session) => {
  sessionsRevoking.value = true
  try {
    await $fetch('/api/user/sessions', { method: 'DELETE', query: { id: session.id } })
    if (session.current) {
      await auth.logout()
      return
    }
    showToast(locale.value.sessions.logoutSuccess, 'success')
    await loadSessions()
  } catch (error) {
    showToast(localizeServerError(error, locale.value.sessions.logoutFailed), 'error')
  } finally {
    sessionsRevoking.value = false
  }
}

const revokeOtherSessions = async () => {
  sessionsRevoking.value = true
  try {
    await $fetch('/api/user/sessions', { method: 'DELETE' })
    showToast(locale.value.sessions.logoutOthersSuccess, 'success')
    await loadSessions()
  } catch (error) {
    showToast(localizeServerError(error, locale.value.sessions.logoutFailed), 'error')
  } finally {
    sessionsRevoking.value = false
  }
}

const getSessionMethod = (method) => {
  if (!method) return '-'
  const baseMap = {
    password: locale.value.sessions.methods.password,
    '2fa': locale.value.sessions.methods.twoFactor,
    webauthn: locale.value.sessions.methods.webauthn,
    legacy: locale.value.sessions.methods.legacy
  }
  if (baseMap[method]) return baseMap[method]
  return getProviderDisplayName(method)
}

// 样式类常量
const sectionClass = 'bg-bg-secondary-40 border border-border-secondary rounded-3xl p-6 md:p-8 shadow-2xl'

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
    showToast(getErrorMessage(error) || getAccountText('loadFailed'), 'error')
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
        name: locale.value.personalApiKey.defaultName,
        description: locale.value.personalApiKey.defaultDescription
      }
    })

    if (response.success) {
      createdApiKey.value = response.data
      showToast(getAccountText('createSuccess'), 'success')
      await loadPersonalApiKeys()
    }
  } catch (error) {
    console.error('创建个人 API Key 失败:', error)
    showToast(getErrorMessage(error) || getAccountText('createFailed'), 'error')
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
      showToast(getAccountText('deleteSuccess'), 'success')
      await loadPersonalApiKeys()
    }
  } catch (error) {
    console.error('删除个人 API Key 失败:', error)
    showToast(getErrorMessage(error) || getAccountText('deleteFailed'), 'error')
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
    return getAccountText('deleteMessageDefault')
  }
  return getAccountText('deleteMessage', key.name)
})

const copyApiKey = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    apiKeyCopied.value = true
    showToast(getAccountText('copied'), 'success')
    setTimeout(() => {
      apiKeyCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('复制 API Key 失败:', error)
    showToast(getAccountText('copyFailed'), 'error')
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
    showToast(getErrorMessage(error) || getAccountText('logsFailed'), 'error')
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
  return date.toLocaleString(currentLocale.value === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getApiKeyStatusLabel = (status) => {
  const map = {
    active: getAccountText('status.active'),
    inactive: getAccountText('status.inactive'),
    expired: getAccountText('status.expired')
  }
  return map[status] || status
}

const getApiKeyStatusClass = (status) => {
  const map = {
    active: 'bg-success-10 text-success border-success-20',
    inactive: 'bg-bg-tertiary text-text-tertiary border-border-tertiary-50',
    expired: 'bg-error-10 text-error border-error-20'
  }
  return map[status] || 'bg-bg-tertiary text-text-tertiary border-border-tertiary-50'
}

const getApiMethodClass = (method) => {
  const map = {
    GET: 'bg-success-10 text-success border-success-20',
    POST: 'bg-primary-10 text-primary border-primary-20',
    PUT: 'bg-warning-10 text-warning border-warning-20',
    DELETE: 'bg-error-10 text-error border-error-20'
  }
  return map[method] || 'bg-bg-tertiary text-text-tertiary border-border-tertiary-50'
}

const getApiStatusClass = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) return 'text-success'
  if (statusCode >= 300 && statusCode < 400) return 'text-warning'
  return 'text-error'
}
</script>
