<!-- 角色权限管理（spec [S5.3]） -->
<template>
  <div class="max-w-[1400px] mx-auto pb-20 px-2">
    <!-- 头部 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
      <div>
        <h2 class="text-[26px] font-black text-text-primary tracking-tight leading-none">{{ locale.title || '角色与权限' }}</h2>
        <p class="text-[12px] text-text-tertiary mt-2">{{ locale.desc || '管理权限定义、角色矩阵与个人加授' }}</p>
      </div>
      <button
        v-if="rbac.can(PERMISSIONS.USER_PERMISSIONS_MANAGE)"
        class="flex items-center gap-2 px-5 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl transition-all shadow-lg shadow-[var(--primary-glow)] active:scale-95"
        @click="openCreateModal"
      >
        <Plus :size="14" /> {{ locale.createGrant || '新增加授' }}
      </button>
    </div>

    <!-- 两栏布局:左侧导航 + 右侧内容 -->
    <div class="flex flex-col md:flex-row gap-6">
      <!-- 左侧导航:主导航 + 子导航 + 搜索 + 模板 -->
      <aside
        class="w-full md:w-72 shrink-0 md:sticky md:top-4 md:self-start md:border-r md:border-border-secondary md:pr-5 space-y-4"
        aria-label="RBAC 导航"
      >
        <!-- 主导航 3 个 tab (segmented control 风格) -->
        <div class="flex gap-1 p-1 bg-bg-tertiary-20 rounded-xl">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="[
              'flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 text-[12px] font-bold rounded-lg transition-all',
              activeTab === tab.id
                ? 'bg-bg-primary text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-primary'
            ]"
            :aria-current="activeTab === tab.id ? 'page' : undefined"
            @click="activeTab = tab.id"
          >
            <span class="truncate">{{ tab.label }}</span>
            <span
              :class="[
                'text-[9px] px-1.5 py-0.5 rounded-full font-mono shrink-0 transition-colors',
                activeTab === tab.id ? 'bg-primary-hover-15 text-primary' : 'bg-bg-tertiary-40 text-text-tertiary'
              ]"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- 子导航:按 tab 切换 -->
        <!-- permissions tab:分类列表 -->
        <div v-if="activeTab === 'permissions'" class="space-y-1.5">
          <div class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-3 mb-2">
            {{ getLocaleText('categoryNav', '分类') }}
          </div>
          <button
            v-for="(perms, category) in permissionsGrouped"
            :key="category"
            type="button"
            :class="[
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-bold transition-all text-left border',
              selectedCategory === category
                ? 'bg-primary-hover-10 text-primary border border-primary-20 shadow-sm'
                : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary-30 hover:border-border-secondary-60 border border-transparent'
            ]"
            @click="selectedCategory = String(category)"
          >
            <span class="truncate">{{ categoryLabels[category] || category }}</span>
            <span
              :class="[
                'text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ml-2 transition-colors',
                selectedCategory === category ? 'bg-primary-hover-20 text-primary' : 'bg-bg-tertiary-40 text-text-tertiary'
              ]"
            >
              {{ perms.length }}
            </span>
          </button>
        </div>

        <!-- roles tab:角色列表 -->
        <div v-else-if="activeTab === 'roles'" class="space-y-1.5">
          <div class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-3 mb-2">
            {{ getLocaleText('roleNav', '角色') }}
          </div>
          <button
            v-for="role in roles"
            :key="role"
            type="button"
            :class="[
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-bold transition-all text-left border',
              selectedRole === role
                ? 'bg-primary-hover-10 text-primary border border-primary-20 shadow-sm'
                : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary-30 hover:border-border-secondary-60 border border-transparent'
            ]"
            @click="selectedRole = role"
          >
            <span class="truncate">{{ roleLabels[role] || role }}</span>
            <span
              :class="[
                'text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ml-2 transition-colors',
                selectedRole === role ? 'bg-primary-hover-20 text-primary' : 'bg-bg-tertiary-40 text-text-tertiary'
              ]"
            >
              {{ (roleMatrix[role] || []).length }}
            </span>
          </button>
        </div>

        <!-- grants tab:用户列表(带头部搜索) -->
        <div v-else-if="activeTab === 'grants'" class="space-y-2.5">
          <div class="flex items-center gap-1.5 text-text-tertiary px-1">
            <UserIcon :size="11" />
            <span class="text-[10px] font-black uppercase tracking-widest">
              {{ getLocaleText('userPerspective', '用户视角') }}
            </span>
          </div>
          <div class="relative">
            <Search :size="12" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input
              v-model="grantUserSearch"
              type="text"
              :placeholder="getLocaleText('searchUserPlaceholder', '搜索用户名或姓名...')"
              class="w-full pl-8 pr-8 py-2 bg-bg-primary border border-border-secondary rounded-lg text-[12px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary-40 focus:ring-2 focus:ring-primary-20 transition-all"
            >
            <button
              v-if="grantUserSearch"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
              :aria-label="getLocaleText('clearSearch', '清空搜索')"
              @click="grantUserSearch = ''"
            >
              <X :size="11" />
            </button>
          </div>
          <div class="max-h-80 overflow-y-auto space-y-1 pr-1">
            <button
              v-for="u in filteredUserOptions"
              :key="u.userId"
              type="button"
              :class="[
                'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-bold rounded-lg transition-all border',
                selectedUserId === u.userId
                  ? 'bg-primary-hover-10 text-primary border border-primary-20 shadow-sm'
                  : 'bg-transparent hover:bg-bg-tertiary-30 text-text-tertiary hover:text-text-primary border border-transparent'
              ]"
              @click="selectGrantUser(u.userId)"
            >
              <span class="truncate">{{ u.userName || u.userUsername }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary-40 text-text-tertiary font-mono shrink-0">
                {{ u.grantCount }}
              </span>
            </button>
            <div v-if="filteredUserOptions.length === 0" class="text-center py-4 text-text-tertiary text-[11px]">
              {{ getLocaleText('noMatchingUsers', '未找到匹配的用户') }}
            </div>
          </div>
        </div>

        <!-- 搜索框 + 模板按钮组(permissions / roles tab 共享) -->
        <template v-if="activeTab === 'permissions' || activeTab === 'roles'">
          <div class="h-px bg-border-secondary" />
          <div class="relative">
            <Search :size="12" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input
              v-model="roleMatrixSearch"
              type="text"
              :placeholder="locale.searchPlaceholder || '搜索权限 key 或描述...'"
              class="w-full pl-8 pr-8 py-2 bg-bg-primary border border-border-secondary rounded-lg text-[12px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary-40 focus:ring-2 focus:ring-primary-20 transition-all"
            >
            <button
              v-if="roleMatrixSearch"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
              :aria-label="getLocaleText('clearSearch', '清空搜索')"
              @click="roleMatrixSearch = ''"
            >
              <X :size="11" />
            </button>
          </div>
          <div>
            <div class="flex items-center gap-1.5 text-text-tertiary mb-2 px-1">
              <Layers :size="11" />
              <span class="text-[10px] font-black uppercase tracking-widest">
                {{ getLocaleText('roleTemplates', '角色模板') }}
              </span>
            </div>
            <div class="flex flex-col gap-1.5">
              <button
                v-for="tpl in ROLE_TEMPLATES"
                :key="tpl.key"
                type="button"
                class="px-3 py-2 text-[12px] font-bold bg-bg-primary border border-border-secondary hover:border-primary hover:bg-primary-hover-5 text-text-primary rounded-lg transition-all active:scale-95 text-left"
                :title="tpl.description"
                @click="askApplyTemplate(tpl)"
              >
                {{ tpl.label }}
              </button>
            </div>
          </div>
        </template>
      </aside>

      <!-- 右侧内容:选中 tab 的详情 -->
      <main class="flex-1 min-w-0 md:pl-2 space-y-4">
        <!-- Tab:权限总览 -->
        <div v-if="activeTab === 'permissions'" class="space-y-4">
          <div v-if="loadingPermissions" class="text-center py-10 text-text-tertiary text-xs">
            {{ locale.loading || '加载中...' }}
          </div>
          <template v-else>
            <header class="flex items-center justify-between gap-3 pb-1">
              <div>
                <h3 class="text-lg font-black text-text-primary tracking-tight">
                  {{ categoryLabels[selectedCategory] || selectedCategory || '权限' }}
                </h3>
                <p class="text-[11px] text-text-tertiary mt-1">
                  {{ (selectedCategoryPerms.length) }} {{ getLocaleText('permissionsCount', '个权限') }}
                </p>
              </div>
            </header>
            <div v-if="filteredPermissionsForCategory.length === 0" class="text-center py-12 text-text-tertiary text-xs">
              {{ getLocaleText('noMatchingPermissions', '没有匹配的权限') }}
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div
                v-for="p in filteredPermissionsForCategory"
                :key="p.id"
                class="group p-4 rounded-xl border border-border-secondary hover:border-primary-40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-bg-primary cursor-help"
                :title="`${p.key} — ${p.descriptionEn || p.descriptionZh}`"
              >
                <div class="flex items-start justify-between gap-2">
                  <h4 class="text-[15px] font-black text-text-primary leading-snug flex-1 min-w-0 tracking-tight">
                    {{ p.descriptionZh }}
                  </h4>
                  <Key :size="12" class="text-text-disabled group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                </div>
                <p class="text-[11px] text-text-tertiary leading-relaxed mt-1.5 line-clamp-2">
                  {{ p.descriptionEn }}
                </p>
                <code class="text-[10px] font-mono text-text-disabled group-hover:text-primary-70 mt-2.5 inline-block px-1.5 py-0.5 bg-bg-tertiary-30 rounded transition-colors">
                  {{ p.key }}
                </code>
              </div>
            </div>
          </template>
        </div>

        <!-- Tab:角色矩阵 -->
        <div v-if="activeTab === 'roles'" class="space-y-4">
          <div v-if="!canManageRoles" class="p-4 bg-warning-10 border border-warning-20 rounded-2xl text-warning text-xs">
            {{ locale.onlySuperAdmin || '仅超级管理员可编辑角色矩阵' }}
          </div>
          <template v-else>
            <header class="flex items-center justify-between gap-3 pb-1">
              <div>
                <h3 class="text-lg font-black text-text-primary tracking-tight">
                  {{ roleLabels[selectedRole] || selectedRole }}
                </h3>
                <p class="text-[11px] text-text-tertiary mt-1">
                  {{ (roleMatrix[selectedRole] || []).length }} / {{ allPermissions.length }} {{ getLocaleText('permissionsCount', '个权限') }}
                </p>
              </div>
            </header>
            <div v-if="Object.keys(filteredPermissionsGrouped).length === 0" class="text-center py-12 text-text-tertiary text-xs">
              {{ getLocaleText('noMatchingPermissions', '没有匹配的权限') }}
            </div>
            <div v-else class="space-y-5">
              <div
                v-for="(perms, category) in filteredPermissionsGrouped"
                :key="`${selectedRole}-${category}`"
                class="space-y-2"
              >
                <div class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                  {{ categoryLabels[category] || category }}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <label
                    v-for="p in perms"
                    :key="p.key"
                    class="group block p-4 rounded-xl border border-border-secondary hover:border-primary-40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-bg-primary cursor-pointer"
                    :class="{ 'border-primary-40 bg-primary-hover-5': roleMatrix[selectedRole]?.includes(p.key) }"
                    :title="`${p.key} — ${p.descriptionEn || p.descriptionZh}`"
                  >
                    <div class="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        :checked="roleMatrix[selectedRole]?.includes(p.key) || false"
                        :disabled="selectedRole === 'SUPER_ADMIN'"
                        class="w-3.5 h-3.5 mt-1 shrink-0 cursor-pointer disabled:cursor-not-allowed accent-primary"
                        @change="toggleRolePermission(selectedRole, p.key, ($event.target as HTMLInputElement).checked)"
                      >
                      <div class="min-w-0 flex-1">
                        <h4 class="text-[15px] font-black text-text-primary leading-snug tracking-tight">
                          {{ p.descriptionZh }}
                        </h4>
                        <p class="text-[11px] text-text-tertiary leading-relaxed mt-1.5 line-clamp-2">
                          {{ p.descriptionEn }}
                        </p>
                        <code class="text-[10px] font-mono text-text-disabled group-hover:text-primary-70 mt-2.5 inline-block px-1.5 py-0.5 bg-bg-tertiary-30 rounded transition-colors">
                          {{ p.key }}
                        </code>
                      </div>
                    </div>
                  </label>
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
          </template>
        </div>

        <!-- Tab:个人加授 -->
        <div v-if="activeTab === 'grants'" class="space-y-4">
          <div v-if="!canManageGrants" class="p-4 bg-warning-10 border border-warning-20 rounded-2xl text-warning text-xs">
            {{ locale.onlyAdminOrAbove || '仅管理员及以上可管理个人加授' }}
          </div>
          <template v-else>
            <div v-if="!selectedUserId" class="text-center py-20 text-text-tertiary text-xs space-y-3">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-bg-tertiary-20 flex items-center justify-center">
                <UserIcon :size="22" class="text-text-disabled" />
              </div>
              <p class="text-[13px] text-text-secondary font-bold">{{ getLocaleText('selectUserHint', '请在左侧选择用户') }}</p>
              <p class="text-[11px] text-text-tertiary">{{ getLocaleText('selectUserHintSub', '查看并管理该用户的个人加授') }}</p>
            </div>
            <div v-else class="space-y-4">
              <header class="flex items-center justify-between gap-3 pb-1">
                <div>
                  <h3 class="text-lg font-black text-text-primary tracking-tight">
                    {{ selectedUserName }}
                  </h3>
                  <p class="text-[11px] text-text-tertiary mt-1">
                    {{ selectedUserPermissions.length }} {{ getLocaleText('alreadyGranted', '已加授') }}
                  </p>
                </div>
                <button
                  class="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary-30 transition-colors"
                  :aria-label="getLocaleText('clearSelection', '清除选择')"
                  @click="selectedUserId = null"
                >
                  <X :size="14" />
                </button>
              </header>

              <!-- 已选用户当前权限摘要 -->
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

              <!-- 加授列表 -->
              <div v-if="userGrants.length === 0 && !loadingGrants" class="text-center py-10 text-text-tertiary text-xs">
                {{ locale.noGrants || '暂无个人加授记录' }}
              </div>
              <div v-else-if="filteredUserGrants.length === 0" class="text-center py-6 text-text-tertiary text-xs">
                {{ getLocaleText('noGrantsForUser', '该用户暂无加授记录') }}
              </div>
              <div v-else class="space-y-2.5">
                <div
                  v-for="g in filteredUserGrants"
                  :key="g.id"
                  class="group bg-bg-secondary-30 border border-border-secondary-60 hover:border-primary-40 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all"
                >
                  <div class="flex-1 min-w-0 space-y-1.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span
                        :class="[
                          'text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider',
                          g.grantType === 'assign' ? 'bg-success-10 text-success' : 'bg-error-10 text-error'
                        ]"
                      >
                        {{ g.grantType === 'assign' ? (locale.grantAssign || '加授') : (locale.grantRevoke || '减授') }}
                      </span>
                      <code
                        class="text-[11px] font-mono text-text-primary font-bold cursor-help"
                        :title="`${g.permissionKey} — ${g.permissionDescriptionZh || g.permissionKey}`"
                      >{{ g.permissionKey }}</code>
                    </div>
                    <p v-if="g.reason" class="text-[11px] text-text-tertiary leading-relaxed">{{ g.reason }}</p>
                    <p v-if="g.expiresAt" class="text-[11px] text-warning font-bold">
                      {{ locale.expiresAt || '到期' }}: {{ formatDate(g.expiresAt) }}
                    </p>
                  </div>
                  <button
                    class="p-2 text-text-tertiary hover:text-error hover:bg-error-10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    :aria-label="getLocaleText('revoke', '撤销')"
                    @click="revokeGrant(g)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </main>
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

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Plus,
  X,
  Trash2,
  Search,
  User as UserIcon,
  Layers,
  Key
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

// =============================================================
// 左侧主导航(原顶部 3 tabs)
// label 优先取 locale.tabs.*,缺失时回退到中文硬编码
// =============================================================
const tabs = computed(() => [
  {
    id: 'permissions',
    label: getLocaleText('tabs.permissions', '权限总览'),
    count: allPermissions.value.length
  },
  {
    id: 'roles',
    label: getLocaleText('tabs.roles', '角色矩阵'),
    count: roles.value.length
  },
  {
    id: 'grants',
    label: getLocaleText('tabs.grants', '个人加授'),
    count: userOptions.value.length
  }
])
const activeTab = ref('permissions')

// =============================================================
// 左侧子导航选中态
// =============================================================
/** permissions tab 选中的分类 key(从 permissionsGrouped 的键中选) */
const selectedCategory = ref<string | null>(null)
/** roles tab 选中的角色(默认 USER) */
const selectedRole = ref('USER')
// selectedUserId / selectedUserPermissions / selectedUserName / grantUserSearch
//   / userOptions / filteredUserOptions / filteredUserGrants / selectGrantUser
// 都已存在(G 用户视角),直接复用

const allPermissions = ref<Array<{ id: string; key: string; category: string; descriptionZh: string; descriptionEn?: string }>>([])
const permissionsGrouped = ref<Record<string, typeof allPermissions.value>>({})
const loadingPermissions = ref(false)

const roles = ref(['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'])
const roleMatrix = ref<Record<string, string[]>>({})
const roleLabels: Record<string, string> = {
  USER: '普通用户',
  SONG_ADMIN: '歌曲管理员',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员'
}
const categoryLabels: Record<string, string> = {
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
  role: '角色管理',
  user_permissions: '个人加授',
  permissions: '权限定义'
}
const savingRoles = ref(false)

const userGrants = ref<Array<{ id: number; userId: number; userName?: string; userUsername?: string; grantType: 'assign' | 'revoke'; permissionKey: string; permissionDescriptionZh?: string; reason?: string; expiresAt?: string }>>([])
const loadingGrants = ref(false)

const showCreateModal = ref(false)
const submitting = ref(false)
const form = reactive({
  userId: null as number | null,
  permissionKey: '',
  grantType: 'assign' as 'assign' | 'revoke',
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
const pendingRevokeGrant = ref<typeof userGrants.value[number] | null>(null)
const showRevokeDialog = ref(false)
// 文案走 i18n;key 缺失时回退到中文模板,占位符 {0}=用户名 {1}=权限 key
const revokeConfirmMessage = computed(() => {
  const grant = pendingRevokeGrant.value
  const name = grant?.userName || grant?.userUsername || ''
  const key = grant?.permissionKey || ''
  const fallback = `确定要撤销 ${name} 的 ${key} 权限吗?`
  return getLocaleText('confirmRevokeMessage', fallback, name, key)
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}

/**
 * 加载全量权限定义 + 按 category 分组;供「权限总览」Tab 渲染
 */
async function loadPermissions() {
  loadingPermissions.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { items: typeof allPermissions.value; grouped: typeof permissionsGrouped.value } }>('/api/admin/rbac/permissions')
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
    const res = await $fetch<{ success: boolean; data: { matrix: typeof roleMatrix.value } }>('/api/admin/rbac/roles')
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
    const res = await $fetch<{ success: boolean; data: typeof userGrants.value }>('/api/admin/rbac/user-permissions')
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
 * @param role - 角色枚举(USER / SONG_ADMIN / ADMIN)
 * @param permKey - 权限 key
 * @param checked - 是否勾选
 */
function toggleRolePermission(role: string, permKey: string, checked: boolean) {
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
    const body: Record<string, unknown> = {
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
  } catch (err: unknown) {
    console.error('保存加授失败:', err)
    const e = err as { data?: { message?: string } }
    toast.error(e?.data?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

/**
 * 打开撤销加授的二次确认弹窗(不再使用原生 confirm,走 locale 文案)
 * @param grant - 单条个人加授记录
 */
function revokeGrant(grant: typeof userGrants.value[number]) {
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
  } catch (err: unknown) {
    console.error('撤销失败:', err)
    const e = err as { data?: { message?: string } }
    toast.error(e?.data?.message || '撤销失败')
  } finally {
    pendingRevokeGrant.value = null
  }
}

function cancelRevoke() {
  showRevokeDialog.value = false
  pendingRevokeGrant.value = null
}

// =============================================================
// 左侧子导航联动:tab 切换时给 selected* 一个合理默认
// =============================================================
// permissions tab 默认选中第一个分类(在 permissionsGrouped 加载完后)
watch(permissionsGrouped, (g) => {
  const keys = Object.keys(g)
  if (keys.length === 0) return
  // 当前选中的分类若已不存在(例如重新加载),重置为第一个
  if (!selectedCategory.value || !g[selectedCategory.value]) {
    selectedCategory.value = keys[0]
  }
}, { immediate: true, deep: true })
// 切回 permissions tab 时确保有选中分类
watch(activeTab, (tab) => {
  if (tab === 'permissions') {
    const keys = Object.keys(permissionsGrouped.value)
    if (keys.length > 0 && (!selectedCategory.value || !permissionsGrouped.value[selectedCategory.value])) {
      selectedCategory.value = keys[0]
    }
  }
})

// =============================================================
// 角色矩阵显示权限描述 + 分类分组 / B. 搜索筛选
// (左侧搜索框驱动,角色矩阵右侧按 category 渲染)
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
  const grouped: Record<string, typeof allPermissions.value> = {}
  for (const p of filteredPermissions.value) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  }
  return grouped
})
/** permissions tab 当前选中分类的原始权限列表 */
const selectedCategoryPerms = computed(() => {
  if (!selectedCategory.value) return []
  return permissionsGrouped.value[selectedCategory.value] || []
})
/** permissions tab 右侧卡片网格:在选中分类的权限上叠加搜索过滤 */
const filteredPermissionsForCategory = computed(() => {
  const perms = selectedCategoryPerms.value
  const q = roleMatrixSearch.value.trim().toLowerCase()
  if (!q) return perms
  return perms.filter((p) =>
    p.key.toLowerCase().includes(q) ||
    (p.descriptionZh && p.descriptionZh.toLowerCase().includes(q)) ||
    (p.descriptionEn && p.descriptionEn.toLowerCase().includes(q))
  )
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
    description: '在音乐管理员基础上加用户/系统/备份/API 等(含部分破坏性操作)',
    permissions: [
      'song.read', 'song.write', 'song.reject',
      'schedule.read', 'schedule.write', 'schedule.publish',
      'playtimes.manage', 'request_times.manage',
      'semester.manage', 'stats.read',
      'card_codes.read', 'card_codes.write', 'card_codes.delete',
      'user.read', 'user.manage', 'user.status',
      'blacklist.manage', 'system_settings.read', 'system_settings.write',
      'email_templates.manage', 'smtp.manage', 'grade_class.manage',
      'backup.execute', 'backup.export', 'backup.restore',
      'notification.send',
      'api_keys.read', 'api_keys.write', 'api_keys.manage', 'api_keys.delete',
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
const pendingTemplate = ref<typeof ROLE_TEMPLATES[number] | null>(null)
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
function askApplyTemplate(tpl: typeof ROLE_TEMPLATES[number]) {
  // 按 template.key 自动匹配目标角色(也避免 SUPER_ADMIN 这类不可改的角色)
  const targetMap: Record<string, string> = {
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
// F. 焦点陷阱 + Esc 关闭
//  - createModalEl: 在组件内的弹窗(不 portal),用 ref + local listener
//  - ConfirmDialog: Teleport 到 body,用 document 监听 Esc
// =============================================================
const createModalEl = ref<HTMLElement | null>(null)
/** 收集焦点元素 + Tab 循环 */
function trapFocusIn(el: HTMLElement | null) {
  if (!el) return null
  const focusable = el.querySelectorAll<HTMLElement>(
    'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length === 0) return null
  focusable[0].focus()
  const handler = (e: KeyboardEvent) => {
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
function handleGlobalEsc(e: KeyboardEvent) {
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
const selectedUserId = ref<number | null>(null)
/** 当前选中用户已有的加授权限 key 列表(assign 类型) */
const selectedUserPermissions = ref<string[]>([])
/** 当前选中用户的可读姓名 */
const selectedUserName = computed(() => {
  if (!selectedUserId.value) return ''
  const g = userGrants.value.find((x) => x.userId === selectedUserId.value)
  return g?.userName || g?.userUsername || ''
})
/** 用户搜索框(grants tab 左侧导航顶部) */
const grantUserSearch = ref('')
/** 从 userGrants 派生的「去重用户 + 各自加授条数」列表 */
const userOptions = computed(() => {
  const map = new Map<number, { userId: number; userName?: string; userUsername?: string; grantCount: number }>()
  for (const g of userGrants.value) {
    const uid = g.userId
    if (!uid) continue
    if (!map.has(uid)) {
      map.set(uid, { userId: uid, userName: g.userName, userUsername: g.userUsername, grantCount: 0 })
    }
    map.get(uid)!.grantCount += 1
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
function selectGrantUser(userId: number) {
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
