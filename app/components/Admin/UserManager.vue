<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-4">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">用户管理</h2>
        <p class="text-xs text-zinc-500 mt-1">系统共有 {{ totalUsers }} 位成员 · 权限与账户管理</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all uppercase tracking-widest active:scale-95 shadow-lg shadow-blue-900/20"
          @click="showAddModal = true"
        >
          <UserPlus :size="14" />
          添加
        </button>
        <button
          class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-black rounded-lg transition-all uppercase tracking-widest"
          @click="showImportModal = true"
        >
          <FileSpreadsheet class="text-emerald-500" :size="14" />
          导入
        </button>
        <button
          class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-black rounded-lg transition-all uppercase tracking-widest"
          @click="showBatchUpdateModal = true"
        >
          <Layers class="text-purple-500" :size="14" />
          更新
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div
      class="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3 flex flex-col lg:flex-row gap-3 items-center"
    >
      <div class="relative flex-1 w-full group">
        <Search
          class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
          :size="16"
        />
        <input
          v-model="searchQuery"
          class="w-full bg-zinc-950 border border-zinc-800/80 rounded-lg pl-11 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
          placeholder="通过姓名或学号搜索..."
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
          label="角色"
          placeholder="全部角色"
          label-key="displayName"
          value-key="name"
          class-name="flex-1 lg:w-40 min-w-[120px]"
        />

        <!-- 状态筛选 -->
        <CustomSelect
          v-model="statusFilter"
          :options="statusFilterOptions"
          label="状态"
          placeholder="全部状态"
          label-key="label"
          value-key="value"
          class-name="flex-1 lg:w-32 min-w-[100px]"
        />

        <button
          class="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-600 hover:text-blue-400 transition-all shadow-sm"
          @click="loadUsers(1)"
        >
          <RefreshCw :size="14" />
        </button>
      </div>
    </div>

    <!-- 用户表格 -->
    <div class="space-y-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-zinc-500">
        <div
          class="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"
        />
        <div class="text-xs font-black uppercase tracking-widest">正在加载用户...</div>
      </div>

      <div
        v-else-if="users.length === 0"
        class="flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-zinc-800/50 rounded-xl"
      >
        <div
          class="w-16 h-16 rounded-lg bg-zinc-800/50 flex items-center justify-center text-zinc-600 mb-4"
        >
          <Search :size="32" />
        </div>
        <div class="text-sm font-black text-zinc-500 uppercase tracking-widest">
          {{ searchQuery ? '没有找到匹配的用户' : '暂无用户数据' }}
        </div>
      </div>

      <template v-else>
        <!-- 桌面端表格 -->
        <div
          class="hidden lg:block bg-zinc-900/20 border border-zinc-800/50 rounded-xl overflow-hidden shadow-lg custom-scrollbar"
        >
          <table class="w-full">
            <thead>
              <tr
                class="bg-zinc-900/60 border-b border-zinc-800 text-[10px] font-black text-zinc-600 uppercase tracking-widest"
              >
                <th class="px-6 py-5 text-left">用户详情</th>
                <th class="px-6 py-5 text-left">角色权限</th>
                <th class="px-6 py-5 text-left">账户状态</th>
                <th class="px-6 py-5 text-center">所在班级</th>
                <th class="px-6 py-5 text-left">最后交互</th>
                <th class="px-6 py-5 text-right pr-10">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/40">
              <tr
                v-for="user in users"
                :key="user.id"
                class="group hover:bg-zinc-800/30 transition-all text-xs cursor-pointer"
                @click="showUserDetail(user, $event)"
              >
                <td class="px-6 py-5">
                  <div class="flex items-center gap-4">
                    <img
                      v-if="user.avatar && !failedImages[user.id]"
                      :src="user.avatar"
                      class="w-10 h-10 rounded-xl object-cover border border-zinc-700/50"
                      @error="handleImageError(user.id)"
                    >
                    <div
                      v-else
                      class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center font-black text-zinc-500 group-hover:text-zinc-300 transition-colors border border-zinc-700/50"
                    >
                      {{ user.name.charAt(0) }}
                    </div>
                    <div>
                      <p class="font-black text-zinc-100">{{ user.name }}</p>
                      <p class="text-[10px] text-zinc-600 font-mono mt-0.5">
                        ID: {{ user.username }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-5">
                  <span
                    v-if="user.role === 'super_admin'"
                    class="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-black rounded border border-orange-500/20 uppercase tracking-widest"
                    >超级管理员</span
                  >
                  <span
                    v-else-if="user.role === 'admin'"
                    class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-black rounded border border-blue-500/20 uppercase tracking-widest"
                    >管理员</span
                  >
                  <span
                    v-else-if="user.role === 'song_admin'"
                    class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-black rounded border border-purple-500/20 uppercase tracking-widest"
                    >歌曲管理</span
                  >
                  <span
                    v-else
                    class="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] font-black rounded border border-zinc-700/50 uppercase tracking-widest"
                    >用户</span
                  >
                </td>
                <td class="px-6 py-5">
                  <div
                    v-if="user.status === 'active'"
                    class="flex items-center gap-1.5 text-emerald-500 font-black uppercase text-[10px] tracking-widest"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    />
                    正常
                  </div>
                  <div
                    v-else
                    class="flex items-center gap-1.5 text-red-500 font-black uppercase text-[10px] tracking-widest"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-red-500" />
                    禁用
                  </div>
                </td>
                <td class="px-6 py-5 text-center font-bold text-zinc-500">
                  {{ user.grade || '-' }} {{ user.class || '-' }}
                </td>
                <td class="px-6 py-5">
                  <p class="text-zinc-400 font-bold">{{ formatDate(user.lastLogin) }}</p>
                  <p class="text-[11px] text-zinc-700 font-mono mt-1 flex items-center gap-1">
                    <MapPin :size="10" /> {{ user.lastLoginIp || '-' }}
                  </p>
                </td>
                <td class="px-6 py-5 text-right pr-10">
                  <div
                    class="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all action-buttons"
                  >
                    <button
                      :disabled="isSelf(user)"
                      class="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-blue-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed action-btn"
                      title="编辑用户"
                      @click="editUser(user)"
                    >
                      <Edit2 :size="13" />
                    </button>
                    <button
                      class="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-purple-400 transition-colors action-btn"
                      title="查看歌曲"
                      @click="viewUserSongs(user)"
                    >
                      <Music :size="13" />
                    </button>
                    <button
                      :disabled="isSelf(user)"
                      class="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed action-btn"
                      title="重置密码"
                      @click="resetPassword(user)"
                    >
                      <Lock :size="13" />
                    </button>
                    <button
                      :disabled="isSelf(user)"
                      class="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed action-btn"
                      title="删除用户"
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
            class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-5 shadow-lg shadow-black/20"
            @click="showUserDetail(user, $event)"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <img
                  v-if="user.avatar && !failedImages[user.id]"
                  :src="user.avatar"
                  class="w-12 h-12 rounded-lg object-cover border border-zinc-700"
                  @error="handleImageError(user.id)"
                >
                <div
                  v-else
                  class="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-black text-lg text-zinc-500 border border-zinc-700"
                >
                  {{ user.name.charAt(0) }}
                </div>
                <div>
                  <h4 class="text-base font-black text-zinc-100">{{ user.name }}</h4>
                  <p class="text-xs text-zinc-500 font-mono">@{{ user.username }}</p>
                </div>
              </div>
              <div class="text-right">
                <div
                  v-if="user.status === 'active'"
                  class="flex items-center gap-1.5 text-emerald-500 font-black uppercase text-[10px] tracking-widest"
                >
                  <div
                    class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  />
                  正常
                </div>
                <div
                  v-else
                  class="flex items-center gap-1.5 text-red-500 font-black uppercase text-[10px] tracking-widest"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-red-500" />
                  禁用
                </div>
                <p class="text-[10px] font-black text-zinc-700 uppercase mt-1">账户状态</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 py-4 border-y border-zinc-800/50">
              <div class="space-y-1">
                <p class="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                  角色/等级
                </p>
                <div>
                  <span
                    v-if="user.role === 'super_admin'"
                    class="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-black rounded border border-orange-500/20 uppercase tracking-widest"
                    >超级管理员</span
                  >
                  <span
                    v-else-if="user.role === 'admin'"
                    class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-black rounded border border-blue-500/20 uppercase tracking-widest"
                    >管理员</span
                  >
                  <span
                    v-else-if="user.role === 'song_admin'"
                    class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-black rounded border border-purple-500/20 uppercase tracking-widest"
                    >歌曲管理</span
                  >
                  <span
                    v-else
                    class="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] font-black rounded border border-zinc-700/50 uppercase tracking-widest"
                    >用户</span
                  >
                </div>
              </div>
              <div class="space-y-1 text-right">
                <p class="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                  所在班级
                </p>
                <p class="text-xs font-bold text-zinc-300">
                  {{ user.grade || '-' }} {{ user.class || '-' }}
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                  最近活动
                </p>
                <p class="text-xs font-bold text-zinc-400">{{ formatDate(user.lastLogin) }}</p>
              </div>
              <div class="space-y-1 text-right">
                <p class="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                  最后登录IP
                </p>
                <p class="text-[11px] font-mono text-zinc-600">{{ user.lastLoginIp || '-' }}</p>
              </div>
            </div>

            <div class="flex gap-2 action-buttons">
              <button
                :disabled="isSelf(user)"
                class="flex-1 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-blue-600 active:text-white transition-colors disabled:opacity-20 action-btn"
                @click="editUser(user)"
              >
                <Edit2 :size="12" /> 编辑
              </button>
              <button
                class="flex-1 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-purple-600 active:text-white transition-colors action-btn"
                @click="viewUserSongs(user)"
              >
                <Music :size="12" /> 记录
              </button>
              <button
                :disabled="isSelf(user)"
                class="flex-1 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-amber-600 active:text-white transition-colors disabled:opacity-20 action-btn"
                @click="resetPassword(user)"
              >
                <Lock :size="12" /> 重置
              </button>
              <button
                :disabled="isSelf(user)"
                class="px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 active:bg-red-600 active:text-white transition-colors disabled:opacity-20 action-btn"
                @click="confirmDeleteUser(user)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-between px-2 pt-4">
      <span class="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em]">
        第 {{ currentPage }} 页 · 共 {{ totalPages }} 页 (共 {{ totalUsers }} 个用户)
      </span>
      <div class="flex gap-2">
        <button
          :disabled="currentPage === 1"
          class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-700 disabled:opacity-20"
          @click="goToPage(currentPage - 1)"
        >
          <ChevronLeft :size="18" />
        </button>
        <button
          class="w-10 h-10 rounded-lg bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-900/20"
        >
          {{ currentPage }}
        </button>
        <button
          :disabled="currentPage === totalPages"
          class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-700 disabled:opacity-20"
          @click="goToPage(currentPage + 1)"
        >
          <ChevronRight :size="18" />
        </button>
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click="closeModal"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
                  >
                    <UserPlus v-if="!editingUser" :size="20" />
                    <Edit2 v-else :size="20" />
                  </div>
                  {{ editingUser ? '编辑用户信息' : '创建新用户' }}
                </h3>
                <p class="text-xs text-zinc-500 mt-1 ml-13">请填写以下账户详细信息以继续</p>
              </div>
              <button
                class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
                @click="closeModal"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-5">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >姓名</label
                  >
                  <div class="relative group">
                    <User
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.name"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
                      placeholder="请输入真实姓名"
                      type="text"
                    >
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >用户名/学号</label
                  >
                  <div class="relative group">
                    <AtSign
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.username"
                      :disabled="!!editingUser"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200 disabled:opacity-50"
                      placeholder="登录唯一标识"
                      type="text"
                    >
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  {{ editingUser ? '新密码 (留空则不修改)' : '初始密码' }}
                </label>
                <div class="relative group">
                  <Lock
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
                    :size="16"
                  />
                  <input
                    v-model="userForm.password"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
                    placeholder="设置安全访问密码"
                    type="password"
                  >
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >角色权限</label
                  >
                  <CustomSelect
                    v-model="userForm.role"
                    :options="availableRoles"
                    label-key="displayName"
                    value-key="name"
                    placeholder="请选择角色"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >账户状态</label
                  >
                  <CustomSelect
                    v-model="userForm.status"
                    :options="userStatusOptions"
                    label-key="label"
                    value-key="value"
                    placeholder="请选择状态"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >年级</label
                  >
                  <div class="relative group">
                    <Calendar
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.grade"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
                      placeholder="例如: 2024"
                      type="text"
                    >
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                    >班级</label
                  >
                  <div class="relative group">
                    <Briefcase
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="userForm.class"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
                      placeholder="例如: 1班"
                      type="text"
                    >
                  </div>
                </div>
              </div>

              <div
                v-if="formError"
                class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs"
              >
                <AlertCircle :size="16" />
                {{ formError }}
              </div>
            </div>

            <div class="flex gap-3 mt-10">
              <button
                class="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeModal"
              >
                取消操作
              </button>
              <button
                :disabled="saving"
                class="flex-[2] px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/20 active:scale-95"
                @click="saveUser"
              >
                <Save v-if="!saving" :size="16" />
                <RefreshCw v-else class="animate-spin" :size="16" />
                {{ saving ? '正在保存...' : editingUser ? '更新用户信息' : '确认创建用户' }}
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click="closeResetPassword"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8 text-center">
            <div
              class="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center text-amber-500 mx-auto mb-6"
            >
              <Lock :size="32" />
            </div>
            <h3 class="text-xl font-black text-zinc-100 tracking-tight">重置访问密码</h3>
            <p class="text-xs text-zinc-500 mt-2 mb-8">
              正在为
              <span class="text-zinc-200 font-bold">{{ resetPasswordUser.name }}</span> 修改登录凭据
            </p>

            <div class="space-y-4 text-left">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                  >新密码</label
                >
                <div class="relative group">
                  <Key
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-amber-500 transition-colors"
                    :size="16"
                  />
                  <input
                    v-model="passwordForm.password"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-amber-500/30 transition-all text-zinc-200"
                    placeholder="设置高强度新密码"
                    type="password"
                  >
                </div>
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1"
                  >确认新密码</label
                >
                <div class="relative group">
                  <Key
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-amber-500 transition-colors"
                    :size="16"
                  />
                  <input
                    v-model="passwordForm.confirmPassword"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-amber-500/30 transition-all text-zinc-200"
                    placeholder="请再次输入以确认"
                    type="password"
                  >
                </div>
              </div>

              <div
                v-if="passwordError"
                class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs"
              >
                <AlertCircle :size="16" />
                {{ passwordError }}
              </div>
            </div>

            <div class="flex gap-3 mt-8">
              <button
                class="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeResetPassword"
              >
                取消
              </button>
              <button
                :disabled="resetting"
                class="flex-[2] px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-900/20 active:scale-95"
                @click="confirmResetPassword"
              >
                <Save v-if="!resetting" :size="16" />
                <RefreshCw v-else class="animate-spin" :size="16" />
                {{ resetting ? '正在重置...' : '确认重置密码' }}
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click="closeImportModal"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500"
                  >
                    <FileSpreadsheet :size="20" />
                  </div>
                  批量导入用户
                </h3>
                <p class="text-xs text-zinc-500 mt-1 ml-13">
                  支持 .xlsx 格式文件，请按模板要求上传
                </p>
              </div>
              <button
                class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
                @click="closeImportModal"
              >
                <X :size="20" />
              </button>
            </div>

            <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div class="p-5 bg-zinc-950/50 border border-zinc-800/50 rounded-3xl space-y-4">
                <div class="flex items-center gap-2 text-zinc-300 font-bold text-sm mb-2">
                  <Info :size="16" class="text-blue-400" />
                  导入说明
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed">
                  请上传Excel格式文件 (.xlsx)，系统会自动解析数据。
                  注意：第一行可以是标题行（会自动跳过），角色字段必须匹配系统定义的角色。
                </p>

                <div class="overflow-hidden rounded-2xl border border-zinc-800/80">
                  <table class="w-full text-[10px] text-left">
                    <thead class="bg-zinc-900 text-zinc-400 uppercase tracking-tighter">
                      <tr>
                        <th class="px-3 py-2 border-b border-zinc-800">姓名</th>
                        <th class="px-3 py-2 border-b border-zinc-800">账号名</th>
                        <th class="px-3 py-2 border-b border-zinc-800">密码</th>
                        <th class="px-3 py-2 border-b border-zinc-800">角色</th>
                        <th class="px-3 py-2 border-b border-zinc-800">年级</th>
                        <th class="px-3 py-2 border-b border-zinc-800">班级</th>
                      </tr>
                    </thead>
                    <tbody class="text-zinc-500">
                      <tr class="border-b border-zinc-900/50">
                        <td class="px-3 py-2">张三</td>
                        <td class="px-3 py-2">zhangsan</td>
                        <td class="px-3 py-2">******</td>
                        <td class="px-3 py-2">USER</td>
                        <td class="px-3 py-2">高一</td>
                        <td class="px-3 py-2">1班</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-[10px] text-blue-400/80 leading-relaxed"
                >
                  <strong>支持的角色：</strong>
                  <span v-if="isSuperAdmin"
                    >USER（普通用户）、ADMIN（管理员）、SONG_ADMIN（歌曲管理员）、SUPER_ADMIN（超级管理员）</span
                  >
                  <span v-else>USER（普通用户）、SONG_ADMIN（歌曲管理员）</span>
                </div>
              </div>

              <div class="space-y-3">
                <label class="block text-xs font-black text-zinc-400 uppercase tracking-widest ml-1"
                  >选择数据文件</label
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
                    class="w-full py-10 border-2 border-dashed border-zinc-800 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/5 rounded-3xl transition-all flex flex-col items-center justify-center gap-3"
                  >
                    <div
                      class="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-emerald-500 transition-colors"
                    >
                      <Upload :size="24" />
                    </div>
                    <div class="text-center">
                      <p class="text-sm font-bold text-zinc-300">点击或拖拽上传 Excel 文件</p>
                      <p class="text-xs text-zinc-500 mt-1">仅支持 .xlsx 格式</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="importError"
                class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs"
              >
                <AlertCircle :size="16" />
                {{ importError }}
              </div>

              <div
                v-if="importSuccess"
                class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs"
              >
                <CheckCircle2 :size="16" />
                {{ importSuccess }}
              </div>

              <div v-if="previewData.length > 0" class="space-y-3">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-xs font-black text-zinc-400 uppercase tracking-widest"
                    >预览数据 ({{ previewData.length }}条记录)</label
                  >
                </div>
                <div class="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/30">
                  <table class="w-full text-xs text-left">
                    <thead class="bg-zinc-900/50 text-zinc-500">
                      <tr>
                        <th class="px-4 py-3 font-medium">姓名</th>
                        <th class="px-4 py-3 font-medium">账号</th>
                        <th class="px-4 py-3 font-medium">角色</th>
                        <th class="px-4 py-3 font-medium">年级/班级</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-900">
                      <tr
                        v-for="(row, index) in previewData.slice(0, 5)"
                        :key="index"
                        class="text-zinc-300"
                      >
                        <td class="px-4 py-3">{{ row.name }}</td>
                        <td class="px-4 py-3">{{ row.username }}</td>
                        <td class="px-4 py-3">
                          <span
                            class="px-2 py-0.5 bg-zinc-800 rounded-md text-[10px] text-zinc-400 uppercase"
                            >{{ row.role }}</span
                          >
                        </td>
                        <td class="px-4 py-3 text-zinc-500">
                          {{ row.grade || '-' }} / {{ row.class || '-' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    v-if="previewData.length > 5"
                    class="p-3 text-center border-t border-zinc-900 text-[10px] text-zinc-500 font-medium"
                  >
                    以及另外 {{ previewData.length - 5 }} 条记录...
                  </div>
                </div>
              </div>
            </div>

            <div class="flex gap-3 mt-8">
              <button
                class="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeImportModal"
              >
                取消
              </button>
              <button
                :disabled="importLoading || previewData.length === 0"
                class="flex-[2] px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-900/20 active:scale-95"
                @click="importUsers"
              >
                <Save v-if="!importLoading" :size="16" />
                <RefreshCw v-else class="animate-spin" :size="16" />
                {{ importLoading ? '正在导入...' : '确认开始导入' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      :show="showDeleteModal"
      title="确认删除用户"
      :message="`确定要删除用户 &quot;${deletingUser?.name}&quot; 吗？此操作将永久移除该账户，不可撤销。`"
      type="danger"
      confirm-text="确认删除"
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click="closeUserDetailModal"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl"
          @click.stop
        >
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
                  >
                    <User :size="20" />
                  </div>
                  用户详细信息
                </h3>
                <p class="text-xs text-zinc-500 mt-1 ml-13">查看完整的账户资料与操作记录</p>
              </div>
              <button
                class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
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
                  class="flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest ml-1"
                >
                  <Info :size="14" class="text-blue-500" />
                  基本信息
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                      用户 ID
                    </div>
                    <div class="text-sm font-bold text-zinc-300">{{ selectedUserDetail.id }}</div>
                  </div>
                  <div class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                      姓名
                    </div>
                    <div class="text-sm font-bold text-zinc-300">{{ selectedUserDetail.name }}</div>
                  </div>
                  <div class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                      用户名
                    </div>
                    <div class="text-sm font-bold text-zinc-300">
                      {{ selectedUserDetail.username }}
                    </div>
                  </div>
                  <div class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                      角色权限
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
                  <div class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                      年级
                    </div>
                    <div class="text-sm font-bold text-zinc-300">
                      {{ selectedUserDetail.grade || '未设置' }}
                    </div>
                  </div>
                  <div class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-1">
                    <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                      班级
                    </div>
                    <div class="text-sm font-bold text-zinc-300">
                      {{ selectedUserDetail.class || '未设置' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 账户状态 -->
              <div class="space-y-4">
                <div
                  class="flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest ml-1"
                >
                  <Shield :size="14" class="text-emerald-500" />
                  账户状态
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl flex items-center justify-between"
                  >
                    <div class="space-y-1">
                      <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                        密码状态
                      </div>
                      <div
                        class="text-sm font-bold"
                        :class="
                          !selectedUserDetail.forcePasswordChange &&
                          selectedUserDetail.passwordChangedAt
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        "
                      >
                        {{
                          !selectedUserDetail.forcePasswordChange &&
                          selectedUserDetail.passwordChangedAt
                            ? '密码已修改'
                            : '需要修改密码'
                        }}
                      </div>
                    </div>
                    <div
                      :class="[
                        'w-8 h-8 rounded-xl flex items-center justify-center',
                        !selectedUserDetail.forcePasswordChange &&
                        selectedUserDetail.passwordChangedAt
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
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
                    class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl flex items-center justify-between"
                  >
                    <div class="space-y-1">
                      <div class="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
                        MeoW 账号绑定
                      </div>
                      <div
                        class="text-sm font-bold"
                        :class="
                          selectedUserDetail.meowNickname ? 'text-emerald-500' : 'text-zinc-500'
                        "
                      >
                        {{
                          selectedUserDetail.meowNickname
                            ? `已绑定: ${selectedUserDetail.meowNickname}`
                            : '未绑定'
                        }}
                      </div>
                    </div>
                    <div
                      :class="[
                        'w-8 h-8 rounded-xl flex items-center justify-center',
                        selectedUserDetail.meowNickname
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-zinc-800 text-zinc-600'
                      ]"
                    >
                      <AtSign :size="16" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 登录与时间 -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-4">
                  <div
                    class="flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest ml-1"
                  >
                    <Clock :size="14" class="text-purple-500" />
                    登录信息
                  </div>
                  <div class="space-y-3">
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-zinc-950/30 rounded-xl border border-zinc-800/30"
                    >
                      <span class="text-zinc-500">最后登录</span>
                      <span class="text-zinc-300 font-medium">{{
                        formatDate(selectedUserDetail.lastLogin)
                      }}</span>
                    </div>
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-zinc-950/30 rounded-xl border border-zinc-800/30"
                    >
                      <span class="text-zinc-500">登录 IP</span>
                      <span class="text-zinc-300 font-medium">{{
                        selectedUserDetail.lastLoginIp || '未知'
                      }}</span>
                    </div>
                  </div>
                </div>
                <div class="space-y-4">
                  <div
                    class="flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest ml-1"
                  >
                    <Calendar :size="14" class="text-amber-500" />
                    时间记录
                  </div>
                  <div class="space-y-3">
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-zinc-950/30 rounded-xl border border-zinc-800/30"
                    >
                      <span class="text-zinc-500">创建时间</span>
                      <span class="text-zinc-300 font-medium">{{
                        formatDate(selectedUserDetail.createdAt)
                      }}</span>
                    </div>
                    <div
                      class="flex items-center justify-between text-xs p-3 bg-zinc-950/30 rounded-xl border border-zinc-800/30"
                    >
                      <span class="text-zinc-500">最近更新</span>
                      <span class="text-zinc-300 font-medium">{{
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
                    class="flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest"
                  >
                    <History :size="14" class="text-emerald-500" />
                    状态变更日志
                  </div>
                </div>

                <div
                  v-if="statusLogsLoading"
                  class="py-12 flex flex-col items-center justify-center text-zinc-600 gap-3"
                >
                  <RefreshCw :size="24" class="animate-spin" />
                  <span class="text-[10px] font-black uppercase tracking-widest"
                    >正在加载记录...</span
                  >
                </div>

                <div
                  v-else-if="statusLogs.length === 0"
                  class="py-12 text-center bg-zinc-950/30 border border-zinc-800/50 rounded-3xl"
                >
                  <p class="text-xs text-zinc-600">暂无状态变更记录</p>
                </div>

                <div v-else class="space-y-4">
                  <div
                    class="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800"
                  >
                    <div v-for="log in statusLogs" :key="log.id" class="relative">
                      <div
                        class="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-zinc-900 border-2 border-zinc-700 ring-4 ring-zinc-900"
                      />
                      <div
                        class="p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl space-y-3"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span
                              :class="[
                                'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter',
                                getStatusClass(log.oldStatus)
                              ]"
                            >
                              {{ log.oldStatusDisplay || '初始' }}
                            </span>
                            <ArrowRight :size="12" class="text-zinc-700" />
                            <span
                              :class="[
                                'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter',
                                getStatusClass(log.newStatus)
                              ]"
                            >
                              {{ log.newStatusDisplay }}
                            </span>
                          </div>
                          <span class="text-[10px] text-zinc-600 font-medium">{{
                            formatStatusLogDate(log.createdAt)
                          }}</span>
                        </div>

                        <div
                          v-if="log.reason"
                          class="text-xs text-zinc-400 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/30 leading-relaxed"
                        >
                          <span class="text-zinc-600 font-bold mr-1">原因:</span>
                          {{ log.reason }}
                        </div>

                        <div class="flex items-center gap-2 text-[10px]">
                          <div
                            class="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500"
                          >
                            <User :size="8" />
                          </div>
                          <span class="text-zinc-500">操作者:</span>
                          <span class="text-zinc-300 font-bold">{{
                            log.operator?.name || '系统'
                          }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 分页 -->
                  <div
                    v-if="statusLogsPagination.totalPages > 1"
                    class="flex items-center justify-between bg-zinc-950/30 p-3 rounded-2xl border border-zinc-800/30"
                  >
                    <button
                      :disabled="!statusLogsPagination.hasPrevPage"
                      class="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 rounded-xl transition-all"
                      @click="loadStatusLogsPage(statusLogsPagination.page - 1)"
                    >
                      <ChevronLeft :size="16" />
                    </button>
                    <span class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      第 {{ statusLogsPagination.page }} / {{ statusLogsPagination.totalPages }} 页
                    </span>
                    <button
                      :disabled="!statusLogsPagination.hasNextPage"
                      class="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 rounded-xl transition-all"
                      @click="loadStatusLogsPage(statusLogsPagination.page + 1)"
                    >
                      <ChevronRight :size="16" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8">
              <button
                class="w-full px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                @click="closeUserDetailModal"
              >
                关闭窗口
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { usePermissions } from '~/composables/usePermissions'
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
  ArrowLeft,
  Filter,
  Download,
  Upload,
  UserCog,
  ShieldAlert,
  Calendar,
  Clock3,
  Hash,
  AtSign,
  Briefcase
} from 'lucide-vue-next'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import UserSongsModal from '~/components/Admin/UserSongsModal.vue'
import BatchUpdateModal from '~/components/Admin/BatchUpdateModal.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

// 响应式数据
const loading = ref(false)
const users = ref([])
const searchQuery = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(50)
const totalUsers = ref(0)
const totalPages = ref(1)

// 硬编码角色定义
const allRoles = [
  { name: 'USER', displayName: '普通用户' },
  { name: 'SONG_ADMIN', displayName: '歌曲管理员' },
  { name: 'ADMIN', displayName: '管理员' },
  { name: 'SUPER_ADMIN', displayName: '超级管理员' }
]

// 筛选选项
const roleFilterOptions = computed(() => [{ name: '', displayName: '全部角色' }, ...allRoles])

const statusFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '正常', value: 'active' },
  { label: '退学', value: 'withdrawn' }
]

const userStatusOptions = [
  { label: '正常访问', value: 'active' },
  { label: '限制访问 (退学)', value: 'withdrawn' }
]

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
const importSuccess = ref('')
const previewData = ref([])
const xlsxLoaded = ref(false)

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
const permissions = usePermissions()

// 判断是否为当前登录用户
const isSelf = (user) => {
  return auth.user.value?.id === user?.id
}

// 计算属性
const isSuperAdmin = computed(() => {
  return auth.user.value?.role === 'SUPER_ADMIN'
})

const availableRoles = computed(() => {
  if (isSuperAdmin.value) {
    // 超级管理员可以分配除自己以外的所有角色
    return allRoles.filter((role) => role.name !== 'SUPER_ADMIN')
  } else {
    // 其他角色不能分配角色，返回空数组
    return []
  }
})

// 由于使用服务器端分页，这些计算属性简化了
const filteredUsers = computed(() => {
  return users.value
})

const paginatedUsers = computed(() => {
  return users.value
})

// 监听搜索和过滤条件变化
watch(
  [searchQuery, roleFilter, statusFilter],
  () => {
    currentPage.value = 1
    loadUsers(1, pageSize.value)
  },
  { debounce: 300 }
)

// 监听页码变化
watch(currentPage, (newPage) => {
  loadUsers(newPage, pageSize.value)
})

// 方法
const formatDate = (dateString) => {
  if (!dateString) return '从未登录'
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN')
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
  const names = {
    USER: '普通用户',
    ADMIN: '管理员',
    SONG_ADMIN: '歌曲管理员',
    SUPER_ADMIN: '超级管理员'
  }
  return names[role] || role
}

const getStatusClass = (status) => {
  const classes = {
    active: 'status-active',
    withdrawn: 'status-withdrawn'
  }
  return classes[status] || 'status-active'
}

const getStatusDisplayName = (status) => {
  const names = {
    active: '正常',
    withdrawn: '退学'
  }
  return names[status] || '正常'
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    currentPage.value = page
  }
}

const editUser = (user) => {
  // 禁止编辑自身
  if (isSelf(user)) {
    if (window.$showNotification) {
      window.$showNotification('禁止在用户管理中修改自己的账户', 'warning')
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

const resetPassword = (user) => {
  // 禁止重置自身密码
  if (isSelf(user)) {
    if (window.$showNotification) {
      window.$showNotification('禁止在用户管理中重置自己的密码', 'warning')
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
      window.$showNotification('不能删除自己的账户', 'warning')
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
}

const closeBatchUpdateModal = () => {
  showBatchUpdateModal.value = false
}

const handleBatchUpdateSuccess = async () => {
  await loadUsers()
  if (window.$showNotification) {
    window.$showNotification('批量更新成功', 'success')
  }
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

    await loadUsers()
    closeDeleteModal()

    if (window.$showNotification) {
      window.$showNotification('用户删除成功', 'success')
    }
  } catch (error) {
    console.error('删除用户失败:', error)
    if (window.$showNotification) {
      window.$showNotification('删除用户失败: ' + error.message, 'error')
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

const saveUser = async () => {
  // 保护：禁止保存针对自身的更改
  if (editingUser.value && isSelf(editingUser.value)) {
    formError.value = '禁止在用户管理中修改自己的账户'
    return
  }
  if (!userForm.value.name || !userForm.value.username) {
    formError.value = '请填写必要信息'
    return
  }

  if (!editingUser.value && !userForm.value.password) {
    formError.value = '请输入密码'
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

    // 检查是否是权限更新
    const isRoleUpdate = editingUser.value && editingUser.value.role !== userForm.value.role
    const oldRole = editingUser.value?.role
    const newRole = userForm.value.role

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

    // 如果是权限更新且当前用户是超级管理员，发送通知
    if (isRoleUpdate && permissions.isSuperAdmin) {
      try {
        const roleNames = {
          USER: '普通用户',
          SONG_ADMIN: '歌曲管理员',
          ADMIN: '管理员',
          SUPER_ADMIN: '超级管理员'
        }

        const notificationMessage = `您的账户权限已由超级管理员更新：${roleNames[oldRole]} → ${roleNames[newRole]}`

        await $fetch('/api/admin/notifications/send', {
          method: 'POST',
          body: {
            userId: editingUser.value.id,
            title: '权限变更通知',
            message: notificationMessage,
            type: 'system'
          },
          ...auth.getAuthConfig()
        })
      } catch (notificationError) {
        console.error('发送权限变更通知失败:', notificationError)
        // 不影响主要操作，只记录错误
      }
    }

    await loadUsers()
    closeModal()

    if (window.$showNotification) {
      window.$showNotification(editingUser.value ? '用户更新成功' : '用户创建成功', 'success')
    }
  } catch (error) {
    console.error('保存用户失败:', error)
    formError.value = error.message || '保存失败'
  } finally {
    saving.value = false
  }
}

const confirmResetPassword = async () => {
  // 保护：禁止重置自身密码
  if (resetPasswordUser.value && isSelf(resetPasswordUser.value)) {
    passwordError.value = '禁止在用户管理中重置自己的密码'
    return
  }
  if (!passwordForm.value.password) {
    passwordError.value = '请输入新密码'
    return
  }

  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    passwordError.value = '两次输入的密码不一致'
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
      window.$showNotification('密码重置成功', 'success')
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    passwordError.value = error.message || '重置失败'
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
        status: statusFilter.value || undefined
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
      window.$showNotification('加载用户失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

// 批量导入相关方法
const closeImportModal = () => {
  showImportModal.value = false
  importError.value = ''
  importSuccess.value = ''
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
        throw new Error('所有XLSX库源加载失败')
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
  importSuccess.value = ''
  previewData.value = []

  // 确保XLSX库已加载
  if (!window.XLSX) {
    await loadXLSX()

    if (!window.XLSX) {
      importError.value = '无法加载Excel处理库，请刷新页面重试'
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
            'class'
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
          importError.value = '未找到有效数据'
          return
        }

        previewData.value = userData
      } catch (err) {
        console.error('解析Excel出错:', err)
        importError.value = '解析Excel文件失败: ' + (err.message || '未知错误')
      }
    }

    reader.onerror = () => {
      importError.value = '读取文件失败'
    }

    reader.readAsArrayBuffer(file)
  } catch (err) {
    console.error('处理Excel文件错误:', err)
    importError.value = '处理Excel文件失败: ' + (err.message || '未知错误')
  }
}

// 批量导入用户
const importUsers = async () => {
  if (previewData.value.length === 0) return

  importLoading.value = true
  importError.value = ''
  importSuccess.value = ''

  try {
    // 调用API批量导入用户
    const result = await $fetch('/api/admin/users/batch', {
      method: 'POST',
      body: {
        users: previewData.value
      },
      ...auth.getAuthConfig()
    })

    // 更新用户列表
    await loadUsers()

    importSuccess.value = `成功导入 ${result.created} 个用户，${result.failed} 个用户导入失败`

    // 清空预览数据
    previewData.value = []

    // 3秒后关闭导入对话框
    setTimeout(() => {
      if (importSuccess.value) {
        closeImportModal()
      }
    }, 3000)
  } catch (err) {
    importError.value = err.message || '导入用户失败'
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
    statusLogsError.value = error.message || '加载状态日志失败'
  } finally {
    statusLogsLoading.value = false
  }
}

const formatStatusLogDate = (dateString) => {
  if (!dateString) return '未知时间'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 生命周期
onMounted(async () => {
  console.log('UserManager 组件挂载')
  await loadUsers(1, pageSize.value)
  // 预加载XLSX库
  loadXLSX()
})
</script>

<style scoped>
/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #718096;
}

/* 确保模态框中的表格在移动端可以滚动 */
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}
</style>
