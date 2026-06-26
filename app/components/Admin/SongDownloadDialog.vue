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
              <section v-if="selectedSongs.size > 0" class="space-y-3 overflow-hidden">
                <div class="flex items-center gap-2 px-1">
                  <Settings2 class="w-3 h-3 text-zinc-500" />
                  <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]"
                    >高级选项</label
                  >
                </div>

                <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  <!-- 合并开关 -->
                  <div v-if="selectedSongs.size > 1" class="flex items-center justify-between">
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

                  <!-- 标准化选项 -->
                  <div
                    class="flex items-center justify-between"
                    :class="selectedSongs.size > 1 ? 'pt-3 border-t border-zinc-800/50' : ''"
                  >
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-zinc-200">音频标准化</span>
                        <span
                          v-if="normalizeAudio"
                          class="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20"
                          >Peak {{ targetDb }}dB</span
                        >
                      </div>
                      <span class="text-[10px] text-zinc-500"
                        >统一峰值音量，可与导出格式独立使用</span
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

                  <!-- 导出格式设置 -->
                  <div class="space-y-4 pt-4 border-t border-zinc-800/50">
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col">
                        <span class="text-xs font-bold text-zinc-200">导出格式</span>
                        <span class="text-[10px] text-zinc-500">
                          {{
                            shouldMergeSongs
                              ? '合并文件需要指定输出格式'
                              : '将单个音频转码为指定格式'
                          }}
                        </span>
                      </div>
                      <button
                        v-if="!shouldMergeSongs"
                        class="w-10 h-6 rounded-full transition-colors relative"
                        :class="convertAudioFormat ? 'bg-blue-600' : 'bg-zinc-700'"
                        @click="convertAudioFormat = !convertAudioFormat"
                      >
                        <div
                          class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                          :class="convertAudioFormat ? 'translate-x-4' : 'translate-x-0'"
                        />
                      </button>
                    </div>

                    <!-- 导出格式选择 -->
                    <div class="space-y-2">
                      <div class="flex items-center gap-2">
                        <Music class="w-3 h-3 text-zinc-500" />
                        <span class="text-xs font-bold text-zinc-200">格式</span>
                      </div>
                      <div class="flex gap-2">
                        <button
                          :disabled="!shouldUseExportFormat"
                          class="flex-1 py-1.5 px-3 rounded-lg border text-[10px] font-bold transition-all"
                          :class="[
                            exportFormat === 'mp3'
                              ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700',
                            !shouldUseExportFormat ? 'opacity-50 cursor-not-allowed' : ''
                          ]"
                          @click="exportFormat = 'mp3'"
                        >
                          MP3
                        </button>
                        <button
                          :disabled="!shouldUseExportFormat"
                          class="flex-1 py-1.5 px-3 rounded-lg border text-[10px] font-bold transition-all"
                          :class="[
                            exportFormat === 'wav'
                              ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700',
                            !shouldUseExportFormat ? 'opacity-50 cursor-not-allowed' : ''
                          ]"
                          @click="exportFormat = 'wav'"
                        >
                          WAV
                        </button>
                      </div>
                    </div>

                    <!-- 自定义文件名 -->
                    <div v-if="shouldMergeSongs" class="space-y-2">
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
                  </div>
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
                    class="text-[10px] font-bold text-purple-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                    :disabled="estimatingDuration"
                    title="快速预估选中歌曲的总时长"
                    @click="estimateSelectedDurations"
                  >
                    <Clock class="w-3 h-3" />
                    <span v-if="estimatingDuration">预估中...</span>
                    <span v-else>预估时长</span>
                  </button>
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
                      (preloadedSongs.has(song.song.id) &&
                        preloadedSongs.get(song.song.id).loading) ||
                      activeDownloads.has(song.song.id)
                    "
                    class="absolute bottom-0 left-0 h-0.5 bg-blue-500/50 transition-all duration-300 ease-out"
                    :style="{
                      width: `${
                        (typeof activeDownloads.get(song.song.id) === 'number'
                          ? activeDownloads.get(song.song.id)
                          : activeDownloads.get(song.song.id)?.progress) ||
                        preloadedSongs.get(song.song.id)?.progress ||
                        0
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
                      <!-- 预下载标记（精确时长） -->
                      <div
                        v-if="getUsablePreload(song.song.id, selectedQuality)"
                        class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20"
                      >
                        <Check class="w-2 h-2 text-green-400" />
                        <span class="text-[9px] font-mono text-green-400">{{
                          formatDuration(getUsablePreload(song.song.id, selectedQuality).duration)
                        }}</span>
                      </div>
                      <!-- API 预估标记 -->
                      <div
                        v-else-if="estimatedDurations.has(song.song.id)"
                        class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20"
                      >
                        <Clock class="w-2 h-2 text-purple-400" />
                        <span class="text-[9px] font-mono text-purple-400">{{
                          formatDuration(estimatedDurations.get(song.song.id).durationSeconds)
                        }}</span>
                      </div>
                    </div>
                    <p class="text-[10px] text-zinc-500 truncate">{{ song.song.artist }}</p>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="text-[9px] font-mono text-zinc-600 uppercase">
                      {{ getPlatformShortName(getSongPlatform(song.song)) }}
                    </div>

                    <!-- 单个预下载/删除按钮 -->
                    <button
                      v-if="getUsablePreload(song.song.id, selectedQuality)"
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
                <span class="text-zinc-400">{{
                  currentTaskType === 'merge' ? '处理进度' : '下载进度'
                }}</span>
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
                    ? currentTaskType === 'merge'
                      ? '处理中...'
                      : '下载中...'
                    : shouldMergeSongs
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
const convertAudioFormat = ref(false)
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

const shouldMergeSongs = computed(() => {
  return mergeSongs.value && selectedSongs.value.size > 1
})

const shouldUseExportFormat = computed(() => {
  return shouldMergeSongs.value || convertAudioFormat.value || normalizeAudio.value
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
const MERGE_DECODE_CONCURRENCY = 3
const ESTIMATE_DURATION_CONCURRENCY = 3
const AUDIO_METADATA_TIMEOUT_MS = 10000
const PCM_BYTES_PER_SECOND = 44100 * 2 * 4
const FAST_MERGE_MIN_BUDGET_BYTES = 96 * 1024 * 1024
const FAST_MERGE_MEMORY_RATIO = 0.04

// 当前正在执行的任务类型 ('merge' | 'download' | '')
const currentTaskType = ref('')

// 预估时长状态
const estimatingDuration = ref(false)
const estimatedDurations = reactive(new Map())

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

const getSongPlatform = (song) => {
  return (
    song?.actualMusicPlatform ||
    song?.musicPlatform ||
    song?.sourceInfo?.actualMusicPlatform ||
    song?.sourceInfo?.musicPlatform ||
    ''
  )
}

const isNeteaseSong = (song) => {
  const platform = getSongPlatform(song)
  return platform === 'netease' || platform === 'netease-podcast'
}

// 格式化时长
const formatDuration = (seconds) => {
  if (!seconds) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const readAudioMetadataDuration = (src, options = {}) => {
  const timeoutMs = options.timeoutMs || AUDIO_METADATA_TIMEOUT_MS
  const revokeObjectUrl = options.revokeObjectUrl || false

  return new Promise((resolve) => {
    const audio = new Audio()
    let settled = false
    let timeoutId = null

    const cleanup = () => {
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.src = ''
      audio.load()
      if (revokeObjectUrl) {
        URL.revokeObjectURL(src)
      }
    }

    const finish = (duration = 0) => {
      if (settled) return
      settled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      cleanup()
      resolve(duration)
    }

    timeoutId = setTimeout(() => finish(0), timeoutMs)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(0)
    audio.src = src
  })
}

const getUsablePreload = (songId, quality) => {
  const cached = preloadedSongs.get(songId)
  if (!cached || cached.loading || !cached.blob) return null
  if (cached.quality !== undefined && cached.quality !== quality) return null
  return cached
}

// 预下载单首歌曲
const preloadSong = async (song) => {
  if (getUsablePreload(song.id, selectedQuality.value)) return

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

    const objectUrl = URL.createObjectURL(blob)
    const duration = await readAudioMetadataDuration(objectUrl, { revokeObjectUrl: true })

    preloadedSongs.set(song.id, {
      blob,
      duration,
      loading: false,
      progress: 100,
      quality: selectedQuality.value,
      url,
      contentType
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
    (s) => {
      const songId = s.song?.id
      if (!songId || !selectedSongs.value.has(songId)) return false
      const cached = preloadedSongs.get(songId)
      if (cached && cached.loading) return false
      return !getUsablePreload(songId, selectedQuality.value)
    }
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

// 预估选中歌曲的时长
const estimateSelectedDurations = async () => {
  if (selectedSongs.value.size === 0 || estimatingDuration.value) return

  estimatingDuration.value = true

  try {
    // 导入 useMusicSources
    const { useMusicSources } = await import('~/composables/useMusicSources')
    const { getSongUrl } = useMusicSources()
    
    const songsToEstimate = []
    
    // 筛选需要预估的歌曲
    props.songs.forEach((songItem) => {
      const songId = songItem.song?.id
      if (!songId || !selectedSongs.value.has(songId)) return
      
      // 跳过已有预下载缓存的歌曲
      const cached = getUsablePreload(songId, selectedQuality.value)
      if (cached?.duration) return
      
      // 跳过已有 API 预估的歌曲
      if (estimatedDurations.has(songId)) return
      
      songsToEstimate.push(songItem)
    })

    console.log(`[预估时长] 需要预估的歌曲数量: ${songsToEstimate.length}`)

    if (songsToEstimate.length === 0) {
      if (window.$showNotification) {
        window.$showNotification('所有选中歌曲已有时长信息', 'info')
      }
      estimatingDuration.value = false
      return
    }

    let successCount = 0
    let failCount = 0
    
    const estimateSongDuration = async (songItem) => {
      try {
        console.log('[预估时长] 正在获取歌曲时长:', songItem.song.title)
        
        // 音质映射
        const qualityMap = {
          2: 'standard',
          3: 'higher', 
          4: 'exhigh',
          5: 'lossless',
          6: 'hires',
          9: 'jymaster'
        }
        const level = qualityMap[selectedQuality.value] || 'exhigh'
        
        if (isNeteaseSong(songItem.song)) {
          try {
            const apiResponse = await $fetch('/api/api-enhanced/netease/song/url/v1', {
              params: {
                id: songItem.song.musicId,
                level: level
              },
              timeout: 5000
            })
            
            if (apiResponse?.code === 200 && Array.isArray(apiResponse.data) && apiResponse.data.length > 0) {
              const songData = apiResponse.data[0]
              const durationMs = songData.time
              
              if (durationMs && durationMs > 0) {
                estimatedDurations.set(songItem.song.id, {
                  durationSeconds: Math.floor(durationMs / 1000),
                  durationMs: durationMs,
                  source: 'netease-api'
                })
                console.log('[预估时长] 成功获取时长:', songItem.song.title, Math.floor(durationMs / 1000) + '秒')
                successCount++
                return
              }
            }
          } catch (apiError) {
            console.warn('[预估时长] 网易API调用失败，尝试从播放链接获取:', songItem.song.title, apiError)
          }
        }
        
        // 非网易音源或网易 API 失败时，通过实际播放链接读取元数据。
        try {
          const result = await getSongUrl(
            songItem.song.musicId,
            selectedQuality.value,
            getSongPlatform(songItem.song)
          )
          
          if (result.success && result.url) {
            const duration = await readAudioMetadataDuration(result.url)
            
            if (duration && duration > 0) {
              estimatedDurations.set(songItem.song.id, {
                durationSeconds: Math.floor(duration),
                durationMs: Math.floor(duration * 1000),
                source: 'audio-metadata'
              })
              console.log('[预估时长] 从播放链接获取时长:', songItem.song.title, Math.floor(duration) + '秒')
              successCount++
            } else {
              console.warn('[预估时长] 无法从播放链接获取时长:', songItem.song.title)
              failCount++
            }
          } else {
            console.warn('[预估时长] 获取播放链接失败:', songItem.song.title)
            failCount++
          }
        } catch (audioError) {
          console.error('[预估时长] 播放链接获取时长失败:', songItem.song.title, audioError)
          failCount++
        }
      } catch (error) {
        console.error('[预估时长] 处理歌曲失败:', songItem.song.title, error)
        failCount++
      }
    }

    const queue = [...songsToEstimate]
    const workers = []
    const worker = async () => {
      while (queue.length > 0) {
        const songItem = queue.shift()
        if (songItem) {
          await estimateSongDuration(songItem)
        }
      }
    }

    for (let i = 0; i < Math.min(ESTIMATE_DURATION_CONCURRENCY, songsToEstimate.length); i++) {
      workers.push(worker())
    }

    await Promise.all(workers)

    console.log(`[预估时长] 完成 - 成功: ${successCount}, 失败: ${failCount}`)

    if (successCount > 0 && window.$showNotification) {
      window.$showNotification(`成功预估 ${successCount} 首歌曲的时长`, 'success')
    }
    
    if (failCount > 0 && window.$showNotification) {
      window.$showNotification(`${failCount} 首歌曲预估失败`, 'warning')
    }
  } catch (error) {
    console.error('[预估时长] 总体失败:', error)
    if (window.$showNotification) {
      window.$showNotification('预估时长失败', 'error')
    }
  } finally {
    estimatingDuration.value = false
  }
}

// 计算预估总时长
const estimatedTotalDuration = computed(() => {
  let total = 0
  let count = 0
  selectedSongs.value.forEach((id) => {
    // 优先使用预下载缓存的精确时长
    const cached = getUsablePreload(id, selectedQuality.value)
    if (cached && cached.duration) {
      total += cached.duration
      count++
      return
    }
    
    // 其次使用 API 预估的时长
    const estimated = estimatedDurations.get(id)
    if (estimated && estimated.durationSeconds) {
      total += estimated.durationSeconds
      count++
    }
  })
  return { total, count }
})

const parsePositiveDuration = (value) => {
  const duration = Number(value)
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return duration
}

const getKnownSongDuration = (songItem) => {
  const song = songItem.song
  const cached = getUsablePreload(song.id, selectedQuality.value)
  if (cached?.duration) return cached.duration

  const estimated = estimatedDurations.get(song.id)
  if (estimated?.durationSeconds) return estimated.durationSeconds

  // 优先检查常见的时长字段
  const millisecondCandidates = [
    song.durationMs,
    song.duration_ms,
    song.dt,
    song.time,  // 网易云 API 返回的时长字段
    song.sourceInfo?.durationMs,
    song.sourceInfo?.duration_ms,
    song.sourceInfo?.time
  ]

  for (const candidate of millisecondCandidates) {
    const duration = parsePositiveDuration(candidate)
    if (duration > 0) return duration / 1000
  }

  const secondCandidates = [
    song.durationSeconds,
    song.durationSecond,
    song.sourceInfo?.durationSeconds,
    song.sourceInfo?.durationSecond
  ]

  for (const candidate of secondCandidates) {
    const duration = parsePositiveDuration(candidate)
    if (duration > 0) return duration
  }

  const ambiguousCandidates = [song.duration, song.sourceInfo?.duration]
  const isLikelyMillisecondPlatform = getSongPlatform(song)?.startsWith('netease')

  for (const candidate of ambiguousCandidates) {
    const duration = parsePositiveDuration(candidate)
    if (duration <= 0) continue

    // 模糊字段按保守策略处理，避免长音频秒数被误除导致低估内存。
    if (isLikelyMillisecondPlatform || duration > 15000) {
      return duration / 1000
    }
    return duration
  }

  return 0
}

const getBrowserMergeMemoryBudget = () => {
  const deviceMemoryGb = Number(navigator.deviceMemory)
  if (Number.isFinite(deviceMemoryGb) && deviceMemoryGb > 0) {
    return Math.max(
      FAST_MERGE_MIN_BUDGET_BYTES,
      deviceMemoryGb * 1024 * 1024 * 1024 * FAST_MERGE_MEMORY_RATIO
    )
  }

  const heapLimit = performance?.memory?.jsHeapSizeLimit
  if (Number.isFinite(heapLimit) && heapLimit > 0) {
    return Math.max(FAST_MERGE_MIN_BUDGET_BYTES, heapLimit * 0.12)
  }

  return null
}

const shouldUseFastMergeMode = (selectedSongsList) => {
  const deviceMemoryGb = Number(navigator.deviceMemory)
  let knownDurationCount = 0
  let totalDuration = 0

  for (const songItem of selectedSongsList) {
    const duration = getKnownSongDuration(songItem)
    if (duration > 0) {
      knownDurationCount++
      totalDuration += duration
    }
  }

  const estimatedPcmBytes = totalDuration * PCM_BYTES_PER_SECOND
  const memoryBudget = getBrowserMergeMemoryBudget()

  if (memoryBudget && estimatedPcmBytes > memoryBudget) {
    return false
  }

  if (knownDurationCount === selectedSongsList.length && memoryBudget) {
    return estimatedPcmBytes <= memoryBudget
  }

  if (Number.isFinite(deviceMemoryGb)) {
    if (deviceMemoryGb <= 4) return selectedSongsList.length <= 2 && estimatedPcmBytes <= 64 * 1024 * 1024
    if (deviceMemoryGb >= 8) return selectedSongsList.length <= 10
  }

  return selectedSongsList.length <= 3 && estimatedPcmBytes <= FAST_MERGE_MIN_BUDGET_BYTES
}

const isLikelyMemoryError = (error) => {
  const message = String(error?.message || error || '')
  return /memory|allocation|array buffer|out of memory|内存/i.test(message)
}

const pushMergeError = (error) => {
  downloadErrors.value.push({
    id: 'merge_error',
    title: '音频合并',
    artist: '',
    error: error?.message || String(error || '合并失败')
  })
}

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
    const platform = getSongPlatform(song)
    const isPodcast =
      platform === 'netease-podcast' ||
      song.sourceInfo?.type === 'voice' ||
      (song.sourceInfo?.source === 'netease-backup' && song.sourceInfo?.type === 'voice')
    const options = {
      unblock: isPodcast ? false : undefined,
      quality: quality,
      mediaId:
        song.sourceInfo?.strMediaMid ||
        song.sourceInfo?.mediaId ||
        song.sourceInfo?.mediaMid
    }

    const url = await getMusicUrl(platform, song.musicId, song.playUrl, options)
    if (!url) {
      throw new Error('无法获取音乐播放链接')
    }
    return url
  } catch (error) {
    console.error('获取音乐播放链接失败:', error)

    // 失败自动重试一次
    if (retryCount === 0 && getSongPlatform(song) && song.musicId) {
      console.log(`正在重试获取音乐链接: ${getSongPlatform(song)}, ${song.musicId}`)
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

const getAudioBlobForSong = async (song, quality) => {
  const cached = getUsablePreload(song.id, quality)
  if (cached) {
    processingStatus.value = `使用预下载缓存: ${song.title}`
    activeDownloads.set(song.id, 100)
    return {
      blob: cached.blob,
      sourceUrl: cached.url || '',
      fromCache: true
    }
  }

  const audioUrl = await getMusicUrlForDownload(song, quality)
  processingStatus.value = `下载中: ${song.title}`
  const blob = await fetchAudioWithProgress(audioUrl, song.id, song.title)
  return {
    blob,
    sourceUrl: audioUrl,
    fromCache: false
  }
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

const createDownloadAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  try {
    return new AudioContextClass({ sampleRate: 44100 })
  } catch {
    return new AudioContextClass()
  }
}

const buildMergedFilename = (selectedSongsList, ext, customFilenameValue) => {
  let filename
  if (customFilenameValue && customFilenameValue.trim()) {
    filename = customFilenameValue.trim()
    const dateStr = new Date().toLocaleDateString('sv-SE')
    const allSongsStr = selectedSongsList.map((item) => item.song.title).join(' ')
    filename = filename.replace(/{date}/g, dateStr)
    filename = filename.replace(/{songs}/g, allSongsStr)
    filename = filename.replace(/[<>:"/\\|?*]/g, '_')
    const extRegex = new RegExp(`\\.${ext}$`, 'i')
    if (!extRegex.test(filename)) {
      const knownExtensions = /\.(mp3|wav|flac|m4a|ogg|aac|wma|alac|aiff|ape)$/i
      if (knownExtensions.test(filename)) {
        filename = filename.replace(knownExtensions, `.${ext}`)
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

const formatWorkerProgress = (stage, value, format) => {
  if (stage === 'prepare') {
    processingStatus.value = `正在预处理音频: ${value}%`
    return
  }
  if (stage === 'merge') {
    processingStatus.value = `正在合并音频: ${value}%`
    return
  }
  processingStatus.value = `正在编码 ${format.toUpperCase()}: ${value}%`
}

const getTrackTransferables = (track) => {
  return track.left.buffer === track.right.buffer
    ? [track.left.buffer]
    : [track.left.buffer, track.right.buffer]
}

const encodeWithWorker = async (tracks, format, config) => {
  terminateActiveEncoderWorker()
  const worker = new Worker(new URL('../../workers/audioEncoderWorker.js', import.meta.url), {
    type: 'module'
  })
  activeEncoderWorker.value = worker
  return await new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      const { type, stage, value, blob, message } = event.data || {}
      if (type === 'progress') {
        formatWorkerProgress(stage, value, format)
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
      transferables.push(...getTrackTransferables(track))
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
        normalize: config.normalizeAudio,
        targetDb: config.targetDb
      },
      transferables
    )
  })
}

const createStreamingEncoderSession = async (format, config, sampleRate) => {
  terminateActiveEncoderWorker()
  const worker = new Worker(new URL('../../workers/audioEncoderWorker.js', import.meta.url), {
    type: 'module'
  })
  activeEncoderWorker.value = worker
  let requestId = 0
  const pendingRequests = new Map()
  let isAborted = false

  const terminateSessionWorker = () => {
    worker.terminate()
    if (activeEncoderWorker.value === worker) {
      activeEncoderWorker.value = null
    }
  }

  const rejectPendingRequests = (error) => {
    pendingRequests.forEach(({ reject }) => reject(error))
    pendingRequests.clear()
  }

  const abortSession = (error) => {
    if (isAborted) return
    isAborted = true
    rejectPendingRequests(error)
    terminateSessionWorker()
  }

  worker.onmessage = (event) => {
    const { type, stage, value, blob, message, requestId: responseRequestId } = event.data || {}
    if (type === 'progress') {
      formatWorkerProgress(stage, value, format)
      return
    }

    if (type === 'error') {
      const error = new Error(message || '编码失败')
      const pending = pendingRequests.get(responseRequestId)
      if (pending) {
        pendingRequests.delete(responseRequestId)
        pending.reject(error)
      }
      abortSession(error)
      return
    }

    const pending = pendingRequests.get(responseRequestId)
    if (!pending) return

    if (pending.expectedTypes.includes(type)) {
      pendingRequests.delete(responseRequestId)
      pending.resolve({ type, blob })
    }
  }

  worker.onerror = (event) => {
    const error = new Error(event.message || '编码 Worker 运行失败')
    abortSession(error)
  }

  const sendCommand = (payload, transferables = [], expectedTypes = []) => {
    if (isAborted) {
      return Promise.reject(new Error('编码 Worker 已终止'))
    }

    const nextRequestId = ++requestId
    return new Promise((resolve, reject) => {
      pendingRequests.set(nextRequestId, { resolve, reject, expectedTypes })
      try {
        worker.postMessage({ ...payload, requestId: nextRequestId }, transferables)
      } catch (error) {
        pendingRequests.delete(nextRequestId)
        isAborted = true
        reject(error)
        rejectPendingRequests(error)
        terminateSessionWorker()
      }
    })
  }

  await sendCommand(
    {
      cmd: 'startStream',
      format,
      normalize: config.normalizeAudio,
      targetDb: config.targetDb,
      sampleRate
    },
    [],
    ['ready']
  )

  return {
    appendTrack: async (track) => {
      await sendCommand(
        {
          cmd: 'appendTrack',
          track: {
            id: track.id,
            title: track.title,
            sampleRate: track.sampleRate,
            left: track.left.buffer,
            right: track.right.buffer
          }
        },
        getTrackTransferables(track),
        ['trackDone']
      )
    },
    finish: async () => {
      const result = await sendCommand({ cmd: 'finishStream' }, [], ['done'])
      terminateSessionWorker()
      return result.blob
    },
    cancel: () => {
      if (isAborted) return
      isAborted = true
      rejectPendingRequests(new Error('编码任务已取消'))
      terminateSessionWorker()
    }
  }
}

const decodeAudioBlobToTrack = async (song, blob, audioContext) => {
  const arrayBuffer = await blob.arrayBuffer()
  processingStatus.value = `正在解码: ${song.title}`
  const decoded = await audioContext.decodeAudioData(arrayBuffer)
  const left = new Float32Array(decoded.getChannelData(0))
  const right =
    decoded.numberOfChannels > 1
      ? new Float32Array(decoded.getChannelData(1))
      : left
  return {
    id: song.id,
    title: song.title,
    sampleRate: decoded.sampleRate,
    left,
    right
  }
}

const decodeSongTrack = async (song, audioContext, quality, options = {}) => {
  const { blob, fromCache } = await getAudioBlobForSong(song, quality)
  const track = await decodeAudioBlobToTrack(song, blob, audioContext)
  if (fromCache && options.releasePreload) {
    preloadedSongs.delete(song.id)
  }
  activeDownloads.set(song.id, 100)
  return track
}

const inferAudioExtension = (blob, sourceUrl) => {
  const contentType = blob.type || ''
  const url = sourceUrl || ''
  if (contentType.includes('m4a') || url.includes('.m4a')) return 'm4a'
  if (contentType.includes('mp4') || url.includes('.m4s')) return 'm4a'
  if (contentType.includes('flac') || url.includes('.flac')) return 'flac'
  if (contentType.includes('wav') || url.includes('.wav')) return 'wav'
  if (contentType.includes('ogg') || url.includes('.ogg')) return 'ogg'
  return 'mp3'
}

const buildSingleFilename = (song, extension) => {
  return `${song.artist} - ${song.title}.${extension}`.replace(/[<>:"/\\|?*]/g, '_')
}

const encodeSingleSong = async (song, audioContext, config) => {
  const track = await decodeSongTrack(song, audioContext, config.quality)
  const extension = config.exportFormat === 'wav' ? 'wav' : 'mp3'
  processingStatus.value = config.normalizeAudio
    ? `正在标准化: ${song.title}`
    : `正在转换格式: ${song.title}`
  const blob = await encodeWithWorker([track], extension, config)
  return { blob, extension }
}

const processAndMergeAudioFast = async (selectedSongsList, config) => {
  const audioContext = createDownloadAudioContext()

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
        processingStatus.value = `正在快速准备: ${song.title}`

        try {
          results[index] = await decodeSongTrack(song, audioContext, config.quality)
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

    processingStatus.value = '正在快速合并编码...'
    await new Promise((resolve) => setTimeout(resolve, 50))

    const extension = config.exportFormat === 'wav' ? 'wav' : 'mp3'
    const resultBlob = await encodeWithWorker(tracks, extension, config)
    downloadedCount.value = totalCount.value
    const filename = buildMergedFilename(selectedSongsList, extension, config.customFilename)

    saveFile(resultBlob, filename)
    processingStatus.value = `处理完成: ${filename}`
    currentDownloadSong.value = ''
  } finally {
    terminateActiveEncoderWorker()
    audioContext.close()
    processingStatus.value = ''
  }
}

const processAndMergeAudioStreaming = async (selectedSongsList, config) => {
  const audioContext = createDownloadAudioContext()
  const extension = config.exportFormat === 'wav' ? 'wav' : 'mp3'
  let streamSession = null

  try {
    streamSession = await createStreamingEncoderSession(
      extension,
      config,
      audioContext.sampleRate || 44100
    )
    let successCount = 0

    for (let i = 0; i < selectedSongsList.length; i++) {
      const song = selectedSongsList[i].song
      currentDownloadSong.value = `${song.artist} - ${song.title}`
      processingStatus.value = `正在准备: ${song.title}`

      let track = null
      try {
        // 老设备内存更容易被多首 PCM 同时占满，因此合并时始终逐首解码和编码。
        track = await decodeSongTrack(song, audioContext, config.quality, {
          releasePreload: true
        })
      } catch (error) {
        console.error(`解码失败: ${song.title}`, error)
        downloadErrors.value.push({
          id: song.id,
          title: song.title,
          artist: song.artist,
          error: `解码失败: ${error.message}`
        })
        activeDownloads.delete(song.id)
        downloadedCount.value++
        continue
      }

      try {
        processingStatus.value = `正在写入合并文件: ${song.title}`
        await streamSession.appendTrack(track)
        successCount++
      } catch (error) {
        console.error(`写入合并文件失败: ${song.title}`, error)
        throw new Error(`写入合并文件失败: ${error.message}`)
      } finally {
        activeDownloads.delete(song.id)
        downloadedCount.value++
      }
    }

    if (successCount === 0) throw new Error('没有成功处理的音频')

    processingStatus.value = '正在完成合并文件...'
    const resultBlob = await streamSession.finish()
    streamSession = null
    downloadedCount.value = totalCount.value
    const filename = buildMergedFilename(selectedSongsList, extension, config.customFilename)

    saveFile(resultBlob, filename)
    processingStatus.value = `处理完成: ${filename}`
    currentDownloadSong.value = ''
  } catch (error) {
    console.error('合并过程出错:', error)
    pushMergeError(error)
    if (window.$showNotification) {
      window.$showNotification('合并失败: ' + error.message, 'error')
    }
  } finally {
    if (streamSession) {
      streamSession.cancel()
    }
    terminateActiveEncoderWorker()
    audioContext.close()
    processingStatus.value = ''
  }
}

const processAndMergeAudio = async (selectedSongsList, config) => {
  const useFastMergeMode = shouldUseFastMergeMode(selectedSongsList)

  if (!useFastMergeMode) {
    processingStatus.value = '正在使用兼容模式合并...'
    await processAndMergeAudioStreaming(selectedSongsList, config)
    return
  }

  try {
    processingStatus.value = '正在使用快速模式合并...'
    await processAndMergeAudioFast(selectedSongsList, config)
  } catch (error) {
    if (isLikelyMemoryError(error)) {
      console.warn('快速合并内存不足，切换到兼容模式:', error)
      downloadedCount.value = 0
      downloadErrors.value = []
      activeDownloads.clear()
      if (window.$showNotification) {
        window.$showNotification('快速合并内存不足，已切换兼容模式重试', 'warning')
      }
      await processAndMergeAudioStreaming(selectedSongsList, config)
      return
    }

    console.error('合并过程出错:', error)
    pushMergeError(error)
    if (window.$showNotification) {
      window.$showNotification('合并失败: ' + error.message, 'error')
    }
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
  currentTaskType.value = shouldMergeSongs.value ? 'merge' : 'download'

  // 快照当前配置，防止下载过程中用户修改配置影响当前任务
  const taskConfig = {
    quality: selectedQuality.value,
    exportFormat: exportFormat.value,
    customFilename: customFilename.value,
    convertAudioFormat: convertAudioFormat.value,
    normalizeAudio: normalizeAudio.value,
    targetDb: targetDb.value
  }

  const selectedSongsList = props.songs.filter((song) => selectedSongs.value.has(song.song.id))
  // 合并模式分支
  if (currentTaskType.value === 'merge') {
    totalCount.value = selectedSongsList.length + 1
    await processAndMergeAudio(selectedSongsList, taskConfig)

    // 合并完成处理
    if (downloadErrors.value.length === 0) {
      // 清理缓存
      preloadedSongs.clear()

      setTimeout(() => {
        downloading.value = false
        currentTaskType.value = ''
        closeDialog()
      }, 2000)
    } else {
      downloading.value = false
      currentTaskType.value = ''
    }
    return
  }
  totalCount.value = selectedSongsList.length

  const shouldEncodeDownloads = taskConfig.convertAudioFormat || taskConfig.normalizeAudio
  // 普通批量下载模式。重编码会占用单个编码 Worker，逐首处理更稳。
  const concurrency = shouldEncodeDownloads ? 1 : DOWNLOAD_CONCURRENCY
  const queue = [...selectedSongsList]
  const workers = []
  let activeWorkers = 0
  const audioContext = shouldEncodeDownloads ? createDownloadAudioContext() : null

  const worker = async () => {
    while (queue.length > 0) {
      const songItem = queue.shift()
      if (!songItem) break

      const song = songItem.song
      activeWorkers++
      currentDownloadSong.value = `${song.artist} - ${song.title} (${activeWorkers}/${concurrency} 活动)`

      try {
        let blob
        let extension

        if (shouldEncodeDownloads) {
          const result = await encodeSingleSong(song, audioContext, taskConfig)
          blob = result.blob
          extension = result.extension
        } else {
          const result = await getAudioBlobForSong(song, taskConfig.quality)
          blob = result.blob
          extension = inferAudioExtension(blob, result.sourceUrl)
        }

        const filename = buildSingleFilename(song, extension)
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
        currentDownloadSong.value = queue.length > 0 ? `剩余 ${queue.length} 首` : '处理完成'
      }
    }
  }

  // 启动并发工作线程
  for (let i = 0; i < Math.min(concurrency, selectedSongsList.length); i++) {
    workers.push(worker())
  }

  try {
    await Promise.all(workers)
  } finally {
    terminateActiveEncoderWorker()
    if (audioContext) {
      audioContext.close()
    }
  }

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
      currentTaskType.value = ''
      closeDialog()
    }, 2000)
  } else {
    downloading.value = false
    currentTaskType.value = ''
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
        const isQualityAvailable = extendedQualityOptions.value.some(
          (opt) => opt.value === qualityNum
        )
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
        } catch {
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
