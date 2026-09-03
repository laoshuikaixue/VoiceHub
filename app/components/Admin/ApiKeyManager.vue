<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-20 px-2">
    <!-- 头部区域 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">{{ locale.desc }}</p>
      </div>
      <button
        v-if="rbac.can(PERMISSIONS.API_KEYS_WRITE)"
        class="flex items-center gap-2 px-4 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl transition-all shadow-lg shadow-[var(--primary-glow)] active:scale-95"
        @click="openCreateModal"
      >
        <Plus :size="14" /> {{ locale.create }}
      </button>
    </div>

    <!-- 过滤器栏 -->
    <div
      class="bg-bg-secondary-40 border border-border-secondary-60 rounded-2xl p-3 flex flex-col lg:flex-row gap-3 items-center"
    >
      <div class="relative flex-1 w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" :size="16" />
        <input
          v-model="filters.search"
          type="text"
          :placeholder="locale.searchPlaceholder"
          class="w-full bg-bg-primary border border-border-secondary-80 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-primary-30 transition-all placeholder:text-text-primary text-text-primary"
          @input="debouncedSearch"
        >
      </div>
      <div class="flex items-center gap-2 w-full lg:w-auto">
        <CustomSelect
          v-model="filters.status"
          :label="locale.status"
          :options="statusFilterOptions"
          label-key="label"
          value-key="value"
          class-name="flex-1 lg:w-40"
          @change="loadApiKeys"
        />
        <div class="relative flex-1 lg:w-48">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" :size="14" />
          <input
            v-model="filters.createdBy"
            type="text"
            :placeholder="locale.creatorPlaceholder"
            class="w-full bg-bg-primary border border-border-secondary rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none text-text-tertiary placeholder:text-text-primary"
            @input="debouncedSearch"
          >
        </div>
        <button
          class="p-2.5 bg-bg-primary border border-border-secondary rounded-xl text-text-disabled hover:text-primary transition-all flex items-center justify-center"
          :aria-label="t('admin.apiKeys.actions.refresh', '刷新 API Key 列表')"
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
      <AppSpinner :size="24" class="mb-4" />
      <p class="text-text-tertiary text-xs">{{ locale.loading }}</p>
    </div>

    <div
      v-else-if="apiKeys.length === 0"
      class="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div
        class="w-20 h-20 rounded-3xl bg-bg-secondary border border-border-secondary flex items-center justify-center mb-6 text-text-secondary shadow-xl"
      >
        <Key :size="32" :stroke-width="1.5" />
      </div>
      <h3 class="text-lg font-bold text-text-primary">{{ locale.emptyTitle }}</h3>
      <p class="text-xs text-text-tertiary mt-2 max-w-xs leading-relaxed">
        {{ locale.emptyDesc }}
      </p>
      <button
        v-if="rbac.can(PERMISSIONS.API_KEYS_WRITE)"
        class="mt-8 flex items-center gap-2 px-6 py-3 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-secondary text-xs font-bold rounded-2xl transition-all"
        @click="openCreateModal"
      >
        <Plus :size="16" /> {{ locale.createFirst }}
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="apiKey in apiKeys"
        :key="apiKey.id"
        class="bg-bg-secondary-30 border border-border-secondary-60 rounded-2xl p-6 group hover:border-border-tertiary transition-all relative overflow-hidden"
      >
        <div class="flex items-start justify-between relative z-10">
          <div class="space-y-1">
            <div class="flex items-center gap-3">
              <h4 class="text-sm font-black text-text-primary uppercase tracking-widest">
                {{ apiKey.name }}
              </h4>
              <span
                v-if="apiKey.status === 'active'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-success-10 text-success text-[10px] font-black rounded uppercase border border-success-20"
                >{{ locale.active }}</span
              >
              <span
                v-else-if="apiKey.status === 'inactive'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-bg-tertiary text-text-tertiary text-[10px] font-black rounded uppercase border border-border-tertiary-50"
                >{{ locale.inactive }}</span
              >
              <span
                v-else-if="apiKey.status === 'expired'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-error-10 text-error text-[10px] font-black rounded uppercase border border-error-20"
                >{{ locale.expired }}</span
              >
            </div>
            <p class="text-xs text-text-tertiary font-medium">{{ apiKey.description || locale.noDescription }}</p>
          </div>
          <div
            class="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all"
          >
            <button
              v-if="rbac.can(PERMISSIONS.API_KEYS_READ)"
              class="p-2 text-text-tertiary hover:text-primary transition-colors"
              :disabled="loadingViewId !== null || loadingEditId !== null"
              :aria-label="t('admin.apiKeys.actions.view', '查看 API Key')"
              @click="viewApiKey(apiKey)"
            >
              <RefreshCw v-if="loadingViewId === apiKey.id" :size="14" class="animate-spin" />
              <Eye v-else :size="14" />
            </button>
            <button
              v-if="rbac.can(PERMISSIONS.API_KEYS_WRITE)"
              class="p-2 text-text-tertiary hover:text-warning transition-colors"
              :disabled="loadingViewId !== null || loadingEditId !== null"
              :aria-label="t('admin.apiKeys.actions.edit', '编辑 API Key')"
              @click="editApiKey(apiKey)"
            >
              <RefreshCw v-if="loadingEditId === apiKey.id" :size="14" class="animate-spin" />
              <Edit2 v-else :size="14" />
            </button>
            <button
              v-if="rbac.can(PERMISSIONS.API_KEYS_DELETE)"
              class="p-2 text-text-tertiary hover:text-error transition-colors"
              :disabled="loadingViewId !== null || loadingEditId !== null"
              :aria-label="t('admin.apiKeys.actions.delete', '删除 API Key')"
              @click="deleteApiKey(apiKey)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <div class="mt-8 grid grid-cols-2 gap-4 border-t border-border-secondary-40 pt-6 relative z-10">
          <div class="space-y-0.5">
            <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
              >{{ locale.creator }}</span
            >
            <p class="text-xs font-bold text-text-tertiary">{{ apiKey.creatorName || locale.unknown }}</p>
          </div>
          <div class="space-y-0.5">
            <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
              >{{ locale.createdAt }}</span
            >
            <p class="text-xs font-bold text-text-tertiary">
              {{ formatDate(apiKey.createdAt).split(' ')[0] }}
            </p>
          </div>
          <div class="col-span-2 space-y-1">
            <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
              >{{ locale.permissions }}</span
            >
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="perm in apiKey.permissions"
                :key="perm"
                class="text-[9px] font-mono bg-bg-primary px-1.5 py-0.5 rounded text-text-tertiary border border-border-secondary-50"
              >
                {{ perm }}
              </span>
            </div>
          </div>
        </div>

        <!-- 背景点缀 -->
        <div
          class="absolute -right-4 -bottom-4 w-24 h-24 bg-primary-5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </div>

    <!-- 分页 -->
    <Pagination
      v-model:current-page="pagination.page"
      :total-pages="pagination.totalPages"
      :total-items="pagination.total"
      :item-name="locale.itemName"
      @change="loadApiKeys"
    />

    <!-- 模态框组 -->
    <Transition name="modal">
      <div
        v-if="showCreateModal || showEditModal || showViewModal || showSuccessModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-bg-primary-60 backdrop-blur-sm"
          @click="handleBackdropClick"
        />

        <!-- 创建/编辑模态框 -->
        <div
          v-if="showCreateModal || showEditModal"
          class="relative w-full max-w-lg bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div class="p-6 border-b border-border-secondary flex items-center justify-between">
            <h3 class="text-lg font-black text-text-primary uppercase tracking-widest">
              {{ showCreateModal ? locale.create : locale.edit }}
            </h3>
            <button
              class="text-text-tertiary hover:text-text-primary transition-colors"
              :aria-label="t('admin.apiKeys.actions.close', '关闭弹窗')"
              @click="closeModals"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5"
                >{{ locale.name }}</label
              >
              <input
                v-model="form.name"
                type="text"
                :placeholder="locale.namePlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary placeholder:text-text-primary"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5"
                >{{ locale.description }}</label
              >
              <textarea
                v-model="form.description"
                :placeholder="locale.descriptionPlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary min-h-[80px] resize-none placeholder:text-text-primary"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5"
                >{{ locale.expiresAt }}</label
              >
              <CustomSelect
                v-model="expiresAtText"
                :options="expiresAtOptions"
                class-name="w-full"
                @change="handleExpiresAtChange"
              />
            </div>
            <div class="space-y-3">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5"
                >{{ locale.permissionSettings }}</label
              >
              <div class="grid grid-cols-2 gap-2">
                <label
                  v-for="perm in availablePermissions"
                  :key="perm.value"
                  class="flex items-start gap-3 p-3 bg-bg-primary border border-border-secondary rounded-xl cursor-pointer hover:border-border-tertiary transition-all"
                  :class="{
                    'border-primary-30 bg-primary-5': form.permissions.includes(perm.value)
                  }"
                >
                  <input
                    v-model="form.permissions"
                    type="checkbox"
                    :value="perm.value"
                    class="mt-1 w-3.5 h-3.5 rounded border-border-secondary bg-bg-secondary"
                  >
                  <div>
                    <p
                      class="text-xs font-bold"
                      :class="
                        form.permissions.includes(perm.value) ? 'text-primary' : 'text-text-secondary'
                      "
                    >
                      {{ perm.label }}
                    </p>
                    <p class="text-[9px] text-text-disabled mt-0.5">{{ perm.description }}</p>
                  </div>
                </label>
              </div>
            </div>
            <label
              v-if="showEditModal"
              class="flex items-center gap-2 p-3 bg-primary-hover-5 border border-primary-10 rounded-xl cursor-pointer group"
            >
              <input
                v-model="form.isActive"
                type="checkbox"
                class="w-3.5 h-3.5 rounded border-border-secondary bg-bg-secondary"
              >
              <span
                class="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors"
                >{{ locale.enabled }}</span
              >
            </label>

            <!-- 高级选项：所有者 / 速率限制 / 配额 / IP 白名单 / Webhook -->
            <div class="space-y-3 pt-2 border-t border-border-secondary">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                {{ t('admin.apiKeys.advancedOptions', '高级选项') }}
              </label>
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                    {{ t('admin.apiKeys.ownerType', '所有者类型') }}
                  </label>
                  <CustomSelect
                    v-model="form.ownerType"
                    :options="[
                      { label: t('admin.apiKeys.ownerSystem', '系统'), value: 'system' },
                      { label: t('admin.apiKeys.ownerUser', '用户'), value: 'user' },
                      { label: t('admin.apiKeys.ownerIntegration', '集成'), value: 'integration' }
                    ]"
                    class-name="w-full"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                    {{ t('admin.apiKeys.rateLimitPerMinute', '每分钟速率限制') }}
                  </label>
                  <input
                    v-model.number="form.rateLimitPerMinute"
                    type="number"
                    min="1"
                    :placeholder="t('admin.apiKeys.unlimited', '不限')"
                    class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary"
                  >
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                    {{ t('admin.apiKeys.quotaDaily', '日配额') }}
                  </label>
                  <input
                    v-model.number="form.quotaDaily"
                    type="number"
                    min="1"
                    :placeholder="t('admin.apiKeys.unlimited', '不限')"
                    class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary"
                  >
                </div>
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                    {{ t('admin.apiKeys.quotaMonthly', '月配额') }}
                  </label>
                  <input
                    v-model.number="form.quotaMonthly"
                    type="number"
                    min="1"
                    :placeholder="t('admin.apiKeys.unlimited', '不限')"
                    class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary"
                  >
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                  {{ t('admin.apiKeys.ipWhitelist', 'IP 白名单（每行一项，IP 或 CIDR）') }}
                </label>
                <textarea
                  v-model="form.ipWhitelist"
                  rows="2"
                  :placeholder="t('admin.apiKeys.ipWhitelistPlaceholder', '留空表示不限制\n192.168.1.0/24')"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary min-h-[60px] resize-none placeholder:text-text-primary"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5">
                  {{ t('admin.apiKeys.webhookUrl', 'Webhook URL') }}
                </label>
                <input
                  v-model="form.webhookUrl"
                  type="url"
                  :placeholder="t('admin.apiKeys.webhookUrlPlaceholder', 'https://example.com/webhook')"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary-30 text-text-primary"
                >
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-border-secondary flex gap-2 justify-end">
            <button
              class="px-4 py-2 text-xs font-bold text-text-tertiary hover:text-text-secondary"
              @click="closeModals"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="submitting"
              class="px-6 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] disabled:opacity-50 transition-all"
              @click="showCreateModal ? createApiKey() : updateApiKey()"
            >
              {{ submitting ? locale.saving : showCreateModal ? locale.createKey : locale.saveChanges }}
            </button>
          </div>
        </div>

        <!-- 成功模态框 -->
        <div
          v-if="showSuccessModal"
          class="relative w-full max-w-lg bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div class="p-6 border-b border-border-secondary flex items-center justify-between">
            <h3 class="text-lg font-black text-text-primary uppercase tracking-widest">
              {{ locale.createSuccessTitle }}
            </h3>
            <button
              class="text-text-tertiary hover:text-text-primary transition-colors"
              :aria-label="t('admin.apiKeys.actions.close', '关闭弹窗')"
              @click="closeModals"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-6">
            <div
              class="p-6 bg-success-10 border border-success-20 rounded-2xl flex flex-col items-center text-center"
            >
              <div
                class="w-12 h-12 rounded-full bg-success text-text-primary flex items-center justify-center mb-4 shadow-lg shadow-[var(--success-glow-20)]"
              >
                <Check :size="24" :stroke-width="3" />
              </div>
              <h4 class="text-lg font-black text-success">{{ locale.createSuccessHeading }}</h4>
              <p class="text-xs text-text-tertiary mt-2">{{ locale.createSuccessDesc }}</p>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-0.5"
                >{{ locale.fullKey }}</label
              >
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 font-mono text-xs text-primary break-all select-all"
                >
                  {{ newApiKey?.apiKey }}
                </div>
                <button
                  class="p-3 rounded-xl transition-all"
                  :class="
                    copied
                      ? 'bg-success text-text-primary'
                      : 'bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary'
                  "
                  :aria-label="copied ? t('admin.apiKeys.actions.copied', '已复制') : t('admin.apiKeys.actions.copy', '复制 API Key')"
                  @click="copyToClipboard(newApiKey?.apiKey)"
                >
                  <Check v-if="copied" :size="16" />
                  <Copy v-else :size="16" />
                </button>
              </div>
              <div
                class="flex items-center gap-2 p-3 bg-warning-10 border border-warning-20 rounded-xl text-warning"
              >
                <AlertTriangle :size="14" class="shrink-0" />
                <p class="text-[10px] font-bold">
                  {{ locale.copyWarning }}
                </p>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-border-secondary">
            <button
              class="w-full py-2.5 bg-bg-primary border border-border-secondary hover:border-border-tertiary text-text-primary text-xs font-black rounded-xl transition-all"
              @click="closeModals"
            >
              {{ locale.closeSaved }}
            </button>
          </div>
        </div>

        <!-- 详情模态框 -->
        <div
          v-if="showViewModal && selectedApiKey"
          class="relative w-full max-w-2xl bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div class="p-6 border-b border-border-secondary flex items-center justify-between">
            <h3 class="text-lg font-black text-text-primary uppercase tracking-widest">{{ locale.details }}</h3>
            <button
              class="text-text-tertiary hover:text-text-primary transition-colors"
              :aria-label="t('admin.apiKeys.actions.close', '关闭弹窗')"
              @click="closeModals"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <section class="space-y-4">
              <h5
                class="text-[10px] font-black text-text-disabled uppercase tracking-widest border-b border-border-secondary pb-2"
              >
                {{ locale.basicInfo }}
              </h5>
              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-1">
                  <span class="text-[10px] text-text-disabled font-bold">{{ locale.nameField }}</span>
                  <p class="text-xs font-bold text-text-primary">{{ selectedApiKey.name }}</p>
                </div>
                <div class="space-y-1">
                  <span class="text-[10px] text-text-disabled font-bold">{{ locale.statusField }}</span>
                  <div>
                    <span
                      v-if="selectedApiKey.status === 'active'"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-success-10 text-success text-[10px] font-black rounded uppercase border border-success-20"
                      >{{ locale.active }}</span
                    >
                    <span
                      v-else-if="selectedApiKey.status === 'inactive'"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-bg-tertiary text-text-tertiary text-[10px] font-black rounded uppercase border border-border-tertiary-50"
                      >{{ locale.inactive }}</span
                    >
                    <span
                      v-else-if="selectedApiKey.status === 'expired'"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-error-10 text-error text-[10px] font-black rounded uppercase border border-error-20"
                      >{{ locale.expired }}</span
                    >
                  </div>
                </div>
                <div class="col-span-2 space-y-1">
                  <span class="text-[10px] text-text-disabled font-bold">{{ locale.descField }}</span>
                  <p class="text-xs font-bold text-text-tertiary leading-relaxed">
                    {{ selectedApiKey.description || locale.noDescription }}
                  </p>
                </div>
                <div class="space-y-1">
                  <span class="text-[10px] text-text-disabled font-bold">{{ locale.creatorField }}</span>
                  <p class="text-xs font-bold text-text-primary">
                    {{ selectedApiKey.creatorName || locale.unknown }}
                  </p>
                </div>
                <div class="space-y-1">
                  <span class="text-[10px] text-text-disabled font-bold">{{ locale.createdAtField }}</span>
                  <p class="text-xs font-bold text-text-primary">
                    {{ formatDate(selectedApiKey.createdAt) }}
                  </p>
                </div>
                <div v-if="selectedApiKey.expiresAt" class="space-y-1">
                  <span class="text-[10px] text-text-disabled font-bold">{{ locale.expiresAtField }}</span>
                  <p
                    class="text-xs font-bold"
                    :class="selectedApiKey.isExpired ? 'text-error' : 'text-text-primary'"
                  >
                    {{ formatDate(selectedApiKey.expiresAt) }}
                  </p>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <h5
                class="text-[10px] font-black text-text-disabled uppercase tracking-widest border-b border-border-secondary pb-2"
              >
                {{ locale.usageStats }}
              </h5>
              <div class="grid grid-cols-2 gap-4">
                <div
                  class="p-4 bg-bg-primary border border-border-secondary rounded-2xl flex items-center justify-between group hover:border-primary-30 transition-all"
                >
                  <div class="space-y-0.5">
                    <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
                      >{{ locale.totalCalls }}</span
                    >
                    <p class="text-xl font-black text-text-primary">
                      {{ selectedApiKey.usageCount || 0 }}
                    </p>
                  </div>
                  <div
                    class="p-2 bg-primary-10 rounded-xl text-primary group-hover:scale-110 transition-transform flex items-center justify-center"
                  >
                    <BarChart :size="20" />
                  </div>
                </div>
                <div
                  class="p-4 bg-bg-primary border border-border-secondary rounded-2xl flex items-center justify-between group hover:border-warning-30 transition-all"
                >
                  <div class="space-y-0.5">
                    <span class="text-[9px] font-black text-text-disabled uppercase tracking-widest"
                      >{{ locale.lastUsedAt }}</span
                    >
                    <p class="text-xs font-bold text-text-primary">
                      {{
                        selectedApiKey.lastUsedAt
                          ? formatDate(selectedApiKey.lastUsedAt)
                          : locale.neverChecked
                      }}
                    </p>
                  </div>
                  <div
                    class="p-2 bg-warning-10 rounded-xl text-warning group-hover:scale-110 transition-transform flex items-center justify-center"
                  >
                    <Clock :size="20" />
                  </div>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <div class="flex items-center justify-between border-b border-border-secondary pb-2">
                <h5 class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
                  {{ locale.recentLogs }}
                </h5>
                <Pagination
                  v-model:current-page="logsPagination.page"
                  :total-pages="logsPagination.totalPages"
                  @change="loadApiLogs"
                />
              </div>

              <div class="space-y-2">
                <div
                  v-if="loadingLogs"
                  class="flex flex-col items-center justify-center py-10 text-text-disabled gap-2"
                >
                  <RefreshCw :size="24" class="animate-spin" />
                  <span class="text-[10px] font-bold">{{ locale.loadingLogs }}</span>
                </div>
                <div
                  v-else-if="apiLogs.length === 0"
                  class="flex flex-col items-center justify-center py-10 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl"
                >
                  <History :size="24" class="text-text-primary mb-2" />
                  <span class="text-[10px] font-bold text-text-secondary uppercase tracking-widest"
                    >{{ locale.noLogs }}</span
                  >
                </div>
                <div
                  v-for="log in apiLogs"
                  v-else
                  :key="log.id"
                  class="p-3 bg-bg-primary border border-border-secondary-40 rounded-xl flex items-center justify-between group hover:border-border-tertiary transition-all"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border"
                      :class="getMethodClass(log.method)"
                    >
                      {{ log.method }}
                    </div>
                    <div class="space-y-0.5">
                      <p class="text-xs font-mono text-text-tertiary">{{ log.endpoint }}</p>
                      <div class="flex items-center gap-2 text-[9px] font-bold text-text-disabled">
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
                      <p class="text-[9px] font-bold text-text-disabled">{{ log.responseTimeMs }}ms</p>
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
} from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useAuth } from '~/composables/useAuth'
import { useRbac } from '~/composables/useRbac'
import { PERMISSIONS } from '~/utils/rbac'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'

const { admin, currentLocale } = useLocale()
const locale = computed(() => useSafeLocale(admin.value?.apiKeys || {}))
const { msg: getLocaleText } = useLocaleText(locale)

// 路径式 i18n 查找：t('admin.apiKeys.actions.view', '查看') → 先按 'a.b.c' 拆段在 admin.value 上回退定位，
// 命中返回 string，未命中返回 fallback。集中兜底避免模板里散落的 `|| '中文'` 字面量。
const t = (key: string, fallback: string): string => {
  if (!key) return fallback
  let cursor: unknown = admin.value
  for (const segment of key.split('.')) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment]
      continue
    }
    return fallback
  }
  return typeof cursor === 'string' ? cursor : fallback
}
const expiresOptionFallbacks = {
  never: '永不过期',
  threeDays: '3天后过期',
  sevenDays: '7天后过期',
  thirtyDays: '30天后过期',
  sixtyDays: '60天后过期',
  ninetyDays: '90天后过期'
}
const getExpiresOptionText = (key) =>
  formatLocaleValue(locale.value?.expiresOptions?.[key]) || expiresOptionFallbacks[key] || key
const getPermissionOptionText = (key, field) => formatLocaleValue(locale.value?.permissionOptions?.[key]?.[field])
const getDeleteTitle = (name) => getLocaleText('deleteMessage', name)

// 过期时间预设：单一数据源
// - key 稳定（永不随 i18n 文案变化），用于 form.expiresAt 和 CustomSelect 的 value
// - days 为 null 表示永不过期，数值则由 handleExpiresAtChange 写入对应的 ISO 时间
// - labelKey 用于 i18n 解析（locale.expiresOptions[key]）
// - 'keep' 是编辑态的特殊值：不更改原有过期时间，由 expiresAtOptions 在编辑模式下动态插入
const EXPIRES_PRESETS = [
  { key: 'never', days: null, labelKey: 'never' },
  { key: '3d',    days: 3,    labelKey: 'threeDays' },
  { key: '7d',    days: 7,    labelKey: 'sevenDays' },
  { key: '30d',   days: 30,   labelKey: 'thirtyDays' },
  { key: '60d',   days: 60,   labelKey: 'sixtyDays' },
  { key: '90d',   days: 90,   labelKey: 'ninetyDays' }
]
const PRESET_BY_KEY = Object.fromEntries(EXPIRES_PRESETS.map((p) => [p.key, p]))
const getPresetLabel = (key) => {
  const preset = PRESET_BY_KEY[key]
  return preset ? getExpiresOptionText(preset.labelKey) : key
}

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
const loadingEditId = ref(null)
const loadingViewId = ref(null)

// 文本映射
// expiresAtText 持有稳定 key（never/3d/7d/30d/60d/90d/keep），由 CustomSelect 直接使用
// 渲染时通过 expiresAtOptions 的 label 字段查 i18n，文本变更不影响功能
const expiresAtText = ref('never')
const formatExpiresAtText = (dateText) => getLocaleText('expiresAtText', dateText)
const expiresAtOptions = computed(() => {
  const options = EXPIRES_PRESETS.map((p) => ({ value: p.key, label: getPresetLabel(p.key) }))
  // 编辑态且原有过期时间：把 'keep' 放在最前，label 用原日期，保留原 UX
  if (form.expiresAt === 'keep' && selectedApiKey.value?.expiresAt) {
    const date = new Date(selectedApiKey.value.expiresAt)
    const dateLabel = formatExpiresAtText(date.toLocaleDateString(currentLocale.value))
    return [{ value: 'keep', label: dateLabel }, ...options]
  }
  return options
})
const statusFilterOptions = computed(() => [
  { label: getLocaleText('allStatus'), value: '' },
  { label: getLocaleText('active'), value: 'active' },
  { label: getLocaleText('inactive'), value: 'inactive' },
  { label: getLocaleText('expired'), value: 'expired' }
])

const logsPagination = ref({
  page: 1,
  limit: 5,
  total: 0,
  totalPages: 0
})

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref({
  title: getLocaleText('confirmDeleteTitle'),
  message: '',
  type: 'danger',
  confirmText: getLocaleText('delete'),
  cancelText: getLocaleText('cancel')
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
  isActive: true,
  ownerType: 'system',
  ownerId: null,
  rateLimitPerMinute: null,
  quotaDaily: null,
  quotaMonthly: null,
  ipWhitelist: '',
  webhookUrl: ''
})

// 同步 form.expiresAt 到 v-model 的 key
// - 'keep' 编辑态原样保留
// - '' 或空 映射为 'never'
// - 其他 key 直接同步
const getExpiresAtKey = () => {
  if (form.expiresAt === 'keep') return 'keep'
  if (!form.expiresAt) return 'never'
  return form.expiresAt
}

watch(
  () => form.expiresAt,
  () => {
    expiresAtText.value = getExpiresAtKey()
  },
  { immediate: true }
)

// 可用权限列表
const availablePermissions = computed(() => [
  {
    value: 'schedules:read',
    label: getPermissionOptionText('scheduleRead', 'label'),
    description: getPermissionOptionText('scheduleRead', 'description')
  },
  {
    value: 'songs:read',
    label: getPermissionOptionText('songsRead', 'label'),
    description: getPermissionOptionText('songsRead', 'description')
  },
  {
    value: 'songs:request',
    label: getPermissionOptionText('songsRequest', 'label'),
    description: getPermissionOptionText('songsRequest', 'description')
  },
  {
    value: 'songs:write',
    label: getPermissionOptionText('songsWrite', 'label'),
    description: getPermissionOptionText('songsWrite', 'description')
  },
  {
    value: 'card-codes:read',
    label: getPermissionOptionText('cardCodesRead', 'label'),
    description: getPermissionOptionText('cardCodesRead', 'description')
  },
  {
    value: 'card-codes:write',
    label: getPermissionOptionText('cardCodesWrite', 'label'),
    description: getPermissionOptionText('cardCodesWrite', 'description')
  },
  {
    value: 'card-codes:delete',
    label: getPermissionOptionText('cardCodesDelete', 'label'),
    description: getPermissionOptionText('cardCodesDelete', 'description')
  },
  {
    value: 'backup:execute',
    label: getPermissionOptionText('backupExecute', 'label'),
    description: getPermissionOptionText('backupExecute', 'description')
  }
])

// Toast通知
const toast = useToast()
const auth = useAuth()
const rbac = useRbac()
const rbacUserId = computed(() => auth.user.value?.id)
watch(
  rbacUserId,
  (id) => {
    rbac.bind(id)
  },
  { immediate: true }
)

// 方法
// CustomSelect emit 的 value 已是稳定 key（never/3d/7d/30d/60d/90d/keep）
// 'never' 表示永不过期，form.expiresAt 存空串；其他 key 直接透传
const handleExpiresAtChange = (key) => {
  if (key === 'never') {
    form.expiresAt = ''
  } else {
    form.expiresAt = key
  }
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
    toast.error(getLocaleText('loadFailed'))
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  resetForm()
  showCreateModal.value = true
}

const createApiKey = async () => {
  if (!form.name) return toast.error(getLocaleText('nameRequired'))
  if (form.permissions.length === 0) return toast.error(getLocaleText('permissionRequired'))

  submitting.value = true
  try {
    const ipWhitelistArray = form.ipWhitelist
      ? form.ipWhitelist.split('\n').map((s) => s.trim()).filter(Boolean)
      : null
    const data = {
      name: form.name,
      description: form.description || null,
      expiresAt: form.expiresAt || null,
      permissions: form.permissions,
      isActive: true,
      ownerType: form.ownerType,
      ownerId: form.ownerId || null,
      rateLimitPerMinute: form.rateLimitPerMinute || null,
      quotaDaily: form.quotaDaily || null,
      quotaMonthly: form.quotaMonthly || null,
      ipWhitelist: ipWhitelistArray,
      webhookUrl: form.webhookUrl || null
    }

    const response = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: data
    })

    if (response.success) {
      toast.success(getLocaleText('createSuccessTitle'))
      newApiKey.value = response.data
      showCreateModal.value = false
      showSuccessModal.value = true
      resetForm()
      await loadApiKeys()
    }
  } catch (error) {
    console.error('创建API密钥失败:', error)
    toast.error(getErrorMessage(error) || getLocaleText('createFailed'))
  } finally {
    submitting.value = false
  }
}

const updateApiKey = async () => {
  if (!selectedApiKey.value) return
  if (!form.name) return toast.error(getLocaleText('nameRequired'))
  if (form.permissions.length === 0) return toast.error(getLocaleText('permissionRequired'))

  submitting.value = true
  try {
    const ipWhitelistArray = form.ipWhitelist
      ? form.ipWhitelist.split('\n').map((s) => s.trim()).filter(Boolean)
      : null
    const data = {
      name: form.name,
      description: form.description || null,
      // 如果是 'keep'，则不发送 expiresAt 字段，后端将不更新该字段
      ...(form.expiresAt !== 'keep' && { expiresAt: form.expiresAt || null }),
      permissions: form.permissions,
      isActive: form.isActive,
      ownerType: form.ownerType,
      ownerId: form.ownerId || null,
      rateLimitPerMinute: form.rateLimitPerMinute || null,
      quotaDaily: form.quotaDaily || null,
      quotaMonthly: form.quotaMonthly || null,
      ipWhitelist: ipWhitelistArray,
      webhookUrl: form.webhookUrl || null
    }

    const response = await $fetch(`/api/admin/api-keys/${selectedApiKey.value.id}`, {
      method: 'PUT',
      body: data
    })

    if (response.success) {
      toast.success(getLocaleText('updateSuccess'))
      closeModals()
      await loadApiKeys()
    }
  } catch (error) {
    console.error('更新API密钥失败:', error)
    toast.error(getErrorMessage(error) || getLocaleText('updateFailed'))
  } finally {
    submitting.value = false
  }
}

const deleteApiKey = (apiKey) => {
  pendingDeleteApiKey.value = apiKey
  confirmDialogConfig.value = {
    title: getLocaleText('confirmDeleteTitle'),
    message: getDeleteTitle(apiKey.name),
    type: 'danger',
    confirmText: getLocaleText('delete'),
    cancelText: getLocaleText('cancel')
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
      toast.success(getLocaleText('deleteSuccess'))
      await loadApiKeys()
    }
  } catch (error) {
    console.error('删除API密钥失败:', error)
    toast.error(getErrorMessage(error) || getLocaleText('deleteFailed'))
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
  if (loadingViewId.value !== null || loadingEditId.value !== null) return
  loadingViewId.value = apiKey.id
  try {
    const response = await $fetch(`/api/admin/api-keys/${apiKey.id}`)
    if (response.success) {
      selectedApiKey.value = response.data
      showViewModal.value = true
      await loadApiLogs(1)
    }
  } catch (error) {
    console.error('获取API密钥详情失败:', error)
    toast.error(getLocaleText('detailFailed'))
  } finally {
    loadingViewId.value = null
  }
}

const editApiKey = async (apiKey) => {
  if (loadingEditId.value !== null || loadingViewId.value !== null) return
  loadingEditId.value = apiKey.id
  try {
    const response = await $fetch(`/api/admin/api-keys/${apiKey.id}`)
    if (response.success) {
      selectedApiKey.value = response.data

      form.name = response.data.name
      form.description = response.data.description || ''

      if (response.data.expiresAt) {
        // 编辑态：保留原过期时间，form.expiresAt 标 'keep'，expiresAtOptions 会自动插入 keep 选项
        form.expiresAt = 'keep'
      } else {
        form.expiresAt = ''
      }

      form.permissions = response.data.permissions || []
      form.isActive = response.data.isActive

      showEditModal.value = true
    }
  } catch (error) {
    console.error('获取API密钥详情失败:', error)
    toast.error(getLocaleText('detailFailed'))
  } finally {
    loadingEditId.value = null
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
    toast.error(getLocaleText('logsFailed'))
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

const handleBackdropClick = () => {
  if (showCreateModal.value || showEditModal.value) {
    return
  }
  closeModals()
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.expiresAt = ''
  form.permissions = []
  form.isActive = true
  form.ownerType = 'system'
  form.ownerId = null
  form.rateLimitPerMinute = null
  form.quotaDaily = null
  form.quotaMonthly = null
  form.ipWhitelist = ''
  form.webhookUrl = ''
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(currentLocale.value, {
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
    toast.success(getLocaleText('copied'))
    setTimeout(() => (copied.value = false), 2000)
  } catch (error) {
    console.error('复制失败:', error)
    toast.error(getLocaleText('copyFailed'))
  }
}

const getMethodClass = (method) => {
  const map = {
    GET: 'bg-success-10 text-success border-success-20',
    POST: 'bg-primary-10 text-primary border-primary-20',
    PUT: 'bg-warning-10 text-warning border-warning-20',
    DELETE: 'bg-error-10 text-error border-error-20'
  }
  return map[method] || 'bg-bg-quaternary-10 text-text-tertiary border-border-tertiary-20'
}

const getStatusColorClass = (code) => {
  if (code >= 200 && code < 300) return 'text-success'
  if (code >= 300 && code < 400) return 'text-warning'
  return 'text-error'
}

// 生命周期
onMounted(() => {
  loadApiKeys()
})
</script>

<style scoped>

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
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
