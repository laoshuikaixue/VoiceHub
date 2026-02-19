<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <!-- 头部区域 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-zinc-100 tracking-tight">API密钥管理</h2>
        <p class="text-xs text-zinc-500 mt-1">管理开放API的访问密钥，控制第三方应用的访问权限</p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
        @click="openCreateModal"
      >
        <Plus :size="14" /> 创建API密钥
      </button>
    </div>

    <!-- 过滤器栏 -->
    <div
      class="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-3 flex flex-col lg:flex-row gap-3 items-center"
    >
      <div class="relative flex-1 w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" :size="16" />
        <input
          v-model="filters.search"
          type="text"
          placeholder="搜索API密钥名称或描述..."
          class="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800 text-zinc-200"
          @input="debouncedSearch"
        >
      </div>
      <div class="flex items-center gap-2 w-full lg:w-auto">
        <CustomSelect
          v-model="statusFilterText"
          label="状态"
          :options="['全部状态', '活跃', '非活跃', '已过期']"
          class-name="flex-1 lg:w-40"
          @change="handleStatusFilterChange"
        />
        <div class="relative flex-1 lg:w-48">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" :size="14" />
          <input
            v-model="filters.createdBy"
            type="text"
            placeholder="创建者用户名"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none text-zinc-400 placeholder:text-zinc-800"
            @input="debouncedSearch"
          >
        </div>
        <button
          class="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-600 hover:text-blue-400 transition-all"
          @click="loadApiKeys"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div
      v-if="loading && apiKeys.length === 0"
      class="flex flex-col items-center justify-center py-20"
    >
      <div class="loading-spinner mb-4" />
      <p class="text-zinc-500 text-xs">加载中...</p>
    </div>

    <div
      v-else-if="apiKeys.length === 0"
      class="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div
        class="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-zinc-700 shadow-xl"
      >
        <Key :size="32" :stroke-width="1.5" />
      </div>
      <h3 class="text-lg font-bold text-zinc-200">暂无API密钥</h3>
      <p class="text-xs text-zinc-500 mt-2 max-w-xs leading-relaxed">
        您还没有创建任何访问密钥。创建密钥后，您可以安全地将 VoiceHub 集成到第三方应用程序中。
      </p>
      <button
        class="mt-8 flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-2xl transition-all"
        @click="openCreateModal"
      >
        <Plus :size="16" /> 创建您的第一个密钥
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="apiKey in apiKeys"
        :key="apiKey.id"
        class="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 group hover:border-zinc-700 transition-all relative overflow-hidden"
      >
        <div class="flex items-start justify-between relative z-10">
          <div class="space-y-1">
            <div class="flex items-center gap-3">
              <h4 class="text-sm font-black text-zinc-100 uppercase tracking-widest">
                {{ apiKey.name }}
              </h4>
              <span
                v-if="apiKey.status === 'active'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded uppercase border border-emerald-500/20"
                >活跃</span
              >
              <span
                v-else-if="apiKey.status === 'inactive'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] font-black rounded uppercase border border-zinc-700/50"
                >非活跃</span
              >
              <span
                v-else-if="apiKey.status === 'expired'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black rounded uppercase border border-red-500/20"
                >已过期</span
              >
            </div>
            <p class="text-xs text-zinc-500 font-medium">{{ apiKey.description || '暂无描述' }}</p>
          </div>
          <div
            class="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all"
          >
            <button
              class="p-2 text-zinc-500 hover:text-blue-400 transition-colors"
              @click="viewApiKey(apiKey)"
            >
              <Eye :size="14" />
            </button>
            <button
              class="p-2 text-zinc-500 hover:text-amber-400 transition-colors"
              @click="editApiKey(apiKey)"
            >
              <Edit2 :size="14" />
            </button>
            <button
              class="p-2 text-zinc-500 hover:text-red-400 transition-colors"
              @click="deleteApiKey(apiKey)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <div class="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-800/40 pt-6 relative z-10">
          <div class="space-y-0.5">
            <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
              >创建者</span
            >
            <p class="text-xs font-bold text-zinc-400">{{ apiKey.creatorName || '未知' }}</p>
          </div>
          <div class="space-y-0.5">
            <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
              >创建时间</span
            >
            <p class="text-xs font-bold text-zinc-400">
              {{ formatDate(apiKey.createdAt).split(' ')[0] }}
            </p>
          </div>
          <div class="col-span-2 space-y-1">
            <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
              >权限列表</span
            >
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="perm in apiKey.permissions"
                :key="perm"
                class="text-[9px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-800/50"
              >
                {{ perm }}
              </span>
            </div>
          </div>
        </div>

        <!-- 背景点缀 -->
        <div
          class="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="flex justify-center mt-8">
      <div
        class="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/60 p-1.5 rounded-2xl"
      >
        <button
          :disabled="pagination.page <= 1"
          class="p-2 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          @click="changePage(pagination.page - 1)"
        >
          <ChevronLeft :size="18" />
        </button>
        <div class="px-4 text-[11px] font-black text-zinc-500 uppercase tracking-widest">
          第 {{ pagination.page }} 页 / 共 {{ pagination.totalPages }} 页
        </div>
        <button
          :disabled="pagination.page >= pagination.totalPages"
          class="p-2 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          @click="changePage(pagination.page + 1)"
        >
          <ChevronRight :size="18" />
        </button>
      </div>
    </div>

    <!-- 模态框组 -->
    <Transition name="modal">
      <div
        v-if="showCreateModal || showEditModal || showViewModal || showSuccessModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeModals" />

        <!-- 创建/编辑模态框 -->
        <div
          v-if="showCreateModal || showEditModal"
          class="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h3 class="text-lg font-black text-zinc-100 uppercase tracking-widest">
              {{ showCreateModal ? '创建API密钥' : '编辑API密钥' }}
            </h3>
            <button
              class="text-zinc-500 hover:text-zinc-200 transition-colors"
              @click="closeModals"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-0.5"
                >名称 *</label
              >
              <input
                v-model="form.name"
                type="text"
                placeholder="输入API密钥名称"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500/30 text-zinc-200 placeholder:text-zinc-800"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-0.5"
                >描述</label
              >
              <textarea
                v-model="form.description"
                placeholder="输入API密钥描述 (可选)"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500/30 text-zinc-200 min-h-[80px] resize-none placeholder:text-zinc-800"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-0.5"
                >过期时间</label
              >
              <CustomSelect
                v-model="expiresAtText"
                :options="[
                  '永不过期',
                  '3天后过期',
                  '7天后过期',
                  '30天后过期',
                  '60天后过期',
                  '90天后过期'
                ]"
                class-name="w-full"
                @change="handleExpiresAtChange"
              />
            </div>
            <div class="space-y-3">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-0.5"
                >权限设置 *</label
              >
              <div class="grid grid-cols-2 gap-2">
                <label
                  v-for="perm in availablePermissions"
                  :key="perm.value"
                  class="flex items-start gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-600 transition-all"
                  :class="{
                    'border-blue-500/30 bg-blue-500/5': form.permissions.includes(perm.value)
                  }"
                >
                  <input
                    v-model="form.permissions"
                    type="checkbox"
                    :value="perm.value"
                    class="mt-1 w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 accent-blue-600"
                  >
                  <div>
                    <p
                      class="text-xs font-bold"
                      :class="
                        form.permissions.includes(perm.value) ? 'text-blue-400' : 'text-zinc-300'
                      "
                    >
                      {{ perm.label }}
                    </p>
                    <p class="text-[9px] text-zinc-600 mt-0.5">{{ perm.description }}</p>
                  </div>
                </label>
              </div>
            </div>
            <label
              v-if="showEditModal"
              class="flex items-center gap-2 p-3 bg-blue-600/5 border border-blue-500/10 rounded-xl cursor-pointer group"
            >
              <input
                v-model="form.isActive"
                type="checkbox"
                class="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 accent-blue-600"
              >
              <span
                class="text-xs font-bold text-zinc-300 group-hover:text-blue-400 transition-colors"
                >启用此API密钥</span
              >
            </label>
          </div>

          <div class="p-6 border-t border-zinc-800 flex gap-2 justify-end">
            <button
              class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300"
              @click="closeModals"
            >
              取消
            </button>
            <button
              :disabled="submitting"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all"
              @click="showCreateModal ? createApiKey() : updateApiKey()"
            >
              {{ submitting ? '保存中...' : showCreateModal ? '创建密钥' : '保存更改' }}
            </button>
          </div>
        </div>

        <!-- 成功模态框 -->
        <div
          v-if="showSuccessModal"
          class="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h3 class="text-lg font-black text-zinc-100 uppercase tracking-widest">
              API密钥创建成功
            </h3>
            <button
              class="text-zinc-500 hover:text-zinc-200 transition-colors"
              @click="closeModals"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-6">
            <div
              class="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center text-center"
            >
              <div
                class="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/20"
              >
                <Check :size="24" :stroke-width="3" />
              </div>
              <h4 class="text-lg font-black text-emerald-400">API密钥创建成功！</h4>
              <p class="text-xs text-zinc-500 mt-2">请妥善保管以下API密钥，它只会显示这一次。</p>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-0.5"
                >完整API密钥</label
              >
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-xs text-blue-400 break-all select-all"
                >
                  {{ newApiKey?.apiKey }}
                </div>
                <button
                  class="p-3 rounded-xl transition-all"
                  :class="
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  "
                  @click="copyToClipboard(newApiKey?.apiKey)"
                >
                  <Check v-if="copied" :size="16" />
                  <Copy v-else :size="16" />
                </button>
              </div>
              <div
                class="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500"
              >
                <AlertTriangle :size="14" class="shrink-0" />
                <p class="text-[10px] font-bold">
                  请立即复制并保存此API密钥，关闭此窗口后将无法再次查看完整密钥
                </p>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-zinc-800">
            <button
              class="w-full py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-black rounded-xl transition-all"
              @click="closeModals"
            >
              我已保存，关闭窗口
            </button>
          </div>
        </div>

        <!-- 详情模态框 -->
        <div
          v-if="showViewModal && selectedApiKey"
          class="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h3 class="text-lg font-black text-zinc-100 uppercase tracking-widest">API密钥详情</h3>
            <button
              class="text-zinc-500 hover:text-zinc-200 transition-colors"
              @click="closeModals"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <section class="space-y-4">
              <h5
                class="text-[10px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800 pb-2"
              >
                基本信息
              </h5>
              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-1">
                  <span class="text-[10px] text-zinc-600 font-bold">名称:</span>
                  <p class="text-xs font-bold text-zinc-200">{{ selectedApiKey.name }}</p>
                </div>
                <div class="space-y-1">
                  <span class="text-[10px] text-zinc-600 font-bold">状态:</span>
                  <div>
                    <span
                      v-if="selectedApiKey.status === 'active'"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded uppercase border border-emerald-500/20"
                      >活跃</span
                    >
                    <span
                      v-else-if="selectedApiKey.status === 'inactive'"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] font-black rounded uppercase border border-zinc-700/50"
                      >非活跃</span
                    >
                    <span
                      v-else-if="selectedApiKey.status === 'expired'"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black rounded uppercase border border-red-500/20"
                      >已过期</span
                    >
                  </div>
                </div>
                <div class="col-span-2 space-y-1">
                  <span class="text-[10px] text-zinc-600 font-bold">描述:</span>
                  <p class="text-xs font-bold text-zinc-400 leading-relaxed">
                    {{ selectedApiKey.description || '暂无描述' }}
                  </p>
                </div>
                <div class="space-y-1">
                  <span class="text-[10px] text-zinc-600 font-bold">创建者:</span>
                  <p class="text-xs font-bold text-zinc-200">
                    {{ selectedApiKey.creatorName || '未知' }}
                  </p>
                </div>
                <div class="space-y-1">
                  <span class="text-[10px] text-zinc-600 font-bold">创建时间:</span>
                  <p class="text-xs font-bold text-zinc-200">
                    {{ formatDate(selectedApiKey.createdAt) }}
                  </p>
                </div>
                <div v-if="selectedApiKey.expiresAt" class="space-y-1">
                  <span class="text-[10px] text-zinc-600 font-bold">过期时间:</span>
                  <p
                    class="text-xs font-bold"
                    :class="selectedApiKey.isExpired ? 'text-red-400' : 'text-zinc-200'"
                  >
                    {{ formatDate(selectedApiKey.expiresAt) }}
                  </p>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <h5
                class="text-[10px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800 pb-2"
              >
                使用统计
              </h5>
              <div class="grid grid-cols-2 gap-4">
                <div
                  class="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all"
                >
                  <div class="space-y-0.5">
                    <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
                      >总调用次数</span
                    >
                    <p class="text-xl font-black text-zinc-100">
                      {{ selectedApiKey.usageCount || 0 }}
                    </p>
                  </div>
                  <div
                    class="p-2 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform"
                  >
                    <BarChart :size="20" />
                  </div>
                </div>
                <div
                  class="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-amber-500/30 transition-all"
                >
                  <div class="space-y-0.5">
                    <span class="text-[9px] font-black text-zinc-600 uppercase tracking-widest"
                      >最后使用时间</span
                    >
                    <p class="text-xs font-bold text-zinc-100">
                      {{
                        selectedApiKey.lastUsedAt
                          ? formatDate(selectedApiKey.lastUsedAt)
                          : '从未核对'
                      }}
                    </p>
                  </div>
                  <div
                    class="p-2 bg-amber-500/10 rounded-xl text-amber-500 group-hover:scale-110 transition-transform"
                  >
                    <Clock :size="20" />
                  </div>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h5 class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                  最近调用日志
                </h5>
                <div class="flex items-center gap-1">
                  <button
                    :disabled="logsPagination.page <= 1"
                    class="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                    @click="loadApiLogs(logsPagination.page - 1)"
                  >
                    <ChevronLeft :size="14" />
                  </button>
                  <span class="text-[9px] font-black text-zinc-600"
                    >{{ logsPagination.page }} / {{ logsPagination.totalPages }}</span
                  >
                  <button
                    :disabled="logsPagination.page >= logsPagination.totalPages"
                    class="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                    @click="loadApiLogs(logsPagination.page + 1)"
                  >
                    <ChevronRight :size="14" />
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <div
                  v-if="loadingLogs"
                  class="flex flex-col items-center justify-center py-10 text-zinc-600 gap-2"
                >
                  <RefreshCw :size="24" class="animate-spin" />
                  <span class="text-[10px] font-bold">正在加载日志...</span>
                </div>
                <div
                  v-else-if="apiLogs.length === 0"
                  class="flex flex-col items-center justify-center py-10 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl"
                >
                  <History :size="24" class="text-zinc-800 mb-2" />
                  <span class="text-[10px] font-bold text-zinc-700 uppercase tracking-widest"
                    >暂无调用记录</span
                  >
                </div>
                <div
                  v-for="log in apiLogs"
                  v-else
                  :key="log.id"
                  class="p-3 bg-zinc-950 border border-zinc-800/40 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-all"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border"
                      :class="getMethodClass(log.method)"
                    >
                      {{ log.method }}
                    </div>
                    <div class="space-y-0.5">
                      <p class="text-xs font-mono text-zinc-400">{{ log.endpoint }}</p>
                      <div class="flex items-center gap-2 text-[9px] font-bold text-zinc-600">
                        <span>{{ formatDate(log.createdAt) }}</span>
                        <span>•</span>
                        <span>{{ log.ipAddress }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right space-y-0.5">
                      <p class="text-xs font-black" :class="getStatusColorClass(log.statusCode)">
                        {{ log.statusCode }}
                      </p>
                      <p class="text-[9px] font-bold text-zinc-600">{{ log.responseTimeMs }}ms</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 确认删除对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :cancel-text="confirmDialogConfig.cancelText"
      :confirm-text="confirmDialogConfig.confirmText"
      :message="confirmDialogConfig.message"
      :title="confirmDialogConfig.title"
      :type="confirmDialogConfig.type"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Plus,
  Search,
  Key,
  Trash2,
  Edit2,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  BarChart,
  Clock,
  History,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const apiKeys = ref([])
const selectedApiKey = ref(null)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showViewModal = ref(false)
const showSuccessModal = ref(false)
const newApiKey = ref(null)
const loadingLogs = ref(false)
const apiLogs = ref([])
const copied = ref(false)

// 文本映射
const statusFilterText = ref('全部状态')
const expiresAtText = ref('永不过期')

const logsPagination = ref({
  page: 1,
  limit: 5,
  total: 0,
  totalPages: 0
})

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref({
  title: '确认删除',
  message: '',
  type: 'danger',
  confirmText: '删除',
  cancelText: '取消'
})
const pendingDeleteApiKey = ref(null)

// 分页信息
const pagination = ref({
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0
})

// 筛选条件
const filters = reactive({
  search: '',
  status: '',
  createdBy: ''
})

// 表单数据
const form = reactive({
  name: '',
  description: '',
  expiresAt: '',
  permissions: [],
  isActive: true
})

// 可用权限列表
const availablePermissions = [
  {
    value: 'schedules:read',
    label: '排期查询',
    description: '查看排期列表和详情'
  },
  {
    value: 'songs:read',
    label: '歌曲查询',
    description: '查看歌曲列表和详情'
  }
]

// Toast通知
const toast = useToast()

// 方法
const handleStatusFilterChange = (val) => {
  const statusMap = { 活跃: 'active', 非活跃: 'inactive', 已过期: 'expired' }
  filters.status = statusMap[val] || ''
  loadApiKeys()
}

const handleExpiresAtChange = (val) => {
  const map = {
    永不过期: '',
    '3天后过期': '3d',
    '7天后过期': '7d',
    '30天后过期': '30d',
    '60天后过期': '60d',
    '90天后过期': '90d'
  }
  form.expiresAt = map[val] || ''
}

// 搜索防抖
let searchTimeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadApiKeys()
  }, 500)
}

const loadApiKeys = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: pagination.value.page.toString(),
      limit: pagination.value.limit.toString()
    })

    if (filters.search) params.append('search', filters.search)
    if (filters.status) params.append('status', filters.status)
    if (filters.createdBy) params.append('createdBy', filters.createdBy)

    const response = await $fetch(`/api/admin/api-keys?${params}`)

    if (response.success) {
      apiKeys.value = response.data.items
      pagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('加载API密钥失败:', error)
    toast.error('加载API密钥失败')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  resetForm()
  showCreateModal.value = true
}

const createApiKey = async () => {
  if (!form.name) return toast.error('请输入密钥名称')
  if (form.permissions.length === 0) return toast.error('请至少选择一个权限')

  submitting.value = true
  try {
    const data = {
      name: form.name,
      description: form.description || null,
      expiresAt: form.expiresAt || null,
      permissions: form.permissions,
      isActive: true
    }

    const response = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: data
    })

    if (response.success) {
      toast.success('API密钥创建成功')
      newApiKey.value = response.data
      showCreateModal.value = false
      showSuccessModal.value = true
      resetForm()
      await loadApiKeys()
    }
  } catch (error) {
    console.error('创建API密钥失败:', error)
    toast.error(error.data?.message || '创建API密钥失败')
  } finally {
    submitting.value = false
  }
}

const updateApiKey = async () => {
  if (!selectedApiKey.value) return
  if (!form.name) return toast.error('请输入密钥名称')
  if (form.permissions.length === 0) return toast.error('请至少选择一个权限')

  submitting.value = true
  try {
    const data = {
      name: form.name,
      description: form.description || null,
      // 如果是 'keep'，则不发送 expiresAt 字段，后端将不更新该字段
      ...(form.expiresAt !== 'keep' && { expiresAt: form.expiresAt || null }),
      permissions: form.permissions,
      isActive: form.isActive
    }

    const response = await $fetch(`/api/admin/api-keys/${selectedApiKey.value.id}`, {
      method: 'PUT',
      body: data
    })

    if (response.success) {
      toast.success('API密钥更新成功')
      closeModals()
      await loadApiKeys()
    }
  } catch (error) {
    console.error('更新API密钥失败:', error)
    toast.error(error.data?.message || '更新API密钥失败')
  } finally {
    submitting.value = false
  }
}

const deleteApiKey = (apiKey) => {
  pendingDeleteApiKey.value = apiKey
  confirmDialogConfig.value = {
    title: '确认删除',
    message: `确定要删除API密钥 "${apiKey.name}" 吗？此操作不可撤销。`,
    type: 'danger',
    confirmText: '删除',
    cancelText: '取消'
  }
  showConfirmDialog.value = true
}

const confirmDelete = async () => {
  if (!pendingDeleteApiKey.value) return

  try {
    const response = await $fetch(`/api/admin/api-keys/${pendingDeleteApiKey.value.id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      toast.success('API密钥删除成功')
      await loadApiKeys()
    }
  } catch (error) {
    console.error('删除API密钥失败:', error)
    toast.error(error.data?.message || '删除API密钥失败')
  } finally {
    showConfirmDialog.value = false
    pendingDeleteApiKey.value = null
  }
}

const cancelDelete = () => {
  showConfirmDialog.value = false
  pendingDeleteApiKey.value = null
}

const viewApiKey = async (apiKey) => {
  try {
    const response = await $fetch(`/api/admin/api-keys/${apiKey.id}`)
    if (response.success) {
      selectedApiKey.value = response.data
      showViewModal.value = true
      // 加载API使用日志
      await loadApiLogs(1)
    }
  } catch (error) {
    console.error('获取API密钥详情失败:', error)
    toast.error('获取API密钥详情失败')
  }
}

const editApiKey = async (apiKey) => {
  try {
    const response = await $fetch(`/api/admin/api-keys/${apiKey.id}`)
    if (response.success) {
      selectedApiKey.value = response.data

      // 填充表单
      form.name = response.data.name
      form.description = response.data.description || ''

      // 处理过期时间显示
      if (response.data.expiresAt) {
        const date = new Date(response.data.expiresAt)
        expiresAtText.value = `到期: ${date.toLocaleDateString()}`
        form.expiresAt = 'keep' // 特殊值，表示不修改过期时间
      } else {
        expiresAtText.value = '永不过期'
        form.expiresAt = ''
      }

      form.permissions = response.data.permissions || []
      form.isActive = response.data.isActive

      showEditModal.value = true
    }
  } catch (error) {
    console.error('获取API密钥详情失败:', error)
    toast.error('获取API密钥详情失败')
  }
}

const loadApiLogs = async (page = 1) => {
  if (!selectedApiKey.value) return
  if (page < 1 || (logsPagination.value.totalPages > 0 && page > logsPagination.value.totalPages))
    return

  loadingLogs.value = true
  try {
    const response = await $fetch('/api/admin/api-keys/logs', {
      query: {
        apiKeyId: selectedApiKey.value.id,
        page,
        limit: logsPagination.value.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    })

    if (response.logs) {
      apiLogs.value = response.logs
      logsPagination.value = {
        ...logsPagination.value,
        ...response.pagination,
        page
      }
    }
  } catch (error) {
    console.error('获取API使用日志失败:', error)
    toast.error('获取API使用日志失败')
    apiLogs.value = []
  } finally {
    loadingLogs.value = false
  }
}

const changePage = (page) => {
  pagination.value.page = page
  loadApiKeys()
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  showViewModal.value = false
  showSuccessModal.value = false
  selectedApiKey.value = null
  newApiKey.value = null
  // 重置日志相关状态
  apiLogs.value = []
  loadingLogs.value = false
  logsPagination.value = {
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0
  }
  resetForm()
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.expiresAt = ''
  expiresAtText.value = '永不过期'
  form.permissions = []
  form.isActive = true
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    toast.success('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 2000)
  } catch (error) {
    console.error('复制失败:', error)
    toast.error('复制失败')
  }
}

const getMethodClass = (method) => {
  const map = {
    GET: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    PUT: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-500 border-red-500/20'
  }
  return map[method] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

const getStatusColorClass = (code) => {
  if (code >= 200 && code < 300) return 'text-emerald-500'
  if (code >= 300 && code < 400) return 'text-amber-500'
  return 'text-red-500'
}

// 生命周期
onMounted(() => {
  loadApiKeys()
})
</script>

<style scoped>
.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}

/* 模态框动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from .relative {
  transform: scale(0.9) translateY(20px);
}

.modal-leave-to .relative {
  transform: scale(0.9) translateY(20px);
}
</style>
