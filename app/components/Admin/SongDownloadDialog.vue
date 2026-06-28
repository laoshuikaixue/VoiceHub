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
            <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">{{ locale.title }}</h3>
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
                >{{ locale.quality }}</label
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
                    >{{ locale.advancedOptions }}</label
                  >
                </div>

                <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  <!-- 合并开关 -->
                  <div v-if="selectedSongs.size > 1" class="flex items-center justify-between">
                    <div class="flex flex-col">
                      <span class="text-xs font-bold text-zinc-200">{{ locale.mergeIntoOne }}</span>
                      <span class="text-[10px] text-zinc-500">{{ locale.mergeDesc }}</span>
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
                        <span class="text-xs font-bold text-zinc-200">{{ locale.normalizeAudio }}</span>
                        <span
                          v-if="normalizeAudio"
                          class="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20"
                          >Peak {{ targetDb }}dB</span
                        >
                      </div>
                      <span class="text-[10px] text-zinc-500"
                        >{{ locale.normalizeDesc }}</span
                      >
                    </div>
                    <div class="flex items-center gap-3">
                      <button
                        class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                        :title="locale.saveDbPresetTitle"
                        @click="saveDbPreset"
                      >
                        <Save class="w-3 h-3" />
                        {{ showDbPresetSaved ? locale.saved : locale.savePreset }}
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
                        <span class="text-xs font-bold text-zinc-200">{{ locale.exportFormat }}</span>
                        <span class="text-[10px] text-zinc-500">
                          {{
                            shouldMergeSongs
                              ? locale.mergeNeedsFormat
                              : locale.transcodeSingle
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
                        <span class="text-xs font-bold text-zinc-200">{{ locale.format }}</span>
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
                          <span class="text-xs font-bold text-zinc-200">{{ locale.customFilename }}</span>
                        </div>
                        <button
                          class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                          :class="{ 'opacity-50 cursor-not-allowed': !customFilename }"
                          :title="locale.saveAsDefaultPreset"
                          @click="saveFilenamePreset"
                        >
                          <Save class="w-3 h-3" />
                          {{ showPresetSaved ? locale.saved : locale.savePreset }}
                        </button>
                      </div>
                      <div class="relative">
                        <input
                          v-model="customFilename"
                          type="text"
                          :placeholder="locale.filenamePlaceholder"
                          class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors pr-8"
                        >
                        <!-- 快速插入占位符按钮 -->
                        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <button
                            class="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                            :title="locale.insertAllSongs"
                            @click="insertPlaceholder('{songs}')"
                          >
                            {songs}
                          </button>
                          <button
                            class="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                            :title="locale.insertDate"
                            @click="insertPlaceholder('{date}')"
                          >
                            {date}
                          </button>
                        </div>
                      </div>
                      <p class="text-[9px] text-zinc-600">
                        {{ locale.placeholders }}
                        <code
                          class="bg-zinc-800 px-1 rounded text-zinc-400 cursor-pointer hover:text-blue-400"
                          @click="insertPlaceholder('{songs}')"
                          >{songs}</code
                        >
                        ({{ locale.allSongs }}),
                        <code
                          class="bg-zinc-800 px-1 rounded text-zinc-400 cursor-pointer hover:text-blue-400"
                          @click="insertPlaceholder('{date}')"
                          >{date}</code
                        >
                        ({{ locale.date }})
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
                    >{{ locale.songList }}</label
                  >
                  <div
                    v-if="estimatedTotalDuration.count > 0"
                    class="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20"
                  >
                    <Clock class="w-3 h-3" />
                    <span>{{ locale.estimatedDuration(formatDuration(estimatedTotalDuration.total)) }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="selectedSongs.size > 0"
                    class="text-[10px] font-bold text-purple-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                    :disabled="estimatingDuration"
                    :title="locale.estimateSelectedTitle"
                    @click="estimateSelectedDurations"
                  >
                    <Clock class="w-3 h-3" />
                    <span v-if="estimatingDuration">{{ locale.estimatingDuration }}</span>
                    <span v-else>{{ locale.estimateDuration }}</span>
                  </button>
                  <button
                    v-if="selectedSongs.size > 0"
                    class="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                    :title="locale.preloadSelectedTitle"
                    @click="preloadSelectedSongs"
                  >
                    <DownloadCloud class="w-3 h-3" />
                    {{ locale.preloadSelected }}
                  </button>
                  <button
                    class="text-[10px] font-bold text-blue-500/80 hover:text-blue-400 transition-colors"
                    @click="toggleSelectAll"
                  >
                    {{ isAllSelected ? locale.deselectAll : locale.selectAll }}
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
                      :title="locale.deleteCache"
                      @click.stop="removePreloaded(song.song.id)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      v-else
                      class="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-600 hover:text-blue-400 transition-colors"
                      :title="locale.preloadSong"
                      @click.stop="preloadSong(song.song)"
                    >
                      <DownloadCloud class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div v-if="songs.length === 0" class="p-8 text-center text-zinc-600 text-[10px]">
                  {{ locale.emptySongs }}
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
                  currentTaskType === 'merge' ? locale.processProgress : locale.downloadProgress
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
                    currentDownloadSong ? locale.downloadingSong(currentDownloadSong) : locale.preparing
                  }}</span>
                </template>
                <template v-else>
                  {{ downloadErrors.length > 0 ? locale.completeWithErrors : locale.complete }}
                </template>
              </div>

              <!-- 错误信息 -->
              <div
                v-if="downloadErrors.length > 0"
                class="bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-2"
              >
                <div class="text-[10px] font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle class="w-3 h-3" />
                  {{ locale.downloadFailedCount(downloadErrors.length) }}
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
              {{ locale.selectedSongsCount(selectedSongs.size) }}
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
                :disabled="downloading"
                @click="closeDialog"
              >
                {{ locale.cancel }}
              </button>
              <button
                v-if="!downloading && downloadedCount > 0"
                class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all uppercase tracking-wider"
                @click="closeDialog"
              >
                {{ locale.close }}
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
                      ? locale.processing
                      : locale.downloading
                    : shouldMergeSongs
                      ? locale.startProcessing
                      : locale.startDownload
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
import { getMusicUrlResult } from '~/utils/musicUrl'
import { useLocale } from '~/utils/locale'
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
} from '@lucide/vue'

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
const { admin } = useLocale()
const locale = computed(() => admin.value.songManagement.songDownloadDialog)

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

const NETEASE_DOWNLOAD_QUALITY_LEVEL_MAP = {
  2: 'standard',
  3: 'higher',
  4: 'exhigh',
  5: 'lossless',
  6: 'hires',
  9: 'jymaster'
}

const neteaseQualityLevelMap = {
  2: 'standard',
  3: 'higher',
  4: 'exhigh',
  5: 'lossless',
  6: 'hires',
  9: 'jymaster'
}

// 生成带描述的音质选项
const extendedQualityOptions = computed(() => {
  const options = getQualityOptions('netease')
  return options.map((opt) => ({
    ...opt,
    description: locale.value.qualityDescriptions[opt.value] || locale.value.qualityDescriptions.default
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
const DOWNLOAD_URL_RETRY_LIMIT = 3
const AUDIO_METADATA_TIMEOUT_MS = 10000
const NETEASE_PREVIEW_DURATION_SECONDS = 30
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

const getNeteaseCookie = () => {
  if (!import.meta.client) return ''

  try {
    return localStorage.getItem('netease_cookie') || ''
  } catch {
    return ''
  }
}

const getDownloadResolveOptions = (song, quality, excludeSources = [], ignoreProvidedUrl = false) => {
  const platform = getSongPlatform(song)
  const isPodcast =
    platform === 'netease-podcast' ||
    song?.sourceInfo?.type === 'voice' ||
    (song?.sourceInfo?.source === 'netease-backup' && song?.sourceInfo?.type === 'voice')

  return {
    unblock: isPodcast ? false : undefined,
    quality,
    mediaId: song?.sourceInfo?.strMediaMid || song?.sourceInfo?.mediaId || song?.sourceInfo?.mediaMid,
    excludeSources,
    ignoreProvidedUrl
  }
}

const isRetryableDownloadError = (error) => {
  const message = String(error?.message || error || '')
  return /404|not found|failed to fetch|networkerror|http( error|\s+\d+)|疑似试听时长|无法从播放链接获取时长|无法获取音乐播放链接/i.test(
    message
  )
}

const resolveDownloadAudioCandidate = async (
  song,
  quality,
  excludeSources = [],
  ignoreProvidedUrl = false
) => {
  const platform = getSongPlatform(song)
  const result = await getMusicUrlResult(
    platform,
    song?.musicId,
    song?.playUrl,
    getDownloadResolveOptions(song, quality, excludeSources, ignoreProvidedUrl)
  )

  if (!result?.url) {
    throw new Error(locale.value.musicUrlMissing)
  }

  return result
}

const withDownloadSourceFallback = async (song, quality, executor) => {
  let excludeSources = []
  const hasPlayUrl = !!(song?.playUrl && song.playUrl.trim())
  let ignoreProvidedUrl = !hasPlayUrl
  let lastError = null

  for (let attempt = 0; attempt < DOWNLOAD_URL_RETRY_LIMIT; attempt++) {
    let candidate

    try {
      candidate = await resolveDownloadAudioCandidate(
        song,
        quality,
        excludeSources,
        ignoreProvidedUrl
      )
    } catch (resolveError) {
      lastError = resolveError

      if (!isRetryableDownloadError(resolveError)) {
        throw resolveError
      }

      ignoreProvidedUrl = true
      continue
    }

    try {
      return await executor(candidate)
    } catch (error) {
      lastError = error

      if (!isRetryableDownloadError(error)) {
        throw error
      }

      if (candidate.source === 'play-url') {
        ignoreProvidedUrl = true
        continue
      }

      if (candidate.source && !excludeSources.includes(candidate.source)) {
        excludeSources = [...excludeSources, candidate.source]
        continue
      }

      if (ignoreProvidedUrl) {
        throw error
      }

      ignoreProvidedUrl = true
    }
  }

  throw lastError || new Error(locale.value.musicUrlMissing)
}

// 格式化时长
const formatDuration = (seconds) => {
  if (!seconds) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const readAudioMetadataDuration = (src, options = {}) => {
  if (!src) return Promise.resolve(0)

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
    const result = await withDownloadSourceFallback(song, selectedQuality.value, async (candidate) => {
      const response = await fetch(candidate.url)
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

      return {
        blob,
        duration,
        url: candidate.url,
        contentType
      }
    })

    preloadedSongs.set(song.id, {
      blob: result.blob,
      duration: result.duration,
      loading: false,
      progress: 100,
      quality: selectedQuality.value,
      url: result.url,
      contentType: result.contentType
    })
  } catch (error) {
    console.error('预下载失败:', error)
    preloadedSongs.delete(song.id)
    if (window.$showNotification) {
      window.$showNotification(locale.value.preloadFailed(song.title), 'error')
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
    const level = NETEASE_DOWNLOAD_QUALITY_LEVEL_MAP[selectedQuality.value] || 'exhigh'
    const neteaseCookie = getNeteaseCookie()
    
    const songsToEstimate = []
    
    // 筛选需要预估的歌曲
    props.songs.forEach((songItem) => {
      const songId = songItem.song?.id
      if (!songId || !selectedSongs.value.has(songId)) return
      
      // 已有缓存、API 预估或歌曲元数据时，无需再次请求网络。
      if (getKnownSongDuration(songItem) > 0) return
      
      songsToEstimate.push(songItem)
    })

    console.log(`[预估时长] 需要预估的歌曲数量: ${songsToEstimate.length}`)

    if (songsToEstimate.length === 0) {
      if (window.$showNotification) {
        window.$showNotification(locale.value.allSelectedHaveDuration, 'info')
      }
      estimatingDuration.value = false
      return
    }

    let successCount = 0
    let failCount = 0
    
    const estimateSongDuration = async (songItem) => {
      try {
        console.log('[预估时长] 正在获取歌曲时长:', songItem.song.title)
        
        if (isNeteaseSong(songItem.song)) {
          try {
            const apiResponse = await $fetch('/api/api-enhanced/netease/song/url/v1', {
              params: {
                id: songItem.song.musicId,
                level: level,
                cookie: neteaseCookie || undefined,
                unblock: neteaseCookie ? false : true
              },
              timeout: 5000
            })
            
            if (apiResponse?.code === 200 && Array.isArray(apiResponse.data) && apiResponse.data.length > 0) {
              const songData = apiResponse.data[0]
              const durationMs = songData.time
              
              if (durationMs && durationMs > 0) {
                const durationSeconds = Math.floor(durationMs / 1000)
                if (durationSeconds !== NETEASE_PREVIEW_DURATION_SECONDS) {
                  estimatedDurations.set(songItem.song.id, {
                    durationSeconds,
                    durationMs: durationMs,
                    source: 'netease-api'
                  })
                  console.log('[预估时长] 成功获取时长:', songItem.song.title, durationSeconds + '秒')
                  successCount++
                  return
                }
                console.warn('[预估时长] 网易API返回疑似试听时长，尝试第三方音源:', songItem.song.title)
              }
            }
          } catch (apiError) {
            console.warn('[预估时长] 网易API调用失败，尝试从播放链接获取:', songItem.song.title, apiError)
          }
        }
        
        // 非网易音源、网易 API 失败或返回试听片段时，复用预下载的音源解析逻辑读取元数据。
        try {
          const durationResult = await withDownloadSourceFallback(
            songItem.song,
            selectedQuality.value,
            async (candidate) => {
              const duration = await readAudioMetadataDuration(candidate.url)

              if (!duration || duration <= 0) {
                throw new Error(locale.value.durationFromPlaybackUrlFailed)
              }

              const durationSeconds = Math.floor(duration)
              if (
                isNeteaseSong(songItem.song) &&
                durationSeconds === NETEASE_PREVIEW_DURATION_SECONDS
              ) {
                throw new Error(locale.value.previewDurationDetected)
              }

              return {
                durationSeconds,
                durationMs: Math.floor(duration * 1000),
                source: 'audio-metadata'
              }
            }
          )

          estimatedDurations.set(songItem.song.id, durationResult)
          console.log(
            '[预估时长] 从播放链接获取时长:',
            songItem.song.title,
            durationResult.durationSeconds + '秒'
          )
          successCount++
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
      window.$showNotification(locale.value.estimateSuccess(successCount), 'success')
    }
    
    if (failCount > 0 && window.$showNotification) {
      window.$showNotification(locale.value.estimateFailedCount(failCount), 'warning')
    }
  } catch (error) {
    console.error('[预估时长] 总体失败:', error)
    if (window.$showNotification) {
      window.$showNotification(locale.value.estimateFailed, 'error')
    }
  } finally {
    estimatingDuration.value = false
  }
}

// 计算预估总时长
const estimatedTotalDuration = computed(() => {
  let total = 0
  let count = 0
  const songMap = new Map(props.songs.map((item) => [item.song?.id, item]))
  selectedSongs.value.forEach((id) => {
    const songItem = songMap.get(id)
    if (!songItem) return

    const duration = getKnownSongDuration(songItem)
    if (duration > 0) {
      total += duration
      count++
    }
  })
  return { total, count }
})

const getKnownSongDuration = (songItem) => {
  const song = songItem.song
  const cached = getUsablePreload(song.id, selectedQuality.value)
  if (cached?.duration) return cached.duration

  const estimated = estimatedDurations.get(song.id)
  if (estimated?.durationSeconds) return estimated.durationSeconds

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
    title: locale.value.mergeTitle,
    artist: '',
    error: error?.message || String(error || locale.value.mergeFailed)
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
      processingStatus.value = locale.value.downloadingProgress(songTitle, percent)
      activeDownloads.set(songId, percent)
    }
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  return new Blob(chunks, { type: contentType })
}

const getAudioBlobForSong = async (song, quality) => {
  const cached = getUsablePreload(song.id, quality)
  if (cached) {
    processingStatus.value = locale.value.usingPreloadCache(song.title)
    activeDownloads.set(song.id, 100)
    return {
      blob: cached.blob,
      sourceUrl: cached.url || '',
      fromCache: true
    }
  }

  return await withDownloadSourceFallback(song, quality, async (candidate) => {
    processingStatus.value = locale.value.downloadingTitle(song.title)
    const blob = await fetchAudioWithProgress(candidate.url, song.id, song.title)
    return {
      blob,
      sourceUrl: candidate.url,
      fromCache: false
    }
  })
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
    filename = locale.value.mergedFilename(dateStr, selectedSongsList.length, ext)
  }
  return filename
}

const formatWorkerProgress = (stage, value, format) => {
  if (stage === 'prepare') {
    processingStatus.value = locale.value.preprocessingAudio(value)
    return
  }
  if (stage === 'merge') {
    processingStatus.value = locale.value.mergingAudio(value)
    return
  }
  processingStatus.value = locale.value.encodingAudio(format.toUpperCase(), value)
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
        reject(new Error(message || locale.value.encodingFailed))
        return
      }
      if (type === 'done') {
        terminateActiveEncoderWorker()
        resolve(blob)
      }
    }
    worker.onerror = (event) => {
      terminateActiveEncoderWorker()
      reject(new Error(event.message || locale.value.encoderWorkerFailed))
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
      const error = new Error(message || locale.value.encodingFailed)
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
    const error = new Error(event.message || locale.value.encoderWorkerFailed)
    abortSession(error)
  }

  const sendCommand = (payload, transferables = [], expectedTypes = []) => {
    if (isAborted) {
      return Promise.reject(new Error(locale.value.encoderWorkerTerminated))
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
      rejectPendingRequests(new Error(locale.value.encodingCanceled))
      terminateSessionWorker()
    }
  }
}

const decodeAudioBlobToTrack = async (song, blob, audioContext) => {
  const arrayBuffer = await blob.arrayBuffer()
  processingStatus.value = locale.value.decoding(song.title)
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
    ? locale.value.normalizing(song.title)
    : locale.value.converting(song.title)
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
        processingStatus.value = locale.value.fastPreparing(song.title)

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

    if (tracks.length === 0) throw new Error(locale.value.noProcessedAudio)

    processingStatus.value = locale.value.fastMerging
    await new Promise((resolve) => setTimeout(resolve, 50))

    const extension = config.exportFormat === 'wav' ? 'wav' : 'mp3'
    const resultBlob = await encodeWithWorker(tracks, extension, config)
    downloadedCount.value = totalCount.value
    const filename = buildMergedFilename(selectedSongsList, extension, config.customFilename)

    saveFile(resultBlob, filename)
    processingStatus.value = locale.value.completedFile(filename)
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
      processingStatus.value = locale.value.preparingSong(song.title)

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
          error: locale.value.decodeFailed(error.message)
        })
        activeDownloads.delete(song.id)
        downloadedCount.value++
        continue
      }

      try {
        processingStatus.value = locale.value.writingMergedFile(song.title)
        await streamSession.appendTrack(track)
        successCount++
      } catch (error) {
        console.error(`写入合并文件失败: ${song.title}`, error)
        throw new Error(locale.value.writeMergedFileFailed(error.message))
      } finally {
        activeDownloads.delete(song.id)
        downloadedCount.value++
      }
    }

    if (successCount === 0) throw new Error(locale.value.noProcessedAudio)

    processingStatus.value = locale.value.finishingMergedFile
    const resultBlob = await streamSession.finish()
    streamSession = null
    downloadedCount.value = totalCount.value
    const filename = buildMergedFilename(selectedSongsList, extension, config.customFilename)

    saveFile(resultBlob, filename)
    processingStatus.value = locale.value.completedFile(filename)
    currentDownloadSong.value = ''
  } catch (error) {
    console.error('合并过程出错:', error)
    pushMergeError(error)
    if (window.$showNotification) {
      window.$showNotification(locale.value.mergeFailed + ': ' + error.message, 'error')
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
    processingStatus.value = locale.value.compatibleMerge
    await processAndMergeAudioStreaming(selectedSongsList, config)
    return
  }

  try {
    processingStatus.value = locale.value.fastMerge
    await processAndMergeAudioFast(selectedSongsList, config)
  } catch (error) {
    if (isLikelyMemoryError(error)) {
      console.warn('快速合并内存不足，切换到兼容模式:', error)
      downloadedCount.value = 0
      downloadErrors.value = []
      activeDownloads.clear()
      if (window.$showNotification) {
        window.$showNotification(locale.value.fastMergeMemoryFallback, 'warning')
      }
      await processAndMergeAudioStreaming(selectedSongsList, config)
      return
    }

    console.error('合并过程出错:', error)
    pushMergeError(error)
    if (window.$showNotification) {
      window.$showNotification(locale.value.mergeFailed + ': ' + error.message, 'error')
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
      currentDownloadSong.value = locale.value.activeWorkers(`${song.artist} - ${song.title}`, activeWorkers, concurrency)

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
        currentDownloadSong.value = queue.length > 0 ? locale.value.remainingSongs(queue.length) : locale.value.processComplete
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
      window.$showNotification(locale.value.downloadSuccess(successCount), 'success')
    } else {
      window.$showNotification(
        locale.value.downloadCompleteWithCount(successCount, downloadErrors.value.length),
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
