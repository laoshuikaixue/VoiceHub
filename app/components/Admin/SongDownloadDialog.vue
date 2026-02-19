<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click="closeDialog"
    >
      <Transition name="scale">
        <div
          v-if="show"
          class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
            <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">下载歌曲</h3>
            <button
              class="text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="closeDialog"
            >
              <CloseIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <!-- 音质选择 -->
            <section class="space-y-3">
              <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] px-1"
                >选择音质</label
              >
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="option in extendedQualityOptions"
                  :key="option.value"
                  class="flex flex-col p-4 rounded-2xl border text-left transition-all relative overflow-hidden group"
                  :class="[
                    selectedQuality === option.value
                      ? 'bg-blue-600/10 border-blue-500 shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  ]"
                  @click="selectedQuality = option.value"
                >
                  <div class="flex items-center justify-between mb-1 relative z-10">
                    <span
                      class="text-xs font-bold transition-colors"
                      :class="selectedQuality === option.value ? 'text-blue-400' : 'text-zinc-200'"
                      >{{ option.label }}</span
                    >
                    <div
                      v-if="selectedQuality === option.value"
                      class="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                  <span class="text-[10px] text-zinc-500 relative z-10">{{
                    option.description
                  }}</span>
                </button>
              </div>
            </section>

            <!-- 高级选项 (合并与标准化) - 仅当选择超过1首歌曲时显示 -->
            <Transition name="expand">
              <section v-if="selectedSongs.size > 1" class="space-y-3 overflow-hidden">
                <div class="flex items-center gap-2 px-1">
                  <Settings2 class="w-3 h-3 text-zinc-500" />
                  <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]"
                    >高级选项</label
                  >
                </div>

                <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  <!-- 合并开关 -->
                  <div class="flex items-center justify-between">
                    <div class="flex flex-col">
                      <span class="text-xs font-bold text-zinc-200">合并为一个文件</span>
                      <span class="text-[10px] text-zinc-500">将选中歌曲按顺序合并为单个音频</span>
                    </div>
                    <button
                      class="w-10 h-6 rounded-full transition-colors relative"
                      :class="mergeSongs ? 'bg-blue-600' : 'bg-zinc-700'"
                      @click="mergeSongs = !mergeSongs"
                    >
                      <div
                        class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                        :class="mergeSongs ? 'translate-x-4' : 'translate-x-0'"
                      />
                    </button>
                  </div>

                  <!-- 合并设置区域 -->
                  <Transition name="expand">
                    <div v-if="mergeSongs" class="space-y-4 pt-4 border-t border-zinc-800/50">
                      <!-- 导出格式选择 -->
                      <div class="space-y-2">
                        <div class="flex items-center gap-2">
                          <Music class="w-3 h-3 text-zinc-500" />
                          <span class="text-xs font-bold text-zinc-200">导出格式</span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            class="flex-1 py-1.5 px-3 rounded-lg border text-[10px] font-bold transition-all"
                            :class="
                              exportFormat === 'mp3'
                                ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            "
                            @click="exportFormat = 'mp3'"
                          >
                            MP3
                          </button>
                          <button
                            class="flex-1 py-1.5 px-3 rounded-lg border text-[10px] font-bold transition-all"
                            :class="
                              exportFormat === 'wav'
                                ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            "
                            @click="exportFormat = 'wav'"
                          >
                            WAV
                          </button>
                        </div>
                      </div>

                      <!-- 自定义文件名 -->
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <Edit3 class="w-3 h-3 text-zinc-500" />
                            <span class="text-xs font-bold text-zinc-200">自定义文件名</span>
                          </div>
                          <button
                            class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            :class="{ 'opacity-50 cursor-not-allowed': !customFilename }"
                            title="保存为默认预设"
                            @click="saveFilenamePreset"
                          >
                            <Save class="w-3 h-3" />
                            {{ showPresetSaved ? '已保存!' : '保存预设' }}
                          </button>
                        </div>
                        <div class="relative">
                          <input
                            v-model="customFilename"
                            type="text"
                            placeholder="例如: 第XX期 - {songs}"
                            class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors pr-8"
                          >
                          <!-- 快速插入占位符按钮 -->
                          <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <button
                              class="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                              title="插入所有歌名"
                              @click="insertPlaceholder('{songs}')"
                            >
                              {songs}
                            </button>
                            <button
                              class="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                              title="插入当前日期"
                              @click="insertPlaceholder('{date}')"
                            >
                              {date}
                            </button>
                          </div>
                        </div>
                        <p class="text-[9px] text-zinc-600">
                          可用占位符:
                          <code
                            class="bg-zinc-800 px-1 rounded text-zinc-400 cursor-pointer hover:text-blue-400"
                            @click="insertPlaceholder('{songs}')"
                            >{songs}</code
                          >
                          (所有歌名),
                          <code
                            class="bg-zinc-800 px-1 rounded text-zinc-400 cursor-pointer hover:text-blue-400"
                            @click="insertPlaceholder('{date}')"
                            >{date}</code
                          >
                          (日期)
                        </p>
                      </div>

                      <!-- 标准化选项 (仅在合并模式或需要时显示，这里允许单独使用) -->
                      <div
                        class="flex items-center justify-between pt-3 border-t border-zinc-800/50"
                      >
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-zinc-200">统一音量 (标准化)</span>
                            <span
                              v-if="normalizeAudio"
                              class="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20"
                              >Peak {{ targetDb }}dB</span
                            >
                          </div>
                          <span class="text-[10px] text-zinc-500"
                            >将所有音频峰值调整至统一标准</span
                          >
                        </div>
                        <div class="flex items-center gap-3">
                          <button
                            v-if="normalizeAudio"
                            class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            title="保存当前音量设置为默认"
                            @click="saveDbPreset"
                          >
                            <Save class="w-3 h-3" />
                            {{ showDbPresetSaved ? '已保存!' : '保存预设' }}
                          </button>
                          <button
                            class="w-10 h-6 rounded-full transition-colors relative"
                            :class="normalizeAudio ? 'bg-blue-600' : 'bg-zinc-700'"
                            @click="normalizeAudio = !normalizeAudio"
                          >
                            <div
                              class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                              :class="normalizeAudio ? 'translate-x-4' : 'translate-x-0'"
                            />
                          </button>
                        </div>
                      </div>

                      <!-- 目标分贝设置 -->
                      <Transition name="expand">
                        <div v-if="normalizeAudio" class="pt-2">
                          <div class="flex items-center gap-3">
                            <Volume2 class="w-4 h-4 text-zinc-500" />
                            <input
                              v-model.number="targetDb"
                              type="range"
                              min="-10"
                              max="0"
                              step="0.5"
                              class="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                            >
                            <span class="text-xs font-mono text-zinc-300 w-12 text-right"
                              >{{ targetDb }} dB</span
                            >
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </Transition>
                </div>
              </section>
            </Transition>

            <!-- 歌曲选择 -->
            <section class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-3">
                  <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]"
                    >歌曲列表</label
                  >
                  <div
                    v-if="estimatedTotalDuration.count > 0"
                    class="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20"
                  >
                    <Clock class="w-3 h-3" />
                    <span>预估总时长: {{ formatDuration(estimatedTotalDuration.total) }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="selectedSongs.size > 0"
                    class="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                    title="预下载选中歌曲到浏览器缓存"
                    @click="preloadSelectedSongs"
                  >
                    <DownloadCloud class="w-3 h-3" />
                    预下载选中
                  </button>
                  <button
                    class="text-[10px] font-bold text-blue-500/80 hover:text-blue-400 transition-colors"
                    @click="toggleSelectAll"
                  >
                    {{ isAllSelected ? '取消全选' : '全选' }}
                  </button>
                </div>
              </div>

              <div
                class="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar"
              >
                <div
                  v-for="song in songs"
                  :key="song.id"
                  class="w-full flex items-center gap-3 p-3.5 hover:bg-zinc-800/30 transition-all text-left border-b border-zinc-800/30 last:border-0 group relative"
                >
                  <!-- 预下载进度条背景 -->
                  <div
                    v-if="
                      preloadedSongs.has(song.song.id) && preloadedSongs.get(song.song.id).loading
                    "
                    class="absolute bottom-0 left-0 h-0.5 bg-blue-500/50 transition-all duration-300 ease-out"
                    :style="{ width: `${preloadedSongs.get(song.song.id).progress}%` }"
                  />

                  <button
                    class="flex items-center justify-center shrink-0 w-4 h-4 rounded border transition-all"
                    :class="[
                      selectedSongs.has(song.song.id)
                        ? 'bg-blue-600 border-blue-600 shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 group-hover:border-zinc-700'
                    ]"
                    @click="toggleSongSelection(song.song.id)"
                  >
                    <Check
                      v-if="selectedSongs.has(song.song.id)"
                      class="w-2.5 h-2.5 text-white font-bold"
                      stroke-width="3"
                    />
                  </button>

                  <div
                    class="flex-1 min-w-0 flex flex-col cursor-pointer"
                    @click="toggleSongSelection(song.song.id)"
                  >
                    <div class="flex items-center gap-2">
                      <p class="text-xs font-bold text-zinc-300 truncate">{{ song.song.title }}</p>
                      <!-- 预下载标记 -->
                      <div
                        v-if="
                          preloadedSongs.has(song.song.id) &&
                          !preloadedSongs.get(song.song.id).loading
                        "
                        class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20"
                      >
                        <Check class="w-2 h-2 text-green-400" />
                        <span class="text-[9px] font-mono text-green-400">{{
                          formatDuration(preloadedSongs.get(song.song.id).duration)
                        }}</span>
                      </div>
                    </div>
                    <p class="text-[10px] text-zinc-500 truncate">{{ song.song.artist }}</p>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="text-[9px] font-mono text-zinc-600 uppercase">
                      {{ getPlatformShortName(song.song.musicPlatform) }}
                    </div>

                    <!-- 单个预下载/删除按钮 -->
                    <button
                      v-if="preloadedSongs.has(song.song.id)"
                      class="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                      title="删除缓存"
                      @click.stop="removePreloaded(song.song.id)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      v-else
                      class="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-600 hover:text-blue-400 transition-colors"
                      title="预下载此歌曲"
                      @click.stop="preloadSong(song.song)"
                    >
                      <DownloadCloud class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div v-if="songs.length === 0" class="p-8 text-center text-zinc-600 text-[10px]">
                  暂无歌曲
                </div>
              </div>
            </section>

            <!-- 下载进度 -->
            <section
              v-if="downloading || downloadedCount > 0"
              class="space-y-3 pt-4 border-t border-zinc-800/50"
            >
              <div
                class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider"
              >
                <span class="text-zinc-400">{{ mergeSongs ? '处理进度' : '下载进度' }}</span>
                <span class="text-blue-400">{{ downloadedCount }} / {{ totalCount }}</span>
              </div>
              <div
                class="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 relative"
              >
                <div
                  class="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 ease-out relative overflow-hidden"
                  :style="{
                    width: `${totalCount > 0 ? (downloadedCount / totalCount) * 100 : 0}%`
                  }"
                >
                  <div
                    class="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] -skew-x-12"
                  />
                </div>
              </div>
              <div class="text-[10px] text-zinc-500 truncate">
                <template v-if="downloading">
                  <span v-if="processingStatus" class="text-blue-400 animate-pulse">{{
                    processingStatus
                  }}</span>
                  <span v-else>{{
                    currentDownloadSong ? `正在下载: ${currentDownloadSong}` : '准备中...'
                  }}</span>
                </template>
                <template v-else>
                  {{ downloadErrors.length > 0 ? '下载完成，部分失败' : '下载完成' }}
                </template>
              </div>

              <!-- 错误列表 -->
              <div
                v-if="downloadErrors.length > 0"
                class="bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-2"
              >
                <div class="text-[10px] font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle class="w-3 h-3" />
                  下载失败 ({{ downloadErrors.length }})
                </div>
                <div class="max-h-[60px] overflow-y-auto custom-scrollbar space-y-1">
                  <div
                    v-for="error in downloadErrors"
                    :key="error.id"
                    class="text-[9px] text-red-500/70 truncate"
                  >
                    {{ error.title }} - {{ error.error }}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- 底部按钮 -->
          <div
            class="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0"
          >
            <div class="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
              已选择 <span class="text-blue-400">{{ selectedSongs.size }}</span> 首歌曲
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
                :disabled="downloading"
                @click="closeDialog"
              >
                取消
              </button>
              <button
                v-if="!downloading && downloadedCount > 0"
                class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all uppercase tracking-wider"
                @click="closeDialog"
              >
                关闭
              </button>
              <button
                v-else
                :disabled="selectedSongs.size === 0 || downloading"
                class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all uppercase tracking-wider flex items-center gap-2"
                @click="startDownload"
              >
                <Download v-if="!downloading" class="w-3.5 h-3.5" />
                <span
                  v-else
                  class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                />
                {{
                  downloading
                    ? mergeSongs
                      ? '处理中...'
                      : '下载中...'
                    : mergeSongs
                      ? '开始处理'
                      : '开始下载'
                }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch, onMounted, reactive } from 'vue'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { getMusicUrl } from '~/utils/musicUrl'
import {
  X as CloseIcon,
  Check,
  Download,
  AlertTriangle,
  Settings2,
  Volume2,
  Edit3,
  Save,
  Music,
  DownloadCloud,
  Trash2,
  Clock
} from 'lucide-vue-next'
import { Mp3Encoder } from '@breezystack/lamejs'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  songs: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close'])

// 音质相关
const { getQualityOptions, getQuality } = useAudioQuality()

// 合并与处理选项
const mergeSongs = ref(false)
const normalizeAudio = ref(false)
const targetDb = ref(-1.0)
const processingStatus = ref('')
const customFilename = ref('')
const showPresetSaved = ref(false)
const showDbPresetSaved = ref(false)
const exportFormat = ref('mp3') // 'mp3' or 'wav'

// 音质描述映射
const qualityDescriptions = {
  standard: '节省流量',
  higher: '高品质体验',
  exhigh: '极高音质',
  lossless: '母带级音质',
  hires: '极点解析'
}

// 扩展音质选项，添加描述
const extendedQualityOptions = computed(() => {
  const options = getQualityOptions('netease')
  return options.map((opt) => ({
    ...opt,
    description: qualityDescriptions[opt.value] || '标准音质'
  }))
})

const selectedQuality = ref(getQuality('netease'))

// 歌曲选择
const selectedSongs = ref(new Set())

// 是否全选
const isAllSelected = computed(() => {
  return props.songs.length > 0 && selectedSongs.value.size === props.songs.length
})

// 下载状态
const downloading = ref(false)
const downloadedCount = ref(0)
const totalCount = ref(0)
const currentDownloadSong = ref('')
const downloadErrors = ref([])
const preloadedSongs = reactive(new Map()) // songId -> { blob, duration, loading, progress }

// 获取平台简写
const getPlatformShortName = (platform) => {
  switch (platform) {
    case 'netease':
      return 'WY'
    case 'netease-podcast':
      return 'DJ'
    case 'tencent':
      return 'QQ'
    case 'bilibili':
      return 'BL'
    default:
      return 'OT'
  }
}

// 格式化时长
const formatDuration = (seconds) => {
  if (!seconds) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// 预下载单个歌曲
const preloadSong = async (song) => {
  if (preloadedSongs.has(song.id) && !preloadedSongs.get(song.id).loading) return

  preloadedSongs.set(song.id, { loading: true, progress: 0 })

  try {
    const url = await getMusicUrlForDownload(song, selectedQuality.value)

    // 使用 fetch 获取并追踪进度
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0
    let loaded = 0

    const reader = response.body.getReader()
    const chunks = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loaded += value.length

      if (total) {
        // 更新进度
        const progress = (loaded / total) * 100
        const current = preloadedSongs.get(song.id)
        if (current) {
          current.progress = progress
        }
      }
    }

    const blob = new Blob(chunks, { type: 'audio/mpeg' }) // 假设是音频，具体类型可能需要根据响应头判断

    // 获取时长
    const duration = await new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(blob))
      audio.onloadedmetadata = () => {
        resolve(audio.duration)
        URL.revokeObjectURL(audio.src)
      }
      audio.onerror = () => resolve(0)
    })

    preloadedSongs.set(song.id, {
      blob,
      duration,
      loading: false,
      progress: 100
    })
  } catch (error) {
    console.error('预下载失败:', error)
    preloadedSongs.delete(song.id)
    if (window.$showNotification) {
      window.$showNotification(`预下载失败: ${song.title}`, 'error')
    }
  }
}

// 批量预下载选中歌曲
const preloadSelectedSongs = async () => {
  if (selectedSongs.value.size === 0) return

  const songsToLoad = props.songs.filter(
    (s) => selectedSongs.value.has(s.song.id) && !preloadedSongs.has(s.song.id)
  )

  for (const songItem of songsToLoad) {
    await preloadSong(songItem.song)
  }
}

// 删除预下载缓存
const removePreloaded = (songId) => {
  preloadedSongs.delete(songId)
}

// 获取总时长估算
const estimatedTotalDuration = computed(() => {
  let total = 0
  let count = 0
  selectedSongs.value.forEach((id) => {
    const data = preloadedSongs.get(id)
    if (data && data.duration) {
      total += data.duration
      count++
    }
  })
  return { total, count }
})

// 切换全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSongs.value = new Set()
  } else {
    selectedSongs.value = new Set(props.songs.map((song) => song.song.id))
  }
}

// 切换歌曲选择状态
const toggleSongSelection = (songId) => {
  if (selectedSongs.value.has(songId)) {
    selectedSongs.value.delete(songId)
  } else {
    selectedSongs.value.add(songId)
  }
}

// 关闭对话框
const closeDialog = () => {
  // 即使在下载中也可以关闭（后台运行），但如果下载中，不触发close事件，而是隐藏
  emit('close')
}

// 获取音乐播放URL（直接使用utils中的统一方法）
const getMusicUrlForDownload = async (song, quality, retryCount = 0) => {
  try {
    // 检查是否为播客内容
    const isPodcast =
      song.musicPlatform === 'netease-podcast' ||
      song.sourceInfo?.type === 'voice' ||
      (song.sourceInfo?.source === 'netease-backup' && song.sourceInfo?.type === 'voice')
    const options = isPodcast ? { unblock: false } : {}

    // 直接调用统一的getMusicUrl方法，它会自动处理playUrl优先级
    const url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl, options)
    if (!url) {
      throw new Error('无法获取音乐播放链接')
    }
    return url
  } catch (error) {
    console.error('获取音乐播放链接失败:', error)

    // 如果是第一次失败且有音乐平台信息，则自动重试一次
    if (retryCount === 0 && song.musicPlatform && song.musicId) {
      console.log(`正在重试获取音乐链接: ${song.musicPlatform}, ${song.musicId}`)
      await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒后重试
      return getMusicUrlForDownload(song, quality, 1)
    }

    throw new Error('获取音乐播放链接失败: ' + error.message)
  }
}

// 获取 Blob 数据 (不触发下载)
const downloadAsBlob = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.blob()
}

// 下载单个文件 (保存)
const saveFile = (blob, filename) => {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)
}

// 音频处理与合并
const processAndMergeAudio = async (selectedSongsList) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffers = []

  try {
    // 1. 下载并解码所有音频
    for (let i = 0; i < selectedSongsList.length; i++) {
      const songItem = selectedSongsList[i]
      const song = songItem.song

      currentDownloadSong.value = `${song.artist} - ${song.title}`
      processingStatus.value = `正在下载 (${i + 1}/${selectedSongsList.length}): ${song.title}`

      try {
        let arrayBuffer

        // 检查是否有预下载缓存
        if (preloadedSongs.has(song.id) && !preloadedSongs.get(song.id).loading) {
          console.log(`使用预下载缓存: ${song.title}`)
          const cached = preloadedSongs.get(song.id)
          arrayBuffer = await cached.blob.arrayBuffer()
        } else {
          const audioUrl = await getMusicUrlForDownload(song, selectedQuality.value)
          const blob = await downloadAsBlob(audioUrl)
          arrayBuffer = await blob.arrayBuffer()
        }

        processingStatus.value = `正在解码: ${song.title}`
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // 标准化处理
        if (normalizeAudio.value) {
          processingStatus.value = `正在标准化: ${song.title}`
          normalizeBuffer(audioBuffer, targetDb.value)
        }

        audioBuffers.push(audioBuffer)
        downloadedCount.value++
      } catch (error) {
        console.error(`处理失败: ${song.title}`, error)
        downloadErrors.value.push({
          id: song.id,
          title: song.title,
          artist: song.artist,
          error: error.message
        })
      }
    }

    if (audioBuffers.length === 0) throw new Error('没有成功处理的音频')

    // 2. 合并音频
    processingStatus.value = '正在合并音频...'
    await new Promise((r) => setTimeout(r, 100)) // UI update

    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0)
    const numberOfChannels = 2 // 强制立体声
    const sampleRate = audioBuffers[0].sampleRate // 使用第一个音频的采样率

    const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate)

    let offset = 0
    for (const buffer of audioBuffers) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const mergedChannelData = mergedBuffer.getChannelData(channel)

        // 如果源音频是单声道，复制到两个声道；如果是立体声，对应复制
        if (buffer.numberOfChannels === 1) {
          mergedChannelData.set(buffer.getChannelData(0), offset)
        } else if (channel < buffer.numberOfChannels) {
          mergedChannelData.set(buffer.getChannelData(channel), offset)
        } else {
          // 如果源音频声道少于目标声道（例如源只有左声道? 不太可能，通常单声道是1ch），补静音或复制声道0
          // 这里简单处理：如果源没有该声道，则复制第一声道
          mergedChannelData.set(buffer.getChannelData(0), offset)
        }
      }
      offset += buffer.length
    }

    // 3. 编码/导出
    processingStatus.value =
      exportFormat.value === 'mp3' ? '正在编码 MP3 (可能需要一些时间)...' : '正在生成 WAV...'
    await new Promise((r) => setTimeout(r, 100))

    let resultBlob
    let extension

    if (exportFormat.value === 'mp3') {
      resultBlob = await encodeToMp3(mergedBuffer)
      extension = 'mp3'
    } else {
      resultBlob = encodeToWav(mergedBuffer)
      extension = 'wav'
    }

    // 4. 下载合并后的文件
    let filename
    if (customFilename.value && customFilename.value.trim()) {
      filename = customFilename.value.trim()

      // 替换占位符
      const dateStr = new Date().toISOString().split('T')[0]
      const allSongsStr = selectedSongsList.map((item) => item.song.title).join(' ')

      filename = filename.replace(/{date}/g, dateStr)
      filename = filename.replace(/{songs}/g, allSongsStr)

      // 移除非法字符
      filename = filename.replace(/[<>:"/\\|?*]/g, '_')

      // 确保后缀正确
      const extRegex = new RegExp(`\\.${extension}$`, 'i')
      if (!extRegex.test(filename)) {
        // 如果没有后缀或者后缀不对，强制添加/替换
        // 简单处理：直接追加，除非已经以 .mp3/.wav 结尾
        if (filename.toLowerCase().endsWith('.mp3')) {
          filename = filename.slice(0, -4) + '.' + extension
        } else if (filename.toLowerCase().endsWith('.wav')) {
          filename = filename.slice(0, -4) + '.' + extension
        } else {
          filename += '.' + extension
        }
      }
    } else {
      const dateStr = new Date().toISOString().split('T')[0]
      filename = `排期合并_${dateStr}_${selectedSongsList.length}首.${extension}`
    }

    // 更新状态显示为最终文件名
    processingStatus.value = `处理完成: ${filename}`
    // 清除当前下载歌曲显示，避免误导
    currentDownloadSong.value = ''

    saveFile(resultBlob, filename)
  } catch (error) {
    console.error('合并过程出错:', error)
    if (window.$showNotification) {
      window.$showNotification('合并失败: ' + error.message, 'error')
    }
  } finally {
    audioContext.close()
    processingStatus.value = ''
  }
}

// 标准化 Buffer
const normalizeBuffer = (buffer, targetDbValue) => {
  const targetGain = Math.pow(10, targetDbValue / 20)
  let maxPeak = 0

  // 寻找峰值
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > maxPeak) maxPeak = abs
    }
  }

  if (maxPeak === 0) return

  // 计算增益并应用
  const gain = targetGain / maxPeak
  // 如果当前峰值已经小于目标（且不想放大噪音），可以限制 gain <= 1?
  // 但"标准化"通常意味着放大或缩小到目标。这里我们直接应用。

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain
    }
  }
}

// 编码 MP3
const encodeToMp3 = async (buffer) => {
  return new Promise((resolve, reject) => {
    try {
      const channels = 2
      const sampleRate = buffer.sampleRate
      const kbps = 128 // 128kbps 标准音质

      const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps)
      const mp3Data = []

      const leftData = buffer.getChannelData(0)
      const rightData = buffer.getChannelData(1) // 之前合并时已确保是双声道

      const sampleBlockSize = 1152 // MP3 frame size
      const totalSamples = leftData.length

      let processed = 0

      const processChunk = () => {
        // 使用时间片处理：每次运行最多 50ms，以保证UI不卡顿的同时最大化吞吐量
        // 这比固定样本数快得多，因为它减少了 setTimeout 的调用次数
        const startTime = performance.now()
        const timeSlice = 50 // ms

        while (processed < totalSamples) {
          // 每次处理一个较小的基本块 (例如 10 帧 = 11520 样本)
          // 保持小块是为了频繁检查时间，防止单个循环过长
          const chunkSamples = 11520
          const end = Math.min(processed + chunkSamples, totalSamples)

          const leftChunk = new Int16Array(end - processed)
          const rightChunk = new Int16Array(end - processed)

          for (let i = 0; i < end - processed; i++) {
            // Float32 -> Int16
            const idx = processed + i

            // Clamp and scale
            let l = leftData[idx]
            let r = rightData[idx]

            // 简单的 clamping 优化
            if (l > 1) l = 1
            else if (l < -1) l = -1

            if (r > 1) r = 1
            else if (r < -1) r = -1

            leftChunk[i] = l < 0 ? l * 0x8000 : l * 0x7fff
            rightChunk[i] = r < 0 ? r * 0x8000 : r * 0x7fff
          }

          const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf)
          }

          processed = end

          // 检查时间片
          if (performance.now() - startTime > timeSlice) {
            // 时间片用完，更新进度并让出主线程
            processingStatus.value = `正在编码 MP3: ${Math.round((processed / totalSamples) * 100)}%`
            setTimeout(processChunk, 0)
            return
          }
        }

        // 全部处理完成
        const mp3buf = mp3encoder.flush()
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf)
        }
        resolve(new Blob(mp3Data, { type: 'audio/mp3' }))
      }

      processChunk()
    } catch (e) {
      reject(e)
    }
  })
}

// 编码 WAV
const encodeToWav = (buffer) => {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  let result
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1))
  } else {
    result = buffer.getChannelData(0)
  }

  return encodeWAV(result, numChannels, sampleRate, format, bitDepth)
}

const interleave = (inputL, inputR) => {
  const length = inputL.length + inputR.length
  const result = new Float32Array(length)

  let index = 0
  let inputIndex = 0

  while (index < length) {
    result[index++] = inputL[inputIndex]
    result[index++] = inputR[inputIndex]
    inputIndex++
  }
  return result
}

const encodeWAV = (samples, numChannels, sampleRate, format, bitDepth) => {
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample

  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  /* RIFF type */
  writeString(view, 8, 'WAVE')
  /* format chunk identifier */
  writeString(view, 12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, format, true)
  /* channel count */
  view.setUint16(22, numChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true)
  /* bits per sample */
  view.setUint16(34, bitDepth, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true)

  if (bitDepth === 16) {
    floatTo16BitPCM(view, 44, samples)
  } else {
    floatTo32BitPCM(view, 44, samples)
  }

  return new Blob([view], { type: 'audio/wav' })
}

const floatTo16BitPCM = (output, offset, input) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

const floatTo32BitPCM = (output, offset, input) => {
  for (let i = 0; i < input.length; i++, offset += 4) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setFloat32(offset, s, true)
  }
}

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// 开始下载
const startDownload = async () => {
  if (selectedSongs.value.size === 0) return

  downloading.value = true
  downloadedCount.value = 0
  downloadErrors.value = []
  processingStatus.value = ''

  const selectedSongsList = props.songs.filter((song) => selectedSongs.value.has(song.song.id))
  totalCount.value = selectedSongsList.length

  // 检查是否为合并模式
  if (mergeSongs.value) {
    await processAndMergeAudio(selectedSongsList)

    // 合并模式完成后
    if (downloadErrors.value.length === 0) {
      // 清除预下载缓存
      preloadedSongs.clear()

      setTimeout(() => {
        downloading.value = false
        closeDialog()
      }, 2000)
    } else {
      downloading.value = false
    }
    return
  }

  // 普通下载模式
  for (const songItem of selectedSongsList) {
    const song = songItem.song
    currentDownloadSong.value = `${song.artist} - ${song.title}`

    try {
      // 获取音频URL
      const audioUrl = await getMusicUrlForDownload(song, selectedQuality.value)

      // 生成文件名：歌手名 - 歌曲名.ext
      let extension = 'mp3'
      if (audioUrl.includes('.m4a')) extension = 'm4a'
      else if (audioUrl.includes('.flac')) extension = 'flac'
      else if (audioUrl.includes('.wav')) extension = 'wav'
      else if (audioUrl.includes('.ogg')) extension = 'ogg'

      const filename = `${song.artist} - ${song.title}.${extension}`.replace(/[<>:"/\\|?*]/g, '_') // 替换不合法的文件名字符

      // 下载文件 (复用 downloadAsBlob 和 saveFile)
      const blob = await downloadAsBlob(audioUrl)
      saveFile(blob, filename)
    } catch (error) {
      console.error(`下载失败: ${song.title}`, error)
      downloadErrors.value.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        error: error.message
      })
    } finally {
      // 无论成功失败，都更新进度
      downloadedCount.value++
    }

    // 添加延迟避免请求过于频繁
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  currentDownloadSong.value = ''

  // 显示完成通知
  if (window.$showNotification) {
    const successCount = downloadedCount.value - downloadErrors.value.length
    if (downloadErrors.value.length === 0) {
      window.$showNotification(`成功下载 ${successCount} 首歌曲`, 'success')
    } else {
      window.$showNotification(
        `下载完成，成功 ${successCount} 首，失败 ${downloadErrors.value.length} 首`,
        'warning'
      )
    }
  }

  // 延迟关闭对话框（仅在没有错误时）
  if (downloadErrors.value.length === 0) {
    setTimeout(() => {
      downloading.value = false
      closeDialog()
    }, 2000)
  } else {
    downloading.value = false
  }
}

// 监听显示状态变化，重置状态
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      selectedSongs.value = new Set(props.songs.map((song) => song.song.id))
      // 如果没有正在下载，重置状态
      if (!downloading.value) {
        downloadedCount.value = 0
        totalCount.value = 0
        currentDownloadSong.value = ''
        downloadErrors.value = []
      }
      selectedQuality.value = getQuality('netease')

      // 加载自定义文件名预设
      const savedPreset = localStorage.getItem('voicehub_filename_preset')
      if (savedPreset) {
        customFilename.value = savedPreset
      }

      // 加载音量标准化预设
      const savedDbPreset = localStorage.getItem('voicehub_db_preset')
      if (savedDbPreset) {
        targetDb.value = parseFloat(savedDbPreset)
        normalizeAudio.value = true // 自动开启标准化
      }
    }
  }
)

// 插入占位符
const insertPlaceholder = (placeholder) => {
  customFilename.value += (customFilename.value ? ' ' : '') + placeholder
}

// 保存文件名预设
const saveFilenamePreset = () => {
  if (!customFilename.value) return

  localStorage.setItem('voicehub_filename_preset', customFilename.value)
  showPresetSaved.value = true

  setTimeout(() => {
    showPresetSaved.value = false
  }, 2000)
}

// 保存音量预设
const saveDbPreset = () => {
  localStorage.setItem('voicehub_db_preset', targetDb.value.toString())
  showDbPresetSaved.value = true

  setTimeout(() => {
    showDbPresetSaved.value = false
  }, 2000)
}
</script>

<style scoped>
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0.95);
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 500px;
  opacity: 1;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  border-top-width: 0 !important;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}
</style>
