<template>
  <div class="max-w-[1200px] mx-auto space-y-8 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="space-y-1">
      <h2 class="text-2xl font-black text-zinc-100 tracking-tight">数据库操作</h2>
      <p class="text-xs text-zinc-500 font-medium">
        执行系统底层维护任务，包括备份、恢复及全局数据重置
      </p>
    </div>

    <!-- 远程备份管理 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20">
            <Shield class="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-zinc-100">远程备份</h3>
            <p class="text-[10px] text-zinc-500">设置备份计划，上传到 S3 或 WebDAV</p>
          </div>
        </div>
        <button
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2"
          @click="openScheduledBackupModal()"
        >
          <Plus class="w-4 h-4" />
          新建备份
        </button>
      </div>

      <!-- 备份列表 -->
      <div v-if="scheduledBackupsLoading" class="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 text-center">
        <RefreshCw class="w-6 h-6 text-zinc-500 animate-spin mx-auto" />
        <p class="text-xs text-zinc-500 mt-2">加载中...</p>
      </div>

      <div v-else-if="scheduledBackups.length === 0" class="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 text-center">
        <Shield class="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <h5 class="text-sm font-bold text-zinc-400">暂无备份配置</h5>
        <p class="text-[10px] text-zinc-600 mt-1">点击上方按钮创建备份配置</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="schedule in scheduledBackups"
          :key="schedule.id"
          :class="[
            'group relative bg-zinc-900/40 border rounded-2xl p-5 transition-all hover:border-zinc-700',
            schedule.enabled ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
          ]"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <h5 class="text-sm font-bold text-zinc-200">{{ schedule.name }}</h5>
              <span
                :class="[
                  'px-1.5 py-0.5 text-[9px] font-black uppercase rounded',
                  schedule.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                ]"
              >
                {{ schedule.enabled ? '启用' : '禁用' }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-200"
                title="执行备份"
                @click="runScheduledBackupNow(schedule.id)"
              >
                <Play class="w-3.5 h-3.5" />
              </button>
              <button
                class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-200"
                title="编辑"
                @click="openScheduledBackupModal(schedule)"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              <button
                class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-rose-400"
                title="删除"
                @click="confirmDeleteScheduledBackup(schedule)"
              >
                <Trash class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div class="space-y-1.5 text-[11px]">
            <div class="flex items-center gap-2 text-zinc-400">
              <CheckCircle class="w-3.5 h-3.5 text-zinc-600" />
              <span>{{ getScheduleTimeText(schedule) }}</span>
            </div>
            <div class="flex items-center gap-2 text-zinc-500">
              <span>{{ schedule.uploadType === 's3' ? 'S3' : 'WebDAV' }}</span>
              <span class="text-blue-400">| {{ schedule.retentionType === 'days' ? `保留${schedule.retentionValue}天` : `保留${schedule.retentionValue}个` }}</span>
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="schedule.enabled"
                class="sr-only peer"
                @change="toggleScheduledBackup(schedule.id, !schedule.enabled)"
              >
              <div class="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
            </label>
            <button
              class="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="loadScheduledBackupHistory(schedule.id)"
            >
              查看历史
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="card in cards"
        :key="card.id"
        :class="[
          'group relative bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 transition-all hover:border-zinc-700 hover:shadow-2xl hover:shadow-black/40',
          card.isDanger ? 'hover:border-rose-500/20' : ''
        ]"
      >
        <div class="flex flex-col h-full space-y-6">
          <div class="flex items-center justify-between">
            <div
              :class="[
                'p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 transition-all',
                card.isDanger
                  ? 'text-rose-500 border-rose-500/10'
                  : `text-${card.color}-500 border-${card.color}-500/10 shadow-lg`
              ]"
            >
              <component :is="card.icon" class="w-6 h-6" />
            </div>
            <span
              v-if="card.isDanger"
              class="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase tracking-widest border border-rose-500/20 rounded"
              >高风险操作</span
            >
          </div>

          <div class="flex-1 space-y-2">
            <h3 class="text-lg font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">
              {{ card.title }}
            </h3>
            <p class="text-xs text-zinc-500 leading-relaxed font-medium">
              {{ card.desc }}
            </p>
          </div>

          <button
            :disabled="isLoading(card.id)"
            class="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-700"
            :class="
              card.isDanger
                ? 'bg-zinc-950 border border-rose-900/30 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 shadow-lg shadow-rose-900/5'
                : ''
            "
            @click="openModal(card.id)"
          >
            <span v-if="isLoading(card.id)">执行中...</span>
            <span v-else>{{ card.btnText }}</span>
          </button>
        </div>

        <!-- 背景装饰 -->
        <div
          :class="[
            'absolute -right-4 -bottom-4 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none',
            card.isDanger ? 'bg-rose-500/5' : `bg-${card.color}-500/5`
          ]"
        />
      </div>
    </div>

    <!-- 维护建议 -->
    <div class="bg-blue-600/5 border border-blue-500/10 rounded-xl p-5 flex items-start gap-4">
      <AlertCircle class="text-blue-500 shrink-0 mt-0.5 w-[18px] h-[18px]" />
      <div class="space-y-1">
        <p class="text-[11px] font-bold text-zinc-300">数据库维护建议</p>
        <p class="text-[10px] text-zinc-500 leading-relaxed">
          建议每周进行一次全量备份。在执行“恢复备份”或“重置数据库”前，请务必先创建一份当前的数据备份，以免误操作造成不可挽回的损失。
        </p>
      </div>
    </div>

    <!-- 创建备份模态框 -->
    <div
      v-if="activeModal === 'backup'"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="activeModal = 'none'" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div class="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">创建数据库备份</h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="activeModal = 'none'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-8 space-y-6">
          <div class="space-y-2">
            <p class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">
              选择包含的内容
            </p>
            <div class="space-y-2">
              <label
                v-for="(item, i) in backupOptions"
                :key="i"
                class="flex items-start gap-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition-all group"
              >
                <div class="shrink-0 mt-0.5">
                  <input
                    v-model="createForm[item.key]"
                    type="checkbox"
                    class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-blue-600"
                  >
                </div>
                <div>
                  <p
                    class="text-xs font-bold text-zinc-200 group-hover:text-blue-400 transition-colors"
                  >
                    {{ item.label }}
                  </p>
                  <p class="text-[10px] text-zinc-600 font-medium mt-0.5">{{ item.desc }}</p>
                </div>
              </label>
            </div>
          </div>
          <div class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
            <p class="text-[10px] text-zinc-500 text-center italic">
              备份文件将以 .json 格式生成并自动下载
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="activeModal = 'none'"
          >
            取消
          </button>
          <button
            :disabled="createLoading"
            class="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="createBackup"
          >
            {{ createLoading ? '正在导出...' : '开始导出' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 恢复备份模态框 -->
    <div
      v-if="activeModal === 'restore'"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="activeModal = 'none'" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div class="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">恢复数据库备份</h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="activeModal = 'none'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-8 space-y-6">
          <div
            class="border-2 border-dashed border-zinc-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center group hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer"
            @click="$refs.fileInput.click()"
            @dragover.prevent
            @drop.prevent="handleFileDrop"
          >
            <Upload
              class="w-8 h-8 text-zinc-700 mb-4 group-hover:text-emerald-500 transition-colors"
            />
            <h5 class="text-sm font-bold text-zinc-300">
              {{ selectedFile ? selectedFile.name : '点击选择或拖拽备份文件' }}
            </h5>
            <p class="text-[10px] text-zinc-600 font-bold uppercase mt-1 tracking-widest">
              仅支持 VoiceHub 导出的 .json 格式
            </p>
            <input
              ref="fileInput"
              accept=".json"
              class="hidden"
              type="file"
              @change="handleFileSelect"
            >
          </div>

          <div class="space-y-3">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
              >恢复模式</label
            >
            <div class="grid grid-cols-2 gap-3">
              <button
                :class="[
                  'p-4 border rounded-xl text-left transition-all',
                  restoreForm.mode === 'merge'
                    ? 'bg-zinc-950 border-emerald-500/30'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="restoreForm.mode = 'merge'"
              >
                <h6
                  :class="[
                    'text-xs font-bold',
                    restoreForm.mode === 'merge' ? 'text-emerald-400' : 'text-zinc-500'
                  ]"
                >
                  增量模式
                </h6>
                <p class="text-[9px] text-zinc-600 uppercase mt-0.5">仅导入不重复的新记录</p>
              </button>
              <button
                :class="[
                  'p-4 border rounded-xl text-left transition-all',
                  restoreForm.mode === 'replace'
                    ? 'bg-zinc-950 border-emerald-500/30'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="restoreForm.mode = 'replace'"
              >
                <h6
                  :class="[
                    'text-xs font-bold',
                    restoreForm.mode === 'replace' ? 'text-emerald-400' : 'text-zinc-500'
                  ]"
                >
                  覆盖模式
                </h6>
                <p class="text-[9px] text-zinc-600 uppercase mt-0.5">清空现有表后完整恢复</p>
              </button>
            </div>
          </div>

          <div
            v-if="restoreForm.mode === 'replace' && hasSuperAdminInBackup"
            class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl"
          >
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="restoreForm.overwriteSuperAdmin"
                type="checkbox"
                class="mt-0.5 accent-emerald-500"
              >
              <div>
                <p class="text-xs font-bold text-zinc-200">覆盖备份中的超级管理员账号数据</p>
                <p class="text-[10px] text-zinc-500 mt-1">
                  关闭时将保留当前超级管理员账号及其第三方绑定、2FA等关联数据
                </p>
              </div>
            </label>
          </div>

          <div
            class="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3"
          >
            <AlertCircle class="text-amber-500 shrink-0 mt-0.5 w-4 h-4" />
            <p class="text-[10px] text-zinc-500 leading-normal font-medium">
              注意：覆盖模式将永久清空当前数据库中对应的表内容。此操作将导致现有会话中断。
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="activeModal = 'none'"
          >
            取消
          </button>
          <button
            :disabled="uploadLoading || !selectedFile"
            class="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="restoreBackup"
          >
            {{ uploadLoading ? restoreProgress || '正在恢复...' : '确认并开始恢复' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 重置序列模态框 -->
    <div
      v-if="activeModal === 'reset-seq'"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="activeModal = 'none'" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div class="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">重置数据表序列</h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="activeModal = 'none'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-8 space-y-6">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
              >选择目标表</label
            >
            <CustomSelect
              v-model="sequenceForm.table"
              :options="tableOptions"
              class="w-full"
            />
          </div>

          <div class="p-6 bg-zinc-950/50 border border-zinc-800 rounded-2xl space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center"
              >
                <AlertCircle class="w-4 h-4" />
              </div>
              <h6 class="text-xs font-bold text-zinc-300 uppercase tracking-widest">
                什么是重置序列？
              </h6>
            </div>
            <p class="text-[11px] text-zinc-500 leading-relaxed font-medium">
              如果您的数据表 ID
              出现了断档或在手动操作数据库后无法自增，重置序列可以将数据库底层的计数器更新为当前 ID
              最大值 +1，从而解决 ID 冲突导致的写入失败问题。此操作不会修改任何现有数据。
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="activeModal = 'none'"
          >
            取消
          </button>
          <button
            :disabled="sequenceLoading || !sequenceForm.table"
            class="px-8 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="resetSequence"
          >
            {{ sequenceLoading ? '正在重置...' : '执行重置' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 重置数据库模态框 -->
    <div
      v-if="activeModal === 'reset-db'"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="activeModal = 'none'" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div class="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-xl font-black text-rose-500 tracking-tight">危险操作：重置数据库</h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="activeModal = 'none'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-8 space-y-6">
          <div
            class="p-6 bg-rose-600/10 border border-rose-500/20 rounded-2xl flex flex-col items-center text-center"
          >
            <Trash2 class="text-rose-500 mb-4 w-12 h-12" />
            <h4 class="text-lg font-black text-rose-500 tracking-tight">
              您正在执行极其危险的操作！
            </h4>
            <p class="text-xs text-zinc-500 mt-2 font-medium leading-relaxed">
              重置操作将永久删除系统中的所有
              <span class="text-zinc-300 font-bold"
                >歌曲、投稿记录、排期文件、通知、日志及除您以外的用户账号</span
              >。
            </p>
          </div>

          <div class="space-y-3">
            <label
              class="text-[11px] font-black text-rose-500/80 uppercase tracking-widest px-1 flex items-center justify-center gap-2"
            >
              请输入以下代码以确认操作
            </label>
            <div
              class="bg-zinc-950 border border-rose-900/30 rounded-xl px-4 py-3 font-mono text-[10px] text-rose-400 text-center select-all"
            >
              {{ CONFIRM_CODE }}
            </div>
            <input
              v-model="resetConfirmText"
              type="text"
              placeholder="在此输入上述代码..."
              class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-rose-500/40 text-center font-mono placeholder:text-zinc-700"
            >
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button
              class="py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-xs font-black rounded-xl transition-all uppercase tracking-widest"
              @click="activeModal = 'none'"
            >
              取消
            </button>
            <button
              :disabled="resetConfirmText !== CONFIRM_CODE || resetLoading"
              class="py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed disabled:border-zinc-700"
              :class="
                resetConfirmText === CONFIRM_CODE
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20 active:scale-95'
                  : ''
              "
              @click="resetDatabase"
            >
              {{ resetLoading ? '正在重置...' : '确认彻底重置' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 远程备份创建/编辑模态框 -->
    <div
      v-if="showScheduledBackupModal"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeScheduledBackupModal" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
      >
        <div class="px-8 py-6 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">
            {{ editingScheduledBackup ? '编辑备份' : '新建备份' }}
          </h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="closeScheduledBackupModal"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-8 space-y-6 overflow-y-auto flex-1">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">备份名称</label>
            <input
              v-model="scheduledBackupForm.name"
              type="text"
              placeholder="例如：数据库备份"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40"
            >
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">备份内容</label>
            <div class="space-y-2">
              <label
                v-for="(item, i) in backupOptions"
                :key="i"
                class="flex items-start gap-4 p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition-all group"
              >
                <div class="shrink-0 mt-0.5">
                  <input
                    v-model="scheduledBackupForm[item.key]"
                    type="checkbox"
                    class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-blue-600"
                  >
                </div>
                <div>
                  <p
                    class="text-xs font-bold text-zinc-200 group-hover:text-blue-400 transition-colors"
                  >
                    {{ item.label }}
                  </p>
                  <p class="text-[10px] text-zinc-600 font-medium mt-0.5">{{ item.desc }}</p>
                </div>
              </label>
            </div>
          </div>

          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-2">
              <button
                :class="[
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all border',
                  scheduledBackupForm.uploadType === 's3'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="scheduledBackupForm.uploadType = 's3'"
              >
                S3 / 兼容存储
              </button>
              <button
                :class="[
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all border',
                  scheduledBackupForm.uploadType === 'webdav'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="scheduledBackupForm.uploadType = 'webdav'"
              >
                WebDAV
              </button>
            </div>

            <div v-if="scheduledBackupForm.uploadType === 's3'" class="space-y-3">
                <input
                  v-model="scheduledBackupForm.s3Endpoint"
                  type="text"
                  placeholder="Endpoint (例如: https://s3.example.com)"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.s3Bucket"
                  type="text"
                  placeholder="Bucket 名称"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.s3Region"
                  type="text"
                  placeholder="区域 (例如: us-east-1)"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.s3AccessKey"
                  type="text"
                  placeholder="Access Key"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.s3SecretKey"
                  type="password"
                  placeholder="Secret Key"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.s3Path"
                  type="text"
                  placeholder="存储路径 (例如: /backups)"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <button
                  :disabled="scheduledBackupTestingConnection"
                  class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all"
                  @click="testScheduledBackupS3Connection"
                >
                  {{ scheduledBackupTestingConnection ? '测试中...' : '测试 S3 连接' }}
                </button>
              </div>

              <div v-if="scheduledBackupForm.uploadType === 'webdav'" class="space-y-3">
                <input
                  v-model="scheduledBackupForm.webdavUrl"
                  type="text"
                  placeholder="服务器 URL (例如: https://webdav.example.com)"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.webdavUsername"
                  type="text"
                  placeholder="用户名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <input
                  v-model="scheduledBackupForm.webdavPassword"
                  type="password"
                  placeholder="密码"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                >
                <div class="flex gap-2">
                  <input
                    v-model="scheduledBackupForm.webdavPath"
                    type="text"
                    placeholder="上传路径 (例如: /backups)"
                    class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
                  >
                  <button
                    :disabled="scheduledBackupTestingConnection"
                    class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all shrink-0"
                    title="浏览路径"
                    @click="browseWebDAVPath"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </div>
                <button
                  :disabled="scheduledBackupTestingConnection"
                  class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all"
                  @click="testScheduledBackupWebDAVConnection"
                >
                  {{ scheduledBackupTestingConnection ? '测试中...' : '测试 WebDAV 连接' }}
                </button>
              </div>
            </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">保留策略</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                :class="[
                  'py-2.5 px-3 rounded-xl text-xs font-bold transition-all border',
                  scheduledBackupForm.retentionType === ''
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="scheduledBackupForm.retentionType = ''"
              >
                不限制
              </button>
              <button
                :class="[
                  'py-2.5 px-3 rounded-xl text-xs font-bold transition-all border',
                  scheduledBackupForm.retentionType === 'days'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="scheduledBackupForm.retentionType = 'days'"
              >
                按天数
              </button>
              <button
                :class="[
                  'py-2.5 px-3 rounded-xl text-xs font-bold transition-all border',
                  scheduledBackupForm.retentionType === 'count'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                ]"
                @click="scheduledBackupForm.retentionType = 'count'"
              >
                按数量
              </button>
            </div>
            <input
              v-if="scheduledBackupForm.retentionType"
              v-model.number="scheduledBackupForm.retentionValue"
              type="number"
              min="1"
              :placeholder="scheduledBackupForm.retentionType === 'days' ? '保留天数' : '保留数量'"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 mt-2"
            >
          </div>
        </div>

        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end shrink-0">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="closeScheduledBackupModal"
          >
            取消
          </button>
          <button
            :disabled="scheduledBackupSaving"
            class="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="saveScheduledBackup"
          >
            {{ scheduledBackupSaving ? '保存中...' : (editingScheduledBackup ? '保存修改' : '创建备份') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 远程备份历史模态框 -->
    <div
      v-if="showScheduledBackupHistoryModal"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showScheduledBackupHistoryModal = false" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col"
      >
        <div class="px-8 py-6 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">备份历史</h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="showScheduledBackupHistoryModal = false"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1">
          <div v-if="scheduledBackupHistory.length === 0" class="text-center py-8">
            <p class="text-zinc-500 text-sm">暂无备份记录</p>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="text-left text-[10px] font-black text-zinc-600 uppercase tracking-widest pb-3">文件名</th>
                <th class="text-left text-[10px] font-black text-zinc-600 uppercase tracking-widest pb-3">状态</th>
                <th class="text-left text-[10px] font-black text-zinc-600 uppercase tracking-widest pb-3">时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in scheduledBackupHistory" :key="record.id" class="border-b border-zinc-800/50">
                <td class="py-3 text-xs text-zinc-300">{{ record.filename }}</td>
                <td class="py-3">
                  <span
                    :class="[
                      'px-2 py-0.5 text-[10px] font-bold rounded',
                      record.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                      record.status === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-zinc-800 text-zinc-400'
                    ]"
                  >
                    {{ record.status === 'success' ? '成功' : record.status === 'failed' ? '失败' : record.status }}
                  </span>
                </td>
                <td class="py-3 text-xs text-zinc-500">{{ formatScheduleDateTime(record.executedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 删除远程备份确认模态框 -->
    <div
      v-if="showDeleteScheduledBackupModal"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showDeleteScheduledBackupModal = false" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div class="p-8 text-center">
          <div class="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
            <Trash class="w-8 h-8 text-rose-500" />
          </div>
          <h4 class="text-lg font-black text-zinc-100 mb-2">确认删除</h4>
          <p class="text-sm text-zinc-500 mb-6">
            确定要删除备份配置 "{{ scheduledBackupToDelete?.name }}" 吗？此操作不可恢复。
          </p>
          <div class="flex gap-3">
            <button
              class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all"
              @click="showDeleteScheduledBackupModal = false"
            >
              取消
            </button>
            <button
              class="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all"
              @click="deleteScheduledBackup"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- WebDAV 浏览模态框 -->
    <div
      v-if="showWebDAVBrowseModal"
      class="fixed inset-0 z-[110] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showWebDAVBrowseModal = false" />
      <div
        class="relative bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[70vh] flex flex-col"
      >
        <div class="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 class="text-lg font-black text-zinc-100 tracking-tight">选择上传路径</h3>
          <button
            class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-200"
            @click="showWebDAVBrowseModal = false"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="px-6 py-3 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
          <div class="flex items-center gap-2">
            <button
              v-if="getParentPath(webdavBrowsePath)"
              class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
              title="返回上级"
              @click="navigateWebDAVPath(getParentPath(webdavBrowsePath))"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span class="text-xs text-zinc-400 font-mono flex-1 truncate">{{ webdavBrowsePath }}</span>
          </div>
        </div>

        <div class="p-4 overflow-y-auto flex-1 min-h-[200px]">
          <div v-if="webdavBrowseLoading" class="flex items-center justify-center py-8">
            <RefreshCw class="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
          <div v-else-if="webdavBrowseError" class="text-center py-8">
            <p class="text-sm text-rose-400">{{ webdavBrowseError }}</p>
          </div>
          <div v-else-if="webdavBrowseFiles.length === 0" class="text-center py-8">
            <p class="text-sm text-zinc-500">目录为空</p>
          </div>
          <div v-else class="space-y-1">
            <button
              v-for="file in webdavBrowseFiles"
              :key="file"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                file === webdavBrowsePath ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-zinc-800 text-zinc-300'
              ]"
              @click="navigateWebDAVPath(file)"
            >
              <svg class="w-4 h-4 shrink-0" :class="file.endsWith('/') ? 'text-amber-400' : 'text-zinc-500'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path :d="file.endsWith('/') ? 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'" />
              </svg>
              <span class="text-xs truncate">{{ file.split('/').pop() || file }}</span>
            </button>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
          <button
            class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all"
            @click="selectWebDAVPath"
          >
            选择此目录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Download, Upload, RotateCw, Trash2, AlertCircle, X, Shield, Play, Edit2, Trash, CheckCircle, XCircle, Clock, RefreshCw, Plus } from 'lucide-vue-next'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useToast } from '~/composables/useToast'
import { useAuth } from '~/composables/useAuth'

const { showToast: showNotification } = useToast()
const auth = useAuth()

// ==================== 远程备份相关 ====================
const scheduledBackups = ref([])
const scheduledBackupsLoading = ref(false)
const scheduledBackupHistory = ref([])
const showScheduledBackupModal = ref(false)
const showScheduledBackupHistoryModal = ref(false)
const showDeleteScheduledBackupModal = ref(false)
const showWebDAVBrowseModal = ref(false)
const editingScheduledBackup = ref(null)
const scheduledBackupToDelete = ref(null)
const scheduledBackupSaving = ref(false)
const scheduledBackupTestingConnection = ref(false)
const webdavBrowseLoading = ref(false)
const webdavBrowsePath = ref('')
const webdavBrowseFiles = ref([])
const webdavBrowseError = ref('')

const scheduledBackupDefaultForm = () => ({
  name: '',
  enabled: true,
  includeSongs: true,
  includeUsers: true,
  includeSystemData: true,
  uploadType: 's3',
  s3Endpoint: '',
  s3Bucket: '',
  s3Region: 'us-east-1',
  s3AccessKey: '',
  s3SecretKey: '',
  s3Path: '/backups',
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/backups',
  retentionType: 'days',
  retentionValue: 7
})

const scheduledBackupForm = ref(scheduledBackupDefaultForm())

const loadScheduledBackups = async () => {
  scheduledBackupsLoading.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup')
    if (response.success) {
      scheduledBackups.value = response.data || []
    }
  } catch (error) {
    console.error('加载备份失败:', error)
    showNotification('加载备份配置失败', 'error')
  } finally {
    scheduledBackupsLoading.value = false
  }
}

const loadScheduledBackupHistory = async (scheduleId = null) => {
  try {
    const response = await $fetch('/api/admin/scheduled-backup/history')
    if (response.success) {
      scheduledBackupHistory.value = (response.data || []).filter(h => !scheduleId || h.scheduleId === scheduleId)
      showScheduledBackupHistoryModal.value = true
    }
  } catch (error) {
    console.error('加载历史失败:', error)
    showNotification('加载备份历史失败', 'error')
  }
}

const openScheduledBackupModal = (schedule = null) => {
  if (schedule) {
    editingScheduledBackup.value = schedule
    scheduledBackupForm.value = {
      name: schedule.name,
      enabled: schedule.enabled,
      includeSongs: schedule.includeSongs ?? true,
      includeUsers: schedule.includeUsers ?? true,
      includeSystemData: schedule.includeSystemData,
      uploadType: schedule.uploadType || 's3',
      s3Endpoint: schedule.s3Endpoint || '',
      s3Bucket: schedule.s3Bucket || '',
      s3Region: schedule.s3Region || 'us-east-1',
      s3AccessKey: schedule.s3AccessKey || '',
      s3SecretKey: schedule.s3SecretKey || '',
      s3Path: schedule.s3Path || '/backups',
      webdavUrl: schedule.webdavUrl || '',
      webdavUsername: schedule.webdavUsername || '',
      webdavPassword: schedule.webdavPassword || '',
      webdavPath: schedule.webdavPath || '/backups',
      retentionType: schedule.retentionType || '',
      retentionValue: schedule.retentionValue || 7
    }
  } else {
    editingScheduledBackup.value = null
    scheduledBackupForm.value = scheduledBackupDefaultForm()
  }
  showScheduledBackupModal.value = true
}

const closeScheduledBackupModal = () => {
  showScheduledBackupModal.value = false
  editingScheduledBackup.value = null
  scheduledBackupForm.value = scheduledBackupDefaultForm()
}

const saveScheduledBackup = async () => {
  if (!scheduledBackupForm.value.name.trim()) {
    showNotification('请输入备份名称', 'warning')
    return
  }

  scheduledBackupSaving.value = true

  try {
    const payload = {
      ...scheduledBackupForm.value
    }

    let response
    if (editingScheduledBackup.value) {
      response = await $fetch(`/api/admin/scheduled-backup/${editingScheduledBackup.value.id}`, {
        method: 'PUT',
        body: payload
      })
    } else {
      response = await $fetch('/api/admin/scheduled-backup', {
        method: 'POST',
        body: payload
      })
    }

    if (response.success) {
      showNotification(editingScheduledBackup.value ? '备份已更新' : '备份已创建', 'success')
      closeScheduledBackupModal()
      await loadScheduledBackups()
    } else {
      showNotification(response.message || '操作失败', 'error')
    }
  } catch (error) {
    console.error('保存备份失败:', error)
    showNotification('保存失败: ' + (error.data?.message || error.message), 'error')
  } finally {
    scheduledBackupSaving.value = false
  }
}

const toggleScheduledBackup = async (id, enabled) => {
  try {
    const response = await $fetch(`/api/admin/scheduled-backup/${id}/toggle`, {
      method: 'POST',
      body: { enabled }
    })

    if (response.success) {
      showNotification(enabled ? '备份已启用' : '备份已禁用', 'success')
      await loadScheduledBackups()
    }
  } catch (error) {
    console.error('切换备份状态失败:', error)
    showNotification('操作失败', 'error')
    await loadScheduledBackups()
  }
}

const runScheduledBackupNow = async (id) => {
  if (!confirm('确定要立即执行备份吗？')) return

  try {
    showNotification('备份开始执行...', 'info')
    const response = await $fetch(`/api/admin/scheduled-backup/${id}/run`, {
      method: 'POST'
    })

    if (response.success) {
      showNotification('备份执行成功', 'success')
    } else {
      showNotification(response.message || '备份执行失败', 'error')
    }
  } catch (error) {
    console.error('执行备份失败:', error)
    showNotification('执行失败: ' + (error.data?.message || error.message), 'error')
  }
}

const confirmDeleteScheduledBackup = (schedule) => {
  scheduledBackupToDelete.value = schedule
  showDeleteScheduledBackupModal.value = true
}

const deleteScheduledBackup = async () => {
  if (!scheduledBackupToDelete.value) return

  try {
    const response = await $fetch(`/api/admin/scheduled-backup/${scheduledBackupToDelete.value.id}`, {
      method: 'DELETE'
    })

    if (response.success) {
      showNotification('备份已删除', 'success')
      showDeleteScheduledBackupModal.value = false
      scheduledBackupToDelete.value = null
      await loadScheduledBackups()
    }
  } catch (error) {
    console.error('删除备份失败:', error)
    showNotification('删除失败', 'error')
  }
}

const testScheduledBackupS3Connection = async () => {
  scheduledBackupTestingConnection.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup/test-s3', {
      method: 'POST',
      body: {
        endpoint: scheduledBackupForm.value.s3Endpoint,
        bucket: scheduledBackupForm.value.s3Bucket,
        region: scheduledBackupForm.value.s3Region,
        accessKey: scheduledBackupForm.value.s3AccessKey,
        secretKey: scheduledBackupForm.value.s3SecretKey,
        s3Path: scheduledBackupForm.value.s3Path
      }
    })
    showNotification(response.message, response.success ? 'success' : 'error')
  } catch (error) {
    console.error('测试 S3 连接失败:', error)
    const errorMessage = error.data?.message || error.message || '连接测试失败'
    showNotification(errorMessage, 'error')
  } finally {
    scheduledBackupTestingConnection.value = false
  }
}

const testScheduledBackupWebDAVConnection = async () => {
  scheduledBackupTestingConnection.value = true
  try {
    const response = await $fetch('/api/admin/scheduled-backup/test-webdav', {
      method: 'POST',
      body: {
        url: scheduledBackupForm.value.webdavUrl,
        username: scheduledBackupForm.value.webdavUsername,
        password: scheduledBackupForm.value.webdavPassword
      }
    })
    showNotification(response.message, response.success ? 'success' : 'error')
  } catch (error) {
    console.error('测试 WebDAV 连接失败:', error)
    const errorMessage = error.data?.message || error.message || '连接测试失败'
    showNotification(errorMessage, 'error')
  } finally {
    scheduledBackupTestingConnection.value = false
  }
}

const browseWebDAVPath = async () => {
  if (!scheduledBackupForm.value.webdavUrl || !scheduledBackupForm.value.webdavUsername || !scheduledBackupForm.value.webdavPassword) {
    showNotification('请先填写 WebDAV 服务器信息', 'warning')
    return
  }

  webdavBrowsePath.value = scheduledBackupForm.value.webdavPath || '/backups'
  webdavBrowseFiles.value = []
  webdavBrowseError.value = ''
  webdavBrowseLoading.value = true
  showWebDAVBrowseModal.value = true

  try {
    const response = await $fetch('/api/admin/scheduled-backup/browse-webdav', {
      method: 'POST',
      body: {
        url: scheduledBackupForm.value.webdavUrl,
        username: scheduledBackupForm.value.webdavUsername,
        password: scheduledBackupForm.value.webdavPassword,
        path: webdavBrowsePath.value
      }
    })

    if (response.success) {
      webdavBrowseFiles.value = response.files || []
      webdavBrowsePath.value = response.currentPath || webdavBrowsePath.value
    } else {
      webdavBrowseError.value = response.errorMessage || '浏览失败'
    }
  } catch (error) {
    console.error('Browse WebDAV failed:', error)
    webdavBrowseError.value = error.data?.message || error.message || '浏览失败'
  } finally {
    webdavBrowseLoading.value = false
  }
}

const navigateWebDAVPath = async (path) => {
  webdavBrowsePath.value = path
  webdavBrowseFiles.value = []
  webdavBrowseError.value = ''
  webdavBrowseLoading.value = true

  try {
    const response = await $fetch('/api/admin/scheduled-backup/browse-webdav', {
      method: 'POST',
      body: {
        url: scheduledBackupForm.value.webdavUrl,
        username: scheduledBackupForm.value.webdavUsername,
        password: scheduledBackupForm.value.webdavPassword,
        path: path
      }
    })

    if (response.success) {
      webdavBrowseFiles.value = response.files || []
      webdavBrowsePath.value = response.currentPath || path
    } else {
      webdavBrowseError.value = response.errorMessage || '浏览失败'
    }
  } catch (error) {
    console.error('Navigate WebDAV failed:', error)
    webdavBrowseError.value = error.data?.message || error.message || '浏览失败'
  } finally {
    webdavBrowseLoading.value = false
  }
}

const selectWebDAVPath = () => {
  scheduledBackupForm.value.webdavPath = webdavBrowsePath.value
  showWebDAVBrowseModal.value = false
}

const getParentPath = (path) => {
  if (path === '/' || !path) return null
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

const getScheduleTimeText = (schedule) => {
  const parts = []
  if (schedule.includeSongs) parts.push('歌曲')
  if (schedule.includeUsers) parts.push('用户')
  if (schedule.includeSystemData) parts.push('系统')
  return parts.join(' + ') || '未选择内容'
}

const formatScheduleDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 初始化加载
onMounted(() => {
  loadScheduledBackups()
})

// 状态
const activeModal = ref('none')
const createLoading = ref(false)
const uploadLoading = ref(false)
const sequenceLoading = ref(false)
const resetLoading = ref(false)
const selectedFile = ref(null)
const resetConfirmText = ref('')
const restoreProgress = ref('')
const hasSuperAdminInBackup = ref(false)
const CONFIRM_CODE = 'CONFIRM-DATABASE-RESET-OPERATION'

// 卡片配置
const cards = [
  {
    id: 'backup',
    title: '创建备份',
    desc: '导出当前数据库的所有数据到文件，用于安全备份或迁移。',
    icon: Download,
    color: 'blue',
    btnText: '创建备份文件'
  },
  {
    id: 'restore',
    title: '恢复备份',
    desc: '从之前导出的备份文件中恢复系统数据。',
    icon: Upload,
    color: 'emerald',
    btnText: '选择备份文件'
  },
  {
    id: 'reset-seq',
    title: '重置序列',
    desc: '修复数据表的自增ID序列，确保新记录的ID从正确值开始。',
    icon: RotateCw,
    color: 'amber',
    btnText: '开始重置序列'
  },
  {
    id: 'reset-db',
    title: '重置数据库',
    desc: '清空除管理员账号外的所有系统数据。此操作不可撤销。',
    icon: Trash2,
    color: 'rose',
    btnText: '立即重置数据库',
    isDanger: true
  }
]

// 备份选项
const backupOptions = [
  {
    key: 'includeSongs',
    label: '歌曲与排期数据',
    desc: '包含所有歌曲库、用户投稿记录及历史播音排期'
  },
  {
    key: 'includeSystemData',
    label: '系统配置信息',
    desc: '包含站点设置、黑名单、播出时段等全局参数'
  },
  {
    key: 'includeUsers',
    label: '用户账户数据',
    desc: '包含所有注册用户的权限、偏好设置（不含管理员敏感信息）'
  }
]

// 表单数据
const createForm = ref({
  includeSongs: true,
  includeUsers: true,
  includeSystemData: true
})

const restoreForm = ref({
  mode: 'merge',
  overwriteSuperAdmin: false
})

const sequenceForm = ref({
  table: '重置所有表 (All)'
})

const tableOptions = [
  '重置所有表 (All)',
  '歌曲表 (Song)',
  '用户表 (User)',
  '投票表 (Vote)',
  '排期表 (Schedule)',
  '通知表 (Notification)',
  '通知设置表 (NotificationSettings)',
  '播放时段表 (PlayTime)',
  '学期表 (Semester)',
  '系统设置表 (SystemSettings)',
  '歌曲黑名单表 (SongBlacklist)'
]

const labelToValueMap = {
  '重置所有表 (All)': 'all',
  '歌曲表 (Song)': 'Song',
  '用户表 (User)': 'User',
  '投票表 (Vote)': 'Vote',
  '排期表 (Schedule)': 'Schedule',
  '通知表 (Notification)': 'Notification',
  '通知设置表 (NotificationSettings)': 'NotificationSettings',
  '播放时段表 (PlayTime)': 'PlayTime',
  '学期表 (Semester)': 'Semester',
  '系统设置表 (SystemSettings)': 'SystemSettings',
  '歌曲黑名单表 (SongBlacklist)': 'SongBlacklist'
}

// 辅助函数
const isLoading = (id) => {
  if (id === 'backup') return createLoading.value
  if (id === 'restore') return uploadLoading.value
  if (id === 'reset-seq') return sequenceLoading.value
  if (id === 'reset-db') return resetLoading.value
  return false
}

const openModal = (id) => {
  activeModal.value = id
  if (id === 'reset-db') {
    resetConfirmText.value = ''
  }
}

// 文件处理
const parseBackupSuperAdmin = async (file) => {
  try {
    const fileContent = await file.text()
    const backupData = JSON.parse(fileContent)
    const users = Array.isArray(backupData?.data?.users) ? backupData.data.users : []
    hasSuperAdminInBackup.value = users.some((item) => item?.role === 'SUPER_ADMIN')
    if (!hasSuperAdminInBackup.value) {
      restoreForm.value.overwriteSuperAdmin = false
    }
  } catch (error) {
    hasSuperAdminInBackup.value = false
    restoreForm.value.overwriteSuperAdmin = false
    showNotification('无法解析备份文件，请检查文件格式是否正确。', 'error')
    console.error('解析备份文件失败:', error)
  }
}

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
    await parseBackupSuperAdmin(file)
  } else {
    showNotification('请选择有效的JSON备份文件', 'error')
  }
}

const handleFileDrop = async (event) => {
  const file = event.dataTransfer.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
    await parseBackupSuperAdmin(file)
  } else {
    showNotification('请选择有效的JSON备份文件', 'error')
  }
}

// API 操作
const createBackup = async () => {
  createLoading.value = true
  try {
    let tables = 'all'
    if (createForm.value.includeUsers && createForm.value.includeSongs) {
      tables = 'all'
    } else if (createForm.value.includeUsers) {
      tables = 'users'
    } else if (createForm.value.includeSongs) {
      tables = 'songs'
    } else if (createForm.value.includeSystemData) {
      tables = ['systemSettings']
    } else {
      throw new Error('请至少选择一项备份内容')
    }

    const response = await $fetch('/api/admin/backup/export', {
      method: 'POST',
      body: {
        tables,
        includeSystemData: createForm.value.includeSystemData
      }
    })

    if (response.success && response.backup) {
      if (response.backup.downloadMode === 'direct' && response.backup.data) {
        const blob = new Blob([JSON.stringify(response.backup.data, null, 2)], {
          type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = response.backup.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showNotification('备份文件已下载', 'success')
        activeModal.value = 'none'
      } else if (response.backup.downloadMode === 'file' && response.backup.filename) {
        const downloadUrl = `/api/admin/backup/download/${response.backup.filename}`
        const downloadResponse = await fetch(downloadUrl, {
          method: 'GET',
          credentials: 'include'
        })
        if (!downloadResponse.ok) throw new Error(`下载失败: ${downloadResponse.status}`)
        const blob = await downloadResponse.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = response.backup.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showNotification('备份文件已下载', 'success')
        activeModal.value = 'none'
      }
    } else {
      throw new Error(response.message || '备份创建失败')
    }
  } catch (error) {
    console.error('创建备份失败:', error)
    showNotification('创建备份失败: ' + error.message, 'error')
  } finally {
    createLoading.value = false
  }
}

const restoreBackup = async () => {
  if (!selectedFile.value) return showNotification('请选择备份文件', 'error')

  uploadLoading.value = true
  restoreProgress.value = '正在读取文件...'

  try {
    const fileContent = await selectedFile.value.text()
    let backupData
    try {
      backupData = JSON.parse(fileContent)
    } catch {
      throw new Error('无法解析备份文件，文件格式不正确')
    }

    if (!backupData.data) throw new Error('备份文件缺少数据部分')
    const fileHasSuperAdmin = hasSuperAdminInBackup.value
    if (!fileHasSuperAdmin) {
      restoreForm.value.overwriteSuperAdmin = false
    }

    let preservedSuperAdminIds = []
    let temporaryPreservedUserId = null

    if (restoreForm.value.mode === 'replace') {
      restoreProgress.value = '正在清空现有数据...'
      const clearResult = await $fetch('/api/admin/backup/clear', {
        method: 'POST',
        body: {
          overwriteSuperAdmin: restoreForm.value.overwriteSuperAdmin,
          hasSuperAdminInBackup: fileHasSuperAdmin
        }
      })
      if (!clearResult.success) throw new Error(clearResult.message || '清空数据失败')
      preservedSuperAdminIds = clearResult.preservedSuperAdminIds || []
      temporaryPreservedUserId = clearResult.temporaryPreservedUserId || null
    }

    const tableOrder = [
      'users',
      'userIdentities',
      'systemSettings',
      'semesters',
      'playTimes',
      'songs',
      'votes',
      'schedules',
      'notificationSettings',
      'notifications',
      'songBlacklist',
      'userStatusLogs'
    ]

    const mappings = {
      users: {},
      songs: {},
      meta: {
        preservedSuperAdminIds,
        temporaryPreservedUserId
      }
    }
    const CHUNK_SIZE = 50
    let totalProcessed = 0
    let totalRecords = 0

    for (const tableName of tableOrder) {
      if (backupData.data[tableName] && Array.isArray(backupData.data[tableName])) {
        totalRecords += backupData.data[tableName].length
      }
    }

    for (const tableName of tableOrder) {
      const records = backupData.data[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) continue

      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE)
        const progressPercent = Math.round((totalProcessed / totalRecords) * 100)
        restoreProgress.value = `正在恢复 ${tableName} (${i + 1}-${Math.min(i + CHUNK_SIZE, records.length)}/${records.length}) ${progressPercent}%`

        const response = await $fetch('/api/admin/backup/restore-chunk', {
          method: 'POST',
          body: {
            tableName,
            records: chunk,
            mappings,
            mode: restoreForm.value.mode,
            overwriteSuperAdmin: restoreForm.value.overwriteSuperAdmin,
            hasSuperAdminInBackup: fileHasSuperAdmin
          }
        })

        if (!response.success) throw new Error(response.message || `恢复表 ${tableName} 失败`)
        if (response.newMappings) {
          if (response.newMappings.users) Object.assign(mappings.users, response.newMappings.users)
          if (response.newMappings.songs) Object.assign(mappings.songs, response.newMappings.songs)
        }
        totalProcessed += chunk.length
      }
    }

    restoreProgress.value = '正在修复数据表序列...'
    const sequenceResult = await $fetch('/api/admin/fix-sequence', {
      method: 'POST',
      body: { table: 'all' }
    })
    if (!sequenceResult.success) {
      throw new Error(sequenceResult.message || sequenceResult.error || '序列修复失败')
    }

    restoreProgress.value = '正在重载SMTP配置...'
    const smtpReloadResult = await $fetch('/api/admin/smtp/reload', {
      method: 'POST'
    })
    if (!smtpReloadResult.success) {
      throw new Error(smtpReloadResult.message || 'SMTP配置重载失败')
    }

    const shouldFinalizeTempUser =
      restoreForm.value.mode === 'replace' &&
      restoreForm.value.overwriteSuperAdmin &&
      fileHasSuperAdmin &&
      temporaryPreservedUserId

    if (shouldFinalizeTempUser) {
      const restoredUserIds = Object.values(mappings.users).map((id) => Number(id))
      if (!restoredUserIds.includes(Number(temporaryPreservedUserId))) {
        restoreProgress.value = '正在完成管理员替换...'
        await $fetch('/api/admin/backup/clear', {
          method: 'POST',
          body: {
            finalizeTempUser: true
          }
        })
      }
      showNotification('数据库恢复成功，正在重新登录', 'success')
      activeModal.value = 'none'
      setTimeout(() => {
        if (auth.logout) {
          auth.logout()
        }
        localStorage.removeItem('auth-token')
        localStorage.removeItem('user-info')
        window.location.href = '/'
      }, 1200)
      return
    }

    showNotification('数据库恢复成功', 'success')
    activeModal.value = 'none'
  } catch (error) {
    console.error('恢复备份失败:', error)
    showNotification('恢复备份失败: ' + error.message, 'error')
  } finally {
    uploadLoading.value = false
    restoreProgress.value = ''
  }
}

const resetSequence = async () => {
  if (!sequenceForm.value.table) return
  sequenceLoading.value = true
  try {
    const tableValue = labelToValueMap[sequenceForm.value.table] || sequenceForm.value.table
    const response = await $fetch('/api/admin/fix-sequence', {
      method: 'POST',
      body: { table: tableValue }
    })
    if (response.success) {
      showNotification(response.message || '序列重置成功', 'success')
      activeModal.value = 'none'
    } else {
      throw new Error(response.error || response.message || '重置失败')
    }
  } catch (error) {
    console.error('重置序列失败:', error)
    showNotification('重置序列失败: ' + error.message, 'error')
  } finally {
    sequenceLoading.value = false
  }
}

const resetDatabase = async () => {
  if (resetConfirmText.value !== CONFIRM_CODE) return
  resetLoading.value = true
  try {
    const response = await $fetch('/api/admin/database/reset', { method: 'POST' })
    if (response.success) {
      showNotification('数据库已成功重置', 'success')
      activeModal.value = 'none'
      setTimeout(() => window.location.reload(), 1500)
    } else {
      throw new Error(response.message || '重置失败')
    }
  } catch (error) {
    console.error('重置数据库失败:', error)
    showNotification('重置数据库失败: ' + error.message, 'error')
  } finally {
    resetLoading.value = false
  }
}
</script>
