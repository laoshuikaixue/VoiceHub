<template>
  <div class="max-w-[1200px] mx-auto space-y-8 pb-20 px-2">
    <!-- 页面标题 -->
    <div class="space-y-1">
      <h2 class="text-2xl font-black text-zinc-100 tracking-tight">数据库操作</h2>
      <p class="text-xs text-zinc-500 font-medium">
        执行系统底层维护任务，包括备份、恢复及全局数据重置
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
              v-model:value="sequenceForm.table"
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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download, Upload, RotateCw, Trash2, AlertCircle, FileJson, X } from 'lucide-vue-next'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useToast } from '~/composables/useToast'
import { useAuth } from '~/composables/useAuth'

const { showToast: showNotification } = useToast()

// 状态
const activeModal = ref('none')
const createLoading = ref(false)
const uploadLoading = ref(false)
const sequenceLoading = ref(false)
const resetLoading = ref(false)
const selectedFile = ref(null)
const resetConfirmText = ref('')
const restoreProgress = ref('')
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
  mode: 'merge'
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
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
  } else {
    showNotification('请选择有效的JSON备份文件', 'error')
  }
}

const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0]
  if (file && file.type === 'application/json') {
    selectedFile.value = file
  } else {
    showNotification('请选择有效的JSON备份文件', 'error')
  }
}

// API 操作
const createBackup = async () => {
  createLoading.value = true
  try {
    const response = await $fetch('/api/admin/backup/export', {
      method: 'POST',
      body: {
        tables:
          createForm.value.includeUsers && createForm.value.includeSongs
            ? 'all'
            : createForm.value.includeUsers
              ? 'users'
              : createForm.value.includeSongs
                ? 'songs'
                : 'all',
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
    } catch (e) {
      throw new Error('无法解析备份文件，文件格式不正确')
    }

    if (!backupData.data) throw new Error('备份文件缺少数据部分')

    if (restoreForm.value.mode === 'replace') {
      restoreProgress.value = '正在清空现有数据...'
      const clearResult = await $fetch('/api/admin/backup/clear', { method: 'POST' })
      if (!clearResult.success) throw new Error(clearResult.message || '清空数据失败')
    }

    const tableOrder = [
      'users',
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

    const mappings = { users: {}, songs: {} }
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
            mode: restoreForm.value.mode
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
