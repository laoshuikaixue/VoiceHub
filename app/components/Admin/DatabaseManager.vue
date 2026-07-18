<template>
  <div class="max-w-[1200px] mx-auto space-y-8 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="space-y-1">
      <h2 class="text-2xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h2>
      <p class="text-xs text-zinc-500 font-medium">
        {{ locale.desc }}
      </p>
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
              >{{ locale.highRisk }}</span
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
            <span v-if="isLoading(card.id)">{{ locale.executing }}</span>
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
        <p class="text-[11px] font-bold text-zinc-300">{{ locale.maintenanceTitle }}</p>
        <p class="text-[10px] text-zinc-500 leading-relaxed">
          {{ locale.maintenanceDesc }}
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
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.backupTitle }}</h3>
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
              {{ locale.selectContent }}
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
              {{ locale.backupHint }}
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="activeModal = 'none'"
          >
            {{ locale.cancel }}
          </button>
          <button
            :disabled="createLoading"
            class="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="createBackup"
          >
            {{ createLoading ? locale.exporting : locale.startExport }}
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
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.restoreTitle }}</h3>
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
              {{ selectedFile ? selectedFile.name : locale.selectFile }}
            </h5>
            <p class="text-[10px] text-zinc-600 font-bold uppercase mt-1 tracking-widest">
              {{ locale.fileHint }}
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
              >{{ locale.restoreMode }}</label
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
                  {{ locale.restoreModes?.merge?.title ?? '合并恢复' }}
                </h6>
                <p class="text-[9px] text-zinc-600 uppercase mt-0.5">{{ locale.restoreModes?.merge?.desc ?? '保留现有数据并合并备份内容' }}</p>
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
                  {{ locale.restoreModes?.replace?.title ?? '覆盖恢复' }}
                </h6>
                <p class="text-[9px] text-zinc-600 uppercase mt-0.5">{{ locale.restoreModes?.replace?.desc ?? '清除现有数据后恢复备份内容' }}</p>
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
                <p class="text-xs font-bold text-zinc-200">{{ locale.overwriteSuperAdmin }}</p>
                <p class="text-[10px] text-zinc-500 mt-1">
                  {{ locale.overwriteSuperAdminDesc }}
                </p>
              </div>
            </label>
          </div>

          <div
            class="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3"
          >
            <AlertCircle class="text-amber-500 shrink-0 mt-0.5 w-4 h-4" />
            <p class="text-[10px] text-zinc-500 leading-normal font-medium">
              {{ locale.replaceWarning }}
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="activeModal = 'none'"
          >
            {{ locale.cancel }}
          </button>
          <button
            :disabled="uploadLoading || !selectedFile"
            class="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="restoreBackup"
          >
            {{ uploadLoading ? restoreProgress || locale.restoring : locale.confirmRestore }}
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
          <h3 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.resetSequenceTitle }}</h3>
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
              >{{ locale.selectTargetTable }}</label
            >
            <CustomSelect
              v-model="sequenceForm.table"
              :options="locale.tableOptions || defaultTableOptions"
              label-key="label"
              value-key="value"
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
                {{ locale.sequenceHelpTitle }}
              </h6>
            </div>
            <p class="text-[11px] text-zinc-500 leading-relaxed font-medium">
              {{ locale.sequenceHelpDesc }}
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            @click="activeModal = 'none'"
          >
            {{ locale.cancel }}
          </button>
          <button
            :disabled="sequenceLoading || !sequenceForm.table"
            class="px-8 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            @click="resetSequence"
          >
            {{ sequenceLoading ? locale.resetting : locale.executeReset }}
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
          <h3 class="text-xl font-black text-rose-500 tracking-tight">{{ locale.dangerResetTitle }}</h3>
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
              {{ locale.dangerResetHeading }}
            </h4>
            <p class="text-xs text-zinc-500 mt-2 font-medium leading-relaxed">
              {{ locale.dangerResetPrefix }}
              <span class="text-zinc-300 font-bold"
                >{{ locale.dangerResetScope }}</span
              >。
            </p>
          </div>

          <div class="space-y-3">
            <label
              class="text-[11px] font-black text-rose-500/80 uppercase tracking-widest px-1 flex items-center justify-center gap-2"
            >
              {{ locale.confirmCodeLabel }}
            </label>
            <div
              class="bg-zinc-950 border border-rose-900/30 rounded-xl px-4 py-3 font-mono text-[10px] text-rose-400 text-center select-all"
            >
              {{ CONFIRM_CODE }}
            </div>
            <input
              v-model="resetConfirmText"
              type="text"
              :placeholder="locale.confirmCodePlaceholder"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-rose-500/40 text-center font-mono placeholder:text-zinc-700"
            >
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button
              class="py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-xs font-black rounded-xl transition-all uppercase tracking-widest"
              @click="activeModal = 'none'"
            >
              {{ locale.cancel }}
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
              {{ resetLoading ? locale.resetting : locale.confirmResetDatabase }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Download, Upload, RotateCw, Trash2, AlertCircle, X } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useToast } from '~/composables/useToast'
import { useAuth } from '~/composables/useAuth'
import { useLocale } from '~/utils/locale'

const { showToast: showNotification } = useToast()
const auth = useAuth()
const { admin } = useLocale()
const locale = computed(() => admin.value?.databaseManager || {})
const defaultTableOptions = [
  { label: '重置所有表', value: 'all' },
  { label: '歌曲表', value: 'Song' },
  { label: '用户表', value: 'User' },
  { label: '用户身份表', value: 'UserIdentity' },
  { label: '用户状态日志表', value: 'UserStatusLog' },
  { label: '投票表', value: 'Vote' },
  { label: '排期表', value: 'Schedule' },
  { label: '通知表', value: 'Notification' },
  { label: '通知设置表', value: 'NotificationSettings' },
  { label: '播放时段表', value: 'PlayTime' },
  { label: '学期表', value: 'Semester' },
  { label: '系统设置表', value: 'SystemSettings' },
  { label: '歌曲黑名单表', value: 'SongBlacklist' },
  { label: '歌曲重播申请表', value: 'SongReplayRequest' },
  { label: '投稿时段表', value: 'RequestTime' },
  { label: '邮件模板表', value: 'EmailTemplate' }
]
const getMessage = (key) => locale.value?.messages?.[key] ?? `数据库操作：${key}`
const getLogMessage = (key) => locale.value?.logs?.[key] || key
const formatString = (value, args) => {
  if (typeof value !== 'string') return value
  return value.replace(/{(\d+)}/g, (match, index) =>
    args[index] !== undefined ? String(args[index]) : match
  )
}
const getErrorMessage = (key, ...args) => {
  const message = locale.value?.errors?.[key]
  if (typeof message === 'function') return message(...args)
  return formatString(message, args) || args.find(Boolean) || key
}
const getProgressMessage = (key, ...args) => {
  const message = locale.value?.progress?.[key]
  if (typeof message === 'function') return message(...args)
  return formatString(message, args) || `数据库操作进行中：${key}`
}

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
const cards = computed(() => [
  {
    id: 'backup',
    title: locale.value?.cards?.backup?.title ?? '备份数据库',
    desc: locale.value?.cards?.backup?.desc ?? '导出系统数据备份文件',
    icon: Download,
    color: 'blue',
    btnText: locale.value?.cards?.backup?.button ?? '创建备份'
  },
  {
    id: 'restore',
    title: locale.value?.cards?.restore?.title ?? '恢复数据库',
    desc: locale.value?.cards?.restore?.desc ?? '从备份文件恢复系统数据',
    icon: Upload,
    color: 'emerald',
    btnText: locale.value?.cards?.restore?.button ?? '恢复备份'
  },
  {
    id: 'reset-seq',
    title: locale.value?.cards?.resetSeq?.title ?? '修复数据序列',
    desc: locale.value?.cards?.resetSeq?.desc ?? '修复数据表自增序列',
    icon: RotateCw,
    color: 'amber',
    btnText: locale.value?.cards?.resetSeq?.button ?? '修复序列'
  },
  {
    id: 'reset-db',
    title: locale.value?.cards?.resetDb?.title ?? '重置数据库',
    desc: locale.value?.cards?.resetDb?.desc ?? '清空除管理员外的系统数据',
    icon: Trash2,
    color: 'rose',
    btnText: locale.value?.cards?.resetDb?.button ?? '重置数据库',
    isDanger: true
  }
])

// 备份选项
const backupOptions = computed(() => [
  {
    key: 'includeSongs',
    label: locale.value?.backupOptions?.songs?.label ?? '歌曲与排期数据',
    desc: locale.value?.backupOptions?.songs?.desc ?? '包含歌曲、投稿及排期数据'
  },
  {
    key: 'includeSystemData',
    label: locale.value?.backupOptions?.system?.label ?? '系统配置',
    desc: locale.value?.backupOptions?.system?.desc ?? '包含站点设置和全局参数'
  },
  {
    key: 'includeUsers',
    label: locale.value?.backupOptions?.users?.label ?? '用户账户',
    desc: locale.value?.backupOptions?.users?.desc ?? '包含用户账户和权限数据'
  }
])

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
  table: 'all'
})

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
    showNotification(getMessage('parseBackupFailed'), 'error')
    console.error(getLogMessage('parseBackupFailed'), error)
  }
}

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
    await parseBackupSuperAdmin(file)
  } else {
    showNotification(getMessage('invalidJsonFile'), 'error')
  }
}

const handleFileDrop = async (event) => {
  const file = event.dataTransfer.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
    await parseBackupSuperAdmin(file)
  } else {
    showNotification(getMessage('invalidJsonFile'), 'error')
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
      throw new Error(getErrorMessage('noBackupContent'))
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
        showNotification(getMessage('backupDownloaded'), 'success')
        activeModal.value = 'none'
      } else if (response.backup.downloadMode === 'file' && response.backup.filename) {
        const downloadUrl = `/api/admin/backup/download/${response.backup.filename}`
        const downloadResponse = await fetch(downloadUrl, {
          method: 'GET',
          credentials: 'include'
        })
        if (!downloadResponse.ok) throw new Error(getErrorMessage('downloadFailed', downloadResponse.status))
        const blob = await downloadResponse.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = response.backup.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showNotification(getMessage('backupDownloaded'), 'success')
        activeModal.value = 'none'
      }
    } else {
      throw new Error(response.message || getErrorMessage('createBackupFailed'))
    }
  } catch (error) {
    console.error(getLogMessage('createBackupFailed'), error)
    showNotification(getErrorMessage('createBackupFailedWithMessage', error?.message), 'error')
  } finally {
    createLoading.value = false
  }
}

const restoreBackup = async () => {
  if (!selectedFile.value) return showNotification(getMessage('selectBackupFile'), 'error')

  uploadLoading.value = true
  restoreProgress.value = getProgressMessage('readingFile')

  try {
    const fileContent = await selectedFile.value.text()
    let backupData
    try {
      backupData = JSON.parse(fileContent)
    } catch {
      throw new Error(getErrorMessage('invalidBackupFormat'))
    }

    if (!backupData.data) throw new Error(getErrorMessage('missingBackupData'))
    const fileHasSuperAdmin = hasSuperAdminInBackup.value
    if (!fileHasSuperAdmin) {
      restoreForm.value.overwriteSuperAdmin = false
    }

    let preservedSuperAdminIds = []
    let temporaryPreservedUserId = null

    if (restoreForm.value.mode === 'replace') {
      restoreProgress.value = getProgressMessage('clearingData')
      const clearResult = await $fetch('/api/admin/backup/clear', {
        method: 'POST',
        body: {
          overwriteSuperAdmin: restoreForm.value.overwriteSuperAdmin,
          hasSuperAdminInBackup: fileHasSuperAdmin
        }
      })
      if (!clearResult.success) throw new Error(clearResult.message || getErrorMessage('clearDataFailed'))
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
        restoreProgress.value = getProgressMessage(
          'restoringTable',
          tableName,
          i + 1,
          Math.min(i + CHUNK_SIZE, records.length),
          records.length,
          progressPercent
        )

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

        if (!response.success) throw new Error(response.message || getErrorMessage('restoreTableFailed', tableName))
        if (response.newMappings) {
          if (response.newMappings.users) Object.assign(mappings.users, response.newMappings.users)
          if (response.newMappings.songs) Object.assign(mappings.songs, response.newMappings.songs)
        }
        totalProcessed += chunk.length
      }
    }

    restoreProgress.value = getProgressMessage('fixingSequence')
    const sequenceResult = await $fetch('/api/admin/fix-sequence', {
      method: 'POST',
      body: { table: 'all' }
    })
    if (!sequenceResult.success) {
      throw new Error(sequenceResult.message || sequenceResult.error || getErrorMessage('fixSequenceFailed'))
    }

    restoreProgress.value = getProgressMessage('reloadingSmtp')
    const smtpReloadResult = await $fetch('/api/admin/smtp/reload', {
      method: 'POST'
    })
    if (!smtpReloadResult.success) {
      throw new Error(smtpReloadResult.message || getErrorMessage('smtpReloadFailed'))
    }

    const shouldFinalizeTempUser =
      restoreForm.value.mode === 'replace' &&
      restoreForm.value.overwriteSuperAdmin &&
      fileHasSuperAdmin &&
      temporaryPreservedUserId

    if (shouldFinalizeTempUser) {
      const restoredUserIds = Object.values(mappings.users).map((id) => Number(id))
      if (!restoredUserIds.includes(Number(temporaryPreservedUserId))) {
        restoreProgress.value = getProgressMessage('finalizingAdmin')
        await $fetch('/api/admin/backup/clear', {
          method: 'POST',
          body: {
            finalizeTempUser: true
          }
        })
      }
      showNotification(getMessage('restoreSuccessRelogin'), 'success')
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

    showNotification(getMessage('restoreSuccess'), 'success')
    activeModal.value = 'none'
  } catch (error) {
    console.error(getLogMessage('restoreBackupFailed'), error)
    showNotification(getErrorMessage('restoreBackupFailedWithMessage', error?.message), 'error')
  } finally {
    uploadLoading.value = false
    restoreProgress.value = ''
  }
}

const resetSequence = async () => {
  if (!sequenceForm.value.table) return
  sequenceLoading.value = true
  try {
    const response = await $fetch('/api/admin/fix-sequence', {
      method: 'POST',
      body: { table: sequenceForm.value.table }
    })
    if (response.success) {
      showNotification(response.message || getMessage('sequenceResetSuccess'), 'success')
      activeModal.value = 'none'
    } else {
      throw new Error(response.error || response.message || getErrorMessage('resetFailed'))
    }
  } catch (error) {
    console.error(getLogMessage('resetSequenceFailed'), error)
    showNotification(getErrorMessage('resetSequenceFailedWithMessage', error?.message), 'error')
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
      showNotification(getMessage('databaseResetSuccess'), 'success')
      activeModal.value = 'none'
      setTimeout(() => window.location.reload(), 1500)
    } else {
      throw new Error(response.message || getErrorMessage('resetFailed'))
    }
  } catch (error) {
    console.error(getLogMessage('resetDatabaseFailed'), error)
    showNotification(getErrorMessage('resetDatabaseFailedWithMessage', error?.message), 'error')
  } finally {
    resetLoading.value = false
  }
}
</script>
