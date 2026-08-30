<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-4">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">
          {{ showArchived ? formatMessage(locale.archivedSubtitle, archivedCount) : formatMessage(locale.subtitle, totalUsers) }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg transition-all uppercase tracking-widest active:scale-95 shadow-lg shadow-[var(--primary-glow)]"
          @click="showAddModal = true"
        >
          <UserPlus :size="14" />
          {{ locale.add }}
        </button>
        <button
          class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border-secondary text-text-secondary text-xs font-black rounded-lg transition-all uppercase tracking-widest"
          @click="showImportModal = true"
        >
          <FileSpreadsheet class="text-success" :size="14" />
          {{ locale.import }}
        </button>
        <button
          class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border-secondary text-text-secondary text-xs font-black rounded-lg transition-all uppercase tracking-widest"
          @click="showBatchUpdateModal = true"
        >
          <Layers class="text-info" :size="14" />
          {{ locale.update }}
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div
      class="bg-bg-secondary-40 border border-border-secondary-60 rounded-xl p-3 flex flex-col lg:flex-row gap-3 items-center"
    >
      <div class="relative flex-1 w-full group">
        <Search
          class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
          :size="16"
        />
        <input
          v-model="searchQuery"
          class="w-full bg-bg-primary border border-border-secondary-80 rounded-lg pl-11 pr-4 py-2.5 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
          :placeholder="locale.searchPlaceholder"
          type="text"
        >
      </div>
      <div
        class="flex items-center gap-2 w-full lg:w-auto overflow-x-auto custom-scrollbar no-scrollbar"
      >
        <!-- 角色筛选 -->
        <CustomSelect
          v-model="roleFilter"
          :options="roleFilterOptions"
          :label="locale.role"
          :placeholder="locale.allRoles"
          label-key="displayName"
          value-key="name"
          class-name="flex-1 lg:w-40 min-w-[120px]"
        />

        <!-- 状态筛选 -->
        <CustomSelect
          v-model="statusFilter"
          :options="statusFilterOptions"
          :label="locale.status"
          :placeholder="locale.allStatus"
          label-key="label"
          value-key="value"
          class-name="flex-1 lg:w-32 min-w-[100px]"
        />

        <!-- 排序 -->
        <CustomSelect
          v-model="currentSort"
          :options="sortOptions"
          :label="locale.sort"
          :placeholder="locale.sortPlaceholder"
          label-key="label"
          value-key="value"
          class-name="flex-1 lg:w-40 min-w-[140px]"
        />

        <button
          class="p-3 bg-bg-primary border border-border-secondary rounded-lg text-text-disabled hover:text-primary transition-all shadow-sm flex items-center justify-center"
          @click="loadUsers(1)"
        >
          <RefreshCw :size="14" />
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
      <section
        class="bg-bg-secondary-30 border border-border-secondary-60 rounded-xl overflow-hidden shadow-lg min-w-0"
      >
        <div class="p-4 border-b border-border-secondary-60 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-black text-text-primary tracking-tight">{{ locale.organization.title }}</h3>
            <p class="text-[10px] text-text-disabled mt-1">
              {{ formatMessage(locale.organization.subtitle, treeUsers.length) }}
            </p>
          </div>
          <button
            class="p-2 bg-bg-primary border border-border-secondary rounded-lg text-text-disabled hover:text-primary transition-all flex items-center justify-center"
            :title="locale.organization.refresh"
            @click="loadUserTree"
          >
            <RefreshCw :size="14" :class="{ 'animate-spin': treeLoading }" />
          </button>
        </div>

        <div
          v-if="activeOrgFilterLabel"
          class="mx-4 mt-4 p-3 bg-primary-10 border border-primary-20 rounded-lg flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <p class="text-[10px] font-black text-primary uppercase tracking-widest">{{ locale.organization.currentScope }}</p>
            <p class="text-xs font-bold text-text-primary truncate">{{ activeOrgFilterLabel }}</p>
          </div>
          <button
            class="text-[10px] font-black text-primary hover:text-text-primary transition-colors shrink-0"
            @click="clearTreeFilter"
          >
            {{ locale.organization.clear }}
          </button>
        </div>

        <div v-if="treeLoading" class="py-12 flex flex-col items-center justify-center text-text-disabled">
          <RefreshCw :size="22" class="animate-spin mb-3" />
          <span class="text-[10px] font-black uppercase tracking-widest">{{ locale.organization.loading }}</span>
        </div>

        <div
          v-else-if="treeError"
          class="m-4 p-4 bg-error-10 border border-error-20 rounded-lg text-xs text-error leading-relaxed"
        >
          {{ treeError }}
        </div>

        <div v-else-if="userTree.length === 0" class="py-12 text-center text-xs text-text-disabled">
          {{ locale.organization.empty }}
        </div>

        <div v-else class="p-3 max-h-[680px] overflow-y-auto custom-scrollbar">
          <div v-for="stage in userTree" :key="stage.key" class="tree-group">
            <div class="flex items-center gap-1">
              <button class="tree-toggle" @click="toggleTreeNode(stage.key)">
                <ChevronDown v-if="isTreeNodeExpanded(stage.key)" :size="13" />
                <ChevronRight v-else :size="13" />
              </button>
              <button
                class="tree-label font-black text-text-primary"
                :class="isStageFilterActive(stage.label) ? 'tree-label-active' : ''"
                @click="handleStageClick(stage)"
              >
                <span class="truncate">{{ stage.label }}</span>
                <span class="tree-count">{{ formatMessage(locale.organization.count, stage.count) }}</span>
              </button>
            </div>

            <div v-if="isTreeNodeExpanded(stage.key)" class="tree-branch">
              <div v-for="grade in stage.grades" :key="grade.key" class="tree-group">
                <div class="flex items-center gap-1">
                  <button class="tree-toggle" @click="toggleTreeNode(grade.key)">
                    <ChevronDown v-if="isTreeNodeExpanded(grade.key)" :size="13" />
                    <ChevronRight v-else :size="13" />
                  </button>
                  <button
                    class="tree-label"
                    :class="
                      isTreeFilterActive(stage.label, grade.label, '') ? 'tree-label-active' : ''
                    "
                    @click="applyTreeFilter(grade.label, '', stage.label)"
                  >
                    <span class="truncate">{{ grade.label }}</span>
                    <span class="tree-count">{{ formatMessage(locale.organization.count, grade.count) }}</span>
                  </button>
                </div>

                <div v-if="isTreeNodeExpanded(grade.key)" class="tree-branch">
                  <div v-for="classNode in grade.classes" :key="classNode.key" class="tree-group">
                    <div class="flex items-center gap-1">
                      <button class="tree-toggle" @click="toggleTreeNode(classNode.key)">
                        <ChevronDown v-if="isTreeNodeExpanded(classNode.key)" :size="13" />
                        <ChevronRight v-else :size="13" />
                      </button>
                      <button
                        class="tree-label"
                        :class="
                          isTreeFilterActive(stage.label, grade.label, classNode.label)
                            ? 'tree-label-active'
                            : ''
                        "
                        @click="applyTreeFilter(grade.label, classNode.label, stage.label)"
                      >
                        <span class="truncate">{{ classNode.label }}</span>
                        <span class="tree-count">{{ formatMessage(locale.organization.count, classNode.count) }}</span>
                      </button>
                    </div>

                    <div v-if="isTreeNodeExpanded(classNode.key)" class="tree-users">
                      <button
                        v-for="treeUser in classNode.users"
                        :key="treeUser.id"
                        class="tree-user"
                        @click="openTreeUser(treeUser)"
                      >
                        <User :size="12" class="text-text-disabled shrink-0" />
                        <span class="truncate text-text-secondary">{{ getUserDisplayName(treeUser) }}</span>
                        <span class="truncate text-text-disabled font-mono">@{{ treeUser.username }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 用户表格 -->
      <div class="space-y-4 min-w-0">
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <AppSpinner :size="32" class="mb-4" />
        <div class="text-xs font-black uppercase tracking-widest">{{ locale.loading }}</div>
      </div>

      <div
        v-else-if="users.length === 0"
        class="flex flex-col items-center justify-center py-20 bg-bg-secondary-20 border border-border-secondary-50 rounded-xl"
      >
        <div
          class="w-16 h-16 rounded-lg bg-bg-tertiary-50 flex items-center justify-center text-text-disabled mb-4"
        >
          <Search :size="32" />
        </div>
        <div class="text-sm font-black text-text-tertiary uppercase tracking-widest">
          {{ searchQuery ? locale.emptySearch : locale.empty }}
        </div>
      </div>

      <template v-else>
        <!-- 桌面端表格 -->
        <div
          class="hidden lg:block bg-bg-secondary-20 border border-border-secondary-50 rounded-xl overflow-hidden shadow-lg custom-scrollbar"
        >
          <table class="w-full">
            <thead>
              <tr
                class="bg-bg-secondary-60 border-b border-border-secondary text-[10px] font-black text-text-disabled uppercase tracking-widest"
              >
                <th class="px-6 py-5 text-left">{{ locale.table.userDetails }}</th>
                <th class="px-6 py-5 text-left">{{ locale.table.role }}</th>
                <th class="px-6 py-5 text-left">{{ locale.table.status }}</th>
                <th class="px-6 py-5 text-center">{{ locale.table.class }}</th>
                <th class="px-6 py-5 text-left">{{ locale.table.lastActivity }}</th>
                <th class="px-6 py-5 text-right pr-10">{{ locale.table.actions }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-panel-bg-dark-40">
              <tr
                v-for="user in users"
                :key="user.id"
                class="group hover:bg-bg-tertiary-30 transition-all text-xs cursor-pointer"
                @click="showUserDetail(user, $event)"
              >
                <td class="px-6 py-5">
                  <div class="flex items-center gap-4">
                    <img
                      v-if="user.avatar && !failedImages[user.id]"
                      :src="user.avatar"
                      class="w-10 h-10 rounded-xl object-cover border border-border-tertiary-50"
                      @error="handleImageError(user.id)"
                    >
                    <div
                      v-else
                      class="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center font-black text-text-tertiary group-hover:text-text-secondary transition-colors border border-border-tertiary-50"
                    >
                      {{ getUserInitial(user) }}
                    </div>
                    <div>
                      <p class="font-black text-text-primary">{{ getUserDisplayName(user) }}</p>
                      <p class="text-[10px] text-text-disabled font-mono mt-0.5">
                        ID: {{ user.username }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-5">
                  <span
                    v-if="user.role === 'SUPER_ADMIN'"
                    class="px-2 py-0.5 bg-warning-10 text-warning text-[10px] font-black rounded border border-warning-20 uppercase tracking-widest"
                    >{{ getRoleName('SUPER_ADMIN') }}</span
                  >
                  <span
                    v-else-if="user.role === 'ADMIN'"
                    class="px-2 py-0.5 bg-primary-10 text-primary text-[10px] font-black rounded border border-primary-20 uppercase tracking-widest"
                    >{{ getRoleName('ADMIN') }}</span
                  >
                  <span
                    v-else-if="user.role === 'SONG_ADMIN'"
                    class="px-2 py-0.5 bg-info-10 text-info text-[10px] font-black rounded border border-info-20 uppercase tracking-widest"
                    >{{ getRoleName('SONG_ADMIN') }}</span
                  >
                  <span
                    v-else
                    class="px-2 py-0.5 bg-bg-tertiary text-text-tertiary text-[10px] font-black rounded border border-border-tertiary-50 uppercase tracking-widest"
                    >{{ getRoleName('USER') }}</span
                  >
                </td>
                <td class="px-6 py-5">
                  <div
                    v-if="user.status === 'active'"
                    class="flex items-center gap-1.5 text-success font-black uppercase text-[10px] tracking-widest"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success-50)]"
                    />
                    {{ getStatusName('active') }}
                  </div>
                  <div
                    v-else-if="user.status === 'pending'"
                    class="flex items-center gap-1.5 text-info font-black uppercase text-[10px] tracking-widest"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full bg-info shadow-[0_0_8px_var(--info-50)]"
                    />
                    {{ getStatusName('pending') }}
                  </div>
                  <div
                    v-else-if="user.status === 'withdrawn'"
                    class="flex items-center gap-1.5 text-error font-black uppercase text-[10px] tracking-widest"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-error" />
                    {{ getStatusName('withdrawn') }}
                  </div>
                  <div
                    v-else-if="user.status === 'graduate'"
                    class="flex items-center gap-1.5 text-warning font-black uppercase text-[10px] tracking-widest"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-warning" />
                    {{ getStatusName('graduate') }}
                  </div>
                  <div
                    v-else
                    class="flex items-center gap-1.5 text-text-tertiary font-black uppercase text-[10px] tracking-widest"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-bg-quaternary" />
                    {{ getStatusName('disabled') }}
                  </div>
                </td>
                <td class="px-6 py-5 text-center font-bold text-text-tertiary">
                  {{ user.grade || '-' }} {{ user.class || '-' }}
                </td>
                <td class="px-6 py-5">
                  <p class="text-text-tertiary font-bold">{{ formatDate(user.lastLogin) }}</p>
                  <p class="text-[11px] text-text-secondary font-mono mt-1 flex items-center gap-1">
                    <MapPin :size="10" /> {{ user.lastLoginIp || '-' }}
                  </p>
                </td>
                <td class="px-6 py-5 text-right pr-10">
                  <div
                    class="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all action-buttons"
                  >
                    <button
                      :disabled="!canManageUser(user)"
                      class="p-2 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-primary transition-colors disabled:opacity-20 disabled:cursor-not-allowed action-btn"
                      :title="locale.actions.editUser"
                      @click="editUser(user)"
                    >
                      <Edit2 :size="13" />
                    </button>
                    <button
                      v-if="user.status === 'pending'"
                      class="p-2 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-info transition-colors action-btn flex items-center justify-center"
                      :title="locale.actions.approve"
                      @click="openApproval(user)"
                    >
                      <ClipboardCheck :size="13" />
                    </button>
                    <button
                      class="p-2 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-info transition-colors action-btn flex items-center justify-center"
                      :title="locale.actions.viewSongs"
                      @click="viewUserSongs(user)"
                    >
                      <Music :size="13" />
                    </button>
                    <button
                      :disabled="!canManageUser(user)"
                      class="p-2 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-warning transition-colors disabled:opacity-20 disabled:cursor-not-allowed action-btn flex items-center justify-center"
                      :title="locale.actions.resetPassword"
                      @click="resetPassword(user)"
                    >
                      <Lock :size="13" />
                    </button>
                    <button
                      :disabled="!canManageUser(user)"
                      class="p-2 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-error transition-colors disabled:opacity-20 disabled:cursor-not-allowed action-btn"
                      :title="locale.actions.deleteUser"
                      @click="confirmDeleteUser(user)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 移动端卡片式布局 -->
        <div class="lg:hidden grid grid-cols-1 gap-4">
          <div
            v-for="user in users"
            :key="user.id"
            class="bg-bg-secondary-40 border border-border-secondary rounded-xl p-5 space-y-5 shadow-lg shadow-[0_10px_15px_var(--shadow-color)]"
            @click="showUserDetail(user, $event)"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <img
                  v-if="user.avatar && !failedImages[user.id]"
                  :src="user.avatar"
                  class="w-12 h-12 rounded-lg object-cover border border-border-tertiary"
                  @error="handleImageError(user.id)"
                >
                <div
                  v-else
                  class="w-12 h-12 rounded-lg bg-bg-tertiary flex items-center justify-center font-black text-lg text-text-tertiary border border-border-tertiary"
                >
                  {{ getUserInitial(user) }}
                </div>
                <div>
                  <h4 class="text-base font-black text-text-primary">{{ getUserDisplayName(user) }}</h4>
                  <p class="text-xs text-text-tertiary font-mono">@{{ user.username }}</p>
                </div>
              </div>
              <div class="text-right">
                <div
                  v-if="user.status === 'active'"
                  class="flex items-center gap-1.5 text-success font-black uppercase text-[10px] tracking-widest"
                >
                  <div
                    class="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success-50)]"
                  />
                  {{ getStatusName('active') }}
                </div>
                <div
                  v-else-if="user.status === 'pending'"
                  class="flex items-center gap-1.5 text-info font-black uppercase text-[10px] tracking-widest"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-info" />
                  {{ getStatusName('pending') }}
                </div>
                <div
                  v-else-if="user.status === 'withdrawn'"
                  class="flex items-center gap-1.5 text-error font-black uppercase text-[10px] tracking-widest"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-error" />
                  {{ getStatusName('withdrawn') }}
                </div>
                <div
                  v-else-if="user.status === 'graduate'"
                  class="flex items-center gap-1.5 text-warning font-black uppercase text-[10px] tracking-widest"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-warning" />
                  {{ getStatusName('graduate') }}
                </div>
                <div
                  v-else
                  class="flex items-center gap-1.5 text-text-tertiary font-black uppercase text-[10px] tracking-widest"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-bg-quaternary" />
                  {{ getStatusName('disabled') }}
                </div>
                <p class="text-[10px] font-black text-text-secondary uppercase mt-1">{{ locale.mobile.accountStatus }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 py-4 border-y border-border-secondary-50">
              <div class="space-y-1">
                <p class="text-[9px] font-black text-text-disabled uppercase tracking-widest">
                  {{ locale.mobile.roleLevel }}
                </p>
                <div>
                  <span
                    v-if="user.role === 'SUPER_ADMIN'"
                    class="px-2 py-0.5 bg-warning-10 text-warning text-[10px] font-black rounded border border-warning-20 uppercase tracking-widest"
                    >{{ getRoleName('SUPER_ADMIN') }}</span
                  >
                  <span
                    v-else-if="user.role === 'ADMIN'"
                    class="px-2 py-0.5 bg-primary-10 text-primary text-[10px] font-black rounded border border-primary-20 uppercase tracking-widest"
                    >{{ getRoleName('ADMIN') }}</span
                  >
                  <span
                    v-else-if="user.role === 'SONG_ADMIN'"
                    class="px-2 py-0.5 bg-info-10 text-info text-[10px] font-black rounded border border-info-20 uppercase tracking-widest"
                    >{{ getRoleName('SONG_ADMIN') }}</span
                  >
                  <span
                    v-else
                    class="px-2 py-0.5 bg-bg-tertiary text-text-tertiary text-[10px] font-black rounded border border-border-tertiary-50 uppercase tracking-widest"
                    >{{ getRoleName('USER') }}</span
                  >
                </div>
              </div>
              <div class="space-y-1 text-right">
                <p class="text-[9px] font-black text-text-disabled uppercase tracking-widest">
                  {{ locale.mobile.class }}
                </p>
                <p class="text-xs font-bold text-text-secondary">
                  {{ user.grade || '-' }} {{ user.class || '-' }}
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-[9px] font-black text-text-disabled uppercase tracking-widest">
                  {{ locale.mobile.recentActivity }}
                </p>
                <p class="text-xs font-bold text-text-tertiary">{{ formatDate(user.lastLogin) }}</p>
              </div>
              <div class="space-y-1 text-right">
                <p class="text-[9px] font-black text-text-disabled uppercase tracking-widest">
                  {{ locale.mobile.lastLoginIp }}
                </p>
                <p class="text-[11px] font-mono text-text-disabled">{{ user.lastLoginIp || '-' }}</p>
              </div>
            </div>

            <div class="flex gap-2 action-buttons">
              <button
                :disabled="!canManageUser(user)"
                class="flex-1 py-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-primary-hover active:text-text-primary transition-colors disabled:opacity-20 action-btn"
                @click="editUser(user)"
              >
                <Edit2 :size="12" /> {{ locale.actions.edit }}
              </button>
              <button
                v-if="user.status === 'pending'"
                class="flex-1 py-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-info active:text-text-primary transition-colors action-btn"
                @click="openApproval(user)"
              >
                <ClipboardCheck :size="12" /> {{ locale.actions.approve }}
              </button>
              <button
                class="flex-1 py-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-info active:text-text-primary transition-colors action-btn"
                @click="viewUserSongs(user)"
              >
                <Music :size="12" /> {{ locale.actions.records }}
              </button>
              <button
                :disabled="!canManageUser(user)"
                class="flex-1 py-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-warning active:text-text-primary transition-colors disabled:opacity-20 action-btn"
                @click="resetPassword(user)"
              >
                <Lock :size="12" /> {{ locale.actions.reset }}
              </button>
              <button
                :disabled="!canManageUser(user)"
                class="px-3 py-2.5 bg-bg-primary border border-border-secondary rounded-lg text-text-tertiary active:bg-error active:text-text-primary transition-colors disabled:opacity-20 action-btn"
                @click="confirmDeleteUser(user)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </template>
      <!-- 分页 -->
      <Pagination
        v-model:current-page="currentPage"
        :total-pages="totalPages"
        :total-items="totalUsers"
        :item-name="locale.itemName"
      />
      </div>
    </div>

    <!-- 添加/编辑用户模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showAddModal || editingUser"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      >
        <div
          class="bg-bg-secondary border border-border-secondary w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-primary-hover-10 flex items-center justify-center text-primary"
                  >
                    <UserPlus v-if="!editingUser" :size="20" />
                    <Edit2 v-else :size="20" />
                  </div>
                  {{ editingUser ? locale.form.editTitle : locale.form.createTitle }}
                </h3>
                <p class="text-xs text-text-tertiary mt-1 ml-13">{{ locale.form.desc }}</p>
              </div>
              <button
                class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-2xl transition-all"
                @click="closeModal"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-5">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.form.name }}</label
                  >
                  <div class="relative group">
                    <User
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.name"
                      class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                      :placeholder="locale.form.namePlaceholder"
                      type="text"
                    >
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.form.username }}</label
                  >
                  <div class="relative group">
                    <AtSign
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.username"
                      class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                      :placeholder="locale.form.usernamePlaceholder"
                      type="text"
                    >
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1">
                  {{ editingUser ? locale.form.newPassword : locale.form.initialPassword }}
                </label>
                <div class="relative group">
                  <Lock
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                    :size="16"
                  />
                  <input
                    v-model="userForm.password"
                    class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                    :placeholder="locale.form.passwordPlaceholder"
                    type="password"
                  >
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.form.role }}</label
                  >
                  <CustomSelect
                    v-model="userForm.role"
                    :options="availableRoles"
                    label-key="displayName"
                    value-key="name"
                    :placeholder="locale.form.rolePlaceholder"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.form.status }}</label
                  >
                  <CustomSelect
                    v-model="userForm.status"
                    :options="userStatusOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="locale.form.statusPlaceholder"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.form.grade }}</label
                  >
                  <div class="relative group">
                    <Calendar
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.grade"
                      class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                      :placeholder="locale.form.gradePlaceholder"
                      type="text"
                    >
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.form.class }}</label
                  >
                  <div class="relative group">
                    <Briefcase
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.class"
                      class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                      :placeholder="locale.form.classPlaceholder"
                      type="text"
                    >
                  </div>
                </div>
              </div>

              <div
                v-if="formError"
                class="p-4 bg-error-10 border border-error-20 rounded-2xl flex items-center gap-3 text-error text-xs"
              >
                <AlertCircle :size="16" />
                {{ formError }}
              </div>
            </div>

            <div class="flex gap-3 mt-10">
              <button
                class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeModal"
              >
                {{ locale.form.cancel }}
              </button>
              <button
                :disabled="saving"
                class="flex-[2] px-6 py-4 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[var(--primary-glow)] active:scale-95"
                @click="saveUser"
              >
                <Save v-if="!saving" :size="16" />
                <RefreshCw v-else class="animate-spin" :size="16" />
                {{ saving ? locale.form.saving : editingUser ? locale.form.update : locale.form.create }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 重置密码模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="resetPasswordUser"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      >
        <div
          class="bg-bg-secondary border border-border-secondary w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8 text-center">
            <div
              class="w-20 h-20 bg-warning-10 rounded-[2rem] flex items-center justify-center text-warning mx-auto mb-6"
            >
              <Lock :size="32" />
            </div>
            <h3 class="text-xl font-black text-text-primary tracking-tight">{{ locale.resetPasswordModal.title }}</h3>
            <p class="text-xs text-text-tertiary mt-2 mb-8">
              {{ locale.resetPasswordModal.descPrefix }}
              <span class="text-text-primary font-bold">{{ resetPasswordUser.name }}</span>
              {{ locale.resetPasswordModal.descSuffix }}
            </p>

            <div class="space-y-4 text-left">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                  >{{ locale.resetPasswordModal.newPassword }}</label
                >
                <div class="relative group">
                  <Key
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-warning transition-colors"
                    :size="16"
                  />
                  <input
                    v-model="passwordForm.password"
                    class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-warning-30 transition-all text-text-primary"
                    :placeholder="locale.resetPasswordModal.newPasswordPlaceholder"
                    type="password"
                  >
                </div>
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                  >{{ locale.resetPasswordModal.confirmPassword }}</label
                >
                <div class="relative group">
                  <Key
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-warning transition-colors"
                    :size="16"
                  />
                  <input
                    v-model="passwordForm.confirmPassword"
                    class="w-full bg-bg-primary border border-border-secondary rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-warning-30 transition-all text-text-primary"
                    :placeholder="locale.resetPasswordModal.confirmPasswordPlaceholder"
                    type="password"
                  >
                </div>
              </div>

              <div
                v-if="passwordError"
                class="p-4 bg-error-10 border border-error-20 rounded-2xl flex items-center gap-3 text-error text-xs"
              >
                <AlertCircle :size="16" />
                {{ passwordError }}
              </div>
            </div>

            <div class="flex gap-3 mt-8">
              <button
                class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeResetPassword"
              >
                {{ locale.resetPasswordModal.cancel }}
              </button>
              <button
                :disabled="resetting"
                class="flex-[2] px-6 py-4 bg-warning hover:bg-warning text-text-primary text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[var(--warning-glow-20)] active:scale-95"
                @click="confirmResetPassword"
              >
                <Save v-if="!resetting" :size="16" />
                <RefreshCw v-else class="animate-spin" :size="16" />
                {{ resetting ? locale.resetPasswordModal.resetting : locale.resetPasswordModal.confirm }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 批量导入用户模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showImportModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      >
        <div
          class="bg-bg-secondary border border-border-secondary w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-success-10 flex items-center justify-center text-success"
                  >
                    <FileSpreadsheet :size="20" />
                  </div>
                  {{ locale.importModal.title }}
                </h3>
                <p class="text-xs text-text-tertiary mt-1 ml-13">
                  {{ locale.importModal.desc }}
                </p>
              </div>
              <button
                class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-2xl transition-all"
                @click="closeImportModal"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div class="p-5 bg-bg-primary-50 border border-border-secondary-50 rounded-3xl space-y-4">
                <div class="flex items-center gap-2 text-text-secondary font-bold text-sm mb-2">
                  <Info :size="16" class="text-primary" />
                  {{ locale.importModal.instructionsTitle }}
                </div>
                <p class="text-xs text-text-tertiary leading-relaxed">
                  {{ locale.importModal.instructionsLine1 }}
                  {{ locale.importModal.instructionsLine2 }}
                </p>

                <div class="overflow-hidden rounded-2xl border border-border-secondary-80">
                  <table class="w-full text-[10px] text-left">
                    <thead class="bg-bg-secondary text-text-tertiary uppercase tracking-tighter">
                      <tr>
                        <th class="px-3 py-2 border-b border-border-secondary">{{ locale.importModal.sampleHeaders.name }}</th>
                        <th class="px-3 py-2 border-b border-border-secondary">{{ locale.importModal.sampleHeaders.username }}</th>
                        <th class="px-3 py-2 border-b border-border-secondary">{{ locale.importModal.sampleHeaders.password }}</th>
                        <th class="px-3 py-2 border-b border-border-secondary">{{ locale.importModal.sampleHeaders.role }}</th>
                        <th class="px-3 py-2 border-b border-border-secondary">{{ locale.importModal.sampleHeaders.grade }}</th>
                        <th class="px-3 py-2 border-b border-border-secondary">{{ locale.importModal.sampleHeaders.class }}</th>
                      </tr>
                    </thead>
                    <tbody class="text-text-tertiary">
                      <tr class="border-b border-border-secondary-50">
                        <td class="px-3 py-2">{{ locale.importModal.sampleName }}</td>
                        <td class="px-3 py-2">zhangsan</td>
                        <td class="px-3 py-2">******</td>
                        <td class="px-3 py-2">USER</td>
                        <td class="px-3 py-2">{{ locale.importModal.sampleGrade }}</td>
                        <td class="px-3 py-2">{{ locale.importModal.sampleClass }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="flex items-center justify-between gap-4">
                  <div
                    class="p-3 bg-primary-5 border border-primary-10 rounded-2xl text-[10px] text-primary-80 leading-relaxed flex-1"
                  >
                    <strong>{{ locale.importModal.supportedRoles }}</strong>
                    <span v-if="isSuperAdmin"
                      >{{ locale.importModal.supportedRolesFull }}</span
                    >
                    <span v-else>{{ locale.importModal.supportedRolesLimited }}</span>
                  </div>
                  <button
                    class="px-4 py-3 bg-success-10 border border-success-20 hover:border-success-40 rounded-xl transition-all flex items-center gap-2 group shrink-0"
                    @click="downloadImportTemplate"
                  >
                    <Download
                      :size="16"
                      class="text-success group-hover:scale-110 transition-transform"
                    />
                    <span class="text-[10px] font-black text-success uppercase tracking-widest"
                      >{{ locale.importModal.downloadTemplate }}</span
                    >
                  </button>
                </div>
              </div>

              <div class="space-y-3">
                <label class="block text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
                  >{{ locale.importModal.chooseFile }}</label
                >
                <div class="relative group cursor-pointer" @click="$refs.fileInput.click()">
                  <input
                    id="file-upload"
                    ref="fileInput"
                    accept=".xlsx"
                    class="hidden"
                    type="file"
                    @change="handleFileUpload"
                  >
                  <div
                    class="w-full py-10 border-2 border-dashed border-border-secondary group-hover:border-success-50 group-hover:bg-success-5 rounded-3xl transition-all flex flex-col items-center justify-center gap-3"
                  >
                    <div
                      class="w-12 h-12 rounded-2xl bg-bg-secondary flex items-center justify-center text-text-disabled group-hover:text-success transition-colors"
                    >
                      <Upload :size="24" />
                    </div>
                    <div class="text-center">
                      <p class="text-sm font-bold text-text-secondary">{{ locale.importModal.uploadTitle }}</p>
                      <p class="text-xs text-text-tertiary mt-1">{{ locale.importModal.uploadHint }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="importError"
                class="p-4 bg-error-10 border border-error-20 rounded-2xl flex gap-3 text-error text-xs items-start"
              >
                <AlertCircle :size="16" class="mt-0.5 shrink-0" />
                <div class="whitespace-pre-wrap leading-relaxed">{{ importError }}</div>
              </div>

              <!-- 进度条 -->
              <div
                v-if="importProgressText"
                class="p-5 bg-success-5 border border-success-20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black text-success uppercase tracking-widest">{{ importProgressText }}</span>
                  <span class="text-xs font-black text-success">{{ importProgress }}%</span>
                </div>
                <div class="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-success to-success-light transition-all duration-300 ease-out rounded-full"
                    :style="{ width: importProgress + '%' }"
                  />
                </div>
              </div>

              <div v-if="previewData.length > 0" class="space-y-3">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-xs font-black text-text-tertiary uppercase tracking-widest"
                    >{{ formatMessage(locale.importModal.previewData, previewData.length) }}</label
                  >
                </div>
                <div class="overflow-hidden rounded-3xl border border-border-secondary bg-bg-primary-30">
                  <table class="w-full text-xs text-left">
                    <thead class="bg-bg-secondary-50 text-text-tertiary">
                      <tr>
                        <th class="px-4 py-3 font-medium">{{ locale.importModal.sampleHeaders.name }}</th>
                        <th class="px-4 py-3 font-medium">{{ locale.importModal.account }}</th>
                        <th class="px-4 py-3 font-medium">{{ locale.importModal.sampleHeaders.role }}</th>
                        <th class="px-4 py-3 font-medium">{{ locale.importModal.gradeClass }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-panel-bg-deepest">
                      <tr
                        v-for="(row, index) in previewData.slice(0, 5)"
                        :key="index"
                        class="text-text-secondary"
                      >
                        <td class="px-4 py-3">{{ row.name }}</td>
                        <td class="px-4 py-3">{{ row.username }}</td>
                        <td class="px-4 py-3">
                          <span
                            class="px-2 py-0.5 bg-bg-tertiary rounded-md text-[10px] text-text-tertiary uppercase"
                            >{{ row.role }}</span
                          >
                        </td>
                        <td class="px-4 py-3 text-text-tertiary">
                          {{ row.grade || '-' }} / {{ row.class || '-' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    v-if="previewData.length > 5"
                    class="p-3 text-center border-t border-border-secondary text-[10px] text-text-tertiary font-medium"
                  >
                    {{ formatMessage(locale.importModal.moreRecords, previewData.length - 5) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="flex gap-3 mt-8">
              <button
                class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeImportModal"
              >
                {{ locale.importModal.cancel }}
              </button>
              <button
                :disabled="importLoading || previewData.length === 0"
                class="flex-[2] px-6 py-4 bg-success hover:bg-success text-text-primary text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[var(--success-glow-20)] active:scale-95"
                @click="importUsers"
              >
                <Save v-if="!importLoading" :size="16" />
                <RefreshCw v-else class="animate-spin" :size="16" />
                {{ importLoading ? locale.importModal.importing : locale.importModal.confirm }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      :show="showDeleteModal"
      :title="locale.deleteDialog.title"
      :message="formatMessage(locale.deleteDialog.message, deletingUser?.name || '')"
      type="danger"
      :confirm-text="locale.deleteDialog.confirm"
      :loading="deleting"
      @confirm="confirmDelete"
      @close="closeDeleteModal"
    />

    <!-- 批量更新模态框 -->
    <BatchUpdateModal
      :show="showBatchUpdateModal"
      :users="users"
      @close="closeBatchUpdateModal"
      @update-success="handleBatchUpdateSuccess"
    />

    <!-- 用户歌曲模态框 -->
    <UserSongsModal
      :show="showUserSongsModal"
      :user-id="selectedUserId"
      @close="closeUserSongsModal"
    />

<!-- 用户注册审核模态框 -->
    <UserApprovalModal
      :show="showApprovalModal"
      :user="userToApprove"
      @close="showApprovalModal = false"
      @success="handleApprovalSuccess"
    />

    <!-- OAuth 绑定详情模态框 -->
    <OAuthBindingsModal
      :show="showOAuthBindingsModal"
      :identities="selectedUserDetail?.identities || []"
      @close="closeOAuthBindingsModal"
    />

    <!-- 用户详细信息模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showUserDetailModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
        @click="closeUserDetailModal"
      >
        <div
          class="bg-bg-secondary border border-border-secondary w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-primary-hover-10 flex items-center justify-center text-primary"
                  >
                    <User :size="20" />
                  </div>
                  {{ locale.detail.title }}
                </h3>
                <p class="text-xs text-text-tertiary mt-1 ml-13">{{ locale.detail.desc }}</p>
              </div>
              <button
                class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-2xl transition-all"
                @click="closeUserDetailModal"
              >
                <X :size="20" />
              </button>
            </div>

            <div
              v-if="selectedUserDetail"
              class="space-y-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"
            >
              <!-- 基本信息 -->
              <div class="space-y-4">
                <div
                  class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
                >
                  <Info :size="14" class="text-primary" />
                  {{ locale.detail.basicInfo }}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                      {{ locale.detail.userId }}
                    </div>
                    <div class="text-sm font-bold text-text-secondary">{{ selectedUserDetail.id }}</div>
                  </div>
                  <div class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                      {{ locale.detail.name }}
                    </div>
                    <div class="text-sm font-bold text-text-secondary">{{ selectedUserDetail.name }}</div>
                  </div>
                  <div class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                      {{ locale.detail.username }}
                    </div>
                    <div class="text-sm font-bold text-text-secondary">
                      {{ selectedUserDetail.username }}
                    </div>
                  </div>
                  <div class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                      {{ locale.detail.role }}
                    </div>
                    <div>
                      <span
                        :class="[
                          'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest',
                          getRoleClass(selectedUserDetail.role)
                        ]"
                      >
                        {{ getRoleDisplayName(selectedUserDetail.role) }}
                      </span>
                    </div>
                  </div>
                  <div class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                      {{ locale.detail.grade }}
                    </div>
                    <div class="text-sm font-bold text-text-secondary">
                      {{ selectedUserDetail.grade || locale.detail.unset }}
                    </div>
                  </div>
                  <div class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                      {{ locale.detail.class }}
                    </div>
                    <div class="text-sm font-bold text-text-secondary">
                      {{ selectedUserDetail.class || locale.detail.unset }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 账户状态 -->
              <div class="space-y-4">
                <div
                  class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
                >
                  <Shield :size="14" class="text-success" />
                  {{ locale.detail.status }}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl flex items-center justify-between"
                  >
                    <div class="space-y-1 overflow-hidden pr-2">
                      <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                        {{ locale.detail.passwordStatus }}
                      </div>
                      <div
                        class="text-sm font-bold truncate"
                        :class="
                          !selectedUserDetail.forcePasswordChange &&
                          selectedUserDetail.passwordChangedAt
                            ? 'text-success'
                            : 'text-warning'
                        "
                      >
                        {{
                          !selectedUserDetail.forcePasswordChange &&
                          selectedUserDetail.passwordChangedAt
                            ? locale.detail.passwordChanged
                            : locale.detail.requirePasswordChange
                        }}
                      </div>
                    </div>
                    <div
                      :class="[
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                        !selectedUserDetail.forcePasswordChange &&
                        selectedUserDetail.passwordChangedAt
                          ? 'bg-success-10 text-success'
                          : 'bg-warning-10 text-warning'
                      ]"
                    >
                      <CheckCircle2
                        v-if="
                          !selectedUserDetail.forcePasswordChange &&
                          selectedUserDetail.passwordChangedAt
                        "
                        :size="16"
                      />
                      <AlertCircle v-else :size="16" />
                    </div>
                  </div>
                  <div
                    class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl flex items-center justify-between"
                  >
                    <div class="space-y-1 overflow-hidden pr-2">
                      <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                        {{ locale.detail.meowBinding }}
                      </div>
                      <div
                        class="text-sm font-bold truncate"
                        :class="
                          selectedUserDetail.meowNickname ? 'text-success' : 'text-text-tertiary'
                        "
                        :title="selectedUserDetail.meowNickname ? formatMessage(locale.detail.bound, selectedUserDetail.meowNickname) : locale.detail.unbound"
                      >
                        {{
                          selectedUserDetail.meowNickname
                            ? formatMessage(locale.detail.bound, selectedUserDetail.meowNickname)
                            : locale.detail.unbound
                        }}
                      </div>
                    </div>
                    <div
                      :class="[
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                        selectedUserDetail.meowNickname
                          ? 'bg-success-10 text-success'
                          : 'bg-bg-tertiary text-text-disabled'
                      ]"
                    >
                      <AtSign :size="16" />
                    </div>
                  </div>

                  <!-- 邮箱绑定 -->
                  <div
                    class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl flex items-center justify-between"
                  >
                    <div class="space-y-1 overflow-hidden pr-2">
                      <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                        {{ locale.detail.emailBinding }}
                      </div>
                      <div
                        class="text-sm font-bold truncate"
                        :class="
                          selectedUserDetail.email ? (selectedUserDetail.emailVerified ? 'text-success' : 'text-warning') : 'text-text-tertiary'
                        "
                        :title="selectedUserDetail.email ? `${selectedUserDetail.email} (${selectedUserDetail.emailVerified ? locale.detail.verified : locale.detail.unverified})` : locale.detail.unbound"
                      >
                        {{
                          selectedUserDetail.email
                            ? `${selectedUserDetail.email} (${selectedUserDetail.emailVerified ? locale.detail.verified : locale.detail.unverified})`
                            : locale.detail.unbound
                        }}
                      </div>
                    </div>
                    <div
                      :class="[
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                        selectedUserDetail.email
                          ? (selectedUserDetail.emailVerified ? 'bg-success-10 text-success' : 'bg-warning-10 text-warning')
                          : 'bg-bg-tertiary text-text-disabled'
                      ]"
                    >
                      <Mail :size="16" />
                    </div>
                  </div>

                  <!-- OAuth 账号绑定 -->
                  <button
                    type="button"
                    class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl flex items-center justify-between w-full text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    :class="
                      selectedUserDetail.identities?.length > 0
                        ? 'cursor-pointer hover:bg-bg-primary hover:border-border-tertiary group'
                        : ''
                    "
                    :disabled="!selectedUserDetail.identities?.length"
                    @click="openOAuthBindingsModal"
                  >
                    <div class="space-y-1 overflow-hidden pr-2">
                      <div class="text-[10px] font-black text-text-disabled uppercase tracking-tighter">
                        {{ locale.detail.oauthBinding }}
                      </div>
                      <div
                        class="text-sm font-bold truncate capitalize"
                        :class="
                          selectedUserDetail.identities?.length > 0 ? 'text-success' : 'text-text-tertiary'
                        "
                        :title="selectedUserDetail.identities?.length > 0 ? formatMessage(locale.detail.bound, selectedUserDetail.identities.map(id => getOAuthProviderName(id.provider)).join(', ')) : locale.detail.unbound"
                      >
                        {{
                          selectedUserDetail.identities?.length > 0
                            ? formatMessage(locale.detail.bound, selectedUserDetail.identities.map(id => getOAuthProviderName(id.provider)).join(', '))
                            : locale.detail.unbound
                        }}
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <div
                        :class="[
                          'w-8 h-8 rounded-xl flex items-center justify-center',
                          selectedUserDetail.identities?.length > 0
                            ? 'bg-success-10 text-success'
                            : 'bg-bg-tertiary text-text-disabled'
                        ]"
                      >
                        <Link :size="16" />
                      </div>
                      <ChevronRight
                        v-if="selectedUserDetail.identities?.length > 0"
                        :size="16"
                        class="text-text-disabled transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </button>
                </div>
              </div>

              <!-- 登录与时间 -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-4">
                  <div
                    class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
                  >
                    <Clock :size="14" class="text-info" />
                    {{ locale.detail.loginInfo }}
                  </div>
                  <div class="space-y-3">
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30"
                    >
                      <span class="text-text-tertiary">{{ locale.detail.lastLogin }}</span>
                      <span class="text-text-secondary font-medium">{{
                        formatDate(selectedUserDetail.lastLogin)
                      }}</span>
                    </div>
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30"
                    >
                      <span class="text-text-tertiary">{{ locale.detail.loginIp }}</span>
                      <span class="text-text-secondary font-medium">{{
                        selectedUserDetail.lastLoginIp || locale.detail.unknown
                      }}</span>
                    </div>
                  </div>
                </div>
                <div class="space-y-4">
                  <div
                    class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest ml-1"
                  >
                    <Calendar :size="14" class="text-warning" />
                    {{ locale.detail.timeRecords }}
                  </div>
                  <div class="space-y-3">
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30"
                    >
                      <span class="text-text-tertiary">{{ locale.detail.createdAt }}</span>
                      <span class="text-text-secondary font-medium">{{
                        formatDate(selectedUserDetail.createdAt)
                      }}</span>
                    </div>
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30"
                    >
                      <span class="text-text-tertiary">{{ locale.detail.updatedAt }}</span>
                      <span class="text-text-secondary font-medium">{{
                        formatDate(selectedUserDetail.updatedAt)
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 状态变更日志 -->
              <div class="space-y-4">
                <div class="flex items-center justify-between ml-1">
                  <div
                    class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest"
                  >
                    <History :size="14" class="text-success" />
                    {{ locale.detail.statusLogs }}
                  </div>
                </div>

                <div
                  v-if="statusLogsLoading"
                  class="py-12 flex flex-col items-center justify-center text-text-disabled gap-3"
                >
                  <RefreshCw :size="24" class="animate-spin" />
                  <span class="text-[10px] font-black uppercase tracking-widest"
                    >{{ locale.detail.loadingLogs }}</span
                  >
                </div>

                <div
                  v-else-if="statusLogs.length === 0"
                  class="py-12 text-center bg-bg-primary-30 border border-border-secondary-50 rounded-3xl"
                >
                  <p class="text-xs text-text-disabled">{{ locale.detail.noLogs }}</p>
                </div>

                <div v-else class="space-y-4">
                  <div
                    class="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-bg-tertiary"
                  >
                    <div v-for="log in statusLogs" :key="log.id" class="relative">
                      <div
                        class="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-bg-secondary border-2 border-border-tertiary ring-4 ring-panel-bg-deepest"
                      />
                      <div
                        class="p-4 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-3"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span
                              :class="[
                                'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter',
                                getStatusClass(log.oldStatus)
                              ]"
                            >
                              {{ log.oldStatusDisplay || locale.detail.initial }}
                            </span>
                            <ArrowRight :size="12" class="text-text-secondary" />
                            <span
                              :class="[
                                'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter',
                                getStatusClass(log.newStatus)
                              ]"
                            >
                              {{ log.newStatusDisplay }}
                            </span>
                          </div>
                          <span class="text-[10px] text-text-disabled font-medium">{{
                            formatStatusLogDate(log.createdAt)
                          }}</span>
                        </div>

                        <div
                          v-if="log.reason"
                          class="text-xs text-text-tertiary bg-bg-secondary-50 p-2.5 rounded-xl border border-border-secondary-30 leading-relaxed"
                        >
                          <span class="text-text-disabled font-bold mr-1">{{ locale.detail.reason }}</span>
                          {{ log.reason }}
                        </div>

                        <div class="flex items-center gap-2 text-[10px]">
                          <div
                            class="w-4 h-4 rounded-full bg-bg-tertiary flex items-center justify-center text-text-tertiary"
                          >
                            <User :size="8" />
                          </div>
                          <span class="text-text-tertiary">{{ locale.detail.operator }}</span>
                          <span class="text-text-secondary font-bold">{{
                            log.operator?.name || locale.detail.system
                          }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 分页 -->
                  <Pagination
                    v-model:current-page="statusLogsPagination.page"
                    :total-pages="statusLogsPagination.totalPages"
                    @change="loadStatusLogsPage"
                  />
                </div>
              </div>
            </div>

            <div class="mt-8">
              <button
                class="w-full px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeUserDetailModal"
              >
                {{ locale.actions.close }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import {
  Check,
  UserPlus,
  FileSpreadsheet,
  Layers,
  Search,
  ChevronDown,
  RefreshCw,
  MapPin,
  Edit2,
  Music,
  Lock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  History,
  AlertCircle,
  CheckCircle2,
  User,
  Shield,
  Clock,
  ExternalLink,
  Save,
  Trash,
  Info,
  Key,
  Database,
  Eye,
  Settings,
  MoreVertical,
  LogOut,
  Mail,
  Plus,
  Filter,
  Download,
  Upload,
  UserCog,
  ShieldAlert,
  Calendar,
  Clock3,
  Hash,
  AtSign,
  Briefcase,
  Link,
  ClipboardCheck
} from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import UserSongsModal from '~/components/Admin/UserSongsModal.vue'
import OAuthBindingsModal from '~/components/Admin/OAuthBindingsModal.vue'
import BatchUpdateModal from '~/components/Admin/BatchUpdateModal.vue'
import UserApprovalModal from '~/components/Admin/UserApprovalModal.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { getOAuthProviderName, getAggregateOAuthLoginTypeName, getProviderDisplayName } from '~/utils/oauth'
import { GRADE_ORDER } from '~/utils/gradeClassWeights'
import { isArchivedStatus } from '~/utils/user-archive'

const { admin, currentLocale } = useLocale()
const locale = computed(() => admin.value?.userManager || {})
const formatMessage = (value, ...args) => {
  if (typeof value === 'function') return value(...args)
  if (typeof value === 'string') {
    return value.replace(/{(\d+)}/g, (match, index) =>
      args[index] !== undefined ? String(args[index]) : match
    )
  }
  return ''
}
const getRoleName = (role) => {
  const aliases = { USER: 'user', SONG_ADMIN: 'songAdmin', ADMIN: 'admin', SUPER_ADMIN: 'superAdmin' }
  return locale.value?.roles?.[aliases[role]] || role
}
const getStatusName = (status) => locale.value?.statuses?.[status] || status
const getErrorDetail = (error) =>
  error?.data?.message || error?.message || error?.statusMessage || locale.value?.detail?.unknown || '未知错误'

// 响应式数据
const loading = ref(false)
const users = ref([])
const showApprovalModal = ref(false)
const userToApprove = ref(null)
const searchQuery = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const gradeFilter = ref('')
const classFilter = ref('')
// 归档视图：graduate/withdrawn 状态账号不在默认列表直接展示，经组织树底部归档节点进入
const showArchived = ref(false)
const archivedCount = ref(0)
const sortBy = ref('id')
const sortOrder = ref('asc')
const currentPage = ref(1)
const pageSize = ref(50)
const totalUsers = ref(0)
const totalPages = ref(1)
const treeUsers = ref([])
const treeLoading = ref(false)
const treeError = ref('')
const expandedTreeNodes = ref(new Set())
const treeFilterLabel = ref('')
const UNSET_FILTER_VALUE = '__UNSET__'
const unsetGradeLabel = computed(() => locale.value?.organization?.unsetGrade || '未设置年级')
const unsetClassLabel = computed(() => locale.value?.organization?.unsetClass || '未设置班级')

const sortOptions = computed(() => [
  { label: locale.value?.sortOptions?.default || '默认排序', value: 'id-asc' },
  { label: locale.value?.sortOptions?.nameAsc || '姓名升序', value: 'name-asc' },
  { label: locale.value?.sortOptions?.nameDesc || '姓名降序', value: 'name-desc' },
  { label: locale.value?.sortOptions?.lastLoginDesc || '最近登录优先', value: 'lastLogin-desc' },
  { label: locale.value?.sortOptions?.lastLoginAsc || '最早登录优先', value: 'lastLogin-asc' },
  { label: locale.value?.sortOptions?.createdAtDesc || '最新创建优先', value: 'createdAt-desc' },
  { label: locale.value?.sortOptions?.createdAtAsc || '最早创建优先', value: 'createdAt-asc' }
])

const currentSort = computed({
  get: () => `${sortBy.value}-${sortOrder.value}`,
  set: (val) => {
    const [field, order] = val.split('-')
    sortBy.value = field
    sortOrder.value = order
  }
})

// 硬编码角色定义
const allRoles = computed(() => [
  { name: 'USER', displayName: getRoleName('USER') },
  { name: 'SONG_ADMIN', displayName: getRoleName('SONG_ADMIN') },
  { name: 'ADMIN', displayName: getRoleName('ADMIN') },
  { name: 'SUPER_ADMIN', displayName: getRoleName('SUPER_ADMIN') }
])

// 筛选选项
const roleFilterOptions = computed(() => [{ name: '', displayName: locale.value?.allRoles || '全部角色' }, ...allRoles.value])

// 状态筛选：普通视图不提供 graduate/withdrawn 选项（已归档账号默认隐藏）；归档视图仅这两类
const statusFilterOptions = computed(() => {
  const options = [{ label: locale.value?.allStatus || '全部状态', value: '' }]
  if (showArchived.value) {
    options.push(
      { label: getStatusName('graduate'), value: 'graduate' },
      { label: getStatusName('withdrawn'), value: 'withdrawn' }
    )
  } else {
    options.push(
      { label: getStatusName('active'), value: 'active' },
      { label: getStatusName('pending'), value: 'pending' }
    )
  }
  return options
})

const userStatusOptions = computed(() => [
  { label: getStatusName('activeAccess'), value: 'active' },
  { label: getStatusName('withdrawnAccess'), value: 'withdrawn' },
  { label: getStatusName('graduateAccess'), value: 'graduate' }
])

// 模态框状态
const showAddModal = ref(false)
const editingUser = ref(null)
const saving = ref(false)
const formError = ref('')

// 重置密码状态
const resetPasswordUser = ref(null)
const resetting = ref(false)
const passwordError = ref('')

// 批量导入状态
const showImportModal = ref(false)
const importLoading = ref(false)
const importError = ref('')
const previewData = ref([])
const xlsxLoaded = ref(false)
const importStartRow = ref(0)
const importProgress = ref(0)
const importProgressText = ref('')

// 批量更新状态
const showBatchUpdateModal = ref(false)

// 删除确认状态
const showDeleteModal = ref(false)
const deletingUser = ref(null)
const deleting = ref(false)

// 用户歌曲模态框状态
const showUserSongsModal = ref(false)
const selectedUserId = ref(null)

// 头像加载错误状态管理
const failedImages = reactive({})
const handleImageError = (userId) => {
  failedImages[userId] = true
}

// 用户详细信息模态框状态
const showUserDetailModal = ref(false)
const selectedUserDetail = ref(null)

// OAuth 绑定详情模态框状态
const showOAuthBindingsModal = ref(false)

// 状态变更日志模态框状态

const statusLogs = ref([])
const statusLogsLoading = ref(false)
const statusLogsError = ref('')
const statusLogsPagination = ref({
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
})

// 表单数据
const userForm = ref({
  name: '',
  username: '',
  password: '',
  role: 'USER',
  status: 'active',
  grade: '',
  class: ''
})

const passwordForm = ref({
  password: '',
  confirmPassword: ''
})

// 服务
const auth = useAuth()
const { localize } = useServerErrors()

// 判断是否为当前登录用户
const isSelf = (user) => {
  return auth.user.value?.id === user?.id
}

// 计算属性
const isSuperAdmin = computed(() => {
  return auth.user.value?.role === 'SUPER_ADMIN'
})

// 普通管理员身份
const isAdmin = computed(() => {
  return auth.user.value?.role === 'ADMIN'
})

// 是否允许对目标用户执行管理操作（编辑/重置密码/删除），与后端越级保护一致
const canManageUser = (user) => {
  if (!user || isSelf(user)) return false
  // 普通管理员不能操作超级管理员
  return isSuperAdmin.value || user.role !== 'SUPER_ADMIN'
}

const availableRoles = computed(() => {
  let roles
  if (isSuperAdmin.value) {
    // 超级管理员可以分配除自己以外的所有角色
    roles = allRoles.value.filter((role) => role.name !== 'SUPER_ADMIN')
  } else if (isAdmin.value) {
    // 管理员只能分配用户和歌曲管理员角色（与后端用户接口的角色限制一致）
    roles = allRoles.value.filter((role) => ['USER', 'SONG_ADMIN'].includes(role.name))
  } else {
    // 其他角色不能分配角色，返回空数组
    return []
  }
  // 保留目标用户当前角色，避免当前值不在选项中时下拉显示裸值
  const currentRole = editingUser.value?.role
  if (currentRole && !roles.some((role) => role.name === currentRole)) {
    roles = [...roles, ...allRoles.value.filter((role) => role.name === currentRole)]
  }
  return roles
})

const getUserDisplayName = (user) => {
  return user?.name || user?.username || locale.value?.organization?.unnamedUser || '未命名用户'
}

const getUserInitial = (user) => {
  return getUserDisplayName(user).charAt(0)
}

const normalizeTreeValue = (value, fallback) => {
  const normalized = value?.toString().trim()
  return normalized || fallback
}

const getStageLabel = (user) => {
  const stages = locale.value?.organization?.stages || {}
  if (user.status === 'graduate') return stages.graduate || ''
  if (user.status === 'withdrawn') return stages.withdrawn || ''

  const grade = normalizeTreeValue(user.grade, unsetGradeLabel.value)
  if (grade.startsWith('高')) return stages.senior || ''
  if (grade.startsWith('初')) return stages.junior || ''
  if (grade.startsWith('大')) return stages.university || ''
  if (['教师', '教职工'].includes(grade)) return stages.staff || ''
  return stages.other || ''
}

const gradeSortWeight = (grade) => {
  const order = {
    ...GRADE_ORDER,
    [unsetGradeLabel.value]: 100
  }

  return order[grade] ?? 50
}

const sortTreeLabels = (a, b) => {
  const weightA = gradeSortWeight(a.label)
  const weightB = gradeSortWeight(b.label)

  if (weightA !== weightB) return weightA - weightB
  return a.label.localeCompare(b.label, 'zh-CN', { numeric: true })
}

const sortByLabel = (a, b) => {
  return a.label.localeCompare(b.label, 'zh-CN', { numeric: true })
}

const toUserFilterQuery = (value, unsetLabel) => {
  if (!value) return undefined
  return value === unsetLabel ? UNSET_FILTER_VALUE : value
}

// 按年级/班级将用户归组为树节点（学段与归档目录共用）
const buildGradeNodes = (users, stageKey) => {
  const gradeMap = new Map()

  for (const user of users) {
    const gradeLabel = normalizeTreeValue(user.grade, unsetGradeLabel.value)
    const classLabel = normalizeTreeValue(user.class, unsetClassLabel.value)
    const gradeKey = `${stageKey}:grade:${gradeLabel}`
    const classKey = `${gradeKey}:class:${classLabel}`

    if (!gradeMap.has(gradeKey)) {
      gradeMap.set(gradeKey, {
        key: gradeKey,
        label: gradeLabel,
        count: 0,
        classes: new Map()
      })
    }

    const grade = gradeMap.get(gradeKey)
    grade.count += 1

    if (!grade.classes.has(classKey)) {
      grade.classes.set(classKey, {
        key: classKey,
        label: classLabel,
        count: 0,
        users: []
      })
    }

    const classNode = grade.classes.get(classKey)
    classNode.count += 1
    classNode.users.push(user)
  }

  return Array.from(gradeMap.values())
    .map((grade) => ({
      ...grade,
      classes: Array.from(grade.classes.values())
        .map((classNode) => ({
          ...classNode,
          users: classNode.users.sort((a, b) =>
            getUserDisplayName(a).localeCompare(getUserDisplayName(b), 'zh-CN', {
              numeric: true
            })
          )
        }))
        .sort(sortByLabel)
    }))
    .sort(sortTreeLabels)
}

const buildStageNodes = (users) => {
  const stageMap = new Map()

  for (const user of users) {
    const stageLabel = getStageLabel(user)
    const stageKey = `stage:${stageLabel}`

    if (!stageMap.has(stageKey)) {
      stageMap.set(stageKey, {
        key: stageKey,
        label: stageLabel,
        count: 0,
        users: []
      })
    }

    const stage = stageMap.get(stageKey)
    stage.count += 1
    stage.users.push(user)
  }

  return Array.from(stageMap.values())
    .map((stage) => ({
      key: stage.key,
      label: stage.label,
      count: stage.count,
      grades: buildGradeNodes(stage.users, stage.key)
    }))
    .sort((a, b) => {
      const stages = locale.value?.organization?.stages || {}
      const stageOrder = [stages.junior, stages.senior, stages.university, stages.staff, stages.other]
      const indexA = stageOrder.indexOf(a.label)
      const indexB = stageOrder.indexOf(b.label)
      const weightA = indexA === -1 ? 50 : indexA
      const weightB = indexB === -1 ? 50 : indexB

      if (weightA !== weightB) return weightA - weightB
      return a.label.localeCompare(b.label, 'zh-CN', { numeric: true })
    })
}

const archiveStageLabel = computed(() => locale.value?.archivedUsers || '已归档用户')

const userTree = computed(() => {
  const stages = buildStageNodes(treeUsers.value.filter((user) => !isArchivedStatus(user.status)))
  const archivedUsers = treeUsers.value.filter((user) => isArchivedStatus(user.status))
  const stageKey = `stage:${archiveStageLabel.value}`

  // 归档目录固定挂在树末尾，不在学段中直接展示；点击节点名进入归档视图
  stages.push({
    key: stageKey,
    label: archiveStageLabel.value,
    count: archivedUsers.length,
    grades: buildGradeNodes(archivedUsers, stageKey)
  })

  return stages
})

const activeOrgFilterLabel = computed(() => {
  const scopeParts = []

  if (treeFilterLabel.value) {
    scopeParts.push(treeFilterLabel.value)
  }

  if (gradeFilter.value) {
    scopeParts.push(gradeFilter.value)
  }

  if (gradeFilter.value && classFilter.value) {
    scopeParts.push(classFilter.value)
  }

  return scopeParts.join(' / ')
})

let loadUsersDebounceTimer = null
// 视图切换重置筛选后由切换逻辑统一重载列表，置位抑制监听器的重复加载
let suppressNextFilterReload = false

// 监听搜索和过滤条件变化
watch(
  [searchQuery, roleFilter, statusFilter, gradeFilter, classFilter, sortBy, sortOrder],
  () => {
    if (loadUsersDebounceTimer) {
      clearTimeout(loadUsersDebounceTimer)
    }

    if (suppressNextFilterReload) {
      suppressNextFilterReload = false
      return
    }

    loadUsersDebounceTimer = setTimeout(() => {
      if (currentPage.value !== 1) {
        currentPage.value = 1
      } else {
        loadUsers(1, pageSize.value)
      }
    }, 300)
  }
)

// 监听页码变化
watch(currentPage, (newPage) => {
  loadUsers(newPage, pageSize.value)
})

// 方法
const formatDate = (dateString) => {
  const timeLocale = locale.value?.time || {}
  if (!dateString) return timeLocale.never || ''
  const date = new Date(dateString)
  const now = getSyncedDate()
  const diff = now - date

  if (diff < 60000) return timeLocale.justNow || ''
  if (diff < 3600000) return formatMessage(timeLocale.minutesAgo, Math.floor(diff / 60000))
  if (diff < 86400000) return formatMessage(timeLocale.hoursAgo, Math.floor(diff / 3600000))
  if (diff < 86400000 * 7) return formatMessage(timeLocale.daysAgo, Math.floor(diff / 86400000))

  return date.toLocaleDateString(currentLocale.value)
}

const getRoleClass = (role) => {
  const classes = {
    USER: 'user',
    ADMIN: 'admin',
    SONG_ADMIN: 'song-admin',
    SUPER_ADMIN: 'super-admin'
  }
  return classes[role] || 'user'
}

const getRoleDisplayName = (role) => {
  return getRoleName(role)
}

const getStatusClass = (status) => {
  const classes = {
    active: 'status-active',
    withdrawn: 'status-withdrawn',
    graduate: 'status-graduate'
  }
  return classes[status] || 'status-active'
}

const getStatusDisplayName = (status) => {
  return getStatusName(status) || getStatusName('active')
}

const editUser = (user) => {
  // 禁止编辑自身
  if (isSelf(user)) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.selfEditForbidden, 'warning')
    }
    return
  }
  editingUser.value = user
  userForm.value = {
    name: user.name,
    username: user.username,
    password: '',
    role: user.role,
    status: user.status || 'active',
    grade: user.grade || '',
    class: user.class || ''
  }
}

const openApproval = (user) => {
  userToApprove.value = user
  showApprovalModal.value = true
}

const handleApprovalSuccess = (result) => {
  void loadUsers(currentPage.value, pageSize.value)
  if (window.$showNotification) {
    const message =
      result?.action === 'approve'
        ? locale.value.approval?.approveSuccess
        : locale.value.approval?.rejectSuccess
    window.$showNotification(message, 'success')
  }
}

const resetPassword = (user) => {
  // 禁止重置自身密码
  if (isSelf(user)) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.selfResetForbidden, 'warning')
    }
    return
  }
  resetPasswordUser.value = user
  passwordForm.value = {
    password: '',
    confirmPassword: ''
  }
}

const confirmDeleteUser = (user) => {
  // 禁止删除自身
  if (isSelf(user)) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.selfDeleteForbidden, 'warning')
    }
    return
  }
  deletingUser.value = user
  showDeleteModal.value = true
}

const viewUserSongs = (user) => {
  selectedUserId.value = user.id
  showUserSongsModal.value = true
}

const closeUserSongsModal = () => {
  showUserSongsModal.value = false
  selectedUserId.value = null
}

const showUserDetail = (user, event) => {
  // 检查点击的是否是操作按钮或其子元素
  if (event.target.closest('.action-btn') || event.target.closest('.action-buttons')) {
    return // 如果点击的是操作按钮，不触发详情弹窗
  }

  selectedUserDetail.value = user
  showUserDetailModal.value = true

  // 自动加载状态变更日志
  loadStatusLogsPage(1)
}

const closeUserDetailModal = () => {
  showUserDetailModal.value = false
  selectedUserDetail.value = null
  showOAuthBindingsModal.value = false
}

const openOAuthBindingsModal = () => {
  if (!selectedUserDetail.value?.identities?.length) return
  showOAuthBindingsModal.value = true
}

const closeOAuthBindingsModal = () => {
  showOAuthBindingsModal.value = false
}

const closeBatchUpdateModal = () => {
  showBatchUpdateModal.value = false
}

const handleBatchUpdateSuccess = async () => {
  await Promise.all([loadUserTree(), loadUsers()])
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  deletingUser.value = null
  deleting.value = false
}

const confirmDelete = async () => {
  if (!deletingUser.value) return

  deleting.value = true

  try {
    await $fetch(`/api/admin/users/${deletingUser.value.id}`, {
      method: 'DELETE',
      ...auth.getAuthConfig()
    })

    await Promise.all([loadUserTree(), loadUsers()])
    closeDeleteModal()

    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.deleteSuccess, 'success')
    }
  } catch (error) {
      console.error('删除用户失败:', error)
      if (window.$showNotification) {
        window.$showNotification(formatMessage(locale.value.notifications.deleteFailed, getErrorDetail(error)), 'error')
      }
    } finally {
    deleting.value = false
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingUser.value = null
  formError.value = ''
  userForm.value = {
    name: '',
    username: '',
    password: '',
    role: 'USER',
    status: 'active',
    grade: '',
    class: ''
  }
}

const closeResetPassword = () => {
  resetPasswordUser.value = null
  passwordError.value = ''
  passwordForm.value = {
    password: '',
    confirmPassword: ''
  }
}

const isTreeNodeExpanded = (key) => {
  return expandedTreeNodes.value.has(key)
}

const toggleTreeNode = (key) => {
  const next = new Set(expandedTreeNodes.value)

  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }

  expandedTreeNodes.value = next
}

const expandDefaultTreeNodes = () => {
  const next = new Set(expandedTreeNodes.value)

  userTree.value.forEach((stage) => {
    // 归档节点默认折叠，点击节点名进入归档视图，手动展开查看目录
    if (stage.label === archiveStageLabel.value) return
    next.add(stage.key)
    stage.grades.forEach((grade) => {
      next.add(grade.key)
    })
  })

  expandedTreeNodes.value = next
}

const isTreeFilterActive = (stageLabel, grade, className) => {
  return (
    treeFilterLabel.value === stageLabel &&
    gradeFilter.value === grade &&
    classFilter.value === className
  )
}

const isStageFilterActive = (stageLabel) => {
  return treeFilterLabel.value === stageLabel && !gradeFilter.value && !classFilter.value
}

const handleStageClick = (stage) => {
  // 归档节点点击进入归档视图，其余学段仅展开/折叠
  if (stage.label === archiveStageLabel.value) {
    applyUserScope(true, { stageLabel: stage.label })
    return
  }

  toggleTreeNode(stage.key)
}

const applyTreeFilter = (grade, className = '', stageLabel = '') => {
  // 归档目录下的年级/班级点击进入归档视图并定位范围
  applyUserScope(stageLabel === archiveStageLabel.value, { grade, className, stageLabel })
}

const clearTreeFilter = () => {
  if (showArchived.value) {
    applyUserScope(false, { stageLabel: '' })
    return
  }
  gradeFilter.value = ''
  classFilter.value = ''
  if (treeFilterLabel.value) {
    statusFilter.value = ''
  }
  treeFilterLabel.value = ''
}

// 统一设置用户视图与树范围：重置筛选与分页，并保证列表恰好重载一次
const applyUserScope = (archived, { grade = '', className = '', stageLabel = '' } = {}) => {
  const viewChanged = showArchived.value !== archived
  const filtersChanged =
    searchQuery.value !== '' ||
    gradeFilter.value !== grade ||
    classFilter.value !== className ||
    (viewChanged && (roleFilter.value !== '' || statusFilter.value !== ''))
  const scopeChanged = treeFilterLabel.value !== stageLabel

  if (!viewChanged && !filtersChanged && !scopeChanged && currentPage.value === 1) {
    return
  }

  // 有筛选值将被重置时筛选监听器必触发一次，置位抑制避免重复请求
  if (filtersChanged) {
    if (loadUsersDebounceTimer) {
      clearTimeout(loadUsersDebounceTimer)
      loadUsersDebounceTimer = null
    }
    suppressNextFilterReload = true
  }

  // 页码保持 1 时页码监听器不触发，需显式重载；否则交给页码监听器
  const reloadNow = currentPage.value === 1
  showArchived.value = archived
  searchQuery.value = ''
  if (viewChanged) {
    // 两个视图的状态筛选选项不同，切换视图时一并重置
    roleFilter.value = ''
    statusFilter.value = ''
  }
  gradeFilter.value = grade
  classFilter.value = className
  treeFilterLabel.value = stageLabel
  currentPage.value = 1
  if (reloadNow) {
    void loadUsers(1, pageSize.value)
  }
}

const openTreeUser = async (treeUser) => {
  try {
    const detail = await $fetch(`/api/admin/users/${treeUser.id}`, {
      ...auth.getAuthConfig()
    })

    selectedUserDetail.value = detail
    showUserDetailModal.value = true
    loadStatusLogsPage(1)
  } catch (error) {
    console.error('加载用户详情失败:', error)
    if (window.$showNotification) {
      window.$showNotification(formatMessage(locale.value.notifications.detailLoadFailed, getErrorDetail(error)), 'error')
    }
  }
}

const saveUser = async () => {
  // 保护：禁止保存针对自身的更改
  if (editingUser.value && isSelf(editingUser.value)) {
    formError.value = locale.value.notifications.selfEditForbidden
    return
  }
  if (!userForm.value.name || !userForm.value.username) {
    formError.value = locale.value.errors.requiredInfo
    return
  }

  if (!editingUser.value && !userForm.value.password) {
    formError.value = locale.value.errors.passwordRequired
    return
  }

  saving.value = true
  formError.value = ''

  try {
    const userData = {
      name: userForm.value.name,
      username: userForm.value.username,
      role: userForm.value.role,
      status: userForm.value.status,
      grade: userForm.value.grade,
      class: userForm.value.class
    }

    if (userForm.value.password) {
      userData.password = userForm.value.password
    }

    if (editingUser.value) {
      await $fetch(`/api/admin/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: userData,
        ...auth.getAuthConfig()
      })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: userData,
        ...auth.getAuthConfig()
      })
    }

    // 先缓存是否编辑态：closeModal 会清空 editingUser，通知文案需在清空前判定
    const wasEditing = Boolean(editingUser.value)

    await Promise.all([loadUserTree(), loadUsers()])
    closeModal()

    if (window.$showNotification) {
      window.$showNotification(
        wasEditing ? locale.value.notifications.updateSuccess : locale.value.notifications.createSuccess,
        'success'
      )
    }
  } catch (error) {
      console.error('保存用户失败:', error)
      formError.value = localize(error, locale.value.errors.saveFailed)
    } finally {
    saving.value = false
  }
}

const confirmResetPassword = async () => {
  // 保护：禁止重置自身密码
  if (resetPasswordUser.value && isSelf(resetPasswordUser.value)) {
    passwordError.value = locale.value.notifications.selfResetForbidden
    return
  }
  if (!passwordForm.value.password) {
    passwordError.value = locale.value.errors.newPasswordRequired
    return
  }

  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    passwordError.value = locale.value.errors.passwordMismatch
    return
  }

  resetting.value = true
  passwordError.value = ''

  try {
    await $fetch(`/api/admin/users/${resetPasswordUser.value.id}/reset-password`, {
      method: 'POST',
      body: {
        newPassword: passwordForm.value.password
      },
      ...auth.getAuthConfig()
    })

    closeResetPassword()

    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.resetSuccess, 'success')
    }
  } catch (error) {
      console.error('重置密码失败:', error)
      passwordError.value = getErrorDetail(error) || locale.value.errors.resetFailed
    } finally {
    resetting.value = false
  }
}

const loadUsers = async (page = 1, limit = 100) => {
  loading.value = true
  try {
    const response = await $fetch('/api/admin/users', {
      query: {
        page: page.toString(),
        limit: limit.toString(),
        search: searchQuery.value || undefined,
        role: roleFilter.value || undefined,
        status: statusFilter.value || undefined,
        grade: toUserFilterQuery(gradeFilter.value, unsetGradeLabel.value),
        class: toUserFilterQuery(classFilter.value, unsetClassLabel.value),
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        archived: showArchived.value ? '1' : '0'
      },
      ...auth.getAuthConfig()
    })

    // 处理分页响应数据
    if (response.users) {
      users.value = response.users
      console.log('加载用户成功:', users.value.length)
      // 更新分页信息
      if (response.pagination) {
        totalUsers.value = response.pagination.total
        currentPage.value = response.pagination.page
        totalPages.value = response.pagination.totalPages
      }
    } else {
      users.value = []
      console.warn('响应中没有用户数据')
    }
  } catch (error) {
      console.error('加载用户失败:', error)
      if (window.$showNotification) {
        window.$showNotification(formatMessage(locale.value.notifications.loadFailed, getErrorDetail(error)), 'error')
      }
    } finally {
    loading.value = false
  }
}

const loadUserTree = async () => {
  treeLoading.value = true
  treeError.value = ''

  try {
    const response = await $fetch('/api/admin/users/options', {
      ...auth.getAuthConfig()
    })

    treeUsers.value = response.treeUsers || []
    archivedCount.value = response.archivedCount || 0
    expandDefaultTreeNodes()
  } catch (error) {
    console.error('加载组织结构失败:', error)
    treeError.value = getErrorDetail(error) || locale.value.organization.loadFailed
  } finally {
    treeLoading.value = false
  }
}

// 批量导入相关方法
const closeImportModal = () => {
  showImportModal.value = false
  importError.value = ''
  importProgress.value = 0
  importProgressText.value = ''
  previewData.value = []
  // 清空文件输入
  const fileInput = document.getElementById('file-upload')
  if (fileInput) {
    fileInput.value = ''
  }
}

// 加载XLSX库
const loadXLSX = async () => {
  if (typeof window !== 'undefined' && !xlsxLoaded.value) {
    try {
      // 使用多个可靠的CDN源，如果一个失败可以尝试另一个
      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      ]

      // 尝试加载第一个CDN
      let loaded = false
      for (const url of cdnUrls) {
        if (loaded) break

        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = url
            script.async = true

            script.onload = () => {
              xlsxLoaded.value = true
              loaded = true
              console.log('XLSX库加载成功:', url)
              resolve()
            }

            script.onerror = () => {
              console.warn(`无法从 ${url} 加载XLSX库，尝试下一个源`)
              reject()
            }

            document.head.appendChild(script)
          })
        } catch (e) {
          // 这个CDN失败，继续尝试下一个
        }
      }

      if (!loaded) {
        throw new Error(locale.value.errors.xlsxLoadFailed)
      }
    } catch (err) {
      console.error('加载XLSX库失败:', err)
    }
  }
}

// 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  importError.value = ''
  importProgressText.value = ''
  importProgress.value = 0
  previewData.value = []

  // 确保XLSX库已加载
  if (!window.XLSX) {
    await loadXLSX()

    if (!window.XLSX) {
      importError.value = locale.value.errors.xlsxLoadFailed
      return
    }
  }

  try {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        // 使用全局XLSX对象
        const workbook = window.XLSX.read(data, { type: 'array' })

        // 假设数据在第一个工作表中
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

        // 智能检测标题行
        let startRow = 0
        if (jsonData.length > 0 && jsonData[0]) {
          const firstRow = jsonData[0]
          // 检查第一行是否包含常见的标题关键词
          const titleKeywords = [
            '姓名',
            '用户名',
            '密码',
            '角色',
            '年级',
            '班级',
            'name',
            'username',
            'password',
            'role',
            'grade',
            'class',
            ...Object.values(locale.value.importModal.sampleHeaders || {})
          ]
          const isHeaderRow = firstRow.some(
            (cell) =>
              cell &&
              titleKeywords.some((keyword) =>
                cell.toString().toLowerCase().includes(keyword.toLowerCase())
              )
          )

          if (isHeaderRow) {
            startRow = 1
            console.log('检测到标题行，从第二行开始解析')
          } else {
            console.log('未检测到标题行，从第一行开始解析')
          }
        }
        
        importStartRow.value = startRow

        const userData = []

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || !row.length || !row[0]) continue // 跳过空行

          let role = (row[3]?.toString() || '').toUpperCase()

          // 根据当前用户权限过滤角色
          if (!isSuperAdmin.value) {
            // 普通管理员只能导入 USER 和 SONG_ADMIN 角色
            if (role !== 'USER' && role !== 'SONG_ADMIN') {
              role = 'USER' // 默认设为普通用户
            }
          }

          // 确保角色有效
          const validRoles = ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']
          if (!validRoles.includes(role)) {
            role = 'USER'
          }

          userData.push({
            name: row[0]?.toString() || '',
            username: row[1]?.toString() || '',
            password: row[2]?.toString() || '',
            role: role,
            grade: row[4]?.toString() || '',
            class: row[5]?.toString() || ''
          })
        }

        if (userData.length === 0) {
          importError.value = locale.value.errors.noValidData
          return
        }

        previewData.value = userData
      } catch (err) {
        console.error('解析Excel出错:', err)
        importError.value = formatMessage(locale.value.errors.parseExcelFailed, getErrorDetail(err))
      }
    }

    reader.onerror = () => {
      importError.value = locale.value.errors.readFileFailed
    }

    reader.readAsArrayBuffer(file)
  } catch (err) {
    console.error('处理Excel文件错误:', err)
    importError.value = formatMessage(locale.value.errors.processExcelFailed, getErrorDetail(err))
  }
}

// 下载导入模板
const downloadImportTemplate = async () => {
  if (!window.XLSX) {
    await loadXLSX()
    if (!window.XLSX) {
      if (window.$showNotification) {
        window.$showNotification(locale.value.notifications.excelLoadFailed, 'error')
      }
      return
    }
  }

  const headers = locale.value.importModal.sampleHeaders
  const templateData = [
    {
      [headers.name]: locale.value.importModal.sampleName,
      [headers.username]: 'zhangsan',
      [headers.password]: '123456',
      [headers.role]: 'USER',
      [headers.grade]: locale.value.importModal.sampleGrade,
      [headers.class]: locale.value.importModal.sampleClass
    }
  ]

  const ws = window.XLSX.utils.json_to_sheet(templateData)
  const wb = window.XLSX.utils.book_new()
  window.XLSX.utils.book_append_sheet(wb, ws, locale.value.importModal.templateSheetName)
  window.XLSX.writeFile(wb, locale.value.importModal.templateFileName)
}

// 格式化导入错误的辅助函数
const formatImportErrors = (errors) => {
  return errors.map(e => {
    const namePart = e.name || e.username ? ` (${e.name || e.username})` : ''
    return formatMessage(locale.value.importProgress.rowError, e.rowNum || '?', namePart, e.reason)
  }).join('\n')
}

// 批量导入用户
const importUsers = async () => {
  if (previewData.value.length === 0) return

  importLoading.value = true
  importError.value = ''
  importProgress.value = 0
  importProgressText.value = ''

  const dataToImport = [...previewData.value]
  const batchSize = 50
  const totalBatches = Math.ceil(dataToImport.length / batchSize)
  let totalCreated = 0
  let totalFailed = 0
  const allErrors = []

  try {
    for (let i = 0; i < dataToImport.length; i += batchSize) {
      const batch = dataToImport.slice(i, i + batchSize)
      const currentBatch = Math.floor(i / batchSize) + 1

      importProgressText.value = formatMessage(locale.value.importProgress.processingBatch, currentBatch, totalBatches)
      importProgress.value = Math.round((currentBatch / totalBatches) * 100)

      try {
        const result = await $fetch('/api/admin/users/batch', {
          method: 'POST',
          body: {
            users: batch
          },
          ...auth.getAuthConfig()
        })

        totalCreated += result.created || 0
        totalFailed += result.failed || 0
        
        if (result.errors && result.errors.length > 0) {
          const batchErrors = result.errors.map(e => ({
            ...e,
            rowNum: i + e.index + importStartRow.value + 1 // 正确计算行号
          }))
          allErrors.push(...batchErrors)
        }
      } catch (batchErr) {
        console.error(`第 ${currentBatch} 批导入失败:`, batchErr)
        totalFailed += batch.length
        allErrors.push({ reason: formatMessage(locale.value.importProgress.batchFailed, currentBatch, getErrorDetail(batchErr)) })
      }
    }

    await Promise.all([loadUserTree(), loadUsers()])

    if (totalCreated > 0 || totalFailed === 0) {
      importProgressText.value = formatMessage(locale.value.importProgress.complete, totalCreated, totalFailed)
      importProgress.value = 100
      
      if (allErrors.length > 0) {
        importError.value = formatMessage(locale.value.errors.partialImportFailed, formatImportErrors(allErrors))
      }
      previewData.value = []

      setTimeout(() => {
        if (importProgressText.value && allErrors.length === 0) {
          closeImportModal()
        }
      }, 3000)
    } else {
      importError.value = formatMessage(locale.value.errors.importFailedWithReasons, formatImportErrors(allErrors))
      importProgressText.value = ''
    }
  } catch (err) {
    importError.value = formatMessage(locale.value.errors.importRuntimeFailed, totalCreated, getErrorDetail(err))
    importProgressText.value = ''
    console.error('导入用户出错:', err)
  } finally {
    importLoading.value = false
  }
}

// 状态日志相关方法

const loadStatusLogsPage = async (page) => {
  if (!selectedUserDetail.value) return

  statusLogsLoading.value = true
  statusLogsError.value = ''

  try {
    const response = await $fetch(`/api/admin/users/${selectedUserDetail.value.id}/status-logs`, {
      query: {
        page: page.toString(),
        limit: '10'
      },
      ...auth.getAuthConfig()
    })

    statusLogs.value = response.logs || []
    statusLogsPagination.value = response.pagination || {
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    }
  } catch (error) {
      console.error('加载状态日志失败:', error)
      statusLogsError.value = getErrorDetail(error) || locale.value.errors.statusLogsFailed
    } finally {
    statusLogsLoading.value = false
  }
}

const formatStatusLogDate = (dateString) => {
  if (!dateString) return locale.value.time.unknown
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 生命周期
onMounted(async () => {
  console.log('UserManager 组件挂载')
  await Promise.all([loadUserTree(), loadUsers(1, pageSize.value)])
  // 预加载XLSX库
  loadXLSX()
})

onBeforeUnmount(() => {
  if (loadUsersDebounceTimer) {
    clearTimeout(loadUsersDebounceTimer)
  }
})
</script>

<style scoped>
/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

/* 行内操作按钮：保证 flex 布局稳定，不被表格列宽挤压换行 */
.action-buttons {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.action-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* 确保模态框中的表格在移动端可以滚动 */
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}

.tree-group + .tree-group {
  margin-top: 0.25rem;
}

.tree-branch {
  margin-left: 1rem;
  padding-left: 0.75rem;
  border-left: 1px solid var(--user-manager-tree-line);
}

.tree-toggle {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-muted);
  border-radius: 0.375rem;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.tree-toggle:hover {
  color: var(--color-accent-light);
  background: var(--panel-bg-deep);
}

.tree-label {
  min-width: 0;
  width: 100%;
  height: 1.75rem;
  padding: 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  color: var(--text-muted-light);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: left;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.tree-label:hover {
  color: var(--text-primary-lighter);
  background: var(--panel-bg-deep);
}

.tree-label-active {
  color: var(--color-accent-light);
  background: var(--user-manager-tree-active-bg);
}

.tree-count {
  flex-shrink: 0;
  color: var(--panel-bg-hover);
  font-size: 0.6875rem;
  font-weight: 900;
}

.tree-users {
  margin-left: 1.75rem;
  padding: 0.25rem 0 0.35rem;
  display: grid;
  gap: 0.125rem;
}

.tree-user {
  min-width: 0;
  width: 100%;
  height: 1.75rem;
  padding: 0 0.5rem;
  display: grid;
  grid-template-columns: auto minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  text-align: left;
  transition: background-color 0.2s ease;
}

.tree-user:hover {
  background: var(--panel-bg-deep);
}
</style>
