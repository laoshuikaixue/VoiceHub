<template>
  <div class="max-w-[1400px] mx-auto space-y-8 pb-20 px-2">
    <!-- 顶部标题和全局开关 -->
    <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
      <div class="space-y-1">
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary">{{ locale.desc }}</p>
      </div>

      <div
        class="flex flex-wrap items-center gap-4 bg-bg-secondary-40 border border-border-secondary p-2 rounded-3xl"
      >
        <div class="flex items-center gap-3 px-3 border-r border-border-secondary-50 mr-1">
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
            >{{ locale.currentStatus }}</span
          >
          <span
            :class="[
              'px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all',
              hitRequestTime ? 'bg-success-10 text-success' : 'bg-error-10 text-error'
            ]"
          >
            {{ hitRequestTime ? locale.open : locale.closed }}
          </span>
        </div>

        <div class="flex items-center gap-3 px-2">
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
            >{{ locale.enableRequest }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enableRequest ? 'bg-primary-hover' : 'bg-bg-tertiary'
            ]"
            @click="toggleGlobalRequest"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                enableRequest ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>

        <div class="flex items-center gap-3 px-2 border-l border-border-secondary-50">
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
            >{{ locale.enableTimeLimit }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enableRequestTimeLimitation ? 'bg-primary-hover' : 'bg-bg-tertiary'
            ]"
            @click="toggleTimeLimitation"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                enableRequestTimeLimitation ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
        <div class="flex items-center gap-3 px-2 border-l border-border-secondary-50">
          <span class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
            >{{ locale.enableRestriction }}</span
          >
          <button
            :class="[
              'relative w-10 h-5 rounded-full transition-colors',
              enableSubmissionRestriction ? 'bg-primary-hover' : 'bg-bg-tertiary'
            ]"
            @click="toggleRestriction"
          >
            <div
              :class="[
                'absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all',
                enableSubmissionRestriction ? 'left-6' : 'left-1'
              ]"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- 全局错误提示 -->
    <div
      v-if="error"
      class="p-4 bg-error-10 border border-error-20 rounded-2xl flex items-center gap-3 text-error text-xs font-bold"
    >
      <AlertCircle :size="16" />
      <span @click="error = ''" class="cursor-pointer hover:underline">{{ error }}</span>
    </div>

    <!-- 主要内容区域 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- 添加时段按钮卡片 -->
      <button
        class="group relative h-full min-h-[220px] bg-bg-secondary-20 border-2 border-dashed border-border-secondary rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-primary-hover-5 hover:border-primary-40 transition-all active:scale-95"
        @click="showAddForm = true"
      >
        <div
          class="w-14 h-14 rounded-full bg-bg-secondary border border-border-secondary flex items-center justify-center text-text-tertiary group-hover:text-primary group-hover:bg-primary-hover-10 group-hover:border-primary-20 transition-all"
        >
          <Plus :size="28" />
        </div>
        <div class="text-center">
          <h4
            class="text-sm font-black text-text-tertiary group-hover:text-primary transition-colors uppercase tracking-widest"
          >
            {{ locale.addTime }}
          </h4>
          <p class="text-[10px] text-text-disabled mt-1">{{ locale.addTimeDesc }}</p>
        </div>
      </button>

      <!-- 时段列表 -->
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="slot in requestTimes"
          :key="slot.id"
          :class="[
            'group bg-bg-secondary-40 border rounded-3xl p-8 space-y-6 transition-all hover:shadow-2xl hover:shadow-[0_25px_50px_var(--shadow-color-deep)]',
            slot.enabled && !slot.past ? 'border-border-secondary' : 'border-border-secondary-40 opacity-60'
          ]"
        >
          <div class="flex items-start justify-between">
            <div
              :class="[
                'p-3.5 rounded-2xl bg-bg-primary border border-border-secondary text-text-tertiary transition-colors flex items-center justify-center',
                slot.enabled && !slot.past
                  ? 'text-primary border-primary-20 shadow-lg shadow-[var(--primary-glow-10)]'
                  : ''
              ]"
            >
              <Calendar :size="22" />
            </div>
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all',
                  slot.past
                    ? 'bg-error-10 text-error border-error-20'
                    : slot.enabled
                      ? 'bg-success-10 text-success border-success-20'
                      : 'bg-bg-tertiary-50 text-text-disabled border-border-tertiary-50'
                ]"
              >
                {{ slot.past ? locale.expired : slot.enabled ? locale.enabled : locale.disabled }}
              </span>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <h4
                class="text-lg font-black text-text-primary flex items-baseline gap-2 group-hover:text-primary transition-colors"
              >
                {{ slot.name }}
                <span class="text-xs font-bold text-text-disabled tracking-tight"
                  >({{ slot.accepted }}/{{ slot.expected || '∞' }})</span
                >
              </h4>
              <div class="mt-3 space-y-2">
                <div class="flex items-center gap-2 text-text-tertiary font-bold">
                  <Clock :size="12" class="text-text-secondary" />
                  <span class="text-[10px] uppercase tracking-tighter truncate">{{
                    slot.startTime || locale.unlimited
                  }}</span>
                </div>
                <div class="flex items-center gap-2 text-text-tertiary font-bold">
                  <div class="w-3 h-[2px] bg-bg-tertiary ml-1.5" />
                  <span class="text-[10px] uppercase tracking-tighter truncate">{{
                    slot.endTime || locale.unlimited
                  }}</span>
                </div>
              </div>
            </div>

            <p
              class="text-xs text-text-tertiary font-medium leading-relaxed min-h-[32px] line-clamp-2 italic"
            >
              {{ slot.description || locale.noDescription }}
            </p>

            <!-- 投稿进度条 -->
            <div class="space-y-1.5">
              <div
                class="flex justify-between text-[9px] font-black text-text-disabled uppercase tracking-widest px-0.5"
              >
                <span>{{ locale.progress }}</span>
                <span
                  >{{
                    slot.expected > 0
                      ? Math.min(100, Math.round((slot.accepted / slot.expected) * 100))
                      : 0
                  }}%</span
                >
              </div>
              <div
                class="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden border border-border-secondary-50"
              >
                <div
                  class="h-full transition-all duration-500"
                  :style="{
                    width: `${slot.expected > 0 ? Math.min(100, (slot.accepted / slot.expected) * 100) : 0}%`
                  }"
                  :class="
                    slot.expected > 0 && slot.accepted >= slot.expected
                      ? 'bg-error'
                      : 'bg-primary'
                  "
                />
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-border-secondary-50 flex items-center justify-between">
            <div class="flex gap-2">
              <button
                v-show="!slot.past"
                class="p-2.5 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-primary hover:border-primary-30 transition-all"
                @click="editRequestTime(slot)"
              >
                <Edit2 :size="14" />
              </button>
              <button
                class="p-2.5 bg-bg-primary border border-border-secondary rounded-xl text-text-tertiary hover:text-error hover:border-error-30 transition-all"
                @click="confirmDelete(slot)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
            <button
              v-show="!slot.past"
              :class="[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                slot.enabled
                  ? 'bg-bg-tertiary text-text-tertiary hover:text-text-primary'
                  : 'bg-success text-text-primary shadow-lg shadow-[var(--success-glow-20)]'
              ]"
              @click="toggleRequestTimeStatus(slot)"
            >
              <Power :size="12" />
              {{ slot.enabled ? locale.disable : locale.enable }}
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- 统计概览 -->
    <div
      class="bg-bg-secondary-20 border border-border-secondary rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
    >
      <div v-for="(stat, i) in stats" :key="i" class="flex items-center gap-4 group">
        <div
          :class="[
            'w-12 h-12 rounded-2xl bg-bg-primary border border-border-secondary flex items-center justify-center text-text-tertiary transition-colors',
            stat.color === 'blue'
              ? 'group-hover:text-primary'
              : stat.color === 'emerald'
                ? 'group-hover:text-success'
                : stat.color === 'amber'
                  ? 'group-hover:text-warning'
                  : 'group-hover:text-info'
          ]"
        >
          <component :is="stat.icon" :size="20" />
        </div>
        <div>
          <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
            {{ stat.label }}
          </p>
          <h5 class="text-xl font-black text-text-primary">{{ stat.value }}</h5>
        </div>
      </div>
    </div>

    <!-- 重复投稿限制面板 -->
    <div
      v-if="isAdmin"
      class="bg-bg-secondary-20 border border-border-secondary rounded-3xl p-8 space-y-6"
    >
      <div class="flex items-center justify-between border-b border-border-secondary-50 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-warning-10 border border-warning-20 flex items-center justify-center text-warning">
            <Ban :size="20" />
          </div>
          <div>
            <h4 class="text-sm font-black text-text-primary uppercase tracking-widest">
              {{ locale.restrictionPanelTitle }}
            </h4>
            <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.restrictionPanelDesc }}</p>
          </div>
        </div>
        <button
          :disabled="restrictionSaving"
          class="flex items-center gap-2 px-5 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveRestrictionSettings"
        >
          <Save :size="14" />
          {{ locale.saveSettings }}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1 space-y-4">
          <label :class="['text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2']">
            {{ locale.restrictionScope }}
          </label>
          <p class="text-[10px] text-text-tertiary px-1">{{ locale.restrictionScopeDesc }}</p>
          <div class="flex gap-2 p-1 bg-bg-primary border border-border-secondary rounded-xl">
            <button
              :class="[
                'flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                submissionRestrictionScope === 'self'
                  ? 'bg-bg-tertiary text-primary shadow-sm'
                  : 'text-text-disabled hover:text-text-tertiary'
              ]"
              @click="submissionRestrictionScope = 'self'"
            >
              {{ locale.restrictionScopeSelf }}
            </button>
            <button
              :class="[
                'flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                submissionRestrictionScope === 'all'
                  ? 'bg-bg-tertiary text-primary shadow-sm'
                  : 'text-text-disabled hover:text-text-tertiary'
              ]"
              @click="submissionRestrictionScope = 'all'"
            >
              {{ locale.restrictionScopeAll }}
            </button>
          </div>
          <p class="text-[10px] text-text-disabled px-1 italic">{{ locale.restrictionPanelHint }}</p>
        </div>

        <div class="space-y-4">
          <label :class="['text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2']">
            {{ locale.sameSongRestrictionHours }}
          </label>
          <p class="text-[10px] text-text-tertiary px-1">{{ locale.sameSongRestrictionHoursDesc }}</p>
          <div class="relative">
            <input
              :value="sameSongRestrictionHours ?? ''"
              @input="sameSongRestrictionHours = $event.target.value === '' ? null : Number($event.target.value)"
              @blur="normalizeRestrictionHours('sameSong')"
              type="number"
              min="1"
              max="720"
              step="1"
              placeholder="-"
              class="w-56 bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3 text-sm text-text-primary pr-16 focus:outline-none focus:border-primary-30"
            />
            <span
              class="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-secondary uppercase"
              >{{ locale.restrictionUnit }}</span>
          </div>
        </div>

        <div class="space-y-4">
          <label :class="['text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2']">
            {{ locale.sameArtistRestrictionHours }}
          </label>
          <p class="text-[10px] text-text-tertiary px-1">{{ locale.sameArtistRestrictionHoursDesc }}</p>
          <div class="relative">
            <input
              :value="sameArtistRestrictionHours ?? ''"
              @input="sameArtistRestrictionHours = $event.target.value === '' ? null : Number($event.target.value)"
              @blur="normalizeRestrictionHours('sameArtist')"
              type="number"
              min="1"
              max="720"
              step="1"
              placeholder="-"
              class="w-56 bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3 text-sm text-text-primary pr-16 focus:outline-none focus:border-primary-30"
            />
            <span
              class="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-secondary uppercase"
              >{{ locale.restrictionUnit }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showAddForm || editingRequestTime"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      >
        <div
          class="w-full max-w-2xl bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden"
        >
          <div class="px-8 py-6 border-b border-border-secondary-50 flex items-center justify-between">
            <h3 class="text-xl font-black text-text-primary">
              {{ editingRequestTime ? locale.editTitle : locale.addTitle }}
            </h3>
            <button class="text-text-tertiary hover:text-text-secondary transition-colors" @click="cancelForm">
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
            <div class="space-y-2">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.name }}</label
              >
              <input
                v-model="formData.name"
                type="text"
                :placeholder="locale.namePlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
              >
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.startDateTime }}</label
                >
                <input
                  v-model="formData.startTime"
                  type="datetime-local"
                  class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.endDateTime }}</label
                >
                <input
                  v-model="formData.endTime"
                  type="datetime-local"
                  class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.expectedCount }}</label
                >
                <div class="relative group">
                  <input
                    v-model="formData.expected"
                    type="number"
                    class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-3.5 text-sm text-text-primary focus:outline-none focus:border-primary-30"
                  >
                  <div
                    class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-text-disabled font-bold text-[10px]"
                  >
                    <Hash :size="12" />
                    {{ locale.songUnit }}
                  </div>
                </div>
                <p class="text-[9px] text-text-disabled px-1">{{ locale.expectedHint }}</p>
              </div>
              <div class="space-y-2 flex flex-col justify-center pt-2">
                <label class="flex items-center gap-3 cursor-pointer group px-1">
                  <input
                    v-model="formData.enabled"
                    type="checkbox"
                    class="w-4.5 h-4.5 rounded-lg border-border-secondary bg-bg-primary"
                  >
                  <div>
                    <span
                      class="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors"
                      >{{ locale.enableThisRequestTime }}</span
                    >
                    <p class="text-[9px] text-text-disabled font-medium">
                      {{ locale.enableThisRequestTimeHint }}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.descriptionOptional }}</label
              >
              <textarea
                v-model="formData.description"
                :placeholder="locale.descriptionPlaceholder"
                class="w-full bg-bg-primary border border-border-secondary rounded-2xl px-5 py-4 text-sm text-text-primary focus:outline-none focus:border-primary-30 min-h-[100px] resize-none"
              />
            </div>

            <div
              v-if="formError"
              class="p-4 bg-error-10 border border-error-20 rounded-2xl flex items-center gap-3 text-error text-xs font-bold"
            >
              <AlertCircle :size="16" />
              {{ formError }}
            </div>
          </div>

          <div class="px-8 py-6 bg-bg-secondary-50 border-t border-border-secondary-50 flex gap-3 justify-end">
            <button
              class="px-6 py-2.5 text-xs font-bold text-text-tertiary hover:text-text-secondary"
              @click="cancelForm"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="formSubmitting"
              class="px-10 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
              @click="saveRequestTime"
            >
              {{ formSubmitting ? locale.saving : locale.saveSettings }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
        @click.self="showDeleteConfirm = false"
      >
        <div
          class="w-full max-w-md bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden p-8"
        >
          <div class="flex flex-col items-center space-y-6">
            <div
              class="w-16 h-16 rounded-[2rem] bg-error-10 text-error flex items-center justify-center border border-error-20 shadow-xl shadow-[var(--error-glow-10)]"
            >
              <Trash2 :size="28" />
            </div>
            <div class="text-center space-y-2 px-4">
              <h4 class="text-lg font-bold text-text-primary">
                {{ deleteConfirmTitleText }}
              </h4>
              <p class="text-xs text-text-tertiary leading-relaxed">
                {{ locale.deleteConfirmPrefix }}
                <span class="text-text-secondary font-bold">{{ locale.disable }}</span> {{ locale.deleteConfirmSuffix }}
              </p>
            </div>
            <div class="flex gap-3 w-full pt-4">
              <button
                class="flex-1 px-4 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-tertiary text-xs font-black rounded-2xl transition-all"
                @click="showDeleteConfirm = false"
              >
                {{ locale.keepTime }}
              </button>
              <button
                :disabled="deleteInProgress"
                class="flex-1 px-4 py-3 bg-error hover:bg-error text-text-primary text-xs font-black rounded-2xl shadow-xl shadow-[var(--error-glow-20)] transition-all active:scale-95 disabled:opacity-50"
                @click="deleteRequestTime"
              >
                {{ deleteInProgress ? locale.deleting : locale.confirmDelete }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 说明部分 -->
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-6 space-y-4">
        <h4
          class="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2"
        >
          <CheckCircle2 :size="14" class="text-success" /> {{ locale.priorityTitle }}
        </h4>
        <ul class="text-[11px] text-text-tertiary space-y-2 font-medium">
          <li class="flex gap-2">
            <span class="text-text-secondary font-black">1.</span>
            <span
              ><span class="text-text-secondary">{{ locale.globalSwitch }}</span>
              {{ locale.priorityGlobal }}</span
            >
          </li>
          <li class="flex gap-2">
            <span class="text-text-secondary font-black">2.</span>
            <span
              >{{ locale.priorityTimeLimitPrefix }} <span class="text-text-secondary">{{ locale.timeLimit }}</span> {{ locale.priorityTimeLimitMiddle }}
              <span class="text-text-secondary">{{ locale.enabled }}</span> {{ locale.priorityTimeLimitAnd }}
              <span class="text-text-secondary">{{ locale.expectedCountShort }}</span> {{ locale.priorityTimeLimitSuffix }}</span
            >
          </li>
          <li class="flex gap-2">
            <span class="text-text-secondary font-black">3.</span>
            <span>{{ locale.priorityNoLimit }}</span>
          </li>
        </ul>
      </div>

      <div class="flex-1 bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-6 space-y-4">
        <h4
          class="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2"
        >
          <XCircle :size="14" class="text-error" /> {{ locale.noticeTitle }}
        </h4>
        <ul class="text-[11px] text-text-tertiary space-y-2 font-medium">
          <li class="flex gap-2">
            <span class="text-text-secondary font-black">•</span>
            <span>{{ locale.noticeOverlap }}</span>
          </li>
          <li class="flex gap-2">
            <span class="text-text-secondary font-black">•</span>
            <span>{{ locale.noticeUnlimited }}</span>
          </li>
          <li class="flex gap-2">
            <span class="text-text-secondary font-black">•</span>
            <span>{{ locale.noticeExpired }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import type { RequestTime } from '~/types'
import {
  Plus,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Power,
  AlertCircle,
  Hash,
  Save,
  Ban,
  CheckCircle2,
  XCircle,
  X,
  BarChart3,
  Filter
} from '@lucide/vue'

const { getAuthConfig, isAdmin } = useAuth()
const toast = useToast()
const { admin } = useLocale()
const locale = computed(() => {
  const base = admin.value?.requestTimeManager || {}
  const emptyText = () => ''
  return useSafeLocale({
    ...base,
    errors: { ...(base.errors || {}) },
    stats: { ...(base.stats || {}) },
    deleteConfirmTitle: base.deleteConfirmTitle || emptyText
  })
})
const getErrorMessage = (key, ...args) => formatLocale(locale.value?.errors?.[key], ...args)

const requestTimes = ref<RequestTime[]>([])
const loading = ref(false)
const error = ref('')
const showAddForm = ref(false)
const editingRequestTime = ref<RequestTime | null>(null)
const RequestTimeToDelete = ref<RequestTime | null>(null)
const showDeleteConfirm = ref(false)
const formSubmitting = ref(false)
const deleteInProgress = ref(false)
const formError = ref('')
const deleteConfirmTitleText = computed(() =>
  formatLocale(locale.value?.deleteConfirmTitle, RequestTimeToDelete.value?.name || '')
)
const enableRequestTimeLimitation = ref(false)
const hitRequestTime = ref(false)
const enableRequest = ref(true)
const enableSubmissionRestriction = ref(false)
const submissionRestrictionScope = ref('all')
const sameSongRestrictionHours = ref<number | null>(null)
const sameArtistRestrictionHours = ref<number | null>(null)
const restrictionSaving = ref(false)

let refreshInterval: any = null

const formData = reactive({
  id: 0,
  name: '',
  startTime: '',
  endTime: '',
  description: '',
  enabled: true,
  expected: 0
})

// 统计数据
const stats = computed(() => {
  const activeSlots = requestTimes.value.filter((s) => s.enabled && !s.past)
  
  // 检查是否有不限容量的活跃时段
  const hasUnlimitedActiveSlot = activeSlots.some((s) => !s.expected || s.expected === 0)
  
  const totalExpectedActive = activeSlots.reduce((acc, s) => acc + (s.expected || 0), 0)
  const totalAcceptedActive = activeSlots.reduce((acc, s) => acc + s.accepted, 0)
  
  // 累计已接收可以统计所有的（包括过去的），也可以只统计活跃的。通常累计是历史总计，但也可以分历史和当前。
  // 原逻辑是统计所有 requestTimes 的 accepted。保持原逻辑。
  const totalAcceptedAll = requestTimes.value.reduce((acc, s) => acc + s.accepted, 0)

  return [
    {
      label: locale.value?.stats?.activeSlots || 'Active slots',
      value: activeSlots.length.toString(),
      icon: Clock,
      color: 'blue'
    },
    {
      label: locale.value?.stats?.totalAccepted || 'Total accepted',
      value: totalAcceptedAll.toString(),
      icon: BarChart3,
      color: 'emerald'
    },
    {
      label: locale.value?.stats?.totalCapacity || 'Total capacity',
      value: activeSlots.length === 0
        ? (locale.value?.none || 'None')
        : (hasUnlimitedActiveSlot ? (locale.value?.unlimited || 'Unlimited') : totalExpectedActive.toString()),
      icon: Hash,
      color: 'purple'
    },
    {
      label: locale.value?.stats?.remainingCapacity || 'Remaining capacity',
      value: activeSlots.length === 0 
        ? (locale.value?.none || 'None')
        : (hasUnlimitedActiveSlot 
            ? (locale.value?.unlimited || 'Unlimited')
            : Math.max(0, totalExpectedActive - totalAcceptedActive).toString()),
      icon: Filter,
      color: 'amber'
    }
  ]
})

onMounted(async () => {
  await fetchRequestTimes()
  await fetchSystemSettings()
  await fetchRequestTimeHit()

  // 每 30 秒自动刷新一次状态，以确保时间同步
  refreshInterval = setInterval(fetchRequestTimeHit, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

const fetchRequestTimes = async () => {
  if (!isAdmin.value) {
    error.value = locale.value.errors.adminOnly
    return
  }

  loading.value = true
  error.value = ''

  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/request-times', {
      headers: {
        'Content-Type': 'application/json'
      },
      ...authConfig
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || getErrorMessage('fetchFailedWithStatus', response.status))
    }

    const data = await response.json()

    requestTimes.value = data.sort((a: RequestTime, b: RequestTime) => {
      if (a.past !== b.past) return a.past ? 1 : -1
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      const aHasTime = !!(a.startTime || a.endTime)
      const bHasTime = !!(b.startTime || b.endTime)
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1
      if (aHasTime && bHasTime) {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime)
        else if (a.startTime) return -1
        else if (b.startTime) return 1
      }
      return a.name.localeCompare(b.name)
    })
  } catch (err: any) {
    error.value = getThrownMessage(err) || locale.value.errors.fetchFailed
  } finally {
    loading.value = false
  }
}

const fetchSystemSettings = async () => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      headers: { 'Content-Type': 'application/json' },
      ...authConfig
    })
    if (!response.ok) return
    const data = await response.json()
    enableRequestTimeLimitation.value = data.enableRequestTimeLimitation
    enableRequest.value = !data.forceBlockAllRequests
    enableSubmissionRestriction.value = !!data.enableSubmissionRestriction
    submissionRestrictionScope.value = data.submissionRestrictionScope || 'all'
    sameSongRestrictionHours.value = data.sameSongRestrictionHours ?? null
    sameArtistRestrictionHours.value = data.sameArtistRestrictionHours ?? null
  } catch (err: any) {
    console.error('获取系统设置失败:', getThrownMessage(err))
  }
}

const fetchRequestTimeHit = async () => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/request-times', {
      headers: { 'Content-Type': 'application/json' },
      ...authConfig
    })
    if (!response.ok) return
    const data = await response.json()
    hitRequestTime.value = data.hit
  } catch (err: any) {
    console.error('获取投稿开放状态失败:', getThrownMessage(err))
  }
}

const toggleGlobalRequest = async () => {
  enableRequest.value = !enableRequest.value
  await updateSystemSettings()
  await fetchRequestTimeHit()
}

const toggleTimeLimitation = async () => {
  enableRequestTimeLimitation.value = !enableRequestTimeLimitation.value
  await updateSystemSettings()
  await fetchRequestTimeHit()
}

const updateSystemSettings = async () => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enableRequestTimeLimitation: enableRequestTimeLimitation.value,
        forceBlockAllRequests: !enableRequest.value
      }),
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || getErrorMessage('updateSystemSettingsFailedWithStatus', response.status))
    }
  } catch (err: any) {
    error.value = getThrownMessage(err) || locale.value.errors.updateSystemSettingsFailed
  }
}

const normalizeRestrictionHours = (key: 'sameSong' | 'sameArtist') => {
  const target = key === 'sameSong' ? sameSongRestrictionHours : sameArtistRestrictionHours
  if (typeof target.value === 'number' && (Number.isNaN(target.value) || target.value < 1 || target.value > 720 || !Number.isInteger(target.value))) {
    target.value = null
  }
}

const toggleRestriction = () => {
  enableSubmissionRestriction.value = !enableSubmissionRestriction.value
  // 关闭时清空时长，与服务端交叉校验保持一致
  if (!enableSubmissionRestriction.value) {
    sameSongRestrictionHours.value = null
    sameArtistRestrictionHours.value = null
  }
}

const saveRestrictionSettings = async () => {
  normalizeRestrictionHours('sameSong')
  normalizeRestrictionHours('sameArtist')

  const enabled = enableSubmissionRestriction.value
  const songHours = sameSongRestrictionHours.value
  const artistHours = sameArtistRestrictionHours.value

  try {
    await submitRestrictionSettings({
      enableSubmissionRestriction: enabled,
      submissionRestrictionScope: submissionRestrictionScope.value,
      sameSongRestrictionHours: enabled ? songHours : null,
      sameArtistRestrictionHours: enabled ? artistHours : null
    })
  } catch {
    error.value = locale.value.restrictionSaveFailed
  }
}

const submitRestrictionSettings = async (body: any) => {
  if (!isAdmin.value) return
  restrictionSaving.value = true
  try {
    const authConfig = getAuthConfig()
    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || locale.value.restrictionSaveFailed)
    }
    await fetchSystemSettings()
    error.value = ''
    toast.success(locale.value.restrictionSaveSuccess)
  } catch (err) {
    try {
      await fetchSystemSettings()
    } catch {}
    throw err
  } finally {
    restrictionSaving.value = false
  }
}

const editRequestTime = (RequestTime: RequestTime) => {
  editingRequestTime.value = RequestTime
  Object.assign(formData, {
    id: RequestTime.id,
    name: RequestTime.name,
    startTime: RequestTime.startTime,
    endTime: RequestTime.endTime,
    description: RequestTime.description || '',
    enabled: RequestTime.enabled,
    expected: RequestTime.expected || 0
  })
}

const toggleRequestTimeStatus = async (RequestTime: RequestTime) => {
  if (!isAdmin.value) return
  try {
    const authConfig = getAuthConfig()
    const response = await fetch(`/api/admin/request-times/${RequestTime.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !RequestTime.enabled }),
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || getErrorMessage('updateStatusFailedWithStatus', response.status))
    }
    await fetchRequestTimes()
    await fetchRequestTimeHit()
  } catch (err: any) {
    error.value = getThrownMessage(err) || locale.value.errors.updateStatusFailed
  }
}

const confirmDelete = (RequestTime: RequestTime) => {
  RequestTimeToDelete.value = RequestTime
  showDeleteConfirm.value = true
}

const deleteRequestTime = async () => {
  if (!RequestTimeToDelete.value || !isAdmin.value) return
  deleteInProgress.value = true
  try {
    const authConfig = getAuthConfig()
    const response = await fetch(`/api/admin/request-times/${RequestTimeToDelete.value.id}`, {
      method: 'DELETE',
      ...authConfig
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || getErrorMessage('deleteFailedWithStatus', response.status))
    }
    await fetchRequestTimes()
    await fetchRequestTimeHit()
    showDeleteConfirm.value = false
    RequestTimeToDelete.value = null
  } catch (err: any) {
    error.value = getThrownMessage(err) || locale.value.errors.deleteFailed
  } finally {
    deleteInProgress.value = false
  }
}

const saveRequestTime = async () => {
  formError.value = ''
  if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
    formError.value = locale.value.errors.startBeforeEnd
    return
  }
  if (!formData.name.trim()) {
    formError.value = locale.value.errors.nameRequired
    return
  }
  const isUpdate = !!editingRequestTime.value
  const nameExists = requestTimes.value.some(
    (pt) =>
      pt.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!isUpdate || pt.id !== formData.id)
  )
  if (nameExists) {
    formError.value = locale.value.errors.nameExists
    return
  }
  formSubmitting.value = true
  try {
    const authConfig = getAuthConfig()
    const response = await fetch(
      isUpdate ? `/api/admin/request-times/${formData.id}` : '/api/admin/request-times',
      {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          description: formData.description || null,
          enabled: formData.enabled,
          expected: formData.expected || 0
        }),
        ...authConfig
      }
    )
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || getErrorMessage('saveFailedWithStatus', isUpdate, response.status)
      )
    }
    await fetchRequestTimes()
    await fetchRequestTimeHit()
    cancelForm()
  } catch (err: any) {
    formError.value = getThrownMessage(err) || locale.value.errors.saveFailed
  } finally {
    formSubmitting.value = false
  }
}

const cancelForm = () => {
  showAddForm.value = false
  editingRequestTime.value = null
  formError.value = ''
  Object.assign(formData, {
    id: 0,
    name: '',
    startTime: '',
    endTime: '',
    description: '',
    enabled: true,
    expected: 0
  })
}
</script>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}
</style>
