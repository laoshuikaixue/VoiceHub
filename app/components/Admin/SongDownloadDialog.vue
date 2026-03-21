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
          <!-- 头部 -->
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

            <!-- 高级选项 -->
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
                            class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            title="保存当前音量设置(包括开启状态)为默认"
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

            <!-- 歌曲列表 -->
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
                      (preloadedSongs.has(song.song.id) && preloadedSongs.get(song.song.id).loading) ||
                      activeDownloads.has(song.song.id)
                    "
                    class="absolute bottom-0 left-0 h-0.5 bg-blue-500/50 transition-all duration-300 ease-out"
                    :style="{
                      width: `${
                        (typeof activeDownloads.get(song.song.id) === 'number' 
                          ? activeDownloads.get(song.song.id) 
                          : activeDownloads.get(song.song.id)?.progress) || 
                        (preloadedSongs.get(song.song.id)?.progress || 0)
                      }%`
                    }"
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

            <!-- 进度条 -->
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

              <!-- 错误信息 -->
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
import { computed, ref, watch, reactive, onUnmounted } from 'vue'
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

const { getQualityOptions, getQuality } = useAudioQuality()

const mergeSongs = ref(false)
const normalizeAudio = ref(false)
const targetDb = ref(-1.0)
const processingStatus = ref('')
const customFilename = ref('')
const showPresetSaved = ref(false)
const showDbPresetSaved = ref(false)
const exportFormat = ref('mp3')
// const saveIntermediateWav = ref(false) // 已移除

const qualityDescriptions = {
  2: '节省流量',
  3: '高品质体验',
  4: '极高音质',
  5: '无损音质',
  6: 'Hi-Res无损',
  9: '超清母带'
}

// 生成带描述的音质选项
const extendedQualityOptions = computed(() => {
  const options = getQualityOptions('netease')
  return options.map((opt) => ({
    ...opt,
    description: qualityDescriptions[opt.value] || '标准音质'
  }))
})

const selectedQuality = ref(getQuality('netease'))

const selectedSongs = ref(new Set())

const isAllSelected = computed(() => {
  return props.songs.length > 0 && selectedSongs.value.size === props.songs.length
})

const downloading = ref(false)
const downloadedCount = ref(0)
const totalCount = ref(0)
const currentDownloadSong = ref('')
const downloadErrors = ref([])
// 预下载缓存映射
const preloadedSongs = reactive(new Map())
// 当前活动下载进度映射 (songId -> progress)
const activeDownloads = reactive(new Map())
const activeEncoderWorker = ref(null)
const DOWNLOAD_CONCURRENCY = 3
const MERGE_DECODE_CONCURRENCY = 2

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

// 预下载单首歌曲
const preloadSong = async (song) => {
  if (preloadedSongs.has(song.id) && !preloadedSongs.get(song.id).loading) return

  preloadedSongs.set(song.id, { loading: true, progress: 0 })

  try {
    const url = await getMusicUrlForDownload(song, selectedQuality.value)

    // 使用 fetch 获取并追踪下载进度
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
        const progress = (loaded / total) * 100
        const current = preloadedSongs.get(song.id)
        if (current) {
          current.progress = progress
        }
      }
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const blob = new Blob(chunks, { type: contentType })

    // 解析音频时长
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

// 批量预下载
const preloadSelectedSongs = async () => {
  if (selectedSongs.value.size === 0) return

  const songsToLoad = props.songs.filter(
    (s) => selectedSongs.value.has(s.song.id) && !preloadedSongs.has(s.song.id)
  )

  // 并发限制: 3
  const concurrency = 3
  const queue = [...songsToLoad]
  const workers = []

  const worker = async () => {
    while (queue.length > 0) {
      const songItem = queue.shift()
      await preloadSong(songItem.song)
    }
  }

  for (let i = 0; i < Math.min(concurrency, songsToLoad.length); i++) {
    workers.push(worker())
  }

  await Promise.all(workers)
}

const removePreloaded = (songId) => {
  preloadedSongs.delete(songId)
}

// 计算预估总时长
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

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSongs.value = new Set()
  } else {
    selectedSongs.value = new Set(props.songs.map((song) => song.song.id))
  }
}

const toggleSongSelection = (songId) => {
  if (selectedSongs.value.has(songId)) {
    selectedSongs.value.delete(songId)
  } else {
    selectedSongs.value.add(songId)
  }
}

const closeDialog = () => {
  // 下载中关闭仅隐藏弹窗，后台继续运行
  emit('close')
}

// 获取下载链接
const getMusicUrlForDownload = async (song, quality, retryCount = 0) => {
  try {
    // 播客内容特殊处理
    const isPodcast =
      song.musicPlatform === 'netease-podcast' ||
      song.sourceInfo?.type === 'voice' ||
      (song.sourceInfo?.source === 'netease-backup' && song.sourceInfo?.type === 'voice')
    const options = {
      unblock: isPodcast ? false : undefined,
      quality: quality
    }

    const url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl, options)
    if (!url) {
      throw new Error('无法获取音乐播放链接')
    }
    return url
  } catch (error) {
    console.error('获取音乐播放链接失败:', error)

    // 失败自动重试一次
    if (retryCount === 0 && song.musicPlatform && song.musicId) {
      console.log(`正在重试获取音乐链接: ${song.musicPlatform}, ${song.musicId}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return getMusicUrlForDownload(song, quality, 1)
    }

    throw new Error('获取音乐播放链接失败: ' + error.message)
  }
}

// 通用的音频下载函数
const fetchAudioWithProgress = async (audioUrl, songId, songTitle) => {
  const response = await fetch(audioUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const total = parseInt(response.headers.get('content-length') || '0')
  const reader = response.body.getReader()
  const chunks = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    loaded += value.length

    if (total) {
      const percent = Math.round((loaded / total) * 100)
      processingStatus.value = `正在下载: ${songTitle} (${percent}%)`
      activeDownloads.set(songId, percent)
    }
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  return new Blob(chunks, { type: contentType })
}

// 获取 Blob 数据
const downloadAsBlob = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.blob()
}

// 触发浏览器下载
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

const terminateActiveEncoderWorker = () => {
  if (activeEncoderWorker.value) {
    activeEncoderWorker.value.terminate()
    activeEncoderWorker.value = null
  }
}

const buildMergedFilename = (selectedSongsList, ext) => {
  let filename
  if (customFilename.value && customFilename.value.trim()) {
    filename = customFilename.value.trim()
    const dateStr = new Date().toISOString().split('T')[0]
    const allSongsStr = selectedSongsList.map((item) => item.song.title).join(' ')
    filename = filename.replace(/{date}/g, dateStr)
    filename = filename.replace(/{songs}/g, allSongsStr)
    filename = filename.replace(/[<>:"/\\|?*]/g, '_')
    const extRegex = new RegExp(`\\.${ext}$`, 'i')
    if (!extRegex.test(filename)) {
      if (filename.toLowerCase().endsWith('.mp3') || filename.toLowerCase().endsWith('.wav')) {
        filename = filename.replace(/\.(mp3|wav)$/i, `.${ext}`)
      } else {
        filename += `.${ext}`
      }
    }
  } else {
    const dateStr = new Date().toLocaleDateString('sv-SE')
    filename = `排期合并_${dateStr}_${selectedSongsList.length}首.${ext}`
  }
  return filename
}

const formatWorkerProgress = (stage, value) => {
  if (stage === 'prepare') {
    processingStatus.value = `正在预处理音频: ${value}%`
    return
  }
  if (stage === 'merge') {
    processingStatus.value = `正在合并音频: ${value}%`
    return
  }
  processingStatus.value = `正在编码 ${exportFormat.value.toUpperCase()}: ${value}%`
}

const encodeWithWorker = async (tracks, format) => {
  terminateActiveEncoderWorker()
  const worker = new Worker(new URL('../../workers/audioEncoderWorker.js', import.meta.url), {
    type: 'module'
  })
  activeEncoderWorker.value = worker
  return await new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      const { type, stage, value, blob, message } = event.data || {}
      if (type === 'progress') {
        formatWorkerProgress(stage, value)
        return
      }
      if (type === 'error') {
        terminateActiveEncoderWorker()
        reject(new Error(message || '编码失败'))
        return
      }
      if (type === 'done') {
        terminateActiveEncoderWorker()
        resolve(blob)
      }
    }
    worker.onerror = (event) => {
      terminateActiveEncoderWorker()
      reject(new Error(event.message || '编码 Worker 运行失败'))
    }
    const transferables = []
    const payloadTracks = tracks.map((track) => {
      transferables.push(track.left.buffer, track.right.buffer)
      return {
        id: track.id,
        title: track.title,
        sampleRate: track.sampleRate,
        left: track.left.buffer,
        right: track.right.buffer
      }
    })
    worker.postMessage(
      {
        cmd: 'encode',
        tracks: payloadTracks,
        format,
        normalize: normalizeAudio.value,
        targetDb: targetDb.value
      },
      transferables
    )
  })
}

const decodeSongTrack = async (song, audioContext) => {
  let arrayBuffer
  if (preloadedSongs.has(song.id) && !preloadedSongs.get(song.id).loading) {
    const cached = preloadedSongs.get(song.id)
    arrayBuffer = await cached.blob.arrayBuffer()
    activeDownloads.set(song.id, 100)
  } else {
    const audioUrl = await getMusicUrlForDownload(song, selectedQuality.value)
    const blob = await fetchAudioWithProgress(audioUrl, song.id, song.title)
    arrayBuffer = await blob.arrayBuffer()
    activeDownloads.set(song.id, 100)
  }
  processingStatus.value = `正在解码: ${song.title}`
  const decoded = await audioContext.decodeAudioData(arrayBuffer)
  const left = new Float32Array(decoded.getChannelData(0))
  const right =
    decoded.numberOfChannels > 1
      ? new Float32Array(decoded.getChannelData(1))
      : new Float32Array(decoded.getChannelData(0))
  return {
    id: song.id,
    title: song.title,
    sampleRate: decoded.sampleRate,
    left,
    right
  }
}

const processAndMergeAudio = async (selectedSongsList) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  let audioContext
  try {
    audioContext = new AudioContextClass({ sampleRate: 44100 })
  } catch (e) {
    audioContext = new AudioContextClass()
  }

  try {
    const concurrency = MERGE_DECODE_CONCURRENCY
    const queue = selectedSongsList.map((item, index) => ({ item, index }))
    const results = new Array(selectedSongsList.length).fill(null)
    const workers = []

    const worker = async () => {
      while (queue.length > 0) {
        const { item: songItem, index } = queue.shift()
        const song = songItem.song

        currentDownloadSong.value = `${song.artist} - ${song.title}`
        processingStatus.value = `正在准备: ${song.title}`

        try {
          results[index] = await decodeSongTrack(song, audioContext)
        } catch (error) {
          console.error(`处理失败: ${song.title}`, error)
          downloadErrors.value.push({
            id: song.id,
            title: song.title,
            artist: song.artist,
            error: error.message
          })
        } finally {
          downloadedCount.value++
        }
      }
    }

    for (let i = 0; i < Math.min(concurrency, selectedSongsList.length); i++) {
      workers.push(worker())
    }

    await Promise.all(workers)

    const tracks = results.filter(Boolean)

    if (tracks.length === 0) throw new Error('没有成功处理的音频')

    processingStatus.value = '正在准备编码...'
    await new Promise((resolve) => setTimeout(resolve, 50))

    const extension = exportFormat.value === 'wav' ? 'wav' : 'mp3'
    const resultBlob = await encodeWithWorker(tracks, extension)
    const filename = buildMergedFilename(selectedSongsList, extension)

    saveFile(resultBlob, filename)
    processingStatus.value = `处理完成: ${filename}`
    currentDownloadSong.value = ''
  } catch (error) {
    console.error('合并过程出错:', error)
    if (window.$showNotification) {
      window.$showNotification('合并失败: ' + error.message, 'error')
    }
  } finally {
    terminateActiveEncoderWorker()
    audioContext.close()
    processingStatus.value = ''
  }
}

// 开始下载任务
const startDownload = async () => {
  if (selectedSongs.value.size === 0) return

  // 保存音质选择偏好
  localStorage.setItem('voicehub_quality_preset', selectedQuality.value)

  downloading.value = true
  downloadedCount.value = 0
  downloadErrors.value = []
  processingStatus.value = ''

  const selectedSongsList = props.songs.filter((song) => selectedSongs.value.has(song.song.id))
  totalCount.value = selectedSongsList.length

  // 合并模式分支
  if (mergeSongs.value) {
    await processAndMergeAudio(selectedSongsList)

    // 合并完成处理
    if (downloadErrors.value.length === 0) {
      // 清理缓存
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

  // 普通批量下载模式
  const concurrency = DOWNLOAD_CONCURRENCY
  const queue = [...selectedSongsList]
  const workers = []
  let activeWorkers = 0

  const worker = async () => {
    while (queue.length > 0) {
      const songItem = queue.shift()
      if (!songItem) break
      
      const song = songItem.song
      activeWorkers++
      currentDownloadSong.value = `${song.artist} - ${song.title} (${activeWorkers}/${concurrency} 活动)`

      try {
        // 1. 获取音频 URL
        const audioUrl = await getMusicUrlForDownload(song, selectedQuality.value)

        // 2. 下载音频（使用公共函数）
        processingStatus.value = `下载中: ${song.title}`
        const blob = await fetchAudioWithProgress(audioUrl, song.id, song.title)

        // 3. 确定文件扩展名
        let extension = 'mp3'
        const contentType = blob.type
        if (contentType.includes('m4a') || audioUrl.includes('.m4a')) extension = 'm4a'
        else if (contentType.includes('flac') || audioUrl.includes('.flac')) extension = 'flac'
        else if (contentType.includes('wav') || audioUrl.includes('.wav')) extension = 'wav'
        else if (contentType.includes('ogg') || audioUrl.includes('.ogg')) extension = 'ogg'

        // 4. 保存文件（保留原始格式）
        const filename = `${song.artist} - ${song.title}.${extension}`.replace(/[<>:"/\\|?*]/g, '_')
        saveFile(blob, filename)

        activeDownloads.delete(song.id)
      } catch (error) {
        console.error(`处理失败: ${song.title}`, error)
        downloadErrors.value.push({
          id: song.id,
          title: song.title,
          artist: song.artist,
          error: error.message
        })
        activeDownloads.delete(song.id)
      } finally {
        activeWorkers--
        downloadedCount.value++
        currentDownloadSong.value = queue.length > 0 
          ? `剩余 ${queue.length} 首` 
          : '处理完成'
      }
    }
  }

  // 启动并发工作线程
  for (let i = 0; i < Math.min(concurrency, selectedSongsList.length); i++) {
    workers.push(worker())
  }

  await Promise.all(workers)

  currentDownloadSong.value = ''
  processingStatus.value = ''

  // 下载完成通知
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

  // 无错误自动关闭
  if (downloadErrors.value.length === 0) {
    setTimeout(() => {
      downloading.value = false
      closeDialog()
    }, 2000)
  } else {
    downloading.value = false
  }
}

// 监听弹窗显示
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      selectedSongs.value = new Set(props.songs.map((song) => song.song.id))
      // 重置状态
      if (!downloading.value) {
        downloadedCount.value = 0
        totalCount.value = 0
        currentDownloadSong.value = ''
        downloadErrors.value = []
        activeDownloads.clear()
      }
      // 优先使用上次保存的音质偏好，否则使用默认值
      const savedQuality = localStorage.getItem('voicehub_quality_preset')
      if (savedQuality) {
        const qualityNum = Number(savedQuality)
        // 检查保存的音质是否在当前可用选项中
        const isQualityAvailable = extendedQualityOptions.value.some(opt => opt.value === qualityNum)
        if (isQualityAvailable) {
          selectedQuality.value = qualityNum
        } else {
          // 如果不可用，回退到第一个可用选项
          selectedQuality.value = extendedQualityOptions.value[0]?.value || getQuality('netease')
        }
      } else {
        selectedQuality.value = getQuality('netease')
      }

      // 加载预设
      const savedPreset = localStorage.getItem('voicehub_filename_preset')
      if (savedPreset) {
        customFilename.value = savedPreset
      }

      const savedDbPreset = localStorage.getItem('voicehub_db_preset')
      if (savedDbPreset) {
        try {
          // 尝试解析为 JSON 对象 (新格式)
          const preset = JSON.parse(savedDbPreset)
          // 确保是对象且包含属性
          if (typeof preset === 'object' && preset !== null && 'enabled' in preset) {
            normalizeAudio.value = preset.enabled
            targetDb.value = preset.targetDb
          } else {
            // 可能是旧格式的单个数值，或者是其他异常数据
            throw new Error('Invalid format')
          }
        } catch (e) {
          // 解析失败，说明是旧版纯数值格式
          const val = parseFloat(savedDbPreset)
          if (!isNaN(val)) {
            targetDb.value = val
            normalizeAudio.value = true // 旧版默认开启
            
            // 顺便更新为新格式
            const newPreset = {
              enabled: true,
              targetDb: val
            }
            localStorage.setItem('voicehub_db_preset', JSON.stringify(newPreset))
          }
        }
      }
    }
  }
)

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
  const preset = {
    enabled: normalizeAudio.value,
    targetDb: targetDb.value
  }
  localStorage.setItem('voicehub_db_preset', JSON.stringify(preset))
  showDbPresetSaved.value = true

  setTimeout(() => {
    showDbPresetSaved.value = false
  }, 2000)
}

onUnmounted(() => {
  terminateActiveEncoderWorker()
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
