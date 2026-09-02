<!-- 角色权限管理（spec [S5.3]） -->
<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <!-- 头部 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title || '角色与权限' }}</h2>
        <p class="text-xs text-text-tertiary mt-1">{{ locale.desc || '管理权限定义、角色矩阵与个人加授' }}</p>
      </div>
      <button
        v-if="rbac.can(PERMISSIONS.USER_PERMISSIONS_MANAGE)"
        class="flex items-center gap-2 px-4 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl transition-all shadow-lg shadow-[var(--primary-glow)] active:scale-95"
        @click="openCreateModal"
      >
        <Plus :size="14" /> {{ locale.createGrant || '新增加授' }}
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-2 border-b border-border-secondary">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'px-4 py-2 text-xs font-bold border-b-2 transition-colors',
          activeTab === tab.id
            ? 'border-primary text-primary'
            : 'border-transparent text-text-tertiary hover:text-text-primary'
        ]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab: 权限总览 -->
    <div v-if="activeTab === 'permissions'" class="space-y-4">
      <div v-if="loadingPermissions" class="text-center py-10 text-text-tertiary text-xs">
        {{ locale.loading || '加载中...' }}
      </div>
      <div v-else class="space-y-4">
        <div
          v-for="(perms, category) in permissionsGrouped"
          :key="category"
          class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-5"
        >
          <!-- E: 分类可折叠 + 显示权限数 -->
          <button
            type="button"
            class="w-full flex items-center justify-between text-left mb-3"
            :aria-expanded="expandedCategories.has(String(category))"
            @click="toggleCategory(String(category))"
          >
            <h3 class="text-sm font-black text-text-primary uppercase tracking-wider">
              {{ categoryLabels[category] || category }}
              <span class="ml-1 text-text-tertiary font-normal">({{ perms.length }})</span>
            </h3>
            <ChevronDown v-if="!expandedCategories.has(String(category))" :size="14" class="text-text-tertiary" />
            <ChevronUp v-else :size="14" class="text-text-tertiary" />
          </button>
          <div v-show="expandedCategories.has(String(category))" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="p in perms"
              :key="p.id"
              class="p-3 bg-bg-primary border border-border-secondary rounded-xl flex items-start gap-2"
            >
              <!-- D: hover 显示完整描述 -->
              <code
                class="text-[10px] font-mono text-primary shrink-0 cursor-help"
                :title="`${p.key} — ${p.descriptionEn || p.descriptionZh}`"
              >{{ p.key }}</code>
              <span class="text-[11px] text-text-tertiary leading-relaxed">{{ p.descriptionZh }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: 角色矩阵 -->
    <div v-if="activeTab === 'roles'" class="space-y-4">
      <div v-if="!canManageRoles" class="p-4 bg-warning-10 border border-warning-20 rounded-2xl text-warning text-xs">
        {{ locale.onlySuperAdmin || '仅超级管理员可编辑角色矩阵' }}
      </div>
      <div v-else class="space-y-3">
        <!-- B: 搜索筛选 -->
        <div class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-3 flex items-center gap-2">
          <Search :size="14" class="text-text-tertiary shrink-0" />
          <input
            v-model="roleMatrixSearch"
            type="text"
            :placeholder="locale.searchPlaceholder || '搜索权限 key 或描述...'"
            class="flex-1 bg-transparent text-xs text-text-primary placeholder-text-tertiary focus:outline-none"
          >
          <button
            v-if="roleMatrixSearch"
            type="button"
            class="p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
            :aria-label="getLocaleText('clearSearch', '清空搜索')"
            @click="roleMatrixSearch = ''"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- C: 角色模板 -->
        <div class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-3 space-y-2">
          <div class="flex items-center gap-2 text-text-tertiary">
            <Layers :size="12" />
            <span class="text-[10px] font-black uppercase tracking-widest">
              {{ getLocaleText('roleTemplates', '角色模板') }}
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tpl in ROLE_TEMPLATES"
              :key="tpl.key"
              type="button"
              class="px-3 py-1.5 text-[11px] font-bold bg-bg-primary border border-border-secondary hover:border-primary text-text-primary rounded-lg transition-colors active:scale-95"
              :title="tpl.description"
              @click="askApplyTemplate(tpl)"
            >
              {{ tpl.label }}
            </button>
          </div>
        </div>

        <div
          v-for="role in roles"
          :key="role"
          class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-5"
        >
          <h3 class="text-sm font-black text-text-primary mb-3 uppercase tracking-wider">
            {{ roleLabels[role] || role }}
            <span class="ml-1 text-text-tertiary font-normal">({{ (roleMatrix[role] || []).length }})</span>
          </h3>
          <!-- A: 按 category 分组 -->
          <div v-if="Object.keys(filteredPermissionsGrouped).length === 0" class="text-center py-6 text-text-tertiary text-[11px]">
            {{ getLocaleText('noMatchingPermissions', '没有匹配的权限') }}
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="(perms, category) in filteredPermissionsGrouped"
              :key="`${role}-${category}`"
              class="space-y-2"
            >
              <div class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ categoryLabels[category] || category }}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <label
                  v-for="p in perms"
                  :key="p.key"
                  class="flex items-start gap-2 p-2 bg-bg-primary border border-border-secondary rounded-lg cursor-pointer hover:border-primary-30 transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="roleMatrix[role]?.includes(p.key) || false"
                    :disabled="role === 'SUPER_ADMIN'"
                    class="w-3.5 h-3.5 mt-0.5 shrink-0"
                    @change="toggleRolePermission(role, p.key, $event.target.checked)"
                  >
                  <div class="min-w-0 flex-1">
                    <!-- D: hover 显示完整 description -->
                    <code
                      class="text-[10px] font-mono text-text-secondary block cursor-help"
                      :title="`${p.key} — ${p.descriptionEn || p.descriptionZh}`"
                    >{{ p.key }}</code>
                    <p class="text-[10px] text-text-tertiary leading-tight mt-0.5">{{ p.descriptionZh }}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <button
          v-if="canManageRoles"
          :disabled="savingRoles"
          class="w-full py-3 bg-primary-hover hover:bg-primary text-text-primary text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
          @click="saveRoleMatrix"
        >
          {{ savingRoles ? (locale.saving || '保存中...') : (locale.saveAll || '保存全部修改') }}
        </button>
      </div>
    </div>

    <!-- Tab: 个人加授 -->
    <div v-if="activeTab === 'grants'" class="space-y-3">
      <div v-if="!canManageGrants" class="p-4 bg-warning-10 border border-warning-20 rounded-2xl text-warning text-xs">
        {{ locale.onlyAdminOrAbove || '仅管理员及以上可管理个人加授' }}
      </div>
      <div v-else class="space-y-3">
        <!-- G: 用户视角 — 选择目标用户查看其当前加授 -->
        <div class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-text-tertiary">
              <UserIcon :size="14" />
              <span class="text-[10px] font-black uppercase tracking-widest">
                {{ getLocaleText('userPerspective', '用户视角') }}
              </span>
            </div>
            <span v-if="selectedUserId" class="text-[10px] text-text-tertiary">
              {{ getLocaleText('currentUser', '当前用户') }}: <b class="text-text-primary">{{ selectedUserName }}</b>
              ({{ selectedUserPermissions.length }})
            </span>
          </div>
          <div class="relative">
            <Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input
              v-model="grantUserSearch"
              type="text"
              :placeholder="getLocaleText('searchUserPlaceholder', '搜索用户名或姓名...')"
              class="w-full pl-8 pr-8 py-2 bg-bg-primary border border-border-secondary rounded-xl text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary-30"
            >
            <button
              v-if="grantUserSearch"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
              :aria-label="getLocaleText('clearSearch', '清空搜索')"
              @click="grantUserSearch = ''"
            >
              <X :size="12" />
            </button>
          </div>
          <div v-if="grantUserSearch" class="max-h-40 overflow-y-auto space-y-1">
            <div v-if="filteredUserOptions.length === 0" class="text-center py-3 text-text-tertiary text-[11px]">
              {{ getLocaleText('noMatchingUsers', '未找到匹配的用户') }}
            </div>
            <button
              v-for="u in filteredUserOptions"
              :key="u.userId"
              type="button"
              class="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs bg-bg-primary hover:border-primary border border-border-secondary rounded-lg transition-colors"
              :class="selectedUserId === u.userId ? 'border-primary' : ''"
              @click="selectGrantUser(u.userId)"
            >
              <span class="font-bold text-text-primary truncate">{{ u.userName || u.userUsername }}</span>
              <span class="text-text-tertiary text-[10px] shrink-0">{{ u.grantCount }} {{ getLocaleText('grants', '条') }}</span>
            </button>
          </div>
          <!-- 已选用户当前权限摘要 -->
          <div v-if="selectedUserId" class="space-y-1.5">
            <div class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
              {{ getLocaleText('alreadyGranted', '已加授的权限') }}
            </div>
            <div v-if="selectedUserPermissions.length === 0" class="text-[11px] text-text-tertiary italic">
              {{ getLocaleText('noUserGrantsYet', '该用户暂无加授') }}
            </div>
            <div v-else class="flex flex-wrap gap-1.5">
              <span
                v-for="key in selectedUserPermissions"
                :key="key"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-success-10 text-success text-[10px] font-mono rounded"
              >
                {{ key }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="userGrants.length === 0 && !loadingGrants" class="text-center py-10 text-text-tertiary text-xs">
          {{ locale.noGrants || '暂无个人加授记录' }}
        </div>
        <div v-else-if="filteredUserGrants.length === 0 && selectedUserId" class="text-center py-6 text-text-tertiary text-xs">
          {{ getLocaleText('noGrantsForUser', '该用户暂无加授记录') }}
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="g in filteredUserGrants"
            :key="g.id"
            class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-bold text-text-primary">{{ g.userName || g.userUsername }}</span>
                <span
                  :class="[
                    'text-[10px] font-black uppercase px-2 py-0.5 rounded',
                    g.grantType === 'assign' ? 'bg-success-10 text-success' : 'bg-error-10 text-error'
                  ]"
                >
                  {{ g.grantType === 'assign' ? (locale.grantAssign || '加授') : (locale.grantRevoke || '减授') }}
                </span>
                <code
                  class="text-[10px] font-mono text-primary cursor-help"
                  :title="`${g.permissionKey} — ${g.permissionDescriptionZh || g.permissionKey}`"
                >{{ g.permissionKey }}</code>
              </div>
              <p v-if="g.reason" class="text-[11px] text-text-tertiary">{{ g.reason }}</p>
              <p v-if="g.expiresAt" class="text-[11px] text-warning">
                {{ locale.expiresAt || '到期' }}: {{ formatDate(g.expiresAt) }}
              </p>
            </div>
            <button
              class="p-2 text-error hover:bg-error-10 rounded-lg transition-colors"
              @click="revokeGrant(g)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增加授弹窗 -->
    <Transition name="modal">
      <div
        v-if="showCreateModal"
        ref="createModalEl"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-bg-primary-60 backdrop-blur-sm"
          @click="closeCreateModal"
        />
        <div class="relative w-full max-w-md bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div class="p-6 border-b border-border-secondary flex items-center justify-between">
            <h3 class="text-lg font-black text-text-primary uppercase tracking-widest">
              {{ locale.createGrant || '新增加授' }}
            </h3>
            <button class="text-text-tertiary hover:text-text-primary" @click="closeCreateModal">
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ locale.userId || '用户 ID' }}
              </label>
              <input
                v-model.number="form.userId"
                type="number"
                min="1"
                :placeholder="locale.userIdPlaceholder || '用户 ID'"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ locale.permissionKey || '权限 Key' }}
              </label>
              <input
                v-model="form.permissionKey"
                type="text"
                :placeholder="locale.permissionKeyPlaceholder || 'song.write'"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-primary-30 text-text-primary"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ locale.grantType || '类型' }}
              </label>
              <CustomSelect
                v-model="form.grantType"
                :options="[
                  { label: locale.grantAssign || '加授 (assign)', value: 'assign' },
                  { label: locale.grantRevoke || '减授 (revoke)', value: 'revoke' }
                ]"
                class-name="w-full"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ locale.expiresAt || '到期时间（可选，ISO 8601）' }}
              </label>
              <input
                v-model="form.expiresAt"
                type="datetime-local"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ locale.reason || '理由（可选）' }}
              </label>
              <textarea
                v-model="form.reason"
                rows="2"
                :placeholder="locale.reasonPlaceholder || '为新任课老师授予歌曲审核权限'"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary min-h-[60px] resize-none placeholder:text-text-primary"
              />
            </div>
          </div>

          <div class="p-6 border-t border-border-secondary flex gap-2 justify-end">
            <button
              class="px-4 py-2 text-xs font-bold text-text-tertiary hover:text-text-secondary"
              @click="closeCreateModal"
            >
              {{ locale.cancel || '取消' }}
            </button>
            <button
              :disabled="submitting"
              class="px-6 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] disabled:opacity-50 transition-all"
              @click="submitGrant"
            >
              {{ submitting ? (locale.saving || '保存中...') : (locale.confirm || '确认') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 撤销加授二次确认 -->
    <ConfirmDialog
      v-model:show="showRevokeDialog"
      type="danger"
      :title="getLocaleText('confirmRevokeTitle', '确认撤销')"
      :message="revokeConfirmMessage"
      :confirm-text="getLocaleText('revoke', '撤销')"
      :cancel-text="getLocaleText('cancel', '取消')"
      @confirm="confirmRevoke"
      @cancel="cancelRevoke"
    />

    <!-- C: 应用角色模板二次确认 -->
    <ConfirmDialog
      v-model:show="showTemplateDialog"
      type="warning"
      :title="getLocaleText('applyTemplateTitle', '应用角色模板')"
      :message="templateConfirmMessage"
      :confirm-text="getLocaleText('apply', '应用')"
      :cancel-text="getLocaleText('cancel', '取消')"
      @confirm="confirmApplyTemplate"
      @cancel="cancelApplyTemplate"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Plus,
  X,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Layers
} from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useAuth } from '~/composables/useAuth'
import { useRbac } from '~/composables/useRbac'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { useLocaleText } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { PERMISSIONS } from '~/utils/rbac'

const auth = useAuth()
const rbac = useRbac()
const toast = useToast()

// i18n: 通过 useLocale() 读取 admin.rbacManager 段;key 缺失时回退到模板中的中文硬编码串
const { admin } = useLocale()
const locale = computed(() => useSafeLocale(admin.value?.rbacManager || {}))
// 用 t 而不是 msg:t 有真正的 fallback 参数,缺失 key 时回退到中文默认值
const { t: getLocaleText } = useLocaleText(locale)

const tabs = [
  { id: 'permissions', label: '权限总览' },
  { id: 'roles', label: '角色矩阵' },
  { id: 'grants', label: '个人加授' }
]
const activeTab = ref('permissions')

const allPermissions = ref([])
const permissionsGrouped = ref({})
const loadingPermissions = ref(false)

const roles = ref(['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'])
const roleMatrix = ref({})
const roleLabels = {
  USER: '普通用户',
  SONG_ADMIN: '歌曲管理员',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员'
}
const categoryLabels = {
  user: '用户域',
  song: '歌曲域',
  schedule: '排期域',
  playtimes: '播出时段',
  request_times: '投稿时段',
  semester: '学期',
  stats: '数据',
  card_codes: '点歌券',
  blacklist: '黑名单',
  system_settings: '系统设置',
  email_templates: '邮件模板',
  smtp: 'SMTP',
  grade_class: '年级班级',
  backup: '备份',
  database: '数据库',
  notification: '通知',
  api_keys: 'API 密钥',
  rbac: '权限中心'
}
const savingRoles = ref(false)

const userGrants = ref([])
const loadingGrants = ref(false)

const showCreateModal = ref(false)
const submitting = ref(false)
const form = reactive({
  userId: null,
  permissionKey: '',
  grantType: 'assign',
  expiresAt: '',
  reason: ''
})

const canManageRoles = computed(() =>
  rbac.can(PERMISSIONS.ROLE_MANAGE) || auth.user.value?.role === 'SUPER_ADMIN'
)
const canManageGrants = computed(() =>
  rbac.can(PERMISSIONS.USER_PERMISSIONS_MANAGE) ||
  auth.user.value?.role === 'ADMIN' ||
  auth.user.value?.role === 'SUPER_ADMIN'
)

// 撤销加授的二次确认弹窗(替代原生 confirm)
const pendingRevokeGrant = ref(null)
const showRevokeDialog = ref(false)
// 文案走 i18n;key 缺失时回退到中文模板,占位符 {0}=用户名 {1}=权限 key
const revokeConfirmMessage = computed(() => {
  const grant = pendingRevokeGrant.value
  const name = grant?.userName || grant?.userUsername || ''
  const key = grant?.permissionKey || ''
  const fallback = `确定要撤销 ${name} 的 ${key} 权限吗？`
  return getLocaleText('confirmRevokeMessage', fallback, name, key)
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}

/**
 * 加载全量权限定义 + 按 category 分组;供「权限总览」Tab 渲染
 */
async function loadPermissions() {
  loadingPermissions.value = true
  try {
    const res = await $fetch('/api/admin/rbac/permissions')
    if (res.success) {
      allPermissions.value = res.data.items
      permissionsGrouped.value = res.data.grouped
    }
  } catch (err) {
    console.error('加载权限定义失败:', err)
    toast.error('加载权限定义失败')
  } finally {
    loadingPermissions.value = false
  }
}

async function loadRoleMatrix() {
  try {
    const res = await $fetch('/api/admin/rbac/roles')
    if (res.success) {
      roleMatrix.value = res.data.matrix
    }
  } catch (err) {
    console.error('加载角色矩阵失败:', err)
  }
}

async function loadUserGrants() {
  loadingGrants.value = true
  try {
    const res = await $fetch('/api/admin/rbac/user-permissions')
    if (res.success) {
      userGrants.value = res.data
    }
  } catch (err) {
    console.error('加载个人加授失败:', err)
  } finally {
    loadingGrants.value = false
  }
}

/**
 * 切换「角色 × 权限」矩阵中的某一格;SUPER_ADMIN 不可改(硬编码保护,前后端双保险)
 * 改动只在本地 matrix 累积,需要点「保存全部修改」才下发
 * @param {string} role - 角色枚举(USER / SONG_ADMIN / ADMIN)
 * @param {string} permKey - 权限 key
 * @param {boolean} checked - 是否勾选
 */
function toggleRolePermission(role, permKey, checked) {
  if (role === 'SUPER_ADMIN') return
  const arr = roleMatrix.value[role] ? [...roleMatrix.value[role]] : []
  if (checked) {
    if (!arr.includes(permKey)) arr.push(permKey)
  } else {
    const idx = arr.indexOf(permKey)
    if (idx >= 0) arr.splice(idx, 1)
  }
  roleMatrix.value = { ...roleMatrix.value, [role]: arr }
}

/**
 * 把本地累积的角色矩阵逐个 PUT 到后端;只下发 USER/SONG_ADMIN/ADMIN 三档,
 * SUPER_ADMIN 不在范围内(其权限集在 seed 里固定,前端无入口)
 */
async function saveRoleMatrix() {
  savingRoles.value = true
  try {
    for (const role of ['USER', 'SONG_ADMIN', 'ADMIN']) {
      const permissions = roleMatrix.value[role] || []
      await $fetch(`/api/admin/rbac/roles/${role}`, {
        method: 'PUT',
        body: { permissions }
      })
    }
    toast.success('角色矩阵已保存')
    await loadRoleMatrix()
  } catch (err) {
    console.error('保存角色矩阵失败:', err)
    toast.error('保存失败')
  } finally {
    savingRoles.value = false
  }
}

function openCreateModal() {
  showCreateModal.value = true
}
function closeCreateModal() {
  showCreateModal.value = false
  form.userId = null
  form.permissionKey = ''
  form.grantType = 'assign'
  form.expiresAt = ''
  form.reason = ''
}

/**
 * 提交「个人加授/减授」表单;expiresAt 是 datetime-local 输入,
 * 提交前转 ISO 8601 后端才认
 */
async function submitGrant() {
  if (!form.userId) return toast.error('请填写用户 ID')
  if (!form.permissionKey) return toast.error('请填写权限 Key')

  submitting.value = true
  try {
    const body = {
      userId: form.userId,
      permissionKey: form.permissionKey,
      grantType: form.grantType,
      reason: form.reason || null
    }
    if (form.expiresAt) {
      body.expiresAt = new Date(form.expiresAt).toISOString()
    }
    await $fetch('/api/admin/rbac/user-permissions', {
      method: 'POST',
      body
    })
    toast.success('加授已保存')
    closeCreateModal()
    await loadUserGrants()
  } catch (err) {
    console.error('保存加授失败:', err)
    toast.error(err?.data?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

/**
 * 打开撤销加授的二次确认弹窗(不再使用原生 confirm,走 locale 文案)
 * @param {Object} grant - 单条个人加授记录
 */
function revokeGrant(grant) {
  pendingRevokeGrant.value = grant
  showRevokeDialog.value = true
}

/**
 * 用户在 ConfirmDialog 确认后真正执行撤销
 */
async function confirmRevoke() {
  const grant = pendingRevokeGrant.value
  if (!grant) return
  showRevokeDialog.value = false
  try {
    await $fetch(`/api/admin/rbac/user-permissions/${grant.id}`, { method: 'DELETE' })
    toast.success('加授已撤销')
    await loadUserGrants()
  } catch (err) {
    console.error('撤销失败:', err)
    toast.error(err?.data?.message || '撤销失败')
  } finally {
    pendingRevokeGrant.value = null
  }
}

function cancelRevoke() {
  showRevokeDialog.value = false
  pendingRevokeGrant.value = null
}

// =============================================================
// A. 角色矩阵显示权限描述 + 分类分组 / B. 搜索筛选
// =============================================================
/** 角色矩阵顶部搜索框(key/description_zh/description_en 模糊匹配) */
const roleMatrixSearch = ref('')
/** 搜索后保留的权限列表(平铺,仍保留 category 字段供后续分组) */
const filteredPermissions = computed(() => {
  const q = roleMatrixSearch.value.trim().toLowerCase()
  if (!q) return allPermissions.value
  return allPermissions.value.filter((p) =>
    p.key.toLowerCase().includes(q) ||
    (p.descriptionZh && p.descriptionZh.toLowerCase().includes(q)) ||
    (p.descriptionEn && p.descriptionEn.toLowerCase().includes(q))
  )
})
/** 搜索后的权限按 category 重新分组,供角色矩阵渲染(A) */
const filteredPermissionsGrouped = computed(() => {
  const grouped = {}
  for (const p of filteredPermissions.value) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  }
  return grouped
})

// =============================================================
// C. 角色模板(preset) — 一键覆盖角色权限
// =============================================================
/**
 * 角色模板清单;permission 列表与 seed-permissions.js 角色矩阵对齐。
 * label 走 locale.templates.* 缺失时回退到中文;description 走 title 提示。
 */
const ROLE_TEMPLATES = [
  {
    key: 'songAdmin',
    label: '音乐管理员模板',
    description: '管理歌曲/排期相关',
    permissions: [
      'song.read', 'song.write', 'song.reject',
      'schedule.read', 'schedule.write', 'schedule.publish',
      'playtimes.manage', 'request_times.manage',
      'semester.manage', 'stats.read',
      'card_codes.read', 'card_codes.write'
    ]
  },
  {
    key: 'admin',
    label: '管理员模板',
    description: '在音乐管理员基础上加用户/系统相关',
    permissions: [
      'song.read', 'song.write', 'song.reject',
      'schedule.read', 'schedule.write', 'schedule.publish',
      'playtimes.manage', 'request_times.manage',
      'semester.manage', 'stats.read',
      'card_codes.read', 'card_codes.write',
      'user.read', 'user.manage', 'user.status',
      'blacklist.manage', 'system_settings.read',
      'email_templates.manage', 'smtp.manage', 'grade_class.manage',
      'backup.execute', 'notification.send',
      'api_keys.read', 'api_keys.write', 'api_keys.manage',
      'permissions.read'
    ]
  },
  {
    key: 'viewer',
    label: '只读模板',
    description: '仅查看类权限(适合审计/统计岗)',
    permissions: [
      'song.read', 'schedule.read', 'stats.read',
      'card_codes.read', 'system_settings.read',
      'user.read', 'api_keys.read', 'permissions.read'
    ]
  },
  {
    key: 'clear',
    label: '清空模板',
    description: '清空该角色所有权限',
    permissions: []
  }
]
/** 当前待应用的模板 + 目标角色 */
const pendingTemplate = ref(null)
/** 应用模板前的二次确认弹窗(走 ConfirmDialog) */
const showTemplateDialog = ref(false)
const templateConfirmMessage = computed(() => {
  const tpl = pendingTemplate.value
  if (!tpl) return ''
  const target = pendingTemplateRole.value
  const targetLabel = roleLabels[target] || target
  const count = tpl.permissions.length
  const fallback = `将覆盖「${targetLabel}」角色的 ${count} 个权限,确定?`
  return getLocaleText('applyTemplateMessage', fallback, targetLabel, count)
})
const pendingTemplateRole = ref('USER')
/** 打开模板确认弹窗(点模板按钮触发) */
function askApplyTemplate(tpl) {
  // 按 template.key 自动匹配目标角色(也避免 SUPER_ADMIN 这类不可改的角色)
  const targetMap = {
    songAdmin: 'SONG_ADMIN',
    admin: 'ADMIN',
    viewer: 'USER',
    clear: 'USER'
  }
  pendingTemplateRole.value = targetMap[tpl.key] || 'USER'
  pendingTemplate.value = tpl
  showTemplateDialog.value = true
}
/** 确认应用:把目标角色的 matrix 整个替换为模板 permissions */
function confirmApplyTemplate() {
  const tpl = pendingTemplate.value
  if (!tpl) return
  const role = pendingTemplateRole.value
  if (role === 'SUPER_ADMIN') return
  roleMatrix.value = { ...roleMatrix.value, [role]: [...tpl.permissions] }
  showTemplateDialog.value = false
  pendingTemplate.value = null
  toast.success(`已应用模板「${tpl.label}」到「${roleLabels[role] || role}」`)
}
function cancelApplyTemplate() {
  showTemplateDialog.value = false
  pendingTemplate.value = null
}

// =============================================================
// E. 权限总览分类可折叠 + 数量显示
// =============================================================
/** 已展开的分类集合;默认全部展开(在 onMounted 从 permissionsGrouped 初始化) */
const expandedCategories = ref(new Set())
function toggleCategory(category) {
  const next = new Set(expandedCategories.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  expandedCategories.value = next
}

// =============================================================
// F. 焦点陷阱 + Esc 关闭
//  - createModalEl: 在组件内的弹窗(不 portal),用 ref + local listener
//  - ConfirmDialog: Teleport 到 body,用 document 监听 Esc
// =============================================================
const createModalEl = ref(null)
/** 收集焦点元素 + Tab 循环 */
function trapFocusIn(el) {
  if (!el) return null
  const focusable = el.querySelectorAll(
    'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length === 0) return null
  focusable[0].focus()
  const handler = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (showCreateModal.value) closeCreateModal()
      return
    }
    if (e.key !== 'Tab') return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  el.addEventListener('keydown', handler)
  return () => el.removeEventListener('keydown', handler)
}
/** 弹窗打开时聚焦首个可输入元素(Esc 由 create modal 自己处理) */
watch(showCreateModal, (open) => {
  if (open) {
    nextTick(() => trapFocusIn(createModalEl.value))
  }
})
/** ConfirmDialog portal 到 body,需要 document 级 Esc 监听 */
function handleGlobalEsc(e) {
  if (e.key !== 'Escape') return
  if (showTemplateDialog.value) cancelApplyTemplate()
  else if (showRevokeDialog.value) cancelRevoke()
}
watch([showTemplateDialog, showRevokeDialog], ([tpl, rev]) => {
  if (tpl || rev) {
    document.addEventListener('keydown', handleGlobalEsc)
  } else {
    document.removeEventListener('keydown', handleGlobalEsc)
  }
})

// =============================================================
// G. 用户视角 — 选择目标用户查看其当前加授
// =============================================================
/** 当前选中的用户 ID */
const selectedUserId = ref(null)
/** 当前选中用户已有的加授权限 key 列表(assign 类型) */
const selectedUserPermissions = ref([])
/** 当前选中用户的可读姓名 */
const selectedUserName = computed(() => {
  if (!selectedUserId.value) return ''
  const g = userGrants.value.find((x) => x.userId === selectedUserId.value)
  return g?.userName || g?.userUsername || ''
})
/** 用户搜索框(grants tab 顶部) */
const grantUserSearch = ref('')
/** 从 userGrants 派生的「去重用户 + 各自加授条数」列表 */
const userOptions = computed(() => {
  const map = new Map()
  for (const g of userGrants.value) {
    const uid = g.userId
    if (!uid) continue
    if (!map.has(uid)) {
      map.set(uid, { userId: uid, userName: g.userName, userUsername: g.userUsername, grantCount: 0 })
    }
    map.get(uid).grantCount += 1
  }
  return Array.from(map.values()).sort((a, b) => (a.userName || a.userUsername || '').localeCompare(b.userName || b.userUsername || ''))
})
/** 搜索后过滤的用户列表 */
const filteredUserOptions = computed(() => {
  const q = grantUserSearch.value.trim().toLowerCase()
  if (!q) return userOptions.value
  return userOptions.value.filter(
    (u) =>
      (u.userName && u.userName.toLowerCase().includes(q)) ||
      (u.userUsername && u.userUsername.toLowerCase().includes(q))
  )
})
/** 选中用户后,grants 列表只显示该用户(否则显示全部) */
const filteredUserGrants = computed(() => {
  if (!selectedUserId.value) return userGrants.value
  return userGrants.value.filter((g) => g.userId === selectedUserId.value)
})
/** 选择目标用户:从本地 userGrants 聚合其当前 assign 权限 */
function selectGrantUser(userId) {
  selectedUserId.value = userId
  const now = Date.now()
  selectedUserPermissions.value = userGrants.value
    .filter((g) => {
      if (g.userId !== userId) return false
      if (g.grantType !== 'assign') return false
      if (g.expiresAt && new Date(g.expiresAt).getTime() <= now) return false
      return true
    })
    .map((g) => g.permissionKey)
  grantUserSearch.value = ''
}

onMounted(() => {
  rbac.bind(auth.user.value?.id)
  loadPermissions()
  loadRoleMatrix()
  loadUserGrants()
  // E: 默认展开所有分类(权限总览加载完成后)
  watch(permissionsGrouped, (g) => {
    if (Object.keys(g).length > 0 && expandedCategories.value.size === 0) {
      expandedCategories.value = new Set(Object.keys(g))
    }
  }, { immediate: true, deep: true })
})
onBeforeUnmount(() => {
  // 清理全局 Esc 监听
  document.removeEventListener('keydown', handleGlobalEsc)
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
