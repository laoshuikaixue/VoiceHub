<template>
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
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      @click="$emit('close')"
    >
      <div
        class="bg-bg-secondary border border-border-secondary w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        @click.stop
      >
        <!-- 头部 -->
        <div class="p-8 pb-4 flex items-center justify-between border-b border-border-secondary-50">
          <div>
            <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-info-10 flex items-center justify-center text-info"
              >
                <Layers :size="20" />
              </div>
              {{ locale.title }}
            </h3>
            <p class="text-xs text-text-tertiary mt-1 ml-13">
              {{ locale.desc }}
            </p>
          </div>
          <button
            class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all"
            @click="$emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar space-y-8">
          <!-- 更新方式选择 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label
              :class="[
                'relative flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer group',
                updateType === 'grade-only'
                  ? 'bg-info-5 border-info-50 ring-4 ring-color-collab-10'
                  : 'bg-bg-primary border-border-secondary hover:border-border-tertiary'
              ]"
            >
              <input v-model="updateType" type="radio" value="grade-only" class="sr-only" >
              <div class="flex items-center justify-between mb-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    updateType === 'grade-only'
                      ? 'bg-info text-text-primary'
                      : 'bg-bg-tertiary text-text-tertiary group-hover:text-text-secondary'
                  ]"
                >
                  <Calendar :size="18" />
                </div>
                <div
                  v-if="updateType === 'grade-only'"
                  class="w-5 h-5 rounded-full bg-info flex items-center justify-center"
                >
                  <Check :size="12" class="text-text-primary" />
                </div>
              </div>
              <span class="text-sm font-black text-text-primary uppercase tracking-widest"
                >{{ locale.updateTypes.gradeOnly.title }}</span
              >
              <span class="text-[10px] text-text-tertiary mt-1 font-medium leading-relaxed"
                >{{ locale.updateTypes.gradeOnly.desc }}</span
              >
            </label>

            <label
              :class="[
                'relative flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer group',
                updateType === 'excel-batch'
                  ? 'bg-success-5 border-success-50 ring-4 ring-success-10'
                  : 'bg-bg-primary border-border-secondary hover:border-border-tertiary'
              ]"
            >
              <input v-model="updateType" type="radio" value="excel-batch" class="sr-only" >
              <div class="flex items-center justify-between mb-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    updateType === 'excel-batch'
                      ? 'bg-success text-text-primary'
                      : 'bg-bg-tertiary text-text-tertiary group-hover:text-text-secondary'
                  ]"
                >
                  <FileSpreadsheet :size="18" />
                </div>
                <div
                  v-if="updateType === 'excel-batch'"
                  class="w-5 h-5 rounded-full bg-success flex items-center justify-center"
                >
                  <Check :size="12" class="text-text-primary" />
                </div>
              </div>
              <span class="text-sm font-black text-text-primary uppercase tracking-widest"
                >{{ locale.updateTypes.excelBatch.title }}</span
              >
              <span class="text-[10px] text-text-tertiary mt-1 font-medium leading-relaxed"
                >{{ locale.updateTypes.excelBatch.desc }}</span
              >
            </label>

            <label
              :class="[
                'relative flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer group',
                updateType === 'status-batch'
                  ? 'bg-warning-5 border-warning-50 ring-4 ring-warning-10'
                  : 'bg-bg-primary border-border-secondary hover:border-border-tertiary'
              ]"
            >
              <input v-model="updateType" type="radio" value="status-batch" class="sr-only" >
              <div class="flex items-center justify-between mb-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    updateType === 'status-batch'
                      ? 'bg-warning text-text-primary'
                      : 'bg-bg-tertiary text-text-tertiary group-hover:text-text-secondary'
                  ]"
                >
                  <ShieldAlert :size="18" />
                </div>
                <div
                  v-if="updateType === 'status-batch'"
                  class="w-5 h-5 rounded-full bg-warning flex items-center justify-center"
                >
                  <Check :size="12" class="text-text-primary" />
                </div>
              </div>
              <span class="text-sm font-black text-text-primary uppercase tracking-widest"
                >{{ locale.updateTypes.statusBatch.title }}</span
              >
              <span class="text-[10px] text-text-tertiary mt-1 font-medium leading-relaxed"
                >{{ locale.updateTypes.statusBatch.desc }}</span
              >
            </label>

            <label
              :class="[
                'relative flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer group',
                updateType === 'song-admin-batch'
                  ? 'bg-primary-5 border-primary-50 ring-4 ring-primary-10'
                  : 'bg-bg-primary border-border-secondary hover:border-border-tertiary'
              ]"
            >
              <input v-model="updateType" type="radio" value="song-admin-batch" class="sr-only" >
              <div class="flex items-center justify-between mb-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    updateType === 'song-admin-batch'
                      ? 'bg-primary text-text-primary'
                      : 'bg-bg-tertiary text-text-tertiary group-hover:text-text-secondary'
                  ]"
                >
                  <Music :size="18" />
                </div>
                <div
                  v-if="updateType === 'song-admin-batch'"
                  class="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check :size="12" class="text-text-primary" />
                </div>
              </div>
              <span class="text-sm font-black text-text-primary uppercase tracking-widest"
                >{{ locale.updateTypes.songAdminBatch.title }}</span
              >
              <span class="text-[10px] text-text-tertiary mt-1 font-medium leading-relaxed"
                >{{ locale.updateTypes.songAdminBatch.desc }}</span
              >
            </label>
          </div>

          <!-- 学生选择面板 (年级更新和状态更新共用) -->
          <div
            v-if="['grade-only', 'status-batch'].includes(updateType)"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div class="p-6 bg-bg-primary-50 border border-border-secondary-50 rounded-xl space-y-6">
              <div
                class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest"
              >
                <Filter :size="14" class="text-info" />
                {{ locale.studentFilter.title }}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.studentFilter.currentGrade }}</label
                  >
                  <CustomSelect
                    v-model="gradeFilter"
                    :options="gradeOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="locale.studentFilter.allGrades"
                    class-name="w-full"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.studentFilter.currentClass }}</label
                  >
                  <CustomSelect
                    v-model="classFilter"
                    :options="classOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="locale.studentFilter.allClasses"
                    class-name="w-full"
                  />
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
                    >{{ getNestedText('studentFilter', 'selectUsers', selectedUserIds?.length || 0, filteredUsers?.length || 0) }}</label
                  >
                  <button
                    class="text-[10px] font-black text-info hover:text-info uppercase tracking-widest transition-colors"
                    @click="toggleSelectAll"
                  >
                    {{ isAllSelected ? locale.studentFilter.clearSelection : locale.studentFilter.selectAll }}
                  </button>
                </div>
                <div
                  class="max-h-48 overflow-y-auto rounded-lg border border-border-secondary bg-bg-primary p-2 custom-scrollbar"
                >
                  <div
                    v-if="filteredUsers?.length === 0"
                    class="py-10 text-center text-xs text-text-disabled font-medium"
                  >
                    {{ locale.studentFilter.noMatchedUsers }}
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <label
                      v-for="user in filteredUsers"
                      :key="user.id"
                      class="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-secondary-50 cursor-pointer transition-colors group"
                    >
                      <input
                        v-model="selectedUserIds"
                        :value="user.id"
                        type="checkbox"
                        class="w-4 h-4 rounded-md border-border-tertiary bg-bg-primary text-info focus:ring-color-collab-10"
                      >
                      <div class="flex flex-col">
                        <span
                          class="text-xs font-bold text-text-primary group-hover:text-info transition-colors"
                          >{{ user.name }}</span
                        >
                        <span class="text-[10px] text-text-disabled font-mono">{{
                          user.username
                        }}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- 目标年级设置 -->
            <div v-if="updateType === 'grade-only'" class="p-6 bg-info-5 border border-info-20 rounded-xl space-y-6">
              <div
                class="flex items-center gap-2 text-xs font-black text-info uppercase tracking-widest"
              >
                <Save :size="14" />
                {{ locale.gradeSettings.title }}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ locale.gradeSettings.targetGrade }}</label
                  >
                  <div class="relative group">
                    <Calendar
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-info transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="targetGrade"
                      type="text"
                      :placeholder="locale.gradeSettings.targetGradePlaceholder"
                      class="w-full bg-bg-primary border border-border-secondary rounded-lg pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-info-30 transition-all text-text-primary"
                    >
                  </div>
                </div>
                <label
                  class="flex items-center gap-3 p-3 bg-bg-primary border border-border-secondary rounded-lg cursor-pointer hover:border-border-tertiary transition-all"
                >
                  <input
                    v-model="keepClass"
                    type="checkbox"
                    class="w-5 h-5 rounded-md border-border-tertiary bg-bg-primary text-info focus:ring-color-collab-10"
                  >
                  <span class="text-xs font-bold text-text-secondary">{{ locale.gradeSettings.keepClass }}</span>
                </label>
              </div>
            </div>

            <!-- 目标状态设置 -->
            <div v-if="updateType === 'status-batch'" class="p-6 bg-warning-5 border border-warning-20 rounded-xl space-y-6">
              <div class="flex items-center gap-2 text-xs font-black text-warning uppercase tracking-widest">
                <Save :size="14" />
                {{ locale.statusSettings.title }}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1">{{ locale.statusSettings.sourceStatus }}</label>
                  <CustomSelect
                    v-model="sourceStatus"
                    :options="sourceStatusOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="locale.statusSettings.sourceStatusPlaceholder"
                    class-name="w-full"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1">{{ locale.statusSettings.targetStatus }}</label>
                  <CustomSelect
                    v-model="targetStatus"
                    :options="statusOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="locale.statusSettings.targetStatusPlaceholder"
                    class-name="w-full"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1">{{ locale.statusSettings.reason }}</label>
                  <div class="relative group">
                    <MessageSquare class="absolute left-4 top-3 text-text-secondary group-focus-within:text-warning transition-colors" :size="16" />
                    <textarea
                      v-model="statusReason"
                      rows="2"
                      :placeholder="locale.statusSettings.reasonPlaceholder"
                      class="w-full bg-bg-primary border border-border-secondary rounded-lg pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-warning-30 transition-all text-text-primary resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 歌曲管理员批量更新面板 -->
          <div
            v-if="updateType === 'song-admin-batch'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div class="p-6 bg-bg-primary-50 border border-border-secondary-50 rounded-xl space-y-6">
              <div
                class="flex items-center gap-2 text-xs font-black text-text-tertiary uppercase tracking-widest"
              >
                <Filter :size="14" class="text-primary" />
                {{ getNestedText('songAdminSettings', 'scope') }}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ getNestedText('songAdminSettings', 'currentGrade') }}</label
                  >
                  <CustomSelect
                    v-model="songAdminGradeFilter"
                    :options="songAdminGradeOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="getNestedText('songAdminSettings', 'allGrades')"
                    class-name="w-full"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ getNestedText('songAdminSettings', 'currentClass') }}</label
                  >
                  <CustomSelect
                    v-model="songAdminClassFilter"
                    :options="songAdminClassOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="getNestedText('songAdminSettings', 'allClasses')"
                    class-name="w-full"
                  />
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
                    >{{ getNestedText('songAdminSettings', 'selectUsers', songAdminIds?.length || 0, filteredSongAdminUsers?.length || 0) }}</label>
                  <button
                    class="text-[10px] font-black text-primary hover:text-info uppercase tracking-widest transition-colors"
                    @click="toggleSelectAllSongAdmin"
                  >
                    {{ isAllSongAdminSelected ? getNestedText('songAdminSettings', 'clearSelection') : getNestedText('songAdminSettings', 'selectAll') }}
                  </button>
                </div>
                <div
                  class="max-h-48 overflow-y-auto rounded-lg border border-border-secondary bg-bg-primary p-2 custom-scrollbar"
                >
                  <div
                    v-if="filteredSongAdminUsers?.length === 0"
                    class="py-10 text-center text-xs text-text-disabled font-medium"
                  >
                    {{ getNestedText('songAdminSettings', 'noMatchedUsers') }}
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <label
                      v-for="user in filteredSongAdminUsers"
                      :key="user.id"
                      class="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-secondary-50 cursor-pointer transition-colors group"
                    >
                      <input
                        v-model="songAdminIds"
                        :value="user.id"
                        type="checkbox"
                        class="w-4 h-4 rounded-md border-border-tertiary bg-bg-primary text-primary focus:ring-primary-10"
                      >
                      <div class="flex flex-col">
                        <span
                          class="text-xs font-bold text-text-primary group-hover:text-primary transition-colors"
                          >{{ user.name }}</span>
                        <span class="text-[10px] text-text-disabled font-mono">{{
                          user.username
                        }}</span>
                      </div>
                      <span class="ml-auto text-[10px] font-bold text-text-disabled">
                        {{ user.grade || '-' }} {{ user.class || '-' }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- 歌曲管理员更新目标设置 -->
            <div class="p-6 bg-primary-5 border border-primary-20 rounded-xl space-y-6">
              <div
                class="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest"
              >
                <Save :size="14" />
                {{ getNestedText('songAdminSettings', 'targetSettings') }}
              </div>
              <p class="text-[10px] text-primary-80 leading-relaxed">
                {{ getNestedText('songAdminSettings', 'desc') }}
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ getNestedText('songAdminSettings', 'targetGrade') }}</label>
                  <div class="relative group">
                    <Calendar
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="songAdminTargetGrade"
                      type="text"
                      :placeholder="getNestedText('songAdminSettings', 'targetGradePlaceholder')"
                      class="w-full bg-bg-primary border border-border-secondary rounded-lg pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                    >
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ getNestedText('songAdminSettings', 'targetClass') }}</label>
                  <div class="relative group">
                    <Briefcase
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors"
                      :size="16"
                    />
                    <input
                      v-model="songAdminTargetClass"
                      type="text"
                      :placeholder="getNestedText('songAdminSettings', 'targetClassPlaceholder')"
                      class="w-full bg-bg-primary border border-border-secondary rounded-lg pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                    >
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-text-tertiary uppercase tracking-widest ml-1"
                    >{{ getNestedText('songAdminSettings', 'targetStatus') }}</label>
                  <CustomSelect
                    v-model="songAdminTargetStatus"
                    :options="statusOptions"
                    label-key="label"
                    value-key="value"
                    :placeholder="getNestedText('songAdminSettings', 'targetStatusPlaceholder')"
                    class-name="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Excel 批量更新面板 -->
          <div
            v-if="updateType === 'excel-batch'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <!-- 文件上传区 -->
            <div
              :class="[
                'relative group cursor-pointer transition-all',
                isDragOver ? 'scale-[0.99]' : ''
              ]"
              @drop="handleDrop"
              @dragover.prevent
              @dragenter.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @click="$refs.fileInput.click()"
            >
              <input
                ref="fileInput"
                accept=".xlsx,.xls"
                class="hidden"
                type="file"
                @change="handleFileSelect"
              >
              <div
                :class="[
                  'w-full py-12 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center gap-4',
                  isDragOver
                    ? 'border-success bg-success-10'
                    : 'border-border-secondary hover:border-success-50 hover:bg-success-5'
                ]"
              >
                <div
                  :class="[
                    'w-16 h-16 rounded-lg bg-bg-secondary flex items-center justify-center transition-colors shadow-xl',
                    isDragOver ? 'text-success' : 'text-text-disabled group-hover:text-success'
                  ]"
                >
                  <Upload :size="32" />
                </div>
                <div class="text-center">
                  <p class="text-base font-black text-text-primary tracking-tight">
                    {{ locale.excelUpload.dragTitle }}
                  </p>
                  <p class="text-xs text-text-tertiary mt-1">
                    {{ locale.excelUpload.or }} <span class="text-success font-bold">{{ locale.excelUpload.chooseFile }}</span> {{ locale.excelUpload.supportedFormats }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 匹配方式选择 -->
            <div class="p-5 bg-bg-primary border border-border-secondary rounded-xl space-y-4">
              <div
                class="flex items-center gap-2 text-[10px] font-black text-text-tertiary uppercase tracking-widest"
              >
                <Filter :size="12" />
                {{ locale.matchType.title }}
              </div>
              <div class="flex gap-3">
                <label
                  :class="[
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-xs font-black uppercase tracking-widest',
                    matchType === 'username'
                      ? 'bg-primary-10 border-primary-50 text-primary ring-4 ring-primary-10'
                      : 'bg-bg-secondary border-border-secondary text-text-disabled hover:border-border-tertiary hover:text-text-tertiary'
                  ]"
                >
                  <input v-model="matchType" type="radio" value="username" class="sr-only" />
                  <span v-if="matchType === 'username'" class="w-2 h-2 rounded-full bg-primary" />
                  {{ locale.matchType.byUsername }}
                </label>
                <label
                  :class="[
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-xs font-black uppercase tracking-widest',
                    matchType === 'name'
                      ? 'bg-success-10 border-success-50 text-success ring-4 ring-success-10'
                      : 'bg-bg-secondary border-border-secondary text-text-disabled hover:border-border-tertiary hover:text-text-tertiary'
                  ]"
                >
                  <input v-model="matchType" type="radio" value="name" class="sr-only" />
                  <span v-if="matchType === 'name'" class="w-2 h-2 rounded-full bg-success" />
                  {{ locale.matchType.byName }}
                </label>
              </div>
              <p class="text-[10px] text-text-disabled leading-relaxed">
                <template v-if="matchType === 'username'">
                  {{ locale.matchType.usernamePrefix }}<span class="text-primary font-bold">{{ locale.fields.username }}</span>{{ locale.matchType.usernameSuffix }}
                </template>
                <template v-else>
                  {{ locale.matchType.namePrefix }}<span class="text-success font-bold">{{ locale.fields.realName }}</span>{{ locale.matchType.nameMiddle }}<span class="text-success font-bold">{{ locale.fields.username }}</span>{{ locale.matchType.nameSuffix }}
                </template>
              </p>
            </div>

            <!-- 模板与说明 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                class="md:col-span-2 p-5 bg-bg-primary border border-border-secondary rounded-xl space-y-3"
              >
                <div
                  class="flex items-center gap-2 text-[10px] font-black text-text-tertiary uppercase tracking-widest"
                >
                  <Info :size="12" />
                  {{ locale.fileSpec.title }}
                </div>
                <ul class="text-[10px] text-text-disabled space-y-1.5 font-medium leading-relaxed">
                  <li class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-bg-quaternary mt-1.5" />
                    {{ locale.fileSpec.headerLine }}
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-bg-quaternary mt-1.5" />
                    <template v-if="matchType === 'username'">
                      <span class="text-primary font-bold">{{ locale.fields.username }}</span> {{ locale.fileSpec.usernameColumn }}
                    </template>
                    <template v-else>
                      <span class="text-success font-bold">{{ locale.fields.name }}</span> {{ locale.fileSpec.nameColumn }}
                    </template>
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-bg-quaternary mt-1.5" />
                    {{ locale.fileSpec.blankKeepsOriginal }}
                  </li>
                </ul>
              </div>
              <button
                class="p-5 bg-success-5 border border-success-20 hover:border-success-40 rounded-xl transition-all flex flex-col items-center justify-center gap-2 group"
                @click="downloadTemplate"
              >
                <div
                  class="w-10 h-10 rounded-lg bg-success text-text-primary flex items-center justify-center shadow-lg shadow-[var(--success-glow-20)] group-hover:scale-110 transition-transform"
                >
                  <Download :size="20" />
                </div>
                <span class="text-[10px] font-black text-success uppercase tracking-widest"
                  >{{ locale.fileSpec.downloadTemplate }}</span
                >
              </button>
            </div>

            <!-- 预览表格 -->
            <div v-if="excelPreviewData.length > 0" class="space-y-4">

              <!-- 外部阻断用户提示 -->
              <div
                v-if="blockerList.length > 0"
                class="p-5 bg-warning-5 border border-warning-20 rounded-2xl space-y-3 animate-in fade-in duration-300"
              >
                <div class="flex items-center gap-2 text-xs font-black text-warning uppercase tracking-widest">
                  <AlertCircle :size="16" />
                  {{ locale.preview.blockersTitle(blockerList.length) }}
                </div>
                <p class="text-[10px] text-warning-80 leading-relaxed">
                  {{ locale.preview.blockersDesc }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(blocker, i) in blockerList"
                    :key="i"
                    class="px-3 py-1.5 bg-warning-10 border border-warning-20 rounded-lg text-xs font-bold text-warning"
                  >
                    {{ blocker.name }}({{ blocker.username }})
                  </span>
                </div>
              </div>
              <div class="flex items-center justify-between ml-1">
                <label class="text-xs font-black text-text-tertiary uppercase tracking-widest"
                  >{{ locale.preview.dataPreview(previewFilter === 'all' ? excelPreviewData.length : filteredPreviewData.length, excelPreviewData.length) }}</label
                >
                <div class="flex items-center gap-4">
                  <button
                    :class="[
                      'flex items-center gap-1.5 transition-all',
                      previewFilter === 'all' || previewFilter === 'pending'
                        ? 'opacity-100'
                        : 'opacity-40 hover:opacity-70'
                    ]"
                    @click="previewFilter = previewFilter === 'pending' ? 'all' : 'pending'"
                  >
                    <div class="w-2 h-2 rounded-full bg-success" />
                    <span class="text-[10px] text-text-tertiary font-bold">{{ locale.preview.pending(previewCounts.pending) }}</span>
                  </button>
                  <button
                    :class="[
                      'flex items-center gap-1.5 transition-all',
                      previewFilter === 'all' || previewFilter === 'noChange'
                        ? 'opacity-100'
                        : 'opacity-40 hover:opacity-70'
                    ]"
                    @click="previewFilter = previewFilter === 'noChange' ? 'all' : 'noChange'"
                  >
                    <div class="w-2 h-2 rounded-full bg-bg-quaternary" />
                    <span class="text-[10px] text-text-tertiary font-bold">{{ locale.preview.noChangeCount(previewCounts.noChange) }}</span>
                  </button>
                  <button
                    :class="[
                      'flex items-center gap-1.5 transition-all',
                      previewFilter === 'all' || previewFilter === 'error'
                        ? 'opacity-100'
                        : 'opacity-40 hover:opacity-70'
                    ]"
                    @click="previewFilter = previewFilter === 'error' ? 'all' : 'error'"
                  >
                    <div class="w-2 h-2 rounded-full bg-error" />
                    <span class="text-[10px] text-text-tertiary font-bold">{{ locale.preview.errorCount(previewCounts.error) }}</span>
                  </button>
                </div>
              </div>
              <div class="rounded-xl border border-border-secondary bg-bg-primary overflow-hidden shadow-xl">
                <div class="overflow-x-auto custom-scrollbar">
                  <table class="w-full text-left border-collapse">
                    <thead
                      class="bg-bg-secondary-80 text-[10px] font-black text-text-tertiary uppercase tracking-widest border-b border-border-secondary"
                    >
                      <tr>
                        <th class="px-5 py-4 whitespace-nowrap">
                          {{ matchType === 'username' ? locale.preview.matchUser : locale.preview.matchName }}
                        </th>
                        <th class="px-5 py-4 whitespace-nowrap">{{ locale.preview.currentInfo }}</th>
                        <th class="px-5 py-4 whitespace-nowrap">{{ locale.preview.afterUpdate }}</th>
                        <th class="px-5 py-4 whitespace-nowrap text-right">{{ locale.preview.matchStatus }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-panel-bg-deepest">
                      <tr
                        v-for="(row, index) in filteredPreviewData.slice(0, 10)"
                        :key="index"
                        :class="[
                          row.error ? 'bg-error-5' : 'hover:bg-bg-secondary-30 transition-colors'
                        ]"
                      >
                        <td class="px-5 py-4">
                          <div class="flex flex-col">
                            <span
                              :class="[
                                'text-xs font-bold',
                                row.error ? 'text-error' : 'text-text-primary'
                              ]"
                              >{{ matchType === 'username' ? row.username : row.name }}</span
                            >
                            <span class="text-[10px] text-text-disabled font-medium">{{
                              matchType === 'username' ? (row.name || '-') : (row.username || '-')
                            }}</span>
                          </div>
                        </td>
                        <td class="px-5 py-4">
                          <div class="flex flex-col">
                            <div class="flex items-center gap-1.5">
                              <span class="text-xs font-bold text-text-primary">{{ row.currentGrade || '-' }}</span>
                              <span class="text-[10px] text-text-secondary">/</span>
                              <span class="text-xs font-bold text-text-primary">{{ row.currentClass || '-' }}</span>
                            </div>
                            <span class="text-[10px] text-text-tertiary font-medium mt-0.5">{{ row.username }}</span>
                          </div>
                        </td>
                        <td class="px-5 py-4">
                          <div class="flex flex-col">
                            <template v-if="row.noChange">
                              <span class="text-xs font-bold text-text-disabled">-</span>
                            </template>
                            <template v-else>
                              <div class="flex items-center gap-1.5">
                                <span class="text-xs font-bold text-success">{{ row.newGrade || row.currentGrade || '-' }}</span>
                                <span class="text-[10px] text-text-secondary">/</span>
                                <span class="text-xs font-bold text-success">{{ row.newClass || row.currentClass || '-' }}</span>
                              </div>
                              <span
                                :class="[
                                  'text-[10px] font-medium mt-0.5',
                                  row.newUsername ? 'text-success' : 'text-text-tertiary'
                                ]"
                              >{{ row.newUsername || row.username }}</span>
                            </template>
                          </div>
                        </td>
                        <td class="px-5 py-4 text-right">
                          <span
                            v-if="row.error"
                            class="px-2 py-0.5 bg-error-10 text-error text-[10px] font-black rounded uppercase tracking-tighter border border-error-20"
                          >
                            {{ row.error }}
                          </span>
                          <span
                            v-else-if="row.noChange"
                            class="px-2 py-0.5 bg-bg-tertiary text-text-tertiary text-[10px] font-black rounded uppercase tracking-tighter border border-border-tertiary-50"
                          >
                            {{ locale.preview.noChange }}
                          </span>
                          <span
                            v-else
                            class="px-2 py-0.5 bg-success-10 text-success text-[10px] font-black rounded uppercase tracking-tighter border border-success-20"
                          >
                            {{ locale.preview.ready }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div
                  v-if="filteredPreviewData.length > 10"
                  class="p-4 text-center border-t border-border-secondary bg-bg-secondary-20 text-[10px] text-text-disabled font-bold uppercase tracking-widest"
                >
                  {{ locale.preview.moreQueued(filteredPreviewData.length - 10) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 错误提示 -->
          <div
            v-if="error"
            class="p-4 bg-error-10 border border-error-20 rounded-2xl flex items-center gap-3 text-error text-xs animate-in shake duration-300"
          >
            <AlertCircle :size="16" />
            {{ error }}
          </div>

          <!-- 进度条 -->
          <div
            v-if="updateType === 'excel-batch' && updateProgressText"
            class="p-5 bg-success-5 border border-success-20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-success uppercase tracking-widest">{{ updateProgressText }}</span>
              <span class="text-xs font-black text-success">{{ updateProgress }}%</span>
            </div>
            <div class="h-2 bg-bg-secondary rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-success to-success-light transition-all duration-300 ease-out rounded-full"
                :style="{ width: updateProgress + '%' }"
              />
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-8 pt-4 border-t border-border-secondary-50 bg-bg-secondary-50 flex gap-3">
          <button
            class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
            @click="$emit('close')"
          >
            {{ locale.actions.cancel }}
          </button>
          <button
            :disabled="loading || !canUpdate"
            :class="[
              'flex-[2] px-6 py-4 text-text-primary text-xs font-black rounded-2xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95',
              updateType === 'excel-batch'
                ? 'bg-success hover:bg-success shadow-[var(--success-glow-20)]'
                : updateType === 'status-batch'
                  ? 'bg-warning hover:bg-warning shadow-[var(--warning-glow-20)]'
                  : updateType === 'song-admin-batch'
                    ? 'bg-primary hover:bg-primary shadow-[var(--primary-glow)]'
                    : 'bg-info hover:bg-info shadow-[var(--info-glow-20)]'
            ]"
            @click="performUpdate"
          >
            <RefreshCw v-if="loading" class="animate-spin" :size="16" />
            <Save v-else :size="16" />
            {{ loading ? locale.actions.submitting : locale.actions.confirm }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useUserFilters } from '~/composables/useUserFilters'
import { useLocale } from '~/utils/locale'
import {
  Layers,
  X,
  Calendar,
  FileSpreadsheet,
  Check,
  Filter,
  ChevronDown,
  Save,
  Upload,
  Download,
  Briefcase,
  Info,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  MessageSquare,
  Music
} from '@lucide/vue'

import CustomSelect from '~/components/UI/Common/CustomSelect.vue'

const props = defineProps({
  show: Boolean,
  users: Array
})

const emit = defineEmits(['close', 'update-success'])

// 响应式数据
const updateType = ref('grade-only')
const loading = ref(false)
const error = ref('')

// 仅更新年级相关
const gradeFilter = ref('')
const classFilter = ref('')
const selectedUserIds = ref([])
const targetGrade = ref('')
const keepClass = ref(true)

// 状态批量更新相关
const sourceStatus = ref('')
const targetStatus = ref('')
const statusReason = ref('')

// 歌曲管理员批量更新相关
const songAdminGradeFilter = ref('')
const songAdminClassFilter = ref('')
const songAdminIds = ref([])
const songAdminTargetGrade = ref('')
const songAdminTargetClass = ref('')
const songAdminTargetStatus = ref('')

// Excel批量更新相关
const isDragOver = ref(false)
const excelPreviewData = ref([])
const fileInput = ref(null)
const matchType = ref('username')
const rawExcelData = ref(null)
const blockerList = ref([])
const previewFilter = ref('all')

// 批量更新进度
const updateProgress = ref(0)
const updateProgressText = ref('')
const updateTotalBatches = ref(0)
const updateCurrentBatch = ref(0)

// 所有用户的年级班级信息
// 服务
const auth = useAuth()
const userFilters = useUserFilters()
const { admin } = useLocale()
const locale = computed(() => {
  const base = admin.value?.userManager?.batchUpdateModal || {}
  const emptyText = () => ''
  return useSafeLocale({
    ...base,
    updateTypes: {
      gradeOnly: {},
      excelBatch: {},
      statusBatch: {},
      songAdminBatch: {},
      ...(base.updateTypes || {})
    },
    fields: { ...(base.fields || {}) },
    studentFilter: {
      selectUsers: emptyText,
      ...(base.studentFilter || {})
    },
    gradeSettings: { ...(base.gradeSettings || {}) },
    statusSettings: { ...(base.statusSettings || {}) },
    statusOptions: { ...(base.statusOptions || {}) },
    excelUpload: { ...(base.excelUpload || {}) },
    matchType: { ...(base.matchType || {}) },
    fileSpec: { ...(base.fileSpec || {}) },
    preview: {
      blockersTitle: emptyText,
      dataPreview: emptyText,
      pending: emptyText,
      noChangeCount: emptyText,
      errorCount: emptyText,
      moreQueued: emptyText,
      ...(base.preview || {})
    },
    actions: { ...(base.actions || {}) },
    template: {
      headers: {},
      ...(base.template || {})
    },
    progress: {
      processing: emptyText,
      completed: emptyText,
      ...(base.progress || {})
    },
    messages: {
      partialGradeSuccess: emptyText,
      gradeSuccess: emptyText,
      partialExcelSuccess: emptyText,
      excelFailed: emptyText,
      partialStatusSuccess: emptyText,
      songAdminNoChanges: emptyText,
      ...(base.messages || {})
    },
    errors: {
      processExcelFailed: emptyText,
      fieldRequired: emptyText,
      duplicateTarget: emptyText,
      usernameOccupied: emptyText,
      batchUpdateFailed: emptyText,
      updateFailedWithEtc: emptyText,
      ...(base.errors || {})
    }
  })
})
const getNestedText = (section, key, ...args) => {
  const message = locale.value?.[section]?.[key]
  if (typeof message === 'function') return message(...args)
  if (typeof message === 'string') {
    return message.replace(/{(\d+)}/g, (match, index) =>
      args[index] !== undefined ? String(args[index]) : match
    )
  }
  return message || key
}
const excelColumnKeys = computed(() => ({
  username: locale.value?.template?.headers?.username,
  name: locale.value?.template?.headers?.name,
  grade: locale.value?.template?.headers?.grade,
  class: locale.value?.template?.headers?.class,
  newUsername: locale.value?.template?.headers?.newUsername
}))

const statusOptions = computed(() => [
  { label: locale.value?.statusOptions?.active || '在校', value: 'active' },
  { label: locale.value?.statusOptions?.graduate || '已毕业', value: 'graduate' },
  { label: locale.value?.statusOptions?.withdrawn || '已退学', value: 'withdrawn' }
])
const sourceStatusOptions = computed(() => [
  { label: locale.value?.statusOptions?.all || '全部状态', value: '' },
  ...statusOptions.value
])

// 计算属性
const computedUsers = computed(() => {
  // 必须优先使用全量数据 allUsers，如果正在加载则等待加载完成。
  // 只有在尚未触发加载且需要临时展示时才 fallback 到 props.users。
  return userFilters.isLoaded.value
    ? userFilters.allUsers.value
    : props.users || []
})

const availableGrades = computed(() => {
  return userFilters.getAvailableGrades(computedUsers.value)
})

const availableClasses = computed(() => {
  return userFilters.getAvailableClasses(computedUsers.value, gradeFilter.value)
})

watch(() => gradeFilter.value, () => {
  classFilter.value = ''
})

const gradeOptions = computed(() => {
  return [
    { label: locale.value?.studentFilter?.allGrades || '全部年级', value: '' },
    ...availableGrades.value.map((g) => ({ label: g, value: g }))
  ]
})

const classOptions = computed(() => {
  return [
    { label: locale.value?.studentFilter?.allClasses || '全部班级', value: '' },
    ...availableClasses.value.map((c) => ({ label: c, value: c }))
  ]
})

const songAdminUsers = computed(() => {
  return computedUsers.value.filter((u) => u.role === 'SONG_ADMIN')
})

const songAdminAvailableGrades = computed(() => {
  const grades = new Set()
  songAdminUsers.value.forEach((u) => {
    if (u.grade) grades.add(u.grade)
  })
  return Array.from(grades)
})

const songAdminAvailableClasses = computed(() => {
  const classes = new Set()
  let pool = songAdminUsers.value
  if (songAdminGradeFilter.value) {
    pool = pool.filter((u) => u.grade === songAdminGradeFilter.value)
  }
  pool.forEach((u) => {
    if (u.class) classes.add(u.class)
  })
  return Array.from(classes)
})

watch(() => songAdminGradeFilter.value, () => {
  songAdminClassFilter.value = ''
})

const songAdminGradeOptions = computed(() => {
  return [
    { label: getNestedText('songAdminSettings', 'allGrades'), value: '' },
    ...songAdminAvailableGrades.value.map((g) => ({ label: g, value: g }))
  ]
})

const songAdminClassOptions = computed(() => {
  return [
    { label: getNestedText('songAdminSettings', 'allClasses'), value: '' },
    ...songAdminAvailableClasses.value.map((c) => ({ label: c, value: c }))
  ]
})

const filteredSongAdminUsers = computed(() => {
  let filtered = songAdminUsers.value

  if (songAdminGradeFilter.value) {
    filtered = filtered.filter((u) => u.grade === songAdminGradeFilter.value)
  }

  if (songAdminClassFilter.value) {
    filtered = filtered.filter((u) => u.class === songAdminClassFilter.value)
  }

  return filtered
})

const isAllSongAdminSelected = computed(() => {
  if (filteredSongAdminUsers.value.length === 0) return false
  const selectedSet = new Set(songAdminIds.value)
  return filteredSongAdminUsers.value.every((u) => selectedSet.has(u.id))
})

const toggleSelectAllSongAdmin = () => {
  const filteredIds = filteredSongAdminUsers.value.map((u) => u.id)
  const filteredSet = new Set(filteredIds)
  if (isAllSongAdminSelected.value) {
    songAdminIds.value = songAdminIds.value.filter((id) => !filteredSet.has(id))
  } else {
    const newSelections = new Set([...songAdminIds.value, ...filteredIds])
    songAdminIds.value = Array.from(newSelections)
  }
}

const performSongAdminBatchUpdate = async () => {
  const updates = songAdminIds.value.map((userId) => {
    const updateData = { userId }
    if (songAdminTargetGrade.value.trim()) updateData.grade = songAdminTargetGrade.value.trim()
    if (songAdminTargetClass.value.trim()) updateData.class = songAdminTargetClass.value.trim()
    if (songAdminTargetStatus.value) updateData.status = songAdminTargetStatus.value
    return updateData
  })

  // 后端单次批量更新上限 100 条，超出时分批提交
  const batchSize = 50
  let totalUpdated = 0
  let totalFailed = 0
  let firstErrorDetail = ''

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)

    try {
      const response = await $fetch('/api/admin/users/batch-update', {
        method: 'POST',
        body: { updates: batch },
        ...auth.getAuthConfig()
      })

      if (!response?.success) {
        throw new Error(response?.message || getNestedText('errors', 'songAdminUpdateFailed'))
      }

      totalUpdated += response.data?.summary?.success || 0
      totalFailed += response.data?.summary?.failed || 0
      if (!firstErrorDetail && response.data?.errors?.length > 0) {
        firstErrorDetail = response.data.errors[0].error
      }
    } catch (err) {
      console.error('歌曲管理员批量更新失败:', err)
      totalFailed += batch.length
    }
  }

  // 目标字段与现状一致等无实际变更场景
  if (totalUpdated === 0 && totalFailed === 0) {
    if (window.$showNotification) {
      window.$showNotification(getNestedText('messages', 'songAdminNoChanges'), 'warning')
    }
    return
  }

  if (totalFailed > 0) {
    if (totalUpdated > 0) {
      if (window.$showNotification) {
        window.$showNotification(getNestedText('messages', 'partialSongAdminSuccess', totalFailed), 'warning')
      }
    } else {
      throw new Error(getNestedText('errors', 'updateFailedWithEtc', firstErrorDetail || getNestedText('errors', 'songAdminUpdateFailed')))
    }
  } else {
    if (window.$showNotification) {
      window.$showNotification(getNestedText('messages', 'songAdminSuccess', totalUpdated), 'success')
    }
  }
}

const filteredUsers = computed(() => {
  let filtered = computedUsers.value

  if (gradeFilter.value) {
    filtered = filtered.filter((s) => s.grade === gradeFilter.value)
  }

  if (classFilter.value) {
    filtered = filtered.filter((s) => s.class === classFilter.value)
  }

  return filtered
})

const isAllSelected = computed(() => {
  if (filteredUsers.value.length === 0) return false
  const selectedSet = new Set(selectedUserIds.value)
  return filteredUsers.value.every(u => selectedSet.has(u.id))
})

const canUpdate = computed(() => {
  if (updateType.value === 'grade-only') {
    return selectedUserIds.value.length > 0 && targetGrade.value.trim()
  } else if (updateType.value === 'excel-batch') {
    return excelPreviewData.value.length > 0 && excelPreviewData.value.some((row) => !row.error && !row.noChange)
  } else if (updateType.value === 'status-batch') {
    return selectedUserIds.value.length > 0 && targetStatus.value && statusReason.value.trim()
  } else if (updateType.value === 'song-admin-batch') {
    return (
      songAdminIds.value.length > 0 &&
      (songAdminTargetGrade.value.trim() || songAdminTargetClass.value.trim() || songAdminTargetStatus.value)
    )
  }
  return false
})

const filteredPreviewData = computed(() => {
  if (previewFilter.value === 'all') return excelPreviewData.value
  if (previewFilter.value === 'pending') return excelPreviewData.value.filter((r) => !r.error && !r.noChange)
  if (previewFilter.value === 'noChange') return excelPreviewData.value.filter((r) => r.noChange)
  if (previewFilter.value === 'error') return excelPreviewData.value.filter((r) => r.error)
  return excelPreviewData.value
})

const previewCounts = computed(() => {
  const data = excelPreviewData.value
  return {
    pending: data.filter((r) => !r.error && !r.noChange).length,
    noChange: data.filter((r) => r.noChange).length,
    error: data.filter((r) => r.error).length
  }
})

// 方法
const toggleSelectAll = () => {
  const filteredIds = filteredUsers.value.map((s) => s.id)
  const filteredSet = new Set(filteredIds)
  if (isAllSelected.value) {
    selectedUserIds.value = selectedUserIds.value.filter((id) => !filteredSet.has(id))
  } else {
    const newSelections = new Set([...selectedUserIds.value, ...filteredIds])
    selectedUserIds.value = Array.from(newSelections)
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    processExcelFile(file)
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  const file = event.dataTransfer.files[0]
  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
    processExcelFile(file)
  }
}

const processExcelFile = async (file) => {
  try {
    loading.value = true
    error.value = ''

    // 确保用户数据已加载（强制要求全量数据，防止使用单页 props.users 匹配导致误判）
    if (!userFilters.isLoaded.value) {
      await fetchAllUsers()
      await nextTick()
    }

    // 动态加载XLSX库
    if (typeof window.XLSX === 'undefined') {
      await loadXLSX()
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = window.XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet)

        rawExcelData.value = jsonData
        parseExcelData(jsonData)
      } catch (parseError) {
        console.error('解析Excel文件失败:', parseError)
        error.value = getNestedText('errors', 'invalidExcelFormat')
        loading.value = false
      }
    }

    reader.onerror = () => {
      console.error('读取文件失败')
      error.value = getNestedText('errors', 'readFileFailed')
      loading.value = false
    }

    reader.readAsArrayBuffer(file)
  } catch (err) {
    console.error('处理Excel文件失败:', err)
    const errorMessage = err && err.message ? err.message : getNestedText('errors', 'unknownExcelError')
    error.value = getNestedText('errors', 'processExcelFailed', errorMessage)
    loading.value = false
  }
}

const parseExcelData = (jsonData) => {
  const previewData = []
  const userMapByUsername = new Map()
  const userMapByName = new Map()

  // 创建双向用户映射
  computedUsers.value.forEach((user) => {
    if (user.username) {
      userMapByUsername.set(user.username, user)
      userMapByUsername.set(user.username.trim().toLowerCase(), user)
    }
    if (user.name) {
      const normalizedName = user.name.trim().toLowerCase()
      if (userMapByName.has(normalizedName)) {
        userMapByName.set(normalizedName, 'AMBIGUOUS')
      } else {
        userMapByName.set(normalizedName, user)
      }
    }
  })

  const columnKeys = excelColumnKeys.value
  const getRowValue = (row, key, fallbacks, defaultValue = '') => {
    const resolvedKey = typeof key === 'function' ? key() : key
    if (resolvedKey && row[resolvedKey] !== undefined) return row[resolvedKey]
    for (const fallback of fallbacks) {
      if (row[fallback] !== undefined) return row[fallback]
    }
    return defaultValue
  }

  jsonData.forEach((row, index) => {
    if (!row || typeof row !== 'object') return

    const rawUsername = getRowValue(row, columnKeys.username, ['用户名', 'username'])
    const rawName = getRowValue(row, columnKeys.name, ['姓名', 'name'])
    const rawGrade = getRowValue(row, columnKeys.grade, ['年级', 'grade'])
    const rawClass = getRowValue(row, columnKeys.class, ['班级', 'class'])
    const rawExplicitNewUsername = getRowValue(row, columnKeys.newUsername, ['新用户名', 'new_username'])
    const username = rawUsername != null ? String(rawUsername).trim() : ''
    const name = rawName != null ? String(rawName).trim().toLowerCase() : ''
    const newGrade = rawGrade != null ? String(rawGrade).trim() : ''
    const newClass = rawClass != null ? String(rawClass).trim() : ''
    const explicitNewUsername = rawExplicitNewUsername != null ? String(rawExplicitNewUsername).trim() : ''
    const newUsername = explicitNewUsername || (matchType.value === 'name' ? username : '')

    const keyValue = matchType.value === 'username' ? username : name
    const keyLabel = matchType.value === 'username' ? getNestedText('fields', 'username') : getNestedText('fields', 'name')

    if (!keyValue) {
      previewData.push({
        username: username,
        name: name,
        newGrade: newGrade,
        newClass: newClass,
        newUsername: newUsername,
        error: getNestedText('errors', 'fieldRequired', keyLabel)
      })
      return
    }

    let existingUser = null

    if (matchType.value === 'username') {
      existingUser =
        userMapByUsername.get(username) ||
        userMapByUsername.get(username.toLowerCase())
    } else {
      const match = userMapByName.get(name)
      if (match === 'AMBIGUOUS') {
        previewData.push({
          username: username,
          name: name,
          newGrade: newGrade,
          newClass: newClass,
          newUsername: newUsername,
          error: getNestedText('errors', 'duplicateNames')
        })
        return
      }
      existingUser = match
    }

    if (!existingUser) {
      previewData.push({
        username: username,
        name: name,
        newGrade: newGrade,
        newClass: newClass,
        newUsername: newUsername,
        error: getNestedText('errors', 'userNotFound')
      })
      return
    }

    const finalNewGrade = newGrade || undefined
    const finalNewClass = newClass || undefined
    const finalNewUsername = newUsername || undefined

    const hasGradeChange = finalNewGrade !== undefined && finalNewGrade !== (existingUser.grade || '')
    const hasClassChange = finalNewClass !== undefined && finalNewClass !== (existingUser.class || '')
    const hasUsernameChange = finalNewUsername !== undefined && finalNewUsername !== existingUser.username

    if (!hasGradeChange && !hasClassChange && !hasUsernameChange) {
      previewData.push({
        userId: existingUser.id,
        username: existingUser.username,
        name: existingUser.name,
        currentGrade: existingUser.grade,
        currentClass: existingUser.class,
        newGrade: undefined,
        newClass: undefined,
        newUsername: undefined,
        noChange: true
      })
      return
    }

    let usernameConflict = null

    if (hasUsernameChange && finalNewUsername) {
      const conflictUser =
        userMapByUsername.get(finalNewUsername) ||
        userMapByUsername.get(finalNewUsername.toLowerCase())
      if (conflictUser && conflictUser.id !== existingUser.id) {
        usernameConflict = { userId: conflictUser.id, name: conflictUser.name }
      }
    }

    previewData.push({
      userId: existingUser.id,
      username: existingUser.username,
      name: existingUser.name,
      currentGrade: existingUser.grade,
      currentClass: existingUser.class,
      newGrade: finalNewGrade,
      newClass: finalNewClass,
      newUsername: finalNewUsername,
      usernameConflict: usernameConflict
    })
  })

  const externalBlockers = new Map()
  const requestedUsernames = new Map()
  const previewMap = new Map(previewData.filter((r) => !r.error).map((r) => [r.userId, r]))

  for (const row of previewData) {
    if (row.error || row.noChange) continue
    if (row.newUsername) {
      const previous = requestedUsernames.get(row.newUsername)
      if (previous) {
        const duplicateTargetMessage = getNestedText('errors', 'duplicateTarget', row.newUsername)
        previous.error = duplicateTargetMessage
        row.error = duplicateTargetMessage
        continue
      }
      requestedUsernames.set(row.newUsername, row)
    }

    if (row.usernameConflict) {
      const conflictRow = previewMap.get(row.usernameConflict.userId)
      const conflictIsChanging =
        conflictRow && conflictRow.newUsername && conflictRow.newUsername !== conflictRow.username
      if (conflictIsChanging) {
        row.usernameConflict = null
      } else {
        externalBlockers.set(row.usernameConflict.userId, {
          username: row.newUsername,
          name: row.usernameConflict.name
        })
      }
    }
  }

  blockerList.value = Array.from(externalBlockers.values())

  for (const row of previewData) {
    if (row.error || row.noChange) continue
    if (row.usernameConflict) {
      row.error = getNestedText('errors', 'usernameOccupied', row.newUsername, row.usernameConflict.name)
    }
  }

  excelPreviewData.value = previewData
  loading.value = false
}

const loadXLSX = async () => {
  return new Promise((resolve, reject) => {
    if (typeof window.XLSX !== 'undefined') {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    script.onload = resolve
    script.onerror = (error) => {
      console.error('加载XLSX库失败:', error)
      reject(new Error(getNestedText('errors', 'loadXlsxFailed')))
    }
    document.head.appendChild(script)
  })
}

const downloadTemplate = async () => {
  if (typeof window.XLSX === 'undefined') {
    try {
      await loadXLSX()
    } catch (err) {
      if (window.$showNotification) {
        window.$showNotification(getNestedText('errors', 'loadXlsxRetry'), 'error')
      } else {
        alert(getNestedText('errors', 'loadXlsxRetry'))
      }
      return
    }
  }

  const templateHeaders = locale.value?.template?.headers || {}
  const getHeaderText = (value, fallback) => {
    if (typeof value === 'function') return value() || fallback
    if (typeof value === 'string') return value || fallback
    return fallback
  }
  const headers = {
    username: getHeaderText(templateHeaders.username, 'username'),
    name: getHeaderText(templateHeaders.name, 'name'),
    grade: getHeaderText(templateHeaders.grade, 'grade'),
    class: getHeaderText(templateHeaders.class, 'class'),
    newUsername: getHeaderText(templateHeaders.newUsername, 'new_username')
  }
  const templateData = [
    {
      [headers.username]: 'student001',
      [headers.name]: getNestedText('template', 'sampleName1'),
      [headers.grade]: '2025',
      [headers.class]: getNestedText('template', 'sampleClass1'),
      [headers.newUsername]: 'new_student001'
    },
    {
      [headers.username]: 'student002',
      [headers.name]: getNestedText('template', 'sampleName2'),
      [headers.grade]: '2025',
      [headers.class]: getNestedText('template', 'sampleClass2'),
      [headers.newUsername]: ''
    }
  ]

  const ws = window.XLSX.utils.json_to_sheet(templateData)
  const wb = window.XLSX.utils.book_new()
  const sheetName = getNestedText('template', 'sheetName')
  const fileName = getNestedText('template', 'fileName')
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName && sheetName !== 'sheetName' ? sheetName : 'template')
  window.XLSX.writeFile(wb, fileName && fileName !== 'fileName' ? fileName : 'batch-update-template.xlsx')
}

// 当匹配方式切换时，重新解析已上传的 Excel 数据
watch(matchType, () => {
  if (rawExcelData.value) {
    parseExcelData(rawExcelData.value)
  }
})

const performUpdate = async () => {
  try {
    loading.value = true
    error.value = ''

    if (updateType.value === 'grade-only') {
      await performGradeUpdate()
      emit('update-success')
      emit('close')
    } else if (updateType.value === 'excel-batch') {
      const result = await performExcelUpdate()
      if (result.totalFailed > 0) {
        error.value = result.message
        if (window.$showNotification) {
          window.$showNotification(result.message, 'warning')
        }
        return
      }
      excelPreviewData.value = []
      // 等待 3 秒让用户看到进度条完成状态
      setTimeout(() => {
        if (updateProgressText.value) {
          emit('close')
        }
      }, 3000)
    } else if (updateType.value === 'status-batch') {
      await performStatusUpdate()
      emit('update-success')
      emit('close')
    } else if (updateType.value === 'song-admin-batch') {
      await performSongAdminBatchUpdate()
      emit('update-success')
      emit('close')
    }
  } catch (err) {
    console.error('批量更新失败:', err)
    error.value = getNestedText('errors', 'batchUpdateFailed', err?.data?.message || err?.message || err?.statusMessage || getNestedText('errors', 'unknownError'))
  } finally {
    loading.value = false
  }
}

const performGradeUpdate = async () => {
  const response = await $fetch('/api/admin/users/batch-grade-update', {
    method: 'POST',
    body: {
      userIds: selectedUserIds.value,
      targetGrade: targetGrade.value.trim(),
      keepClass: keepClass.value
    },
    ...auth.getAuthConfig()
  })

  if (!response.success) {
    throw new Error(response.message || getNestedText('errors', 'batchUpdateGeneric'))
  }

  if (response.errors && response.errors.length > 0) {
    if (response.updated === 0) {
      throw new Error(getNestedText('errors', 'updateFailedWithEtc', response.errors[0].error))
    } else {
      if (window.$showNotification) {
        window.$showNotification(getNestedText('messages', 'partialGradeSuccess', response.failed), 'warning')
      }
    }
  } else {
    if (window.$showNotification) {
      window.$showNotification(getNestedText('messages', 'gradeSuccess', response.updated), 'success')
    }
  }
}

const performExcelUpdate = async () => {
  const validUpdates = excelPreviewData.value.filter((row) => !row.error && !row.noChange && row.userId)

  if (validUpdates.length === 0) {
    throw new Error(getNestedText('errors', 'noValidUpdates'))
  }

  const targetSet = new Set(validUpdates.filter((r) => r.newUsername).map((r) => r.newUsername))
  validUpdates.sort((a, b) => {
    const aFreesSlot = targetSet.has(a.username)
    const bFreesSlot = targetSet.has(b.username)
    if (aFreesSlot && !bFreesSlot) return -1
    if (!aFreesSlot && bFreesSlot) return 1
    return 0
  })

  updateProgress.value = 0
  updateTotalBatches.value = Math.ceil(validUpdates.length / 50)
  updateCurrentBatch.value = 0

  const batchSize = 50
  let totalUpdated = 0
  let totalFailed = 0

  for (let i = 0; i < validUpdates.length; i += batchSize) {
    const batch = validUpdates.slice(i, i + batchSize)
    updateCurrentBatch.value = Math.floor(i / batchSize) + 1
    updateProgressText.value = getNestedText('progress', 'processing', updateCurrentBatch.value, updateTotalBatches.value)
    updateProgress.value = Math.round((updateCurrentBatch.value / updateTotalBatches.value) * 100)

    const updates = batch.map((row) => ({
      userId: row.userId,
      grade: row.newGrade ? String(row.newGrade).trim() : undefined,
      class: row.newClass ? String(row.newClass).trim() : undefined,
      username: row.newUsername ? String(row.newUsername).trim() : undefined
    }))

    try {
      const result = await $fetch('/api/admin/users/batch-update', {
        method: 'POST',
        body: { updates },
        ...auth.getAuthConfig()
      })

      if (!result?.success) {
        throw new Error(result?.message || getNestedText('errors', 'batchRequestFailed'))
      }

      if (result.data?.summary) {
        totalUpdated += result.data.summary.success || 0
        totalFailed += result.data.summary.failed || 0
      } else {
        throw new Error(getNestedText('errors', 'invalidBatchResponse'))
      }
    } catch (err) {
      console.error(`第 ${updateCurrentBatch.value} 批更新失败:`, err)
      totalFailed += batch.length
    }
  }

  if (totalFailed > 0) {
    const partialMessage = totalUpdated > 0
      ? getNestedText('messages', 'partialExcelSuccess', totalUpdated, totalFailed)
      : getNestedText('messages', 'excelFailed', totalFailed)

    // 如果存在更新成功的数据，仍然需要通知父组件刷新列表
    if (totalUpdated > 0) {
      emit('update-success')
    }

    // 返回结果给外层统一处理提示，而不是抛出异常打断外层流程
    return {
      success: false,
      totalUpdated,
      totalFailed,
      message: partialMessage
    }
  }

  updateProgressText.value = getNestedText('progress', 'completed', totalUpdated, totalFailed)
  updateProgress.value = 100

  if (totalUpdated > 0) {
    emit('update-success')
  }

  return {
    success: true,
    totalUpdated,
    totalFailed,
    message: ''
  }
}

const performStatusUpdate = async () => {
  const response = await $fetch('/api/admin/users/batch-status', {
    method: 'PUT',
    body: {
      userIds: selectedUserIds.value,
      sourceStatus: sourceStatus.value || undefined,
      status: targetStatus.value,
      reason: statusReason.value.trim()
    },
    ...auth.getAuthConfig()
  })

  if (!response.success) {
    if (response.errors && response.errors.length > 0) {
      throw new Error(getNestedText('errors', 'updateFailedWithEtc', response.errors[0].error))
    }
    throw new Error(response.message || getNestedText('errors', 'statusUpdateFailed'))
  }

  if (response.errors && response.errors.length > 0) {
    if (window.$showNotification) {
      window.$showNotification(getNestedText('messages', 'partialStatusSuccess', response.errors.length), 'warning')
    }
  } else {
    if (window.$showNotification) {
      window.$showNotification(response.message || getNestedText('messages', 'statusSuccess'), 'success')
    }
  }
}

// 获取所有用户数据
const fetchAllUsers = async () => {
  await userFilters.fetchAllUsers()
}

// 监听显示状态
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      fetchAllUsers()
      // 重置状态
      selectedUserIds.value = []
      excelPreviewData.value = []
      matchType.value = 'username'
      rawExcelData.value = null
      blockerList.value = []
      previewFilter.value = 'all'
      targetStatus.value = ''
      statusReason.value = ''
      songAdminGradeFilter.value = ''
      songAdminClassFilter.value = ''
      songAdminIds.value = []
      songAdminTargetGrade.value = ''
      songAdminTargetClass.value = ''
      songAdminTargetStatus.value = ''
      error.value = ''
      updateProgress.value = 0
      updateProgressText.value = ''
      updateTotalBatches.value = 0
      updateCurrentBatch.value = 0
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
  background: var(--text-muted);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
